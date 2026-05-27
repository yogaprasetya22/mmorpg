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
import { FULL_MATERIAL_LIBRARY } from '@/src/core/logic/environment/assetRegistry';

export const TerrainEditorModule = () => {
  const {
    terrainMode,
    setTerrainMode,
    sculptTool,
    setSculptTool,
    terrainConfig,
    setTerrainConfig,
    setSculptData,
    
    // Paint states
    brushSize,
    setBrushSize,
    brushStrength,
    setBrushStrength,
    brushColor,
    setBrushColor,
    brushTextureId,
    setBrushTextureId,
    brushMaskId,
    setBrushMaskId,
    terrainColor,
    setTerrainColor,
    terrainMaterialId,
    setTerrainMaterialId,
    setPaintData,

    // Blueprint states & actions
    savedPaintBlueprints,
    activePaintBlueprintId,
    createPaintBlueprint,
    deletePaintBlueprint,
    applyPaintBlueprint
  } = useEditorStore();

  const [newBlueprintName, setNewBlueprintName] = useState('');

  const handleSaveBlueprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlueprintName.trim()) return;
    createPaintBlueprint(newBlueprintName.trim(), {
      maskType: brushMaskId,
      textureId: brushTextureId,
      brushColor: brushColor,
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
        return (
          <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="8" />
          </svg>
        );
      case 'star':
        return (
          <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
          </svg>
        );
      case 'hexagon':
        return (
          <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
          </svg>
        );
      case 'starOutline':
        return (
          <svg className="w-3.5 h-3.5 text-white/80 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3">
            <circle cx="12" cy="12" r="8" />
          </svg>
        );
      case 'square':
        return (
          <svg className="w-3.5 h-3.5 text-white/80 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-3 font-sans text-[10px] text-zinc-350">
      
      {/* SHADCN-STYLE SEGMENTED CONTROL TABS */}
      <div className="flex p-0.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[9px] font-medium relative">
        <button
          onClick={() => setTerrainMode('sculpt')}
          className={`flex-1 py-1.5 rounded-md uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none ${
            terrainMode === 'sculpt' 
              ? 'bg-zinc-900 text-white font-bold border border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.4)]' 
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          <Mountain className="w-3.5 h-3.5 text-zinc-400" /> Height sculpt
        </button>
        <button
          onClick={() => setTerrainMode('paint')}
          className={`flex-1 py-1.5 rounded-md uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none ${
            terrainMode === 'paint' 
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
          
          {/* Tool Modes */}
          <div className="flex flex-col gap-1.5">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-zinc-500" />
              Sculpting Brush Mode
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-900">
              <button
                onClick={() => setSculptTool('raise')}
                className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 border text-[9px] cursor-pointer select-none ${
                  sculptTool === 'raise' 
                    ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 font-black shadow-[0_0_12px_rgba(16,185,129,0.1)]' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> Raise Hills
              </button>
              <button
                onClick={() => setSculptTool('lower')}
                className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 border text-[9px] cursor-pointer select-none ${
                  sculptTool === 'lower' 
                    ? 'bg-rose-600/10 border-rose-500/30 text-rose-450 font-black shadow-[0_0_12px_rgba(244,63,94,0.1)]' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5 text-rose-500" /> Lower Valleys
              </button>
              <button
                onClick={() => setSculptTool('smooth')}
                className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 border text-[9px] cursor-pointer select-none ${
                  sculptTool === 'smooth' 
                    ? 'bg-cyan-600/10 border-cyan-500/30 text-cyan-400 font-black shadow-[0_0_12px_rgba(6,182,212,0.1)]' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Smooth Slope
              </button>
              <button
                onClick={() => setSculptTool('flatten')}
                className={`py-1.5 rounded-md text-center transition-all flex items-center justify-center gap-1.5 border text-[9px] cursor-pointer select-none ${
                  sculptTool === 'flatten' 
                    ? 'bg-amber-600/10 border-amber-500/30 text-amber-400 font-black shadow-[0_0_12px_rgba(245,158,11,0.1)]' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <Eraser className="w-3.5 h-3.5 text-amber-500" /> Flatten Plain
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
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
                  onClick={() => {
                    setTerrainConfig({ height: preset.height, scale: preset.scale, seed: preset.seed });
                  }}
                  className="py-1 bg-zinc-900 border border-zinc-800/80 hover:bg-blue-600 hover:border-blue-500 hover:text-white rounded-md text-[8.5px] font-semibold uppercase transition-all duration-200 cursor-pointer select-none"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Config Sliders - Poin 2: Brush Radius & Peak Heights dipindah ke sini */}
          <div className="flex flex-col gap-3.5 border-t border-zinc-900/50 pt-3 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
            {/* Brush Size */}
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

            {/* Peak Heights */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Peak Heights</span>
                <span className="text-blue-450 font-extrabold">{terrainConfig.height.toFixed(0)}m</span>
              </div>
              <input 
                type="range" min="0" max="100" step="1" 
                value={terrainConfig.height} 
                onChange={(e) => setTerrainConfig({ height: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Terrain Scale */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Terrain Scale</span>
                <span className="text-blue-400 font-mono font-bold">x{terrainConfig.scale.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0.01" max="2" step="0.01" 
                value={terrainConfig.scale} 
                onChange={(e) => setTerrainConfig({ scale: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* World Seed */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Noise World Seed</span>
                <span className="text-blue-450 font-mono font-bold">#{terrainConfig.seed}</span>
              </div>
              <input 
                type="range" min="0" max="1000" step="1" 
                value={terrainConfig.seed} 
                onChange={(e) => setTerrainConfig({ seed: parseInt(e.target.value) })}
                className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Peak Sharpness */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Peak Sharpness</span>
                <span className="text-blue-450 font-mono font-bold">{(terrainConfig.sharpness ?? 2.0).toFixed(1)}</span>
              </div>
              <input 
                type="range" min="1.0" max="4.0" step="0.1" 
                value={terrainConfig.sharpness ?? 2.0} 
                onChange={(e) => setTerrainConfig({ sharpness: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 hover:accent-blue-400 h-1 bg-zinc-900 rounded appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Quick instructions */}
          <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900 text-[8px] leading-relaxed text-zinc-500 select-none">
            <span>
              <strong className="text-zinc-400">Shortcut:</strong> Tahan <kbd className="bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800 font-mono text-[8px]">Shift + Drag</kbd> untuk membalik arah pahat (Raise ⇄ Lower).
            </span>
          </div>

          {/* Operations */}
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
          
          {/* Poin 4 & 5: Save & Create Paint Blueprint Preset Section */}
          <div className="flex flex-col gap-2.5 bg-zinc-950/70 p-3 rounded-xl border border-zinc-900/80 shadow-inner">
            <span className="text-zinc-400 font-extrabold uppercase text-[8px] tracking-widest pl-0.5 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-blue-500" />
              Paint Blueprint Library
            </span>

            {/* Presets List Grid */}
            {savedPaintBlueprints.length === 0 ? (
              <div className="py-3 px-2 border border-dashed border-zinc-900 rounded-lg text-center text-zinc-650 text-[8.5px] italic">
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
                      className={`group relative flex items-center gap-2 p-2 bg-zinc-900/40 hover:bg-zinc-900 border rounded-xl transition-all cursor-pointer select-none ${
                        isActive 
                          ? 'border-blue-500/70 bg-blue-500/[0.04] shadow-[0_0_10px_rgba(59,130,246,0.15)]' 
                          : 'border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      {/* Visual Circle Preview */}
                      <div 
                        className="w-7 h-7 rounded-lg border border-zinc-800/80 flex items-center justify-center relative overflow-hidden flex-shrink-0"
                        style={{ backgroundColor: blueprint.brushColor }}
                      >
                        {material?.diffuse && (
                          <img 
                            src={material.diffuse} 
                            className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply" 
                            alt=""
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                          {getMaskIcon(blueprint.maskType)}
                        </div>
                      </div>

                      {/* Info label */}
                      <div className="flex flex-col truncate flex-1 leading-tight">
                        <span className={`text-[8.5px] font-black truncate uppercase ${isActive ? 'text-blue-400' : 'text-zinc-200'}`}>
                          {blueprint.name}
                        </span>
                        <span className="text-[7.5px] text-zinc-500 font-mono uppercase tracking-tighter">
                          {blueprint.defaultSize}m • {(blueprint.defaultIntensity * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* Delete action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePaintBlueprint(blueprint.id);
                        }}
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

            {/* Save Form */}
            <form onSubmit={handleSaveBlueprint} className="flex gap-1.5 border-t border-zinc-900/50 pt-2.5">
              <input 
                type="text"
                value={newBlueprintName}
                onChange={(e) => setNewBlueprintName(e.target.value)}
                placeholder="Blueprint Name..."
                className="flex-1 bg-zinc-900/70 border border-zinc-850 rounded-lg px-2 py-1 text-[8.5px] text-zinc-300 font-semibold focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                className="px-2.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/25 hover:border-blue-500 text-blue-450 hover:text-white rounded-lg text-[8.5px] font-extrabold transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none active:scale-95"
              >
                <Plus className="w-3 h-3" /> Save Preset
              </button>
            </form>
          </div>

          {/* Stroke Sliders */}
          <div className="flex flex-col gap-3 bg-zinc-950/40 p-3 rounded-lg border border-zinc-900">
            {/* Brush Size */}
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

            {/* Brush Strength */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[8.5px] font-bold text-zinc-500">
                <span className="uppercase tracking-wider">Kekuatan Kuas (Intensity/Softness)</span>
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

          {/* Stroke shapes */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-3">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
              <Eye className="w-3 h-3 text-zinc-500" />
              Brush Stroke Mask
            </span>
            <div className="grid grid-cols-6 gap-1.5 bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-900">
              {/* Soft Circle */}
              <button 
                onClick={() => setBrushMaskId('softCircle')}
                title="Soft Circle Falloff (Hotkey: 1)"
                className={`h-7 rounded-md border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer active:scale-90 relative ${
                  brushMaskId === 'softCircle' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.65)] ring-1 ring-blue-400/35 animate-pulse' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <defs>
                    <radialGradient id="softGlowPaint" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10" fill="url(#softGlowPaint)" />
                </svg>
              </button>

              {/* Hard Circle */}
              <button 
                onClick={() => setBrushMaskId('hardCircle')}
                title="Sharp Edge Brush (Hotkey: 2)"
                className={`h-7 rounded-md border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer active:scale-90 relative ${
                  brushMaskId === 'hardCircle' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.65)] ring-1 ring-blue-400/35 animate-pulse' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                </svg>
              </button>

              {/* Star */}
              <button 
                onClick={() => setBrushMaskId('star')}
                title="Star Brush (Hotkey: 3)"
                className={`h-7 rounded-md border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer active:scale-90 relative ${
                  brushMaskId === 'star' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.65)] ring-1 ring-blue-400/35 animate-pulse' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
                </svg>
              </button>

              {/* Hexagon */}
              <button 
                onClick={() => setBrushMaskId('hexagon')}
                title="Hex Column Brush (Hotkey: 4)"
                className={`h-7 rounded-md border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer active:scale-90 relative ${
                  brushMaskId === 'hexagon' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.65)] ring-1 ring-blue-400/35 animate-pulse' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
                </svg>
              </button>

              {/* Ring */}
              <button 
                onClick={() => setBrushMaskId('starOutline')}
                title="Splat Ring Brush (Hotkey: 5)"
                className={`h-7 rounded-md border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer active:scale-90 relative ${
                  brushMaskId === 'starOutline' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.65)] ring-1 ring-blue-400/35 animate-pulse' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
                }`}
              >
                <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3">
                  <circle cx="12" cy="12" r="8" />
                </svg>
              </button>

              {/* Square */}
              <button 
                onClick={() => setBrushMaskId('square')}
                title="Block Box Brush (Hotkey: 6)"
                className={`h-7 rounded-md border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer active:scale-90 relative ${
                  brushMaskId === 'square' 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.65)] ring-1 ring-blue-400/35 animate-pulse' 
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 hover:scale-105'
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Color Swatches */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-3">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5 flex items-center gap-1">
              <Palette className="w-3 h-3 text-zinc-500" />
              Solid Color Swatches
            </span>
            <div className="flex gap-2 items-center bg-zinc-950/60 p-2 rounded-xl border border-zinc-900 overflow-x-auto custom-scrollbar">
              {['#5a4d3a', '#3d5c36', '#7c6a4a', '#2d3e4d', '#fca311', '#d00000', '#432818', '#ffffff'].map(c => (
                <button 
                  key={c}
                  onClick={() => {
                    setBrushColor(c);
                    setBrushTextureId(null);
                  }}
                  className={`w-7 h-7 rounded-lg border transition-all duration-300 cursor-pointer select-none flex-shrink-0 hover:scale-125 active:scale-95 ${
                    brushColor === c && !brushTextureId 
                      ? 'border-indigo-455 scale-110 shadow-[0_0_12px_rgba(99,102,241,0.85)] ring-2 ring-indigo-500/25' 
                      : 'border-zinc-800 hover:border-zinc-400'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              
              <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => {
                  setBrushColor(e.target.value);
                  setBrushTextureId(null);
                }}
                className="w-7 h-7 rounded-lg bg-transparent border-none p-0 overflow-hidden cursor-pointer flex-shrink-0 hover:scale-115 active:scale-95 transition-transform"
                title="Custom Hex Picker"
              />
              <div className="flex-grow text-right text-[8px] text-zinc-500 font-mono font-bold pr-1 select-all">{brushColor}</div>
            </div>
          </div>

          {/* Splat Textures */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-3">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Splat Ground Materials</span>
            <div className="grid grid-cols-4 gap-1.5 bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-900">
              <button 
                onClick={() => setBrushTextureId(null)}
                className={`h-8 rounded-md text-[8px] font-bold border transition-all cursor-pointer select-none ${
                  !brushTextureId ? 'bg-blue-650/20 border-blue-500 text-white font-black' : 'border-transparent text-zinc-500 hover:bg-zinc-900 hover:text-zinc-450'
                }`}
              >
                Solid
              </button>
              {FULL_MATERIAL_LIBRARY.slice(0, 3).map((mat: any) => (
                <button 
                  key={mat.id}
                  onClick={() => setBrushTextureId(mat.id)}
                  className={`h-8 rounded-md border transition-all relative overflow-hidden cursor-pointer select-none ${
                    brushTextureId === mat.id ? 'border-blue-500 shadow' : 'border-transparent hover:border-zinc-700'
                  }`}
                >
                  {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-transparent transition-colors">
                    <span className="text-[7.5px] font-extrabold uppercase text-white truncate max-w-[45px]">{mat.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Base Material Override */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-3">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Terrain Base Material</span>
            <div className="grid grid-cols-3 gap-1.5 text-[8.5px] font-bold bg-zinc-950/60 p-1.5 rounded-lg border border-zinc-900">
              <button 
                onClick={() => setTerrainMaterialId(null)}
                className={`py-1.5 rounded-md border transition-all text-center cursor-pointer select-none ${
                  !terrainMaterialId ? 'bg-blue-650/20 border-blue-500 text-white font-black shadow' : 'bg-zinc-900 border-zinc-800 text-zinc-550 hover:text-zinc-300 hover:bg-zinc-850'
                }`}
              >
                Base Paint
              </button>
              {FULL_MATERIAL_LIBRARY.slice(0, 2).map((mat: any) => (
                <button 
                  key={mat.id}
                  onClick={() => setTerrainMaterialId(mat.id)}
                  className={`py-1.5 rounded-md border transition-all text-center truncate cursor-pointer select-none ${
                    terrainMaterialId === mat.id ? 'bg-blue-650/20 border-blue-500 text-white font-black shadow' : 'bg-zinc-900 border-zinc-800 text-zinc-550 hover:text-zinc-300 hover:bg-zinc-850'
                  }`}
                >
                  {mat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Base Color Override */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900/50 pt-3">
            <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Base Color Override</span>
            <div className="flex items-center gap-2 bg-zinc-950/60 p-2 rounded-lg border border-zinc-900">
              <input 
                type="color" 
                value={terrainColor} 
                onChange={(e) => setTerrainColor(e.target.value)}
                className="w-6 h-6 rounded bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              />
              <span className="text-[8px] text-zinc-400 font-mono tracking-wider">{terrainColor}</span>
              <div className="flex-grow" />
              <div className="w-4 h-4 rounded-full border border-zinc-800" style={{ backgroundColor: terrainColor }} />
            </div>
          </div>

          {/* Reset Paint splat operation */}
          <div className="flex gap-2 border-t border-zinc-900/50 pt-3">
            <button 
              onClick={() => { if (confirm("Reset seluruh warna cat dan splat di atas kanvas tanah?")) setPaintData(null); }}
              className="w-full py-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-450 hover:text-white rounded-lg transition-all duration-200 font-bold uppercase tracking-wide text-center cursor-pointer select-none"
            >
              Reset Splat Canvas
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
