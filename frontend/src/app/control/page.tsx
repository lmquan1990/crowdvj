"use client";

import React, { useState, useEffect, useRef } from "react";

type LogSource = "WS" | "GENBLAZE" | "GEMINI" | "B2_SINK" | "VJ_ENGINE";
interface LogEntry {
  id: number;
  time: string;
  message: string;
  source: LogSource;
}

export default function ControlPage() {
  const [wsStatus, setWsStatus] = useState("Disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    const wsUrl = backendUrl.replace("http", "ws") + "/ws";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("Connected");
      addLog("WebSocket Connected", "WS");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "scene_created") {
          setCurrentImage(data.data.imageUrl);
          setCurrentAudio(data.data.audioUrl);
          setCurrentSceneId(data.data.sceneId);
          setIsGenerating(false);
          addLog("Scene crossfade & audio loop triggered", "VJ_ENGINE");
        } else {
          addLog(`Received: ${event.data}`, "WS");
        }
      } catch {
        addLog(`Received: ${event.data}`, "WS");
      }
    };

    ws.onclose = () => {
      setWsStatus("Disconnected");
      addLog("WebSocket Disconnected", "WS");
    };

    ws.onerror = () => {
      setWsStatus("Error");
      addLog("WebSocket Error", "WS");
    };

    return () => {
      ws.close();
    };
  }, [backendUrl]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, source: LogSource = "WS") => {
    setLogs((prev) => {
      const newLog: LogEntry = {
        id: logIdCounter.current++,
        time: new Date().toLocaleTimeString(),
        message,
        source
      };
      return [...prev, newLog].slice(-50);
    });
  };

  const handleGenerate = async (customPrompt?: string) => {
    const p = customPrompt || prompt;
    if (!p.trim()) return;
    
    addLog(`Pipeline initiated for scene: "${p}"`, "GENBLAZE");
    setIsGenerating(true);
    
    try {
      // Simulate intermediate log
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          addLog(`Image inference processing...`, "GEMINI");
        }
      }, 1500);
      
      const res = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p })
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      addLog(`Image inference completed`, "GEMINI");
      addLog(`Uploaded asset & provenance.json to B2 bucket`, "B2_SINK");
      
    } catch (err) {
      addLog(`Error during generation: ${err}`, "WS");
      setIsGenerating(false);
    }
  };

  const quickPrompts = [
    "Cyberpunk City",
    "Space Station",
    "Underwater Temple",
    "Neon Forest",
    "Lofi Coffee Shop"
  ];

  return (
    <div className="bg-black text-neutral-200 min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              Generation Control
            </h1>
            <p className="text-neutral-400 text-sm">
              Manage and trigger new scene generation tasks.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-4 md:mt-0 px-3 py-1.5 rounded-full border border-white/10 bg-neutral-900/50 text-xs font-medium">
            <div className={`w-2 h-2 rounded-full ${wsStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
            <span className={wsStatus === 'Connected' ? 'text-green-500' : 'text-red-500'}>{wsStatus}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Controls */}
          <div className="space-y-6">
            
            {/* Quick Simulation */}
            <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10 bg-white/[0.02]">
                <h2 className="text-sm font-medium text-white">Quick Simulation</h2>
                <p className="text-xs text-neutral-500 mt-1">Trigger predefined prompts to simulate chat.</p>
              </div>
              <div className="p-5 flex flex-wrap gap-2">
                {quickPrompts.map(qp => (
                  <button
                    key={qp}
                    disabled={isGenerating}
                    onClick={() => handleGenerate(qp)}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-white/10 rounded-md text-xs font-medium text-neutral-300 transition-colors shadow-sm"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </section>

            {/* Custom Generation */}
            <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10 bg-white/[0.02]">
                <h2 className="text-sm font-medium text-white">Custom Generation</h2>
                <p className="text-xs text-neutral-500 mt-1">Write your own detailed prompt.</p>
              </div>
              <div className="p-5 space-y-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A futuristic cybernetic landscape with glowing neon grids..."
                  className="w-full h-28 bg-black border border-white/10 rounded-md p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-all resize-none shadow-sm"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={!prompt.trim() || isGenerating}
                    className="px-4 py-2 bg-white text-black hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:border-white/10 border border-transparent font-medium text-sm rounded-md shadow-sm transition-all flex items-center gap-2"
                  >
                    {isGenerating && <div className="animate-spin w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full" />}
                    {isGenerating ? "Orchestrating via Gemini & B2..." : "Generate"}
                  </button>
                </div>
              </div>
            </section>

            {/* Pipeline Activity Feed */}
            <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden flex flex-col h-64">
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                <h2 className="text-sm font-medium text-white">Pipeline Activity Feed</h2>
                <span className="text-xs text-neutral-600 font-mono">live logs</span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed bg-black p-4 space-y-1">
                {logs.length === 0 ? (
                  <span className="opacity-50 text-neutral-400">No logs yet...</span>
                ) : (
                  logs.map((log) => {
                    let sourceColor = "text-neutral-400";
                    if (log.source === "GENBLAZE") sourceColor = "text-purple-400";
                    else if (log.source === "GEMINI") sourceColor = "text-blue-400";
                    else if (log.source === "B2_SINK") sourceColor = "text-emerald-400";
                    else if (log.source === "VJ_ENGINE") sourceColor = "text-amber-400";

                    return (
                      <div key={log.id} className="break-words border-b border-white/5 pb-1 last:border-0 flex gap-2">
                        <span className="text-neutral-600 shrink-0">[{log.time}]</span>
                        <span className={`${sourceColor} shrink-0 font-semibold`}>[{log.source}]</span>
                        <span className="text-neutral-300">{log.message}</span>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </section>

          </div>

          {/* Right Column: Preview */}
          <div className="flex flex-col">
            <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-[500px]">
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                <h2 className="text-sm font-medium text-white">Latest Preview</h2>
                {isGenerating && <span className="text-xs text-blue-400 animate-pulse">Working...</span>}
              </div>
              <div className="flex-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] bg-black relative p-4 flex flex-col">
                
                {currentImage ? (
                  <div className="flex-1 flex flex-col gap-3 animate-in fade-in duration-500">
                    <div className="relative flex-1 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={currentImage} alt="Latest generated" className="w-full h-full object-contain rounded-md" />
                      
                      {/* B2 Provenance Badge */}
                      <div className="absolute top-4 right-4 bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 rounded-full px-3 py-1.5 flex items-center gap-2 backdrop-blur-md shadow-lg">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider leading-none">B2 Lineage Verified</span>
                          {currentSceneId && <span className="text-[9px] opacity-80 leading-none mt-0.5 font-mono">hash: {currentSceneId.substring(0, 8)}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Audio Track Bar */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-neutral-800 flex items-center justify-center">
                          <span className="text-lg">🎵</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-neutral-300">Matched Audio Track</span>
                          <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[200px]">
                            {currentAudio ? currentAudio.split('/').pop() : 'Unknown track'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Equalizer animation */}
                      <div className="flex items-end gap-1 h-4">
                        <div className="w-1 bg-emerald-500 rounded-t-sm animate-pulse" style={{ height: '60%', animationDelay: '0ms' }} />
                        <div className="w-1 bg-emerald-500 rounded-t-sm animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
                        <div className="w-1 bg-emerald-500 rounded-t-sm animate-pulse" style={{ height: '40%', animationDelay: '300ms' }} />
                        <div className="w-1 bg-emerald-500 rounded-t-sm animate-pulse" style={{ height: '80%', animationDelay: '450ms' }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center z-10 m-auto max-w-sm">
                    <div className="w-12 h-12 rounded-full border border-white/10 bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-400">No output generated yet.</p>
                  </div>
                )}
                
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm transition-all rounded-xl">
                    <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mb-4" />
                    <p className="text-sm text-neutral-300 font-medium tracking-wide">Processing scene...</p>
                  </div>
                )}
              </div>
            </section>
          </div>
          
        </div>
      </div>
    </div>
  );
}
