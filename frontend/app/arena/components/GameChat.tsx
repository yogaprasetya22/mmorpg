/** Premium In-game chat messages panel with advanced glassmorphism and tag badges (isolated microservice). */
'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import type { GameChatRef } from '../ArenaClient.types';

export const GameChat = forwardRef<GameChatRef, { sendChatMessage: (msg: string) => void }>(
  ({ sendChatMessage }, ref) => {
    const [chatMessages, setChatMessages] = useState<{type: string; name?: string; msg: string}[]>([
      { type: "system", msg: "Selamat datang di Arena! Basmi monster di sekitarmu." },
      { type: "info", msg: "Tekan Q untuk skill, WASD bergerak, mouse untuk mengarahkan kamera." }
    ]);
    const [chatInput, setChatInput] = useState("");
    const chatScrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      appendMessage(sender: string, msg: string) {
        setChatMessages(p => [
          ...p,
          { type: "player", name: sender, msg: msg }
        ]);
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 50);
      }
    }));

    const handleSendClick = () => {
      if (chatInput.trim()) {
        sendChatMessage(chatInput.trim());
        setChatInput("");
      }
    };

    return (
      <div className="absolute left-6 bottom-6 w-[380px] bg-zinc-950/45 backdrop-blur-lg border-2 border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] pointer-events-auto z-30 transition-all hover:border-white/15">
        
        {/* Chat Header / Mode */}
        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
          <span className="text-[9.5px] font-black text-cyan-400 tracking-wider uppercase">💬 Obrolan Dunia</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        </div>

        {/* Message Panel */}
        <div 
          ref={chatScrollRef} 
          className="max-h-[130px] overflow-y-auto flex flex-col gap-1.5 pr-1 select-text scrollbar-thin scrollbar-thumb-white/10"
        >
          {chatMessages.map((m, i) => (
            <div key={i} className="text-[9px] leading-relaxed flex items-start gap-1">
              {m.type === "system" && (
                <>
                  <span className="bg-emerald-500/15 text-emerald-400 text-[7px] font-black px-1.5 py-0.5 rounded border border-emerald-500/25 uppercase shrink-0">Sistem</span>
                  <span className="text-zinc-200">{m.msg}</span>
                </>
              )}
              {m.type === "info" && (
                <>
                  <span className="bg-cyan-500/15 text-cyan-400 text-[7px] font-black px-1.5 py-0.5 rounded border border-cyan-500/25 uppercase shrink-0">Info</span>
                  <span className="text-zinc-200">{m.msg}</span>
                </>
              )}
              {m.type === "player" && (
                <>
                  <span className="bg-indigo-500/15 text-indigo-400 text-[7px] font-black px-1.5 py-0.5 rounded border border-indigo-500/25 uppercase shrink-0">{m.name}</span>
                  <span className="text-zinc-100 font-medium">{m.msg}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Input Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendClick();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.stopPropagation()} // Shield from three-drei keyboard capture
            onKeyUp={e => e.stopPropagation()} // Shield from three-drei keyboard release
            placeholder="Ketik pesan dunia..."
            className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-1.5 text-[9.5px] text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 focus:bg-white/10 transition-all shadow-inner"
          />
          <button
            type="submit"
            className="bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-3.5 py-1.5 rounded-xl text-[9px] font-black text-cyan-300 transition-all active:scale-95 shadow-md"
          >
            Kirim
          </button>
        </form>
      </div>
    );
  }
);
GameChat.displayName = "GameChat";
