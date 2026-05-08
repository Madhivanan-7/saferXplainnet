
# SafeRxplainNet

SafeRx ExplainNet is an AI-powered prescription explanation system that helps users understand medicines from prescription images or direct medicine search.

The system extracts prescription text using OCR, detects medicine-related entities using a biomedical NER model, matches medicines against a local medicine knowledge base, and presents patient-friendly information such as usage, dosage, duration, side effects, Tamil translation, and text-to-speech output.

## Screenshots

### Landing Page
<img src="https://github.com/user-attachments/assets/198740a0-81b5-4ad6-9c03-7ef379100a29" width="720" alt="SafeRx landing page" />

<br><br>

### Prescription Analysis
<img src="https://github.com/user-attachments/assets/c24f81ca-81ff-4d7a-9778-a5a1f74ae86c" width="720" alt="Prescription analysis result" />

<br><br>

### Medicine Search
<img src="https://github.com/user-attachments/assets/57b545cc-0513-42e3-aa9c-75e445b8aad2" width="720" alt="Medicine search result" />

### Conference Certificate

<img width="720"  alt="cert1" src="https://github.com/user-attachments/assets/166e1cdd-d77a-4c44-aff3-8a57156dcce2" />

---

## Features

- Prescription image upload
- OCR-based text extraction
- Google Vision OCR support
- Biomedical NER model for medical entity extraction
- Medicine name matching using fuzzy search
- Medicine details from local medicine database
- Direct medicine search
- English and Tamil UI output
- Tamil translation support
- Google Text-to-Speech voice output
- Voice playback control
- Modern React UI with animated cards and border glow effects

---

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React
- Axios

### Backend
- FastAPI
- Python
- Tesseract OCR
- Google Cloud Vision OCR
- Google Cloud Text-to-Speech
- Hugging Face Transformers
- Biomedical NER model
- RapidFuzz
- JSON-based medicine database

---

## Project Architecture

```text
Prescription Image
        ↓
OCR Extraction
        ↓
Biomedical NER Model
        ↓
Medicine DB + Fuzzy Matching
        ↓
Patient-Friendly Explanation
        ↓
Tamil Translation + Text-to-Speech
        ↓
Frontend Result Cards
```
```text
Folder structure

saferx-explainnet
├── backend
│   ├── main.py
│   ├── medicine_db.json
│   └── requirements.txt
│
├── frontend
│   ├── src
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```
Backend Setup:

cd backend

Create and activate virtual environment:
python -m venv venv
venv\Scripts\activate

pip install fastapi uvicorn python-multipart pillow pytesseract rapidfuzz python-dotenv requests transformers torch google-cloud-vision google-cloud-texttospeech

Set Google credentials:

$env:GOOGLE_APPLICATION_CREDENTIALS="C:\final-year-project\saferx-explainnet\backend\google-vision-key.json"
$env:USE_PREMIUM_OCR="true"

Run backend:
uvicorn main:app --reload

Backend runs at:
http://127.0.0.1:8000

Swagger API docs:
http://127.0.0.1:8000/docs


Frontend Setup

Go to frontend folder:
cd frontend

Install dependencies:
npm install

Run frontend:
npm run dev

Frontend runs at:
http://localhost:5173

Important Security Note

The Google Cloud service account key is not included in this repository.

Create your own Google Cloud service account key and place it locally as:

backend/google-vision-key.json

This file is ignored by Git for safety.

API Endpoints
Health Check
GET /

Analyze Prescription
POST /analyze

Accepts prescription image and returns extracted text, OCR engine, confidence, medicine details, and AI-detected entities.

Search Medicine
GET /medicine/{medicine_name}

Returns medicine usage and side effect details from the local medicine database.

Text-to-Speech
POST /tts
Generates voice output from text using Google Cloud Text-to-Speech.
