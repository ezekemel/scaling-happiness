import React, { useState, useEffect } from 'react';
import { 
  Wind, PenTool, Brain, ThermometerSnowflake, ChevronLeft, ChevronRight, 
  CheckCircle2, Sparkles, Flame, Camera, Play, Pause, SkipForward, 
  Sun, Trophy, LogIn, Loader2, Bot, XCircle, ArrowRight,
  Minus
} from 'lucide-react';

// --- FIREBASE IMPORTS (Paquetes NPM Oficiales) ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "firebase/auth";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot 
} from "firebase/firestore";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "firebase/storage";

// --- GEMINI AI IMPORT (Paquete NPM Oficial) ---
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURACIÓN ---
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

// Inicializar Servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const BioHackTracker = () => {
  // --- Estado ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState({});
  const [streak, setStreak] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [language, setLanguage] = useState('en');
  
  // Estado del Temporizador y Carga
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(true);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null); 
  const [imageBase64, setImageBase64] = useState(null); 
  const [isUploading, setIsUploading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Estado de IA
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  // --- Autenticación y Sincronización de Datos ---
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
    setFeedbackMessage("Conectando...");
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Fallo al iniciar sesión", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setFeedbackMessage("");
      } else {
        setFeedbackMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setData({});
    setUploadedImage(null);
    setAiResponse(null);
  };

  // --- Ayudantes ---
  const formatDateKey = (date) => date.toISOString().split('T')[0];
  const getDayName = (date) => date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-AR', { weekday: 'long' });
  const currentKey = formatDateKey(selectedDate);
  const dayData = data[currentKey] || { meditation: false, journaling: false, wimHof: false, coldPlunge: false };

  // --- EFECTOS ---
  useEffect(() => {
    setAiResponse(null);
    setFeedbackMessage("");
    setImageBase64(null);
    
    if (data[currentKey]?.journalImageUrl) {
      setUploadedImage(data[currentKey].journalImageUrl);
    } else {
      setUploadedImage(null);
    }
  }, [selectedDate, currentKey]); 

  useEffect(() => {
    setStreak(calculateStreak(data));
    pickRandomQuote();
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

  // --- LÓGICA DE GEMINI AI ---
  const analyzeWithGemini = async () => {
    let activeBase64 = imageBase64;
    
    if (!activeBase64 && uploadedImage) {
        setFeedbackMessage(language === 'en' ? "Restoring..." : "Restaurando...");
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
            console.error("Error al recuperar:", e);
            setFeedbackMessage("Error.");
            return;
        }
    }

    if (!activeBase64) {
      setFeedbackMessage(language === 'en' ? "Re-upload image." : "Resubí la imagen.");
      return;
    }

    setIsAnalyzing(true);
    setFeedbackMessage(language === 'en' ? "Thinking..." : "Pensando...");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = language === 'en' 
        ? `Act as a Joe Hudson-style executive coach. Analyze this handwritten journal entry. Output format: **1. The Hidden Emotion:** **2. Somatic Check:** **3. The Challenge:**`
        : `Actúa como un coach estilo Joe Hudson. Analiza esta entrada de diario manuscrita. Formato de salida: **1. La Emoción Oculta:** **2. Chequeo Somático:** **3. El Desafío:**`;

      const base64Data = activeBase64.split(',')[1];
      const imagePart = { inlineData: { data: base64Data, mimeType: "image/jpeg" } };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      setAiResponse(text);
      setFeedbackMessage("");

    } catch (error) {
      console.error("Error de Gemini:", error);
      setFeedbackMessage("AI Error.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Manejo de Imágenes ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result); 
    };
    reader.readAsDataURL(file);

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
      setFeedbackMessage(language === 'en' ? "Saved." : "Guardado.");

    } catch (error) {
      console.error(error);
      setFeedbackMessage("Error.");
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

  // --- Traducciones y Constantes ---
  const t = {
    en: {
      title: "Morning Ritual", login: "Sign in to sync", loginBtn: "Enter the Studio", logout: "Sign Out",
      days: "Days", dailyGoal: "Daily Goal", tasks: "Tasks", goalAchieved: "Goal Achieved!",
      ready: "Ready?", startTimer: "Start Timer", upload: "Upload Page", uploading: "Uploading...",
      uploadSub: "Syncs with Cloud", remove: "Remove", saved: "Saved",
      analyzeBtn: "Analyze with AI Coach", analyzing: "Consulting Joe Hudson...",
      reupload: "Re-upload today's image to analyze",
      welcomeSub: "The art of discipline.",
      landingQuote: "The body keeps the score.",
      phases: [
        { name: "Ready", prompt: "Ready?", tweak: "" },
        { name: "The Dump", prompt: "Free Flow", tweak: "Complaining? Stop & Move on." },
        { name: "The Shift", prompt: "10% Braver", tweak: "Visualize DOING it." },
        { name: "The Anchor", prompt: "One Thing", tweak: "What makes everything else easier?" }
      ]
    },
    es: {
      title: "Ritual Matutino", login: "Ingresá", loginBtn: "Entrar al Estudio", logout: "Salir",
      days: "Días", dailyGoal: "Meta Diaria", tasks: "Tareas", goalAchieved: "¡Logrado!",
      ready: "¿Listo?", startTimer: "Iniciar", upload: "Subir Página", uploading: "Subiendo...",
      uploadSub: "Sincronizado", remove: "Borrar", saved: "Guardado",
      analyzeBtn: "Analizar con IA", analyzing: "Consultando a Joe...",
      reupload: "Resubí la imagen para analizar",
      welcomeSub: "El arte de la disciplina.",
      landingQuote: "El cuerpo lleva la cuenta.",
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

  // --- Temporizador y Audio ---
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

  // --- Renderizado ---
  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]"><Loader2 className="animate-spin text-stone-400" size={24}/></div>;
  
  // --- LANDING PAGE (MUSEUM STYLE) ---
  if (!user) return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-[#FDFBF7] text-stone-800 selection:bg-stone-200">
      
      {/* Lado Izquierdo - La Obra */}
      <div className="w-full lg:w-3/5 relative flex flex-col justify-between p-12 lg:p-24 overflow-hidden border-b lg:border-b-0 lg:border-r border-stone-200">
        {/* Elemento Artístico Minimalista (Círculo Zen) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] lg:w-[40vw] lg:h-[40vw] rounded-full border border-stone-300 opacity-20 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] lg:w-[30vw] lg:h-[30vw] rounded-full border border-stone-300 opacity-30 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20vw] h-[20vw] lg:w-[10vw] lg:h-[10vw] bg-stone-800 rounded-full mix-blend-multiply opacity-5 blur-3xl pointer-events-none animate-pulse duration-[10s]"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase text-stone-400">
            <div className="w-4 h-[1px] bg-stone-400"></div>
            Bio-Hack OS 
            <span className="text-[10px] opacity-50 ml-1">v1.0</span>
          </div>
        </div>

        <div className="relative z-10 max-w-xl mt-12 lg:mt-0">
          <h1 className="text-5xl lg:text-7xl font-serif leading-[1.1] text-stone-900 mb-8">
            {text.landingQuote}
          </h1>
        </div>

        <div className="relative z-10 text-stone-400 text-xs tracking-widest uppercase hidden lg:block">
          Mendoza, Argentina — {new Date().getFullYear()}
        </div>
      </div>

      {/* Lado Derecho - El Ingreso */}
      <div className="w-full lg:w-2/5 flex flex-col justify-center items-center p-8 lg:p-24 bg-[#FDFBF7]">
        <div className="w-full max-w-xs space-y-12">
          <div className="text-center space-y-4">
            <Sun strokeWidth={1} size={48} className="mx-auto text-stone-800 mb-6" />
            <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-stone-500">{text.title}</h2>
            <p className="font-serif text-2xl text-stone-800 italic">{text.welcomeSub}</p>
          </div>

          <button 
            onClick={handleLogin} 
            className="group relative w-full flex items-center justify-center gap-4 py-4 px-8 border border-stone-300 hover:border-stone-800 transition-all duration-500 bg-transparent hover:bg-stone-50"
          >
            <span className="text-sm font-medium tracking-widest uppercase text-stone-600 group-hover:text-stone-900 transition-colors">
              {text.loginBtn}
            </span>
            <ArrowRight strokeWidth={1} size={16} className="text-stone-400 group-hover:translate-x-1 transition-transform duration-500" />
          </button>
          
          {feedbackMessage && (
            <div className="text-center text-xs text-red-400 font-mono mt-4">
              [{feedbackMessage}]
            </div>
          )}

          <div className="flex justify-center gap-8 opacity-30 pt-12 border-t border-stone-200">
             <Wind strokeWidth={1} size={20} />
             <Brain strokeWidth={1} size={20} />
             <PenTool strokeWidth={1} size={20} />
             <ThermometerSnowflake strokeWidth={1} size={20} />
          </div>
        </div>
      </div>
    </div>
  );

  // --- UI PRINCIPAL (ESTILO LIMPIO) ---
  const completedCount = ['meditation', 'journaling', 'wimHof', 'coldPlunge'].filter(k => dayData[k]).length;
  const progress = Math.min((completedCount / 2) * 100, 100);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-800 font-sans pb-12 selection:bg-stone-200">
      {/* Encabezado */}
      <div className="bg-[#FDFBF7]/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Sun strokeWidth={1.5} className="text-stone-800" />
          <span className="font-serif font-bold text-xl hidden sm:block text-stone-900 tracking-tight">{text.title}</span>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex bg-stone-100 rounded-full p-1 border border-stone-200">
            <button onClick={()=>setLanguage('en')} className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${language==='en'?'bg-white shadow-sm text-stone-900':'text-stone-400'}`}>EN</button>
            <button onClick={()=>setLanguage('es')} className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${language==='es'?'bg-white shadow-sm text-stone-900':'text-stone-400'}`}>ES</button>
          </div>
          <button onClick={handleLogout} className="text-xs font-medium tracking-wider text-stone-400 hover:text-red-500 uppercase ml-2">{text.logout}</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Estadísticas */}
        <div className="bg-white p-8 rounded-none border border-stone-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] space-y-6">
          <div className="flex justify-between items-center">
             <button onClick={()=>setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()-1)))} className="hover:opacity-50 transition-opacity"><ChevronLeft strokeWidth={1} size={32}/></button>
             <div className="text-center">
               <div className="text-xs font-bold tracking-[0.2em] text-stone-400 uppercase mb-2">{getDayName(selectedDate)}</div>
               <div className="text-4xl font-serif text-stone-800">{selectedDate.toLocaleDateString()}</div>
             </div>
             <button onClick={()=>setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate()+1)))} className="hover:opacity-50 transition-opacity"><ChevronRight strokeWidth={1} size={32}/></button>
          </div>
          <div className="h-1 w-full bg-stone-100 overflow-hidden"><div className="h-full bg-stone-800 transition-all duration-700 ease-out" style={{width:`${progress}%`}}></div></div>
        </div>

        {/* Cuadrícula de Hábitos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['wimHof', 'coldPlunge', 'meditation', 'journaling'].map(h => {
             const isActive = dayData[h];
             const icons = { wimHof: Wind, coldPlunge: ThermometerSnowflake, meditation: Brain, journaling: PenTool };
             const Icon = icons[h];
             const update = () => { const n={...data,[currentKey]:{...dayData,[h]:!dayData[h]}}; setData(n); setDoc(doc(db,"users",user.uid),{habitData:n},{merge:true}); };
             return (
               <button key={h} onClick={update} className={`group p-8 border border-stone-200 flex flex-col items-center gap-6 h-48 transition-all duration-500 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] ${isActive ? 'bg-stone-50 border-stone-400' : 'bg-white'}`}>
                 <Icon strokeWidth={1} size={40} className={`transition-all duration-500 ${isActive ? 'text-stone-900 scale-110' : 'text-stone-300 group-hover:text-stone-500'}`} />
                 <div className={`font-serif text-lg tracking-wide ${isActive ? 'text-stone-900' : 'text-stone-400'}`}>{h.replace(/([A-Z])/g, ' $1').trim()}</div>
                 {isActive && <div className="w-1 h-1 bg-stone-900 rounded-full mt-auto"></div>}
               </button>
             )
          })}
        </div>

        {/* Sesión Guiada e IA */}
        <div className="bg-white border border-stone-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="bg-stone-50 p-6 border-b border-stone-200 flex justify-between items-center">
            <h2 className="font-serif text-xl italic text-stone-700 flex items-center gap-3"><PenTool strokeWidth={1.5} size={18}/> {language==='en'?'Studio Session':'Sesión de Estudio'}</h2>
            <button onClick={()=>startPhase(1)} className="text-[10px] font-bold tracking-widest uppercase px-6 py-3 border border-stone-300 hover:bg-stone-900 hover:text-white transition-all">{text.startTimer}</button>
          </div>
          
          {/* Timer UI */}
          {currentPhase > 0 && (
            <div className="p-16 bg-stone-900 text-stone-50 text-center relative overflow-hidden">
               <div className="text-8xl font-serif mb-6 font-thin opacity-90">{Math.floor(timeLeft/60)}:{timeLeft%60<10?'0':''}{timeLeft%60}</div>
               <div className="text-lg tracking-widest uppercase opacity-60 mb-8">{text.phases[currentPhase].prompt}</div>
               <div className="flex justify-center gap-6"><button onClick={()=>setTimerPaused(!timerPaused)} className="p-4 border border-white/20 rounded-full hover:bg-white/10 transition-colors">{timerPaused?<Play strokeWidth={1}/>:<Pause strokeWidth={1}/>}</button><button onClick={nextPhase} className="p-4 bg-white text-stone-900 rounded-full hover:opacity-90 transition-opacity"><SkipForward strokeWidth={1}/></button></div>
            </div>
          )}

          {/* Upload & AI Section */}
          <div className="p-8 space-y-8">
            {uploadedImage ? (
              <div className="space-y-6">
                <div className="relative border border-stone-100 shadow-inner bg-stone-50 p-4">
                  <img src={uploadedImage} alt="Journal" className="w-full h-64 object-cover filter grayscale hover:grayscale-0 transition-all duration-700" />
                  <button onClick={removeImage} className="absolute top-6 right-6 bg-white/80 backdrop-blur-sm text-stone-500 px-4 py-2 text-xs font-bold tracking-widest hover:bg-red-50 hover:text-red-500 transition-colors">{text.remove}</button>
                </div>

                {/* BOTÓN DE IA */}
                {!aiResponse && (
                  <button 
                    onClick={analyzeWithGemini} 
                    disabled={isAnalyzing}
                    className="w-full py-5 bg-stone-900 text-stone-50 text-sm font-bold tracking-widest uppercase hover:bg-stone-800 transition-all flex items-center justify-center gap-3"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin"/> : <Bot strokeWidth={1} size={20} />}
                    {isAnalyzing ? text.analyzing : text.analyzeBtn}
                  </button>
                )}

                {/* RESULTADO DE IA */}
                {aiResponse && (
                  <div className="bg-[#F5F5F0] border-l-2 border-stone-400 p-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-3 mb-6 text-stone-900 font-serif italic text-xl">
                      <Sparkles strokeWidth={1} size={24} /> Coach Joe:
                    </div>
                    <div className="prose prose-stone prose-p:font-light prose-strong:font-normal text-sm leading-loose text-stone-700">
                      {aiResponse}
                    </div>
                    <button onClick={()=>setAiResponse(null)} className="mt-8 text-xs font-bold tracking-widest uppercase text-stone-400 hover:text-stone-900 border-b border-transparent hover:border-stone-900 transition-all pb-1">Cerrar Análisis</button>
                  </div>
                )}
              </div>
            ) : (
              <label className={`border border-dashed border-stone-300 p-12 flex flex-col items-center justify-center text-stone-400 hover:border-stone-800 hover:text-stone-800 transition-all duration-500 cursor-pointer ${isUploading?'opacity-50':''}`}>
                {isUploading ? <Loader2 className="animate-spin mb-4"/> : <Camera strokeWidth={1} size={32} className="mb-4"/>}
                <span className="text-xs font-bold tracking-widest uppercase">{isUploading ? text.uploading : text.upload}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
              </label>
            )}
          </div>
        </div>
        
        {/* Mensajes Minimalistas */}
        {feedbackMessage && <div className="fixed bottom-8 right-8 bg-stone-900 text-stone-50 px-6 py-3 text-xs font-bold tracking-widest uppercase shadow-2xl animate-in slide-in-from-bottom-4 z-50">{feedbackMessage}</div>}

      </div>
    </div>
  );
};

export default BioHackTracker;