"use client";

import React, { useRef, useMemo, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import * as Tone from "tone";

function Particles({ analyzer }: { analyzer: Tone.Analyser | null }) {
  const count = 1000;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -50 + Math.random() * 100;
      const yFactor = -50 + Math.random() * 100;
      const zFactor = -50 + Math.random() * 100;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, [count]);

  useFrame(() => {
    if (!mesh.current) return;
    
    let scaleMultiplier = 1;
    if (analyzer) {
      const values = analyzer.getValue();
      if (values instanceof Float32Array) {
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
          sum += Math.abs(values[i]);
        }
        scaleMultiplier = 1 + (sum / values.length) * 5;
      }
    }

    particles.forEach((particle, i) => {
      let { t } = particle;
      const { factor, speed, xFactor, yFactor, zFactor } = particle;
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);
      
      dummy.position.set(
        (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      );
      dummy.scale.set(s * scaleMultiplier, s * scaleMultiplier, s * scaleMultiplier);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshStandardMaterial color="#88aaff" />
    </instancedMesh>
  );
}

function DynamicBackground({ imageUrl }: { imageUrl: string | null }) {
  const [textureA, setTextureA] = useState<THREE.Texture | null>(null);
  const [textureB, setTextureB] = useState<THREE.Texture | null>(null);
  const [fade, setFade] = useState(0); // 0 = A, 1 = B
  const [activeLayer, setActiveLayer] = useState<'A'|'B'>('A');

  useEffect(() => {
    if (!imageUrl) return;
    
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (newTexture) => {
      newTexture.colorSpace = THREE.SRGBColorSpace;
      
      if (activeLayer === 'A') {
        // Load into B, fade to B
        setTextureB(newTexture);
        setActiveLayer('B');
      } else {
        // Load into A, fade to A
        setTextureA(newTexture);
        setActiveLayer('A');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]); // activeLayer omitted intentionally to capture current state at render

  useFrame((state, delta) => {
    // Animate fade
    const fadeSpeed = 0.5; // 2 seconds to crossfade
    if (activeLayer === 'B' && fade < 1) {
      const newFade = Math.min(1, fade + delta * fadeSpeed);
      setFade(newFade);
      if (newFade === 1 && textureA) {
        textureA.dispose();
        setTextureA(null);
      }
    } else if (activeLayer === 'A' && fade > 0) {
      const newFade = Math.max(0, fade - delta * fadeSpeed);
      setFade(newFade);
      if (newFade === 0 && textureB) {
        textureB.dispose();
        setTextureB(null);
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (textureA) textureA.dispose();
      if (textureB) textureB.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on unmount

  return (
    <group position={[0, 0, -50]}>
      {/* Plane A */}
      <mesh>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial 
          map={textureA} 
          transparent={true} 
          opacity={1 - fade} 
          depthWrite={false}
          color={textureA ? "#ffffff" : "#111122"}
        />
      </mesh>
      
      {/* Plane B */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial 
          map={textureB} 
          transparent={true} 
          opacity={fade} 
          depthWrite={false}
          color={textureB ? "#ffffff" : "#111122"}
        />
      </mesh>
    </group>
  );
}

export default function RenderPage() {
  const [started, setStarted] = useState(false);
  const [analyzer, setAnalyzer] = useState<Tone.Analyser | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    
    const connect = () => {
      ws = new WebSocket(process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000/ws");
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "scene_created") {
            setCurrentImage(msg.data.imageUrl);
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      ws.onclose = () => {
        // Reconnect logic
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  const startAudio = async () => {
    await Tone.start();
    const newAnalyzer = new Tone.Analyser("waveform", 256);
    
    try {
      const mic = new Tone.UserMedia();
      await mic.open();
      mic.connect(newAnalyzer);
    } catch (e) {
      console.warn("Microphone access denied or not available, using fallback oscillator", e);
      const osc = new Tone.Oscillator(440, "sine").start();
      const lfo = new Tone.LFO(0.5, 200, 800).start();
      lfo.connect(osc.frequency);
      osc.connect(newAnalyzer);
    }
    
    setAnalyzer(newAnalyzer);
    setStarted(true);
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative no-scrollbar" style={{ backgroundColor: "transparent" }}>
      {!started && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <button 
            onClick={startAudio}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl font-bold cursor-pointer"
          >
            Start Visualizer (Requires Audio)
          </button>
        </div>
      )}
      
      <Canvas camera={{ position: [0, 5, 20], fov: 60 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <Suspense fallback={null}>
          <DynamicBackground imageUrl={currentImage} />
        </Suspense>
        
        <Particles analyzer={analyzer} />
        
        <Grid 
          renderOrder={-1} 
          position={[0, -5, 0]} 
          infiniteGrid 
          fadeDistance={50} 
          fadeStrength={5} 
          cellColor="#555" 
          sectionColor="#888" 
        />
        <OrbitControls autoRotate autoRotateSpeed={0.5} enablePan={false} />
      </Canvas>
    </div>
  );
}
