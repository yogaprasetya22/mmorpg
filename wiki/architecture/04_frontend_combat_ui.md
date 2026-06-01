# 04. Frontend Combat UI, ASPD & Visual VFX
> **Tujuan**: Sinkronisasi kecepatan putar animasi karakter berdasarkan nilai ASPD aktual backend, memisahkan rendering Cast Time Fixed vs. Variable, dan mengoptimalkan batched popups Damage HUD.

Layer presentasi visual game MMORPG Anda ditangani di file `@[/home/yoga/Dokumen/game mmorpg/frontend/src/components/game/PlayerController.tsx]` dan sistem batching popup kerusakan di `@[/home/yoga/Dokumen/game mmorpg/frontend/src/components/game/systems/DamageHUDBatcher.tsx]`.

---

## 🛠️ Langkah Demi Langkah (Step-by-Step)

### Langkah 1: Sinkronisasi ASPD dengan Kecepatan Animasi Three.js

Client harus mengambil durasi asli klip animasi serang yang digunakan dan menyesuaikan kecepatannya (*playback rate*) agar persis memukul sesuai dengan frekuensi ketukan hit-rate yang ditentukan backend.

Cari bagian pemrosesan animasi serang di file `@[/home/yoga/Dokumen/game mmorpg/frontend/src/components/game/PlayerController.tsx]` (sekitar baris 914-935):

```typescript
      const shootAction = actions[targetAnim] || actions[animationSet.shoot];
      if (shootAction) {
        // Ambil durasi klip asli di file model 3D (misal: 1.2 detik per ayunan penuh)
        const defaultAnimationDuration = shootAction.getClip()?.duration || 1.0;
        
        // Formula penyelarasan: Kecepatan Animasi = Pukulan Per Detik * Durasi File Animasi Asli
        const animationSpeedScale = hitsPerSecond * defaultAnimationDuration;

        // Force reset frame pemutaran jika baru memulai serangan pukulan berikutnya
        const isNewAttack = now - attackTimer[0] < 30; // terdeteksi di frame yang sama
        if (shootAction !== activeAction.current || isNewAttack) {
          shootAction.reset().play();
          if (activeAction.current && activeAction.current !== shootAction) {
            activeAction.current.crossFadeTo(shootAction, 0.05, true);
          }
          activeAction.current = shootAction;
        }
        
        // Menerapkan pengali playback speed factor langsung ke Three.js ActionAnimator
        shootAction.timeScale = animationSpeedScale;
      }
```

Hal ini menjamin bahwa visual ayunan senjata 3D karakter Anda terlihat selaras (tidak lambat atau bertumpuk) dengan status ASPD server saat menyentuh angka 193.

---

### Langkah 2: Split Visualizer Cast Time (Fixed vs. Variable)

Untuk perapalan sihir, visual kemajuan cast bar di kepala karakter dibagi atas **Fixed Cast Time (FCT)** dan **Variable Cast Time (VCT)**.

Buat pemisahan persentase di komponen UI casting Anda:

```tsx
import React from 'react';

export const CastProgressBar: React.FC<{ vctRatio: number; fctRatio: number }> = ({ vctRatio, fctRatio }) => {
  // vctRatio = sisa persentase variable cast (hijau)
  // fctRatio = sisa persentase fixed cast (kuning)
  const totalCastProgress = vctRatio + fctRatio;

  return (
    <div className="relative w-40 h-2.5 bg-black/60 rounded-full border border-gray-800 overflow-hidden shadow-md">
      {/* VCT Progress (Variable) - Hijau */}
      <div 
        style={{ width: `${vctRatio * 100}%` }}
        className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-75"
      />
      {/* FCT Progress (Fixed) - Kuning */}
      <div 
        style={{ width: `${fctRatio * 100}%`, left: `${vctRatio * 100}%` }}
        className="absolute top-0 h-full bg-amber-400 transition-all duration-75"
      />
    </div>
  );
};
```

---

### Langkah 3: Mengoptimalkan Jittering & Batching Damage HUD Popups

Buka file `@[/home/yoga/Dokumen/game mmorpg/frontend/src/components/game/systems/DamageHUDBatcher.tsx]`. Untuk menghindari beban berlebih pada DOM di keramaian perang (High ASPD):
1.  Batasi maksimal 30 popup aktif di memori client (`damageQueue.slice(-30)`).
2.  Gunakan `Float32Array` untuk pergeseran posisi koordinat koordinasi acak (*jittering*) popup agar tidak bertumpuk di piksel yang sama.

```typescript
  const addDamagePopup = (damage: number, isCrit: boolean, posX: number, posY: number) => {
    const newPopup = {
      id: Math.random().toString(36).substring(2, 9),
      damage,
      isCrit,
      // Berikan goyangan koordinat acak ringan (+/- 10px) agar popup mudah dibaca
      x: posX + (Math.random() * 20 - 10),
      y: posY - 30
    };
    
    setDamageQueue(prev => [...prev.slice(-29), newPopup]); // Pruning antrian agar tetap efisien
  };
```

---

### Langkah 4: Visual Skenario Khusus Damage Critical (C.RATE)

Pada CSS render text popup di `DamageHUDBatcher.tsx`, terapkan efek tipografi premium tebal miring berwarna emas bercahaya khusus saat mendeteksi tipe critical (`isCrit = true`):

```tsx
<span
  key={pop.id}
  style={{ left: pop.x, top: pop.y }}
  className={`absolute text-2xl font-black tracking-tighter filter drop-shadow-[0_3px_3px_rgba(0,0,0,1)] animate-damage-bounce ${
    pop.isCrit 
      ? 'text-yellow-400 scale-125 font-black italic text-4xl border-amber-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]' // Efek bersinar premium untuk Critical Hit
      : 'text-white'
  }`}
>
  {pop.isCrit ? `🔥 ${pop.damage}` : pop.damage}
</span>
```

CSS Animasi Bouncing Premium di `globals.css`:
```css
@keyframes damage-bounce {
  0% { transform: translateY(0) scale(0.3); opacity: 0; }
  15% { transform: translateY(-40px) scale(1.1); opacity: 1; }
  30% { transform: translateY(-30px) scale(1.0); }
  85% { transform: translateY(-30px) scale(1.0); opacity: 1; }
  100% { transform: translateY(-60px) scale(0.85); opacity: 0; }
}

.animate-damage-bounce {
  animation: damage-bounce 1.0s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
```

Dengan terselesaikannya seluruh tahap 1 sampai 4 ini, sistem mekanik statistik dan combat MMORPG Anda telah siap mendukung aksi pertempuran kompetitif yang dinamis, lancar, dan aman!

---

🏆 **Siklus Implementasi Selesai**: Buka [Menu Utama Wiki](file:///home/yoga/Dokumen/game%20mmorpg/wiki/architecture/README.md) untuk meninjau peta navigasi arsitektur pertempuran game Anda secara penuh!
