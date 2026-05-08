import { useEffect, useRef, useState } from "react";
import axios from "axios";
import BorderGlow from "./components/BorderGlow";
const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.port === "5173";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (isLocalDev
    ? `http://${window.location.hostname}:8000`
    : `${window.location.origin}/api`);
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Pill,
  Sparkles,
  ShieldCheck,
  Volume2,
  Loader2,
  ScanLine,
  Search,
  ArrowRight,
  Brain,
  Activity,
  X,
} from "lucide-react";

const slogans = [
  "Know your medication.",
  "Decode every prescription.",
  "Clarity before consumption.",
  "AI for safer medicine.",
];
const translateFrequency = (frequency) => {
  const map = {
    "once daily": "ஒரு நாளைக்கு ஒரு முறை",
    "twice daily": "ஒரு நாளைக்கு இரண்டு முறை",
    "three times daily": "ஒரு நாளைக்கு மூன்று முறை",
    "four times daily": "ஒரு நாளைக்கு நான்கு முறை",
    "morning and night": "காலை மற்றும் இரவு",
    "as prescribed": "மருத்துவர் கூறியபடி",
    "Not clearly detected": "மருத்துவர் கூறியபடி",
  };

  return map[frequency] || frequency;
};  

const translateDuration = (duration) => {
  if (duration === "Not clearly detected") return "மருத்துவர் கூறியபடி";

  return duration
    .replace("days", "நாட்கள்")
    .replace("day", "நாள்")
    .replace("weeks", "வாரங்கள்")
    .replace("week", "வாரம்")
    .replace("months", "மாதங்கள்")
    .replace("month", "மாதம்");
};
const translateDose = (dose) => {
  if (!dose || dose === "Not clearly detected") return dose;

  return dose
    .replace(/mg/gi, "மி.கி")
    .replace(/ml/gi, "மி.லி")
    .replace(/mcg/gi, "மைக்ரோகிராம்")
    .replace(/\bg\b/gi, "கிராம்");
};
const translateDoseForVoice = (dose) => {
  if (!dose || dose === "Not clearly detected") return "";

  return dose
    .replace(/mg/gi, "மில்லிகிராம்")
    .replace(/ml/gi, "மில்லி லிட்டர்")
    .replace(/mcg/gi, "மைக்ரோகிராம்")
    .replace(/\bg\b/gi, "கிராம்");
};

const tamilTranslate = async (text) => {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(text)}`
  );
  const data = await res.json();
  return data[0].map((item) => item[0]).join("");
};
export default function App() {
  const audioRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("upload");
  const [speakingKey, setSpeakingKey] = useState(null);
const [language, setLanguage] = useState("en");
  const [sloganIndex, setSloganIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [showOcrText, setShowOcrText] = useState(false);
  const prescriptionResultRef = useRef(null);
const searchResultRef = useRef(null);

 useEffect(() => {
  const timer = setInterval(() => {
    setSloganIndex((prev) => (prev + 1) % slogans.length);
  }, 2200);

  return () => clearInterval(timer);
}, []);

const handleFile = (e) => {
  const selected = e.target.files[0];

  setResult(null);

  if (!selected) {
    setFile(null);
    setPreview("");
    return;
  }

  setFile(selected);
  setPreview(URL.createObjectURL(selected));
};
const clearSelectedFile = () => {
  setFile(null);
  setPreview("");
  setResult(null);

  const fileInput = document.getElementById("prescription-upload");
  if (fileInput) fileInput.value = "";
};

  const analyzePrescription = async () => {
    if (!file) return alert("Upload a prescription first bro 😤");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(res.data);

setTimeout(() => {
  prescriptionResultRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, 150);
    } catch (err) {
      alert("Backend not reachable. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  };

const searchMedicine = async () => {
  if (!searchTerm.trim()) return alert("Enter a medicine name first");

  try {
    const res = await axios.get(
      `${API_BASE}/medicine/${encodeURIComponent(searchTerm.trim())}`
    );

    if (!res.data.found) {
      alert(res.data.message);
      setSearchResult(null);
      return;
    }

    const med = res.data.result;

    setSearchResult({
  medicine: med.medicine,
  used_for: med.used_for,
  side_effects: med.side_effects,
  safety: med.safety,
});

setTimeout(() => {
  searchResultRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, 150);
  } catch (err) {
    alert("Backend search not reachable. Make sure FastAPI is running.");
  }
};


const speakWithGoogleTTS = async (text, language = "en", key = "voice") => {
  try {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    window.speechSynthesis.cancel();
    setSpeakingKey(key);

    const res = await axios.post(`${API_BASE}/tts`, {
      text,
      language,
    });

    if (!res.data.success) {
      alert("Voice generation failed");
      setSpeakingKey(null);
      return;
    }

    const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
    audioRef.current = audio;

    audio.onended = () => {
      setSpeakingKey(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setSpeakingKey(null);
      audioRef.current = null;
    };

    audio.play();
  } catch (err) {
    setSpeakingKey(null);
    alert("TTS backend not reachable");
  }
};

 const speak = (text, lang = "en-US", key = "voice") => {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = lang === "ta-IN" ? 0.85 : 0.92;
  utterance.pitch = 1;

  setSpeakingKey(key);

  utterance.onend = () => setSpeakingKey(null);
  utterance.onerror = () => setSpeakingKey(null);

  window.speechSynthesis.speak(utterance);
};
const buildSummary = (med) => {
  const isSearchOnly = med.dose === undefined;

  if (isSearchOnly) {
    return `Medicine name: ${med.medicine}. Commonly used for ${med.used_for}. Common side effects are ${med.side_effects.join(", ")}.`;
  }

  const dose = med.dose !== "Not clearly detected" ? ` ${med.dose}` : "";
  const frequency =
    med.frequency !== "Not clearly detected"
      ? ` ${med.frequency}`
      : " as prescribed";

  const duration =
    med.duration !== "Not clearly detected"
      ? ` for ${med.duration}`
      : "";

  return `Take ${med.medicine}${dose}${frequency}${duration}. It is commonly used to treat ${med.used_for}.`;
};
const buildTamilSummary = (med) => {
  const isSearchOnly = med.dose === undefined;

  if (isSearchOnly) {
    return `${med.medicine} என்ற மருந்து. பயன்படுத்துவது ${med.used_for}. பொதுவான பக்க விளைவுகள் ${med.side_effects.join(", ")}.`;
  }

  const dose = med.dose !== "Not clearly detected" ? med.dose : "";

  const duration =
    med.duration !== "Not clearly detected"
      ? `${translateDuration(med.duration)} வரை`
      : "மருத்துவர் கூறியபடி";

  const freqMap = {
    "once daily": "ஒரு நாளைக்கு ஒரு முறை",
    "twice daily": "ஒரு நாளைக்கு இரண்டு முறை",
    "three times daily": "ஒரு நாளைக்கு மூன்று முறை",
    "morning and night": "காலை மற்றும் இரவு",
    "Not clearly detected": "மருத்துவர் கூறியபடி",
  };

  const frequency = freqMap[med.frequency] || med.frequency;

  return `${med.medicine} ${dose} மாத்திரையை ${frequency} ${duration} எடுத்துக்கொள்ளவும். இது பொதுவாக ${med.used_for} குணப்படுத்த பயன்படுத்தப்படுகிறது.`;
};
  return (
    <main
      
      className="min-h-screen overflow-hidden bg-[#030712] relative text-white"
    >
  <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />

      
      <section className="relative z-10 px-4 sm:px-6 py-8 sm:py-10 max-w-7xl mx-auto">
        <nav className="flex items-center justify-between mb-14">
          <div className="flex items-center gap-3">
           <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-2xl">
  <Pill className="text-cyan-300 icon-flicker" strokeWidth={2.4} />
</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SafeRx</h1>
              <p className="text-xs text-white/50">ExplainNet AI</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-white/60">
            <ShieldCheck size={16} className="text-emerald-300" />
            Patient-safe medicine intelligence
          </div>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
  <BorderGlow
  edgeSensitivity={42}
  glowColor="190 95 72"
  backgroundColor="#0b1120"
  borderRadius={32}
  glowRadius={36}
  glowIntensity={0.75}
  coneSpread={18}
  animated={false}
  colors={["#22d3ee", "#c084fc", "#fbbf24"]}
>
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    className="rounded-[2rem] p-4 sm:p-5"
  >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-sm text-cyan-100 mb-6">
              <Sparkles size={16} />
              Future-ready AI healthcare interface
            </div>

            <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
              Decode
              <span className="block bg-gradient-to-r from-cyan-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">
                Medicines.
              </span>
              Instantly.
            </h2>

            <div className="h-10 mt-6">
              <AnimatePresence mode="wait">
                <motion.p
                  key={sloganIndex}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="text-2xl text-white/80 font-semibold"
                >
                  {slogans[sloganIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

           <p className="mt-4 text-base sm:text-lg text-white/60 max-w-xl leading-relaxed">
              Upload a prescription or search a medicine directly. SafeRx turns
              confusing medical text into simple, patient-friendly guidance.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/60">
              <Badge icon={<Brain size={15} />} text="AI Matching" />
              <Badge icon={<ScanLine size={15} />} text="OCR Pipeline" />
              <Badge icon={<Activity size={15} />} text="Safety Layer" />
            </div>
         
            </motion.div>
</BorderGlow>

<BorderGlow
  edgeSensitivity={42}
  glowColor="190 95 72"
  backgroundColor="#0b1120"
  borderRadius={32}
  glowRadius={36}
  glowIntensity={0.75}
  coneSpread={18}
  animated={false}
  colors={["#22d3ee", "#c084fc", "#fbbf24"]}
>
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    className="rounded-[2rem] p-5"
  >
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/30 border border-white/10 mb-5">
              <button
                onClick={() => {
  setMode("upload");
  setSearchResult(null);
  setLanguage("en");
}}
                className={`h-12 rounded-xl font-bold transition ${
                  mode === "upload"
                    ? "bg-white text-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Upload Prescription
              </button>
              <button
                onClick={() => {
  setMode("search");
  setResult(null);
  setFile(null);
  setPreview("");
  setLanguage("en");
}}
                className={`h-12 rounded-xl font-bold transition ${
                  mode === "search"
                    ? "bg-white text-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Search Medicine
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === "upload" ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                >
                  <label className="relative block rounded-[1.5rem] border border-dashed border-cyan-300/40 bg-black/30 p-6 text-center cursor-pointer overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-cyan-400/20 to-transparent" />
                    <UploadCloud className="mx-auto mb-4 text-cyan-300" size={44} />
                    <h3 className="text-xl font-bold">Upload Prescription</h3>
                    <p className="text-white/50 mt-2 text-sm">PNG, JPG, JPEG supported</p>
                   <input
  id="prescription-upload"
  type="file"
  accept="image/*"
  onChange={handleFile}
  className="hidden"
/>
                  </label>

                  {preview && (
  <div className="mt-5 relative rounded-3xl overflow-hidden border border-white/10 bg-black/30">
<button
  type="button"
  onClick={clearSelectedFile}
  className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-white/65 flex items-center justify-center hover:bg-zinc-800 hover:text-white hover:border-white/20 active:scale-95 transition"
  title="Clear image"
>
  <X size={18} strokeWidth={2.4} />
</button>

    <img
      src={preview}
      alt="Prescription preview"
      className="w-full max-h-72 object-contain"
    />
  </div>
)}

                  <button
                    onClick={analyzePrescription}
                    disabled={loading}
                    className="mt-5 w-full h-14 rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 text-black font-bold shadow-xl shadow-cyan-500/20 hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Analyzing prescription...
                      </>
                    ) : (
                      <>
                        <ScanLine />
                        Analyze with SafeRx AI
                      </>
                    )}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                 className="rounded-[1.5rem] bg-black/30 border border-white/10 p-5 sm:p-6"
                >
                  <div className="flex items-center gap-3 px-4 h-14 sm:h-16 rounded-2xl bg-white/10 border border-white/15 focus-within:border-cyan-300/60 transition">
                    <Search className="text-cyan-300" />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search medicine..."
                      className="bg-transparent outline-none w-full min-w-0 text-base sm:text-lg placeholder:text-white/35"
                    />
                  </div>

                  <button
                    onClick={searchMedicine}
                    className="mt-5 w-full h-14 rounded-2xl bg-white text-black font-black flex items-center justify-center cursor-pointer gap-2 hover:scale-[1.01] active:scale-[0.99] transition"
                  >
                    Analyze Medicine
                    <ArrowRight size={18} />
                  </button>

                  
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          </BorderGlow>
        </div>

      {searchResult && mode === "search" && (
 <section ref={searchResultRef} className="mt-12 sm:mt-16 scroll-mt-6">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-3xl sm:text-4xl font-black leading-tight">
        Medicine Search Result
      </h3>

      <div className="w-full sm:w-auto flex gap-2 rounded-2xl bg-white/10 border border-white/10 p-1">
        <button
          onClick={() => setLanguage("en")}
          className={`flex-1 sm:flex-none sm:min-w-[120px] px-4 py-3 rounded-xl font-bold transition ${
            language === "en" ? "bg-white text-black" : "text-white/60"
          }`}
        >
          English
        </button>

        <button
          onClick={() => setLanguage("ta")}
          className={`flex-1 sm:flex-none sm:min-w-[120px] px-4 py-3 rounded-xl font-bold transition ${
            language === "ta" ? "bg-white text-black" : "text-white/60"
          }`}
        >
          தமிழ்
        </button>
      </div>
    </div>

    <MedicineCard
      med={searchResult}
      speak={speak}
      speakWithGoogleTTS={speakWithGoogleTTS}
      buildSummary={buildSummary}
      buildTamilSummary={buildTamilSummary}
      language={language}
      speakingKey={speakingKey}
    />
  </section>
)}

        {result && (
         <motion.section
  ref={prescriptionResultRef}
  initial={{ opacity: 0, y: 24 }}
  animate={{ opacity: 1, y: 0 }}
  className="mt-16 scroll-mt-6"
>
           <div className="rounded-[2rem] bg-white/10 border border-white/15 backdrop-blur-2xl p-5 sm:p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-white/50 text-sm">OCR Engine</p>
                  <h3 className="text-2xl sm:text-2xl font-bold">{result.ocr_engine}</h3>
                </div>

                <div
                  className={`self-start sm:self-auto px-4 sm:px-5 py-2 sm:py-3 rounded-full text-sm sm:text-base font-bold ${
                    result.confidence === "high"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : result.confidence === "medium"
                      ? "bg-yellow-400/15 text-yellow-300"
                      : "bg-red-400/15 text-red-300"
                  }`}
                >
                  Confidence: {result.confidence}
                </div>
              </div>

              <p className="mt-5 text-sm text-white/60">{result.warning}</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
  <h3 className="text-3xl font-black leading-tight">Medicine Intelligence</h3>

  <div className="w-full sm:w-auto flex gap-2 rounded-2xl bg-white/10 border border-white/10 p-1">
    <button
      onClick={() => setLanguage("en")}
      className={`flex-1 sm:flex-none min-w-[120px] px-4 py-2 rounded-xl font-bold transition ${
        language === "en" ? "bg-white text-black" : "text-white/60"
      }`}
    >
      English
    </button>
    <button
      onClick={() => setLanguage("ta")}
      className={`flex-1 sm:flex-none min-w-[120px] px-4 py-2 rounded-xl font-bold transition ${
        language === "ta" ? "bg-white text-black" : "text-white/60"
      }`}
    >
      தமிழ்
    </button>
  </div>
</div>

            {result.medicine_details?.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
               {result.medicine_details.map((med, index) => (
  <MedicineCard
    key={index}
    med={med}
    speak={speak}
    speakWithGoogleTTS={speakWithGoogleTTS}
    buildSummary={buildSummary}
    buildTamilSummary={buildTamilSummary}
    language={language}
    speakingKey={speakingKey}
    
  />
))}
              </div>
            ) : (
              <div className="rounded-[2rem] bg-red-400/10 border border-red-300/20 p-6 text-red-100">
                No clear medicine names detected. Try a clearer image or verify with a pharmacist.
              </div>
            )}

         <div className="mt-8 rounded-[2rem] bg-black/35 border border-white/10 overflow-hidden">
  <button
    type="button"
    onClick={() => setShowOcrText((prev) => !prev)}
    className="w-full px-6 py-6 flex items-center justify-between text-left hover:bg-white/5 transition"
  >
    <div className="pr-6">
      <p className="text-white/80 font-bold">Extracted OCR Text</p>
      <p className="text-white/40 text-sm mt-1">
        {showOcrText ? "Hide raw prescription text" : "View raw prescription text"}
      </p>
    </div>

    <span className="text-cyan-300 text-xl font-bold shrink-0 px-3">
      {showOcrText ? "−" : "+"}
    </span>
  </button>

  {showOcrText && (
    <div className="px-6 pt-3 pb-6">
      <pre className="whitespace-pre-wrap text-white/70 text-sm leading-relaxed">
        {result.extracted_text}
      </pre>
    </div>
  )}
</div>
          </motion.section>
        )}
      </section>
    </main>
  );
}

function Badge({ icon, text }) {
  return (
    <span className="px-4 py-2 rounded-full bg-white/8 border border-white/10 flex items-center gap-2">
      {icon}
      {text}
    </span>
  );
}


function MedicineCard({
  med,
  speakWithGoogleTTS,
  speak,
  buildSummary,
  buildTamilSummary,
  language,
  speakingKey,
  
}) {
  const [translated, setTranslated] = useState(null);
  useEffect(() => {
  if (language === "ta") {
    const translateAll = async () => {
      const used_for = await tamilTranslate(med.used_for);

      const side_effects = await Promise.all(
        med.side_effects.map((s) => tamilTranslate(s))
      );

      const tamilName = await tamilTranslate(med.medicine);

    setTranslated({
  medicineTamil: tamilName,
  used_for,
  side_effects,
});
    };

    translateAll();
  } else {
    setTranslated(null);
  }
}, [language, med]);
  const summary =
  language === "ta" ? buildTamilSummary(med) : buildSummary(med);
const isSearchOnly = med.dose === undefined;
const voiceKey = `${med.medicine}-${language}`;
const isSpeaking = speakingKey === voiceKey;
const displayMedicine =
  language === "ta" && translated?.medicineTamil
    ? `${med.medicine} (${translated.medicineTamil})`
    : med.medicine;

const displayMedicineTamil = translated?.medicineTamil;
const displayUsedFor = translated?.used_for || med.used_for;
const displaySideEffects = translated?.side_effects || med.side_effects;

const displayDose =
  language === "ta"
    ? med.dose === "Not clearly detected"
      ? "மருத்துவர் கூறியபடி"
      : translateDose(med.dose)
    : med.dose;

const displayFrequency =
  language === "ta" ? translateFrequency(med.frequency) : med.frequency;

const displaySummary = isSearchOnly
  ? language === "ta"
    ? `${med.medicine} மருந்து ${displayUsedFor} போன்றவற்றிற்கு பயன்படுத்தப்படுகிறது.`
    : `Medicine name: ${med.medicine}. Commonly used for ${med.used_for}. Common side effects are ${med.side_effects.join(", ")}.`
  : language === "ta"
    ? `${med.medicine} ${
        displayDose !== "Not clearly detected" ? displayDose : ""
      } மருந்தை ${displayFrequency} ${
        med.duration !== "Not clearly detected"
          ? `${translateDuration(med.duration)} வரை`
          : ""
      } எடுத்துக்கொள்ளவும். இது ${displayUsedFor} போன்றவற்றிற்கு பயன்படுத்தப்படுகிறது.`
    : summary;

const voiceSummary = isSearchOnly
  ? language === "ta"
    ? `${med.medicine} மருந்து. பொதுவான பயன்கள்: ${displayUsedFor}. பொதுவான பக்க விளைவுகள்: ${displaySideEffects.join(", ")}.`
    : displaySummary
  : language === "ta"
    ? `${med.medicine} ${
        translateDoseForVoice(med.dose)
      } மருந்தை ${displayFrequency} ${
        med.duration !== "Not clearly detected"
          ? `${translateDuration(med.duration)} வரை`
          : ""
      } எடுத்துக்கொள்ளவும். இது ${displayUsedFor} போன்றவற்றிற்கு பயன்படுத்தப்படுகிறது.`
    : displaySummary;

const usedForLabel =
  language === "ta" ? "பொதுவான பயன்கள்" : "Commonly used for";

const sideEffectsLabel =
  language === "ta" ? "பொதுவான பக்க விளைவுகள்" : "Common side effects";

const safetyText =
  language === "ta"
    ? "இந்த தகவல் கல்விக்காக மட்டுமே. மருந்தை எடுத்துக்கொள்ளும் முன் மருத்துவர் அல்லது மருந்தாளரிடம் உறுதிப்படுத்தவும்."
    : med.safety;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
     className="rounded-[2rem] bg-white/10 border border-white/15 backdrop-blur-xl p-5 sm:p-6 shadow-2xl hover:-translate-y-1 transition"
    >
     <div className="flex items-start justify-between gap-3">
  <div className="min-w-0 flex-1 pr-2">
    <p className="text-cyan-300 text-sm font-semibold">Medicine</p>

    <h4 className="hidden sm:block text-3xl font-black mt-1 break-words leading-tight">
      {displayMedicine}
    </h4>

    <h4 className="block sm:hidden text-3xl font-black mt-1 break-words leading-tight">
      {med.medicine}
    </h4>

    {language === "ta" && displayMedicineTamil && (
      <p className="block sm:hidden mt-1 text-white text-2xl font-black break-words leading-tight">
        ({displayMedicineTamil})
      </p>
    )}
  </div>

   <button
 onClick={() =>
speakWithGoogleTTS(
  voiceSummary,
  language,
  voiceKey
)
}
  className={`shrink-0 h-12 w-12 rounded-2xl border flex items-center justify-center transition ${
    isSpeaking
      ? "bg-cyan-400/20 border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.45)]"
      : "bg-white/10 border-white/15 hover:bg-white/15"
  }`}
  title={isSpeaking ? "Speaking..." : "Read aloud"}
>
  <Volume2
    className={`${isSpeaking ? "text-cyan-200 animate-pulse" : "text-cyan-300"}`}
  />
</button>
      </div>
       {!isSearchOnly && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
       <Info label={language === "ta" ? "அளவு" : "Dose"} value={displayDose} />  
<Info
  label={language === "ta" ? "எத்தனை முறை" : "Frequency"}
   value={displayFrequency}
/>
<Info
  label={language === "ta" ? "காலம்" : "Duration"}
  value={language === "ta" ? translateDuration(med.duration) : med.duration}
/>
      </div>
      )}
      {!isSearchOnly && (
      <div className="mt-6 rounded-2xl bg-black/30 border border-white/10 p-4">
        <p className="text-white/45 text-xs uppercase tracking-widest">
          Patient-friendly instruction
        </p>
        <p className="mt-2 text-base sm:text-lg font-semibold text-white/90 leading-relaxed">
        {displaySummary}
        </p>
      </div>
      )}

      <div className="mt-5">
        <p className="text-white/45 text-sm">{usedForLabel}</p>
        <p className="mt-1 text-white/85 text-base leading-relaxed">{displayUsedFor}</p>
      </div>

      <div className="mt-5">
        <p className="text-white/45 text-sm">{sideEffectsLabel}</p> 
        <div className="mt-2 flex flex-wrap gap-2">
          {displaySideEffects.map((s, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full bg-violet-400/10 text-violet-200 border border-violet-300/10 text-sm leading-snug"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs text-white/45">{safetyText}</p>
    </motion.div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-3">
      <p className="text-white/40 text-xs">{label}</p>
      <p className="text-white font-bold mt-1 text-base sm:text-sm leading-snug break-words">
        {value}
      </p>
    </div>
  );
}
