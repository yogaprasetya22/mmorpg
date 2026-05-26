'use client';

import { Sun, SunMoon, CloudFog, RefreshCw } from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';

export const LightingSettingsModule = () => {
  const {
    sky,
    environment,
    lightIntensity,
    setLightIntensity,
    ambientIntensity,
    setAmbientIntensity,
    sunAngle,
    setSunAngle,
    fogDensity,
    setFogDensity
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-4 py-2 font-mono text-zinc-300">
      
      {/* Sun Angle Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-yellow-500 animate-spin-slow" />
            Sun Angle (Shadows)
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">{sunAngle}°</span>
        </div>
        <input 
          type="range" min="0" max="360" step="5" 
          value={sunAngle} 
          onChange={(e) => setSunAngle(parseInt(e.target.value))}
          className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Direct Sun Intensity Slider */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <SunMoon className="w-3.5 h-3.5 text-orange-400" />
            Direct Sun Light
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            {lightIntensity !== null ? lightIntensity.toFixed(1) : 'Auto'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="range" min="0.0" max="15.0" step="0.1" 
            value={lightIntensity ?? (sky === 'night' ? (environment === 'DIORAMA' ? 2.5 : 0.8) : (environment === 'DIORAMA' ? 15.0 : 2.5))} 
            onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
          {lightIntensity !== null && (
            <button 
              onClick={() => setLightIntensity(null)} 
              className="text-[8px] font-bold bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest flex items-center gap-1"
              title="Reset to default intensity"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              AUTO
            </button>
          )}
        </div>
      </div>

      {/* Ambient Glow Intensity Slider */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-zinc-400" />
            Ambient Fill Glow
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            {ambientIntensity !== null ? ambientIntensity.toFixed(1) : 'Auto'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="range" min="0.0" max="5.0" step="0.1" 
            value={ambientIntensity ?? (sky === 'night' ? (environment === 'DIORAMA' ? 0.8 : 0.2) : (environment === 'DIORAMA' ? 3.5 : 0.8))} 
            onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
            className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
          />
          {ambientIntensity !== null && (
            <button 
              onClick={() => setAmbientIntensity(null)} 
              className="text-[8px] font-bold bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest flex items-center gap-1"
              title="Reset to default ambient glow"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              AUTO
            </button>
          )}
        </div>
      </div>

      {/* Exponential Fog Density Slider */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-3">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <CloudFog className="w-3.5 h-3.5 text-zinc-400" />
            Depth Fog Density
          </span>
          <span className="text-blue-400 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            {(fogDensity * 1000).toFixed(1)}k
          </span>
        </div>
        <input 
          type="range" min="0.0001" max="0.015" step="0.0001" 
          value={fogDensity} 
          onChange={(e) => setFogDensity(parseFloat(e.target.value))}
          className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>

    </div>
  );
};
