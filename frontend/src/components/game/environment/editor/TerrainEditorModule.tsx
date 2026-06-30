'use client';

import { useState } from 'react';
import {
  Mountain,
  Paintbrush,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Eraser,
  SlidersHorizontal,
  Palette,
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  Bookmark
} from 'lucide-react';
import { useEditorStore } from '@/src/state/useEditorStore';
import type { BrushMaskId } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@jagres/shared';

// ─── REUSABLE BRUSH MASK SELECTOR (6 shapes) ───
const MASK_OPTIONS: { id: BrushMaskId; title: string; hotkey: string; icon: React.ReactNode }[] = [
  {
    id: 'softCircle', title: 'Soft Circle Falloff', hotkey: '1',
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
        <defs>
          <radialGradient id="softGlowMask" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#softGlowMask)" />
      </svg>
    ),
  },
  {
    id: 'hardCircle', title: 'Sharp Edge Brush', hotkey: '2',
    icon: <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>,
  },
  {
    id: 'star', title: 'Star Brush', hotkey: '3',
    icon: <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" /></svg>,
  },
  {
    id: 'hexagon', title: 'Hex Column Brush', hotkey: '4',
    icon: <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" /></svg>,
  },
  {
    id: 'starOutline', title: 'Splat Ring Brush', hotkey: '5',
    icon: <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3"><circle cx="12" cy="12" r="8" /></svg>,
  },
  {
    id: 'square', title: 'Block Box Brush', hotkey: '6',
    icon: <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" /></svg>,
  },
];

const BrushMaskSelector = ({ brushMaskId, setBrushMaskId, accentColor = 'blue' }: {
  brushMaskId: BrushMaskId;
  setBrushMaskId: (id: BrushMaskId) => void;
  accentColor?: string;
}) => {
  const activeClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.5)] ring-1 ring-blue-400/30',
    emerald: 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)] ring-1 ring-emerald-400/30',
    rose: 'bg-rose-500/20 border-rose-400 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.5)] ring-1 ring-rose-400/30',
    cyan: 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.5)] ring-1 ring-cyan-400/30',
    amber: 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] ring-1 ring-amber-400/30',
    indigo: 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.5)] ring-1 ring-indigo-400/30',
  };
  const active = activeClasses[accentColor] || activeClasses.blue;

  return (
    <div className="grid grid-cols-6 gap-1 bg-zinc-950/60 p-1 rounded-lg border border-zinc-900">
      {MASK_OPTIONS.map((mask) => (
        <button
          key={mask.id}
          onClick={() => setBrushMaskId(mask.id)}
          title={`${mask.title} (Hotkey: ${mask.hotkey})`}
          className={`h-7 rounded-md border flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 ${brushMaskId === mask.id
              ? `${active} scale-105`
              : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
            }`}
        >
          {mask.icon}
        </button>
      ))}
    </div>
  );
};

// ─── REUSABLE BRUSH SIZE + STRENGTH SLIDERS ───
const BrushSliders = ({ brushSize, setBrushSize, brushStrength, setBrushStrength }: {
  brushSize: number;
  setBrushSize: (n: number) => void;
  brushStrength: number;
  setBrushStrength: (n: number) => void;
}) => (
  <div className="flex flex-col gap-2.5">
    {/* Size */}
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
        <span className="uppercase tracking-wider">Brush size</span>
        <span className="text-blue-400 font-bold">{brushSize}m</span>
      </div>
      <input
        type="range" min="1" max="150" step="1"
        value={brushSize}
        onChange={(e) => setBrushSize(parseInt(e.target.value))}
        className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
      />
    </div>
    {/* Strength */}
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
        <span className="uppercase tracking-wider">Brush intensity</span>
        <span className="text-blue-400 font-bold">{(brushStrength * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range" min="0.01" max="1.0" step="0.01"
        value={brushStrength}
        onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
        className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
      />
    </div>
  </div>
);

// ─── TOOL ACCENT COLORS ───
const TOOL_COLORS: Record<string, { accent: string; label: string; icon: React.ReactNode; maskAccent: string }> = {
  raise: { accent: 'text-emerald-400', label: 'Raise Hills', icon: <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />, maskAccent: 'emerald' },
  lower: { accent: 'text-rose-400', label: 'Lower Valleys', icon: <ArrowDown className="w-3.5 h-3.5 text-rose-500" />, maskAccent: 'rose' },
  smooth: { accent: 'text-cyan-400', label: 'Smooth Slope', icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" />, maskAccent: 'cyan' },
  flatten: { accent: 'text-amber-400', label: 'Flatten Plain', icon: <Eraser className="w-3.5 h-3.5 text-amber-500" />, maskAccent: 'amber' },
  paint: { accent: 'text-indigo-400', label: 'Paint Splat', icon: <Paintbrush className="w-3.5 h-3.5 text-indigo-400" />, maskAccent: 'indigo' },
};

export const TerrainEditorModule = () => {
  const {
    terrainMode,
    setTerrainMode,
    sculptTool,
    setSculptTool,
    terrainConfig,
    setTerrainConfig,
    setSculptData,

    brushSize,
    setBrushSize,
    brushStrength,
    setBrushStrength,
    brushMaskId,
    setBrushMaskId,
    setPaintData,

    savedPaintBlueprints,
    activePaintBlueprintId,
    createPaintBlueprint,
    deletePaintBlueprint,
    applyPaintBlueprint,

    // New v2.0 fields
    flattenTargetHeight,
    setFlattenTargetHeight,
    brushHoverPos,
    activePaintLayer,
    setActivePaintLayer,
    paintLayerMaterials,
    setPaintLayerMaterial,
    paintLayerColors,
    setPaintLayerColor,
  } = useEditorStore();

  const [newBlueprintName, setNewBlueprintName] = useState('');

  const handleSaveBlueprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlueprintName.trim()) return;
    createPaintBlueprint(newBlueprintName.trim(), {
      maskType: brushMaskId,
      textureId: paintLayerMaterials[activePaintLayer],
      brushColor: paintLayerColors[activePaintLayer] || '#3d5c36',
      defaultSize: brushSize,
      defaultIntensity: brushStrength
    });
    setNewBlueprintName('');
  };

  const getMaskIcon = (maskType: string) => {
    switch (maskType) {
      case 'softCircle':
        return (
          <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <defs>
              <radialGradient id="previewSoft" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="10" fill="url(#previewSoft)" />
          </svg>
        );
      case 'hardCircle':
        return <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>;
      case 'star':
        return <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" /></svg>;
      case 'hexagon':
        return <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" /></svg>;
      case 'starOutline':
        return <svg className="w-3.5 h-3.5 text-white/80 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3"><circle cx="12" cy="12" r="8" /></svg>;
      case 'square':
        return <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" /></svg>;
      default:
        return null;
    }
  };

  // Current tool info for label display
  const currentTool = terrainMode === 'paint' ? 'paint' : sculptTool;
  const toolMeta = TOOL_COLORS[currentTool] || TOOL_COLORS.raise;

  return (
    <div className="flex flex-col gap-3 font-sans text-[10px] text-zinc-350">

      {/* ─── MODE TABS ─── */}
      <div className="flex p-0.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[9px] font-medium relative">
        <button
          onClick={() => setTerrainMode('sculpt')}
          className={`flex-1 py-1.5 rounded-md uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none ${terrainMode === 'sculpt'
              ? 'bg-zinc-900 text-white font-bold border border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
        >
          <Mountain className="w-3.5 h-3.5 text-zinc-400" /> Height sculpt
        </button>
        <button
          onClick={() => setTerrainMode('paint')}
          className={`flex-1 py-1.5 rounded-md uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none ${terrainMode === 'paint'
              ? 'bg-zinc-900 text-white font-bold border border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
        >
          <Paintbrush className="w-3.5 h-3.5 text-zinc-400" /> Paint splat
        </button>
      </div>

      {/* ────────────────── HEIGHT SCULPT TAB ────────────────── */}
      {terrainMode === 'sculpt' && (
        <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">

          {/* Tool Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-zinc-500" />
              Sculpting Tool
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-900">
              {(['raise', 'lower', 'smooth', 'flatten'] as const).map((tool) => {
                const meta = TOOL_COLORS[tool];
                const isActive = sculptTool === tool;
                const toolAccentMap: Record<string, string> = {
                  raise: 'emerald', lower: 'rose', smooth: 'cyan', flatten: 'amber'
                };
                const accent = toolAccentMap[tool];
                return (
                  <button
                    key={tool}
                    onClick={() => setSculptTool(tool)}
                    className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 border text-[9px] cursor-pointer select-none ${isActive
                        ? `bg-${accent}-600/10 border-${accent}-500/30 ${meta.accent} font-black shadow-[0_0_12px_rgba(0,0,0,0.1)]`
                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                      }`}
                    style={isActive ? {
                      backgroundColor: accent === 'emerald' ? 'rgba(16,185,129,0.08)' : accent === 'rose' ? 'rgba(244,63,94,0.08)' : accent === 'cyan' ? 'rgba(6,182,212,0.08)' : 'rgba(245,158,11,0.08)',
                      borderColor: accent === 'emerald' ? 'rgba(16,185,129,0.25)' : accent === 'rose' ? 'rgba(244,63,94,0.25)' : accent === 'cyan' ? 'rgba(6,182,212,0.25)' : 'rgba(245,158,11,0.25)',
                    } : undefined}
                  >
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── PER-TOOL BRUSH STROKE (mask + size + strength) ─── */}
          <div className="flex flex-col gap-2.5 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest flex items-center gap-1">
              <Eye className="w-3 h-3 text-zinc-500" />
              <span className={toolMeta.accent}>{toolMeta.label}</span>
              <span className="text-zinc-600">— Brush Stroke</span>
            </span>

            <BrushMaskSelector
              brushMaskId={brushMaskId}
              setBrushMaskId={setBrushMaskId}
              accentColor={toolMeta.maskAccent}
            />

            <BrushSliders
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              brushStrength={brushStrength}
              setBrushStrength={setBrushStrength}
            />

            {sculptTool === 'flatten' && (
              <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-2.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                  <span className="uppercase tracking-wider">Flatten Target Height</span>
                  <span className="text-amber-400 font-mono font-bold">{flattenTargetHeight}m</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    value={flattenTargetHeight}
                    onChange={(e) => setFlattenTargetHeight(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-zinc-900/60 border border-zinc-850 rounded px-2 py-1 text-[8.5px] text-zinc-300 font-bold focus:border-amber-500 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (brushHoverPos) {
                        setFlattenTargetHeight(parseFloat(brushHoverPos[1].toFixed(2)));
                      } else {
                        alert("Hover cursor over terrain first to sample height!");
                      }
                    }}
                    className="px-2 bg-amber-500/10 hover:bg-amber-500 border border-amber-500/20 hover:border-amber-500 text-amber-400 hover:text-white rounded text-[8px] font-bold transition-all uppercase tracking-wide cursor-pointer select-none active:scale-95"
                  >
                    Sample
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Procedural Generators */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-3">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-zinc-500" />
              Procedural Generators
            </span>
            <div className="grid grid-cols-4 gap-1.5 bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-900">
              {[
                { label: 'Plains', height: 4, scale: 0.01, seed: 12 },
                { label: 'Hills', height: 18, scale: 0.05, seed: 42 },
                { label: 'Peaks', height: 50, scale: 0.12, seed: 250 },
                { label: 'Crater', height: 32, scale: 0.03, seed: 99 }
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setTerrainConfig({ height: preset.height, scale: preset.scale, seed: preset.seed })}
                  className="py-1 bg-zinc-900 border border-zinc-800/80 hover:bg-blue-600 hover:border-blue-500 hover:text-white rounded-md text-[8.5px] font-semibold uppercase transition-all duration-200 cursor-pointer select-none"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Terrain Config Sliders */}
          <div className="flex flex-col gap-3 border-t border-zinc-900/50 pt-3 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Peak Heights</span>
                <span className="text-blue-400 font-extrabold">{terrainConfig.height.toFixed(0)}m</span>
              </div>
              <input type="range" min="0" max="100" step="1" value={terrainConfig.height} onChange={(e) => setTerrainConfig({ height: parseFloat(e.target.value) })} className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Terrain Scale</span>
                <span className="text-blue-400 font-mono font-bold">x{terrainConfig.scale.toFixed(2)}</span>
              </div>
              <input type="range" min="0.01" max="2" step="0.01" value={terrainConfig.scale} onChange={(e) => setTerrainConfig({ scale: parseFloat(e.target.value) })} className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Noise World Seed</span>
                <span className="text-blue-400 font-mono font-bold">#{terrainConfig.seed}</span>
              </div>
              <input type="range" min="0" max="1000" step="1" value={terrainConfig.seed} onChange={(e) => setTerrainConfig({ seed: parseInt(e.target.value) })} className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Peak Sharpness</span>
                <span className="text-blue-400 font-mono font-bold">{(terrainConfig.sharpness ?? 2.0).toFixed(1)}</span>
              </div>
              <input type="range" min="1.0" max="4.0" step="0.1" value={terrainConfig.sharpness ?? 2.0} onChange={(e) => setTerrainConfig({ sharpness: parseFloat(e.target.value) })} className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer" />
            </div>
          </div>

          {/* Shortcut hint */}
          <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[8px] leading-relaxed text-zinc-500 select-none">
            <strong className="text-zinc-400">Shortcut:</strong> Tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800 font-mono text-[8px]">Shift + Drag</kbd> untuk membalik arah pahat (Raise ⇄ Lower).
            <br />
            <strong className="text-zinc-400">Per-tool:</strong> Setiap tool menyimpan brush mask, size & strength sendiri.
          </div>

          {/* Flatten All */}
          <div className="flex gap-2 border-t border-zinc-900/50 pt-3">
            <button
              onClick={() => { if (confirm("Ratakan seluruh kontur ketinggian tanah menjadi datar?")) setSculptData(null); }}
              className="w-full py-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-450 hover:text-white rounded-lg transition-all duration-200 font-bold uppercase tracking-wide text-center cursor-pointer select-none"
            >
              Flatten All Heights
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── PAINT SPLAT TAB ────────────────── */}
      {terrainMode === 'paint' && (
        <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">

          {/* ─── PER-TOOL BRUSH STROKE (mask + size + strength) ─── */}
          <div className="flex flex-col gap-2.5 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest flex items-center gap-1">
              <Eye className="w-3 h-3 text-zinc-500" />
              <span className={toolMeta.accent}>{toolMeta.label}</span>
              <span className="text-zinc-600">— Brush Stroke</span>
            </span>

            <BrushMaskSelector
              brushMaskId={brushMaskId}
              setBrushMaskId={setBrushMaskId}
              accentColor={toolMeta.maskAccent}
            />

            <BrushSliders
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              brushStrength={brushStrength}
              setBrushStrength={setBrushStrength}
            />
          </div>

          {/* Blueprint Library */}
          <div className="flex flex-col gap-2.5 bg-zinc-950/70 p-3 rounded-xl border border-zinc-900/80 shadow-inner">
            <span className="text-zinc-400 font-extrabold uppercase text-[8px] tracking-widest pl-0.5 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-blue-500" />
              Paint Blueprint Library
            </span>

            {savedPaintBlueprints.length === 0 ? (
              <div className="py-3 px-2 border border-dashed border-zinc-900 rounded-lg text-center text-zinc-600 text-[8.5px] italic">
                No custom presets saved. Create one below!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-0.5">
                {savedPaintBlueprints.map((blueprint) => {
                  const material = FULL_MATERIAL_LIBRARY.find(m => m.id === blueprint.textureId);
                  const isActive = activePaintBlueprintId === blueprint.id;
                  return (
                    <div
                      key={blueprint.id}
                      onClick={() => applyPaintBlueprint(blueprint.id)}
                      className={`group relative flex items-center gap-2 p-2 bg-zinc-900/40 hover:bg-zinc-900 border rounded-xl transition-all cursor-pointer select-none ${isActive
                          ? 'border-blue-500/70 bg-blue-500/[0.04] shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                          : 'border-zinc-900 hover:border-zinc-800'
                        }`}
                    >
                      <div className="w-7 h-7 rounded-lg border border-zinc-800/80 flex items-center justify-center relative overflow-hidden flex-shrink-0" style={{ backgroundColor: blueprint.brushColor }}>
                        {material?.diffuse && (
                          <img src={material.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply" alt="" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                          {getMaskIcon(blueprint.maskType)}
                        </div>
                      </div>
                      <div className="flex flex-col truncate flex-1 leading-tight">
                        <span className={`text-[8.5px] font-black truncate uppercase ${isActive ? 'text-blue-400' : 'text-zinc-200'}`}>
                          {blueprint.name}
                        </span>
                        <span className="text-[7.5px] text-zinc-500 font-mono uppercase tracking-tighter">
                          {blueprint.defaultSize}m • {(blueprint.defaultIntensity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePaintBlueprint(blueprint.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 rounded-md transition-all self-center absolute right-1.5 cursor-pointer z-10"
                        title="Delete Preset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSaveBlueprint} className="flex gap-1.5 border-t border-zinc-900/50 pt-2.5">
              <input
                type="text"
                value={newBlueprintName}
                onChange={(e) => setNewBlueprintName(e.target.value)}
                placeholder="Blueprint Name..."
                className="flex-1 bg-zinc-900/70 border border-zinc-850 rounded-lg px-2 py-1 text-[8.5px] text-zinc-300 font-semibold focus:border-blue-500 outline-none"
              />
              <button type="submit" className="px-2.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/25 hover:border-blue-500 text-blue-400 hover:text-white rounded-lg text-[8.5px] font-extrabold transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none active:scale-95">
                <Plus className="w-3 h-3" /> Save
              </button>
            </form>
          </div>

          {/* ─── 4-LAYER SPLAT LAYER SELECTOR ─── */}
          <div className="flex flex-col gap-2 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
              <Palette className="w-3 h-3 text-indigo-400" />
              Splat Layer Editor
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((layerIdx) => {
                const matId = paintLayerMaterials[layerIdx];
                const color = paintLayerColors[layerIdx];
                const material = FULL_MATERIAL_LIBRARY.find(m => m.id === matId);
                const isActive = activePaintLayer === layerIdx;
                return (
                  <button
                    key={layerIdx}
                    onClick={() => setActivePaintLayer(layerIdx as any)}
                    className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all relative overflow-hidden cursor-pointer select-none ${isActive
                        ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30'
                      }`}
                  >
                    <div className="w-8 h-8 rounded-lg border border-zinc-800/80 flex items-center justify-center relative overflow-hidden flex-shrink-0" style={{ backgroundColor: color || '#3d5c36' }}>
                      {material?.diffuse && (
                        <img src={material.diffuse} className="absolute inset-0 w-full h-full object-cover" alt="" />
                      )}
                    </div>
                    <span className="text-[7.5px] font-black text-zinc-400">Layer {layerIdx}</span>
                    <span className="text-[6.5px] scale-90 text-zinc-500 truncate max-w-full">
                      {material ? material.name : 'Solid'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Layer Configuration Panel */}
            <div className="mt-2 p-2 bg-zinc-950/85 rounded-lg border border-zinc-900 flex flex-col gap-2">
              <div className="flex justify-between items-center text-[7.5px] font-bold text-zinc-550 uppercase tracking-widest">
                <span>Configure Layer {activePaintLayer}</span>
                <span className="text-indigo-400 font-extrabold">
                  {paintLayerMaterials[activePaintLayer] ? 'Texture Splat Mode' : 'Solid Color Mode'}
                </span>
              </div>

              {/* Toggle material or solid */}
              <div className="grid grid-cols-2 gap-1.5 text-[8px] font-bold">
                <button
                  onClick={() => setPaintLayerMaterial(activePaintLayer, null)}
                  className={`py-1 rounded border transition-all cursor-pointer select-none ${!paintLayerMaterials[activePaintLayer]
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-extrabold'
                      : 'border-transparent text-zinc-500 hover:bg-zinc-900'
                    }`}
                >
                  Solid Color
                </button>
                <button
                  onClick={() => setPaintLayerMaterial(activePaintLayer, FULL_MATERIAL_LIBRARY[0].id)}
                  className={`py-1 rounded border transition-all cursor-pointer select-none ${paintLayerMaterials[activePaintLayer]
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-extrabold'
                      : 'border-transparent text-zinc-500 hover:bg-zinc-900'
                    }`}
                >
                  Texture Material
                </button>
              </div>

              {/* Texture material selection grid if texture active */}
              {paintLayerMaterials[activePaintLayer] ? (
                <div className="grid grid-cols-3 gap-1 mt-1 border-t border-zinc-900 pt-2">
                  {FULL_MATERIAL_LIBRARY.map((mat) => (
                    <button
                      key={mat.id}
                      onClick={() => setPaintLayerMaterial(activePaintLayer, mat.id)}
                      className={`h-8 rounded border transition-all relative overflow-hidden cursor-pointer select-none ${paintLayerMaterials[activePaintLayer] === mat.id
                          ? 'border-indigo-500 shadow'
                          : 'border-transparent hover:border-zinc-700'
                        }`}
                    >
                      {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-transparent transition-colors">
                        <span className="text-[7.5px] font-black uppercase text-white truncate max-w-full px-0.5">{mat.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* Color swatches if solid active */
                <div className="flex flex-col gap-1.5 mt-1 border-t border-zinc-900 pt-2">
                  <div className="flex gap-1.5 items-center overflow-x-auto custom-scrollbar">
                    {['#3d5c36', '#7c6a4a', '#5a4d3a', '#e8e0d0', '#2d3e4d', '#fca311', '#d00000', '#ffffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => setPaintLayerColor(activePaintLayer, c)}
                        className={`w-5.5 h-5.5 rounded border transition-all cursor-pointer select-none flex-shrink-0 hover:scale-110 active:scale-95 ${paintLayerColors[activePaintLayer] === c
                            ? 'border-indigo-400 scale-105 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                            : 'border-zinc-800 hover:border-zinc-600'
                          }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={paintLayerColors[activePaintLayer] || '#3d5c36'}
                      onChange={(e) => setPaintLayerColor(activePaintLayer, e.target.value)}
                      className="w-5.5 h-5.5 rounded bg-transparent border-none p-0 overflow-hidden cursor-pointer flex-shrink-0 hover:scale-110 active:scale-95"
                      title="Custom Hex Picker"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reset Paint */}
          <div className="flex gap-2 border-t border-zinc-900/50 pt-3">
            <button
              onClick={() => { if (confirm("Reset seluruh warna cat dan splat di atas kanvas tanah?")) setPaintData(null); }}
              className="w-full py-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white rounded-lg transition-all duration-200 font-bold uppercase tracking-wide text-center cursor-pointer select-none"
            >
              Reset Splat Canvas
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
