import React, { useEffect, useState } from 'react';
import { useLiveAssistant } from './hooks/useLiveAssistant';
import Visualizer from './components/Visualizer';
import { ConnectionState } from './types';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 1.5a3 3 0 013 3v1.5a3 3 0 01-6 0v-1.5a3 3 0 013-3z" />
  </svg>
);

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

export default function App() {
  const {
    connect,
    disconnect,
    connectionState,
    error,
    isMuted,
    toggleMute,
    inputAnalyser,
    outputAnalyser
  } = useLiveAssistant();

  const [hasStarted, setHasStarted] = useState(false);

  const handleStart = () => {
    setHasStarted(true);
    connect();
  };

  const handleStop = () => {
    disconnect();
    setHasStarted(false);
  };

  // Status message based on state
  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.DISCONNECTED: return "Ready to Connect";
      case ConnectionState.CONNECTING: return "Connecting...";
      case ConnectionState.CONNECTED: return "Listening";
      case ConnectionState.ERROR: return "Connection Failed";
      default: return "";
    }
  };

  // Color coding for status
  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED: return "text-emerald-400";
      case ConnectionState.CONNECTING: return "text-yellow-400";
      case ConnectionState.ERROR: return "text-red-400";
      default: return "text-slate-400";
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-50 overflow-hidden relative">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
             <span className="font-bold text-xs">AI</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Gemini Live</h1>
        </div>
        <div className={`text-sm font-medium ${getStatusColor()} transition-colors duration-300`}>
          {getStatusText()}
        </div>
      </header>

      {/* Main Visualizer Area */}
      <main className="flex-1 relative flex items-center justify-center">
        {/* Background ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl opacity-50 animate-pulse"></div>
        </div>

        {/* The Visualizer Canvas */}
        <div className="w-full max-w-2xl h-[400px] z-0">
          <Visualizer 
            inputAnalyser={inputAnalyser} 
            outputAnalyser={outputAnalyser} 
            isActive={connectionState === ConnectionState.CONNECTED}
          />
        </div>

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-24 px-4 py-2 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-sm max-w-md mx-4 backdrop-blur-sm">
            {error}
          </div>
        )}
      </main>

      {/* Controls */}
      <footer className="p-8 pb-12 flex justify-center items-center gap-6 z-10">
        {!hasStarted || connectionState === ConnectionState.DISCONNECTED ? (
          <button
            onClick={handleStart}
            className="group relative flex items-center justify-center px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all duration-300 shadow-lg hover:shadow-indigo-500/30"
          >
            <PlayIcon />
            <span className="ml-2 font-semibold">Start Conversation</span>
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all duration-200 ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>

            <button
              onClick={handleStop}
              className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold transition-all duration-300 shadow-lg hover:shadow-red-500/30 flex items-center gap-2"
            >
              <StopIcon />
              <span>End Session</span>
            </button>
          </>
        )}
      </footer>
    </div>
  );
}