import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';

export const useLiveAssistant = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // Audio Nodes
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  
  // State for playback
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // API Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentSessionRef = useRef<any>(null); // To track active session for cleanup

  const disconnect = useCallback(async () => {
    if (currentSessionRef.current) {
      try {
        currentSessionRef.current.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
      currentSessionRef.current = null;
    }

    sessionPromiseRef.current = null;

    // Stop all playing audio
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) { /* ignore */ }
    });
    audioSourcesRef.current.clear();
    
    // Stop microphone stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio contexts
    if (inputAudioContextRef.current) {
      try {
        await inputAudioContextRef.current.close();
      } catch (e) { /* ignore */ }
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      try {
        await outputAudioContextRef.current.close();
      } catch (e) { /* ignore */ }
      outputAudioContextRef.current = null;
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    // Reset mute state
    setIsMuted(false);
  }, []);

  const connect = useCallback(async () => {
    if (!process.env.API_KEY) {
      setError("API Key not found in environment variables.");
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      // 1. Get Microphone Stream FIRST
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      mediaStreamRef.current = stream;

      // 2. Initialize Audio Contexts
      // Input: 16kHz for Gemini
      // Output: 24kHz for Gemini
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Setup Analysers
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;

      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyserRef.current = outputAnalyser;
      
      // Output Gain
      const outputGain = outputCtx.createGain();
      outputGain.connect(outputCtx.destination);
      outputGain.connect(outputAnalyser);

      // 3. Connect Stream
      const source = inputCtx.createMediaStreamSource(stream);
      
      // Input Gain
      const inputGain = inputCtx.createGain();
      inputGainRef.current = inputGain;
      source.connect(inputGain);
      inputGain.connect(inputAnalyser);

      // Script Processor
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      inputGain.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      // 4. Initialize Gemini Client
      // Use trim() on API key to remove accidental whitespace
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY.trim() });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: "You are a helpful, witty, and concise AI assistant. You are talking to the user via voice. Keep responses relatively short and conversational.",
        },
      };

      const sessionPromise = ai.live.connect({
        model: config.model,
        config: config.config,
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            setConnectionState(ConnectionState.CONNECTED);
            
            // Start sending audio
            scriptProcessor.onaudioprocess = (e) => {
              if (inputGainRef.current && inputGainRef.current.gain.value === 0) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch (err) {
                    console.error("Error sending input:", err);
                  }
                });
              }
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                base64ToBytes(base64Audio),
                ctx,
                24000,
                1
              );

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(outputGain);
              
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              audioSourcesRef.current.add(sourceNode);
              sourceNode.onended = () => {
                audioSourcesRef.current.delete(sourceNode);
              };
            }

            if (message.serverContent?.interrupted) {
              console.log("Model interrupted");
              audioSourcesRef.current.forEach(s => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: (e) => {
            console.log("Session closed", e);
            if (connectionState === ConnectionState.CONNECTED) {
               disconnect();
            }
          },
          onerror: (e) => {
            console.error("Session error", e);
            // Try to extract useful message, otherwise generic
            const msg = (e as any).message || "Connection error";
            if (msg.toLowerCase().includes("network")) {
              setError("Network Error: Could not connect to Gemini Live. Check your API Key and internet connection.");
            } else {
              setError(`Session Error: ${msg}`);
            }
            disconnect();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(session => {
        currentSessionRef.current = session;
      });

    } catch (err: any) {
      console.error("Connection failed:", err);
      let errorMessage = err.message || "Failed to connect to microphone or API.";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Microphone access denied. Please allow microphone permissions in your browser.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = "No microphone found. Please connect a microphone.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = "Microphone is busy or not readable. Try closing other apps using the mic.";
      }

      setError(errorMessage);
      setConnectionState(ConnectionState.ERROR);
      disconnect();
    }
  }, [connectionState, disconnect]);

  const toggleMute = useCallback(() => {
    if (inputGainRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      inputGainRef.current.gain.value = newMuteState ? 0 : 1;
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    connectionState,
    error,
    isMuted,
    toggleMute,
    inputAnalyser: inputAnalyserRef.current,
    outputAnalyser: outputAnalyserRef.current
  };
};