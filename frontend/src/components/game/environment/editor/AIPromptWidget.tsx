'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Wand2, RotateCcw, HelpCircle, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEditorStore, MapItem } from '@/src/state/useEditorStore';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { API_BASE_URL } from '@/src/core/config';

interface AIHistoryItem {
  id: string;
  timestamp: string;
  prompt: string;
  action: 'append' | 'replace';
  totalPlaced: number;
  itemSummary: { name: string; count: number; category: string }[];
  previousItems: MapItem[];
}

export const AIPromptWidget = () => {
  const {
    items,
    updateItemsWithHistory,
    dynamicAssets,
    terrainConfig,
    setSky,
    setEnvironment,
    setTerrainColor,
    setLightIntensity,
    setAmbientIntensity,
    setSunAngle,
    setFogDensity,
    isEditorOpen
  } = useEditorStore();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<AIHistoryItem[]>([]);

  // Step-by-Step Walkthrough states
  const [stepsLog, setStepsLog] = useState<{ label: string; status: 'pending' | 'active' | 'done' }[]>([
    { label: 'Synthesizing Prompt Intent & Context...', status: 'pending' },
    { label: 'Filtering Available 3D Blueprint Catalog...', status: 'pending' },
    { label: 'Generating Mesh Placements & Rotation Grids...', status: 'pending' },
    { label: 'Snapping Object Coordinates to Terrain Heights...', status: 'pending' },
    { label: 'Deploying Map Struct to Game Engine Viewport...', status: 'pending' }
  ]);

  if (!isEditorOpen) return null;

  const quickPrompts = [
    { label: '🌲 Pine Forest Spawner', prompt: 'buat lingkungan yang banyak pohon dengan ukuran yang pas' },
    { label: '🌾 Wild Grassland Cover', prompt: 'tambahkan rerumputan dan beberapa batu di sekitar peta' },
    { label: '🏰 Royal Fortress Gatehouse', prompt: 'tambahkan sebuah istana yang baik lengkap dengan dinding benteng dan menara' },
    { label: '🌋 Sunset Volcanic Mist', prompt: 'malam berkabut merah pekat dengan sunAngle 80, buat tanah kecoklatan' }
  ];

  const handleAIGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Initialize step statuses
    setStepsLog([
      { label: 'Synthesizing Prompt Intent & Context...', status: 'active' },
      { label: 'Filtering Available 3D Blueprint Catalog...', status: 'pending' },
      { label: 'Generating Mesh Placements & Rotation Grids...', status: 'pending' },
      { label: 'Snapping Object Coordinates to Terrain Heights...', status: 'pending' },
      { label: 'Deploying Map Struct to Game Engine Viewport...', status: 'pending' }
    ]);

    // Save snapshot of current items before AI mutation for one-click Undo capability!
    const previousItemsSnapshot = [...items];

    try {
      // 1. Clean & serialize available assets (ensure paths are stripped of base URL to present clean paths to LLM)
      setStepsLog(prev => {
        const next = [...prev];
        next[0].status = 'done';
        next[1].status = 'active';
        return next;
      });

      const rawAssets = dynamicAssets.map(asset => {
        let relPath = asset.path;
        if (relPath.startsWith(API_BASE_URL)) {
          relPath = relPath.replace(API_BASE_URL, '');
        }
        if (!relPath.startsWith('/')) {
          relPath = '/' + relPath;
        }
        return {
          name: asset.name,
          path: relPath,
          category: asset.category || 'env'
        };
      });

      // 2. Map current items (strip URL as well)
      setStepsLog(prev => {
        const next = [...prev];
        next[1].status = 'done';
        next[2].status = 'active';
        return next;
      });

      const currentItems = items.map(item => {
        let relPath = item.path;
        if (relPath.startsWith(API_BASE_URL)) {
          relPath = relPath.replace(API_BASE_URL, '');
        }
        if (!relPath.startsWith('/')) {
          relPath = '/' + relPath;
        }
        return {
          id: item.id,
          type: item.type,
          path: relPath,
          pos: item.pos,
          rot: item.rot,
          sca: item.sca,
          color: item.color || ''
        };
      });

      // 3. Request generation from DeepSeek gateway
      const token = typeof window !== 'undefined' ? localStorage.getItem("game_auth_token") : "";
      const res = await fetch(`${API_BASE_URL}/api/world-editor/ai-generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          prompt: prompt,
          currentItems: currentItems,
          availableAssets: rawAssets
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to complete AI processing.');
      }

      const result = await res.json();

      // 4. Update atmosphere and lighting settings
      setStepsLog(prev => {
        const next = [...prev];
        next[2].status = 'done';
        next[3].status = 'active';
        return next;
      });

      if (result.settings) {
        setSky(result.settings.sky);
        setEnvironment(result.settings.environment);
        setTerrainColor(result.settings.terrainColor);
        setLightIntensity(result.settings.lightIntensity);
        setAmbientIntensity(result.settings.ambientIntensity);
        setSunAngle(result.settings.sunAngle);
        setFogDensity(result.settings.fogDensity);
      }

      // 5. Build, snap, and compile placed items
      let newlyPlacedItems: MapItem[] = [];
      if (result.items && Array.isArray(result.items)) {
        const baseDistance = 24;
        newlyPlacedItems = result.items.map((item: any) => {
          const [x, y, z] = item.pos;
          
          // Fetch elevation
          const elevation = getTerrainElevation(x, z, "STORM", baseDistance, terrainConfig, false);
          
          // Snapping math: if Y coordinate is negligible, stick exactly to the ground.
          // Otherwise offset relative to height for castle structures
          const finalY = (Math.abs(y) < 0.1) ? (elevation - 0.25) : (elevation + y);

          // Guarantee single base URL prefix
          let finalPath = item.path;
          if (finalPath.startsWith(API_BASE_URL)) {
            finalPath = finalPath.replace(API_BASE_URL, '');
          }
          if (!finalPath.startsWith('/')) {
            finalPath = '/' + finalPath;
          }
          finalPath = `${API_BASE_URL}${finalPath}`;

          return {
            id: item.id || `ai-${Date.now()}-${Math.random()}`,
            type: item.type || 'env',
            path: finalPath,
            pos: [x, finalY, z] as [number, number, number],
            rot: item.rot as [number, number, number],
            sca: item.sca as [number, number, number],
            color: item.color
          };
        });

        // Set steps timeline to Phase 5
        setStepsLog(prev => {
          const next = [...prev];
          next[3].status = 'done';
          next[4].status = 'active';
          return next;
        });

        // Set items in store WITH FULL HISTORY SYNC & DATABASE SAVE!
        console.log("AIPromptWidget: result.action =", result.action);
        console.log("AIPromptWidget: current items snapshot count =", items.length);
        console.log("AIPromptWidget: newly placed items count =", newlyPlacedItems.length);

        if (result.action === 'replace') {
          updateItemsWithHistory(newlyPlacedItems);
        } else {
          updateItemsWithHistory(prev => {
            console.log("AIPromptWidget: inside updateItemsWithHistory callback, prev count =", prev.length);
            const combined = [...prev, ...newlyPlacedItems];
            console.log("AIPromptWidget: inside callback, combined count =", combined.length);
            return combined;
          });
        }
        console.log("AIPromptWidget: after updateItemsWithHistory call, current store items count =", useEditorStore.getState().items.length);

        // SYNC AND PERSIST DIRECTLY TO THE POSTGRES GORM DATABASE!
        console.log("AIPromptWidget: syncing to database...");
        await useEditorStore.getState().saveToDatabase();
        console.log("AIPromptWidget: successfully synced to database!");

        // Group items for display in our Right Sidebar history summary
        const summaryMap = new Map<string, { count: number; category: string }>();
        newlyPlacedItems.forEach(item => {
          // Resolve legible name from model path
          const filename = item.path.split('/').pop()?.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || 'item';
          const current = summaryMap.get(filename) || { count: 0, category: item.type };
          summaryMap.set(filename, { count: current.count + 1, category: item.type });
        });

        const itemSummary = Array.from(summaryMap.entries()).map(([name, data]) => ({
          name,
          count: data.count,
          category: data.category
        }));

        // Append to local sidebar history log
        const historyRecord: AIHistoryItem = {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          prompt: prompt,
          action: result.action || 'append',
          totalPlaced: newlyPlacedItems.length,
          itemSummary,
          previousItems: previousItemsSnapshot
        };

        setHistory(prev => [historyRecord, ...prev]);
        setSuccessMsg(`Spawned ${newlyPlacedItems.length} items successfully!`);
      } else {
        setSuccessMsg('Environment lighting preset updated successfully!');
      }

      setStepsLog(prev => {
        const next = [...prev];
        next[4].status = 'done';
        return next;
      });

      setPrompt('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred during generation.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = (record: AIHistoryItem) => {
    updateItemsWithHistory(record.previousItems);
    setHistory(prev => prev.filter(h => h.id !== record.id));
    setSuccessMsg('Reverted AI placement layout snapshot successfully!');
  };

  return (
    <div className="world-editor-ui w-[320px] h-screen bg-zinc-950/90 border-l border-zinc-900 flex flex-col pointer-events-auto z-[9999] shadow-2xl relative overflow-hidden font-sans backdrop-blur-xl flex-shrink-0 ml-auto select-none">
      
      {/* ─── HEADER BRANDING ─── */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-zinc-900/60 bg-zinc-950/40 flex-shrink-0">
        <div className="p-1 rounded bg-purple-600/20 border border-purple-500/30">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
        </div>
        <h3 className="text-[11px] font-extrabold tracking-[0.15em] text-zinc-100 uppercase">
          DeepSeek AI Orchestrator
        </h3>
      </div>

      {/* ─── SCROLLABLE INNER DOCK ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        
        {/* Prompt Input Form */}
        <form onSubmit={handleAIGeneration} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Wand2 className="w-3 h-3 text-purple-400" />
              World Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              placeholder="e.g. buat lingkungan yang banyak pohon pinus dengan ukuran pas..."
              className="w-full bg-zinc-900/50 border border-zinc-850 hover:border-zinc-800 focus:border-purple-500/50 text-zinc-200 text-xs p-3 rounded-xl focus:outline-none min-h-[90px] resize-none font-sans leading-relaxed tracking-wide placeholder-zinc-650 transition-colors shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-650 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-purple-900/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>AI IS ORCHESTRATING...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>GENERATE WORLD</span>
              </>
            )}
          </button>
        </form>

        {/* ─── STEP-BY-STEP WORKFLOW WALKTHROUGH ─── */}
        {loading && (
          <div className="p-4 bg-zinc-900/80 border border-purple-500/25 rounded-xl flex flex-col gap-3 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                AI Level Constructor
              </span>
              <span className="text-[9px] font-mono text-zinc-400 font-bold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">
                {stepsLog.filter(s => s.status === 'done').length * 20}%
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500" 
                style={{ width: `${stepsLog.filter(s => s.status === 'done').length * 20}%` }}
              />
            </div>

            {/* Steps log checklist */}
            <div className="flex flex-col gap-2 pt-1">
              {stepsLog.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[9px]">
                  {step.status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : step.status === 'active' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-zinc-800 flex-shrink-0 bg-zinc-950" />
                  )}
                  <span className={`font-semibold tracking-tight leading-none ${
                    step.status === 'done' ? 'text-zinc-500 line-through decoration-zinc-800/60' :
                    step.status === 'active' ? 'text-zinc-200 font-bold' :
                    'text-zinc-700'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Alerts */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-[9px] font-bold text-red-300 leading-normal flex items-start gap-2 shadow-md">
            <span className="mt-0.5">⚠️</span>
            <div className="flex-1">
              <span className="block mb-1 text-red-200">Processing Failed:</span>
              <span className="text-zinc-400 font-semibold">{error}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-[9px] font-bold text-emerald-300 leading-normal flex items-center gap-2 shadow-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="flex flex-col gap-1.5 border-t border-zinc-900/60 pt-3">
          <span className="text-[8.5px] font-extrabold text-zinc-550 uppercase tracking-wider flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-zinc-500" />
            Quick Prompts
          </span>
          <div className="flex flex-col gap-1.5">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(qp.prompt)}
                disabled={loading}
                className="w-full text-left p-2 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 rounded-lg text-[9px] text-zinc-400 hover:text-zinc-200 transition-all font-semibold leading-normal flex items-center justify-between group cursor-pointer"
              >
                <span>{qp.label}</span>
                <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        {/* ─── AI HISTORY & PROCESSING LOG PANEL ─── */}
        <div className="flex flex-col gap-2 border-t border-zinc-900/60 pt-4 flex-1">
          <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-zinc-450">
            <span>Orchestration Logs</span>
            <span className="text-zinc-650">({history.length} operations)</span>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
            {history.map((record) => (
              <div 
                key={record.id}
                className="p-3 bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 rounded-xl flex flex-col gap-2 transition-all relative overflow-hidden group shadow"
              >
                {/* Timestamp & Type */}
                <div className="flex items-center justify-between text-[8px] font-bold text-zinc-500">
                  <span className="text-zinc-400 bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {record.action === 'replace' ? 'Reset & Spawn' : 'Spawn Merge'}
                  </span>
                  <span>{record.timestamp}</span>
                </div>

                {/* Prompt used */}
                <p className="text-[9.5px] font-semibold text-zinc-300 italic line-clamp-2 leading-relaxed">
                  "{record.prompt}"
                </p>

                {/* Summary list of generated structures */}
                {record.itemSummary.length > 0 && (
                  <div className="flex flex-col gap-1 bg-zinc-950/60 p-2 rounded-lg border border-zinc-900/40">
                    <span className="text-[7.5px] font-extrabold text-zinc-600 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                      <Package className="w-2.5 h-2.5 text-zinc-500" />
                      Spawned Objects
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {record.itemSummary.map((item, i) => (
                        <span 
                          key={i} 
                          className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-[8px] font-mono text-blue-400"
                        >
                          {item.name} x{item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revert Action */}
                <button
                  type="button"
                  onClick={() => handleUndo(record)}
                  className="w-full py-1 rounded bg-zinc-950 hover:bg-rose-950/40 border border-zinc-850 hover:border-rose-900/50 text-[8px] font-extrabold text-zinc-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer outline-none"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  REVERT THIS STEP
                </button>
              </div>
            ))}

            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2 border border-dashed border-zinc-900 rounded-xl flex-1 bg-zinc-950/20">
                <span className="text-lg">🤖</span>
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">No active orchestration logs</p>
                <p className="text-[8px] text-zinc-700 max-w-[200px] leading-normal font-semibold">Enter a prompt above to dispatch level construction requests to DeepSeek.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer statistics */}
      <div className="px-4 py-2.5 bg-zinc-950/80 border-t border-zinc-900/60 flex items-center justify-between text-[8px] font-semibold tracking-wider text-zinc-600 flex-shrink-0">
        <span>ACTIVE ASSETS: {dynamicAssets.length}</span>
        <span className="text-purple-500 uppercase tracking-widest font-extrabold animate-pulse">DeepSeek v3 Active</span>
      </div>

    </div>
  );
};
