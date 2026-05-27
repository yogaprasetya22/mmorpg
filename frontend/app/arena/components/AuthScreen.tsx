/** Login and registration screen for the Arena game. */
'use client';

import { Sword, User, Key, RefreshCw, Zap } from 'lucide-react';

interface AuthScreenProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  isLogin: boolean;
  setIsLogin: (v: boolean) => void;
  loading: boolean;
  errorMsg: string;
  setErrorMsg: (v: string) => void;
  successMsg: string;
  setSuccessMsg: (v: string) => void;
  handleAuthSubmit: (e: React.FormEvent) => void;
}

export function AuthScreen({
  username, setUsername, password, setPassword,
  isLogin, setIsLogin, loading, errorMsg, setErrorMsg,
  successMsg, setSuccessMsg, handleAuthSubmit
}: AuthScreenProps) {
  const handleToggle = () => {
    setIsLogin(!isLogin);
    setErrorMsg("");
    setSuccessMsg("");
  };

  return (
    <div className="relative min-h-screen bg-[#060608] text-white flex flex-col justify-center items-center font-sans overflow-hidden">
      {/* Colorful Neon Blur Backgrounds */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[20%] w-[35%] h-[35%] bg-cyan-600/10 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] right-[20%] w-[35%] h-[35%] bg-indigo-600/10 blur-[130px] rounded-full" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-zinc-950/70 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-500">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg shadow-cyan-500/20">
            <Sword className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white leading-none mt-2">
            SEAL M <span className="text-cyan-400">ARENA</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Go authoritative clean architecture backend</p>
        </div>

        <form className="flex flex-col gap-4 mt-2" onSubmit={handleAuthSubmit}>
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

          {/* Username Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Username Akun</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-600">
                <User className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yoga_hero"
                required
                className="w-full bg-zinc-900/60 border border-white/5 pl-11 pr-4 py-3.5 rounded-xl text-sm font-semibold focus:outline-none focus:border-cyan-500/50 transition-all text-white placeholder-zinc-700"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Kata Sandi</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-600">
                <Key className="w-4 h-4" />
              </span>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-900/60 border border-white/5 pl-11 pr-4 py-3.5 rounded-xl text-sm font-semibold focus:outline-none focus:border-cyan-500/50 transition-all text-white placeholder-zinc-700"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 relative group w-full overflow-hidden"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-indigo-600 rounded-xl blur opacity-30 group-hover:opacity-75 transition duration-300" />
            <div className="relative bg-gradient-to-b from-cyan-400 to-indigo-700 hover:brightness-105 active:scale-95 text-white font-black text-xs py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest border border-white/10 shadow-2xl">
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                   <Zap className="w-4 h-4 fill-white" />
                   {isLogin ? "MASUK ARENA" : "DAFTAR AKUN BARU"}
                </>
              )}
            </div>
          </button>
        </form>

        {/* Toggle register */}
        <div className="text-center text-xs text-zinc-600 font-semibold mt-2">
          {isLogin ? "Belum punya akun?" : "Sudah memiliki akun?"}{" "}
          <button 
            onClick={handleToggle}
            className="text-cyan-400 hover:text-cyan-300 underline font-bold"
          >
            {isLogin ? "Daftar Sekarang" : "Masuk di Sini"}
          </button>
        </div>
      </div>
    </div>
  );
}
