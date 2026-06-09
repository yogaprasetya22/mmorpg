/** Character selection grid and character creation form screen. */
'use client';

import { Sword, Shield, User, LogOut, RefreshCw, Trophy, Zap, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { CLASS_LABELS, HAIR_COLORS, CLASS_OPTIONS, CLASS_DESCRIPTIONS } from '../ArenaClient.constants';

interface CharacterSelectScreenProps {
  username: string;
  characters: any[];
  errorMsg: string;
  successMsg: string;
  loading: boolean;
  isCreatingChar: boolean;
  setIsCreatingChar: (v: boolean) => void;
  charName: string;
  setCharName: (v: string) => void;
  charClass: string;
  setCharClass: (v: string) => void;
  charGender: string;
  setCharGender: (v: string) => void;
  charHairStyle: number;
  setCharHairStyle: (v: number) => void;
  charHairColor: string;
  setCharHairColor: (v: string) => void;
  handleCreateCharacter: (e: React.FormEvent) => void;
  handleLogout: () => void;
  setSelectedCharacter: (char: any) => void;
  setEnvReady: (v: boolean) => void;
}

export function CharacterSelectScreen({
  username, characters, errorMsg, successMsg, loading,
  isCreatingChar, setIsCreatingChar,
  charName, setCharName, charClass, setCharClass,
  charGender, setCharGender, charHairStyle, setCharHairStyle,
  charHairColor, setCharHairColor,
  handleCreateCharacter, handleLogout, setSelectedCharacter, setEnvReady
}: CharacterSelectScreenProps) {
  const handleSelectChar = (char: any) => {
    localStorage.setItem("game_active_char_id", char.id);
    setSelectedCharacter(char);
  };

  const handleEnterArena = (e: React.MouseEvent, char: any) => {
    e.stopPropagation();
    localStorage.setItem("game_active_char_id", char.id);
    setEnvReady(false);
    setSelectedCharacter(char);
  };

  return (
    <div className="relative min-h-screen bg-[#060608] text-white flex flex-col justify-center items-center font-sans overflow-y-auto py-10 px-4">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[45%] h-[45%] bg-cyan-600/5 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[45%] h-[45%] bg-indigo-600/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">AKUN AKTIF: {username || "Pemain"}</span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" /> PILIH KARAKTER ANDA
            </h1>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Ganti Akun
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-red-400 text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-xl text-green-400 text-xs font-semibold leading-relaxed animate-pulse">
            {successMsg}
          </div>
        )}

        {isCreatingChar ? (
          /* Creation mode */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Form customizer */}
            <form onSubmit={handleCreateCharacter} className="md:col-span-2 bg-zinc-950/50 backdrop-blur-md border border-white/10 p-8 rounded-3xl flex flex-col gap-6">
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" /> KUSTOMISASI KARAKTER
              </h2>

              <div className="bg-gradient-to-r from-cyan-950/30 to-indigo-950/30 border border-cyan-500/20 p-5 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase leading-none">REKOMENDASI</span>
                </div>
                <p className="text-xs text-zinc-300 font-semibold leading-relaxed">
                  Gunakan <span className="text-cyan-400 font-extrabold">3D Avatar Creator</span> untuk merancang penampilan karakter Anda secara lengkap (gaya pakaian, sepatu, senjata) secara visual dalam 3D.
                </p>
                <Link
                  href="/character-creation"
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:brightness-110 text-white font-black text-xs py-3 rounded-xl border border-cyan-400/20 uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-95 shadow-md shadow-cyan-500/10 flex items-center justify-center gap-2 pointer-events-auto"
                >
                  🎨 MASUK KE 3D CREATOR
                </Link>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Nama Karakter</label>
                <input type="text" required value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="Masukkan nama karakter..."
                  className="w-full bg-zinc-900/60 border border-white/10 px-4 py-3 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder-zinc-600" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Jenis Kelamin</label>
                <div className="grid grid-cols-2 gap-3">
                  {["Male", "Female"].map((gender) => (
                    <button key={gender} type="button" onClick={() => setCharGender(gender)}
                      className={`py-3.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${charGender === gender ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-md shadow-cyan-500/10" : "bg-zinc-900/30 border-white/5 text-zinc-400 hover:border-white/10"}`}>
                      {gender === "Male" ? "Laki-laki (Male)" : "Perempuan (Female)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Pilih Kelas</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {CLASS_OPTIONS.map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setCharClass(key)}
                      className={`py-3.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${charClass === key ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-md shadow-indigo-500/10" : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Gaya Rambut</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((style) => (
                    <button key={style} type="button" onClick={() => setCharHairStyle(style)}
                      className={`py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${charHairStyle === style ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10"}`}>
                      Model {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Warna Rambut</label>
                <div className="flex gap-3">
                  {HAIR_COLORS.map((color) => (
                    <button key={color} type="button" onClick={() => setCharHairColor(color)} style={{ backgroundColor: color }}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${charHairColor === color ? "border-cyan-400 scale-110 shadow-lg shadow-cyan-400/30" : "border-transparent"}`} />
                  ))}
                </div>
              </div>

              <div className="flex gap-4 mt-2">
                {characters.length > 0 && (
                  <button type="button" onClick={() => setIsCreatingChar(false)}
                    className="flex-1 py-4 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all text-zinc-400">
                    Batal
                  </button>
                )}
                <button type="submit" disabled={loading}
                  className="flex-[2] py-4 bg-gradient-to-r from-cyan-400 to-indigo-600 hover:brightness-105 active:scale-95 border border-white/10 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 fill-white" /> BUAT & MASUK</>}
                </button>
              </div>
            </form>

            {/* Class preview */}
            <div className="bg-zinc-950/30 border border-white/5 p-6 rounded-3xl flex flex-col gap-4">
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 leading-none">PREVIEW KELAS</span>
              <h3 className="text-2xl font-black tracking-tight text-white uppercase leading-none">
                {CLASS_LABELS[charClass] || charClass}
              </h3>
              
              <div className="w-full aspect-[4/3] rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5 shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
                <Sword className="w-12 h-12 text-zinc-700" />
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                {CLASS_DESCRIPTIONS[charClass] || ""}
              </p>

              <div className="border-t border-white/5 pt-4 mt-auto">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Kustomisasi Aktif:</span>
                <div className="flex gap-3 text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-wider">
                  <span>{charGender === "Male" ? "Male" : "Female"}</span>
                  <span>Style {charHairStyle}</span>
                  <span className="flex items-center gap-1.5">Color: <span style={{ backgroundColor: charHairColor }} className="w-3 h-3 rounded-full border border-white/10" /></span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Selection Grid list */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {characters.map((char) => (
              <div 
                key={char.id} 
                onClick={() => handleSelectChar(char)}
                className={`group relative cursor-pointer overflow-hidden rounded-3xl bg-zinc-950/60 hover:bg-zinc-950/85 border p-6 flex flex-col gap-4 shadow-xl transition-all hover:-translate-y-1 active:scale-98 shadow-black/40 ${
                  char.class === "Warrior" ? "border-red-950/40 hover:border-red-500/40" :
                  char.class === "Mage" ? "border-blue-950/40 hover:border-blue-500/40" :
                  char.class === "Priest" ? "border-amber-950/40 hover:border-amber-500/40" :
                  char.class === "Thief" ? "border-purple-950/40 hover:border-purple-500/40" :
                  "border-emerald-950/40 hover:border-emerald-500/40"
                }`}
              >
                <div className="absolute top-0 right-0 p-4 leading-none z-0 opacity-10 group-hover:opacity-20 transition-all">
                  {char.class === "Warrior" && <Sword className="w-20 h-20 text-white" />}
                  {char.class === "Mage" && <Zap className="w-20 h-20 text-white" />}
                  {char.class === "Priest" && <Sparkles className="w-20 h-20 text-white" />}
                  {char.class === "Thief" && <Target className="w-20 h-20 text-white" />}
                  {char.class === "Beginner" && <Shield className="w-20 h-20 text-white" />}
                </div>

                <div className="relative z-10 flex items-center justify-between border-b border-white/5 pb-3">
                  <span className={`text-[10px] font-black uppercase tracking-widest border px-2.5 py-1 rounded-full ${
                    char.class === "Warrior" ? "bg-red-950/30 border-red-800/30 text-red-400" :
                    char.class === "Mage" ? "bg-blue-950/30 border-blue-800/30 text-blue-400" :
                    char.class === "Priest" ? "bg-amber-950/30 border-amber-800/30 text-amber-400" :
                    char.class === "Thief" ? "bg-purple-950/30 border-purple-800/30 text-purple-400" :
                    "bg-emerald-950/30 border-emerald-800/30 text-emerald-400"
                  }`}>
                    {CLASS_LABELS[char.class] || char.class}
                  </span>
                  <span className="text-zinc-500 text-xs font-black tracking-widest uppercase">LV.{char.level}</span>
                </div>

                <div className="relative z-10 flex flex-col gap-0.5 mt-2">
                  <span className="text-lg font-black tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                    {char.username}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 mt-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gold: {char.gold}G</span>
                  </div>
                </div>

                <div className="relative z-10 mt-auto border-t border-white/5 pt-4">
                  <button 
                    onClick={(e) => handleEnterArena(e, char)}
                    className="w-full bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 hover:border-cyan-400 group-hover:scale-102 hover:text-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    MASUK ARENA
                  </button>
                </div>
              </div>
            ))}

            {/* Add New character placeholder card */}
            <button 
              onClick={() => setIsCreatingChar(true)}
              className="cursor-pointer border border-dashed border-white/10 hover:border-cyan-500/30 bg-zinc-950/10 hover:bg-zinc-950/30 rounded-3xl p-8 flex flex-col justify-center items-center gap-3 transition-all min-h-[220px] pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
                <span className="text-2xl font-black leading-none">+</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-cyan-400 transition-colors">
                Buat Karakter Baru (3D Creator)
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
