/** Admin CRUD modal for server monster configuration management. */
'use client';

import { Skull, X } from 'lucide-react';

interface MonsterEditorModalProps {
  monsterConfigs: any[];
  editingMonster: any;
  setEditingMonster: (v: any) => void;
  errorMsg: string;
  successMsg: string;
  onClose: () => void;
  handleSaveMonsterConfig: (config: any) => void;
  handleDeleteMonsterConfig: (type: string) => void;
}

export function MonsterEditorModal({
  monsterConfigs, editingMonster, setEditingMonster,
  errorMsg, successMsg, onClose,
  handleSaveMonsterConfig, handleDeleteMonsterConfig
}: MonsterEditorModalProps) {
  const handleClose = () => {
    onClose();
    setEditingMonster(null);
  };

  const handleCreateNew = () => {
    setEditingMonster({
      type: "", name: "", level: 1, hp: 100, max_hp: 100,
      attack: 10, defense: 5, speed: 2.0, aggro_range: 12.0,
      gold_drop: 10, xp_drop: 15,
    });
  };

  return (
    <div 
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto font-sans"
      onClick={handleClose}
    >
      <div 
        className="w-[850px] max-w-[95vw] h-[600px] max-h-[90vh] bg-zinc-950/90 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400">
              <Skull className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-md font-black tracking-tight uppercase text-white leading-none">PENGELOLA KONFIGURASI MONSTER</h3>
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">GORM Database Live Spawner Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreateNew}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-white text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
              + Buat Monster Baru
            </button>
            <button onClick={handleClose}
              className="w-8 h-8 rounded-full bg-zinc-900/60 hover:bg-zinc-800 hover:text-white text-zinc-500 flex items-center justify-center transition-all active:scale-90">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Notifications */}
        {errorMsg && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-2.5 rounded-xl animate-pulse">{errorMsg}</div>}
        {successMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-2.5 rounded-xl">{successMsg}</div>}

        {/* Main Split Layout */}
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Left Side: Monster Table */}
          <div className="flex-1 bg-zinc-900/30 border border-white/5 rounded-2xl flex flex-col overflow-hidden">
            <div className="bg-zinc-900/40 px-4 py-2.5 text-[8px] font-black text-zinc-400 uppercase tracking-widest border-b border-white/5 grid grid-cols-12 gap-2">
              <span className="col-span-3">TIPE / NAMA</span>
              <span className="col-span-1 text-center">LV</span>
              <span className="col-span-2 text-right">HP</span>
              <span className="col-span-1 text-right">ATK</span>
              <span className="col-span-1 text-right">DEF</span>
              <span className="col-span-1 text-right">SPD</span>
              <span className="col-span-3 text-center">AKSI</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 pr-1">
              {monsterConfigs.length === 0 ? (
                <div className="text-center py-12 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                  Tidak ada konfigurasi monster di database
                </div>
              ) : (
                monsterConfigs.map((m) => (
                  <div key={m.type} className="px-3.5 py-2.5 rounded-xl bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all grid grid-cols-12 gap-2 items-center text-xs font-bold">
                    <div className="col-span-3 flex flex-col gap-0.5 min-w-0">
                      <span className="text-white truncate">{m.name || "Tanpa Nama"}</span>
                      <span className="text-[8px] text-cyan-400 uppercase tracking-wider font-black truncate">{m.type}</span>
                    </div>
                    <span className="col-span-1 text-center text-amber-400">{m.level}</span>
                    <span className="col-span-2 text-right text-emerald-400 tracking-wide">{m.hp}</span>
                    <span className="col-span-1 text-right text-red-400">{m.attack}</span>
                    <span className="col-span-1 text-right text-indigo-400">{m.defense}</span>
                    <span className="col-span-1 text-right text-zinc-300">{m.speed?.toFixed(1)}</span>
                    <div className="col-span-3 flex items-center justify-center gap-1.5">
                      <button onClick={() => setEditingMonster({ ...m })}
                        className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[8.5px] font-black uppercase tracking-wider transition-all">
                        Edit
                      </button>
                      <button onClick={() => { if (confirm(`Apakah Anda yakin ingin menghapus monster "${m.name}"?`)) { handleDeleteMonsterConfig(m.type); }}}
                        className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[8.5px] font-black uppercase tracking-wider transition-all">
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Side: Form */}
          {editingMonster ? (
            <div className="w-[300px] bg-zinc-900/30 border border-white/10 p-5 rounded-2xl flex flex-col gap-4 overflow-y-auto animate-in slide-in-from-right-4 duration-150">
              <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-widest border-b border-white/5 pb-2">
                {editingMonster.created_at ? "EDIT MONSTER CONFIG" : "CREATOR MONSTER BARU"}
              </h4>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Tipe / Kode Unik</label>
                  <input type="text" placeholder="e.g. slime_blue" value={editingMonster.type} disabled={!!editingMonster.created_at}
                    onChange={(e) => setEditingMonster({ ...editingMonster, type: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Nama Musuh</label>
                  <input type="text" placeholder="e.g. Blue Slime" value={editingMonster.name}
                    onChange={(e) => setEditingMonster({ ...editingMonster, name: e.target.value })}
                    className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Level</label>
                    <input type="number" value={editingMonster.level} onChange={(e) => setEditingMonster({ ...editingMonster, level: parseInt(e.target.value) || 1 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Maks HP</label>
                    <input type="number" value={editingMonster.max_hp} onChange={(e) => { const val = parseFloat(e.target.value) || 100; setEditingMonster({ ...editingMonster, max_hp: val, hp: val }); }}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Attack</label>
                    <input type="number" value={editingMonster.attack} onChange={(e) => setEditingMonster({ ...editingMonster, attack: parseFloat(e.target.value) || 1 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Defense</label>
                    <input type="number" value={editingMonster.defense} onChange={(e) => setEditingMonster({ ...editingMonster, defense: parseFloat(e.target.value) || 0 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Kecepatan</label>
                    <input type="number" step="0.1" value={editingMonster.speed} onChange={(e) => setEditingMonster({ ...editingMonster, speed: parseFloat(e.target.value) || 1.0 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Jarak Aggro</label>
                    <input type="number" value={editingMonster.aggro_range} onChange={(e) => setEditingMonster({ ...editingMonster, aggro_range: parseFloat(e.target.value) || 5.0 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Drop Emas</label>
                    <input type="number" value={editingMonster.gold_drop} onChange={(e) => setEditingMonster({ ...editingMonster, gold_drop: parseInt(e.target.value) || 0 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8.5px] font-black text-zinc-500 uppercase tracking-wider">Drop XP</label>
                    <input type="number" value={editingMonster.xp_drop} onChange={(e) => setEditingMonster({ ...editingMonster, xp_drop: parseInt(e.target.value) || 0 })}
                      className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button onClick={() => setEditingMonster(null)}
                  className="flex-1 py-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 text-[9.5px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-colors">
                  Batal
                </button>
                <button onClick={() => handleSaveMonsterConfig(editingMonster)}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:brightness-110 active:scale-95 text-white text-[9.5px] font-black uppercase tracking-wider transition-all">
                  Simpan DB
                </button>
              </div>
            </div>
          ) : (
            <div className="w-[300px] bg-zinc-900/10 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center text-zinc-500 font-bold uppercase tracking-wider text-xs">
              <Skull className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
              Pilih salah satu monster untuk mengedit statistik atau buat monster baru!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
