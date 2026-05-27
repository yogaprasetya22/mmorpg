'use client';

import { Sun, SunMoon, CloudFog } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

export const LightingSettingsModule = () => {
  const {
    lightIntensity,
    setLightIntensity,
    ambientIntensity,
    setAmbientIntensity,
    sunAngle,
    setSunAngle,
    fogDensity,
    setFogDensity,
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-4 py-2 font-sans text-zinc-300">
      
      {/* Sun Angle Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
            Sun Angle (Shadows)
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900/80 border border-zinc-800 px-1.5 py-0.5 rounded">{sunAngle}°</span>
        </div>
        <input 
          type="range" min="0" max="360" step="5" 
          value={sunAngle} 
          onChange={(e) => setSunAngle(parseInt(e.target.value))}
          className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Direct Sun Light Intensity */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <SunMoon className="w-3.5 h-3.5 text-orange-400" />
            Direct Sun Light
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900/80 border border-zinc-800 px-1.5 py-0.5 rounded">{(lightIntensity ?? 1.0).toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="range" min="0.1" max="5.0" step="0.1" 
            value={lightIntensity ?? 1.0} 
            onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
          <button 
            onClick={() => setLightIntensity(null)}
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-semibold uppercase tracking-wider cursor-pointer"
          >
            Auto
          </button>
        </div>
      </div>

      {/* Ambient Fill Glow */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <SunMoon className="w-3.5 h-3.5 text-sky-400" />
            Ambient Fill Glow
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900/80 border border-zinc-800 px-1.5 py-0.5 rounded">{(ambientIntensity ?? 1.0).toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="range" min="0.1" max="3.0" step="0.1" 
            value={ambientIntensity ?? 1.0} 
            onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
            className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
          <button 
            onClick={() => setAmbientIntensity(null)}
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-semibold uppercase tracking-wider cursor-pointer"
          >
            Auto
          </button>
        </div>
      </div>

      {/* Depth Fog Density */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <CloudFog className="w-3.5 h-3.5 text-zinc-400" />
            Depth Fog Density
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900/80 border border-zinc-800 px-1.5 py-0.5 rounded">{(fogDensity * 1000).toFixed(1)}k</span>
        </div>
        <input 
          type="range" min="0.0001" max="0.05" step="0.0005" 
          value={fogDensity} 
          onChange={(e) => setFogDensity(parseFloat(e.target.value))}
          className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>

    </div>
  );
};
