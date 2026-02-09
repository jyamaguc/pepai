import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Session, Drill, PositionType, ArrowType } from '../types/types';
import { drillToolDeclarations } from '../services/geminiService';

interface VoiceAssistantProps {
  session?: Session;
  currentDrill?: Drill;
  onUpdateDrill?: (drill: Drill) => void;
  onTranscriptChange?: (text: string) => void;
  isProcessing?: boolean;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ session, currentDrill, onUpdateDrill, onTranscriptChange, isProcessing }) => {
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Transcription state management
  const confirmedTranscriptRef = useRef('');
  
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Use refs to avoid stale closures in Live API callbacks
  const currentDrillRef = useRef(currentDrill);
  const onUpdateDrillRef = useRef(onUpdateDrill);
  
  useEffect(() => {
    currentDrillRef.current = currentDrill;
  }, [currentDrill]);

  useEffect(() => {
    onUpdateDrillRef.current = onUpdateDrill;
  }, [onUpdateDrill]);

  // Audio Processing Helpers
  function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  const handleSendEditedTranscript = () => {
    const fullText = confirmedTranscriptRef.current;
    if (!fullText.trim() || !liveSessionRef.current) return;
    
    liveSessionRef.current.send({
      parts: [{ text: fullText }]
    });
    
    setIsEditing(false);
  };

  const startLiveSession = async () => {
    if (isLive || isConnecting) return;
    
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) {
      setStatusMessage('API Key Missing');
      alert("Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file and restart the dev server.");
      return;
    }

    setIsConnecting(true);
    setStatusMessage('Warming up the pitch...');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outCtx;

      // Ensure AudioContexts are running
      await inCtx.resume();
      await outCtx.resume();
      
      let nextStartTime = 0;
      const sources = new Set<AudioBufferSourceNode>();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          tools: [{ functionDeclarations: drillToolDeclarations }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Pep Guardiola, a tactical genius and world-class soccer coach. You are helping a coach design a drill. You can talk back and you have access to tools to modify the drill markers on a 100x100 grid.
          IMPORTANT: You MUST ONLY modify the markers if asked. If you add a player, it appears on the pitch.
          Current Drill Context: ${JSON.stringify(currentDrillRef.current || {})}
          Be enthusiastic, detailed, and use tactical jargon like 'half-spaces', 'low-block', and 'positional play'.`
        },
        callbacks: {
          onopen: () => {
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!liveSessionRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              
              sessionPromise.then(s => {
                if (s && typeof s.sendRealtimeInput === 'function') {
                  try {
                    s.sendRealtimeInput({ 
                      media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } 
                    });
                  } catch (err: any) {
                    console.error("Error sending audio data:", err);
                  }
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
            setIsLive(true);
            setIsConnecting(false);
            setStatusMessage('Pep is listening...');
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Transcriptions
            if (msg.serverContent?.inputTranscription) {
              const transcription = msg.serverContent.inputTranscription as any;
              const text = transcription.text;
              
              if (text) {
                confirmedTranscriptRef.current += text;
                const currentFullText = confirmedTranscriptRef.current;

                if (onTranscriptChange) {
                  onTranscriptChange(currentFullText.trim());
                }
              }
            }
            
            // Handle Tool Calls
            if (msg.toolCall?.functionCalls && currentDrillRef.current && onUpdateDrillRef.current) {
              let updated = { ...currentDrillRef.current };
              for (const fc of msg.toolCall.functionCalls) {
                console.log("Pep Tool Call:", fc);
                if (fc.name === 'addPlayer') {
                  const { x, y, label } = fc.args as any;
                  updated.positions = [...updated.positions, { id: crypto.randomUUID(), x, y, label, type: PositionType.PLAYER, color: '#2563eb' }];
                } else if (fc.name === 'addArrow') {
                  const { startX, startY, endX, endY, type } = fc.args as any;
                  updated.arrows = [...updated.arrows, { id: crypto.randomUUID(), start: { x: startX, y: startY }, end: { x: endX, y: endY }, type: type as ArrowType }];
                } else if (fc.name === 'clearPitch') {
                  updated.positions = [];
                  updated.arrows = [];
                }
                sessionPromise.then(s => s.sendToolResponse({ 
                  functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok" } }] 
                }));
              }
              onUpdateDrillRef.current(updated);
            }

            // Handle Audio Out
            const audioBase64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioBase64) {
              nextStartTime = Math.max(nextStartTime, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioBase64), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outCtx.destination);
              source.start(nextStartTime);
              nextStartTime += buffer.duration;
              sources.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sources.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sources.clear();
              nextStartTime = 0;
            }
          },
          onclose: () => {
            setIsLive(false);
            setStatusMessage('');
            confirmedTranscriptRef.current = '';
            setIsEditing(false);
          },
          onerror: (e) => {
            console.error("Live Error", e);
            setIsLive(false);
            setIsConnecting(false);
            setStatusMessage('Connection Lost');
          }
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start Live session", err);
      setIsConnecting(false);
      setStatusMessage('Consultation Failed');
    }
  };

  const stopLiveSession = () => {
    setIsLive(false);

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    confirmedTranscriptRef.current = '';
    setIsEditing(false);
  };

  return (
    <div className="relative flex items-center gap-4">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          isLive ? stopLiveSession() : startLiveSession();
        }}
        disabled={isProcessing || isConnecting}
        type="button"
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 z-10 border-2 ${
          isLive 
            ? 'bg-red-500 text-white animate-pulse border-red-400 ring-4 ring-red-500/20' 
            : (isConnecting ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-100' : 'bg-white text-slate-400 border-slate-100 hover:border-emerald-500 hover:text-emerald-600')
        }`}
        title={isLive ? "Stop Consultation" : "Consult Pep (Voice)"}
      >
        {isLive ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
          </svg>
        ) : (
          <div className="relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z" />
            </svg>
            {isConnecting && (
              <div className="absolute inset-0 animate-spin border-2 border-emerald-500 rounded-full border-t-transparent"></div>
            )}
          </div>
        )}
      </button>
    </div>
  );
};

export default VoiceAssistant;
