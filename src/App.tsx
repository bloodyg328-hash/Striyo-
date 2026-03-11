import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Settings, Cpu, Wifi, Bluetooth, 
  Battery, MessageSquare, Play, Camera, Search, 
  Zap, Home, User, Info, Terminal, Activity, 
  LayoutGrid, Shield, Database, Globe, Smartphone,
  Send, Plus, Trash2, CheckCircle, AlertCircle,
  Sun, Moon, Power, Calendar, Repeat,
  Cloud, Wind, Droplets, Bell, Clock, Check, Users, X
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { striyoService, STRIYOAction } from './services/striyoService';
import { supabaseService } from './services/supabaseService';
import Markdown from 'react-markdown';

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

interface Plugin {
  id: string;
  name: string;
  trigger: string;
  status: 'active' | 'inactive';
  description: string;
}

interface SystemState {
  wifi: boolean;
  bluetooth: boolean;
  brightness: number;
  volume: number;
  isListening: boolean;
  isWakeWordListening: boolean;
  isThinking: boolean;
  activeScreen: 'assistant' | 'dashboard' | 'plugins' | 'vision' | 'settings' | 'credits' | 'automation';
  cpuUsage: number;
  ramUsage: number;
  theme: 'dark' | 'light';
  powerSave: boolean;
  expoPushToken: string;
}

// --- Mock Data Generator ---
const generateStats = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    time: i.toString(),
    cpu: Math.floor(Math.random() * 30) + 20,
    ram: Math.floor(Math.random() * 10) + 60,
  }));
};

interface Reminder {
  id: string;
  text: string;
  time: string;
  completed: boolean;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([
    { id: '1', text: 'Finish STRIYO APK build', time: '2026-03-11T10:00:00', completed: false },
    { id: '2', text: 'Submit project to Ashdeep School', time: '2026-03-12T09:00:00', completed: false }
  ]);
  const [contacts, setContacts] = useState<Contact[]>([
    { id: '1', name: 'Jayveer', phone: '+91 9876543210' },
    { id: '2', name: 'Dad', phone: '+91 9999988888' },
    { id: '3', name: 'Mom', phone: '+91 7777766666' }
  ]);
  const [system, setSystem] = useState<SystemState>({
    wifi: true,
    bluetooth: false,
    brightness: 80,
    volume: 50,
    isListening: false,
    isWakeWordListening: false,
    isThinking: false,
    activeScreen: 'assistant',
    cpuUsage: 24,
    ramUsage: 68,
    theme: 'dark',
    powerSave: false,
    expoPushToken: 'QcqynxjGGuE53yjTdtNV89_4Igybk31np2yLPn3X'
  });
  const [plugins, setPlugins] = useState<Plugin[]>([
    { id: '1', name: 'System Control', trigger: 'wifi, bluetooth', status: 'active', description: 'Core system automation' },
    { id: '2', name: 'YouTube Engine', trigger: 'play, search', status: 'active', description: 'Media automation' },
    { id: '3', name: 'Messaging', trigger: 'send, message', status: 'active', description: 'WhatsApp & SMS integration' }
  ]);
  const [stats, setStats] = useState(generateStats());
  const [isCameraActive, setIsCameraActive] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActive = useRef(false);
  const restartTimeoutRef = useRef<any>(null);

  // --- Initialization ---
  useEffect(() => {
    // Load data from Supabase
    const loadData = async () => {
      try {
        const [savedMessages, savedReminders, savedContacts, savedPlugins] = await Promise.all([
          supabaseService.getMessages(),
          supabaseService.getReminders(),
          supabaseService.getContacts(),
          supabaseService.getPlugins()
        ]);

        if (savedMessages && savedMessages.length > 0) {
          setMessages(savedMessages.slice(-50).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
        }

        if (savedReminders && savedReminders.length > 0) setReminders(savedReminders);
        if (savedContacts && savedContacts.length > 0) setContacts(savedContacts);
        if (savedPlugins && savedPlugins.length > 0) setPlugins(savedPlugins);
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    };
    loadData();

    // Speech Recognition Setup
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        isRecognitionActive.current = true;
        console.log("Speech recognition started");
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted') {
          isRecognitionActive.current = false;
          return;
        }
        
        console.error("Speech recognition error:", event.error);
        isRecognitionActive.current = false;
        if (event.error === 'not-allowed') {
          setSystem(prev => ({ ...prev, isWakeWordListening: false }));
        }
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const transcript = (finalTranscript || interimTranscript).toLowerCase();

        setSystem(prev => {
          if (!prev.isListening && transcript.includes('hey striyo')) {
            striyoService.speak("Yes, I'm listening.");
            return { ...prev, isListening: true };
          }
          
          if (prev.isListening && finalTranscript) {
            handleCommand(finalTranscript);
            return { ...prev, isListening: false };
          }

          return prev;
        });
      };

      recognition.onend = () => {
        isRecognitionActive.current = false;
        console.log("Speech recognition ended");
        
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        
        restartTimeoutRef.current = setTimeout(() => {
          setSystem(prev => {
            if (prev.isWakeWordListening && !isRecognitionActive.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {}
            }
            return prev;
          });
        }, 1000);
      };

      try {
        recognition.start();
      } catch (e) {}
    }

    // Real Stats Fetching
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        setSystem(prev => ({ 
          ...prev, 
          cpuUsage: data.cpu, 
          ramUsage: data.ram 
        }));
        setStats(prev => [...prev.slice(1), { 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
          cpu: data.cpu, 
          ram: data.ram 
        }]);
      } catch (e) {}
    };

    const interval = setInterval(fetchStats, 5000);
    return () => {
      clearInterval(interval);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Core Logic ---
  const handleCommand = async (text?: string, imageData?: string) => {
    const commandText = text?.trim();
    if (!commandText) {
      setSystem(prev => ({ ...prev, isListening: !prev.isListening }));
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: commandText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg].slice(-50)); // Keep only last 50 messages
    supabaseService.saveMessage('user', commandText);
    
    setInput('');
    setSystem(prev => ({ ...prev, isThinking: true }));

    try {
      const response = await striyoService.processCommand(commandText, system, messages, imageData);
      
      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.text, 
        timestamp: new Date(),
        sources: response.sources
      };
      
      setMessages(prev => [...prev, assistantMsg].slice(-50));
      supabaseService.saveMessage('assistant', response.text);
      
      if (response.action) executeAction(response.action);
      striyoService.speak(response.text);
    } catch (error) {
      console.error("STRIYO Command Error:", error);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: "I encountered a neural link error, Commander. My systems are currently recalibrating.", 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMsg].slice(-50));
    } finally {
      setSystem(prev => ({ ...prev, isThinking: false }));
    }
  };

  const executeAction = (action: STRIYOAction) => {
    console.log("STRIYO Action:", action);
    switch (action.action) {
      case 'toggle_wifi': setSystem(prev => ({ ...prev, wifi: action.params?.state ?? !prev.wifi })); break;
      case 'toggle_bluetooth': setSystem(prev => ({ ...prev, bluetooth: action.params?.state ?? !prev.bluetooth })); break;
      case 'set_brightness': setSystem(prev => ({ ...prev, brightness: action.params?.level ?? 80 })); break;
      case 'set_volume': setSystem(prev => ({ ...prev, volume: action.params?.level ?? 50 })); break;
      case 'set_theme': setSystem(prev => ({ ...prev, theme: action.params?.theme || 'dark' })); break;
      case 'toggle_power_save': setSystem(prev => ({ ...prev, powerSave: action.params?.state ?? !prev.powerSave })); break;
      case 'navigate_to': setSystem(prev => ({ ...prev, activeScreen: action.params?.screen || 'assistant' })); break;
      case 'clear_chat': 
        setMessages([]); 
        supabaseService.saveMessage('assistant', 'Chat history cleared.');
        break;
      case 'create_plugin':
        const newPlugin: Plugin = {
          id: Date.now().toString(),
          name: action.params?.name || 'New Plugin',
          trigger: action.params?.trigger || 'custom',
          status: 'active',
          description: action.params?.description || 'AI Generated capability'
        };
        setPlugins(prev => [...prev, newPlugin]);
        supabaseService.savePlugin(newPlugin);
        break;
      case 'set_expo_token':
        setSystem(prev => ({ ...prev, expoPushToken: action.params?.token || '' }));
        break;
      case 'set_reminder':
        setReminders(prev => [...prev, {
          id: Date.now().toString(),
          text: action.params?.text || 'New Reminder',
          time: action.params?.time || new Date().toISOString(),
          completed: false
        }]);
        break;
      case 'send_message':
        // In a real APK, this would use Linking.openURL(`sms:${phone}?body=${message}`)
        console.log(`Sending ${action.params?.app} to ${action.params?.contact}: ${action.params?.message}`);
        break;
      case 'search_images':
        window.open(`https://www.google.com/search?q=${encodeURIComponent(action.params?.query || '')}&tbm=isch`, '_blank');
        break;
      case 'get_news':
        window.open(`https://news.google.com/search?q=${encodeURIComponent(action.params?.topic || 'latest news')}`, '_blank');
        break;
      case 'translate_text':
        window.open(`https://translate.google.com/?sl=auto&tl=${action.params?.target_lang || 'en'}&text=${encodeURIComponent(action.params?.text || '')}&op=translate`, '_blank');
        break;
      case 'set_alarm':
        alert(`Alarm set for ${action.params?.time}. (Note: In a real app, this would trigger a system alarm)`);
        break;
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Speech recognition not supported");
    
    setSystem(prev => {
      const newWakeState = !prev.isWakeWordListening;
      if (newWakeState) {
        try {
          if (!isRecognitionActive.current) {
            recognitionRef.current.start();
          }
        } catch (e) {}
      } else {
        recognitionRef.current.stop();
      }
      return { ...prev, isWakeWordListening: newWakeState, isListening: false };
    });
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 overflow-hidden relative ${system.theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
      {/* --- Immersive Background --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Deep Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-striyo-bg-start via-striyo-bg-mid to-striyo-bg-end" />
        
        {/* Animated Particles / Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-striyo-accent/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse delay-700" />
        
        {/* Holographic Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.2) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* --- Status Bar --- */}
      <div className="h-14 px-6 flex items-center justify-between text-[10px] font-mono tracking-[0.2em] border-b border-white/5 backdrop-blur-2xl z-50 relative">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Shield size={14} className="text-striyo-accent" />
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-striyo-accent/20 rounded-full" />
            </div>
            <span className="font-bold striyo-gradient-text">STRIYO CORE v3.0</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 opacity-60">
            <Wifi size={12} className={system.wifi ? "text-striyo-accent" : "text-striyo-alert"} />
            <Bluetooth size={12} className={system.bluetooth ? "text-blue-400" : "text-striyo-alert"} />
            <div className="flex items-center gap-1.5">
              <Battery size={12} className="text-striyo-accent" />
              <span>88%</span>
            </div>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <span className="opacity-80 font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* --- Main Viewport --- */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {system.activeScreen === 'assistant' && <AssistantView system={system} messages={messages} chatEndRef={chatEndRef} onCommand={handleCommand} onToggleMic={toggleListening} />}
          {system.activeScreen === 'dashboard' && <DashboardView stats={stats} system={system} setSystem={setSystem} />}
          {system.activeScreen === 'plugins' && (
            <PluginView 
              plugins={plugins} 
              onCommand={handleCommand} 
              onDelete={(id: string) => {
                setPlugins(prev => prev.filter(p => p.id !== id));
                supabaseService.deletePlugin(id);
              }} 
            />
          )}
          {system.activeScreen === 'vision' && <VisionView isActive={isCameraActive} setIsActive={setIsCameraActive} onCommand={handleCommand} />}
          {system.activeScreen === 'automation' && <AutomationView reminders={reminders} setReminders={setReminders} contacts={contacts} setContacts={setContacts} />}
          {system.activeScreen === 'settings' && <SettingsView system={system} setSystem={setSystem} />}
          {system.activeScreen === 'credits' && <CreditsView />}
        </AnimatePresence>
      </main>

      {/* --- Bottom Navigation --- */}
      <nav className={`h-20 ${system.theme === 'dark' ? 'bg-black/80 border-white/5' : 'bg-white/80 border-black/5'} backdrop-blur-2xl border-t px-6 flex items-center justify-between z-50`}>
        <NavButton icon={<MessageSquare />} label="Assistant" active={system.activeScreen === 'assistant'} onClick={() => setSystem(prev => ({ ...prev, activeScreen: 'assistant' }))} />
        <NavButton icon={<Activity />} label="Monitor" active={system.activeScreen === 'dashboard'} onClick={() => setSystem(prev => ({ ...prev, activeScreen: 'dashboard' }))} />
        <NavButton icon={<LayoutGrid />} label="Plugins" active={system.activeScreen === 'plugins'} onClick={() => setSystem(prev => ({ ...prev, activeScreen: 'plugins' }))} />
        <NavButton icon={<Zap />} label="Auto" active={system.activeScreen === 'automation'} onClick={() => setSystem(prev => ({ ...prev, activeScreen: 'automation' }))} />
        <NavButton icon={<Camera />} label="Vision" active={system.activeScreen === 'vision'} onClick={() => setSystem(prev => ({ ...prev, activeScreen: 'vision' }))} />
        <NavButton icon={<Settings />} label="Settings" active={system.activeScreen === 'settings'} onClick={() => setSystem(prev => ({ ...prev, activeScreen: 'settings' }))} />
      </nav>
    </div>
  );
}

// --- Sub-Views ---

function AssistantView({ system, messages, chatEndRef, onCommand, onToggleMic }: any) {
  const [input, setInput] = useState('');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col pb-32">
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Hero Section: Avatar */}
        <div className="relative z-10">
          {/* Glow Halo */}
          <div className="absolute inset-0 bg-striyo-accent/20 rounded-full blur-[60px] animate-pulse" />
          
          <motion.div 
            animate={{ 
              y: [0, -15, 0],
              scale: system.isListening ? [1, 1.05, 1] : 1
            }}
            transition={{ 
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 1, repeat: Infinity }
            }}
            className="relative w-72 h-72 flex items-center justify-center"
          >
            {/* Rotating Tech Rings */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }} 
              className="absolute inset-0 border border-striyo-accent/20 rounded-full border-dashed" 
            />
            <motion.div 
              animate={{ rotate: -360 }} 
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }} 
              className="absolute inset-6 border border-blue-500/20 rounded-full border-dashed" 
            />
            
            {/* Avatar Container */}
            <div className="w-56 h-56 rounded-full overflow-hidden border-2 border-striyo-accent/30 relative z-10 shadow-[0_0_60px_rgba(16,185,129,0.3)] glass-panel">
              <img 
                src="https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA4L3Jhd3BpeGVsX29mZmljZV8yNl9hbmltZV9naXJsX2luX2Z1dHVyaXN0aWNfY3liZXJwdW5rX2NpdHlfYmFja2dyb3VuZF80YjFmYjQ4ZS1iYmE0LTQzZTctYmU3Mi1iZDM2ZGM0YmQ0ZjhfMS5qcGc.jpg" 
                alt="STRIYO Avatar" 
                className={`w-full h-full object-cover transition-all duration-1000 ${system.isThinking ? 'scale-110 brightness-125' : 'scale-100'}`}
                referrerPolicy="no-referrer"
              />
              
              {/* Scanline */}
              <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden opacity-30">
                <div className="w-full h-1 bg-striyo-accent/50 blur-[2px] scanline" />
              </div>

              {/* Voice Waveform Overlay */}
              {system.isListening && (
                <div className="absolute inset-0 bg-striyo-alert/10 backdrop-blur-[2px] z-40 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-1.5 h-12">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ height: [8, 40, 12, 48, 8] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1.5 bg-striyo-alert rounded-full shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Assistant Name & Status */}
        <div className="mt-12 text-center relative z-10">
          <h1 className="text-5xl font-black tracking-[0.4em] striyo-gradient-text uppercase italic">STRIYO</h1>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className={`w-2 h-2 rounded-full ${system.isListening ? 'bg-striyo-alert animate-ping' : 'bg-striyo-accent'}`} />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-50">
              {system.isThinking ? 'Neural Processing...' : system.isListening ? 'Listening...' : 'Ready for Command'}
            </span>
          </div>
        </div>
      </div>

      {/* Chat History Section */}
      <div className="flex-1 px-6 overflow-y-auto custom-scrollbar min-h-[300px]">
        <div className="max-w-xl mx-auto space-y-6">
          {messages.map((msg: any) => (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] p-5 rounded-3xl text-sm leading-relaxed glass-panel transition-all ${
                msg.role === 'user' 
                ? 'bg-striyo-accent/10 border-striyo-accent/30 text-emerald-50' 
                : 'bg-white/5 border-white/10 text-zinc-200'
              }`}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <Markdown>{msg.content}</Markdown>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                    {msg.sources.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-striyo-accent border border-striyo-accent/20 px-2.5 py-1 rounded-lg hover:bg-striyo-accent/10 transition-colors">
                        Source {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[8px] font-mono opacity-30 uppercase tracking-widest mt-2 px-2">
                {msg.role} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))}
          
          {system.isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="glass-panel p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                <div className="flex gap-1">
                  <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-striyo-accent rounded-full" />
                  <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-striyo-accent rounded-full" />
                  <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-striyo-accent rounded-full" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">Neural Processing...</span>
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Interaction Bar */}
      <div className="fixed bottom-28 left-0 right-0 px-6 z-40">
        <div className="max-w-xl mx-auto glass-panel rounded-3xl p-2 flex items-center gap-2">
          <button 
            onClick={() => onToggleMic()}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${system.isListening ? 'bg-striyo-alert text-white' : 'bg-white/5 text-striyo-accent hover:bg-white/10'}`}
          >
            {system.isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onCommand(input);
                setInput('');
              }
            }}
            placeholder="Enter command..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-light px-2 placeholder:text-white/20"
          />

          <button 
            onClick={() => {
              onCommand(input);
              setInput('');
            }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-striyo-primary-start to-striyo-primary-end flex items-center justify-center text-black shadow-lg shadow-striyo-accent/20"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function WeatherWidget() {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Using wttr.in for real-time weather without API keys
        const res = await fetch('https://wttr.in/?format=j1');
        const data = await res.json();
        setWeather(data.current_condition[0]);
      } catch (e) {
        console.error("Weather fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  if (loading) return <div className="h-32 bg-zinc-900/50 rounded-3xl animate-pulse" />;

  return (
    <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <Cloud size={32} />
        </div>
        <div>
          <h3 className="text-2xl font-light">{weather?.temp_C}°C</h3>
          <p className="text-xs font-mono uppercase opacity-40 tracking-widest">{weather?.weatherDesc[0]?.value}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 justify-end text-xs font-mono opacity-60">
          <Wind size={12} className="text-blue-400" />
          <span>{weather?.windspeedKmph} km/h</span>
        </div>
        <div className="flex items-center gap-2 justify-end text-xs font-mono opacity-60 mt-1">
          <Droplets size={12} className="text-blue-400" />
          <span>{weather?.humidity}% Humidity</span>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ stats, system, setSystem }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full p-8 overflow-y-auto custom-scrollbar pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black tracking-tight striyo-gradient-text uppercase italic">Telemetry</h2>
            <p className="text-[10px] font-mono opacity-40 uppercase mt-1 tracking-[0.2em]">Real-time system diagnostics</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <div className="w-2 h-2 rounded-full bg-striyo-accent animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Live Feed</span>
          </div>
        </header>

        <WeatherWidget />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CPU Card */}
          <motion.div whileHover={{ y: -5 }} className="glass-panel p-8 rounded-[2.5rem] flex flex-col justify-between min-h-[320px]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest opacity-60 flex items-center gap-2 mb-1">
                  <Cpu size={14} className="text-striyo-accent" />
                  Processor
                </h3>
                <p className="text-xs opacity-30 italic">Neural compute load</p>
              </div>
              <span className="text-4xl font-black text-striyo-accent italic">{system.cpuUsage}%</span>
            </div>
            
            <div className="h-40 mt-6 -mx-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* RAM Card */}
          <motion.div whileHover={{ y: -5 }} className="glass-panel p-8 rounded-[2.5rem] flex flex-col justify-between min-h-[320px]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest opacity-60 flex items-center gap-2 mb-1">
                  <Database size={14} className="text-blue-400" />
                  Memory
                </h3>
                <p className="text-xs opacity-30 italic">Neural buffer allocation</p>
              </div>
              <span className="text-4xl font-black text-blue-400 italic">{system.ramUsage}%</span>
            </div>
            
            <div className="flex-1 flex items-center justify-center py-6">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="72" cy="72" r="64" fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
                  <motion.circle 
                    cx="72" cy="72" r="64" fill="none" stroke="currentColor" strokeWidth="10" 
                    className="text-blue-500"
                    strokeDasharray="402"
                    initial={{ strokeDashoffset: 402 }}
                    animate={{ strokeDashoffset: 402 - (402 * system.ramUsage) / 100 }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Database size={24} className="text-blue-400/40 mb-1" />
                  <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Active</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase opacity-40 tracking-widest">
                <span>Buffer Capacity</span>
                <span>16.0 GB</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${system.ramUsage}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ControlCard icon={<Wifi size={20} />} title="WiFi" active={system.wifi} onClick={() => setSystem((p: any) => ({ ...p, wifi: !p.wifi }))} />
          <ControlCard icon={<Bluetooth size={20} />} title="BT" active={system.bluetooth} onClick={() => setSystem((p: any) => ({ ...p, bluetooth: !p.bluetooth }))} />
          <ControlCard icon={system.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />} title="Dark" active={system.theme === 'dark'} onClick={() => setSystem((p: any) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))} />
          <ControlCard icon={<Zap size={20} />} title="Power" active={system.powerSave} onClick={() => setSystem((p: any) => ({ ...p, powerSave: !p.powerSave }))} />
        </div>
      </div>
    </motion.div>
  );
}

function PluginView({ plugins, onCommand, onDelete }: { plugins: Plugin[], onCommand: any, onDelete: any }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full p-8 overflow-y-auto custom-scrollbar pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black tracking-tight striyo-gradient-text uppercase italic">Extensions</h2>
            <p className="text-[10px] font-mono opacity-40 uppercase mt-1 tracking-[0.2em]">Modular capability plugins</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCommand("Generate a new useful AI plugin for me")}
            className="flex items-center gap-3 bg-gradient-to-r from-striyo-primary-start to-striyo-primary-end text-black px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-striyo-accent/20"
          >
            <Plus size={18} />
            Initialize New
          </motion.button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plugins.map(plugin => (
            <motion.div 
              key={plugin.id} 
              whileHover={{ y: -5 }}
              className="glass-panel p-8 rounded-[2.5rem] group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-striyo-primary-start to-striyo-primary-end opacity-40" />
              
              <button 
                onClick={() => onDelete(plugin.id)}
                className="absolute top-6 right-6 p-2 text-striyo-alert opacity-0 group-hover:opacity-100 transition-opacity hover:bg-striyo-alert/10 rounded-xl"
              >
                <Trash2 size={16} />
              </button>

              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-striyo-accent/10 flex items-center justify-center text-striyo-accent group-hover:scale-110 transition-transform duration-500">
                  <Terminal size={28} />
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[8px] font-mono uppercase tracking-[0.2em] font-bold ${plugin.status === 'active' ? 'bg-striyo-accent/20 text-striyo-accent' : 'bg-striyo-alert/20 text-striyo-alert'}`}>
                  {plugin.status}
                </div>
              </div>

              <h3 className="text-2xl font-black mb-2 italic uppercase tracking-tight">{plugin.name}</h3>
              <p className="text-xs opacity-40 mb-6 leading-relaxed italic">{plugin.description}</p>
              
              <div className="flex items-center gap-3 text-[10px] font-mono opacity-60 uppercase tracking-widest">
                <CheckCircle size={14} className="text-striyo-accent" />
                <span>Triggers: {plugin.trigger}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function VisionView({ isActive, setIsActive, onCommand }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isActive) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error("Camera access denied:", err));
    }
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [isActive]);

  const captureAndAnalyze = (label: string) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg');
      onCommand(`Analyze this for ${label}`, imageData);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl aspect-video bg-zinc-900 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col items-center justify-center group">
        <canvas ref={canvasRef} className="hidden" />
        {isActive ? (
          <div className="absolute inset-0">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover opacity-80" 
            />
            <div className="absolute inset-0 border-[20px] border-black/20 pointer-events-none" />
            <div className="absolute top-8 left-8 flex items-center gap-2 bg-red-500 px-3 py-1 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span className="text-[10px] font-mono font-bold">LIVE FEED</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border border-emerald-500/30 rounded-full flex items-center justify-center">
                <div className="w-32 h-32 border border-emerald-500/50 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600">
              <Camera size={40} />
            </div>
            <div>
              <h3 className="text-xl font-light">Vision Agent Offline</h3>
              <p className="text-xs opacity-40 mt-1">Initialize camera for scene analysis</p>
            </div>
            <button onClick={() => setIsActive(true)} className="bg-emerald-500 text-black px-8 py-3 rounded-full text-sm font-bold hover:bg-emerald-400 transition-all">
              Initialize Link
            </button>
          </div>
        )}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-2xl">
        <VisionAction icon={<Search />} label="Object Detection" onClick={() => captureAndAnalyze("objects")} />
        <VisionAction icon={<Terminal />} label="OCR Analysis" onClick={() => captureAndAnalyze("text")} />
        <VisionAction icon={<Info />} label="Scene Context" onClick={() => captureAndAnalyze("context")} />
      </div>
    </motion.div>
  );
}

function AutomationView({ reminders, setReminders, contacts, setContacts }: any) {
  const [newReminder, setNewReminder] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>('none');
  const [showOptions, setShowOptions] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'status'>('time');
  const [activeMessageContact, setActiveMessageContact] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });

  const addReminder = () => {
    if (!newReminder.trim()) return;
    const reminder = {
      id: Date.now().toString(),
      text: newReminder,
      time: scheduleTime ? new Date(scheduleTime).toISOString() : new Date().toISOString(),
      completed: false,
      recurrence: recurrence
    };
    
    setReminders((prev: any) => [...prev, reminder]);
    supabaseService.saveReminder(reminder);
    
    setNewReminder('');
    setScheduleTime('');
    setRecurrence('none');
    setShowOptions(false);
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) return;
    const contact = {
      id: Date.now().toString(),
      name: newContact.name,
      phone: newContact.phone
    };
    setContacts((prev: any) => [...prev, contact]);
    supabaseService.saveContact(contact);
    setNewContact({ name: '', phone: '' });
    setShowAddContact(false);
  };

  const deleteContact = (id: string) => {
    setContacts((prev: any) => prev.filter((c: any) => c.id !== id));
    supabaseService.deleteContact(id);
  };

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      if (sortBy === 'status') {
        if (a.completed === b.completed) {
          return new Date(b.time).getTime() - new Date(a.time).getTime();
        }
        return a.completed ? 1 : -1;
      }
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
  }, [reminders, sortBy]);

  const isOverdue = (time: string, completed: boolean) => {
    return !completed && new Date(time).getTime() < new Date().getTime() - 60000; // 1 min grace
  };

  const sendMessage = async (contactId: string) => {
    if (!messageText.trim()) return;
    const contact = contacts.find((c: any) => c.id === contactId);
    
    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: contact?.phone,
          message: messageText,
          type: 'SMS'
        })
      });
      
      if (res.ok) {
        striyoService.speak(`Message sent to ${contact?.name}`);
        setMessageText('');
        setActiveMessageContact(null);
      }
    } catch (e) {
      console.error("Failed to send real message:", e);
      striyoService.speak("System error: Message gateway unreachable.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full p-8 overflow-y-auto custom-scrollbar pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black tracking-tight striyo-gradient-text uppercase italic">Automation</h2>
            <p className="text-[10px] font-mono opacity-40 uppercase mt-1 tracking-[0.2em]">Task Scheduling & Messaging</p>
          </div>
          <div className="flex gap-2 glass-panel p-1 rounded-2xl">
            <button 
              onClick={() => setSortBy('time')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'time' ? 'bg-striyo-accent text-black shadow-lg shadow-striyo-accent/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Time
            </button>
            <button 
              onClick={() => setSortBy('status')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'status' ? 'bg-striyo-accent text-black shadow-lg shadow-striyo-accent/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Status
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Reminders Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono uppercase tracking-[0.2em] opacity-60 flex items-center gap-2">
                <Bell size={14} className="text-striyo-accent" />
                Reminders
              </h3>
              <span className="text-[10px] font-mono opacity-30 uppercase">{reminders.length} Active</span>
            </div>

            <div className="glass-panel p-6 rounded-[2rem] space-y-4">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newReminder}
                  onChange={(e) => setNewReminder(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addReminder()}
                  placeholder="Set a new neural reminder..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-striyo-accent/50 transition-all placeholder:opacity-20"
                />
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={addReminder}
                  className="bg-striyo-accent text-black p-4 rounded-2xl shadow-lg shadow-striyo-accent/20"
                >
                  <Plus size={20} />
                </motion.button>
              </div>

              <div className="flex items-center gap-4 px-2">
                <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                  <Clock size={14} className="opacity-40" />
                  <input 
                    type="datetime-local" 
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-transparent text-[10px] font-mono uppercase focus:outline-none w-full opacity-60"
                  />
                </div>
                <select 
                  value={recurrence}
                  onChange={(e: any) => setRecurrence(e.target.value)}
                  className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-[10px] font-mono uppercase focus:outline-none opacity-60"
                >
                  <option value="none">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sortedReminders.map((reminder: any) => (
                  <motion.div 
                    key={reminder.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`glass-panel p-6 rounded-3xl flex items-center gap-4 group transition-all ${reminder.completed ? 'opacity-40' : ''}`}
                  >
                    <button 
                      onClick={() => {
                        const updated = reminders.map((r: any) => r.id === reminder.id ? { ...r, completed: !r.completed } : r);
                        setReminders(updated);
                        supabaseService.saveReminder(updated.find((r: any) => r.id === reminder.id));
                      }}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${reminder.completed ? 'bg-striyo-accent border-striyo-accent text-black' : 'border-white/20 hover:border-striyo-accent/50'}`}
                    >
                      {reminder.completed && <Check size={14} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${reminder.completed ? 'line-through' : ''}`}>{reminder.text}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${isOverdue(reminder.time, reminder.completed) ? 'text-red-400' : 'opacity-30'}`}>
                          {new Date(reminder.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {reminder.recurrence !== 'none' && (
                          <span className="text-[8px] font-mono uppercase bg-white/5 px-2 py-0.5 rounded-full opacity-40">
                            {reminder.recurrence}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setReminders((prev: any) => prev.filter((r: any) => r.id !== reminder.id));
                        supabaseService.deleteReminder(reminder.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-red-400/60 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono uppercase tracking-[0.2em] opacity-60 flex items-center gap-2">
                <Users size={14} className="text-blue-400" />
                Neural Contacts
              </h3>
              <button 
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:underline"
              >
                {showAddContact ? 'Cancel' : 'Add New'}
              </button>
            </div>

            <AnimatePresence>
              {showAddContact && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass-panel p-6 rounded-[2rem] space-y-4 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Name"
                      value={newContact.name}
                      onChange={(e) => setNewContact(p => ({ ...p, name: e.target.value }))}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-400/50 transition-all"
                    />
                    <input 
                      type="text" 
                      placeholder="Phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact(p => ({ ...p, phone: e.target.value }))}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-400/50 transition-all"
                    />
                  </div>
                  <button 
                    onClick={addContact}
                    className="w-full bg-blue-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                  >
                    Register Contact
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-4">
              {contacts.map((contact: any) => (
                <motion.div 
                  key={contact.id}
                  whileHover={{ x: 5 }}
                  className="glass-panel p-6 rounded-3xl flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-black italic">
                    {contact.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold uppercase tracking-widest">{contact.name}</h4>
                    <p className="text-[10px] font-mono opacity-40 mt-0.5">{contact.phone}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => setActiveMessageContact(activeMessageContact === contact.id ? null : contact.id)}
                      className={`p-2 rounded-xl border transition-all ${activeMessageContact === contact.id ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button 
                      onClick={() => deleteContact(contact.id)}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 text-red-400/60 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {activeMessageContact && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-32 left-8 right-8 z-50 glass-panel p-6 rounded-[2.5rem] shadow-2xl border-blue-500/30"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-400">
                      Message: {contacts.find((c: any) => c.id === activeMessageContact)?.name}
                    </h4>
                    <button onClick={() => setActiveMessageContact(null)} className="text-white/20 hover:text-white/40">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type neural transmission..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-blue-400/50 transition-all"
                    />
                    <button 
                      onClick={() => sendMessage(activeMessageContact)}
                      className="bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsView({ system, setSystem }: any) {
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [tokenInput, setTokenInput] = useState(system.expoPushToken);

  const saveToken = () => {
    setSystem((prev: any) => ({ ...prev, expoPushToken: tokenInput }));
    setIsEditingToken(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full p-8 overflow-y-auto custom-scrollbar pb-32">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h2 className="text-4xl font-black tracking-tight striyo-gradient-text uppercase italic">Settings</h2>
          <p className="text-[10px] font-mono opacity-40 uppercase mt-1 tracking-[0.2em]">Configuration & Cloud Sync</p>
        </header>

        <div className="space-y-4">
          <SettingItem icon={<User size={20} />} title="Account Profile" description="Dabhi Jayveer Ajitshin" />
          <SettingItem icon={<Database size={20} />} title="Cloud Sync" description="Last synced: 2 minutes ago" />
          
          <div className="glass-panel p-6 rounded-3xl flex items-center justify-between group transition-all">
            <div className="flex items-center gap-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${system.isWakeWordListening ? 'bg-striyo-accent/20 text-striyo-accent shadow-lg shadow-striyo-accent/10' : 'bg-white/5 text-white/40'}`}>
                <Mic size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest">Wake Word</h4>
                <p className="text-[10px] opacity-40 uppercase mt-1 tracking-wider italic">Listen for "Hey STRIYO"</p>
              </div>
            </div>
            <button 
              onClick={() => setSystem((prev: any) => ({ ...prev, isWakeWordListening: !prev.isWakeWordListening }))}
              className={`w-14 h-7 rounded-full transition-all relative ${system.isWakeWordListening ? 'bg-striyo-accent' : 'bg-white/10'}`}
            >
              <motion.div 
                animate={{ x: system.isWakeWordListening ? 28 : 4 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md" 
              />
            </button>
          </div>

          <div className="glass-panel p-6 rounded-3xl flex items-center gap-6 group transition-all">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Smartphone size={24} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold uppercase tracking-widest">Expo Push Token</h4>
              {isEditingToken ? (
                <div className="mt-3 flex gap-2">
                  <input 
                    type="text" 
                    value={tokenInput} 
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ExponentPushToken[...]"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono focus:outline-none focus:border-striyo-accent/50 transition-all"
                  />
                  <button 
                    onClick={saveToken}
                    className="bg-striyo-accent text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] font-mono opacity-40 truncate max-w-[200px]">{system.expoPushToken || "Not configured"}</p>
                  <button 
                    onClick={() => setIsEditingToken(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-striyo-accent hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`${system.theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-black/5 shadow-sm'} p-6 rounded-3xl border space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-medium">APK Build Guide</h4>
                  <p className="text-[10px] opacity-40 uppercase">Ready for EAS Build</p>
                </div>
              </div>
              <button 
                onClick={() => alert("1. Install EAS: npm install -g eas-cli\n2. Login: eas login\n3. Build: eas build -p android --profile production")}
                className="px-3 py-1.5 rounded-xl bg-blue-500 text-white text-[10px] font-bold hover:bg-blue-600 transition-colors"
              >
                View Commands
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="opacity-60">Build Tool</span>
                <span className="font-mono text-blue-400">Expo EAS</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="opacity-60">Target Platform</span>
                <span className="font-mono">Android (APK)</span>
              </div>
            </div>
          </div>

          <div className={`${system.theme === 'dark' ? 'bg-zinc-900/50 border-white/5' : 'bg-white border-black/5 shadow-sm'} p-6 rounded-3xl border space-y-4`}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="text-sm font-medium">Native Manifest</h4>
                <p className="text-[10px] font-mono opacity-40 uppercase">v1.0.0 • com.striyo.assistant</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] opacity-40 uppercase mb-1">Permissions</p>
                <div className="flex flex-wrap gap-1">
                  {['Camera', 'Audio', 'GPS'].map(p => (
                    <span key={p} className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-bold">{p}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] opacity-40 uppercase mb-1">Splash Screen</p>
                <div className="w-full h-4 bg-zinc-800 rounded-sm overflow-hidden flex items-center justify-center">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          <SettingItem icon={<Shield />} title="Privacy & Security" description="Biometric lock active" />
          <SettingItem icon={<Globe />} title="Language" description="English (US)" />
        </div>

        <button onClick={() => window.location.reload()} className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-2xl text-sm font-bold hover:bg-red-500/20 transition-all">
          Reset System Core
        </button>
      </div>
    </motion.div>
  );
}

function CreditsView() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full flex items-center justify-center p-4 overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-xl w-full glass-panel p-8 md:p-12 rounded-[3rem] text-center space-y-8 relative overflow-hidden my-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-striyo-accent to-transparent opacity-50" />
        
        <div className="w-20 h-20 bg-striyo-accent/10 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-striyo-accent/10">
          <Cpu size={40} className="text-striyo-accent" />
        </div>

        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tight striyo-gradient-text uppercase italic">STRIYO OS</h2>
          <p className="text-[10px] font-mono opacity-40 uppercase tracking-[0.3em]">Neural Interface v3.0.0</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {/* Architect Section */}
          <div className="md:col-span-2 p-4 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Architect & Lead Developer</p>
            <p className="text-lg font-bold mt-1 text-striyo-accent">Dabhi Jayveer Ajitshin</p>
            <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">16 Year Old Visionary • MJ PRIVATE COMPANY</p>
          </div>

          {/* Origin Section */}
          <div className="md:col-span-2 p-4 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Origin</p>
            <p className="text-xs font-bold mt-1">Born in Shiynager, Botad, Bhavnagar, Gujarat</p>
          </div>

          {/* Education Section */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
            <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Educational Background</p>
            <div>
              <p className="text-[10px] opacity-40 uppercase tracking-widest">Current</p>
              <p className="text-xs font-bold">Ashdeep International School (Branch 9)</p>
            </div>
            <div>
              <p className="text-[10px] opacity-40 uppercase tracking-widest">Previous</p>
              <p className="text-xs font-bold">Shishukunj (Surat)</p>
              <p className="text-xs font-bold">Shree Swami Narayan School (Rapar, Kutch)</p>
            </div>
          </div>

          {/* Family Section */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
            <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Family & Support</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Father</p>
                <p className="text-xs font-bold">Dabhi Ajitshin</p>
              </div>
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Mother</p>
                <p className="text-xs font-bold">Shobhana Ben</p>
              </div>
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Grandfather</p>
                <p className="text-xs font-bold">Jamsang Bhai Dabhi</p>
              </div>
              <div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">Grandmother</p>
                <p className="text-xs font-bold">Champaben</p>
              </div>
            </div>
          </div>

          {/* Extended Family Section */}
          <div className="md:col-span-2 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Siblings</p>
                <p className="text-xs font-bold">Dev Dabhi</p>
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Uncle & Aunt</p>
                <p className="text-xs font-bold">Dabhi Aniruddh Shin</p>
                <p className="text-xs font-bold">Pooja Ben</p>
              </div>
              <div>
                <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">Cousins</p>
                <p className="text-xs font-bold">Veer Dabhi</p>
                <p className="text-xs font-bold">Kriva Dabhi</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <p className="text-[10px] font-mono opacity-20 uppercase tracking-[0.5em]">
            © 2026 NEURAL DYNAMICS • SURAT, GUJARAT
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// --- Helper Components ---

function NavButton({ icon, label, active, onClick }: any) {
  return (
    <motion.button 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick} 
      className={`flex flex-col items-center gap-1.5 transition-all relative ${active ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -top-2 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]"
        />
      )}
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-emerald-500/10' : ''}`}>{icon}</div>
      <span className="text-[9px] font-mono uppercase tracking-widest">{label}</span>
    </motion.button>
  );
}

function ControlCard({ icon, title, active, onClick }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all ${active ? 'bg-striyo-accent/10 border-striyo-accent/40 text-striyo-accent' : 'text-white/40 hover:text-white/60'}`}
    >
      <div className={`p-3 rounded-2xl ${active ? 'bg-striyo-accent/20' : 'bg-white/5'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">{title}</span>
    </motion.button>
  );
}

function VisionAction({ icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-2 opacity-60 hover:opacity-100 cursor-pointer transition-all"
    >
      {icon}
      <span className="text-[9px] font-mono uppercase text-center">{label}</span>
    </button>
  );
}

function SettingItem({ icon, title, description }: any) {
  return (
    <div className="flex items-center gap-4 bg-zinc-900/50 border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-all cursor-pointer">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">{icon}</div>
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="text-xs opacity-40">{description}</p>
      </div>
    </div>
  );
}

function DashboardCard({ icon, title, value, active }: { icon: React.ReactNode, title: string, value: string, active: boolean }) {
  return (
    <div className={`p-6 rounded-3xl border transition-all ${active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/50 border-white/5'}`}>
      <div className={`mb-4 ${active ? 'text-emerald-400' : 'text-zinc-500'}`}>{icon}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-1">{title}</div>
      <div className="text-xl font-light tracking-tight">{value}</div>
    </div>
  );
}
