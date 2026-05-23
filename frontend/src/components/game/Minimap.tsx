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

  // Define dynamic map visibility range in world units (50 meters radius)
  const MAP_RANGE = 55.0;

  useEffect(() => {
    let active = true;

    // Pool up to 35 monster dots and 12 player dots to eliminate frame allocations
    const maxMonsters = 35;
    const maxPlayers = 12;

    const monsterDots: HTMLDivElement[] = [];
    const playerDots: HTMLDivElement[] = [];

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

      const px = localPos.x;
      const pz = localPos.z;

      // 1. Update player center arrow angle (North-up coordinate system)
      if (playerArrowRef.current) {
        // Offset by Math.PI (180 degrees) since Math.atan2(fwd.x, fwd.z) in PlayerController
        // is out of phase by exactly 180 degrees relative to 2D North-up vector.
        const adjustedRot = localRot - Math.PI;
        const deg = (adjustedRot * 180) / Math.PI;
        // Invert for clockwise 2D SVG canvas rotation
        playerArrowRef.current.style.transform = `translate(-50%, -50%) rotate(${-deg}deg)`;
      }

      // 2. Render actual, relative monster positions
      const monsters = worldMonstersRef.current || [];
      let monsterIdx = 0;

      for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        if (m.is_dead || monsterIdx >= maxMonsters) continue;

        // Relative delta
        const dx = m.position.x - px;
        const dz = m.position.z - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= MAP_RANGE) {
          const el = monsterDots[monsterIdx];
          if (el) {
            // Map [-MAP_RANGE, MAP_RANGE] to percent coordinates [0%, 100%]
            const xPct = 50 + (dx / MAP_RANGE) * 50;
            const zPct = 50 + (dz / MAP_RANGE) * 50;

            el.style.left = `${xPct}%`;
            el.style.top = `${zPct}%`;
            el.style.display = "block";

            // Stylize based on type: larger pulsating dot for legendary Boss
            if (m.type === "boss") {
              el.className = "absolute w-3 h-3 rounded-full bg-rose-600 border border-yellow-300 shadow-[0_0_12px_rgba(225,29,72,0.9)] animate-pulse z-30 pointer-events-auto cursor-help";
              el.title = `👑 ${m.name} (Lvl 50 Boss) - HP: ${Math.round(m.hp)}/${m.max_hp}`;
            } else {
              el.className = "absolute w-2 h-2 rounded-full bg-rose-500 border border-black/80 shadow-[0_0_5px_rgba(244,63,94,0.7)] z-10 pointer-events-auto cursor-help";
              el.title = `${m.name} (Lvl 15) - HP: ${Math.round(m.hp)}/${m.max_hp}`;
            }

            monsterIdx++;
          }
        }
      }

      // Hide remaining unused monster dots
      for (let i = monsterIdx; i < maxMonsters; i++) {
        if (monsterDots[i]) monsterDots[i].style.display = "none";
      }

      // 3. Render actual, relative player positions
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

      // Hide remaining unused player dots
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
    <div className="relative w-[110px] h-[110px]">
      {/* Outer Glow Ring & Glassmorphism Backing */}
      <div className="w-full h-full rounded-full bg-[#041208]/92 border-2 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.3)] overflow-hidden relative">
        
        {/* Radar grids & Concentric Circles */}
        <svg className="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" stroke="#10b981" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="50" r="32" stroke="#10b981" strokeWidth="0.5" fill="none" />
          <circle cx="50" cy="50" r="16" stroke="#10b981" strokeWidth="0.5" fill="none" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="#10b981" strokeWidth="0.5" strokeDasharray="1,2" />
          <line x1="50" y1="2" x2="50" y2="98" stroke="#10b981" strokeWidth="0.5" strokeDasharray="1,2" />
        </svg>

        {/* Real-time Dynamic Dots Container */}
        <div ref={dotsContainerRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Player arrow in center */}
        <svg
          ref={playerArrowRef}
          className="absolute top-1/2 left-1/2 w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.9)] z-40 transition-transform duration-75 ease-out pointer-events-none"
          style={{ transform: "translate(-50%, -50%) rotate(0deg)" }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L2 22l10-6 10 6L12 2z" />
        </svg>

        {/* Radar Sweep sweep animation */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none z-10">
          <div
            className="absolute top-0 left-1/2 w-[55px] h-[55px] origin-bottom-left animate-spin"
            style={{ animationDuration: "3.5s" }}
          >
            <div
              className="w-full h-[2px] bg-gradient-to-r from-emerald-400/80 to-transparent"
              style={{ transformOrigin: "0 100%", transform: "rotate(-45deg)" }}
            />
          </div>
        </div>
      </div>

      {/* Map Zone Text Label */}
      <div className="absolute -bottom-3 left-0 right-0 text-center pointer-events-none z-20">
        <span className="text-[7.5px] font-black text-emerald-300 uppercase tracking-widest bg-black/85 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          {mapId?.toUpperCase() ?? "ZONE"}
        </span>
      </div>
    </div>
  );
};
