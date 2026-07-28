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
    <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans overflow-y-auto">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Controls */}
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              CrowdVJ Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
              <div className={`w-3 h-3 rounded-full ${wsStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Status: {wsStatus}</span>
            </div>
          </header>

          {/* Quick Simulation */}
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-neutral-200">Simulate Live Chat</h2>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map(qp => (
                <button
                  key={qp}
                  disabled={isGenerating}
                  onClick={() => handleGenerate(qp)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 border border-neutral-600 rounded-lg text-sm font-medium transition-colors"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Generation */}
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-neutral-200">Custom Generation</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A futuristic cybernetic landscape with glowing neon grids..."
                  className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                />
              </div>
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || isGenerating}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all active:scale-[0.98] flex justify-center items-center gap-2"
              >
                {isGenerating && <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>

          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-lg flex flex-col h-64">
            <h2 className="text-xl font-semibold mb-4 text-neutral-200 flex-shrink-0">Debug Log</h2>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-neutral-400 space-y-1 bg-neutral-900 p-3 rounded border border-neutral-800">
              {logs.length === 0 ? (
                <span className="opacity-50">No logs yet...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="break-all border-b border-neutral-800 pb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-lg flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-neutral-200">Latest Preview</h2>
          <div className="flex-1 bg-neutral-900 rounded-lg border border-neutral-700 flex items-center justify-center relative overflow-hidden min-h-[400px]">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 opacity-50" />
            
            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentImage} alt="Latest generated" className="w-full h-full object-contain z-10" />
            ) : (
              <div className="text-center z-10 p-6">
                <svg className="w-16 h-16 mx-auto text-neutral-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-neutral-500 font-medium">Waiting for generated visual...</p>
              </div>
            )}
            
            {isGenerating && (
              <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full" />
                  <p className="text-white font-medium shadow-sm">Generating new scene...</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
