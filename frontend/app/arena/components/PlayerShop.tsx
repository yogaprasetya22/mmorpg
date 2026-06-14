/** Adventure Shop panel aligned with vintage parchment RPG styling (isolated microservice). */
'use client';

import { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '@/src/core/config';

interface ShopItem {
  id: string;
  name: string;
  type: 'equipment' | 'consumable';
  price: number;
  desc: string;
  icon: string;
  slot?: string;
  add_hp?: number;
  add_mp?: number;
  add_attack?: number;
  add_defense?: number;
}

const SHOP_ITEMS: ShopItem[] = [
  // Consumables
  { id: "potion_red", name: "Red Potion", type: "consumable", price: 50, desc: "Memulihkan 150 HP saat digunakan.", icon: "🔴", add_hp: 150 },
  { id: "potion_blue", name: "Blue Potion", type: "consumable", price: 80, desc: "Memulihkan 50 MP saat digunakan.", icon: "🔵", add_mp: 50 },
  { id: "potion_green", name: "Green Potion", type: "consumable", price: 120, desc: "Memulihkan 300 HP dan 30 MP saat digunakan.", icon: "🟢", add_hp: 300, add_mp: 30 },

  // Weapons
  { id: "sword_iron", name: "Iron Sword", type: "equipment", slot: "weapon", price: 500, desc: "Pedang besi tempaan. ATK +30.", icon: "⚔️", add_attack: 30 },
  { id: "axe_iron", name: "Iron Axe", type: "equipment", slot: "weapon", price: 650, desc: "Kapak perang besi yang berat. ATK +40.", icon: "🪓", add_attack: 40 },
  { id: "bow_hunter", name: "Hunter Bow", type: "equipment", slot: "weapon", price: 550, desc: "Busur pemburu gesit. ATK +35.", icon: "🏹", add_attack: 35 },
  { id: "staff_magic", name: "Magic Staff", type: "equipment", slot: "weapon", price: 800, desc: "Tongkat sihir beraliran mana. ATK +25, Max SP +60.", icon: "🪄", add_attack: 25, add_mp: 60 },

  // Armors / Gears
  { id: "leather_armor", name: "Leather Armor", type: "equipment", slot: "armor", price: 400, desc: "Zirah kulit ringan. DEF +15.", icon: "👕", add_defense: 15 },
  { id: "chain_mail", name: "Chain Mail", type: "equipment", slot: "armor", price: 1200, desc: "Baju rantai besi rajutan. DEF +30.", icon: "⛓️", add_defense: 30 },
  { id: "plate_armor", name: "Plate Armor", type: "equipment", slot: "armor", price: 3500, desc: "Zirah pelat baja kokoh. DEF +55, Max HP +100.", icon: "🛡️", add_defense: 55, add_hp: 100 },
  { id: "iron_helm", name: "Iron Helm", type: "equipment", slot: "helmet", price: 300, desc: "Pelindung kepala besi. DEF +10, Max HP +30.", icon: "🪖", add_defense: 10, add_hp: 30 },
  { id: "leather_boots", name: "Leather Boots", type: "equipment", slot: "boots", price: 200, desc: "Sepatu boots kulit nyaman. DEF +8.", icon: "🥾", add_defense: 8 },
  { id: "iron_shield", name: "Iron Shield", type: "equipment", slot: "shield", price: 600, desc: "Perisai besi kokoh. DEF +20.", icon: "🔰", add_defense: 20 },
  { id: "accessory_ring", name: "Power Ring", type: "equipment", slot: "accessory", price: 1500, desc: "Cincin penambah kekuatan fisik. ATK +15, Max HP +50.", icon: "💍", add_attack: 15, add_hp: 50 },
];

const ITEM_THUMBNAIL_MAP: Record<string, string> = {
  sword_iron: "/assets/characters/thumbnails/Sword.png",
  sword_starter: "/assets/characters/thumbnails/Sword.png",
  axe_iron: "/assets/characters/thumbnails/Battle_Axe.png",
  bow_hunter: "/assets/characters/thumbnails/Battle_Bow.png",
  bow_starter: "/assets/characters/thumbnails/Battle_Bow.png",
  staff_magic: "/assets/characters/thumbnails/Battle_Scythe.png",
  staff_starter: "/assets/characters/thumbnails/Battle_Scythe.png",
  mace_starter: "/assets/characters/thumbnails/Battle_Hammer.png",
  dagger_starter: "/assets/characters/thumbnails/Battle_Scythe.png",
  leather_armor: "/assets/characters/thumbnails/Outfit.002.png",
  chain_mail: "/assets/characters/thumbnails/Outfit.003.png",
  plate_armor: "/assets/characters/thumbnails/Outfit.004.png",
  iron_helm: "/assets/characters/thumbnails/Hat.001.png",
  leather_boots: "/assets/characters/thumbnails/Shoes.002.png",
};

function ShopItemThumbnail({ itemID, className = "h-[38px] w-[38px]", emojiFallback = "📦" }: { itemID: string; className?: string; emojiFallback?: string }) {
  const relativeUrl = ITEM_THUMBNAIL_MAP[itemID];
  if (!relativeUrl) {
    return <div className={`${className} bg-[#fdf9f3] border border-dashed border-[#dfb76c]/30 rounded-xl flex items-center justify-center text-[16px] shrink-0`}>{emojiFallback}</div>;
  }
  return (
    <div className={`${className} bg-white border border-[#dfb76c]/40 rounded-xl overflow-hidden flex items-center justify-center shadow-sm shrink-0 p-0.5`}>
      <img
        src={`${API_BASE_URL}${relativeUrl}`}
        className="w-full h-full object-contain"
        alt=""
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
}

interface PlayerShopProps {
  playerStats: any;
  onClose: () => void;
  sendBuyItem: (catalogItemId: string, amount: number) => void;
}

export function PlayerShop({ playerStats, onClose, sendBuyItem }: PlayerShopProps) {
  const [shopTab, setShopTab] = useState<'all' | 'equipment' | 'consumable'>('all');
  const [selectedShopItem, setSelectedShopItem] = useState<ShopItem | null>(SHOP_ITEMS[0]);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyError, setBuyError] = useState("");

  const handleBuyClick = () => {
    if (!selectedShopItem) return;
    const cost = selectedShopItem.price * buyQuantity;
    if ((playerStats.gold ?? 0) < cost) {
      setBuyError("Zeny tidak mencukupi!");
      return;
    }
    sendBuyItem(selectedShopItem.id, buyQuantity);
    setBuySuccess(true);
    setBuyError("");
    setTimeout(() => {
      setBuySuccess(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] z-[9999] bg-[#ebdcb9]/40 backdrop-blur-sm flex flex-col font-sans text-[#4a3000] pointer-events-auto select-none overflow-hidden animate-in fade-in duration-200">
      
      {/* ── BACKGROUND PARCHMENT ── */}
      <div className="absolute inset-0 z-0 bg-[#fdf9f3] pointer-events-none" />

      {/* ── TOP HEADER BAR ── */}
      <div className="relative z-10 px-6 py-3.5 flex justify-between items-center border-b border-[#dfb76c]/30 bg-[#ebdcb9]/20 shrink-0 select-none">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#fdf9f3] hover:bg-[#ebdcb9] flex items-center justify-center text-[#4a3000] border border-[#dfb76c] active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-[#4a3000]" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black tracking-wider uppercase text-[#4a3000] drop-shadow-sm">KEDAI PETUALANG</span>
            <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-widest bg-[#ebdcb9]/40 border border-[#dfb76c]/40 px-2 py-0.5 rounded-full ml-1">SHOP</span>
          </div>
        </div>

        {/* Center: Currencies */}
        <div className="flex items-center gap-6 bg-[#ebdcb9]/35 border border-[#dfb76c]/40 px-5 py-1.5 rounded-full shadow-inner text-[#4a3000]">
          {/* Crystals */}
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-300 filter drop-shadow-sm text-sm">💠</span>
            <span className="text-xs font-black text-[#4a3000]">88</span>
          </div>
          {/* Gold */}
          <div className="flex items-center gap-1.5">
            <span className="w-4.5 h-4.5 rounded-full bg-amber-400 flex items-center justify-center text-[8.5px] font-black text-black shadow-sm">A</span>
            <span className="text-xs font-black text-[#4a3000]">599</span>
          </div>
          {/* Zeny */}
          <div className="flex items-center gap-1.5">
            <span className="w-4.5 h-4.5 rounded-full bg-[#38bdf8] flex items-center justify-center text-[8.5px] font-black text-black shadow-sm">Z</span>
            <span className="text-xs font-black text-[#b88c42]">{(playerStats.gold ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Right: Close Button */}
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 bg-[#ebdcb9]/35 border border-[#dfb76c]/40 px-4 py-1.5 rounded-full font-black text-[10.5px] tracking-wider uppercase text-[#4a3000] shadow-sm active:scale-95 transition-all hover:bg-[#ebdcb9]"
        >
          <X className="w-3.5 h-3.5" />
          <span>Tutup</span>
        </button>
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div className="flex-1 flex min-h-0 relative z-10 px-6 py-4 gap-6 select-none">
        
        {/* Left Panel: Item Lists & Catalog Tabs */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Tabs */}
          <div className="flex gap-1.5 bg-[#ebdcb9]/25 p-1.5 rounded-xl border border-[#dfb76c]/30">
            {(['all', 'equipment', 'consumable'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setShopTab(tab)}
                className={`px-4 py-2 rounded-lg font-black text-[10.5px] uppercase tracking-wider transition-all flex-1 ${
                  shopTab === tab
                    ? 'bg-[#8e6a45] text-white shadow-inner'
                    : 'hover:bg-[#ebdcb9]/30 text-[#8c6b4f] hover:text-[#5c3e16]'
                }`}
              >
                {tab === 'all' ? 'Semua' : tab === 'equipment' ? 'Peralatan' : 'Konsumsi'}
              </button>
            ))}
          </div>

          {/* Grid list of items */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              {SHOP_ITEMS.filter(item => shopTab === 'all' || item.type === shopTab).map((item) => {
                const isSelected = selectedShopItem?.id === item.id;
                const canAfford = (playerStats.gold ?? 0) >= item.price;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedShopItem(item);
                      setBuyQuantity(1);
                      setBuyError("");
                      setBuySuccess(false);
                    }}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex gap-3 items-center ${
                      isSelected
                        ? 'border-[#8e6a45] bg-[#ebdcb9]/25 shadow-md scale-[0.98]'
                        : 'border-[#dfb76c]/20 hover:border-[#dfb76c]/60 bg-[#fdf9f3]/60'
                    }`}
                  >
                    <ShopItemThumbnail itemID={item.id} className="w-14 h-14 shrink-0 border border-[#dfb76c]/30" emojiFallback={item.icon} />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[12px] font-black text-[#5c3e16] truncate leading-tight">{item.name}</span>
                      <span className="text-[9px] font-bold text-zinc-500 capitalize">{item.slot || item.type}</span>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[8.5px] bg-sky-100 text-sky-700 px-1 py-0.2 rounded font-extrabold uppercase">Zeny</span>
                        <span className={`text-[11px] font-black ${canAfford ? 'text-amber-600' : 'text-rose-500'}`}>
                          {item.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Selected Item Detail & Checkout */}
        <div className="w-[430px] bg-[#ebdcb9]/20 border border-[#dfb76c]/30 rounded-3xl p-5 flex flex-col gap-4 min-h-0 shrink-0">
          {selectedShopItem ? (
            <>
              {/* Item title & preview */}
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#fdf9f3] border-2 border-[#dfb76c]/50 flex items-center justify-center text-4xl shadow-sm">
                  {selectedShopItem.icon}
                </div>
                <h4 className="text-base font-black text-[#5c3e16] tracking-wide mt-1">{selectedShopItem.name}</h4>
                <span className="text-[9.5px] font-black text-amber-700 bg-amber-100 border border-amber-300/30 px-3 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedShopItem.slot || selectedShopItem.type}
                </span>
              </div>

              {/* Description & Stats */}
              <div className="flex-1 flex flex-col gap-3 min-h-0 justify-center">
                <p className="text-[11px] text-[#5c3e16] leading-relaxed bg-[#fdf9f3]/80 p-3.5 rounded-2xl border border-[#dfb76c]/15 text-center">
                  {selectedShopItem.desc}
                </p>

                {/* Stat bonus summary */}
                <div className="flex flex-col gap-1.5 text-[10px] font-bold text-[#4a3000] px-2">
                  {selectedShopItem.add_attack && (
                    <div className="flex justify-between">
                      <span className="text-[#8c6b4f]">Fisik Attack:</span>
                      <span className="text-orange-600">+{selectedShopItem.add_attack}</span>
                    </div>
                  )}
                  {selectedShopItem.add_defense && (
                    <div className="flex justify-between">
                      <span className="text-[#8c6b4f]">Defense:</span>
                      <span className="text-emerald-600">+{selectedShopItem.add_defense}</span>
                    </div>
                  )}
                  {selectedShopItem.add_hp && (
                    <div className="flex justify-between">
                      <span className="text-[#8c6b4f]">Max HP:</span>
                      <span className="text-blue-600">+{selectedShopItem.add_hp}</span>
                    </div>
                  )}
                  {selectedShopItem.add_mp && (
                    <div className="flex justify-between">
                      <span className="text-[#8c6b4f]">Max SP:</span>
                      <span className="text-purple-600">+{selectedShopItem.add_mp}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Checkout & Quantity Selector */}
              <div className="border-t border-[#dfb76c]/20 pt-4 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-center bg-[#fdf9f3]/60 px-4 py-2.5 rounded-2xl border border-[#dfb76c]/15">
                  <span className="text-[10px] font-black text-zinc-500 uppercase">Jumlah</span>
                  
                  {/* Selector Controls */}
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setBuyQuantity(q => Math.max(1, q - 1))}
                      className="w-6 h-6 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center text-xs font-bold active:scale-90"
                    >
                      -
                    </button>
                    <span className="text-xs font-black text-[#5c3e16] w-6 text-center">{buyQuantity}</span>
                    <button
                      onClick={() => setBuyQuantity(q => Math.min(99, q + 1))}
                      className="w-6 h-6 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center text-xs font-bold active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Total Cost calculation */}
                <div className="flex justify-between items-baseline px-1 mt-1">
                  <span className="text-[10px] font-black text-zinc-500 uppercase">Total:</span>
                  <span className={`text-lg font-black ${
                    (playerStats.gold ?? 0) >= (selectedShopItem.price * buyQuantity)
                      ? 'text-amber-600'
                      : 'text-rose-500'
                  }`}>
                    {((selectedShopItem.price * buyQuantity)).toLocaleString()} Z
                  </span>
                </div>

                {/* Success / Error Messages */}
                {buySuccess && (
                  <div className="text-center py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-300/30 rounded-xl text-[9px] font-black uppercase tracking-wider animate-pulse">
                    🎉 Pembelian Berhasil!
                  </div>
                )}
                {buyError && (
                  <div className="text-center py-1.5 bg-rose-100 text-rose-700 border border-rose-300/30 rounded-xl text-[9px] font-black uppercase tracking-wider">
                    ⚠️ {buyError}
                  </div>
                )}

                {/* Purchase Action Button */}
                <button
                  onClick={handleBuyClick}
                  disabled={buySuccess}
                  className={`w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    buySuccess
                      ? 'bg-emerald-600'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 active:scale-95'
                  }`}
                >
                  {buySuccess ? "Sukses" : "Beli Sekarang"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#8c6b4f]/60 py-6">
              <span className="text-2xl">🔍</span>
              <p className="text-[10px] font-medium mt-2 leading-normal">Pilih barang di katalog untuk melihat detail pembelian</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
