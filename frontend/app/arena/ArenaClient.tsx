'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { KeyboardControls, useGLTF, PerformanceMonitor, AdaptiveEvents, AdaptiveDpr } from "@react-three/drei";
import { useWebSocketGame, PlayerNetworkState, MonsterNetworkState, GameStatePayload } from "@/src/hooks/useWebSocketGame";
import { PlayerController, keyboardMap } from "@/src/components/game/PlayerController";
import { RemotePlayersRenderer } from "@/src/components/game/RemotePlayersRenderer";
import { RemoteMonstersRenderer } from "@/src/components/game/RemoteMonstersRenderer";
import { Minimap } from "@/src/components/game/Minimap";
import { EnvironmentMultiGlobal } from "@/src/components/game/environment/EnvironmentMultiGlobal";
import { ModularMap } from "@/src/components/game/environment/ModularMap";
import { Sword, Shield, User, Key, Users, RefreshCw, Trophy, Zap, Sparkles, LogOut, Skull, Target, Activity, X } from "lucide-react";
import * as THREE from 'three';
import { useEditorStore } from "@/src/state/useEditorStore";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { battleGrid } from "@/src/core/logic/combat/spatialGrid";
import { UnitRuntimeData } from "@/src/core/domain/unit.types";
import { VFXProvider } from "@/src/components/game/systems/VFXManager";
import { DamageHUDBatcher } from "@/src/components/game/systems/DamageHUDBatcher";
import { MMSpellEffect } from "@/src/components/game/systems/effects/MMSpellEffect";
import { FighterSpellEffect } from "@/src/components/game/systems/effects/FighterSpellEffect";
import { TankSpellEffect } from "@/src/components/game/systems/effects/TankSpellEffect";
import { AssassinSpellEffect } from "@/src/components/game/systems/effects/AssassinSpellEffect";
import { MageSpellEffect } from "@/src/components/game/systems/effects/MageSpellEffect";
import { MeshoptDecoder } from 'meshoptimizer';
import { VFX_TEXTURES } from "@/src/components/game/systems/effects/VFXAssets";
import { CLASS_CONFIG, INITIAL_SETTINGS } from "@/src/core/logic/combat/constants";
import { API_BASE_URL, WS_BASE_URL } from "@/src/core/config";

// Extend THREE global prototype for spatial acceleration structures (BVH)
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export const CLASS_LABELS: Record<string, string> = {
  Beginner: "MM",
  Warrior: "Fighter",
  Mage: "Mage",
  Priest: "Tank",
  Thief: "Assassin"
};

const FPSCounterUpdater = () => {
  const lastTime = useRef(performance.now());
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (now >= lastTime.current + 1000) {
      const calculatedFps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fps-update', { detail: calculatedFps }));
      }
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
};

const FPSBadge = () => {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    const handler = (e: Event) => {
      setFps((e as CustomEvent).detail);
    };
    window.addEventListener('fps-update', handler);
    return () => window.removeEventListener('fps-update', handler);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${fps >= 55 ? "bg-emerald-400 animate-pulse" : fps >= 30 ? "bg-amber-400" : "bg-red-400"}`} />
      <span className={`text-[10px] font-black ${fps >= 55 ? "text-emerald-400" : fps >= 30 ? "text-amber-400" : "text-red-400"}`}>{fps} FPS</span>
    </div>
  );
};

// --- ExposureBridge: sync toneMappingExposure inside Canvas (mirrors World-Editor VisualTuningBridge) ---
const ExposureBridge = ({ exposure }: { exposure: number }) => {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);
  return null;
};

// --- Models Preloader using React Suspense & GLTFLoader Cache ---
const ModelsPreloader = ({ onReady }: { onReady: () => void }) => {
  const { gl, camera } = useThree();

  // Preload all character models
  const g1 = useGLTF(API_BASE_URL + '/assets-model/Chef_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g2 = useGLTF(API_BASE_URL + '/assets-model/Chef_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g3 = useGLTF(API_BASE_URL + '/assets-model/Knight_Golden_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g4 = useGLTF(API_BASE_URL + '/assets-model/Knight_Golden_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g5 = useGLTF(API_BASE_URL + '/assets-model/Wizard.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g6 = useGLTF(API_BASE_URL + '/assets-model/Witch.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g7 = useGLTF(API_BASE_URL + '/assets-model/Viking_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g8 = useGLTF(API_BASE_URL + '/assets-model/Viking_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g9 = useGLTF(API_BASE_URL + '/assets-model/Ninja_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g10 = useGLTF(API_BASE_URL + '/assets-model/Ninja_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g11 = useGLTF(API_BASE_URL + '/assets-model/Knight_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g12 = useGLTF(API_BASE_URL + '/assets-model/Cowboy_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));

  // Preload all monster models
  const g13 = useGLTF(API_BASE_URL + '/assets-model/Goblin_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g14 = useGLTF(API_BASE_URL + '/assets-model/Goblin_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g15 = useGLTF(API_BASE_URL + '/assets-model/Zombie_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g16 = useGLTF(API_BASE_URL + '/assets-model/Zombie_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));

  useEffect(() => {
    let active = true;

    const compileAll = async () => {
      console.log("🚀 Starting Asynchronous GPU Shader/Texture Compilation...");

      // Pre-upload all VFX textures to GPU to avoid stutter on first spell cast
      const texturesToInit: THREE.Texture[] = [];
      const collectTextures = (obj: any) => {
        if (obj instanceof THREE.Texture) {
          texturesToInit.push(obj);
        } else if (Array.isArray(obj)) {
          obj.forEach(collectTextures);
        } else if (obj && typeof obj === 'object') {
          Object.values(obj).forEach(collectTextures);
        }
      };
      collectTextures(VFX_TEXTURES);

      console.log(`Pre-uploading ${texturesToInit.length} VFX textures to GPU...`);
      texturesToInit.forEach(tex => {
        try {
          if (tex && (gl as any).initTexture) {
            (gl as any).initTexture(tex);
          }
        } catch (e) {
          console.warn("Failed to pre-upload texture to GPU:", e);
        }
      });

      const tempGroup = new THREE.Group();

      const gltfs = [g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16];
      gltfs.forEach((g: any) => {
        if (g && g.scene) {
          tempGroup.add(g.scene);
        }
      });

      try {
        if (typeof (gl as any).compileAsync === 'function') {
          await (gl as any).compileAsync(tempGroup, camera);
          console.log("✅ Asynchronous GPU compilation complete!");
        } else {
          gl.compile(tempGroup, camera);
          console.log("✅ Synchronous GPU compilation complete (fallback)!");
        }
      } catch (err) {
        console.warn("GPU compilation failed or timed out:", err);
      } finally {
        gltfs.forEach((g: any) => {
          if (g && g.scene) {
            tempGroup.remove(g.scene);
          }
        });

        if (active) {
          onReady();
        }
      }
    };

    compileAll();

    return () => {
      active = false;
    };
  }, [onReady, gl, camera, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16]);

  return null;
};

// --- Camera Director for Epic Endings & Shake ---
const CameraDirector = () => {
  return null;
};

// --- Performance & Diagnostics Monitor for R3F ---
function PerformanceDiagnostics({
  connectedPlayersRef,
  worldMonstersRef,
  selectedMapId,
  dpr,
  potatoMode
}: {
  connectedPlayersRef: React.RefObject<PlayerNetworkState[]>;
  worldMonstersRef: React.RefObject<MonsterNetworkState[]>;
  selectedMapId: string;
  dpr: number;
  potatoMode: boolean;
}) {
  const { gl } = useThree();
  const lastUpdate = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const lastFrameTime = useRef(performance.now());

  // Performance Logger Rolling Buffers
  const sessionStartTime = useRef(new Date());
  const frameHistory = useRef<any[]>([]);
  const lagSpikes = useRef<any[]>([]);
  const totalFrames = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ';') {
        e.preventDefault();

        const glContext = gl.getContext();
        const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
        const gpuVendor = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "Unknown Vendor";
        const gpuRenderer = debugInfo ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown Renderer";

        const mem = (performance as any).memory;
        const memoryInfo = mem ? {
          jsHeapSizeLimitMb: Math.round(mem.jsHeapSizeLimit / (1024 * 1024)),
          totalJSHeapSizeMb: Math.round(mem.totalJSHeapSize / (1024 * 1024)),
          usedJSHeapSizeMb: Math.round(mem.usedJSHeapSize / (1024 * 1024))
        } : {
          jsHeapSizeLimitMb: null,
          totalJSHeapSizeMb: null,
          usedJSHeapSizeMb: null
        };

        const deltas = frameHistory.current.map(h => h.d);
        if (deltas.length === 0) {
          alert("Mohon tunggu beberapa detik hingga data frame terisi sebelum mengunduh.");
          return;
        }

        const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const avgFps = Math.round(1000 / avgDelta) || 60;

        const sortedDeltas = deltas.slice().sort((a, b) => a - b);
        const p99 = sortedDeltas[Math.floor(sortedDeltas.length * 0.99)] || sortedDeltas[sortedDeltas.length - 1];
        const p999 = sortedDeltas[Math.floor(sortedDeltas.length * 0.999)] || sortedDeltas[sortedDeltas.length - 1];

        const maxDelta = sortedDeltas[sortedDeltas.length - 1] || 16.6;
        const minDelta = sortedDeltas[0] || 16.6;

        const report = {
          sessionInfo: {
            startTime: sessionStartTime.current.toISOString(),
            reportTime: new Date().toISOString(),
            activeMapId: selectedMapId,
            currentDpr: dpr,
            potatoModeActive: potatoMode
          },
          systemInfo: {
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            gpuVendor,
            gpuRenderer,
            webglVersion: glContext.getParameter(glContext.VERSION),
            supportedExtensionsCount: glContext.getSupportedExtensions()?.length || 0
          },
          memoryInfo,
          performanceSummary: {
            averageFps: avgFps,
            minFps: Math.round(1000 / maxDelta),
            maxFps: Math.round(1000 / minDelta),
            onePercentLowFps: Math.round(1000 / p99),
            zeroOnePercentLowFps: Math.round(1000 / p999),
            totalFramesTracked: totalFrames.current,
            totalLagSpikesCount: lagSpikes.current.length
          },
          lagSpikes: lagSpikes.current,
          rollingFrameHistory: frameHistory.current
        };

        const json = JSON.stringify(report, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mmorpg_perf_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`📊 [SEAL M MMORPG PERF REPORT]\n\nLaporan performa sukses diunduh!\n\n- Rata-rata FPS: ${avgFps}\n- 1% Low (Micro-Stutters): ${Math.round(1000 / p99)} FPS\n- Total Lag Spikes Terdeteksi: ${lagSpikes.current.length}\n- Active Entities: Players: ${connectedPlayersRef.current?.length || 0}, Monsters: ${worldMonstersRef.current?.length || 0}\n\nSilakan berikan file JSON tersebut kepada developer untuk analisis mendalam!`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gl, selectedMapId, dpr, potatoMode, connectedPlayersRef, worldMonstersRef]);

  useFrame(() => {
    const now = performance.now();
    const delta = now - lastFrameTime.current;
    lastFrameTime.current = now;

    totalFrames.current++;

    frameTimes.current.push(delta);
    if (frameTimes.current.length > 30) frameTimes.current.shift();

    const fps = Math.round(1000 / delta) || 60;
    const drawCalls = gl.info.render.calls;
    const triangles = gl.info.render.triangles;
    const geometries = gl.info.memory.geometries;
    const textures = gl.info.memory.textures;

    const playersCount = connectedPlayersRef.current?.length || 0;
    const monstersCount = worldMonstersRef.current?.length || 0;

    // Track rolling frame sample (up to 1000 frames)
    const mem = (performance as any).memory;
    const currentSample = {
      f: totalFrames.current,
      d: parseFloat(delta.toFixed(2)),
      fps: fps,
      dc: drawCalls,
      tr: triangles,
      p: playersCount,
      m: monstersCount,
      mem: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : undefined
    };

    frameHistory.current.push(currentSample);
    if (frameHistory.current.length > 50000) {
      frameHistory.current.shift();
    }

    // Detect lag spikes: frame time > 50ms = drops below 20 FPS — truly perceptible to the player.
    // Threshold raised from 33.33ms: frames between 33-50ms are borderline and inflate spike count
    // without corresponding player discomfort (sub-50ms is difficult to perceive at 60 FPS baseline).
    // Ignore first 60 frames (1 second of load time) to avoid initial loading spike false positives
    if (delta > 50 && totalFrames.current > 60) {
      lagSpikes.current.push({
        timestamp: parseFloat((Date.now() - sessionStartTime.current.getTime()).toFixed(0)),
        frameIndex: totalFrames.current,
        durationMs: parseFloat(delta.toFixed(2)),
        instantFps: fps,
        playersCount,
        monstersCount,
        drawCalls,
        triangles,
        memoryMb: mem ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : null
      });

      if (lagSpikes.current.length > 200) {
        lagSpikes.current.shift();
      }
    }

    if (now - lastUpdate.current < 500) return; // Update DOM every 500ms
    lastUpdate.current = now;

    const avgDelta = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
    const smoothedFps = Math.round(1000 / avgDelta) || 60;

    // Update DOM directly for zero React overhead
    const elFps = document.getElementById("diag-fps");
    const elDraw = document.getElementById("diag-draw");
    const elTri = document.getElementById("diag-tri");
    const elGeo = document.getElementById("diag-geo");
    const elTex = document.getElementById("diag-tex");
    const elMonsters = document.getElementById("diag-monsters");
    const elPlayers = document.getElementById("diag-players");
    const elStatus = document.getElementById("diag-status");

    if (elFps) {
      elFps.innerText = `${smoothedFps} FPS`;
      if (smoothedFps < 30) {
        elFps.className = "text-red-500 font-black animate-pulse";
      } else if (smoothedFps < 50) {
        elFps.className = "text-amber-500 font-black";
      } else {
        elFps.className = "text-emerald-400 font-black";
      }
    }
    if (elDraw) {
      elDraw.innerText = drawCalls.toString();
      elDraw.className = drawCalls > 350 ? "text-red-500 font-black" : (drawCalls > 180 ? "text-amber-500 font-black" : "text-emerald-400 font-black");
    }
    if (elTri) {
      const triK = Math.round(triangles / 1000);
      elTri.innerText = `${triK}K`;
      elTri.className = triangles > 300000 ? "text-red-500 font-black" : (triangles > 150000 ? "text-amber-500 font-black" : "text-emerald-400 font-black");
    }
    if (elGeo) elGeo.innerText = geometries.toString();
    if (elTex) elTex.innerText = textures.toString();
    if (elMonsters) elMonsters.innerText = monstersCount.toString();
    if (elPlayers) elPlayers.innerText = playersCount.toString();

    if (elStatus) {
      if (smoothedFps < 45) {
        if (drawCalls > 350) {
          elStatus.innerText = "CPU: DRAW CALLS TERLALU TINGGI";
          elStatus.className = "text-red-400 font-black uppercase text-[7px] tracking-wide animate-pulse";
        } else if (triangles > 400000) {
          elStatus.innerText = "GPU: POLIGON/TRI TERLALU BANYAK";
          elStatus.className = "text-red-400 font-black uppercase text-[7px] tracking-wide animate-pulse";
        } else if (monstersCount > 80) {
          elStatus.innerText = "JS: TERLALU BANYAK ENTITY AKTIF";
          elStatus.className = "text-amber-400 font-black uppercase text-[7px] tracking-wide";
        } else {
          elStatus.innerText = "PERFORMA TURUN (LOAD TINGGI)";
          elStatus.className = "text-amber-400 font-black uppercase text-[7px] tracking-wide";
        }
      } else {
        elStatus.innerText = "PERFORMA STABIL & SEHAT";
        elStatus.className = "text-emerald-400 font-black uppercase text-[7px] tracking-wide";
      }
    }
  });

  return null;
}

export default function MultiplayerArena() {
  const selectedMapId = useEditorStore(s => s.selectedMapId);
  const [envReady, setEnvReady] = useState(false);
  const [envFinished, setEnvFinished] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    if (!envReady) {
      setEnvFinished(false);
      setModelsReady(false);
    }
  }, [envReady]);

  useEffect(() => {
    if (envFinished && modelsReady) {
      setEnvReady(true);
    }
  }, [envFinished, modelsReady]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [characters, setCharacters] = useState<any[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);
  const [gameConfig, setGameConfig] = useState<any>(null);
  // DPR default 0.75: balances quality vs performance for low-spec laptops.
  // PerformanceMonitor will increase it dynamically if GPU can handle more.
  const [dpr, setDpr] = useState(0.75);
  
  // Customization & creation states
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [charName, setCharName] = useState("");
  const [charClass, setCharClass] = useState("Warrior");
  const [charGender, setCharGender] = useState("Male");
  const [charHairStyle, setCharHairStyle] = useState(1);
  const [charHairColor, setCharHairColor] = useState("#5A3E2D");

  const [playerStats, setPlayerStats] = useState<any>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showEnemyEditorModal, setShowEnemyEditorModal] = useState(false);
  const [monsterConfigs, setMonsterConfigs] = useState<any[]>([]);
  const [editingMonster, setEditingMonster] = useState<any>(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [aliveMonsterCount, setAliveMonsterCount] = useState(10);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{type: string; name?: string; msg: string}[]>([
    { type: "system", msg: "Selamat datang di Arena! Basmi monster di sekitarmu." },
    { type: "info", msg: "Tekan Q untuk skill, WASD bergerak, mouse untuk bidik." },
  ]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [showMiniActions, setShowMiniActions] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Pure mouse-drag looking system active (Pointer Lock removed as requested)

  // Local damage screenshake monitor
  const lastPlayerHp = useRef(0);
  const playerStatsRef = useRef({ hp: -1, maxHp: -1 });
  useEffect(() => {
    if (playerStats) {
      if (lastPlayerHp.current > 0 && playerStats.hp < lastPlayerHp.current) {
        // Player took damage! Trigger dynamic screenshake!
        (window as any).triggerCameraShake?.(0.35);
      }
      lastPlayerHp.current = playerStats.hp;
    }
  }, [playerStats]);
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [activeRemotePlayers, setActiveRemotePlayers] = useState<{ id: string; username: string; class: string; gender: string }[]>([]);
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const activeRemotePlayersRef = useRef<{ id: string; username: string; class: string; gender: string }[]>([]);
  const lastRosterUpdate = useRef(0);

  const connectedPlayersRef = useRef<PlayerNetworkState[]>([]);
  const worldMonstersRef = useRef<MonsterNetworkState[]>([]);
  
  const settingsRef = useRef({
    potatoMode: false,
    globalHpMultiplier: 1.0,
    globalDamageMultiplier: 1.0,
    globalSpeedMultiplier: 1.0,
    globalAttackCooldown: 250,
    critChance: 0.2,
    mouseSensitivity: 0.002,
    vfxQuality: 'HIGH',
  });
  const simTimeRef = useRef(0);
  const damageQueue = useRef<any[]>([]);
  const mmSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const spellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const fighterSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const tankSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const assassinSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const unitRegistryRef = useRef<UnitRuntimeData[]>([]);
  // Throttle expensive operations that don't need to run at full WS rate (20Hz)
  const lastBattleGridUpdate = useRef(0);
  const lastRemotePlayerHash = useRef("");

  // Load authoritative assets configuration and check active login session on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/initialize`);
        if (res.ok) {
          const data = await res.json();
          setGameConfig(data);
        }

        // Fetch dynamic class balance configs from PostgreSQL database
        const resClasses = await fetch(`${API_BASE_URL}/api/config/classes`);
        if (resClasses.ok) {
          const dataClasses = await resClasses.json();
          dataClasses.forEach((row: any) => {
            const classKey = row.id as keyof typeof CLASS_CONFIG;
            if (CLASS_CONFIG[classKey]) {
              CLASS_CONFIG[classKey] = {
                hp: row.hp,
                hp_regen: row.hp_regen,
                atk: row.atk,
                physical_defense: row.physical_defense,
                magic_defense: row.magic_defense,
                physical_pen: row.physical_pen,
                magic_pen: row.magic_pen,
                lifesteal: row.lifesteal,
                spell_vamp: row.spell_vamp,
                move_speed_mult: row.move_speed_mult,
                attack_speed_mult: row.attack_speed_mult,
                crit_chance: row.crit_chance,
                crit_damage: row.crit_damage,
                range: row.range,
                tenacity: row.tenacity,
                cooldown_reduction: row.cooldown_reduction,
                skill_cooldown: row.skill_cooldown,
                skill_range: row.skill_range,
                skill_duration: row.skill_duration,
                ai_behavior: {
                  separation: row.ai_separation,
                  encirclement: row.ai_encirclement,
                  swagger: row.ai_swagger,
                  perception_radius: row.ai_perception_radius,
                  chase_range: row.ai_chase_range,
                }
              };
            }
          });
          console.log("🎮 CLASS_CONFIG dynamically synced from database!", CLASS_CONFIG);
        }

        // Fetch map list on mount for active workspace switching
        try {
          await useEditorStore.getState().fetchMapList();
        } catch (e) {
          console.warn("Failed to fetch map list on mount:", e);
        }

        // Fetch dynamic global simulation settings from PostgreSQL database
        const resSettings = await fetch(`${API_BASE_URL}/api/config/settings`);
        if (resSettings.ok) {
          const dataSettings = await resSettings.json();
          Object.assign(INITIAL_SETTINGS, dataSettings);
          console.log("🎮 INITIAL_SETTINGS dynamically synced from database!", INITIAL_SETTINGS);
          if (dataSettings.activeMapId) {
            console.log(`🎮 Setting active map from database settings: ${dataSettings.activeMapId}`);
            if (useEditorStore.getState().selectedMapId !== dataSettings.activeMapId) {
              await useEditorStore.getState().setSelectedMapId(dataSettings.activeMapId);
            } else {
              await useEditorStore.getState().loadFromDatabase();
            }
          }
        }
      } catch (err) {
        console.error("Gagal memuat konfigurasi aset game dari backend", err);
      }
    };
    fetchConfig();

    // Recover login session from localStorage
    const savedToken = localStorage.getItem("game_auth_token");
    if (savedToken) {
      setIsRecoveringSession(true);
      setToken(savedToken);
      setSuccessMsg("Mengembalikan sesi login aktif...");
    }
  }, []);

  // Fetch characters when token changes
  useEffect(() => {
    if (!token) {
      setIsRecoveringSession(false);
      return;
    }
    
    const fetchCharacters = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/player/characters`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const charList = data.characters || [];
          setCharacters(charList);
          
          if (charList.length === 0) {
            setIsCreatingChar(true);
            setIsRecoveringSession(false);
          } else {
            setIsCreatingChar(false);
            
            // Auto-select last active character if it matches
            const savedCharId = localStorage.getItem("game_active_char_id");
            if (savedCharId) {
              const matchedChar = charList.find((c: any) => c.id === savedCharId);
              if (matchedChar) {
                // Smooth transition: small delay so users feel the luxury load screen
                setTimeout(() => {
                  setEnvReady(false);
                  setSelectedCharacter(matchedChar);
                  setSuccessMsg("Sesi karakter dikembalikan!");
                  setIsRecoveringSession(false);
                }, 800);
              } else {
                setIsRecoveringSession(false);
              }
            } else {
              setIsRecoveringSession(false);
            }
          }
        } else if (res.status === 401) {
          // Token expired or invalid, log out
          handleLogout();
          setIsRecoveringSession(false);
        } else {
          setIsRecoveringSession(false);
        }
      } catch (err) {
        console.error("Gagal mengambil daftar karakter", err);
        setIsRecoveringSession(false);
      }
    };
    
    fetchCharacters();
  }, [token]);

  // 1. Establish WebSocket link with our Go Server using selected character ID
  const { sendPlayerState, sendPlayerAttack, sendDistributeStat } = useWebSocketGame(
    WS_BASE_URL,
    token,
    selectedCharacter?.id || "",
    (payload: GameStatePayload) => {
      // Update refs (zero React re-renders for 3D rendering)
      connectedPlayersRef.current = payload.players;
      // Server is authoritative — store raw payload directly.
      // HP bar accuracy is handled in RemoteMonstersRenderer via one-directional display.
      worldMonstersRef.current = payload.monsters;

      // Extract local player real-time HP from WebSocket
      const me = payload.players.find(p => p.id === (selectedCharacter?.id || ""));
      if (me && typeof (me as any).hp !== "undefined") {
        const rawHP = (me as any).hp;
        const rawMaxHP = (me as any).maxHp;
        if (playerStatsRef.current.hp !== rawHP || playerStatsRef.current.maxHp !== rawMaxHP) {
          playerStatsRef.current.hp = rawHP;
          playerStatsRef.current.maxHp = rawMaxHP;
          setPlayerStats((prev: any) => {
            if (!prev) return { hp: rawHP, max_hp: rawMaxHP, level: selectedCharacter?.level || 1, gold: 0, mp: 50, max_mp: 50, username: selectedCharacter?.username || "Hero" };
            return {
              ...prev,
              hp: rawHP,
              max_hp: rawMaxHP,
            };
          });
        }
      }

      // Remote players list: only check and update roster at max 1Hz to prevent React rendering choke
      const now = performance.now();
      if (now - lastRosterUpdate.current >= 1000) {
        lastRosterUpdate.current = now;
        const remotes = payload.players.filter(p => p.id !== (selectedCharacter?.id || ""));
        const nextHash = remotes.map(p => `${p.id}-${p.class}-${p.gender}`).join(",");
        if (lastRemotePlayerHash.current !== nextHash) {
          lastRemotePlayerHash.current = nextHash;
          const nextList = remotes.map(p => ({
            id: p.id,
            username: p.username || "",
            class: p.class || "Beginner",
            gender: p.gender || "Male"
          }));
          activeRemotePlayersRef.current = nextList;
          setActiveRemotePlayers(nextList);
        }
      }

      // battleGrid + unitRegistry rebuild: throttled to 5Hz max
      // Runs on every WS tick was causing ~20 full map allocs per second on main thread
      if (now - lastBattleGridUpdate.current >= 200) {
        lastBattleGridUpdate.current = now;
        const mockUnits: UnitRuntimeData[] = payload.monsters.map((m) => {
          const visualPos = (window as any).monsterVisualPositions?.get(m.id);
          return {
            id: m.id,
            name: m.name,
            type: "enemy",
            isActive: !m.is_dead,
            isDying: m.is_dead,
            hp: m.hp,
            maxHp: m.max_hp,
            position: [visualPos ? visualPos.x : m.x, m.y, visualPos ? visualPos.z : m.z],
            level: m.type === "boss" ? 50 : 15,
            rarity: "common",
            class: "monster",
            poolIdx: 0,
            isAggro: m.target_player_id !== "",
          } as any;
        });
        unitRegistryRef.current = mockUnits;
        battleGrid.update(mockUnits);
      }
    }
  );

  // Sync player profile stats (Gold, XP, Level) periodically from PostgreSQL GORM
  // FIX: The 3s setInterval was confirmed as the MAIN CAUSE of lag spikes (90% of all spikes at exactly ~3000ms intervals).
  // Root cause: setInterval fires synchronously on Main Thread, preempting the render loop mid-frame.
  // Solution: Use requestIdleCallback inside a loose scheduler — fetch only when browser has idle budget (>5ms headroom).
  // This guarantees the HTTP fetch NEVER blocks frame rendering.
  useEffect(() => {
    if (!token || !selectedCharacter) return;

    let destroyed = false;
    // Track last fetch time ourselves (not relying on setInterval timing which is imprecise under load)
    let lastProfileFetch = 0;
    const PROFILE_FETCH_INTERVAL = 5000; // Extended to 5s — profile (XP/Gold/Level) doesn't need 3s precision

    const scheduleIdleFetch = () => {
      if (destroyed) return;

      const idleHandle = requestIdleCallback((deadline) => {
        if (destroyed) return;

        const now = performance.now();
        const timeSinceLast = now - lastProfileFetch;

        // Only run if it's been long enough AND we have idle budget
        if (timeSinceLast >= PROFILE_FETCH_INTERVAL && deadline.timeRemaining() > 5) {
          lastProfileFetch = now;

          // Update HUD counters directly from refs (zero allocations, no React state)
          const pCount = (connectedPlayersRef.current?.length ?? 0) + 1;
          const mCount = worldMonstersRef.current?.filter((m: any) => !m.is_dead).length ?? 0;
          setPlayerCount(pCount);
          setAliveMonsterCount(mCount);

          // Fire-and-forget async fetch — response handler uses functional setState to avoid stale closure
          fetch(`${API_BASE_URL}/api/player/profile?character_id=${selectedCharacter.id}`, {
            headers: { "Authorization": `Bearer ${token}` },
            signal: AbortSignal.timeout(4000), // Prevent zombie fetches if server is slow
          })
            .then(async (response) => {
              if (destroyed) return;
              if (response.ok) {
                const data = await response.json();
                if (data.player) {
                  // Only update stats that actually changed to avoid unnecessary React re-renders
                  playerStatsRef.current.hp = data.player.hp;
                  playerStatsRef.current.maxHp = data.player.max_hp;
                  setPlayerStats((prev: any) => {
                    if (!prev) return data.player;
                    // Skip re-render if nothing meaningful changed (HP is already live via WS)
                    if (prev.gold === data.player.gold && prev.level === data.player.level && prev.experience === data.player.experience) return prev;
                    return { ...prev, ...data.player };
                  });
                }
              } else if (response.status === 401) {
                handleLogout();
              }
            })
            .catch(() => { /* Ignore network errors — next tick will retry */ });
        }

        // Reschedule next check
        if (!destroyed) {
          setTimeout(scheduleIdleFetch, 1000); // Check every 1s if it's time to fetch, but only fetch every 5s
        }
      }, { timeout: 2000 }); // fallback timeout: if no idle budget for 2s, run anyway but minimally

      return idleHandle;
    };

    scheduleIdleFetch();

    return () => {
      destroyed = true;
    };
  }, [token, selectedCharacter]);

  // Auth: Register/Login API Requests
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal melakukan autentikasi");
      }

      if (isLogin) {
        localStorage.setItem("game_auth_token", data.token);
        setIsRecoveringSession(true);
        setToken(data.token);
        setSuccessMsg("Selamat Datang! Mengambil daftar karakter...");
      } else {
        setSuccessMsg("Pendaftaran Sukses! Silakan masuk dengan akun Anda.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  // Character Customization Creation
  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      setErrorMsg("Nama karakter tidak boleh kosong");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/player/characters`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: charName.trim(),
          class: charClass,
          gender: charGender,
          hair_style: charHairStyle,
          hair_color: charHairColor,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat karakter");
      }

      setSuccessMsg("Karakter berhasil dibuat! Memasuki Arena...");
      setCharName("");
      
      // Refresh characters list
      const resList = await fetch(`${API_BASE_URL}/api/player/characters`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (resList.ok) {
        const dataList = await resList.json();
        setCharacters(dataList.characters || []);
      }

      // Enter game with newly created character and save session
      if (data.player && data.player.id) {
        localStorage.setItem("game_active_char_id", data.player.id);
      }
      setSelectedCharacter(data.player);
      setIsCreatingChar(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat karakter");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchCharacter = async () => {
    localStorage.removeItem("game_active_char_id");
    setSelectedCharacter(null);
    setPlayerStats(null);
    setIsCreatingChar(false);
    setSuccessMsg("");
    setErrorMsg("");
    
    // Re-fetch character list to ensure freshness
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/player/characters`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setCharacters(data.characters || []);
        }
      } catch (e) {
        console.error("Gagal memperbarui daftar karakter:", e);
      }
    }
  };

  const fetchMonsterConfigs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/monsters`);
      if (res.ok) {
        const data = await res.json();
        setMonsterConfigs(data || []);
      }
    } catch (e) {
      console.error("Gagal memuat konfigurasi monster:", e);
    }
  };

  const handleSaveMonsterConfig = async (config: any) => {
    try {
      setErrorMsg("");
      const res = await fetch(`${API_BASE_URL}/api/config/monsters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSuccessMsg("Konfigurasi monster berhasil disimpan ke database!");
        fetchMonsterConfigs();
        setEditingMonster(null);
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Gagal menyimpan konfigurasi");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal menghubungi server");
    }
  };

  const handleDeleteMonsterConfig = async (type: string) => {
    try {
      setErrorMsg("");
      const res = await fetch(`${API_BASE_URL}/api/config/monsters/${type}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccessMsg("Konfigurasi monster berhasil dihapus dari database!");
        fetchMonsterConfigs();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Gagal menghapus konfigurasi");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal menghapus monster");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("game_auth_token");
    localStorage.removeItem("game_active_char_id");
    setToken("");
    setSelectedCharacter(null);
    setPlayerStats(null);
    setCharacters([]);
    setIsCreatingChar(false);
    connectedPlayersRef.current = [];
    worldMonstersRef.current = [];
    setSuccessMsg("");
  };

  const handleAuthoritativeAttack = (monsterId: string, damage?: number, isCrit?: boolean) => {
    // Fire authoritative combat attack packet directly to Go Usecase handler
    sendPlayerAttack("monster", monsterId, damage, isCrit);

    // Locate target monster in state to position the floating 3D text in world space
    const targetMonster = worldMonstersRef.current.find(m => m.id === monsterId);
    if (targetMonster && damageQueue.current) {
      const dmg = damage || (Math.random() > 0.85 ? 5000 + Math.random() * 2000 : 2000 + Math.random() * 1000);
      const crit = isCrit !== undefined ? isCrit : dmg > 4500;

      // Use real-time visual position if available to eliminate spawn delay and placement misalignment
      const visualPos = (window as any).monsterVisualPositions?.get(monsterId);
      const posX = visualPos ? visualPos.x : targetMonster.x;
      const posY = targetMonster.y + 0.8;
      const posZ = visualPos ? visualPos.z : targetMonster.z;

      damageQueue.current.push({
        value: Math.round(dmg),
        position: [posX, posY, posZ],
        isCrit: crit,
        color: crit ? "#ff3b30" : "#ffcc00",
        timestamp: performance.now()
      });

      // Trigger epic hit screenshake
      if (crit) {
        (window as any).triggerCameraShake?.(0.5);
      } else {
        (window as any).triggerCameraShake?.(0.2);
      }
    }
  };

  // Determine local 3D model path dynamically from GORM character Class and Gender
  const localPlayerModelPath = useMemo(() => {
    if (selectedCharacter && gameConfig && gameConfig.character_models) {
      const genderModels = gameConfig.character_models[selectedCharacter.gender] || gameConfig.character_models["Male"];
      const path = genderModels[selectedCharacter.class];
      if (path) return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    }
    return `${API_BASE_URL}/assets-model/Chef_Male.glb`; // Fallback
  }, [selectedCharacter, gameConfig]);

  // --- RENDERING VIEWS ---

  // View 0: Fullscreen Session Recovery Loading Screen
  if (isRecoveringSession) {
    return (
      <div className="fixed inset-0 w-screen h-screen z-[999] bg-[#060608] flex flex-col items-center justify-center gap-6 font-sans">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[20%] left-[20%] w-[45%] h-[45%] bg-cyan-600/10 blur-[130px] rounded-full animate-pulse" />
          <div className="absolute bottom-[20%] right-[20%] w-[45%] h-[45%] bg-indigo-600/10 blur-[130px] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-sm text-center px-6">
          {/* Logo/Icon */}
          <div className="relative">
            <div className="w-20 h-20 border-4 border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sword className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">
              SEAL M <span className="text-cyan-400">ARENA</span>
            </h2>
            <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse mt-1">
              Menghubungkan Sesi...
            </p>
            <p className="text-zinc-400 text-[10px] font-bold tracking-widest uppercase">
              {successMsg || "Mengembalikan Karakter & Dunia 3D"}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // View 1: Auth UI (Login / Register Screen)
  if (!token) {
    return (
      <div className="relative min-h-screen bg-[#060608] text-white flex flex-col justify-center items-center font-sans overflow-hidden">
        {/* Colorful Neon Blur Backgrounds */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[20%] left-[20%] w-[35%] h-[35%] bg-cyan-600/10 blur-[130px] rounded-full animate-pulse" />
          <div className="absolute bottom-[20%] right-[20%] w-[35%] h-[35%] bg-indigo-600/10 blur-[130px] rounded-full" />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md bg-zinc-950/70 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-500">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg shadow-cyan-500/20">
              <Sword className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white leading-none mt-2">
              SEAL M <span className="text-cyan-400">ARENA</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Go authoritative clean architecture backend</p>
          </div>

          <form className="flex flex-col gap-4 mt-2" onSubmit={handleAuthSubmit}>
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-red-400 text-xs font-semibold leading-relaxed">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-xl text-green-400 text-xs font-semibold leading-relaxed animate-pulse">
                {successMsg}
              </div>
            )}

            {/* Username Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Username Akun</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-600">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yoga_hero"
                  required
                  className="w-full bg-zinc-900/60 border border-white/5 pl-11 pr-4 py-3.5 rounded-xl text-sm font-semibold focus:outline-none focus:border-cyan-500/50 transition-all text-white placeholder-zinc-700"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Kata Sandi</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-600">
                  <Key className="w-4 h-4" />
                </span>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-900/60 border border-white/5 pl-11 pr-4 py-3.5 rounded-xl text-sm font-semibold focus:outline-none focus:border-cyan-500/50 transition-all text-white placeholder-zinc-700"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 relative group w-full overflow-hidden"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-indigo-600 rounded-xl blur opacity-30 group-hover:opacity-75 transition duration-300" />
              <div className="relative bg-gradient-to-b from-cyan-400 to-indigo-700 hover:brightness-105 active:scale-95 text-white font-black text-xs py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest border border-white/10 shadow-2xl">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                     <Zap className="w-4 h-4 fill-white" />
                     {isLogin ? "MASUK ARENA" : "DAFTAR AKUN BARU"}
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Toggle register */}
          <div className="text-center text-xs text-zinc-600 font-semibold mt-2">
            {isLogin ? "Belum punya akun?" : "Sudah memiliki akun?"}{" "}
            <button 
              onClick={() => { setIsLogin(!isLogin); setErrorMsg(""); setSuccessMsg(""); }}
              className="text-cyan-400 hover:text-cyan-300 underline font-bold"
            >
              {isLogin ? "Daftar Sekarang" : "Masuk di Sini"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View 2: Character Selection Screen
  if (token && !selectedCharacter) {
    return (
      <div className="relative min-h-screen bg-[#060608] text-white flex flex-col justify-center items-center font-sans overflow-y-auto py-10 px-4">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[10%] left-[10%] w-[45%] h-[45%] bg-cyan-600/5 blur-[150px] rounded-full animate-pulse" />
          <div className="absolute bottom-[10%] right-[10%] w-[45%] h-[45%] bg-indigo-600/5 blur-[150px] rounded-full" />
        </div>

        <div className="relative z-10 w-full max-w-4xl flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/5 pb-5">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">AKUN AKTIF: {username || "Pemain"}</span>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" /> PILIH KARAKTER ANDA
              </h1>
            </div>
            <button 
              onClick={handleLogout}
              className="bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Ganti Akun
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-red-400 text-xs font-semibold leading-relaxed">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-xl text-green-400 text-xs font-semibold leading-relaxed animate-pulse">
              {successMsg}
            </div>
          )}

          {isCreatingChar ? (
            /* Creation mode */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Form customizer */}
              <form onSubmit={handleCreateCharacter} className="md:col-span-2 bg-zinc-950/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl flex flex-col gap-6">
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" /> KUSTOMISASI KARAKTER
                </h2>

                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Nama Karakter</label>
                  <input
                    type="text"
                    required
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder="Masukkan nama karakter..."
                    className="w-full bg-zinc-900/60 border border-white/10 px-4 py-3 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder-zinc-600"
                  />
                </div>

                {/* Gender */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Jenis Kelamin</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["Male", "Female"].map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => setCharGender(gender)}
                        className={`py-3.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                          charGender === gender 
                            ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-md shadow-cyan-500/10" 
                            : "bg-zinc-900/30 border-white/5 text-zinc-400 hover:border-white/10"
                        }`}
                      >
                        {gender === "Male" ? "Laki-laki (Male)" : "Perempuan (Female)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Class */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Pilih Kelas</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { key: "Beginner", label: "MM" },
                      { key: "Warrior", label: "Fighter" },
                      { key: "Mage", label: "Mage" },
                      { key: "Priest", label: "Tank" },
                      { key: "Thief", label: "Assassin" }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCharClass(key)}
                        className={`py-3.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          charClass === key 
                            ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-md shadow-indigo-500/10" 
                            : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Style */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Gaya Rambut</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setCharHairStyle(style)}
                        className={`py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                          charHairStyle === style 
                            ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" 
                            : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10"
                        }`}
                      >
                        Model {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hair Color */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Warna Rambut</label>
                  <div className="flex gap-3">
                    {["#5A3E2D", "#C8B195", "#A64B2A", "#1F2937", "#3B82F6", "#EAB308", "#10B981"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCharHairColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          charHairColor === color ? "border-cyan-400 scale-110 shadow-lg shadow-cyan-400/30" : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex gap-4 mt-2">
                  {characters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingChar(false)}
                      className="flex-1 py-4 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-zinc-400"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 bg-gradient-to-r from-cyan-400 to-indigo-600 hover:brightness-105 active:scale-95 border border-white/10 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 fill-white" /> BUAT & MASUK</>}
                  </button>
                </div>
              </form>

              {/* Class preview */}
              <div className="bg-zinc-950/30 border border-white/5 p-6 rounded-3xl flex flex-col gap-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 leading-none">PREVIEW KELAS</span>
                <h3 className="text-2xl font-black tracking-tight text-white uppercase leading-none">
                  {CLASS_LABELS[charClass] || charClass}
                </h3>
                
                <div className="w-full aspect-[4/3] rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5 shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
                  <Sword className="w-12 h-12 text-zinc-700" />
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                  {charClass === "Warrior" && "Fighter adalah petarung garis depan yang handal. Memiliki daya serang fisik luar biasa dan pertahanan tinggi dengan pedang besarnya."}
                  {charClass === "Mage" && "Mage menguasai sihir kuno. Mampu memberikan serangan jarak jauh ber-damage tinggi dengan sihir elemen badai api dan es."}
                  {charClass === "Priest" && "Tank adalah pelindung garis depan yang kokoh. Mampu menyerap kerusakan besar dan memberikan perlindungan suci bagi tim."}
                  {charClass === "Thief" && "Assassin menyerang dari bayangan dengan kelincahan penuh. Memiliki kecepatan serang tertinggi dan peluang kritikal tebasan belati mematikan."}
                  {charClass === "Beginner" && "MM (Marksman) adalah penembak jitu jarak jauh. Memberikan serangan fisik beruntun yang presisi dari jarak aman."}
                </p>

                <div className="border-t border-white/5 pt-4 mt-auto">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Kustomisasi Aktif:</span>
                  <div className="flex gap-3 text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">
                    <span>{charGender === "Male" ? "Male" : "Female"}</span>
                    <span>Style {charHairStyle}</span>
                    <span className="flex items-center gap-1.5">Color: <span style={{ backgroundColor: charHairColor }} className="w-3 h-3 rounded-full border border-white/10" /></span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Selection Grid list */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {characters.map((char) => (
                <div 
                  key={char.id} 
                  onClick={() => {
                    localStorage.setItem("game_active_char_id", char.id);
                    setSelectedCharacter(char);
                  }}
                  className={`group relative cursor-pointer overflow-hidden rounded-3xl bg-zinc-950/60 hover:bg-zinc-950/85 border p-6 flex flex-col gap-4 shadow-xl transition-all hover:-translate-y-1 active:scale-98 shadow-black/40 ${
                    char.class === "Warrior" ? "border-red-950/40 hover:border-red-500/40" :
                    char.class === "Mage" ? "border-blue-950/40 hover:border-blue-500/40" :
                    char.class === "Priest" ? "border-amber-950/40 hover:border-amber-500/40" :
                    char.class === "Thief" ? "border-purple-950/40 hover:border-purple-500/40" :
                    "border-emerald-950/40 hover:border-emerald-500/40"
                  }`}
                >
                  <div className="absolute top-0 right-0 p-4 leading-none z-0 opacity-10 group-hover:opacity-20 transition-all">
                    {char.class === "Warrior" && <Sword className="w-20 h-20 text-white" />}
                    {char.class === "Mage" && <Zap className="w-20 h-20 text-white" />}
                    {char.class === "Priest" && <Sparkles className="w-20 h-20 text-white" />}
                    {char.class === "Thief" && <Target className="w-20 h-20 text-white" />}
                    {char.class === "Beginner" && <Shield className="w-20 h-20 text-white" />}
                  </div>

                  <div className="relative z-10 flex items-center justify-between border-b border-white/5 pb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest border px-2.5 py-1 rounded-full ${
                      char.class === "Warrior" ? "bg-red-950/30 border-red-800/30 text-red-400" :
                      char.class === "Mage" ? "bg-blue-950/30 border-blue-800/30 text-blue-400" :
                      char.class === "Priest" ? "bg-amber-950/30 border-amber-800/30 text-amber-400" :
                      char.class === "Thief" ? "bg-purple-950/30 border-purple-800/30 text-purple-400" :
                      "bg-emerald-950/30 border-emerald-800/30 text-emerald-400"
                    }`}>
                      {CLASS_LABELS[char.class] || char.class}
                    </span>
                    <span className="text-zinc-500 text-xs font-black tracking-widest uppercase">LV.{char.level}</span>
                  </div>

                  <div className="relative z-10 flex flex-col gap-0.5 mt-2">
                    <span className="text-lg font-black tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                      {char.username}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 mt-1">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Gold: {char.gold}G</span>
                    </div>
                  </div>

                  <div className="relative z-10 mt-auto border-t border-white/5 pt-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.setItem("game_active_char_id", char.id);
                        setEnvReady(false);
                        setSelectedCharacter(char);
                      }}
                      className="w-full bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 hover:border-cyan-400 group-hover:scale-102 hover:text-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      MASUK ARENA
                    </button>
                  </div>
                </div>
              ))}

              {/* Add New character placeholder card */}
              <div 
                onClick={() => setIsCreatingChar(true)}
                className="cursor-pointer border border-dashed border-white/10 hover:border-cyan-500/30 bg-zinc-950/10 hover:bg-zinc-950/30 rounded-3xl p-8 flex flex-col justify-center items-center gap-3 transition-all min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
                  <span className="text-2xl font-black leading-none">+</span>
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-cyan-400 transition-colors">
                  Buat Karakter Baru
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // View 3: Render Multiplayer 3D Game Interface
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden touch-none select-none bg-black text-white font-sans">
      
      {/* Premium Loading Screen Overlay */}
      {!envReady && (
        <div className="absolute inset-0 z-[9999] flex flex-col justify-center items-center bg-[#07070a]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-cyan-600/10 blur-[130px] rounded-full" />
            <div className="absolute bottom-[20%] right-[20%] w-[60%] h-[60%] bg-indigo-600/10 blur-[130px] rounded-full" />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-6 max-w-md px-6 text-center animate-in fade-in zoom-in-95 duration-500">
            {/* Logo / Title */}
            <div className="flex flex-col gap-1 items-center animate-pulse">
              <span className="text-[10px] font-black uppercase text-cyan-400 tracking-[0.3em] ml-1">MENYIAPKAN PETA DUNIA</span>
              <h1 className="text-4xl font-black uppercase tracking-tighter text-white italic">
                SEAL-M <span className="text-cyan-400">ARENA</span>
              </h1>
            </div>

            {/* Spinner */}
            <div className="relative w-16 h-16 flex items-center justify-center my-4">
              <div className="absolute inset-0 border-4 border-cyan-500/10 rounded-full" />
              <div className="absolute inset-0 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>

            {/* Status Messages */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-zinc-100">Memuat Aset & Tinggi Terrain...</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Mempersiapkan struktur data BVH untuk stabilitas fisika karakter
              </p>
            </div>
            
            {/* Tip */}
            <div className="mt-8 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl text-left">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest block mb-1">TIPS BERMAIN</span>
              <p className="text-[10px] text-zinc-400 leading-normal">
                Gunakan tombol WASD untuk bergerak, tombol Shift untuk berlari, dan arahkan kursor mouse untuk auto-aim target monster terdekat di sekitar jangkauan serangan kelas Anda!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3D CANVAS */}
      <div className="absolute inset-0 w-full h-full z-0">
        <KeyboardControls map={keyboardMap}>
          <Canvas
            shadows={{ type: THREE.BasicShadowMap }} // BasicShadowMap: 2x faster than PCF, shadows still visible
            dpr={dpr}
            gl={{
              antialias: false,  // Disable MSAA — large GPU win, TAA-style blending from AdaptiveDpr covers it
              powerPreference: "high-performance",
              logarithmicDepthBuffer: false,
              stencil: false,
              depth: true,
              alpha: false,
              failIfMajorPerformanceCaveat: false,
              precision: "mediump",
            }}
            className="w-full h-full"
          >
            <PerformanceDiagnostics 
              connectedPlayersRef={connectedPlayersRef} 
              worldMonstersRef={worldMonstersRef} 
              selectedMapId={selectedMapId}
              dpr={dpr}
              potatoMode={settingsRef.current.potatoMode}
            />
            {/* Aggressively scale DPR: floor 0.5 for low-spec, ceiling 0.8 */}
            <PerformanceMonitor onIncline={() => setDpr(Math.min(dpr + 0.05, 0.8))} onDecline={() => setDpr(Math.max(dpr - 0.05, 0.5))} />
            <AdaptiveEvents />
            <AdaptiveDpr pixelated={true} />
            {/* Sync tone mapping exposure with World-Editor default (2.0) */}
            <ExposureBridge exposure={2.0} />

            <VFXProvider>
              <CameraDirector />
              <FPSCounterUpdater />
              {/* Models Preloader */}
              <ModelsPreloader onReady={() => setModelsReady(true)} />

              {/* Environment Scene */}
              <EnvironmentMultiGlobal
                settingsRef={settingsRef}
                debug={false}
                onReady={() => {
                  setTimeout(() => {
                    setEnvFinished(true);
                  }, 600);
                }}
              />
              <ModularMap debug={false} />

              {/* Real-time 3D projectile spells renderer */}
              <MMSpellEffect 
                spellsRef={mmSpellsRef} 
                unitRegistry={unitRegistryRef} 
                simTimeRef={simTimeRef} 
              />
              <FighterSpellEffect 
                fighterSpellsRef={fighterSpellsRef} 
                simTimeRef={simTimeRef} 
              />
              <TankSpellEffect 
                tankSpellsRef={tankSpellsRef} 
                simTimeRef={simTimeRef} 
                unitRegistry={unitRegistryRef}
              />
              <AssassinSpellEffect 
                assassinSpellsRef={assassinSpellsRef} 
                simTimeRef={simTimeRef} 
              />
              <MageSpellEffect 
                spellsRef={spellsRef} 
                unitRegistry={unitRegistryRef} 
                simTimeRef={simTimeRef} 
              />

              {/* Hardware-accelerated 3D damage numbers HUD */}
              <DamageHUDBatcher damageQueue={damageQueue} />

              {/* Local Player Character Controlled Mesh */}
              <PlayerController 
                paused={!envReady}
                modelPath={localPlayerModelPath}
                playerClass={selectedCharacter?.class || "Warrior"}
                settingsRef={settingsRef}
                damageQueue={damageQueue}
                mmSpellsRef={mmSpellsRef}
                spellsRef={spellsRef}
                fighterSpellsRef={fighterSpellsRef}
                tankSpellsRef={tankSpellsRef}
                assassinSpellsRef={assassinSpellsRef}
                simTimeRef={simTimeRef}
                dealPlayerDamage={handleAuthoritativeAttack}
                sendPlayerState={sendPlayerState}
                playerStats={playerStats}
              />

              {/* Render Other Connected Players in real-time */}
              <RemotePlayersRenderer 
                activeRemotePlayers={activeRemotePlayers}
                connectedPlayersRef={connectedPlayersRef} 
                gameConfig={gameConfig}
                mmSpellsRef={mmSpellsRef}
                spellsRef={spellsRef}
                fighterSpellsRef={fighterSpellsRef}
                tankSpellsRef={tankSpellsRef}
                assassinSpellsRef={assassinSpellsRef}
                unitRegistry={unitRegistryRef}
              />

              {/* Render Server Authoritative Monsters */}
              <RemoteMonstersRenderer 
                worldMonstersRef={worldMonstersRef} 
                onAttack={(monsterId) => {
                  (window as any).monsterClickedThisFrame = true;
                  (window as any).clickedTargetId = monsterId;
                  (window as any).hasAttackIntent = true;
                }}
                connectedPlayersRef={connectedPlayersRef}
                localPlayerId={selectedCharacter?.id}
                gameConfig={gameConfig}
              />
            </VFXProvider>

            {!settingsRef.current.potatoMode && (
              <EffectComposer enableNormalPass={false} multisampling={0}>
                <Bloom luminanceThreshold={1.0} mipmapBlur intensity={0.5} radius={0.4} />
                <ToneMapping adaptive={false} />
              </EffectComposer>
            )}
          </Canvas>
        </KeyboardControls>
      </div>

      {/* 4. PREMIUM DEATH / RESPAWN OVERLAY SCREEN */}
      {playerStats && typeof playerStats.hp !== 'undefined' && playerStats.hp <= 0 && (
        <div className="absolute inset-0 z-[99999] pointer-events-auto select-none bg-black/85 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500">
          {/* Red Vignette Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0)_30%,rgba(0,0,0,0.9)_90%)] pointer-events-none animate-pulse" />
          
          <div className="flex flex-col items-center text-center max-w-md px-6 relative z-10">
            {/* Pulsing skull container */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 via-rose-700 to-red-950 p-0.5 border-4 border-red-500/40 shadow-2xl flex items-center justify-center mb-6 animate-bounce">
              <Skull className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
            </div>

            <h1 className="text-3xl font-black tracking-tighter uppercase text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] italic mb-2">
              Karakter Anda Gugur!
            </h1>
            <p className="text-xs font-semibold text-zinc-400 leading-relaxed mb-8">
              Anda dikalahkan di pertempuran. Menghidupkan kembali dan memulihkan seluruh tenaga di Kota Starter...
            </p>

            {/* Countdown spinner container */}
            <div className="flex items-center gap-3 bg-zinc-950/80 border border-red-500/20 px-6 py-3.5 rounded-2xl shadow-xl">
              <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
                Memulihkan tenaga dalam beberapa detik...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MULTIPLAYER HUD OVERLAY */}
      <div className="absolute inset-0 pointer-events-none z-10 select-none">

        {/* No-target alert toast */}
        <div id="no-target-alert" className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/90 backdrop-blur-md border border-red-400/30 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-2xl pointer-events-none opacity-0 flex items-center gap-2" style={{transition:'opacity 0.25s ease-in-out'}}>
          <span className="animate-pulse">⚠️</span> BUTUH TARGET ENEMY UNTUK SKILL!
        </div>

        {/* Facing-alignment alert toast */}
        <div id="facing-alignment-alert" className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500/90 backdrop-blur-md border border-amber-400/30 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-2xl pointer-events-none opacity-0 flex items-center gap-2" style={{transition:'opacity 0.25s ease-in-out'}}>
          <span className="animate-pulse">🔄</span> MENYELARASKAN HADAP TARGET...
        </div>

        {/* ── TOP-LEFT: Avatar + HP/MP/EXP ── */}
        <div className="absolute left-3 top-3 flex items-center gap-2.5 pointer-events-auto">
          {/* Avatar ring */}
          <div className="relative cursor-pointer" onClick={() => setShowStatsModal(true)}>
            <div className="w-[62px] h-[62px] rounded-full bg-gradient-to-br from-emerald-400 via-cyan-500 to-indigo-600 p-[3px] shadow-[0_0_18px_rgba(16,185,129,0.45)]">
              <div className="w-full h-full rounded-full bg-[#0d1117] flex items-center justify-center overflow-hidden">
                <User className="w-7 h-7 text-cyan-300" />
              </div>
            </div>
            {/* Level badge */}
            <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-[#0d1117] flex items-center justify-center text-[9px] font-black text-black shadow-lg">
              {playerStats?.level ?? selectedCharacter?.level ?? 1}
            </div>
            {/* EXP arc border thin overlay */}
            <div className="absolute inset-0 rounded-full border-2 border-emerald-400/20 pointer-events-none" />
          </div>

          {/* Name + CP + HP/MP bars */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-black text-white drop-shadow-md tracking-tight">
                {playerStats?.username ?? selectedCharacter?.username ?? "Hero"}
              </span>
              <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[8px] font-black px-2 py-0.5 rounded-md tracking-wider">
                CP {((playerStats?.level ?? 1) * 350 + 742).toLocaleString()}
              </span>
            </div>
            {/* HP bar */}
            <div className="w-48 h-[14px] rounded-full bg-black/70 border border-white/10 overflow-hidden relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-green-600 via-emerald-400 to-green-500 rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                style={{width:`${Math.max(0,Math.min(100,((playerStats?.hp??selectedCharacter?.hp??100)/(playerStats?.max_hp??selectedCharacter?.max_hp??100))*100))}%`}}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white drop-shadow">
                {Math.round(playerStats?.hp??100)} / {Math.round(playerStats?.max_hp??100)}
              </span>
            </div>
            {/* MP bar */}
            <div className="w-48 h-[10px] rounded-full bg-black/70 border border-white/10 overflow-hidden relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-blue-500 rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(59,130,246,0.4)]"
                style={{width:`${Math.max(0,Math.min(100,((playerStats?.mp??selectedCharacter?.mp??50)/(playerStats?.max_mp??selectedCharacter?.max_mp??50))*100))}%`}}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white drop-shadow">
                {Math.round(playerStats?.mp??50)} / {Math.round(playerStats?.max_mp??50)}
              </span>
            </div>
          </div>
        </div>


        {/* ── TOP-CENTER: Currency bar ── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/55 backdrop-blur-xl border border-white/10 px-4 py-1.5 rounded-2xl shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-[9px] font-black text-black shadow">S</span>
            <span className="text-[11px] font-black text-amber-400">{(playerStats?.gold??2048).toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">💎</span>
            <span className="text-[11px] font-black text-pink-400">88</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🔷</span>
            <span className="text-[11px] font-black text-cyan-400">150</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <FPSBadge />
        </div>

        {/* ── TOP-RIGHT: Mini-map + Server info + Actions ── */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Mini-map circle */}
          {/* Mini-map circle */}
          <Minimap
            connectedPlayersRef={connectedPlayersRef}
            worldMonstersRef={worldMonstersRef}
            localPlayerId={selectedCharacter?.id || ""}
            mapId={selectedMapId || "Starter Zone"}
          />

          {/* Server info pills */}
          <div className="flex gap-1.5 mt-6">
            <div className="bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Users className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-black text-white">{playerCount}</span>
            </div>
            <div className="bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Skull className="w-3 h-3 text-red-400 animate-pulse" />
              <span className="text-[9px] font-black text-white">{aliveMonsterCount}</span>
            </div>
          </div>

          {/* Mini action burger */}
          <button
            onClick={() => setShowMiniActions(v=>!v)}
            className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-[8px] font-black text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all"
          >
            <span>☰</span> MENU
          </button>
          {showMiniActions && (
            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
              <button onClick={handleSwitchCharacter} className="bg-cyan-500/15 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-cyan-400 flex items-center gap-1.5 transition-all hover:bg-cyan-500/25">
                <Users className="w-3 h-3"/> Ganti Kelas
              </button>
              <button onClick={async()=>{const s=useEditorStore.getState();let l=s.mapList;if(!l.length){await s.fetchMapList();l=s.mapList;}if(l.length>1){const i=l.findIndex(m=>m.id===s.selectedMapId);setEnvReady(false);await s.setSelectedMapId(l[(i+1)%l.length].id);}else{setEnvReady(false);await s.loadFromDatabase();}}} className="bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-indigo-300 flex items-center gap-1.5 transition-all hover:bg-indigo-500/25">
                <Sparkles className="w-3 h-3"/> Ganti Peta
              </button>
              <button onClick={()=>{fetchMonsterConfigs();setShowEnemyEditorModal(true);setShowMiniActions(false);}} className="bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-amber-400 flex items-center gap-1.5 transition-all hover:bg-amber-500/25">
                <Skull className="w-3 h-3"/> Edit Monster
              </button>
              <button onClick={handleLogout} className="bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-red-400 flex items-center gap-1.5 transition-all hover:bg-red-500/25">
                <LogOut className="w-3 h-3"/> Keluar
              </button>
            </div>
          )}
        </div>

        {/* ── LEFT-CENTER: Quest Panel ── */}
        <div className="absolute left-3 top-[48%] -translate-y-1/2 w-[200px] bg-black/50 backdrop-blur-xl border border-white/10 border-l-[3px] border-l-amber-400 rounded-r-2xl rounded-l-sm p-3 flex flex-col gap-2 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest">Misi Utama</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black text-white leading-tight">Taklukkan Lembah Badai</span>
              <span className="text-[8.5px] text-zinc-400">Basmi monster di arena</span>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-lg px-2 py-1 flex justify-between text-[8px] font-black">
              <span className="text-zinc-500 uppercase tracking-wide">MONSTER</span>
              <span className={aliveMonsterCount>0?"text-red-400 animate-pulse":"text-emerald-400"}>
                {aliveMonsterCount>0?`${aliveMonsterCount} TERSISA`:"SELESAI ✓"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black text-amber-300 leading-tight">Berburu Harta Karun</span>
              <div className="flex justify-between text-[8px]">
                <span className="text-zinc-500">Kumpulkan Gold</span>
                <span className="text-amber-400 font-black">{Math.min(playerStats?.gold??0,500)}/500</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black text-cyan-300 leading-tight">Eksplorasi Wilayah</span>
              <div className="flex justify-between text-[8px]">
                <span className="text-zinc-500">Pemain Online</span>
                <span className="text-cyan-400 font-black">{playerCount}/33</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM-CENTER: Big HP + Fever bar ── */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[380px] flex flex-col gap-1 pointer-events-none">
          {/* HP bar */}
          <div className="relative w-full h-[18px] bg-black/75 rounded-full border border-white/10 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-700 via-emerald-400 to-green-500 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{width:`${Math.max(0,Math.min(100,((playerStats?.hp??100)/(playerStats?.max_hp??100))*100))}%`}}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">
              {(((playerStats?.hp??100)/(playerStats?.max_hp??100))*100).toFixed(2)}%
            </div>
          </div>
          {/* Fever/SP bar */}
          <div className="relative w-full h-[11px] bg-black/70 rounded-full border border-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-600 via-rose-400 to-fuchsia-500 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.6)]" style={{width:"65%"}} />
            <div className="absolute inset-0 flex items-center justify-center gap-1 text-[7px] font-black text-white drop-shadow tracking-widest uppercase">
              <span className="bg-pink-500/80 px-1.5 py-0.5 rounded-full text-[6px] font-black">FEVER</span>
            </div>
          </div>
        </div>

        {/* ── BOTTOM-LEFT: Chat ── */}
        <div className="absolute left-3 bottom-16 w-[280px] flex flex-col gap-1 pointer-events-auto">
          <div ref={chatScrollRef} className="max-h-[80px] overflow-y-auto flex flex-col gap-1 pr-1">
            {chatMessages.map((m,i)=>(
              <p key={i} className="text-[9px] leading-relaxed">
                {m.type==="system" && <><span className="text-emerald-400 font-black mr-1">[Sistem]</span><span className="text-zinc-300">{m.msg}</span></>}
                {m.type==="info" && <><span className="text-amber-400 font-black mr-1">[Info]</span><span className="text-zinc-300">{m.msg}</span></>}
                {m.type==="player" && <><span className="text-indigo-400 font-black mr-1">[{m.name}]</span><span className="text-zinc-100">{m.msg}</span></>}
              </p>
            ))}
          </div>
          {/* Input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={chatInput}
              onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>{
                if(e.key==="Enter"&&chatInput.trim()){
                  setChatMessages(p=>[...p,{type:"player",name:selectedCharacter?.username??"You",msg:chatInput.trim()}]);
                  setChatInput("");
                  setTimeout(()=>{if(chatScrollRef.current)chatScrollRef.current.scrollTop=chatScrollRef.current.scrollHeight;},50);
                }
              }}
              placeholder="Ketik pesan..."
              className="flex-1 bg-black/55 border border-white/10 rounded-lg px-2.5 py-1 text-[9px] text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 backdrop-blur-sm"
            />
            <button
              onClick={()=>{
                if(chatInput.trim()){
                  setChatMessages(p=>[...p,{type:"player",name:selectedCharacter?.username??"You",msg:chatInput.trim()}]);
                  setChatInput("");
                }
              }}
              className="bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-[9px] font-black text-cyan-300 transition-all"
            >Enter</button>
          </div>
        </div>

        {/* ── BOTTOM-RIGHT: Skill bar (4 slots) + main attack + AUTO ── */}
        {selectedCharacter && (
          <div className="absolute right-3 bottom-14 flex flex-col items-end gap-2 pointer-events-auto">
            {/* Top row: 4 numbered skill slots */}
            <div className="flex gap-1.5">
              {[
                {num:1,icon:<Sword className="w-5 h-5"/>,color:"from-amber-500 to-orange-600",glow:"rgba(245,158,11,0.5)",label:"ATK"},
                {num:2,icon:<Zap className="w-5 h-5"/>,color:"from-cyan-500 to-blue-600",glow:"rgba(6,182,212,0.5)",label:"SKL"},
                {num:3,icon:<Sparkles className="w-5 h-5"/>,color:"from-purple-500 to-indigo-600",glow:"rgba(168,85,247,0.5)",label:"PSV"},
                {num:4,icon:<Shield className="w-5 h-5"/>,color:"from-emerald-500 to-teal-600",glow:"rgba(16,185,129,0.5)",label:"DEF"},
              ].map(s=>(
                <div key={s.num} className="relative flex flex-col items-center gap-0.5">
                  <button className={`w-[52px] h-[52px] rounded-xl bg-gradient-to-br ${s.color} border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg`}
                    style={{boxShadow:`0 0 12px ${s.glow}`}}
                    onClick={()=>{if(s.num===1){const e=new MouseEvent("mousedown",{button:0});document.dispatchEvent(e);setTimeout(()=>document.dispatchEvent(new MouseEvent("mouseup",{button:0})),50);}else if(s.num===2){document.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyQ"}));}}}
                  >
                    {s.icon}
                  </button>
                  <span className="absolute top-0.5 left-1 text-[8px] font-black text-white/70">{s.num}</span>
                  <span className="text-[7px] font-black text-zinc-400 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Bottom row: AUTO + big skill button */}
            <div className="flex items-end gap-2">
              {/* AUTO battle */}
              <button
                onClick={()=>setIsAutoMode(v=>!v)}
                className={`flex flex-col items-center justify-center w-[48px] h-[48px] rounded-full border-2 transition-all ${isAutoMode?"bg-emerald-500/30 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.6)]":"bg-black/50 border-white/20"}`}
              >
                <span className={`text-[9px] font-black tracking-wider ${isAutoMode?"text-emerald-300 animate-pulse":"text-zinc-500"}`}>AUTO</span>
              </button>

              {/* Main attack big button */}
              <button
                onClick={()=>{const e=new MouseEvent("mousedown",{button:0});document.dispatchEvent(e);setTimeout(()=>document.dispatchEvent(new MouseEvent("mouseup",{button:0})),50);}}
                className="relative w-[76px] h-[76px] rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 border-2 border-white/25 active:scale-95 flex items-center justify-center text-white shadow-2xl transition-all hover:brightness-110 group"
                style={{boxShadow:"0 0 28px rgba(99,102,241,0.6), inset 0 2px 4px rgba(255,255,255,0.15)"}}
              >
                <div className="absolute inset-1 rounded-full bg-black/20 group-hover:bg-black/10 transition-all" />
                {selectedCharacter.class==="Warrior"&&<Sword className="w-9 h-9 relative z-10 group-hover:rotate-12 transition-transform"/>}
                {selectedCharacter.class==="Mage"&&<Zap className="w-9 h-9 relative z-10"/>}
                {selectedCharacter.class==="Priest"&&<Sparkles className="w-9 h-9 relative z-10"/>}
                {selectedCharacter.class==="Thief"&&<Target className="w-9 h-9 relative z-10"/>}
                {selectedCharacter.class==="Beginner"&&<Shield className="w-9 h-9 relative z-10"/>}
                <span className="absolute bottom-1 text-[7px] font-black text-white/80 uppercase tracking-widest z-10">ATTACK</span>
              </button>

              {/* Q Skill */}
              <button
                id="skill-button-active"
                onClick={()=>document.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyQ"}))}
                className="relative w-[56px] h-[56px] rounded-full bg-gradient-to-br from-orange-500 to-red-600 border-2 border-white/20 active:scale-95 flex items-center justify-center text-white shadow-xl transition-all hover:brightness-110 group"
                style={{boxShadow:"0 0 16px rgba(249,115,22,0.5)"}}
              >
                <div id="skill-cooldown-overlay" className="absolute inset-0 bg-black/85 backdrop-blur-[1px] rounded-full flex items-center justify-center text-[9px] font-black text-amber-400 transition-all translate-y-[100%]">CD</div>
                {selectedCharacter.class==="Warrior"&&<RefreshCw className="w-6 h-6 relative z-10"/>}
                {selectedCharacter.class==="Mage"&&<Zap className="w-6 h-6 relative z-10"/>}
                {selectedCharacter.class==="Priest"&&<Sparkles className="w-6 h-6 relative z-10"/>}
                {selectedCharacter.class==="Thief"&&<Target className="w-6 h-6 relative z-10"/>}
                {selectedCharacter.class==="Beginner"&&<Shield className="w-6 h-6 relative z-10"/>}
                <div className="absolute -top-1 -left-1 bg-zinc-900 border border-white/10 text-[7px] font-black px-1.5 py-0.5 rounded-full text-zinc-300">Q</div>
              </button>
            </div>
          </div>
        )}

        {/* Character Status Modal (Premium Glassmorphism Overlay) */}
        {showStatsModal && playerStats && (
          <div 
            className="fixed inset-0 w-screen h-screen z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center pointer-events-auto font-sans"
            onClick={() => setShowStatsModal(false)}
          >
            <div 
              className="w-[480px] max-w-[92vw] bg-zinc-950/85 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-cyan-500/15 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-md font-black tracking-tight uppercase text-white leading-none">STATUS KARAKTER</h3>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">RPG Player Attributes Panel</span>
                  </div>
                </div>
                <button 
                  onClick={() => setShowStatsModal(false)}
                  className="w-8 h-8 rounded-full bg-zinc-900/60 hover:bg-zinc-800 hover:text-white text-zinc-500 flex items-center justify-center transition-all active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Brief */}
              <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="text-sm font-black text-white">{playerStats.username || "Traveler"}</div>
                  <div className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">Kelas: <span className="text-cyan-400">{playerStats.class || "Beginner"}</span></div>
                </div>
                <div className="text-right flex flex-col gap-0.5">
                  <div className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest">Poin Tersisa</div>
                  <div className="text-xl font-black text-cyan-400 animate-pulse">{playerStats.stat_points ?? 0}</div>
                </div>
              </div>

              {/* Core attributes list */}
              <div className="flex flex-col gap-2.5 max-h-[30vh] overflow-y-auto pr-1">
                <h4 className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1 flex justify-between">
                  <span>Atribut Utama</span>
                  {playerStats.stat_points > 0 && <span className="text-cyan-400 font-black animate-pulse">Alokasikan Poin!</span>}
                </h4>
                
                {[
                  { key: "str", label: "STR", name: "Strength", value: playerStats.str ?? 10, desc: "Meningkatkan Serangan Fisik" },
                  { key: "int", label: "INT", name: "Intelligence", value: playerStats.int ?? 10, desc: "Meningkatkan Serangan Sihir & Maks MP" },
                  { key: "con", label: "CON", name: "Constitution", value: playerStats.con ?? 10, desc: "Meningkatkan Maks HP & Pertahanan Fisik" },
                  { key: "vit", label: "VIT", name: "Vitality", value: playerStats.vit ?? 10, desc: "Meningkatkan Maks HP & Pertahanan Utama" },
                  { key: "wis", label: "WIS", name: "Wisdom", value: playerStats.wis ?? 10, desc: "Meningkatkan Maks MP & Pertahanan Sihir" },
                  { key: "luk", label: "LUK", name: "Luck", value: playerStats.luk ?? 10, desc: "Meningkatkan Critical Rate & Speed" },
                ].map((stat) => (
                  <div key={stat.key} className="flex items-center justify-between p-2.5 bg-zinc-900/30 border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-black text-white">{stat.label}</span>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{stat.name}</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 leading-normal">{stat.desc}</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-white tracking-wide">{stat.value}</span>
                      
                      {playerStats.stat_points > 0 && (
                        <button
                          onClick={() => sendDistributeStat(stat.key, 1)}
                          className="w-6 h-6 rounded-lg bg-gradient-to-b from-cyan-400 to-indigo-600 hover:brightness-110 text-white flex items-center justify-center font-bold text-xs active:scale-90 transition duration-150"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Secondary Stats */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-1">Statistik Tempur</h4>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Serangan Fisik", value: Math.round(playerStats.attack ?? 50) },
                    { label: "Serangan Sihir", value: Math.round(playerStats.magic_attack ?? 10) },
                    { label: "Pertahanan Fisik", value: Math.round(playerStats.defense ?? 10) },
                    { label: "Pertahanan Sihir", value: Math.round(playerStats.magic_defense ?? 10) },
                    { label: "Maks HP", value: Math.round(playerStats.max_hp ?? 1000) },
                    { label: "Maks MP", value: Math.round(playerStats.max_mp ?? 200) },
                    { label: "Critical Rate", value: `${((playerStats.critical_rate ?? 0.05) * 100).toFixed(1)}%` },
                    { label: "Kecepatan Gerak", value: (playerStats.speed ?? 5.0).toFixed(1) },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/[0.01] border border-white/5 rounded-xl">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">{item.label}</span>
                      <span className="text-xs font-black text-white tracking-wide">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enemy Editor Admin Modal (Premium Glassmorphism Overlay) */}
        {showEnemyEditorModal && (
          <div 
            className="fixed inset-0 w-screen h-screen z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto font-sans"
            onClick={() => {
              setShowEnemyEditorModal(false);
              setEditingMonster(null);
            }}
          >
            <div 
              className="w-[850px] max-w-[95vw] h-[600px] max-h-[90vh] bg-zinc-950/90 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
                    <Skull className="w-5 h-5 animate-bounce" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-md font-black tracking-tight uppercase text-white leading-none">PENGELOLA KONFIGURASI MONSTER</h3>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">GORM Database Live Spawner Panel</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingMonster({
                      type: "",
                      name: "",
                      level: 1,
                      hp: 100,
                      max_hp: 100,
                      attack: 10,
                      defense: 5,
                      speed: 2.0,
                      aggro_range: 12.0,
                      gold_drop: 10,
                      xp_drop: 15,
                    })}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-white text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    + Buat Monster Baru
                  </button>
                  <button 
                    onClick={() => {
                      setShowEnemyEditorModal(false);
                      setEditingMonster(null);
                    }}
                    className="w-8 h-8 rounded-full bg-zinc-900/60 hover:bg-zinc-800 hover:text-white text-zinc-500 flex items-center justify-center transition-all active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Notifications */}
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-2.5 rounded-xl animate-pulse">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-2.5 rounded-xl">
                  {successMsg}
                </div>
              )}

              {/* Main Split Layout */}
              <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Left Side: Monster Table / List */}
                <div className="flex-1 bg-zinc-900/30 border border-white/5 rounded-2xl flex flex-col overflow-hidden">
                  <div className="bg-zinc-900/40 px-4 py-2.5 text-[8px] font-black text-zinc-400 uppercase tracking-widest border-b border-white/5 grid grid-cols-12 gap-2">
                    <span className="col-span-3">TIPE / NAMA</span>
                    <span className="col-span-1 text-center">LV</span>
                    <span className="col-span-2 text-right">HP</span>
                    <span className="col-span-1 text-right">ATK</span>
                    <span className="col-span-1 text-right">DEF</span>
                    <span className="col-span-1 text-right">SPD</span>
                    <span className="col-span-3 text-center">AKSI</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 pr-1">
                    {monsterConfigs.length === 0 ? (
                      <div className="text-center py-12 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                        Tidak ada konfigurasi monster di database
                      </div>
                    ) : (
                      monsterConfigs.map((m) => (
                        <div 
                          key={m.type} 
                          className="px-3.5 py-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all grid grid-cols-12 gap-2 items-center text-xs font-bold"
                        >
                          <div className="col-span-3 flex flex-col gap-0.5 min-w-0">
                            <span className="text-white truncate">{m.name || "Tanpa Nama"}</span>
                            <span className="text-[8px] text-cyan-400 uppercase tracking-wider font-black truncate">{m.type}</span>
                          </div>
                          <span className="col-span-1 text-center text-amber-400">{m.level}</span>
                          <span className="col-span-2 text-right text-emerald-400 tracking-wide">{m.hp}</span>
                          <span className="col-span-1 text-right text-red-400">{m.attack}</span>
                          <span className="col-span-1 text-right text-indigo-400">{m.defense}</span>
                          <span className="col-span-1 text-right text-zinc-300">{m.speed?.toFixed(1)}</span>
                          <div className="col-span-3 flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setEditingMonster({ ...m })}
                              className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[8.5px] font-black uppercase tracking-wider transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Apakah Anda yakin ingin menghapus monster "${m.name}"?`)) {
                                  handleDeleteMonsterConfig(m.type);
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[8.5px] font-black uppercase tracking-wider transition-all"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Side: Form (Rendered only when editing/creating) */}
                {editingMonster ? (
                  <div className="w-[300px] bg-zinc-900/30 border border-white/10 p-5 rounded-2xl flex flex-col gap-4 overflow-y-auto animate-in slide-in-from-right-4 duration-150">
                    <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-widest border-b border-white/5 pb-2">
                      {editingMonster.created_at ? "EDIT MONSTER CONFIG" : "CREATOR MONSTER BARU"}
                    </h4>

                    {/* Inputs */}
                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Tipe / Kode Unik</label>
                        <input 
                          type="text" 
                          placeholder="e.g. slime_blue" 
                          value={editingMonster.type}
                          disabled={!!editingMonster.created_at}
                          onChange={(e) => setEditingMonster({ ...editingMonster, type: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                          className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Nama Musuh</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Blue Slime" 
                          value={editingMonster.name}
                          onChange={(e) => setEditingMonster({ ...editingMonster, name: e.target.value })}
                          className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Level</label>
                          <input 
                            type="number" 
                            value={editingMonster.level}
                            onChange={(e) => setEditingMonster({ ...editingMonster, level: parseInt(e.target.value) || 1 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Maks HP</label>
                          <input 
                            type="number" 
                            value={editingMonster.max_hp}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 100;
                              setEditingMonster({ ...editingMonster, max_hp: val, hp: val });
                            }}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Attack</label>
                          <input 
                            type="number" 
                            value={editingMonster.attack}
                            onChange={(e) => setEditingMonster({ ...editingMonster, attack: parseFloat(e.target.value) || 1 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Defense</label>
                          <input 
                            type="number" 
                            value={editingMonster.defense}
                            onChange={(e) => setEditingMonster({ ...editingMonster, defense: parseFloat(e.target.value) || 0 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Kecepatan</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={editingMonster.speed}
                            onChange={(e) => setEditingMonster({ ...editingMonster, speed: parseFloat(e.target.value) || 1.0 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Jarak Aggro</label>
                          <input 
                            type="number" 
                            value={editingMonster.aggro_range}
                            onChange={(e) => setEditingMonster({ ...editingMonster, aggro_range: parseFloat(e.target.value) || 5.0 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Drop Emas</label>
                          <input 
                            type="number" 
                            value={editingMonster.gold_drop}
                            onChange={(e) => setEditingMonster({ ...editingMonster, gold_drop: parseInt(e.target.value) || 0 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Drop XP</label>
                          <input 
                            type="number" 
                            value={editingMonster.xp_drop}
                            onChange={(e) => setEditingMonster({ ...editingMonster, xp_drop: parseInt(e.target.value) || 0 })}
                            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Form Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => setEditingMonster(null)}
                        className="flex-1 py-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 text-[9.5px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleSaveMonsterConfig(editingMonster)}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:brightness-110 active:scale-95 text-white text-[9.5px] font-black uppercase tracking-wider transition-all"
                      >
                        Simpan DB
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-[300px] bg-zinc-900/10 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center text-zinc-500 font-bold uppercase tracking-wider text-xs">
                    <Skull className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                    Pilih salah satu monster untuk mengedit statistik atau buat monster baru!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM-MOST EXP EDGE BAR (Runs full width exactly like Seal M) */}
      <div className="absolute bottom-0 inset-x-0 h-1.5 bg-zinc-950 z-20 flex items-center pointer-events-auto border-t border-white/5">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ width: "40.98%" }}
        />
        <div className="absolute bottom-2 left-6 text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none drop-shadow">
          EXP 40.98%
        </div>
      </div>
    </div>
  );
}

const _preload = (path: string) => useGLTF.preload(API_BASE_URL + path, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
_preload('/assets-model/Chef_Male.glb');
_preload('/assets-model/Chef_Female.glb');
_preload('/assets-model/Knight_Golden_Male.glb');
_preload('/assets-model/Viking_Male.glb');
_preload('/assets-model/Wizard.glb');
_preload('/assets-model/Ninja_Male.glb');
_preload('/assets-model/Cowboy_Female.glb');
_preload('/assets-model/Knight_Golden_Female.glb');
_preload('/assets-model/Viking_Female.glb');
_preload('/assets-model/Witch.glb');
_preload('/assets-model/Ninja_Female.glb');
_preload('/assets-model/Knight_Male.glb');
_preload('/assets-model/Goblin_Male.glb');
_preload('/assets-model/Goblin_Female.glb');
_preload('/assets-model/Zombie_Male.glb');
_preload('/assets-model/Zombie_Female.glb');

