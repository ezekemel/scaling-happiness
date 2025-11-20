import React, { useState, useEffect, useRef } from 'react';
import { 
  Wind, 
  PenTool, 
  Brain, 
  ThermometerSnowflake, 
  ChevronLeft, 
  ChevronRight, 
  Activity,
  Copy,
  CheckCircle2,
  Sparkles,
  Flame,
  Camera,
  Timer,
  Play,
  Pause,
  SkipForward,
  Upload,
  RefreshCw,
  Sun,
  Globe,
  Trophy,
  X
} from 'lucide-react';

const BioHackTracker = () => {
  // --- State ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState({});
  const [streak, setStreak] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [language, setLanguage] = useState('en'); // 'en' or 'es'
  
  // Journaling Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(true);
  const [currentPhase, setCurrentPhase] = useState(0); // 0: Idle, 1: Dump, 2: Shift, 3: Anchor
  const [timeLeft, setTimeLeft] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null); // Session only for now
  const [sessionComplete, setSessionComplete] = useState(false); // Visual Reward State

  // --- Sound Engine (Web Audio API) ---
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      
      if (type === 'step') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === 'success') {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + (i * 0.1));
          gain.gain.setValueAtTime(0.05, ctx.currentTime + (i * 0.1));
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (i * 0.1) + 1.5);
          osc.start(ctx.currentTime + (i * 0.1));
          osc.stop(ctx.currentTime + (i * 0.1) + 1.5);
        });
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  // --- Translations ---
  const t = {
    en: {
      title: "Morning Ritual",
      days: "Days",
      dailyGoal: "Daily Goal",
      tasks: "Tasks",
      goalAchieved: "Goal Achieved! Minimum Effective Dose reached.",
      designMorning: "Design your morning. Own your day.",
      ready: "Ready to start?",
      startTimer: "Start Timer",
      upload: "Upload Handwritten Page",
      uploadSub: "We'll check off the habit automatically",
      remove: "Remove",
      saved: "Saved for Session",
      generatePrompt: "Generate Joe Hudson Prompt",
      uploadFirst: "Upload Image to Analyze",
      promptCopied: "Prompt Copied! Now paste into Gemini + Upload your photo.",
      sessionCompleteTitle: "Session Complete!",
      sessionCompleteSub: "You are building clarity and courage.",
      close: "Close",
      habits: {
        wimHof: { label: "Breathing", duration: "12m" },
        coldPlunge: { label: "Cold Plunge", duration: "2.5m" },
        meditation: { label: "Meditation", duration: "15m" },
        journaling: { label: "Journaling", duration: "15m" }
      },
      phases: [
        { name: "Ready", prompt: "Ready to start?", tweak: "" },
        { name: "The Dump", prompt: "Free Flow Writing", tweak: "Catching yourself complaining 3 sentences in a row? Stop. You found the problem. Move on." },
        { name: "The Shift", prompt: "If I were 10% more brave today...", tweak: "Visualize DOING that brave thing immediately after writing it." },
        { name: "The Anchor", prompt: "The ONE Thing (Pareto Principle)", tweak: "What is the single highest-value target that makes everything else unnecessary?" }
      ],
      geminiPrompt: `I have completed my handwritten journal entry following this structure: 1. Free flow dump, 2. Bravery challenge ("10% more brave"), 3. The One Thing (Pareto focus).
      Please act as a Joe Hudson-style coach. Don't just cheerlead. 
      1. Challenge me: Ask a question about what emotion I might be avoiding in this text.
      2. Reflection: "If you were to fully feel the resistance to your 'One Thing', where would it be in your body?"
      3. Accountability: Based on my '10% brave', give me a specific yes/no challenge to report back on tomorrow.`
    },
    es: {
      title: "Ritual Matutino",
      days: "Días",
      dailyGoal: "Meta Diaria",
      tasks: "Tareas",
      goalAchieved: "¡Meta Lograda! Dosis mínima alcanzada.",
      designMorning: "Diseña tu mañana. Adueñate de tu día.",
      ready: "¿Listo para arrancar?",
      startTimer: "Iniciar Timer",
      upload: "Subir Página Manuscrita",
      uploadSub: "Marcaremos el hábito automáticamente",
      remove: "Eliminar",
      saved: "Guardado",
      generatePrompt: "Generar Prompt Joe Hudson",
      uploadFirst: "Subí una imagen primero",
      promptCopied: "¡Copiado! Pegalo en Gemini junto con tu foto.",
      sessionCompleteTitle: "¡Sesión Completa!",
      sessionCompleteSub: "Estás construyendo claridad y coraje.",
      close: "Cerrar",
      habits: {
        wimHof: { label: "Respiración", duration: "12m" },
        coldPlunge: { label: "Inmersión", duration: "2.5m" },
        meditation: { label: "Meditación", duration: "15m" },
        journaling: { label: "Escritura", duration: "15m" }
      },
      phases: [
        { name: "Listo", prompt: "¿Listo para arrancar?", tweak: "" },
        { name: "El Vaciado", prompt: "Escritura Libre (Free Flow)", tweak: "¿Te quejaste de lo mismo 3 oraciones seguidas? Pará. Ya encontraste el problema. Avanzá." },
        { name: "El Cambio", prompt: "Si fuera 10% más valiente hoy...", tweak: "Visualizate HACIENDO esa acción valiente inmediatamente después de escribirla." },
        { name: "El Ancla", prompt: "La Única Cosa (Principio de Pareto)", tweak: "¿Cuál es la única acción que, al hacerla, hace que todo lo demás sea más fácil o innecesario?" }
      ],
      geminiPrompt: `He completado mi entrada de diario manuscrita siguiendo esta estructura: 1. Vaciado libre, 2. Desafío de valentía ("10% más valiente"), 3. El Ancla (Enfoque Pareto).
      Por favor actúa como un coach estilo Joe Hudson (Art of Accomplishment). No me animes superficialmente.
      1. Desafíame: Hacé una pregunta sobre qué emoción podría estar evitando en este texto.
      2. Reflexión: "Si sintieras plenamente la resistencia a tu 'Única Cosa', ¿en qué parte del cuerpo la sentirías?"
      3. Rendición de cuentas: Basado en mi '10% valiente', dame un desafío específico de sí/no para reportar mañana.`
    }
  };

  const text = t[language];

  const quotesEn = [
    "The obstacle is the way.", "Clarity comes from engagement, not thought.", "Discipline is freedom.", "What you resist, persists.", "Your body keeps the score."
  ];
  const quotesEs = [
    "El obstáculo es el camino.", "La claridad viene de la acción, no del pensamiento.", "La disciplina es libertad.", "Lo que resistes, persiste.", "Tu cuerpo lleva la cuenta."
  ];
  
  const [dailyQuote, setDailyQuote] = useState("");

  useEffect(() => {
    const savedData = localStorage.getItem('bioHackData');
    if (savedData) {
      setData(JSON.parse(savedData));
    }
    pickRandomQuote();
  }, [language]);

  const pickRandomQuote = () => {
    const list = language === 'en' ? quotesEn : quotesEs;
    setDailyQuote(list[Math.floor(Math.random() * list.length)]);
  };

  useEffect(() => {
    localStorage.setItem('bioHackData', JSON.stringify(data));
    calculateStreak();
  }, [data]);

  const PHASES = [
    { id: 0, duration: 0, ...text.phases[0] },
    { id: 1, duration: 360, ...text.phases[1] }, 
    { id: 2, duration: 150, ...text.phases[2] }, 
    { id: 3, duration: 240, ...text.phases[3] } 
  ];

  useEffect(() => {
    let interval = null;
    if (timerActive && !timerPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      clearInterval(interval);
      playSound('step');
    }
    return () => clearInterval(interval);
  }, [timerActive, timerPaused, timeLeft]);

  const startPhase = (phaseIndex) => {
    setCurrentPhase(phaseIndex);
    setTimeLeft(PHASES[phaseIndex].duration);
    setTimerActive(true);
    setTimerPaused(false);
  };

  const nextPhase = () => {
    if (currentPhase < 3) {
      playSound('step');
      startPhase(currentPhase + 1);
    } else {
      playSound('success');
      setTimerActive(false);
      setCurrentPhase(0);
      setSessionComplete(true);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatDateKey = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getDayName = (date) => {
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-AR', { weekday: 'long' });
  };

  const currentKey = formatDateKey(selectedDate);
  const dayData = data[currentKey] || {
    meditation: false,
    journaling: false,
    wimHof: false,
    coldPlunge: false,
  };

  const getRecommendations = (date) => {
    const day = date.getDay(); 
    if (day === 1 || day === 3 || day === 5) return ['wimHof', 'coldPlunge'];
    else if (day === 2 || day === 4 || day === 6) return ['meditation', 'journaling'];
    else return ['meditation'];
  };

  const recommendations = getRecommendations(selectedDate);

  const toggleHabit = (habit) => {
    const newData = {
      ...data,
      [currentKey]: {
        ...dayData,
        [habit]: !dayData[habit]
      }
    };
    setData(newData);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        if (!dayData.journaling) toggleHabit('journaling');
      };
      reader.readAsDataURL(file);
    }
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
    setFeedbackMessage("");
    setUploadedImage(null);
  };

  const calculateStreak = () => {
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const key = formatDateKey(checkDate);
      const entry = data[key];
      
      if (entry) {
        const count = ['meditation', 'journaling', 'wimHof', 'coldPlunge']
          .filter(k => entry[k]).length;
        if (count >= 2) currentStreak++;
        else if (i === 0) continue;
        else break;
      } else if (i > 0) break;
    }
    setStreak(currentStreak);
  };

  const copyForGemini = () => {
    const prompt = text.geminiPrompt + "\n\n(Note to user: Upload your photo alongside this prompt!)";
    navigator.clipboard.writeText(prompt);
    setFeedbackMessage(text.promptCopied);
    setTimeout(() => setFeedbackMessage(""), 5000);
  };

  // --- Redesigned High-Contrast Habit Card ---
  const HabitCard = ({ id, label, icon: Icon, color, duration }) => {
    const isActive = dayData[id];
    const isRecommended = recommendations.includes(id);
    
    // Vibrant styles for Active State
    const activeStyles = {
      blue: 'bg-sky-50 border-sky-500 text-sky-700 ring-1 ring-sky-500 shadow-lg shadow-sky-100/50',
      cyan: 'bg-cyan-50 border-cyan-500 text-cyan-700 ring-1 ring-cyan-500 shadow-lg shadow-cyan-100/50',
      purple: 'bg-violet-50 border-violet-500 text-violet-700 ring-1 ring-violet-500 shadow-lg shadow-violet-100/50',
      emerald: 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500 shadow-lg shadow-emerald-100/50',
    };

    // Specific Icon colors for active state
    const iconColors = {
        blue: 'text-sky-600',
        cyan: 'text-cyan-600',
        purple: 'text-violet-600',
        emerald: 'text-emerald-600',
    };

    // Neutral style for Inactive State (White background, gray text)
    const inactiveStyle = 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50/50 hover:text-slate-600';
    
    return (
      <button
        onClick={() => toggleHabit(id)}
        className={`relative p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-4 h-40 w-full group
          ${isActive 
            ? `${activeStyles[color]} scale-[1.02]` 
            : `${inactiveStyle}`
          }
          ${isRecommended && !isActive ? 'ring-2 ring-offset-2 ring-amber-300 border-amber-200' : ''}
        `}
      >
        {isRecommended && (
          <div className="absolute -top-3 bg-amber-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
            <Sparkles size={12} /> FOCUS
          </div>
        )}
        
        <Icon 
            size={36} 
            strokeWidth={isActive ? 2 : 1.5} 
            className={`transition-all duration-300 
                ${isActive ? `${iconColors[color]} scale-110` : 'grayscale opacity-50 group-hover:scale-110 group-hover:grayscale-0 group-hover:opacity-80'}
            `} 
        />
        
        <div className="text-center">
          <div className={`font-bold text-lg ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>{label}</div>
          <div className={`text-sm font-medium ${isActive ? 'opacity-90' : 'opacity-60'}`}>{duration}</div>
        </div>

        {isActive && (
            <div className={`absolute top-3 right-3 ${iconColors[color]}`}>
                <CheckCircle2 size={24} fill="currentColor" className="text-white" />
            </div>
        )}
      </button>
    );
  };

  // Stats
  const completedCount = ['meditation', 'journaling', 'wimHof', 'coldPlunge'].filter(k => dayData[k]).length;
  const progress = Math.min((completedCount / 2) * 100, 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-12 transition-colors duration-500 relative">
      
      {sessionComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
               <div className="absolute top-0 left-1/4 w-2 h-2 bg-red-400 rounded-full animate-ping"></div>
               <div className="absolute top-10 right-1/4 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
               <div className="absolute bottom-10 left-1/3 w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            </div>

            <div className="mx-auto w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100">
              <Trophy size={40} strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{text.sessionCompleteTitle}</h2>
            <p className="text-slate-500 mb-8">{text.sessionCompleteSub}</p>
            <button 
              onClick={() => setSessionComplete(false)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors"
            >
              {text.close}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sun className="text-amber-400" size={28} />
            <h1 className="font-bold text-xl tracking-tight text-slate-800">{text.title}</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${language === 'en' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🇺🇸 EN
              </button>
              <button 
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${language === 'es' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🇦🇷 ES
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <Flame size={18} className={streak > 0 ? "text-orange-500 fill-orange-500" : "text-slate-400"} />
              <span className="font-mono font-bold text-sm text-slate-600">{streak} {text.days}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => changeDate(-1)} className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft size={28} />
            </button>
            <div className="text-center">
              <div className="text-sm text-slate-400 uppercase tracking-wider font-bold mb-1">{getDayName(selectedDate)}</div>
              <div className="font-serif text-3xl font-medium text-slate-800 capitalize">{selectedDate.toLocaleDateString(language === 'en' ? 'en-US' : 'es-AR')}</div>
            </div>
            <button onClick={() => changeDate(1)} className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronRight size={28} />
            </button>
          </div>

          <div className="space-y-2 pt-2 max-w-2xl mx-auto w-full">
            <div className="flex justify-between text-sm px-1">
              <span className="text-slate-400 font-medium">{text.dailyGoal}</span>
              <span className={completedCount >= 2 ? "text-emerald-500 font-bold" : "text-slate-500"}>{completedCount}/2 {text.tasks}</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ease-out ${completedCount >= 2 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-slate-300'}`}
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            {completedCount >= 2 && (
              <div className="text-center text-xs text-emerald-500 font-bold animate-pulse pt-1">
                {text.goalAchieved}
              </div>
            )}
          </div>
        </div>

        <div className="bg-sky-50/50 p-6 rounded-2xl border border-sky-100 text-center relative overflow-hidden">
           <div className="absolute -right-4 -top-4 opacity-5 rotate-12"><Wind size={120} /></div>
           <p className="text-lg font-serif italic text-slate-600 relative z-10">"{dailyQuote}"</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HabitCard id="wimHof" label={text.habits.wimHof.label} icon={Wind} color="blue" duration={text.habits.wimHof.duration} />
          <HabitCard id="coldPlunge" label={text.habits.coldPlunge.label} icon={ThermometerSnowflake} color="cyan" duration={text.habits.coldPlunge.duration} />
          <HabitCard id="meditation" label={text.habits.meditation.label} icon={Brain} color="purple" duration={text.habits.meditation.duration} />
          <HabitCard id="journaling" label={text.habits.journaling.label} icon={PenTool} color="emerald" duration={text.habits.journaling.duration} />
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
              <PenTool size={20} className="text-emerald-500" />
              {language === 'en' ? "Guided Session" : "Sesión Guiada"}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => startPhase(1)}
                className={`text-xs px-4 py-2 rounded-full font-medium transition-all uppercase tracking-wide ${currentPhase === 0 ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600' : 'bg-white border border-slate-200 text-slate-500'}`}
              >
                {text.startTimer}
              </button>
            </div>
          </div>

          {currentPhase > 0 && (
            <div className="p-10 bg-slate-900 text-white text-center space-y-6 relative overflow-hidden">
              <div className={`absolute inset-0 opacity-10 bg-emerald-500 transition-opacity duration-1000 ${!timerPaused ? 'animate-pulse' : ''}`}></div>
              
              <div className="relative z-10 max-w-xl mx-auto">
                <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
                  Phase {currentPhase}/3
                </div>
                <h3 className="text-2xl font-bold mb-6">{PHASES[currentPhase].name}</h3>
                
                <div className="text-7xl font-mono font-bold tracking-tighter mb-8 text-white">
                  {formatTime(timeLeft)}
                </div>

                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm text-left mb-8 border border-white/10">
                  <div className="text-xs text-emerald-300 font-bold mb-2">INSTRUCTION</div>
                  <div className="text-lg opacity-90 mb-4 font-medium">{PHASES[currentPhase].prompt}</div>
                  <div className="text-xs text-emerald-300 font-bold mb-2">THE TWEAK</div>
                  <div className="text-base italic opacity-80">{PHASES[currentPhase].tweak}</div>
                </div>

                <div className="flex justify-center gap-6">
                  <button 
                    onClick={() => setTimerPaused(!timerPaused)}
                    className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md"
                  >
                    {timerPaused ? <Play size={32} fill="white" /> : <Pause size={32} fill="white" />}
                  </button>
                  <button 
                    onClick={nextPhase}
                    className="p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 transition-colors text-slate-900 shadow-lg shadow-emerald-900/20"
                  >
                    <SkipForward size={32} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {uploadedImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 group max-w-xl mx-auto">
                <img src={uploadedImage} alt="Journal" className="w-full h-64 object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setUploadedImage(null)} className="bg-white text-red-500 px-4 py-2 rounded-lg text-sm font-bold shadow-lg">{text.remove}</button>
                </div>
                <div className="absolute bottom-3 right-3 bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm font-medium">
                  <CheckCircle2 size={14} /> {text.saved}
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                <Camera size={48} className="mb-4 group-hover:scale-110 transition-transform text-slate-300 group-hover:text-emerald-400" />
                <span className="text-lg font-medium text-slate-600 group-hover:text-emerald-600">{text.upload}</span>
                <span className="text-sm opacity-60 mt-2">{text.uploadSub}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
             {feedbackMessage && (
                <div className="mb-3 p-3 bg-indigo-100 text-indigo-700 text-sm rounded-xl text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                  {feedbackMessage}
                </div>
              )}
            <button 
              onClick={copyForGemini}
              disabled={!uploadedImage}
              className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold transition-all 
                ${uploadedImage 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-200 active:scale-95' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              <Sparkles size={20} />
              {uploadedImage ? text.generatePrompt : text.uploadFirst}
            </button>
          </div>
        </div>

      </div>
      
      <div className="text-center py-10 text-slate-400 text-sm">
        {text.designMorning}
      </div>

    </div>
  );
};

export default BioHackTracker;