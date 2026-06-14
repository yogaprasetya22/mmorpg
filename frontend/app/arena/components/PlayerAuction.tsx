/** Player-to-player Marketplace & Auction panel aligned with vintage parchment RPG styling. */
'use client';

import { useState, useEffect } from 'react';
import { X, ArrowLeft, Search, Scale, ShoppingBag, PlusCircle, Check } from 'lucide-react';
import { API_BASE_URL } from '@/src/core/config';

interface AuctionItem {
  id: string;
  seller_id: string;
  seller_name: string;
  item_id: string;
  name: string;
  type: string;
  slot_type?: string;
  quantity: number;
  refine_level: number;
  add_hp?: number;
  add_mp?: number;
  add_attack?: number;
  add_defense?: number;
  price: number;
  created_at: string;
}

const ITEM_THUMBNAIL_MAP: Record<string, string> = {
  sword_iron: "/assets/characters/thumbnails/Sword.png",
  axe_iron: "/assets/characters/thumbnails/Battle_Axe.png",
  bow_hunter: "/assets/characters/thumbnails/Battle_Bow.png",
  staff_magic: "/assets/characters/thumbnails/Battle_Scythe.png",
  leather_armor: "/assets/characters/thumbnails/Outfit.002.png",
  chain_mail: "/assets/characters/thumbnails/Outfit.003.png",
  plate_armor: "/assets/characters/thumbnails/Outfit.004.png",
  iron_helm: "/assets/characters/thumbnails/Hat.001.png",
  leather_boots: "/assets/characters/thumbnails/Shoes.002.png",
  iron_shield: "/assets/characters/thumbnails/Battle_Hammer.png", // shield fallback
  potion_red: "🔴",
  potion_blue: "🔵",
  potion_green: "🟢",
};

function AuctionItemThumbnail({ itemID, className = "h-10 w-10", emojiFallback = "📦" }: { itemID: string; className?: string; emojiFallback?: string }) {
  const relativeUrl = ITEM_THUMBNAIL_MAP[itemID];
  if (!relativeUrl) {
    return <div className={`${className} bg-[#fdf9f3] border border-dashed border-[#dfb76c]/30 rounded-xl flex items-center justify-center text-[16px] shrink-0`}>{emojiFallback}</div>;
  }
  if (relativeUrl.startsWith('http') || !relativeUrl.startsWith('/')) {
    return <div className={`${className} bg-[#fdf9f3] border border-[#dfb76c]/30 rounded-xl flex items-center justify-center text-[18px] shrink-0`}>{relativeUrl}</div>;
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

interface PlayerAuctionProps {
  playerStats: any;
  onClose: () => void;
  sendGetAuctionItems: () => void;
  sendListAuctionItem: (playerItemId: string, price: number) => void;
  sendBuyoutAuctionItem: (targetId: string) => void;
}

export function PlayerAuction({ playerStats, onClose, sendGetAuctionItems, sendListAuctionItem, sendBuyoutAuctionItem }: PlayerAuctionProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'my_listings'>('buy');
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'equipment' | 'consumable'>('all');
  
  // Listing/Registration State
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any | null>(null);
  const [sellPrice, setSellPrice] = useState<number>(100);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Poll auction list on mount and when listings change
  useEffect(() => {
    sendGetAuctionItems();
    
    // Poll every 5 seconds for fresh listings
    const interval = setInterval(() => {
      sendGetAuctionItems();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket broadcasts/responses
  useEffect(() => {
    const handleAuctionList = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data && data.items) {
        setAuctionItems(data.items);
      }
    };

    const handleAuctionListChanged = () => {
      sendGetAuctionItems();
    };

    const handleActionFailed = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setErrorMessage(data?.error || "Aksi lelang gagal");
      setTimeout(() => setErrorMessage(""), 4000);
    };

    window.addEventListener("auction_list", handleAuctionList);
    window.addEventListener("auction_list_changed", handleAuctionListChanged);
    window.addEventListener("auction_action_failed", handleActionFailed);

    return () => {
      window.removeEventListener("auction_list", handleAuctionList);
      window.removeEventListener("auction_list_changed", handleAuctionListChanged);
      window.removeEventListener("auction_action_failed", handleActionFailed);
    };
  }, []);

  const handleBuyClick = (item: AuctionItem) => {
    if ((playerStats.gold ?? 0) < item.price) {
      setErrorMessage("Zeny tidak mencukupi!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    sendBuyoutAuctionItem(item.id);
    setSuccessMessage("Pembelian berhasil diproses!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleRegisterClick = () => {
    if (!selectedInventoryItem) return;
    if (sellPrice <= 0) {
      setErrorMessage("Harga penjualan harus di atas 0!");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    sendListAuctionItem(selectedInventoryItem.id, sellPrice);
    setSelectedInventoryItem(null);
    setSellPrice(100);
    setSuccessMessage("Barang berhasil didaftarkan ke pelelangan!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  // Filter global listings
  const filteredBuyListings = auctionItems.filter(item => {
    // Exclude own listings
    if (item.seller_id === playerStats.id) return false;
    
    // Filter by type
    if (filterType !== 'all' && item.type !== filterType) return false;
    
    // Filter by search query
    if (searchQuery.trim() !== "") {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             item.seller_name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Get own active listings
  const myActiveListings = auctionItems.filter(item => item.seller_id === playerStats.id);

  // Get eligible sellable inventory items (not equipped)
  const sellableInventoryItems = (playerStats.inventory ?? []).filter((item: any) => !item.is_equipped);

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
            <span className="text-base font-black tracking-wider uppercase text-[#4a3000] drop-shadow-sm">RUMAH PELELANGAN</span>
            <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-widest bg-[#ebdcb9]/40 border border-[#dfb76c]/40 px-2 py-0.5 rounded-full ml-1">AUCTION HOUSE</span>
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center bg-[#ebdcb9]/40 border border-[#dfb76c]/50 rounded-2xl p-1 gap-1">
          <button
            onClick={() => { setActiveTab('buy'); setSelectedInventoryItem(null); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'buy'
                ? 'bg-[#fdf9f3] text-[#5c3e16] border border-[#dfb76c] shadow-sm'
                : 'text-[#8c6b4f] hover:text-[#5c3e16]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Beli Barang
          </button>
          <button
            onClick={() => { setActiveTab('sell'); setSelectedInventoryItem(null); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'sell'
                ? 'bg-[#fdf9f3] text-[#5c3e16] border border-[#dfb76c] shadow-sm'
                : 'text-[#8c6b4f] hover:text-[#5c3e16]'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" /> Jual Barang
          </button>
          <button
            onClick={() => { setActiveTab('my_listings'); setSelectedInventoryItem(null); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all flex items-center gap-1.5 ${
              activeTab === 'my_listings'
                ? 'bg-[#fdf9f3] text-[#5c3e16] border border-[#dfb76c] shadow-sm'
                : 'text-[#8c6b4f] hover:text-[#5c3e16]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" /> Lelang Saya ({myActiveListings.length})
          </button>
        </div>

        {/* Right: Currency & Exit */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#ebdcb9]/35 border border-[#dfb76c]/40 px-4 py-1.5 rounded-full shadow-inner text-[#4a3000]">
            <span className="w-4 h-4 rounded-full bg-[#38bdf8] flex items-center justify-center text-[8.5px] font-black text-black shadow-sm">Z</span>
            <span className="text-xs font-black text-[#b88c42]">{(playerStats.gold ?? 0).toLocaleString()} Zeny</span>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-black/5 flex items-center justify-center text-[#8c6b4f] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* ── ALERTS BAR ── */}
      {errorMessage && (
        <div className="w-full bg-red-100 border-b border-red-300 py-2 px-6 text-center text-xs font-bold text-red-700 animate-in slide-in-from-top-2">
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="w-full bg-emerald-100 border-b border-emerald-300 py-2 px-6 text-center text-xs font-bold text-emerald-700 animate-in slide-in-from-top-2">
          🎉 {successMessage}
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex gap-5 p-6 items-stretch justify-center relative min-h-0 z-10">

        {/* TAB 1: BUY LISTINGS */}
        {activeTab === 'buy' && (
          <div className="flex-1 flex gap-5 items-stretch justify-center relative min-h-0">
            {/* Filter sidebar */}
            <div className="w-[200px] bg-[#ebdcb9]/15 border border-[#dfb76c]/40 rounded-3xl p-4 flex flex-col gap-2 shrink-0">
              <span className="text-[10px] font-black text-[#8c6b4f] uppercase tracking-wider mb-2">KATEGORI LEBAR</span>
              <button
                onClick={() => setFilterType('all')}
                className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-black transition-all ${
                  filterType === 'all'
                    ? 'bg-[#ebdcb9]/40 border border-[#dfb76c] text-[#5c3e16]'
                    : 'hover:bg-[#ebdcb9]/10 text-[#8c6b4f]'
                }`}
              >
                🎒 Semua Barang
              </button>
              <button
                onClick={() => setFilterType('equipment')}
                className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-black transition-all ${
                  filterType === 'equipment'
                    ? 'bg-[#ebdcb9]/40 border border-[#dfb76c] text-[#5c3e16]'
                    : 'hover:bg-[#ebdcb9]/10 text-[#8c6b4f]'
                }`}
              >
                🛡️ Perlengkapan (Equip)
              </button>
              <button
                onClick={() => setFilterType('consumable')}
                className={`w-full py-2.5 px-4 rounded-xl text-left text-xs font-black transition-all ${
                  filterType === 'consumable'
                    ? 'bg-[#ebdcb9]/40 border border-[#dfb76c] text-[#5c3e16]'
                    : 'hover:bg-[#ebdcb9]/10 text-[#8c6b4f]'
                }`}
              >
                🔴 Konsumsi (Potion)
              </button>
            </div>

            {/* Main Listings Grid */}
            <div className="flex-1 bg-[#ebdcb9]/5 border border-[#dfb76c]/30 rounded-3xl p-5 flex flex-col min-h-0">
              {/* Search bar */}
              <div className="relative mb-4 shrink-0">
                <input
                  type="text"
                  placeholder="Cari barang atau nama penjual..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#fdf9f3] border border-[#dfb76c]/50 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-[#5c3e16] focus:outline-none focus:ring-1 focus:ring-[#dfb76c] placeholder-[#8c6b4f]/60"
                />
                <Search className="w-4 h-4 text-[#8c6b4f]/60 absolute left-3.5 top-3" />
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                {filteredBuyListings.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <span className="text-4xl mb-2">⚖️</span>
                    <span className="text-xs font-black text-[#8c6b4f] uppercase tracking-wider">TIDAK ADA BARANG LELANG DI KATEGORI INI</span>
                  </div>
                ) : (
                  filteredBuyListings.map((listing) => (
                    <div 
                      key={listing.id}
                      className="bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-[#dfb76c]/80 transition-all select-none"
                    >
                      {/* Left: Info */}
                      <div className="flex items-center gap-3">
                        <AuctionItemThumbnail itemID={listing.item_id} className="h-12 w-12" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-[#5c3e16]">
                              {listing.refine_level > 0 ? `+${listing.refine_level} ` : ""}{listing.name}
                            </span>
                            <span className="text-[9px] font-bold text-[#8c6b4f] px-1.5 py-0.5 rounded-md bg-[#ebdcb9]/30">
                              x{listing.quantity}
                            </span>
                          </div>
                          
                          {/* Seller & Stats summary */}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-[#8c6b4f] font-semibold">
                            <span>Penjual: <span className="text-[#5c3e16]">{listing.seller_name}</span></span>
                            {listing.add_attack ? <span className="text-rose-600">ATK +{listing.add_attack}</span> : null}
                            {listing.add_defense ? <span className="text-emerald-700">DEF +{listing.add_defense}</span> : null}
                            {listing.add_hp ? <span className="text-rose-500">HP +{listing.add_hp}</span> : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Price & buyout */}
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-[#8c6b4f] uppercase tracking-wider">BELI SEKARANG</span>
                          <span className="text-base font-black text-[#b88c42]">{listing.price.toLocaleString()} Z</span>
                        </div>
                        <button
                          onClick={() => handleBuyClick(listing)}
                          className="bg-[#dfb76c] hover:bg-[#b88c42] text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl border-b-2 border-[#8c6b4f] transition-all"
                        >
                          Beli
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SELL ITEM */}
        {activeTab === 'sell' && (
          <div className="flex-1 flex gap-5 items-stretch justify-center relative min-h-0">
            {/* Inventory List Grid (Left) */}
            <div className="flex-1 bg-[#ebdcb9]/10 border border-[#dfb76c]/30 rounded-3xl p-5 flex flex-col min-h-0">
              <span className="text-[10px] font-black text-[#8c6b4f] uppercase tracking-widest mb-3">PILIH BARANG DARI INVENTORY</span>
              
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-1">
                {sellableInventoryItems.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center p-8 text-center">
                    <span className="text-4xl mb-2">🎒</span>
                    <span className="text-xs font-black text-[#8c6b4f] uppercase">TIDAK ADA BARANG YANG BISA DIJUAL</span>
                  </div>
                ) : (
                  sellableInventoryItems.map((item: any) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedInventoryItem(item)}
                      className={`bg-[#fdf9f3]/80 border-2 rounded-2xl p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all hover:border-[#dfb76c] hover:scale-[1.01] ${
                        selectedInventoryItem?.id === item.id 
                          ? 'border-[#dfb76c] ring-2 ring-[#dfb76c]/30 bg-[#ebdcb9]/20'
                          : 'border-[#dfb76c]/20'
                      }`}
                    >
                      <AuctionItemThumbnail itemID={item.itemId} className="h-10 w-10 mb-2" />
                      <span className="text-xs font-extrabold text-[#5c3e16] line-clamp-1">
                        {item.refineLevel > 0 ? `+${item.refineLevel} ` : ""}{item.name}
                      </span>
                      <span className="text-[9px] text-[#8c6b4f] font-bold mt-1 uppercase tracking-wider">
                        x{item.quantity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* List Price Details Config Panel (Right) */}
            <div className="w-[300px] bg-[#ebdcb9]/25 border-2 border-[#dfb76c]/50 rounded-3xl p-5 flex flex-col justify-between shadow-sm shrink-0">
              {selectedInventoryItem ? (
                <div className="w-full flex flex-col items-center text-center">
                  <span className="text-[10px] text-[#8c6b4f] font-black uppercase tracking-wider mb-2">PRATINJAU PENJUALAN</span>
                  <AuctionItemThumbnail itemID={selectedInventoryItem.itemId} className="h-14 w-14 mb-2.5" />
                  <span className="text-sm font-black text-[#5c3e16]">{selectedInventoryItem.name}</span>
                  <span className="text-xs text-[#8c6b4f] font-semibold mt-0.5">Jumlah: x{selectedInventoryItem.quantity}</span>
                  
                  {/* Stats list */}
                  <div className="w-full bg-[#fdf9f3] border border-[#dfb76c]/30 rounded-xl p-3 my-4 flex flex-col gap-1 text-[11px] text-left text-[#8c6b4f]">
                    {selectedInventoryItem.addAttack ? <div>⚔️ ATK: <span className="font-bold text-rose-600">+{selectedInventoryItem.addAttack}</span></div> : null}
                    {selectedInventoryItem.addDefense ? <div>🛡️ DEF: <span className="font-bold text-emerald-700">+{selectedInventoryItem.addDefense}</span></div> : null}
                    {selectedInventoryItem.addHP ? <div>❤️ HP: <span className="font-bold text-rose-500">+{selectedInventoryItem.addHP}</span></div> : null}
                    {selectedInventoryItem.addMP ? <div>🔷 MP: <span className="font-bold text-cyan-600">+{selectedInventoryItem.addMP}</span></div> : null}
                  </div>

                  {/* Input Price */}
                  <div className="w-full mt-2">
                    <label className="block text-[10px] font-black text-[#8c6b4f] text-left uppercase mb-1">HARGA ZENY TOTAL</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(parseInt(e.target.value) || 0)}
                        className="w-full bg-[#fdf9f3] border border-[#dfb76c]/50 rounded-xl py-2 px-3 text-sm text-[#5c3e16] font-bold focus:outline-none focus:ring-1 focus:ring-[#dfb76c] text-right pr-8"
                      />
                      <span className="absolute right-3 top-2.5 font-bold text-xs text-[#8c6b4f]">Z</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <span className="text-3xl mb-2">⚖️</span>
                  <span className="text-xs font-black text-[#8c6b4f] leading-normal uppercase">PILIH BARANG INVENTORY UNTUK DIJUAL</span>
                </div>
              )}

              {selectedInventoryItem && (
                <button
                  onClick={handleRegisterClick}
                  className="w-full py-3 bg-gradient-to-b from-[#dfb76c] to-[#b88c42] hover:brightness-110 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md border-b-4 border-[#8c6b4f] active:scale-[0.98] transition-all mt-4"
                >
                  Daftarkan Barang
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MY ACTIVE LISTINGS */}
        {activeTab === 'my_listings' && (
          <div className="flex-1 bg-[#ebdcb9]/5 border border-[#dfb76c]/30 rounded-3xl p-5 flex flex-col min-h-0">
            <span className="text-[10px] font-black text-[#8c6b4f] uppercase tracking-widest mb-3">DAFTAR PENJUALAN ANDA YANG SEDANG AKTIF</span>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              {myActiveListings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <span className="text-4xl mb-2">⚖️</span>
                  <span className="text-xs font-black text-[#8c6b4f] uppercase tracking-wider">ANDA TIDAK MEMILIKI BARANG YANG SEDANG DILELANG</span>
                </div>
              ) : (
                myActiveListings.map((listing) => (
                  <div 
                    key={listing.id}
                    className="bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-2xl p-4 flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <AuctionItemThumbnail itemID={listing.item_id} className="h-12 w-12" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-[#5c3e16]">
                            {listing.refine_level > 0 ? `+${listing.refine_level} ` : ""}{listing.name}
                          </span>
                          <span className="text-[9px] font-bold text-[#8c6b4f] px-1.5 py-0.5 rounded-md bg-[#ebdcb9]/30">
                            x{listing.quantity}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#8c6b4f] font-semibold mt-0.5">
                          Daftar Harga: {listing.price.toLocaleString()} Zeny
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-300/40 px-3 py-1.5 rounded-xl flex items-center gap-1 animate-pulse">
                        <Check className="w-3.5 h-3.5" /> Sedang Dijual
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
