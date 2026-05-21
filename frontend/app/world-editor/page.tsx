'use client';

import { useRef } from 'react';
import { GameCanvas } from '@/src/components/game/GameCanvas';

export default function WorldEditorPage() {
  const settingsRef = useRef({
    potatoMode: false,
    vfxQuality: 'HIGH',
  });

  return (
    <main className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden">
      <div className="absolute top-6 left-6 z-[3000] pointer-events-none">
        <h1 className="text-white font-black text-2xl tracking-tighter uppercase italic drop-shadow-lg">
          Seal-M <span className="text-indigo-400">Map Studio</span>
        </h1>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Live Visual Environment Builder</p>
      </div>

      <GameCanvas
        isEditor={true}
        settingsRef={settingsRef}
        isCinematic={false}
        debug={false}
        mapObstacles={[]}
        setMapObstacles={() => {}}
      />
    </main>
  );
}
