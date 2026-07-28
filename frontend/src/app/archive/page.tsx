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
    <div className="min-h-screen bg-gray-950 text-gray-200 p-8">
      <h1 className="text-3xl font-bold mb-8 text-blue-400">Archive</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-500 italic">No sessions found.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map(s => (
                <li key={s}>
                  <button 
                    onClick={() => {
                      // Note: For hackathon, assuming session name is same as sceneId for simple testing, 
                      // or just pass session ID if API supports listing scenes per session.
                      // The prompt asks for `/api/archive/{sceneId}` so we might just use the string.
                      loadScene(s); 
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      selectedScene === s ? "bg-blue-600 text-white" : "hover:bg-gray-800"
                    }`}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 bg-gray-900 p-6 rounded-xl border border-gray-800">
          {error && <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 mb-4">{error}</div>}
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : !sceneData ? (
            <div className="flex h-64 items-center justify-center text-gray-500">
              Select a session/scene to view details.
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Scene Details</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Prompt</p>
                  <p className="font-medium">{sceneData.provenance?.prompt || "N/A"}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Provider & Model</p>
                  <p className="font-medium">{sceneData.provenance?.provider} - {sceneData.provenance?.model}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Latency</p>
                  <p className="font-medium">{sceneData.provenance?.latency?.toFixed(2)}s</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Timestamp</p>
                  <p className="font-medium">{sceneData.provenance?.timestamp ? new Date(sceneData.provenance.timestamp).toLocaleString() : "N/A"}</p>
                </div>
              </div>

              {winner && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Winner Image</h3>
                  <div className="relative rounded-lg overflow-hidden border border-gray-700 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={winner} alt="Winner" className="w-full h-auto object-cover" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={winner} 
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-white transition-colors"
                      >
                        Download from B2
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {candidates.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Candidates</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {candidates.map((cand, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-700 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cand} alt={`Candidate ${idx}`} className="w-full h-auto object-cover" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={cand} 
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white transition-colors"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Provenance Hashes (SHA-256)</h3>
                <div className="bg-gray-950 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-gray-800 text-green-400">
                  {sceneData.provenance?.hashes && Object.entries(sceneData.provenance.hashes).map(([key, hash]) => (
                    <div key={key} className="mb-2 whitespace-nowrap">
                      <span className="text-gray-500 mr-4">{key.split('/').pop()}:</span>
                      {hash}
                    </div>
                  ))}
                  {!sceneData.provenance?.hashes && <span className="text-gray-500">No hashes available.</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
