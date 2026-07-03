'use client';

import { Database, SunMoon, Globe, Trash } from 'lucide-react';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';

export const MapSettingsModule = () => {
  const {
    selectedMapId,
    setSelectedMapId,
    mapList,
    saveToDatabase,
    sky,
    setSky,
    environment,
    setEnvironment,
    createNewMap,
    deleteActiveMap,
    deleteMap,
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-3.5 p-4 bg-zinc-950/40 border-b border-zinc-900/60 text-zinc-350 font-sans">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest">Map Configurator</span>
        <span className="text-[7.5px] px-1.5 py-0.5 bg-zinc-900/80 border border-zinc-800 text-zinc-500 rounded uppercase font-bold tracking-wider"> authoritative </span>
      </div>

      {/* Map Active Selection Dropdown as the Name input */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-extrabold text-zinc-550 uppercase tracking-widest pl-0.5">Active Workspace</span>
        <div className="flex gap-2">
          <select 
            value={selectedMapId}
            onChange={(e) => setSelectedMapId(e.target.value)}
            className="flex-1 bg-zinc-900/85 border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-md hover:bg-zinc-850 transition-all outline-none"
          >
            {mapList.map((m: any) => (
              <option key={m.id} value={m.id} className="bg-zinc-950">{m.name}</option>
            ))}
            {mapList.length === 0 && <option value="Starter Zone">Starter Zone</option>}
          </select>
          {mapList.length > 1 && (
            <button
              onClick={() => deleteActiveMap()}
              title="Delete Active Workspace"
              className="px-2.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-400 hover:text-white rounded-md text-[9px] font-extrabold transition-all uppercase tracking-wider flex items-center justify-center cursor-pointer select-none"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Saved Workspaces List */}
      {mapList.length > 1 && (
        <div className="flex flex-col gap-1 pt-1.5">
          <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest pl-0.5">Saved Maps List</span>
          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto custom-scrollbar bg-zinc-950/20 p-1.5 rounded-lg border border-zinc-900/60">
            {mapList.map((m: any) => {
              const isActive = m.id === selectedMapId;
              return (
                <div 
                  key={m.id}
                  className={`flex items-center justify-between px-2 py-1 rounded border text-[9px] transition-all font-mono ${
                    isActive 
                      ? 'bg-blue-950/40 border-blue-500/30 text-zinc-100 shadow-sm' 
                      : 'bg-zinc-900/20 border-zinc-900/40 hover:bg-zinc-850/30 text-zinc-450'
                  }`}
                >
                  <button 
                    onClick={() => setSelectedMapId(m.id)}
                    className="flex-1 text-left font-semibold truncate outline-none cursor-pointer"
                  >
                    {m.name} {isActive && <span className="text-[7px] text-blue-400 font-bold ml-1 font-sans uppercase">Active</span>}
                  </button>
                  
                  {mapList.length > 1 && (
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteMap(m.id);
                      }}
                      title="Delete Map"
                      className="w-4 h-4 flex items-center justify-center rounded-md hover:bg-rose-950/50 text-zinc-550 hover:text-rose-400 transition-colors cursor-pointer select-none"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create New Map Inline Input */}
      <div className="flex flex-col gap-1 border-t border-zinc-900/40 pt-2.5">
        <span className="text-[8px] font-extrabold text-zinc-550 uppercase tracking-widest pl-0.5">Create New Map</span>
        <div className="flex gap-1.5">
          <input 
            type="text"
            placeholder="New Map Name..."
            id="new-map-input"
            className="flex-1 bg-zinc-950 border border-zinc-850 rounded-md px-2.5 py-1 text-[10px] text-zinc-300 font-semibold focus:border-blue-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  createNewMap(val);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('new-map-input') as HTMLInputElement;
              const val = input?.value.trim();
              if (val) {
                createNewMap(val);
                input.value = '';
              }
            }}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-550 text-white rounded-md text-[9px] font-extrabold transition-all uppercase tracking-wider cursor-pointer"
          >
            Create
          </button>
        </div>
      </div>

      {/* Skybox Selector */}
      <div className="flex flex-col gap-1 border-t border-zinc-900/40 pt-2.5">
        <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest pl-0.5 flex items-center gap-1">
          <SunMoon className="w-3 h-3 text-zinc-400" />
          Environment Skybox
        </span>
        <select 
          value={sky}
          onChange={(e) => setSky(e.target.value)}
          className="w-full bg-zinc-900/85 border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-md hover:bg-zinc-850 transition-all outline-none"
        >
          <option value="sunset" className="bg-zinc-950">Sunset Glow</option>
          <option value="night" className="bg-zinc-950">Midnight Shadows</option>
          <option value="clear" className="bg-zinc-950">Clear Sky (Day)</option>
        </select>
      </div>

      {/* Environment Preset Selector */}
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest pl-0.5 flex items-center gap-1">
          <Globe className="w-3 h-3 text-zinc-400" />
          Environment Preset
        </span>
        <select 
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          className="w-full bg-zinc-900/85 border border-zinc-800/80 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-200 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-md hover:bg-zinc-850 transition-all outline-none"
        >
          <option value="STORM" className="bg-zinc-950">Open World (Storm)</option>
          <option value="DIORAMA" className="bg-zinc-950">Whimsical Diorama</option>
        </select>
      </div>

      {/* Pill Blue Save Button */}
      <div className="flex justify-center pt-1.5">
        <button
          onClick={() => saveToDatabase()}
          className="px-6 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-550 hover:to-indigo-550 active:scale-95 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-full transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center gap-1.5 border border-blue-450/20 cursor-pointer"
        >
          <Database className="w-3 h-3 text-blue-100" />
          Save Workspace
        </button>
      </div>

    </div>
  );
};
