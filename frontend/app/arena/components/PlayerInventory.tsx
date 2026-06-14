/** Full-screen Player Inventory and Equipment modal aligned with warm parchment Gold & Brown RPG theme. */
'use client';

import { useState, useEffect, Suspense, useMemo, useRef, useLayoutEffect } from 'react';
import { 
  ArrowLeft, HelpCircle, Plus, ShoppingBag, Search, X, Hammer
} from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import { AvatarModel } from '@/src/components/game/avatar/AvatarModel';
import { classToWeaponCategory, classWeaponMap } from '@/src/components/game/avatar/weaponConfigs';
import { API_BASE_URL } from '@/src/core/config';
import * as THREE from 'three';

const ITEM_GLB_MAP: Record<string, string> = {
  // Weapons
  sword_iron: "/assets/items/weapons/Sword.glb",
  sword_starter: "/assets/items/weapons/Sword.glb",
  axe_iron: "/assets/items/weapons/Battle_Axe.glb",
  bow_hunter: "/assets/items/weapons/Battle_Bow.glb",
  bow_starter: "/assets/items/weapons/Battle_Bow.glb",
  staff_magic: "/assets/items/weapons/Battle_Scythe.glb",
  staff_starter: "/assets/items/weapons/Battle_Scythe.glb",
  mace_starter: "/assets/items/weapons/Battle_Hammer.glb",
  dagger_starter: "/assets/items/weapons/Battle_Scythe.glb",
  
  // Armors / Outfits
  leather_armor: "/assets/characters/modular/tops/Outfit.002.glb",
  chain_mail: "/assets/characters/modular/tops/Outfit.003.glb",
  plate_armor: "/assets/characters/modular/tops/Outfit.004.glb",
  
  // Helmets
  iron_helm: "/assets/characters/modular/hair_and_hats/Hat.001.glb",
  
  // Boots
  leather_boots: "/assets/characters/modular/accessories/Shoes.002.glb",
};

function ItemModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.8;
    }
  });
  
  useLayoutEffect(() => {
    clonedScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    clonedScene.position.set(-center.x, -center.y, -center.z);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0.001 ? 0.75 / maxDim : 1.0;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scale);
    }
  }, [clonedScene]);
  
  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

function Item3DPreview({ itemID }: { itemID: string }) {
  const relativeUrl = ITEM_GLB_MAP[itemID];
  if (!relativeUrl) return null;
  const fullUrl = `${API_BASE_URL}${relativeUrl}`;
  
  return (
    <div className="h-[140px] w-full bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner shrink-0 mb-2">
      <Canvas
        key={itemID}
        camera={{ position: [0, 0, 1.8], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[2, 2, 2]} intensity={1.2} />
        <Suspense fallback={null}>
          <ItemModel key={fullUrl} url={fullUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}

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

function ItemThumbnail({ itemID, className = "h-[38px] w-[38px]", emojiFallback = "📦" }: { itemID: string; className?: string; emojiFallback?: string }) {
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

const getDefaultCustomization = (gender: string, playerClass: string, hairStyle = 1, hairColor = "#5A3E2D") => {
  let weaponId = "asset_weapon_sword";
  if (playerClass === "Mage") weaponId = "asset_weapon_scythe";
  else if (playerClass === "Beginner") weaponId = "asset_weapon_bow";

  return {
    "Body": { color: gender === "Male" ? "#EAD3B3" : "#F7DEC3", asset: { id: gender === "Male" ? "asset_body_male" : "asset_body_female", name: "Body", group: "cat_body", url: gender === "Male" ? "/assets/characters/modular/bodies/Male_Base.glb" : "/assets/characters/modular/bodies/Female_Base.glb", thumbnail: "" } },
    "Hair": { color: hairColor, asset: { id: `hair_${hairStyle}`, name: `Hair ${hairStyle}`, group: "cat_hair", url: `/assets/characters/modular/hair_and_hats/Hair.${String(hairStyle).padStart(3, '0')}.glb`, thumbnail: "" } },
    "Top": { color: "", asset: { id: "asset_top_starter", name: "Starter Outfit", group: "cat_top", url: "/assets/characters/modular/tops/Outfit.001.glb", thumbnail: "" } },
    "Shoes": { color: "", asset: { id: "asset_shoes_starter", name: "Starter Shoes", group: "cat_shoes", url: "/assets/characters/modular/accessories/Shoes.001.glb", thumbnail: "" } },
    "Weapon": {
      "color": "",
      "asset": {
        "id": weaponId,
        "name": playerClass,
        "group": "cat_weapon",
        "url": playerClass === "Mage" ? "/assets/items/weapons/Battle_Scythe.glb" : playerClass === "Beginner" ? "/assets/items/weapons/Battle_Bow.glb" : "/assets/items/weapons/Sword.glb",
        "thumbnail": ""
      }
    }
  };
};

const parseCustomization = (customizationStr?: string, defaultGender = "Male", defaultClass = "Warrior", hairStyle = 1, hairColor = "#5A3E2D") => {
  let parsed: any = null;
  if (customizationStr) {
    try {
      const obj = JSON.parse(customizationStr);
      if (obj && typeof obj === 'object') {
        parsed = obj;
      }
    } catch (e) {
      console.warn("Failed to parse customization JSON:", e);
    }
  }
  if (!parsed) {
    parsed = getDefaultCustomization(defaultGender, defaultClass, hairStyle, hairColor);
  }

  if (!parsed["Weapon"] || !parsed["Weapon"].asset || !parsed["Weapon"].asset.url) {
    const weaponCat = classToWeaponCategory[defaultClass] || "sword";
    if (defaultClass === "Mage") {
      parsed["Weapon"] = { color: "", asset: null };
    } else {
      const weaponInfo = classWeaponMap[weaponCat] || classWeaponMap["sword"];
      parsed["Weapon"] = {
        color: "",
        asset: {
          id: weaponInfo.assetId,
          name: defaultClass,
          group: "cat_weapon",
          url: `/assets/items/weapons/${weaponInfo.filename}`,
          thumbnail: ""
        }
      };
    }
  }

  return parsed;
};

interface PlayerInventoryProps {
  playerStats: any;
  onClose: () => void;
  onOpenShop: () => void;
  sendEquipItem: (playerItemId: string) => void;
  sendUseItem: (playerItemId: string) => void;
  sendSellItem: (playerItemId: string) => void;
  sendRefineItem: (playerItemId: string) => void;
}

export function PlayerInventory({
  playerStats: initialPlayerStats,
  onClose,
  onOpenShop,
  sendEquipItem,
  sendUseItem,
  sendSellItem,
  sendRefineItem
}: PlayerInventoryProps) {
  const [playerStats, setPlayerStats] = useState(initialPlayerStats);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [refineSuccess, setRefineSuccess] = useState(false);
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  const [itemToSell, setItemToSell] = useState<any>(null);
  const prevRefineLevel = useRef<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'Essential' | 'Gear' | 'Card' | 'Engine'>('Essential');

  useEffect(() => {
    setPlayerStats(initialPlayerStats);
  }, [initialPlayerStats]);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data && data.inventory) {
        setInventory(data.inventory);
      }
    };
    window.addEventListener("player_inventory_updated", handleUpdate);
    const initialInv = (window as any).lastInventory;
    if (initialInv) setInventory(initialInv);
    return () => {
      window.removeEventListener("player_inventory_updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (selectedItem) {
      if (prevRefineLevel.current > 0 && selectedItem.refine_level > prevRefineLevel.current) {
        setRefineSuccess(true);
        const timer = setTimeout(() => setRefineSuccess(false), 600);
        prevRefineLevel.current = selectedItem.refine_level;
        return () => clearTimeout(timer);
      }
      prevRefineLevel.current = selectedItem.refine_level;
    } else {
      prevRefineLevel.current = 0;
      setRefineSuccess(false);
    }
  }, [selectedItem?.id, selectedItem?.refine_level]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    const handleStatsUpdate = (e: Event) => {
      const nextStats = (e as CustomEvent).detail;
      if (nextStats) {
        setPlayerStats(nextStats);
        if (selectedItem) {
          const updated = nextStats.inventory?.find((i: any) => i.id === selectedItem.id);
          setSelectedItem(updated || null);
        }
      }
    };
    window.addEventListener("player_stats_updated", handleStatsUpdate);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener("player_stats_updated", handleStatsUpdate);
    };
  }, [selectedItem]);

  if (!playerStats) return null;

  const equipped = (inventory.length > 0 ? inventory : (playerStats.inventory || [])).filter((item: any) => item.is_equipped);
  const bag = (inventory.length > 0 ? inventory : (playerStats.inventory || [])).filter((item: any) => !item.is_equipped);
  const filteredBag = bag.filter((item: any) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    const type = item.type?.toLowerCase();
    if (activeTab === 'Gear') {
      return type === 'equipment';
    }
    if (activeTab === 'Essential') {
      return type === 'consumable' || type === 'material' || type === 'quest';
    }
    if (activeTab === 'Card') {
      return type === 'card';
    }
    if (activeTab === 'Engine') {
      return type === 'engine';
    }
    return true;
  });

  const customization = parseCustomization(
    playerStats.custom_avatar_url || playerStats.customAvatarUrl,
    playerStats.gender || 'Male',
    playerStats.class || 'Warrior',
    playerStats.hair_style || playerStats.hairStyle || 1,
    playerStats.hair_color || playerStats.hairColor || '#5A3E2D'
  );

  // Layout slots grouping
  const leftSlots = ["helmet", "accessory", "face_cosmetic"];
  const rightSlots = ["weapon", "armor", "shield", "boots", "wings"];

  const getEquippedItem = (slot: string) => {
    if (slot === "face_cosmetic") return null;
    if (slot === "wings") return null;
    return equipped.find((i: any) => i.slot_type?.toLowerCase() === slot);
  };

  const getSlotPlaceholder = (slot: string) => {
    switch (slot) {
      case "helmet": return "👑";
      case "accessory": return "💍";
      case "weapon": return "⚔️";
      case "armor": return "🛡️";
      case "shield": return "🔰";
      case "boots": return "🥾";
      default: return "📦";
    }
  };

  const getRarityBG = (item: any) => {
    if (!item) return "bg-[#ebdcb9]/15 border-[#dfb76c]/40";
    if (item.add_attack > 12) return "bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 border-yellow-400/50";
    if (item.add_attack > 8) return "bg-gradient-to-b from-purple-500/20 to-purple-600/10 border-purple-400/50";
    if (item.add_attack > 4) return "bg-gradient-to-b from-blue-500/20 to-blue-600/10 border-blue-400/50";
    return "bg-gradient-to-b from-green-500/20 to-green-600/10 border-green-400/50";
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] z-[9999] bg-[#ebdcb9]/40 backdrop-blur-sm flex flex-col font-sans text-[#4a3000] pointer-events-auto select-none overflow-hidden">
      
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
            <span className="text-base font-black tracking-wider uppercase text-[#4a3000] drop-shadow-sm">Inventory</span>
            <HelpCircle className="w-4 h-4 text-[#8c6b4f] cursor-help" />
          </div>
        </div>

        {/* Center: Currencies */}
        <div className="flex items-center gap-6 bg-[#ebdcb9]/35 border border-[#dfb76c]/40 px-5 py-1.5 rounded-full shadow-inner text-[#4a3000]">
          {/* Crystals */}
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-300 filter drop-shadow-sm text-sm">💠</span>
            <span className="text-xs font-black text-[#4a3000]">88</span>
            <button className="w-4 h-4 rounded bg-[#fdf9f3] hover:bg-[#ebdcb9] border border-[#dfb76c]/40 flex items-center justify-center text-[10px]"><Plus className="w-2.5 h-2.5 text-[#4a3000]" /></button>
          </div>
          {/* Gold */}
          <div className="flex items-center gap-1.5">
            <span className="w-4.5 h-4.5 rounded-full bg-amber-400 flex items-center justify-center text-[8.5px] font-black text-black shadow-sm">A</span>
            <span className="text-xs font-black text-[#4a3000]">599</span>
            <button className="w-4 h-4 rounded bg-[#fdf9f3] hover:bg-[#ebdcb9] border border-[#dfb76c]/40 flex items-center justify-center text-[10px]"><Plus className="w-2.5 h-2.5 text-[#4a3000]" /></button>
          </div>
          {/* Zeny */}
          <div className="flex items-center gap-1.5">
            <span className="w-4.5 h-4.5 rounded-full bg-[#38bdf8] flex items-center justify-center text-[8.5px] font-black text-black shadow-sm">Z</span>
            <span className="text-xs font-black text-[#b88c42]">{(playerStats.gold ?? 2048).toLocaleString()}</span>
            <button className="w-4 h-4 rounded bg-[#fdf9f3] hover:bg-[#ebdcb9] border border-[#dfb76c]/40 flex items-center justify-center text-[10px]"><Plus className="w-2.5 h-2.5 text-[#4a3000]" /></button>
          </div>
        </div>

        {/* Right: Shop Button */}
        <button 
          onClick={onOpenShop}
          className="flex items-center gap-1.5 bg-gradient-to-b from-[#e3c598] to-[#b88c42] hover:brightness-110 border border-[#8c5b1b]/30 px-4 py-1.5 rounded-full font-black text-[10.5px] tracking-wider uppercase text-[#4a3000] shadow-sm active:scale-95 transition-all"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Shop</span>
        </button>
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div className="flex-1 flex min-h-0 relative z-10 px-6 py-4 gap-6 select-none">
        
        {/* LEFT COLUMN: Character Model Preview flanked by Equipment Slots */}
        <div className="flex-1 flex gap-3 items-stretch justify-center relative min-h-0">
          
          {/* Left Side: Cosmetic/Accessory Slots */}
          <div className="flex flex-col justify-center gap-4">
            {leftSlots.map((slot) => {
              const item = getEquippedItem(slot);
              return (
                <div 
                  key={slot}
                  onClick={() => item && setSelectedItem(item)}
                  className={`w-[82px] h-[82px] rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-md ${getRarityBG(item)}`}
                >
                  {item ? (
                    <>
                      <ItemThumbnail itemID={item.item_id} className="w-[60px] h-[60px]" />
                      {item.refine_level > 0 && (
                        <span className="absolute bottom-1 right-1 text-[8.5px] font-black text-[#a7f3d0] drop-shadow-sm">+{item.refine_level}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xl opacity-40 group-hover:scale-110 transition-transform">{getSlotPlaceholder(slot)}</span>
                  )}
                  <span className="absolute -top-1.5 -left-1 px-1 bg-[#ebdcb9] rounded text-[8.5px] font-bold text-[#4a3000] uppercase tracking-wider scale-90 border border-[#dfb76c]/40">{slot.replace("_cosmetic", "")}</span>
                </div>
              );
            })}
          </div>

          {/* Center Column: 3D Character Avatar View Box */}
          <div className="flex-1 h-full flex flex-col items-center justify-start relative min-h-0">
            {/* Preset Dropdown */}
            <div className="absolute top-2 z-20">
              <select className="bg-[#ebdcb9]/40 border border-[#dfb76c]/40 rounded-full px-4 py-1 text-[10px] font-black text-[#4a3000] focus:outline-none focus:border-[#b88c42]">
                <option>Preset A</option>
                <option>Preset B</option>
              </select>
            </div>

            {/* 3D Canvas container */}
            <div className="w-full flex-1 relative overflow-hidden flex items-center justify-center z-10 min-h-0">
              <Canvas
                key={playerStats.custom_avatar_url || playerStats.customAvatarUrl}
                camera={{ position: [0, 0.5, 4.2], fov: 38 }}
                style={{ width: '100%', height: '100%' }}
                gl={{ preserveDrawingBuffer: true, antialias: true }}
              >
                <ambientLight intensity={1.3} />
                <directionalLight position={[2, 2.5, 4.5]} intensity={1.5} />
                <OrbitControls 
                  enableZoom={false} 
                  enablePan={false} 
                  minPolarAngle={Math.PI / 2.2} 
                  maxPolarAngle={Math.PI / 1.8} 
                />
                <Suspense fallback={null}>
                  <group position={[0, -0.9, 0]}>
                    <AvatarModel 
                      customization={customization} 
                      pose="Idle" 
                      paused={false} 
                      skipAnimControl={false}
                    />
                  </group>
                </Suspense>
              </Canvas>
            </div>
          </div>

          {/* Right Side: Combat Slots */}
          <div className="flex flex-col justify-center gap-4">
            {rightSlots.map((slot) => {
              const item = getEquippedItem(slot);
              return (
                <div 
                  key={slot}
                  onClick={() => item && setSelectedItem(item)}
                  className={`w-[82px] h-[82px] rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all relative group shadow-md ${getRarityBG(item)}`}
                >
                  {item ? (
                    <>
                      <ItemThumbnail itemID={item.item_id} className="w-[60px] h-[60px]" />
                      {item.refine_level > 0 && (
                        <span className="absolute bottom-1 right-1 text-[8.5px] font-black text-[#a7f3d0] drop-shadow-sm">+{item.refine_level}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xl opacity-40 group-hover:scale-110 transition-transform">{getSlotPlaceholder(slot)}</span>
                  )}
                  <span className="absolute -top-1.5 -left-1 px-1 bg-[#ebdcb9] rounded text-[8.5px] font-bold text-[#4a3000] uppercase tracking-wider scale-90 border border-[#dfb76c]/40">{slot}</span>
                </div>
              );
            })}
          </div>

        </div>

        {/* RIGHT COLUMN: White Parchment Inventory Items Container */}
        <div className="w-[430px] bg-[#ebdcb9]/20 border border-[#dfb76c]/30 rounded-3xl p-5 shadow-sm flex flex-col gap-4 text-[#4a3000] min-h-0 shrink-0">
          {/* Search Bar */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-[#8c6b4f] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Please enter text"
              className="w-full bg-[#fdf9f3] border border-[#dfb76c]/40 rounded-full pl-10 pr-4 py-2 text-[11px] text-[#4a3000] placeholder-[#8c6b4f] focus:outline-none focus:ring-1 focus:ring-[#b88c42] shadow-inner"
            />
          </div>

          {/* Grid of Slots */}
          <div className="flex-1 overflow-y-auto pr-1 min-h-0 select-none">
            <div className="grid grid-cols-5 gap-2.5">
              {filteredBag.map((item: any) => {
                const isSelected = selectedItem && selectedItem.id === item.id;
                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`aspect-square rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center relative p-1 hover:brightness-105 ${
                      isSelected 
                        ? 'border-[#b88c42] shadow-[0_0_8px_rgba(184,140,66,0.55)] scale-95' 
                        : 'border-[#dfb76c]/30'
                    } ${getRarityBG(item)}`}
                  >
                    <ItemThumbnail itemID={item.item_id} className="w-12 h-12" />
                    {item.refine_level > 0 && (
                      <span className="absolute bottom-1 right-1 text-[8.5px] font-black text-[#a7f3d0] drop-shadow-sm">+{item.refine_level}</span>
                    )}
                    {item.quantity > 1 && (
                      <span className="absolute bottom-1 left-1.5 text-[8.5px] font-bold text-[#4a3000] drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]">{item.quantity}</span>
                    )}
                  </div>
                );
              })}
              {/* Fallback empty slots */}
              {Array.from({ length: Math.max(0, 25 - filteredBag.length) }).map((_, idx) => (
                <div key={idx} className="aspect-square rounded-2xl bg-[#fdf9f3]/60 border border-dashed border-[#dfb76c]/30 flex items-center justify-center opacity-40">
                  <span className="text-[10px] text-[#8c6b4f]">📦</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bar: weight and buttons */}
          <div className="flex justify-between items-center border-t border-[#dfb76c]/20 pt-3.5 shrink-0">
            <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-500">
              <span>Weigh</span>
              <span className="text-[#b88c42] font-black">4444/10790</span>
              <button className="w-4 h-4 rounded bg-[#fdf9f3] hover:bg-[#ebdcb9] border border-[#dfb76c]/40 flex items-center justify-center text-[10px]"><Plus className="w-2.5 h-2.5 text-[#4a3000]" /></button>
            </div>
            <div className="flex gap-2">
              <button className="bg-[#fdf9f3] hover:bg-[#ebdcb9] text-zinc-600 border border-[#dfb76c]/40 px-4 py-1.5 rounded-full font-black text-[10.5px] uppercase active:scale-95 transition-all shadow-sm">
                Dism.
              </button>
              <button 
                onClick={() => {
                  const sorted = [...bag].sort((a,b) => a.id.localeCompare(b.id));
                  setInventory(sorted);
                }}
                className="bg-gradient-to-b from-[#e3c598] to-[#b88c42] text-[#4a3000] border border-[#8c5b1b]/30 px-4 py-1.5 rounded-full font-black text-[10.5px] uppercase active:scale-95 transition-all shadow-sm"
              >
                Sort
              </button>
            </div>
          </div>

        </div>

        {/* FAR RIGHT: Vertical Navigation Tabs */}
        <div className="flex flex-col justify-between py-2 shrink-0 select-none">
          <div className="flex flex-col gap-3">
            {(['Essential', 'Gear', 'Card', 'Engine'] as const).map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-[105px] py-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 shadow-md active:scale-95 hover:translate-x-1 ${
                  activeTab === tab 
                    ? 'bg-gradient-to-b from-[#8c5b1b] to-[#5c3e16] text-[#fdf9f3] border-2 border-[#dfb76c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_4px_10px_rgba(140,91,27,0.25)]' 
                    : 'bg-gradient-to-b from-[#fdf9f3] to-[#ebdcb9]/40 text-[#8c6b4f] border-2 border-[#dfb76c]/40 hover:border-[#b88c42] hover:text-[#4a3000] shadow-[0_2px_4px_rgba(0,0,0,0.05)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Bottom tabs shortcut: Storage */}
          <button className="w-[105px] py-3 text-[11px] font-black bg-gradient-to-b from-[#fdf9f3] to-[#ebdcb9]/40 text-[#8c6b4f] border-2 border-[#dfb76c]/40 hover:border-[#b88c42] hover:text-[#4a3000] rounded-xl uppercase tracking-wider shadow-md hover:translate-x-1 transition-all duration-200 active:scale-95">
            Storage
          </button>
        </div>

      </div>

      {/* ── FLOATING ITEM DETAIL OVERLAY CARD ── */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/45 backdrop-blur-[1px] flex items-center justify-center"
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="w-[310px] bg-[#fbf7f0] border-4 border-[#8e6a45] rounded-3xl p-4 shadow-[0_15px_40px_rgba(0,0,0,0.7)] flex flex-col gap-3 relative text-zinc-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="border-b border-[#dfb76c]/40 pb-2 relative">
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-0 right-0 w-6 h-6 rounded-full bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <h5 className="text-[12.5px] font-black text-[#5c3e16] pr-7 leading-tight">
                {selectedItem.refine_level > 0 ? `+${selectedItem.refine_level} ` : ""}{selectedItem.name}
              </h5>
              <span className="text-[7.5px] font-black text-amber-700 bg-amber-100/50 border border-amber-300/30 px-2 py-0.5 rounded uppercase tracking-wider inline-block mt-1">
                {selectedItem.slot_type || selectedItem.type}
              </span>
            </div>

            {/* 3D Item preview with success overlay */}
            <div className="relative">
              {refineSuccess && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center z-50 animate-in fade-in duration-150 rounded-xl pointer-events-none">
                  <span className="text-2xl animate-bounce">✨🔨✨</span>
                  <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest drop-shadow-md">TEMPA BERHASIL!</span>
                  <span className="text-[8px] font-bold text-white uppercase tracking-wider bg-emerald-600 px-2 py-0.5 rounded-full shadow-md mt-1">+1 Refine</span>
                </div>
              )}
              <Item3DPreview itemID={selectedItem.item_id} />
            </div>

            {/* Stat bonuses */}
            <div className="flex flex-col gap-1 text-[10px] font-medium border-t border-[#dfb76c]/20 pt-2 text-[#4a3000]">
              {selectedItem.slot_type && (
                <div className="flex justify-between">
                  <span className="text-[#8c6b4f]">Equipment Slot:</span>
                  <span className="font-black uppercase">{selectedItem.slot_type}</span>
                </div>
              )}
              {selectedItem.add_attack > 0 && (
                <div className="flex justify-between text-orange-600 font-black">
                  <span>Physical Attack:</span>
                  <span>+{selectedItem.add_attack}</span>
                </div>
              )}
              {selectedItem.add_defense > 0 && (
                <div className="flex justify-between text-emerald-600 font-black">
                  <span>Defense:</span>
                  <span>+{selectedItem.add_defense}</span>
                </div>
              )}
              {selectedItem.add_hp > 0 && (
                <div className="flex justify-between text-blue-600 font-black">
                  <span>Max HP:</span>
                  <span>+{selectedItem.add_hp}</span>
                </div>
              )}
              {selectedItem.add_mp > 0 && (
                <div className="flex justify-between text-purple-600 font-black">
                  <span>Max SP:</span>
                  <span>+{selectedItem.add_mp}</span>
                </div>
              )}
            </div>

            {/* Actions button */}
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#dfb76c]/20 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                {selectedItem.type === "consumable" ? (
                  <button
                    onClick={() => { sendUseItem(selectedItem.id); setSelectedItem(null); }}
                    className="py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                  >
                    Gunakan
                  </button>
                ) : (
                  <button
                    onClick={() => { sendEquipItem(selectedItem.id); setSelectedItem(null); }}
                    className="py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-[9.5px] uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                  >
                    {selectedItem.is_equipped ? "Lepas" : "Pakai"}
                  </button>
                )}
                <button
                  onClick={() => { setItemToSell(selectedItem); setShowSellConfirm(true); }}
                  className="py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[9.5px] uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                >
                  Jual
                </button>
              </div>

              {!selectedItem.is_equipped && selectedItem.type === "equipment" && (
                <button
                  onClick={() => sendRefineItem(selectedItem.id)}
                  className="py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Hammer className="w-3.5 h-3.5 animate-pulse" />
                  <span>Tempa (Refine)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SELL CONFIRMATION OVERLAY ── */}
      {showSellConfirm && itemToSell && (
        <div className="fixed inset-0 z-[10001] bg-black/65 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="bg-[#fdf9f3] border-4 border-[#8e6a45] rounded-3xl p-5 w-[290px] shadow-2xl flex flex-col gap-3 text-zinc-800">
            <h4 className="text-[12px] font-black text-[#5c3e16] uppercase border-b border-[#dfb76c]/30 pb-2">Konfirmasi Penjualan</h4>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Apakah Anda yakin ingin menjual <span className="font-bold text-zinc-800">{itemToSell.name}</span> seharga <span className="font-extrabold text-[#d97706]">{itemToSell.sell_price || 150} Zeny</span>?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button 
                onClick={() => setShowSellConfirm(false)}
                className="py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-[9.5px] uppercase"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  sendSellItem(itemToSell.id);
                  setShowSellConfirm(false);
                  setItemToSell(null);
                  setSelectedItem(null);
                }}
                className="py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[9.5px] uppercase"
              >
                Jual
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
