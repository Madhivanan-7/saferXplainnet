from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFilter, ImageOps
import pytesseract
import io
try:
    from transformers import pipeline
except Exception:
    pipeline = None
import re
from google.cloud import vision
import os
import requests
import json
from rapidfuzz import process, fuzz
from dotenv import load_dotenv
from google.cloud import translate_v2 as translate
from google.cloud import texttospeech
from pydantic import BaseModel
import base64
translate_client = translate.Client()

load_dotenv()

if os.name == "nt":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

app = FastAPI(title="SafeRx ExplainNet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ABBREVIATIONS = {
    "OD": "once daily",
    "BD": "twice daily",
    "TDS": "three times daily",
    "SOS": "only if needed",
    "HS": "at bedtime",
    "QHS": "every night before sleep",
    "BID": "twice daily",
    "TID": "three times daily",
    "QID": "four times daily",
    "AC": "before food",
    "PC": "after food",
    "STAT": "immediately",
}
with open("medicine_db.json", "r") as f:
    MEDICINE_INFO = json.load(f)

MEDICINE_DB = list(MEDICINE_INFO.keys())
ner_pipeline = None

def get_ner_pipeline():
    global ner_pipeline

    if pipeline is None:
        print("Biomedical NER disabled: transformers not installed")
        return None

    if ner_pipeline is None:
        print("Loading biomedical NER model...")
        ner_pipeline = pipeline(
            "ner",
            model="d4data/biomedical-ner-all",
            aggregation_strategy="simple"
        )

    return ner_pipeline

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("L")

    image = ImageOps.autocontrast(image)
    image = image.filter(ImageFilter.SHARPEN)

    w, h = image.size

    if w < 1200:
        scale = 3
    else:
        scale = 2

    image = image.resize((w * scale, h * scale))

    image = image.point(lambda x: 0 if x < 160 else 255)

    return image

def run_tesseract(image_bytes):
    image = preprocess_image(image_bytes)
    custom_config = r"--oem 3 --psm 11"
    return pytesseract.image_to_string(image, config=custom_config)
def run_google_vision_ocr(image_bytes):
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)

        response = client.document_text_detection(image=image)

        if response.error.message:
            print("Google Vision Error:", response.error.message)
            return ""

        if response.full_text_annotation:
            return response.full_text_annotation.text

        return ""
    except Exception as e:
        print("Google OCR failed:", e)
        return ""
def translate_text(text, target_lang="ta"):
    try:
        if not text:
            return text

        result = translate_client.translate(
            text,
            target_language=target_lang
        )

        return result["translatedText"]

    except Exception as e:
        print("Translation failed:", e)
        return text

class TTSRequest(BaseModel):
    text: str
    language: str = "ta"

def format_medicine_name(name, lang):
    if lang == "ta":
        tamil_name = translate_text(name, "ta")
        return f"{name} ({tamil_name})"
    return name

def convert_units_to_tamil(text):
    if not text:
        return text

    return (
        text.replace("mg", " மி.கி")
            .replace("ml", " மி.லி")
            .replace("g", " கிராம்")
    )

def calculate_confidence(text):
    clean_text = text.strip()

    if len(clean_text) < 25:
        return "low"

    lines = [line.strip() for line in clean_text.split("\n") if line.strip()]
    lower_text = clean_text.lower()

    medicine_matches = sum(
        1 for med in MEDICINE_DB
        if med.lower() in lower_text
    )

    dosage_patterns = re.findall(
        r"\b\d+\s?(mg|ml|mcg|g|tablet|tablets|tab|tabs)\b",
        lower_text
    )

    prescription_words = [
        "tab", "tablet", "cap", "capsule", "syp", "syrup",
        "dose", "daily", "days", "morning", "night",
        "before food", "after food"
    ]

    prescription_word_matches = sum(
        1 for word in prescription_words
        if word in lower_text
    )

    weird_lines = 0

    for line in lines:
        letters = sum(c.isalpha() for c in line)
        symbols = sum(not c.isalnum() and not c.isspace() for c in line)

        if len(line) < 4:
            weird_lines += 1
        elif symbols > letters:
            weird_lines += 1

    weird_ratio = weird_lines / len(lines) if lines else 1

    score = 0

    if medicine_matches >= 2:
        score += 4
    elif medicine_matches == 1:
        score += 2

    if len(dosage_patterns) >= 2:
        score += 3
    elif len(dosage_patterns) == 1:
        score += 2

    if prescription_word_matches >= 3:
        score += 2
    elif prescription_word_matches >= 1:
        score += 1

    if weird_ratio < 0.35:
        score += 1
    elif weird_ratio > 0.55:
        score -= 2

    if medicine_matches == 0:
        if score >= 3:
            return "medium"
        return "low"
    if medicine_matches >= 1 and score >= 6:
        return "high"

    if score >= 3:
        return "medium"
    return "low"
    
def find_medicine_name(line):
    words = re.findall(r"[A-Za-z]+", line.lower())

    best_match = None
    best_score = 0

    for word in words:
        match = process.extractOne(word, MEDICINE_DB, scorer=fuzz.ratio)
        if match:
            medicine_key, score, _ = match
            if score > best_score:
                best_match = medicine_key
                best_score = score

    if best_score >= 88:
        return best_match, best_score

    return None, best_score


def extract_dose(line):
    match = re.search(r"\b\d+\s?(mg|ml|mcg|g)\b", line.lower())
    return match.group() if match else "Not clearly detected"


def extract_duration(line):
    match = re.search(r"\b\d+\s?(day|days|week|weeks|month|months)\b", line.lower())
    return match.group() if match else "Not clearly detected"


def extract_frequency(line):
    lower = line.lower()

    for short, meaning in ABBREVIATIONS.items():
        if re.search(rf"\b{short.lower()}\b", lower):
            return meaning

    if "once" in lower:
        return "once daily"
    if "twice" in lower:
        return "twice daily"
    if "morning" in lower and "night" in lower:
        return "morning and night"

    return "Not clearly detected"


def extract_medicines(text):
    results = []

    for line in text.split("\n"):
        clean = line.strip()
        if not clean:
            continue

        medicine_key, match_score = find_medicine_name(clean)

        if medicine_key:
            info = MEDICINE_INFO[medicine_key]

            results.append({
                "original_line": clean,
                "medicine": info["name"],
                "match_confidence": match_score,
                "dose": extract_dose(clean),
                "frequency": extract_frequency(clean),
                "duration": extract_duration(clean),
                "used_for": info["used_for"],
                "side_effects": info["side_effects"],
                "safety": "This information is educational. Confirm with a doctor or pharmacist before taking medicine."
            })

    return results


def extract_ai_entities(text):
    try:
        ner = get_ner_pipeline()

        if ner is None:
            return []

        entities = ner(text[:1500])
        results = []

        for ent in entities:
            word = ent.get("word", "").strip()
            label = ent.get("entity_group", "")
            score = round(float(ent.get("score", 0)) * 100, 2)

            if word:
                results.append({
                    "text": word,
                    "label": label,
                    "confidence": score
                })

        return results

    except Exception as e:
        print("AI NER failed:", e)
        return []


def explain_prescription(text):
    explanations = []

    for line in text.split("\n"):
        clean = line.strip()
        if not clean:
            continue

        explanation = clean

        for short, meaning in ABBREVIATIONS.items():
            explanation = re.sub(
                rf"\b{short}\b",
                meaning,
                explanation,
                flags=re.IGNORECASE
            )

        explanations.append({
            "original": clean,
            "explanation": explanation
        })

    return explanations
def search_medicine_by_name(name):
    query = name.lower().strip()

    match = process.extractOne(query, MEDICINE_DB, scorer=fuzz.ratio)

    if not match:
        return None

    medicine_key, score, _ = match

    if score < 82:
        return None

    info = MEDICINE_INFO[medicine_key]

    return {
        "medicine": info["name"],
        "match_confidence": score,
        "dose": "As prescribed",
        "frequency": "As prescribed",
        "duration": "As prescribed",
        "used_for": info["used_for"],
        "side_effects": info["side_effects"],
        "safety": "This information is educational. Confirm with a doctor or pharmacist before taking medicine."
    }

@app.post("/tts")
@app.post("/api/tts")
def generate_tts(request: TTSRequest):
    try:
        client = texttospeech.TextToSpeechClient()

        synthesis_input = texttospeech.SynthesisInput(text=request.text)

        if request.language == "ta":
            voice = texttospeech.VoiceSelectionParams(
                language_code="ta-IN",
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
            )
        else:
            voice = texttospeech.VoiceSelectionParams(
                language_code="en-US",
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
            )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.9
        )

        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )

        audio_base64 = base64.b64encode(response.audio_content).decode("utf-8")

        return {
            "success": True,
            "audio": audio_base64,
            "format": "mp3"
        }

    except Exception as e:
        print("TTS failed:", e)
        return {
            "success": False,
            "message": "Text-to-speech failed"
        }


@app.get("/")
def home():
    return {"message": "SafeRx ExplainNet Backend Running"}

@app.get("/api")
@app.get("/api/")
def api_home():
    return {"message": "SafeRx ExplainNet Backend Running"}

@app.get("/medicine/{medicine_name}")
@app.get("/api/medicine/{medicine_name}")
def get_medicine_details(medicine_name: str):
    result = search_medicine_by_name(medicine_name)

    if not result:
        return {
            "found": False,
            "message": "Medicine not found in database. Try another spelling or verify with a pharmacist."
        }

    return {
        "found": True,
        "result": result
    }
@app.post("/analyze")
@app.post("/api/analyze")
async def analyze_prescription(file: UploadFile = File(...),language: str = "en"):
    image_bytes = await file.read()
    print("LANG RECEIVED:", language)
    extracted_text = run_tesseract(image_bytes)
    confidence = calculate_confidence(extracted_text)
    ocr_engine = "Tesseract OCR"

    use_premium = os.getenv("USE_PREMIUM_OCR", "false").lower() == "true"

    if confidence == "low" and use_premium:
        premium_text = run_google_vision_ocr(image_bytes)

        if premium_text.strip():
            extracted_text = premium_text
            confidence = calculate_confidence(extracted_text)
            ocr_engine = "Google Vision OCR"

    explained = explain_prescription(extracted_text)
    medicine_details = extract_medicines(extracted_text)
    ai_entities = extract_ai_entities(extracted_text)
    
    
    if not medicine_details:
        medicine_details = []

        for ent in ai_entities:
            medicine_key = None
            score = 0

            if ent["label"].lower() in ["medication", "drug", "chemical"]:
                medicine_key, score = find_medicine_name(ent["text"])

                if medicine_key:
                    info = MEDICINE_INFO[medicine_key]

                    medicine_details.append({
                    "original_line": extracted_text,
                    "medicine": info["name"],
                    "match_confidence": score,
                    "dose": extract_dose(extracted_text),
                    "frequency": extract_frequency(extracted_text),
                    "duration": extract_duration(extracted_text),
                    "used_for": info["used_for"],
                    "side_effects": info["side_effects"],
                    "safety": "This information is educational. Confirm with a doctor or pharmacist before taking medicine."
                })
    safety_message = "This is only a prescription explanation tool. Always confirm medicine usage with a doctor or pharmacist."

    if confidence == "low":
        safety_message = "Handwriting is unclear. Please verify this prescription with a doctor or pharmacist before using any medicine."

    return {
    "ocr_engine": ocr_engine,
    "confidence": confidence,
    "extracted_text": extracted_text,
    "explained": explained,
    "medicine_details": medicine_details,
    "ai_entities": ai_entities,
    "warning": safety_message
}