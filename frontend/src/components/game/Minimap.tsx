import React, { useEffect, useRef } from "react";
import { PlayerNetworkState, MonsterNetworkState } from "@/src/hooks/useWebSocketGame";

interface MinimapProps {
  connectedPlayersRef: React.MutableRefObject<PlayerNetworkState[]>;
  worldMonstersRef: React.MutableRefObject<MonsterNetworkState[]>;
  localPlayerId: string;
  mapId: string;
}

export const Minimap: React.FC<MinimapProps> = ({
  connectedPlayersRef,
  worldMonstersRef,
  localPlayerId,
  mapId,
}) => {
  const playerArrowRef = useRef<SVGSVGElement>(null);
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<HTMLSpanElement>(null);

  // Define map visibility range (50 meters radius)
  const MAP_RANGE = 55.0;

  useEffect(() => {
    let active = true;

    // Pools to eliminate frame allocations
    const maxMonsters = 35;
    const maxPlayers = 12;

    const monsterDots: HTMLDivElement[] = [];
    const playerDots: HTMLDivElement[] = [];
    const monsterDotTypes: string[] = new Array(maxMonsters).fill('');

    const dotsContainer = dotsContainerRef.current;
    if (dotsContainer) {
      dotsContainer.innerHTML = "";

      // 1. Pre-instantiate monster dots pool
      for (let i = 0; i < maxMonsters; i++) {
        const el = document.createElement("div");
        el.className = "absolute w-2 h-2 rounded-full pointer-events-auto cursor-help border border-black/60 shadow-md";
        el.style.display = "none";
        dotsContainer.appendChild(el);
        monsterDots.push(el);
      }

      // 2. Pre-instantiate player dots pool
      for (let i = 0; i < maxPlayers; i++) {
        const el = document.createElement("div");
        el.className = "absolute w-2 h-2 rounded-full pointer-events-auto cursor-help bg-cyan-300 border border-black shadow-[0_0_5px_rgba(34,211,238,0.85)] z-20";
        el.style.display = "none";
        dotsContainer.appendChild(el);
        playerDots.push(el);
      }
    }

    const updateLoop = () => {
      if (!active) return;

      const localPos = (window as any).localPlayerPos;
      const localRot = (window as any).localPlayerRotation ?? 0;

      if (!localPos) {
        requestAnimationFrame(updateLoop);
        return;
      }

      // Update coordinates text ref directly
      if (coordsRef.current) {
        coordsRef.current.innerText = `${Math.round(localPos.x)}, ${Math.round(localPos.z)}`;
      }

      const px = localPos.x;
      const pz = localPos.z;

      // 1. Update player center arrow angle
      if (playerArrowRef.current) {
        const adjustedRot = localRot - Math.PI;
        const deg = (adjustedRot * 180) / Math.PI;
        playerArrowRef.current.style.transform = `translate(-50%, -50%) rotate(${-deg}deg)`;
      }

      // 2. Render relative monster positions
      const monsters = worldMonstersRef.current || [];
      let monsterIdx = 0;

      for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        if (m.is_dead || monsterIdx >= maxMonsters) continue;

        const dx = m.x - px;
        const dz = m.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= MAP_RANGE) {
          const el = monsterDots[monsterIdx];
          if (el) {
            const xPct = 50 + (dx / MAP_RANGE) * 50;
            const zPct = 50 + (dz / MAP_RANGE) * 50;

            el.style.left = `${xPct}%`;
            el.style.top = `${zPct}%`;
            el.style.display = "block";

            const isBoss = m.type === "boss";
            const typeKey = isBoss ? 'boss' : 'normal';
            if (monsterDotTypes[monsterIdx] !== typeKey) {
              monsterDotTypes[monsterIdx] = typeKey;
              if (isBoss) {
                el.className = "absolute w-3 h-3 rounded-full bg-rose-600 border border-yellow-300 shadow-[0_0_12px_rgba(225,29,72,0.9)] animate-pulse z-30 pointer-events-auto cursor-help";
              } else {
                el.className = "absolute w-2 h-2 rounded-full bg-rose-500 border border-black/80 shadow-[0_0_5px_rgba(244,63,94,0.7)] z-10 pointer-events-auto cursor-help";
              }
            }
            if (isBoss) {
              el.title = `👑 ${m.name} (Lvl 50 Boss) - HP: ${Math.round(m.hp)}/${m.max_hp}`;
            } else {
              el.title = `${m.name} (Lvl 15) - HP: ${Math.round(m.hp)}/${m.max_hp}`;
            }

            monsterIdx++;
          }
        }
      }

      // Hide unused monster dots
      for (let i = monsterIdx; i < maxMonsters; i++) {
        if (monsterDots[i]) monsterDots[i].style.display = "none";
      }

      // 3. Render relative player positions
      const players = connectedPlayersRef.current || [];
      let playerIdx = 0;

      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.id === localPlayerId || playerIdx >= maxPlayers) continue;

        const dx = p.x - px;
        const dz = p.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= MAP_RANGE) {
          const el = playerDots[playerIdx];
          if (el) {
            const xPct = 50 + (dx / MAP_RANGE) * 50;
            const zPct = 50 + (dz / MAP_RANGE) * 50;

            el.style.left = `${xPct}%`;
            el.style.top = `${zPct}%`;
            el.style.display = "block";
            el.title = `👤 ${p.username || "Pemain Lain"}`;

            playerIdx++;
          }
        }
      }

      // Hide unused player dots
      for (let i = playerIdx; i < maxPlayers; i++) {
        if (playerDots[i]) playerDots[i].style.display = "none";
      }

      requestAnimationFrame(updateLoop);
    };

    requestAnimationFrame(updateLoop);

    return () => {
      active = false;
    };
  }, [connectedPlayersRef, worldMonstersRef, localPlayerId, MAP_RANGE]);

  return (
    <div className="relative flex flex-col items-center select-none pointer-events-auto">
      {/* Title above minimap */}
      <span className="text-[10px] font-black text-white tracking-widest drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)] mb-1">
        {mapId === "Starter Zone" ? "Tower Stage !" : mapId.replace(/[-_]/g, ' ').toUpperCase()}
      </span>

      {/* Circle Minimap */}
      <div className="w-[105px] h-[105px] rounded-full bg-black/40 backdrop-blur-md border-2 border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.5)] overflow-hidden relative">
        
        {/* Radar grids & Concentric Circles */}
        <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" stroke="#ffffff" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="50" r="32" stroke="#ffffff" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="50" r="16" stroke="#ffffff" strokeWidth="0.5" fill="none" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="1,2" />
          <line x1="50" y1="2" x2="50" y2="98" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="1,2" />
        </svg>

        {/* Real-time Dynamic Dots Container */}
        <div ref={dotsContainerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Player arrow in center */}
        <svg
          ref={playerArrowRef}
          className="absolute top-1/2 left-1/2 w-4 h-4 text-[#38bdf8] drop-shadow-[0_0_5px_rgba(56,189,248,0.95)] z-40 transition-transform duration-75 ease-out pointer-events-none"
          style={{ transform: "translate(-50%, -50%) rotate(0deg)" }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L2 22l10-6 10 6L12 2z" />
        </svg>

        {/* Sweep effect */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-10">
          <div
            className="absolute top-0 left-1/2 w-[52px] h-[52px] origin-bottom-left animate-spin"
            style={{ animationDuration: "3.5s" }}
          >
            <div
              className="w-full h-[1.5px] bg-gradient-to-r from-cyan-400/40 to-transparent"
              style={{ transformOrigin: "0 100%", transform: "rotate(-45deg)" }}
            />
          </div>
        </div>
      </div>

      {/* Coordinate Readout below minimap */}
      <div className="mt-1 flex items-center justify-center pointer-events-none z-20">
        <span ref={coordsRef} className="text-[10px] font-black text-zinc-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] tracking-wide">
          0, 0
        </span>
      </div>
    </div>
  );
};
