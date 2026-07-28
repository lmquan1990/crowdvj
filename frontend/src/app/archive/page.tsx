"use client";

import React, { useEffect, useState } from "react";

interface SceneMetadata {
  metadata?: {
    run_id: string;
    manifest_hash: string;
  };
  provenance?: {
    prompt: string;
    timestamp: string;
    provider: string;
    model: string;
    latency: number;
    hashes: Record<string, string>;
  };
}

export default function ArchivePage() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedScene, setSelectedScene] = useState<string>("");
  const [sceneData, setSceneData] = useState<SceneMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/archive`);
        const data = await res.json();
        setSessions(data.sessions || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load sessions.");
      }
    };

    fetchSessions();
  }, [backendUrl]);

  const loadScene = async (sceneId: string) => {
    setSelectedScene(sceneId);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${backendUrl}/api/archive/${sceneId}`);
      if (!res.ok) throw new Error("Scene not found");
      const data = await res.json();
      setSceneData(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load scene data.");
      setSceneData(null);
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract winner and candidate URLs from hashes dict
  const getAssetUrls = () => {
    if (!sceneData?.provenance?.hashes) return { winner: null, candidates: [] };
    const urls = Object.keys(sceneData.provenance.hashes);
    const winnerKey = urls.find(k => k.includes("winner."));
    const candidateKeys = urls.filter(k => k.includes("cand_"));
    
    // In production, you would construct the actual B2 URL.
    // Assuming keys are relative paths from B2 CDN root.
    const baseUrl = process.env.NEXT_PUBLIC_B2_CDN_URL || "https://f004.backblazeb2.com/file/my-crowdvj-bucket";
    
    return {
      winner: winnerKey ? `${baseUrl}/${winnerKey}` : null,
      candidates: candidateKeys.map(k => `${baseUrl}/${k}`)
    };
  };

  const { winner, candidates } = getAssetUrls();

  return (
    <div className="bg-black text-neutral-200 min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="border-b border-white/10 pb-6 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Archive</h1>
          <p className="text-neutral-400 text-sm">
            Review past generative sessions, prompts, and provenance hashes.
          </p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <h2 className="text-sm font-medium text-white mb-4 uppercase tracking-widest px-2">Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-neutral-500 text-sm italic px-2">No sessions found.</p>
            ) : (
              <ul className="space-y-1">
                {sessions.map(s => (
                  <li key={s}>
                    <button 
                      onClick={() => loadScene(s)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedScene === s ? "bg-white/[0.08] text-white font-medium" : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                      }`}
                    >
                      {s.split('-').slice(0, 3).join('-')} {/* short display name if it's a long UUID */}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-6">{error}</div>}
            
            {loading ? (
              <div className="flex justify-center items-center h-64 border border-white/10 rounded-xl bg-[#0A0A0A]">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-white rounded-full"></div>
                  <span className="text-sm text-neutral-400">Loading scene...</span>
                </div>
              </div>
            ) : !sceneData ? (
              <div className="flex h-64 items-center justify-center text-neutral-500 border border-white/10 rounded-xl bg-[#0A0A0A] border-dashed">
                Select a session from the sidebar to view details.
              </div>
            ) : (
              <div className="space-y-8">
                
                {/* Details Section */}
                <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
                  <div className="p-5 border-b border-white/10 bg-white/[0.02]">
                    <h2 className="text-sm font-medium text-white">Scene Details</h2>
                  </div>
                  <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="col-span-2 lg:col-span-4 mb-2">
                      <p className="text-xs text-neutral-500 mb-1">Prompt</p>
                      <p className="text-sm text-neutral-200">{sceneData.provenance?.prompt || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Provider</p>
                      <p className="text-sm text-neutral-200 font-medium">{sceneData.provenance?.provider}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Model</p>
                      <p className="text-sm text-neutral-200 font-medium">{sceneData.provenance?.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Latency</p>
                      <p className="text-sm text-neutral-200">{sceneData.provenance?.latency?.toFixed(2)}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Timestamp</p>
                      <p className="text-sm text-neutral-200">{sceneData.provenance?.timestamp ? new Date(sceneData.provenance.timestamp).toLocaleString() : "N/A"}</p>
                    </div>
                  </div>
                </section>

                {/* Hashes Section */}
                <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                    <h3 className="text-sm font-medium text-white">Provenance Hashes (SHA-256)</h3>
                  </div>
                  <div className="p-5 bg-black font-mono text-[11px] leading-relaxed text-neutral-300 overflow-x-auto">
                    {sceneData.provenance?.hashes ? Object.entries(sceneData.provenance.hashes).map(([key, hash]) => (
                      <div key={key} className="mb-2 whitespace-nowrap flex gap-4">
                        <span className="text-neutral-500 min-w-[120px]">{key.split('/').pop()}:</span>
                        <span className="text-emerald-400/90">{hash}</span>
                      </div>
                    )) : (
                      <span className="text-neutral-600">No hashes available.</span>
                    )}
                  </div>
                </section>

                {/* Media Section */}
                {winner && (
                  <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                      <h3 className="text-sm font-medium text-white">Winner Artifact</h3>
                    </div>
                    <div className="p-5">
                      <div className="relative rounded-lg overflow-hidden border border-white/10 group bg-black max-w-2xl mx-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={winner} alt="Winner" className="w-full h-auto object-contain" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                          <a 
                            href={winner} 
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-white text-black hover:bg-neutral-200 rounded-md font-medium text-sm transition-colors shadow-sm"
                          >
                            Open Original
                          </a>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {candidates.length > 0 && (
                  <section className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                      <h3 className="text-sm font-medium text-white">Alternative Candidates</h3>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {candidates.map((cand, idx) => (
                          <div key={idx} className="relative rounded-lg overflow-hidden border border-white/10 group bg-black aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cand} alt={`Candidate ${idx}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                              <a 
                                href={cand} 
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-md text-xs font-medium text-white transition-colors border border-white/10 shadow-sm"
                              >
                                View
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
                
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
