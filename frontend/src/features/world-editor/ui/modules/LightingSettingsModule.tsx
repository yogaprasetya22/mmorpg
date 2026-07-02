'use client';

import { useState } from 'react';
import { Sun, SunMoon, CloudFog, Sunrise, Moon, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';

type TimeOfDay = 'pagi' | 'siang' | 'sore' | 'malam';

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
    setSky,
    skyboxIntensity,
    setSkyboxIntensity,
    bloomThreshold,
    setBloomThreshold,
    bloomStrength,
    setBloomStrength,
    bloomRadius,
    setBloomRadius
  } = useEditorStore();

  const [activeTime, setActiveTime] = useState<TimeOfDay | null>(null);

  // Time of Day presets mapping
  const timePresets: Record<TimeOfDay, {
    label: string;
    icon: React.ReactNode;
    color: string;
    sunAngle: number;
    lightIntensity: number;
    ambientIntensity: number;
    fogDensity: number;
    sky: 'clear' | 'sunset' | 'night';
  }> = {
    pagi: {
      label: 'Pagi',
      icon: <Sunrise className="w-4 h-4 text-amber-400" />,
      color: 'from-amber-600/20 to-orange-600/10 border-orange-500/30 text-amber-300',
      sunAngle: 45,
      lightIntensity: 0.7,
      ambientIntensity: 0.5,
      fogDensity: 0.005, // Morning mist
      sky: 'clear'
    },
    siang: {
      label: 'Siang',
      icon: <Sun className="w-4 h-4 text-yellow-400" />,
      color: 'from-yellow-600/20 to-sky-600/10 border-yellow-500/30 text-yellow-300',
      sunAngle: 90,
      lightIntensity: 1.0,
      ambientIntensity: 0.8,
      fogDensity: 0.001, // Crystal clear
      sky: 'clear'
    },
    sore: {
      label: 'Sore',
      icon: <SunMoon className="w-4 h-4 text-orange-400" />,
      color: 'from-orange-600/20 to-rose-600/10 border-orange-500/30 text-orange-300',
      sunAngle: 165,
      lightIntensity: 0.8,
      ambientIntensity: 0.5,
      fogDensity: 0.003, // Golden dust
      sky: 'sunset'
    },
    malam: {
      label: 'Malam',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      color: 'from-indigo-950/40 to-blue-950/20 border-indigo-500/30 text-indigo-300',
      sunAngle: 270,
      lightIntensity: 0.1,
      ambientIntensity: 0.15,
      fogDensity: 0.015, // Night fog
      sky: 'night'
    }
  };

  const handleApplyPreset = (key: TimeOfDay) => {
    setActiveTime(key);
    const preset = timePresets[key];
    setSunAngle(preset.sunAngle);
    setLightIntensity(preset.lightIntensity);
    setAmbientIntensity(preset.ambientIntensity);
    setFogDensity(preset.fogDensity);
    setSky(preset.sky);
  };

  return (
    <div className="flex flex-col gap-4 py-2 font-sans text-zinc-300">
      
      {/* ─── WAKTU HARI (TIME OF DAY) PRESET WHEEL ─── */}
      <div className="flex flex-col gap-1.5">
        <span className="text-zinc-550 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 block">
          Waktu Hari (Time of Day Preset)
        </span>
        <div className="grid grid-cols-4 gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-900">
          {(Object.keys(timePresets) as TimeOfDay[]).map((key) => {
            const preset = timePresets[key];
            const isActive = activeTime === key;
            return (
              <button
                key={key}
                onClick={() => handleApplyPreset(key)}
                className={`py-2 px-1 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer select-none ${
                  isActive 
                    ? `bg-gradient-to-br ${preset.color} shadow-[0_0_10px_rgba(99,102,241,0.2)] scale-95 font-extrabold`
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <div className="transform transition-transform group-hover:scale-110">{preset.icon}</div>
                <span className="text-[7.5px] uppercase tracking-wider">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── FINE-TUNING SLIDERS ─── */}
      <div className="border-t border-zinc-900/50 pt-3 flex flex-col gap-4">
        
        {/* Sun Angle Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-500">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
              Sun Angle (Shadows)
            </span>
            <span className="text-blue-400 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">{sunAngle}°</span>
          </div>
          <input 
            type="range" min="0" max="360" step="5" 
            value={sunAngle} 
            onChange={(e) => {
              setSunAngle(parseInt(e.target.value));
              setActiveTime(null);
            }}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Direct Sun Light Intensity */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <SunMoon className="w-3.5 h-3.5 text-orange-450" />
              Direct Sun Light
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">{(lightIntensity ?? 1.0).toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.1" max="5.0" step="0.1" 
              value={lightIntensity ?? 1.0} 
              onChange={(e) => {
                setLightIntensity(parseFloat(e.target.value));
                setActiveTime(null);
              }}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => {
                setLightIntensity(null);
                setActiveTime(null);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider cursor-pointer"
            >
              Auto
            </button>
          </div>
        </div>

        {/* Ambient Fill Glow */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-450">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <SunMoon className="w-3.5 h-3.5 text-sky-400" />
              Ambient Fill Glow
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">{(ambientIntensity ?? 1.0).toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.1" max="3.0" step="0.1" 
              value={ambientIntensity ?? 1.0} 
              onChange={(e) => {
                setAmbientIntensity(parseFloat(e.target.value));
                setActiveTime(null);
              }}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => {
                setAmbientIntensity(null);
                setActiveTime(null);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider cursor-pointer"
            >
              Auto
            </button>
          </div>
        </div>

        {/* Depth Fog Density */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <CloudFog className="w-3.5 h-3.5 text-zinc-400" />
              Depth Fog Density
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">{(fogDensity * 1000).toFixed(1)}k</span>
          </div>
          <input 
            type="range" min="0.0001" max="0.05" step="0.0005" 
            value={fogDensity} 
            onChange={(e) => {
              setFogDensity(parseFloat(e.target.value));
              setActiveTime(null);
            }}
            className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Skybox Brightness */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-orange-400" />
              Skybox Brightness
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">
              {skyboxIntensity !== null ? skyboxIntensity.toFixed(2) : 'Auto'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.01" max="1.5" step="0.01" 
              value={skyboxIntensity ?? 0.15} 
              onChange={(e) => {
                setSkyboxIntensity(parseFloat(e.target.value));
                setActiveTime(null);
              }}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => {
                setSkyboxIntensity(null);
                setActiveTime(null);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider cursor-pointer"
            >
              Auto
            </button>
          </div>
        </div>

        {/* Bloom / Glare configurations */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Bloom/Glare Strength
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">
              {bloomStrength !== null ? bloomStrength.toFixed(2) : 'Auto (0.35)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.0" max="2.0" step="0.05" 
              value={bloomStrength ?? 0.35} 
              onChange={(e) => {
                setBloomStrength(parseFloat(e.target.value));
                setActiveTime(null);
              }}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => {
                setBloomStrength(null);
                setActiveTime(null);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider cursor-pointer"
            >
              Auto
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Bloom/Glare Radius
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">
              {bloomRadius !== null ? bloomRadius.toFixed(2) : 'Auto (0.40)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.0" max="1.5" step="0.05" 
              value={bloomRadius ?? 0.40} 
              onChange={(e) => {
                setBloomRadius(parseFloat(e.target.value));
                setActiveTime(null);
              }}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => {
                setBloomRadius(null);
                setActiveTime(null);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider cursor-pointer"
            >
              Auto
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-zinc-900/40 pt-3">
          <div className="flex justify-between items-center text-[9.5px] font-bold text-zinc-400">
            <span className="uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Bloom/Glare Threshold
            </span>
            <span className="text-blue-450 font-bold bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded-md font-mono">
              {bloomThreshold !== null ? bloomThreshold.toFixed(2) : 'Auto (1.25)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0.0" max="2.0" step="0.05" 
              value={bloomThreshold ?? 1.25} 
              onChange={(e) => {
                setBloomThreshold(parseFloat(e.target.value));
                setActiveTime(null);
              }}
              className="flex-1 accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => {
                setBloomThreshold(null);
                setActiveTime(null);
              }}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[8px] text-zinc-450 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider cursor-pointer"
            >
              Auto
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
