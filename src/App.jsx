import React, { useState, useEffect } from 'react';
import { 
  Wind, PenTool, Brain, ThermometerSnowflake, ChevronLeft, ChevronRight, 
  CheckCircle2, Sparkles, Flame, Camera, Play, Pause, SkipForward, 
  Sun, Trophy, LogIn, Loader2, Bot, XCircle
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- GEMINI AI IMPORT ---
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCY2r-9oj8Pv5Yj3q28qO-DlcOeQ4psB2w",
  authDomain: "scaling-happiness-17a16.firebaseapp.com",
  projectId: "scaling-happiness-17a16",
  storageBucket: "scaling-happiness-17a16.firebasestorage.app",
  messagingSenderId: "110024984154",
  appId: "1:110024984154:web:dc573f6ed19fbf9e20ba63",
  measurementId: "G-S1Z0NY61Q9"
};

const GEMINI_API_KEY = "AIzaSyA9OG-JjtC52UEOWH-14EjvZLio94iSMls"; 

// Initialize Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const BioHackTracker = () => {
  // --- State ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState({});
  const [streak, setStreak] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [language, setLanguage] = useState('en');
  
  // Timer & Upload State
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(true);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null); // The visual URL
  const [imageBase64, setImageBase64] = useState(null); // The raw data for Gemini
  const [isUploading, setIsUploading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  // --- Auth & Data Sync ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) setData(docSnap.data().habitData || {});
      else setDoc(userDocRef, { habitData: {} }, { merge: true });
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    setFeedbackMessage("Opening Google Login...");
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setFeedbackMessage("Login cancelled.");
      } else {
        setFeedbackMessage(`Login Error: ${error.message}`);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setData({});
    setUploadedImage(null);
    setAiResponse(null);
  };

  // --- Helpers ---
  const formatDateKey = (date) => date.toISOString().split('T')[0];
  const getDayName = (date) => date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-AR', { weekday: 'long' });
  const currentKey = formatDateKey(selectedDate);
  const dayData = data[currentKey] || { meditation: false, journaling: false, wimHof: false, coldPlunge: false };

  // --- EFFECTS ---
  
  // 1. Effect: When DATE changes -> Clear the UI and AI memory
  useEffect(() => {
    setAiResponse(null);
    setFeedbackMessage("");
    setImageBase64(null); // Reset AI memory for a fresh day
    
    // Load visual image if exists
    if (data[currentKey]?.journalImageUrl) {
      setUploadedImage(data[currentKey].journalImageUrl);
    } else {
      setUploadedImage(null);
    }
  }, [selectedDate, currentKey]); 

  // 2. Effect: When DATA changes -> Update visual state only
  useEffect(() => {
    setStreak(calculateStreak(data));
    pickRandomQuote();
    
    // Update visual image if data updates, but ONLY if we don't have a local upload pending
    if (data[currentKey]?.journalImageUrl && !imageBase64) {
       setUploadedImage(data[currentKey].journalImageUrl);
    }
  }, [data]); 

  const calculateStreak = (dataset) => {
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const key = formatDateKey(checkDate);
      const entry = dataset[key];
      if (entry) {
        const count = ['meditation', 'journaling', 'wimHof', 'coldPlunge'].filter(k => entry[k]).length;
        if (count >= 2) currentStreak++;
        else if (i === 0) continue;
        else break;
      } else if (i > 0) break;
    }
    return currentStreak;
  };

  // --- GEMINI AI LOGIC ---
  const analyzeWithGemini = async () => {
    // 1. Check for Image
    let activeBase64 = imageBase64;
    
    // If page reloaded, try to fetch the image from URL to rebuild Base64
    if (!activeBase64 && uploadedImage) {
        setFeedbackMessage(language === 'en' ? "🔄 Restoring image memory..." : "🔄 Restaurando imagen...");
        try {
            const response = await fetch(uploadedImage);
            const blob = await response.blob();
            activeBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            setImageBase64(activeBase64); 
        } catch (e) {
            console.error("Fetch error:", e);
            setFeedbackMessage("Error recovering image.");
            return;
        }
    }

    if (!activeBase64) {
      setFeedbackMessage(language === 'en' ? "⚠️ Please re-upload image to analyze." : "⚠️ Por favor resubí la imagen.");
      return;
    }

    setIsAnalyzing(true);
    setFeedbackMessage(language === 'en' ? "🧠 Coach Joe is thinking..." : "🧠 Analizando...");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = language === 'en' 
        ? `Act as a Joe Hudson-style executive coach. Analyze this handwritten journal entry. Output format: **1. The Hidden Emotion:** **2. Somatic Check:** **3. The Challenge:**`
        : `Actúa como un coach estilo Joe Hudson. Analiza esta entrada de diario. Formato: **1. La Emoción Oculta:** **2. Chequeo Somático:** **3. El Desafío:**`;

      const base64Data = activeBase64.split(',')[1];
      const imagePart = { inlineData: { data: base64Data, mimeType: "image/jpeg" } };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      setAiResponse(text);
      setFeedbackMessage("");

    } catch (error) {
      console.error("Gemini Error:", error);
      setFeedbackMessage("AI Error. Check console.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Image Handling ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setIsUploading(true);

    // 1. Create Base64 for Gemini immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result); 
    };
    reader.readAsDataURL(file);

    // 2. Upload to Firebase
    const storageRef = ref(storage, `users/${user.uid}/${currentKey}/${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      const newData = {
        ...data,
        [currentKey]: {
          ...dayData,
          journalImageUrl: downloadURL,
          journaling: true
        }
      };
      
      setDoc(doc(db, "users", user.uid), { habitData: newData }, { merge: true });
      setUploadedImage(downloadURL);
      setFeedbackMessage(language === 'en' ? "Saved!" : "¡Guardado!");

    } catch (error) {
      console.error(error);
      setFeedbackMessage("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    const newData = { ...data, [currentKey]: { ...dayData, journalImageUrl: null } };
    setDoc(doc(db, "users", user.uid), { habitData: newData }, { merge: true });
    setUploadedImage(null);
    setAiResponse(null);
    setImageBase64(null);
  };

  // --- Translations & Constants ---
  const t = {
    en: {
      title: "Morning Ritual", login: "Sign in to sync", loginBtn: "Sign in with Google", logout: "Sign Out",
      days: "Days", dailyGoal: "Daily Goal", tasks: "Tasks", goalAchieved: "Goal Achieved!",
      ready: "Ready?", startTimer: "Start Timer", upload: "Upload Page", uploading: "Uploading...",
      uploadSub: "Syncs with Cloud", remove: "Remove", saved: "Saved",
      analyzeBtn: "Analyze with AI Coach", analyzing: "Consulting Joe Hudson...",
      reupload: "Re-upload today's image to analyze",
      phases: [
        { name: "Ready", prompt: "Ready?", tweak: "" },
        { name: "The Dump", prompt: "Free Flow", tweak: "Complaining? Stop & Move on." },
        { name: "The Shift", prompt: "10% Braver", tweak: "Visualize DOING it." },
        { name: "The Anchor", prompt: "One Thing", tweak: "What makes everything else easier?" }
      ]
    },
    es: {
      title: "Ritual Matutino", login: "Ingresá", loginBtn: "Ingresar con Google", logout: "Salir",
      days: "Días", dailyGoal: "Meta Diaria", tasks: "Tareas", goalAchieved: "¡Logrado!",
      ready: "¿Listo?", startTimer: "Iniciar", upload: "Subir Página", uploading: "Subiendo...",
      uploadSub: "Sincronizado", remove: "Borrar", saved: "Guardado",
      analyzeBtn: "Analizar con IA", analyzing: "Consultando a Joe...",
      reupload: "Resubí la imagen para analizar",
      phases: [
        { name: "Listo", prompt: "¿Listo?", tweak: "" },
        { name: "El Vaciado", prompt: "Escritura Libre", tweak: "¿Te quejas? Pará y Avanzá." },
        { name: "El Cambio", prompt: "10% Valiente", tweak: "Visualizate HACIENDO." },
        { name: "El Ancla", prompt: "La Única Cosa", tweak: "¿Qué facilita todo lo demás?" }
      ]
    }
  };
  
  const text = t[language];
  const [dailyQuote, setDailyQuote] = useState("");
  const quotes = ["The obstacle is the way.", "Clarity comes from engagement.", "Discipline is freedom."];
  const pickRandomQuote = () => setDailyQuote(quotes[Math.floor(Math.random() * quotes.length)]);

  // --- Timer & Audio ---
  const playSound = () => {}; 
  const PHASES = [{id:0,d:0},{id:1,d:360},{id:2,d:150},{id:3,d:240}];
  
  useEffect(() => {
    let interval = null;
    if (timerActive && !timerPaused && timeLeft > 0) interval = setInterval(() => setTimeLeft(p => p - 1), 1000);
    else if (timeLeft === 0 && timerActive) { clearInterval(interval); nextPhase(); }
    return () => clearInterval(interval);
  }, [timerActive, timerPaused, timeLeft]);

  const startPhase = (i) => { setCurrentPhase(i); setTimeLeft(PHASES[i].d); setTimerActive(true); setTimerPaused(false); };
  const nextPhase = () => { if (currentPhase < 3) startPhase(currentPhase+1); else { setTimerActive(false); setSessionComplete(true); }};

  // --- Render ---
  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-emerald-500" size={48}/></div>;
  
  // LOGIN SCREEN
  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-100">
        <div className="flex justify-center mb-6"><div className="p-3 bg-amber-100 rounded-full"><Sun className="text-amber-500" size={32}/></div></div>
        <h1 className="text-2xl font-bold mb-2 text-slate-800">{text.title}</h1>
        <p className="text-slate-500 mb-8">{text.login}</p>
        <button onClick={handleLogin} className="bg-slate-900 text-white px-6 py-3.5 rounded-xl w-full flex justify-center items-center gap-2 hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95 font-bold">
          <LogIn size={20}/> {text.loginBtn}
        </button>
        {feedbackMessage && <div className="mt-4 text-amber-600 text-sm font-medium bg-amber-50 py-2 px-3 rounded-lg">{feedbackMessage}</div>}
      </div>
    </div>
  );

  const completedCount = ['meditation', 'journaling', 'wimHof', 'coldPlunge'].filter(k => dayData[k]).length;
  const progress = Math.min((completedCount / 2) * 100, 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-12">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2"><Sun className="text-amber-400"/><span className="font-bold text-xl hidden sm:block">{text.title}</span></div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1"><button onClick={()=>setLanguage('en')} className={`px-3 rounded ${language==='en'?'bg-white shadow':''}`}>🇺🇸</button><button onClick={()=>setLanguage('es')} className={`px-3 rounded ${language==='es'?'bg-white shadow':''}`}>🇦🇷</button></div>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-500">{text.logout}</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
             <button onClick={()=>setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()-1)))}><ChevronLeft/></button>
             <div className="text-2xl font-serif">{selectedDate.toLocaleDateString()}</div>
             <button onClick={()=>setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()+1)))}><ChevronRight/></button>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all duration-500" style={{width:`${progress}%`}}></div></div>
        </div>

        {/* Habits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['wimHof', 'coldPlunge', 'meditation', 'journaling'].map(h => {
             const isActive = dayData[h];
             const icons = { wimHof: Wind, coldPlunge: ThermometerSnowflake, meditation: Brain, journaling: PenTool };
             const Icon = icons[h];
             const update = () => { const n={...data,[currentKey]:{...dayData,[h]:!dayData[h]}}; setData(n); setDoc(doc(db,"users",user.uid),{habitData:n},{merge:true}); };
             return (
               <button key={h} onClick={update} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 h-40 transition-all ${isActive ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500' : 'bg-white border-slate-200'}`}>
                 <Icon size={36} className={isActive ? 'text-sky-600' : 'text-slate-300'} />
                 <div className="font-bold capitalize">{h}</div>
               </button>
             )
          })}
        </div>

        {/* Guided Session & AI */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2"><PenTool className="text-emerald-500"/> {language==='en'?'AI Journal':'Diario IA'}</h2>
            <button onClick={()=>startPhase(1)} className="text-xs px-4 py-2 bg-emerald-500 text-white rounded-full font-bold">{text.startTimer}</button>
          </div>
          
          {/* Timer UI */}
          {currentPhase > 0 && (
            <div className="p-10 bg-slate-900 text-white text-center relative overflow-hidden">
               <div className="text-6xl font-mono font-bold mb-4">{Math.floor(timeLeft/60)}:{timeLeft%60<10?'0':''}{timeLeft%60}</div>
               <div className="text-xl opacity-90">{text.phases[currentPhase].prompt}</div>
               <div className="flex justify-center gap-4 mt-6"><button onClick={()=>setTimerPaused(!timerPaused)} className="p-3 bg-white/20 rounded-full">{timerPaused?<Play/>:<Pause/>}</button><button onClick={nextPhase} className="p-3 bg-emerald-500 rounded-full text-slate-900"><SkipForward/></button></div>
            </div>
          )}

          {/* Upload & AI Section */}
          <div className="p-6 space-y-6">
            {uploadedImage ? (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 group max-w-xl mx-auto">
                  <img src={uploadedImage} alt="Journal" className="w-full h-64 object-cover" />
                  <button onClick={removeImage} className="absolute top-2 right-2 bg-white text-red-500 px-3 py-1 rounded-lg text-xs font-bold shadow">{text.remove}</button>
                </div>

                {/* AI BUTTON */}
                {!aiResponse && (
                  <button 
                    onClick={analyzeWithGemini} 
                    disabled={isAnalyzing}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin"/> : <Bot size={24} />}
                    {isAnalyzing ? text.analyzing : text.analyzeBtn}
                  </button>
                )}

                {/* AI RESULT */}
                {aiResponse && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 mb-4 text-indigo-800 font-bold">
                      <Sparkles size={20} /> Coach Joe Hudson says:
                    </div>
                    <div className="prose prose-indigo text-sm whitespace-pre-wrap leading-relaxed text-slate-700">
                      {aiResponse}
                    </div>
                    <button onClick={()=>setAiResponse(null)} className="mt-4 text-xs text-indigo-400 hover:text-indigo-600 underline">Clear Analysis</button>
                  </div>
                )}
              </div>
            ) : (
              <label className={`border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer ${isUploading?'opacity-50':''}`}>
                {isUploading ? <Loader2 className="animate-spin mb-4"/> : <Camera size={48} className="mb-4"/>}
                <span className="font-bold">{isUploading ? text.uploading : text.upload}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
              </label>
            )}
          </div>
        </div>
        
        {/* Message Area */}
        {feedbackMessage && <div className="fixed bottom-4 left-0 right-0 mx-auto w-max bg-slate-800 text-white px-4 py-2 rounded-full text-sm shadow-xl animate-bounce z-50">{feedbackMessage}</div>}

      </div>
    </div>
  );
};

export default BioHackTracker;