/** In-game chat messages panel with input field (isolated microservice). */
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

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation(); // Shield from three-drei keyboard capture
      if (e.key === "Enter" && chatInput.trim()) {
        sendChatMessage(chatInput.trim());
        setChatInput("");
      }
    };

    return (
      <div className="absolute left-3 bottom-16 w-[280px] flex flex-col gap-1 pointer-events-auto">
        <div ref={chatScrollRef} className="max-h-[80px] overflow-y-auto flex flex-col gap-1 pr-1">
          {chatMessages.map((m, i) => (
            <p key={i} className="text-[9px] leading-relaxed">
              {m.type === "system" && <><span className="text-emerald-400 font-black mr-1">[Sistem]</span><span className="text-zinc-300">{m.msg}</span></>}
              {m.type === "info" && <><span className="text-amber-400 font-black mr-1">[Info]</span><span className="text-zinc-300">{m.msg}</span></>}
              {m.type === "player" && <><span className="text-indigo-400 font-black mr-1">[{m.name}]</span><span className="text-zinc-100">{m.msg}</span></>}
            </p>
          ))}
        </div>
        {/* Input */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onKeyUp={e => e.stopPropagation()} // Shield from three-drei keyboard release
            placeholder="Ketik pesan..."
            className="flex-1 bg-black/55 border border-white/10 rounded-lg px-2.5 py-1 text-[9px] text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 backdrop-blur-sm"
          />
          <button
            onClick={handleSendClick}
            className="bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/30 px-2.5 py-1 rounded-lg text-[9px] font-black text-cyan-300 transition-all"
          >Enter</button>
        </div>
      </div>
    );
  }
);
GameChat.displayName = "GameChat";
