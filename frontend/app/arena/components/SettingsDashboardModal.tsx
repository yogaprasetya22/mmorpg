/** Settings & Action Menu Dashboard inspired by Ragnarok: The New World CBT. */
'use client';


import { 
  X, Lock, Shield, Zap, Heart, Sparkles, Sliders, Layers, 
  PawPrint, Swords, Hammer, Landmark, Disc, 
  Award, User, BookOpen, Trophy, FileText, BarChart2, 
  LifeBuoy, RefreshCw, Settings, Book
} from 'lucide-react';
interface SettingsDashboardModalProps {
  onClose: () => void;
  onOpenStats?: () => void;
  onOpenInventory?: () => void;
}

export function SettingsDashboardModal({
  onClose,
  onOpenStats,
  onOpenInventory
}: SettingsDashboardModalProps) {

  // Unstuck action to reset player coordinates to Starter Zone center
  const handleUnstuck = () => {
    (window as any).localPlayerPos = { x: 0, y: 1.0, z: 0 };
    alert("Karakter Anda berhasil di-unstuck! Teleportasi ke pusat Prontera.");
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 w-screen h-screen z-[9998] bg-black/60 backdrop-blur-md flex items-center justify-center pointer-events-auto font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[620px] max-w-[95vw] bg-[#1a1c23]/95 border-2 border-zinc-700/60 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Button on Top Right */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 z-20 shadow-md border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── TOP BANNER: Mascot (Poring) ── */}
        <div className="relative w-full h-[140px] rounded-2xl overflow-hidden shadow-lg border border-white/10 shrink-0">
          <img 
            src="/assets/images/winking_poring_banner.png" 
            className="w-full h-full object-cover" 
            alt="Winking Poring Banner" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <div>
              <h3 className="text-sm font-black tracking-widest text-[#fdf9f3] uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">MENU PETUALANG</h3>
              <span className="text-[9px] text-zinc-300 font-bold uppercase tracking-wider mt-0.5 block drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Ragnarok - The New World</span>
            </div>
          </div>
        </div>

        {/* ── CENTER: RO Action Grid ── */}
        <div className="grid grid-cols-4 gap-2.5 max-h-[350px] overflow-y-auto pr-1">
          
          {/* Row 1: Skills, Card Fusion, Build, Pet (Double width) */}
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Zap className="w-5 h-5 text-[#34d399]" />
            <span className="text-[9.5px] font-black text-[#a7f3d0] tracking-wide uppercase">Skills</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Layers className="w-5 h-5 text-[#34d399]" />
            <span className="text-[9.5px] font-black text-[#a7f3d0] tracking-wide uppercase text-center leading-tight">Card Fusion</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Sliders className="w-5 h-5 text-[#34d399]" />
            <span className="text-[9.5px] font-black text-[#a7f3d0] tracking-wide uppercase">Build</span>
          </button>
          <button className="col-span-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#10b981]/20 hover:bg-[#10b981]/30 border-2 border-[#10b981]/50 transition-all hover:scale-[1.02] active:scale-95 group">
            <PawPrint className="w-5 h-5 text-[#6ee7b7] animate-bounce" />
            <span className="text-[9.5px] font-black text-[#6ee7b7] tracking-wider uppercase">Pet</span>
          </button>

          {/* Row 2: Gear, Shadow Gear (Locked), Raid, Romance (Double width) */}
          <button 
            onClick={() => { if (onOpenInventory) { onOpenInventory(); onClose(); } }}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#8b5cf6]/15 hover:bg-[#8b5cf6]/25 border border-[#8b5cf6]/30 transition-all hover:scale-[1.02] active:scale-95 group relative"
          >
            <Shield className="w-5 h-5 text-[#c084fc]" />
            <span className="text-[9.5px] font-black text-[#e9d5ff] tracking-wide uppercase">Gear</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 text-zinc-500 cursor-not-allowed group">
            <Lock className="w-5 h-5 text-zinc-600" />
            <span className="text-[9px] font-black text-zinc-500 tracking-wide uppercase">Shadow Gear</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#8b5cf6]/15 hover:bg-[#8b5cf6]/25 border border-[#8b5cf6]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Swords className="w-5 h-5 text-[#c084fc]" />
            <span className="text-[9.5px] font-black text-[#e9d5ff] tracking-wide uppercase">Raid</span>
          </button>
          <button className="col-span-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#8b5cf6]/20 hover:bg-[#8b5cf6]/30 border-2 border-[#8b5cf6]/50 transition-all hover:scale-[1.02] active:scale-95 group">
            <Heart className="w-5 h-5 text-[#f472b6] animate-pulse" />
            <span className="text-[9.5px] font-black text-[#f472b6] tracking-wider uppercase">Romance</span>
          </button>

          {/* Row 3: Relics, Apocalypse Star (Locked), Life Jobs, Guild (Double width) */}
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#14b8a6]/15 hover:bg-[#14b8a6]/25 border border-[#14b8a6]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Sparkles className="w-5 h-5 text-[#2dd4bf]" />
            <span className="text-[9.5px] font-black text-[#99f6e4] tracking-wide uppercase">Relics</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 text-zinc-500 cursor-not-allowed group">
            <Lock className="w-5 h-5 text-zinc-600" />
            <span className="text-[9px] font-black text-zinc-500 tracking-wide uppercase">Apocalypse</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#14b8a6]/15 hover:bg-[#14b8a6]/25 border border-[#14b8a6]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Hammer className="w-5 h-5 text-[#2dd4bf]" />
            <span className="text-[9.5px] font-black text-[#99f6e4] tracking-wide uppercase">Life Jobs</span>
          </button>
          <button className="col-span-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#14b8a6]/20 hover:bg-[#14b8a6]/30 border-2 border-[#14b8a6]/50 transition-all hover:scale-[1.02] active:scale-95 group">
            <Landmark className="w-5 h-5 text-[#2dd4bf]" />
            <span className="text-[9.5px] font-black text-[#99f6e4] tracking-wider uppercase">Guild</span>
          </button>

          {/* Row 4: Rune Engine, Title, Profile */}
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#0ea5e9]/15 hover:bg-[#0ea5e9]/25 border border-[#0ea5e9]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Disc className="w-5 h-5 text-[#38bdf8]" />
            <span className="text-[9.5px] font-black text-[#bae6fd] tracking-wide uppercase text-center leading-tight">Rune Engine</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#0ea5e9]/15 hover:bg-[#0ea5e9]/25 border border-[#0ea5e9]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Award className="w-5 h-5 text-[#38bdf8]" />
            <span className="text-[9.5px] font-black text-[#bae6fd] tracking-wide uppercase">Title</span>
          </button>
          <button 
            onClick={() => { if (onOpenStats) { onOpenStats(); onClose(); } }}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#0ea5e9]/15 hover:bg-[#0ea5e9]/25 border border-[#0ea5e9]/30 transition-all hover:scale-[1.02] active:scale-95 group"
          >
            <User className="w-5 h-5 text-[#38bdf8]" />
            <span className="text-[9.5px] font-black text-[#bae6fd] tracking-wide uppercase">Profile</span>
          </button>

          {/* Row 5: Index, Achievements, Memoirs */}
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#eab308]/15 hover:bg-[#eab308]/25 border border-[#eab308]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <BookOpen className="w-5 h-5 text-[#facc15]" />
            <span className="text-[9.5px] font-black text-[#fef08a] tracking-wide uppercase">Index</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#eab308]/15 hover:bg-[#eab308]/25 border border-[#eab308]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Trophy className="w-5 h-5 text-[#facc15]" />
            <span className="text-[9.5px] font-black text-[#fef08a] tracking-wide uppercase">Achievements</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-[#eab308]/15 hover:bg-[#eab308]/25 border border-[#eab308]/30 transition-all hover:scale-[1.02] active:scale-95 group">
            <Award className="w-5 h-5 text-[#facc15]" />
            <span className="text-[9.5px] font-black text-[#fef08a] tracking-wide uppercase">Memoirs</span>
          </button>

        </div>

        {/* ── BOTTOM ROW: Utilities & Channel Popover ── */}
        <div className="flex justify-between items-center border-t border-zinc-700/60 pt-4 mt-1 shrink-0 relative">
          
          {/* Action Row */}
          <div className="flex gap-4">
            <button className="flex flex-col items-center text-zinc-400 hover:text-white transition-colors">
              <LifeBuoy className="w-4 h-4 text-[#fbbf24]" />
              <span className="text-[7.5px] font-bold mt-1 uppercase tracking-wide">Support</span>
            </button>
            <button className="flex flex-col items-center text-zinc-400 hover:text-white transition-colors">
              <FileText className="w-4 h-4 text-[#f43f5e]" />
              <span className="text-[7.5px] font-bold mt-1 uppercase tracking-wide">Ban Notice</span>
            </button>
            <button className="flex flex-col items-center text-zinc-400 hover:text-white transition-colors">
              <Book className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-[7.5px] font-bold mt-1 uppercase tracking-wide">Casual</span>
            </button>
            <button className="flex flex-col items-center text-zinc-400 hover:text-white transition-colors">
              <BarChart2 className="w-4 h-4 text-[#10b981]" />
              <span className="text-[7.5px] font-bold mt-1 uppercase tracking-wide">Rankings</span>
            </button>
            <button 
              onClick={handleUnstuck}
              className="flex flex-col items-center text-zinc-400 hover:text-white transition-colors"
              title="Teleport to safety if stuck in map structures"
            >
              <RefreshCw className="w-4 h-4 text-[#a7f3d0] animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-[7.5px] font-bold mt-1 uppercase tracking-wide text-[#a7f3d0]">Unstuck</span>
            </button>
            <button className="flex flex-col items-center text-zinc-400 hover:text-white transition-colors">
              <Settings className="w-4 h-4 text-[#cbd5e1]" />
              <span className="text-[7.5px] font-bold mt-1 uppercase tracking-wide">Settings</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
