/** Session recovery and world loading splash screens. */
'use client';

import { Sword, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  type: 'session' | 'world';
  successMsg?: string;
}

export function LoadingScreen({ type, successMsg }: LoadingScreenProps) {
  if (type === 'session') {
    return (
      <div className="fixed inset-0 w-screen h-screen z-[999] bg-[#060608] flex flex-col items-center justify-center gap-6 font-sans">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[20%] left-[20%] w-[45%] h-[45%] bg-cyan-600/10 blur-[130px] rounded-full animate-pulse" />
          <div className="absolute bottom-[20%] right-[20%] w-[45%] h-[45%] bg-indigo-600/10 blur-[130px] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-sm text-center px-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sword className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">
              Jagres <span className="text-cyan-400">ARENA</span>
            </h2>
            <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse mt-1">
              Menghubungkan Sesi...
            </p>
            <p className="text-zinc-400 text-[10px] font-bold tracking-widest uppercase">
              {successMsg || "Mengembalikan Karakter & Dunia 3D"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // type === 'world'
  return (
    <div className="absolute inset-0 z-[9999] flex flex-col justify-center items-center bg-[#07070a]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-cyan-600/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-[20%] right-[20%] w-[60%] h-[60%] bg-indigo-600/10 blur-[130px] rounded-full" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col gap-1 items-center animate-pulse">
          <span className="text-[10px] font-black uppercase text-cyan-400 tracking-[0.3em] ml-1">MENYIAPKAN PETA DUNIA</span>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white italic">
            Jagres <span className="text-cyan-400">ARENA</span>
          </h1>
        </div>

        <div className="relative w-16 h-16 flex items-center justify-center my-4">
          <div className="absolute inset-0 border-4 border-cyan-500/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-zinc-100">Memuat Aset & Tinggi Terrain...</p>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            Mempersiapkan struktur data BVH untuk stabilitas fisika karakter
          </p>
        </div>

        <div className="mt-8 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl text-left">
          <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest block mb-1">TIPS BERMAIN</span>
          <p className="text-[10px] text-zinc-400 leading-normal">
            Gunakan tombol WASD untuk bergerak, tombol Shift untuk berlari, dan arahkan kursor mouse untuk auto-aim target monster terdekat di sekitar jangkauan serangan kelas Anda!
          </p>
        </div>
      </div>
    </div>
  );
}
