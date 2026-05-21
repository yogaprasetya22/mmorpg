'use client';

import { useEditorStore } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@/src/core/logic/environment/assetRegistry';

export const TerrainPaintModule = () => {
  const {
    brushSize,
    setBrushSize,
    brushStrength,
    setBrushStrength,
    brushRotation,
    setBrushRotation,
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
    setPaintData
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3 font-mono text-[9px]">
      
      {/* Stroke Sliders */}
      <div className="flex flex-col gap-2.5">
        
        {/* Brush Size */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-550">
            <span className="uppercase tracking-widest">Brush size</span>
            <span className="text-blue-450 font-bold">{brushSize}px</span>
          </div>
          <input 
            type="range" min="1" max="150" step="1" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Brush Strength */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-550">
            <span className="uppercase tracking-widest">Stroke Flow / Opacity</span>
            <span className="text-blue-450 font-bold">{(brushStrength * 100).toFixed(0)}%</span>
          </div>
          <input 
            type="range" min="0.01" max="1.0" step="0.01" 
            value={brushStrength} 
            onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Brush Rotation */}
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center text-[8px] font-bold text-zinc-550">
            <span className="uppercase tracking-widest">Yaw Spin Angle</span>
            <span className="text-blue-450 font-bold">{brushRotation}°</span>
          </div>
          <input 
            type="range" min="0" max="360" step="1" 
            value={brushRotation} 
            onChange={(e) => setBrushRotation(parseInt(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-zinc-950 rounded appearance-none cursor-pointer"
          />
        </div>

      </div>

      {/* Stroke shapes */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-850 pt-2 flex-shrink-0">
        <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Brush stroke mask</span>
        <div className="grid grid-cols-6 gap-1 bg-zinc-950 p-1.5 rounded border border-zinc-850">
          {/* Soft Circle */}
          <button 
            onClick={() => setBrushMaskId('softCircle')}
            title="Soft Circle Falloff"
            className={`h-7 rounded border flex items-center justify-center transition-all ${
              brushMaskId === 'softCircle' ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow' : 'bg-transparent border-transparent text-zinc-650 hover:text-zinc-400 hover:bg-zinc-900'
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
            title="Sharp Edge Brush"
            className={`h-7 rounded border flex items-center justify-center transition-all ${
              brushMaskId === 'hardCircle' ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow' : 'bg-transparent border-transparent text-zinc-650 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
            </svg>
          </button>

          {/* Star */}
          <button 
            onClick={() => setBrushMaskId('star')}
            title="Star Brush"
            className={`h-7 rounded border flex items-center justify-center transition-all ${
              brushMaskId === 'star' ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow' : 'bg-transparent border-transparent text-zinc-650 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
            </svg>
          </button>

          {/* Hexagon */}
          <button 
            onClick={() => setBrushMaskId('hexagon')}
            title="Hex Column Brush"
            className={`h-7 rounded border flex items-center justify-center transition-all ${
              brushMaskId === 'hexagon' ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow' : 'bg-transparent border-transparent text-zinc-650 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
            </svg>
          </button>

          {/* Ring */}
          <button 
            onClick={() => setBrushMaskId('starOutline')}
            title="Splat Ring Brush"
            className={`h-7 rounded border flex items-center justify-center transition-all ${
              brushMaskId === 'starOutline' ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow' : 'bg-transparent border-transparent text-zinc-650 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3">
              <circle cx="12" cy="12" r="8" />
            </svg>
          </button>

          {/* Square */}
          <button 
            onClick={() => setBrushMaskId('square')}
            title="Block Box Brush"
            className={`h-7 rounded border flex items-center justify-center transition-all ${
              brushMaskId === 'square' ? 'bg-blue-600/30 border-blue-500 text-white scale-105 shadow' : 'bg-transparent border-transparent text-zinc-650 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Colors & Materials Swatches */}
      <div className="flex flex-col gap-2.5 border-t border-zinc-850 pt-2.5">
        
        {/* Solid Swatch */}
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Solid Color Palette</span>
          <div className="flex gap-1.5 items-center bg-zinc-950 p-1.5 rounded border border-zinc-850">
            {['#5a4d3a', '#3d5c36', '#7c6a4a', '#2d3e4d', '#fca311', '#d00000', '#432818', '#ffffff'].map(c => (
              <button 
                key={c}
                onClick={() => {
                  setBrushColor(c);
                  setBrushTextureId(null);
                }}
                className={`w-5.5 h-5.5 rounded border transition-all ${
                  brushColor === c && !brushTextureId ? 'border-blue-500 scale-105 shadow' : 'border-transparent hover:scale-105'
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
              className="w-6 h-6 rounded bg-transparent border-none p-0 overflow-hidden cursor-pointer flex-shrink-0"
              title="Custom Hex Picker"
            />
            <div className="flex-grow text-right text-[8px] text-zinc-600 font-bold pr-1 select-all">{brushColor}</div>
          </div>
        </div>

        {/* Splat Textures */}
        <div className="flex flex-col gap-1.5">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Splat Ground Texture Materials</span>
          <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded border border-zinc-850">
            <button 
              onClick={() => setBrushTextureId(null)}
              className={`h-8 rounded text-[8px] font-bold border transition-all ${
                !brushTextureId ? 'bg-blue-600/30 border-blue-500 text-white font-black' : 'border-transparent text-zinc-650 hover:bg-zinc-900 hover:text-zinc-450'
              }`}
            >
              Solid
            </button>
            {FULL_MATERIAL_LIBRARY.slice(0, 3).map((mat: any) => (
              <button 
                key={mat.id}
                onClick={() => setBrushTextureId(mat.id)}
                className={`h-8 rounded border transition-all relative overflow-hidden ${
                  brushTextureId === mat.id ? 'border-blue-500 shadow' : 'border-transparent hover:border-zinc-700'
                }`}
              >
                {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-transparent transition-colors">
                  <span className="text-[7.5px] font-bold uppercase text-white truncate max-w-[45px]">{mat.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Base Material & Color Overrides */}
        <div className="flex flex-col gap-1.5">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Terrain Base Material</span>
          <div className="grid grid-cols-3 gap-1 text-[8px] font-bold">
            <button 
              onClick={() => setTerrainMaterialId(null)}
              className={`py-1 rounded border transition-all text-center ${
                !terrainMaterialId ? 'bg-blue-600/30 border-blue-500 text-white font-black shadow' : 'bg-zinc-950 border-zinc-850 text-zinc-550 hover:text-zinc-350 hover:bg-zinc-900'
              }`}
            >
              Base Paint
            </button>
            {FULL_MATERIAL_LIBRARY.slice(0, 2).map((mat: any) => (
              <button 
                key={mat.id}
                onClick={() => setTerrainMaterialId(mat.id)}
                className={`py-1 rounded border transition-all text-center truncate ${
                  terrainMaterialId === mat.id ? 'bg-blue-600/30 border-blue-500 text-white font-black shadow' : 'bg-zinc-950 border-zinc-850 text-zinc-550 hover:text-zinc-350 hover:bg-zinc-900'
                }`}
              >
                {mat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Base Color Override */}
        <div className="flex flex-col gap-1.5">
          <span className="text-zinc-500 font-bold uppercase text-[7.5px] tracking-widest pl-0.5">Terrain Base Color Override</span>
          <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded border border-zinc-850">
            <input 
              type="color" 
              value={terrainColor} 
              onChange={(e) => setTerrainColor(e.target.value)}
              className="w-6 h-6 rounded bg-transparent border-none p-0 overflow-hidden cursor-pointer"
            />
            <span className="text-[8px] text-zinc-400 font-bold font-mono tracking-wider">{terrainColor}</span>
            <div className="flex-grow" />
            <div className="w-4 h-4 rounded-full border border-zinc-800" style={{ backgroundColor: terrainColor }} />
          </div>
        </div>

      </div>

      {/* Wipe/Reset operation */}
      <div className="flex gap-2 border-t border-zinc-850 pt-3">
        <button 
          onClick={() => { if (confirm("Reset all splat colors and paints?")) setPaintData(null); }}
          className="w-full py-1.5 bg-rose-600/10 hover:bg-rose-650 border border-rose-500/20 text-rose-450 hover:text-white rounded-lg transition-colors font-bold uppercase tracking-tight text-center"
        >
          Reset Color/Splat Canvas
        </button>
      </div>

    </div>
  );
};
