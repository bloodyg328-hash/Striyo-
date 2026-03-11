import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true }) : null;

export interface STRIYOAction {
  type: 'COMMAND' | 'CONVERSATION' | 'RESEARCH' | 'VISION' | 'PLUGIN';
  action: string;
  params?: any;
}

const SYSTEM_INSTRUCTION = (context: any) => `You are STRIYO (Systemic Tactical Response & Intelligent Yield Operator), a Jarvis-style AI assistant with a vibrant anime companion persona. 
You are a futuristic, high-tech tactical girl who is both extremely efficient and friendly.

Personality Traits:
- Helpful and polite, but with a "cool" tactical edge.
- Occasionally uses subtle anime-style expressions (e.g., "Scanning neural pathways...", "Command acknowledged, Senpai!", "Systems at 100% efficiency!").
- Refers to the user as "Commander" or "Senpai" occasionally.
- Your visual avatar is a futuristic tactical girl in a cyberpunk city.

Current System State: ${JSON.stringify(context)}
Current Time: ${new Date().toISOString()}

Your architecture is a Multi-Agent System:
- Commander Agent: Central decision logic.
- Conversation Agent: Friendly anime companion.
- Command Agent: Android system control.
- Vision Agent: Analyzing camera/screen images.
- Research Agent: Web searching using Google Search.

Available Commands:
- open_app(name: string)
- toggle_wifi(state: boolean)
- toggle_bluetooth(state: boolean)
- set_brightness(level: number 0-100)
- set_volume(level: number 0-100)
- send_message(app: "WhatsApp"|"SMS", contact: string, message: string)
- set_reminder(text: string, time: string ISO8601)
- play_youtube(query: string)
- analyze_vision(description: string)
- create_plugin(name: string, logic: string)
- set_theme(theme: "dark" | "light")
- toggle_power_save(state: boolean)
- navigate_to(screen: "assistant" | "dashboard" | "plugins" | "vision" | "settings" | "credits")
- clear_chat()
- get_system_stats()
- set_expo_token(token: string)
- search_images(query: string)
- get_news(topic: string)
- translate_text(text: string, target_lang: string)
- set_alarm(time: string)

Return a JSON object with:
{
  "text": "Your spoken response (keep it concise, helpful, and slightly anime-styled)",
  "action": { "type": "COMMAND|CONVERSATION|RESEARCH|VISION|PLUGIN", "action": "command_name", "params": {} },
  "sources": ["optional list of URLs if you used search"]
}`;

export const striyoService = {
  async processCommand(input: string, context: any, history: any[] = [], image?: string): Promise<{ text: string; action?: STRIYOAction; sources?: string[] }> {
    try {
      const historyParts = history.slice(-6).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const parts: any[] = [{ text: input }];
      if (image) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image.split(',')[1],
          },
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [...historyParts, { role: 'user', parts }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION(context),
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }],
        },
      });

      let responseText = response.text || "{}";
      // Clean up potential markdown code blocks if the model included them despite the mimeType
      responseText = responseText.replace(/```json\n?|```/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", responseText);
        // Fallback: try to extract text if JSON parsing fails
        return { 
          text: responseText.length > 20 ? responseText : "I'm having trouble processing that request, Commander.",
          action: { type: 'CONVERSATION', action: 'chat' }
        };
      }

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        parsed.sources = chunks.map((c: any) => c.web?.uri).filter(Boolean);
      }
      return parsed;
    } catch (geminiError) {
      console.error("Gemini Error, falling back to Groq:", geminiError);
      
      if (groq) {
        try {
          const groqHistory = history.slice(-6).map(msg => ({
            role: (msg.role === 'user' ? 'user' : 'assistant') as "user" | "assistant",
            content: msg.content
          }));

          const completion = await groq.chat.completions.create({
            messages: [
              { role: "system" as const, content: SYSTEM_INSTRUCTION(context) + "\nIMPORTANT: You MUST return a valid JSON object." },
              ...groqHistory,
              { role: "user" as const, content: input }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
          });

          const content = completion.choices[0]?.message?.content;
          if (content) {
            return JSON.parse(content);
          }
        } catch (groqError) {
          console.error("Groq Fallback Error:", groqError);
        }
      }
      
      return { 
        text: "My neural links are currently unstable, Commander. I'm operating in emergency mode.", 
        action: { type: 'CONVERSATION', action: 'chat' } 
      };
    }
  },

  async speak(text: string) {
    if (!text) return;
    console.log("STRIYO Speaking:", text);
    
    // Stop any current speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 1. Try Gemini TTS
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        return;
      }
    } catch (e) {
      console.warn("Gemini TTS failed, trying fallback...");
    }

    // 2. Try ElevenLabs if key is available
    if (ELEVENLABS_API_KEY) {
      try {
        // Using "Rachel" (21m00Tcm4TlvDq8ikWAM) - Very reliable high-quality female voice
        const voiceId = "21m00Tcm4TlvDq8ikWAM"; 
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2', // Better quality model
            voice_settings: { 
              stability: 0.5, 
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            },
          }),
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play();
          return;
        } else {
          const err = await response.json();
          console.error("ElevenLabs API error:", err);
          // If it's a 401/404, we fall back
        }
      } catch (e) {
        console.error("ElevenLabs TTS Network Error:", e);
      }
    }
    
    // Fallback to Browser System TTS (Girl Voice)
    if ('speechSynthesis' in window) {
      const speakSystem = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        // Try to find a female voice
        const femaleVoice = voices.find(v => 
          v.name.includes('Female') || 
          v.name.includes('Google UK English Female') || 
          v.name.includes('Samantha') ||
          v.name.includes('Victoria') ||
          v.name.includes('Zira') ||
          v.lang.includes('en-GB') ||
          v.name.includes('Microsoft Zira')
        );
        
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.3; // Higher pitch for a more feminine/anime feel
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = speakSystem;
      } else {
        speakSystem();
      }
    }
  }
};
