"use client";

import React, { useState, useEffect, useRef } from "react";

export default function ControlPage() {
  const [wsStatus, setWsStatus] = useState("Disconnected");
  const [logs, setLogs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    const wsUrl = backendUrl.replace("http", "ws") + "/ws";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("Connected");
      addLog("WebSocket Connected");
    };

    ws.onmessage = (event) => {
      addLog(`Received: ${event.data}`);
      try {
        const data = JSON.parse(event.data);
        if (data.type === "scene_created") {
          setCurrentImage(data.data.imageUrl);
          setIsGenerating(false);
          addLog("Scene generation complete!");
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setWsStatus("Disconnected");
      addLog("WebSocket Disconnected");
    };

    ws.onerror = () => {
      setWsStatus("Error");
      addLog("WebSocket Error");
    };

    return () => {
      ws.close();
    };
  }, [backendUrl]);

  const addLog = (message: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev].slice(0, 50));
  };

  const handleGenerate = async (customPrompt?: string) => {
    const p = customPrompt || prompt;
    if (!p.trim()) return;
    
    addLog(`Requesting generation for: "${p}"`);
    setIsGenerating(true);
    
    try {
      const res = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p })
      });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
    } catch (err) {
      addLog(`Error during generation: ${err}`);
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
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>
            </section>

            {/* Debug Log */}
            <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden flex flex-col h-64">
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
                <h2 className="text-sm font-medium text-white">Debug Log</h2>
                <span className="text-xs text-neutral-600 font-mono">runtime</span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-neutral-400 bg-black p-4">
                {logs.length === 0 ? (
                  <span className="opacity-50">No logs yet...</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="break-all border-b border-white/5 pb-1 mb-1 last:border-0">{log}</div>
                  ))
                )}
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
              <div className="flex-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] bg-black flex items-center justify-center relative p-4">
                
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentImage} alt="Latest generated" className="w-full h-full object-contain rounded-lg shadow-2xl z-10 border border-white/5 bg-black" />
                ) : (
                  <div className="text-center z-10 max-w-sm">
                    <div className="w-12 h-12 rounded-full border border-white/10 bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-400">No output generated yet.</p>
                  </div>
                )}
                
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm transition-all">
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
