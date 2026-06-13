/** Dedicated Player Inventory modal styled with classic Ragnarok Online parchment theme. */
'use client';

import { useState, useEffect, Suspense, useMemo, useRef, useLayoutEffect } from 'react';
import { X, Coins, Hammer } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { AvatarModel } from '@/src/components/game/avatar/AvatarModel';
import { classToWeaponCategory, classWeaponMap } from '@/src/components/game/avatar/weaponConfigs';
import { STAT_ATTRIBUTES } from '../ArenaClient.constants';
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
    
    // Center mesh
    clonedScene.position.set(-center.x, -center.y, -center.z);
    
    // Auto-scale to fit standard boundary nicely
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0.001 ? 1.0 / maxDim : 1.0;
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
    <div className="h-[160px] w-full bg-[#fdf9f3] border border-[#d2be9f] rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner shrink-0 mb-2">
      <Canvas
        camera={{ position: [0, 0, 1.8], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[2, 2, 2]} intensity={1.2} />
        <Suspense fallback={null}>
          <ItemModel url={fullUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}

const getDefaultCustomization = (gender: string, playerClass: string, hairStyle = 1, hairColor = "#5A3E2D") => {
  let weaponId = "asset_weapon_sword";
  if (playerClass === "Mage") weaponId = "asset_weapon_scythe";
  else if (playerClass === "Beginner") weaponId = "asset_weapon_bow";

  return {
    "Gender": gender,
    "Class": playerClass,
    "Hair": {
      "asset": {
        "id": `asset_hair_${hairStyle}`,
        "name": `Hair ${hairStyle}`,
        "group": "cat_hair",
        "url": `/assets/customization/hair/Hair.00${hairStyle}.glb`,
        "thumbnail": ""
      },
      "color": hairColor
    },
    "Outfit": {
      "asset": {
        "id": "asset_outfit_starter",
        "name": "Starter Outfit",
        "group": "cat_outfit",
        "url": "/assets/customization/outfit/Outfit.001.glb",
        "thumbnail": ""
      },
      "color": ""
    },
    "Hat": { "color": "", "asset": null },
    "Shoes": {
      "asset": {
        "id": "asset_shoes_starter",
        "name": "Starter Shoes",
        "group": "cat_shoes",
        "url": "/assets/customization/shoes/Shoes.002.glb",
        "thumbnail": ""
      },
      "color": ""
    },
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

  // Fallback weapon based on class if no weapon asset is equipped
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

interface PlayerInventoryModalProps {
  playerStats: any;
  onClose: () => void;
  sendEquipItem: (playerItemId: string) => void;
  sendUseItem: (playerItemId: string) => void;
  sendSellItem: (playerItemId: string) => void;
  sendRefineItem: (playerItemId: string) => void;
}

export function PlayerInventoryModal({
  playerStats: initialPlayerStats,
  onClose,
  sendEquipItem,
  sendUseItem,
  sendSellItem,
  sendRefineItem
}: PlayerInventoryModalProps) {
  const [playerStats, setPlayerStats] = useState(initialPlayerStats);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    document.body.classList.add('modal-open');
    const handleStatsUpdate = (e: Event) => {
      const nextStats = (e as CustomEvent).detail;
      if (nextStats) {
        setPlayerStats(nextStats);
        // Sync selected item state if it still exists in inventory
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

  const inventory = playerStats.inventory || [];
  const equipped = inventory.filter((item: any) => item.is_equipped);
  const bag = inventory.filter((item: any) => !item.is_equipped);
  const slots = ["weapon", "armor", "helmet", "boots", "shield", "accessory"];

  const customization = parseCustomization(
    playerStats.custom_avatar_url || playerStats.customAvatarUrl,
    playerStats.gender || 'Male',
    playerStats.class || 'Warrior',
    playerStats.hair_style || playerStats.hairStyle || 1,
    playerStats.hair_color || playerStats.hairColor || '#5A3E2D'
  );

  return (
    <div
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto font-sans text-[#4a3000]"
      onClick={onClose}
    >
      <div
        className="w-[1200px] max-w-[96vw] h-[680px] bg-[#fdf9f3] border-4 border-[#8e6a45] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#b88c42]/30 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎒</span>
            <div className="flex flex-col">
              <h3 className="text-md font-black tracking-tight text-[#5c3e16] uppercase leading-none">INVENTORI & EQUIPMENT</h3>
              <span className="text-[9px] text-[#8c6b4f] font-bold uppercase tracking-widest mt-1">Loot & Gear Management</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#e6dbcc] hover:bg-[#dfb76c] hover:text-black text-[#5c3e16] border border-[#b88c42]/40 flex items-center justify-center transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Column: Karakter & Status */}
          <div className="w-[280px] flex flex-col gap-2 bg-[#ebdcb9]/30 border border-[#b88c42]/30 p-2.5 rounded-xl min-h-0 shrink-0">
            {/* 3D Model Character Preview */}
            <div className="h-[250px] w-full bg-[#fdf9f3] border border-[#d2be9f] rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner shrink-0">
              <Canvas
                camera={{ position: [0, 0.9, 4.0], fov: 28 }}
                style={{ width: '100%', height: '100%' }}
                gl={{ preserveDrawingBuffer: true, antialias: true }}
              >
                <ambientLight intensity={1.2} />
                <directionalLight position={[2, 2, 4]} intensity={1.5} />
                <Suspense fallback={null}>
                  <group position={[0, -0.85, 0]}>
                    <AvatarModel 
                      customization={customization} 
                      pose="Idle" 
                      paused={false} 
                      skipAnimControl={true}
                    />
                  </group>
                </Suspense>
              </Canvas>
            </div>

            {/* Character Basic Stats */}
            <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2">
              <div className="bg-[#fdf9f3] border border-[#d2be9f] rounded-lg p-2 flex flex-col gap-1.5 shadow-sm shrink-0">
                <div className="flex justify-between items-center text-[10px] font-black text-[#5c3e16] uppercase border-b border-[#b88c42]/20 pb-0.5">
                  <span>{playerStats.username || "Traveler"}</span>
                  <span className="text-amber-700">Lv.{playerStats.level ?? 1}</span>
                </div>
                
                {/* HP/SP Bars */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-black text-[#8c6b4f]">
                    <span>HP</span>
                    <span>{Math.round(playerStats.hp ?? 0)} / {Math.round(playerStats.max_hp ?? 100)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden border border-red-300/30">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, ((playerStats.hp ?? 0) / (playerStats.max_hp ?? 100)) * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[8px] font-black text-[#8c6b4f] mt-0.5">
                    <span>SP</span>
                    <span>{Math.round(playerStats.mp ?? 0)} / {Math.round(playerStats.max_mp ?? 100)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden border border-blue-300/30">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, ((playerStats.mp ?? 0) / (playerStats.max_mp ?? 100)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Status Attributes */}
              <div className="bg-[#fdf9f3] border border-[#d2be9f] rounded-lg p-2 flex flex-col gap-1 shadow-sm">
                <span className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-wider border-b border-[#b88c42]/10 pb-0.5">Atribut</span>
                {STAT_ATTRIBUTES.map((stat) => {
                  const baseVal = playerStats[`base_${stat.key}`] ?? playerStats[stat.key] ?? 10;
                  const bonusVal = playerStats[`bonus_${stat.key}`] ?? 0;
                  return (
                    <div key={stat.key} className="flex justify-between text-[9px] font-bold text-[#5c3e16]">
                      <span>{stat.label}</span>
                      <span>
                        {baseVal}
                        {bonusVal > 0 && <span className="text-green-600 ml-0.5">+{bonusVal}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Combat Stats summary */}
              <div className="bg-[#fdf9f3] border border-[#d2be9f] rounded-lg p-2 flex flex-col gap-1 shadow-sm">
                <span className="text-[8.5px] font-black text-[#8c6b4f] uppercase tracking-wider border-b border-[#b88c42]/10 pb-0.5">Combat Stats</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px] font-bold text-[#5c3e16]">
                  <div className="flex justify-between">
                    <span className="text-[#8c6b4f]">ATK:</span>
                    <span>{Math.round(playerStats.attack ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8c6b4f]">DEF:</span>
                    <span>{Math.round(playerStats.defense ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8c6b4f]">HIT:</span>
                    <span>{Math.round(playerStats.hit ?? 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8c6b4f]">FLEE:</span>
                    <span>{Math.round(playerStats.flee ?? 100)}</span>
                  </div>
                  <div className="flex justify-between col-span-2 border-t border-[#b88c42]/10 pt-0.5 mt-0.5">
                    <span className="text-[#8c6b4f]">ASPD:</span>
                    <span>{(130 + (Math.min(1000, Math.max(0, playerStats.aspd ?? 150)) / 1000) * 63).toFixed(0)} ({playerStats.aspd ?? 150}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column: Equipment Slots */}
          <div className="w-[220px] flex flex-col gap-2.5 bg-[#ebdcb9]/30 border border-[#b88c42]/30 p-3 rounded-xl min-h-0 shrink-0">
            <h4 className="text-[9px] font-black text-[#8c6b4f] uppercase tracking-widest border-b border-[#b88c42]/20 pb-1 text-center shrink-0">Equipment</h4>
            <div className="flex-1 grid grid-cols-1 gap-2 overflow-y-auto pr-0.5">
              {slots.map((slot) => {
                const item = equipped.find((i: any) => i.slot_type === slot);
                const isSelected = selectedItem && selectedItem.id === item?.id;
                return (
                  <div
                    key={slot}
                    onClick={() => item && setSelectedItem(item)}
                    className={`flex flex-col gap-0.5 p-2 bg-[#fdf9f3] border rounded-lg cursor-pointer transition-all ${
                      item
                        ? isSelected
                          ? "border-[#b88c42] bg-[#f3e9d7] shadow-sm"
                          : "border-[#d2be9f] hover:border-[#b88c42]"
                        : "border-[#d2be9f]/40 opacity-70"
                    }`}
                  >
                    <span className="text-[7.5px] font-black text-[#8c6b4f] uppercase tracking-widest leading-none">
                      {slot === "weapon" ? "⚔️ Weapon" : slot === "armor" ? "🥋 Outfit/Armor" : slot === "helmet" ? "👑 Helmet" : slot === "boots" ? "🥾 Boots" : slot === "shield" ? "🛡️ Shield" : "📿 Accessory"}
                    </span>
                    {item ? (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] font-bold text-[#047857] truncate max-w-[120px]">
                          {item.refine_level > 0 ? `+${item.refine_level} ` : ""}{item.name}
                        </span>
                        <span className="text-[8.5px] text-[#b88c42] font-black shrink-0">Off</span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-[#8c6b4f]/60 font-medium italic mt-0.5">Kosong</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Inventory Bag list & Item Details */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Top Stats/Zeny info banner */}
            <div className="flex justify-between items-center bg-[#ebdcb9] border border-[#b88c42] px-4 py-2 rounded-xl shrink-0 shadow-sm">
              <span className="text-[9.5px] font-black text-[#5c3e16] uppercase tracking-widest flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#e07b00]" /> UANG ZENY:
              </span>
              <span className="text-sm font-black text-[#e07b00]">{(playerStats.gold ?? 0).toLocaleString()} <span className="text-[9.5px] text-[#8c6b4f] font-bold uppercase tracking-wider ml-0.5">Z</span></span>
            </div>

            {/* Split Grid & Item detail panel */}
            <div className="flex-1 flex gap-3 min-h-0">
              {/* Bag Grid */}
              <div className="flex-1 flex flex-col gap-2 min-h-0 bg-[#ebdcb9]/20 border border-[#b88c42]/20 p-2.5 rounded-xl">
                <h4 className="text-[9px] font-black text-[#8c6b4f] uppercase tracking-widest border-b border-[#b88c42]/10 pb-1 shrink-0">Tas Barang</h4>
                <div className="flex-1 overflow-y-auto pr-1">
                  {bag.length === 0 ? (
                    <p className="text-[10px] text-[#8c6b4f] italic text-center py-10">Tas kosong</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {bag.map((item: any) => {
                        const isSelected = selectedItem && selectedItem.id === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`p-2 rounded-xl cursor-pointer transition-all border flex flex-col gap-0.5 ${
                              isSelected
                                ? "bg-[#f3e9d7] border-[#b88c42] shadow-sm"
                                : "bg-[#fdf9f3] border-[#d2be9f] hover:border-[#b88c42]"
                            }`}
                          >
                            <span className="text-[10.5px] font-black text-[#5c3e16] leading-tight truncate">
                              {item.refine_level > 0 ? `+${item.refine_level} ` : ""}{item.name}
                            </span>
                            <span className="text-[8px] text-[#8c6b4f] uppercase tracking-wider font-bold">
                              {item.type === "consumable" ? "📦 Gunakan" : `🛡️ ${item.slot_type}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Detailed Popover panel */}
              <div className="w-[280px] bg-[#fbf5e8] border border-[#b88c42]/40 rounded-xl p-3 flex flex-col justify-between shrink-0 shadow-inner">
                {selectedItem ? (
                  <div className="flex flex-col gap-2 min-h-0 overflow-y-auto">
                    <div className="border-b border-[#b88c42]/30 pb-1.5">
                      <h5 className="text-[11.5px] font-black text-[#5c3e16] leading-tight">
                        {selectedItem.refine_level > 0 ? `+${selectedItem.refine_level} ` : ""}{selectedItem.name}
                      </h5>
                      <span className="text-[7.5px] font-bold text-amber-600 bg-amber-100 border border-amber-300/30 px-1 py-0.5 rounded uppercase tracking-wider inline-block mt-1">
                        {selectedItem.type}
                      </span>
                    </div>

                    <Item3DPreview itemID={selectedItem.item_id} />

                    <div className="flex flex-col gap-1 text-[9.5px]">
                      {selectedItem.slot_type && (
                        <div className="flex justify-between">
                          <span className="text-[#8c6b4f]">Slot:</span>
                          <span className="font-bold uppercase">{selectedItem.slot_type}</span>
                        </div>
                      )}
                      
                      {/* Randomized drop stats display */}
                      <div className="flex flex-col gap-0.5 mt-1 border-t border-[#b88c42]/10 pt-1.5">
                        <span className="text-[8px] font-black text-[#8c6b4f] uppercase tracking-wider">Bonus Stats:</span>
                        {selectedItem.add_attack > 0 && (
                          <div className="flex justify-between text-orange-600 font-extrabold">
                            <span>Physical ATK:</span>
                            <span>+{selectedItem.add_attack}</span>
                          </div>
                        )}
                        {selectedItem.add_defense > 0 && (
                          <div className="flex justify-between text-emerald-600 font-extrabold">
                            <span>Defense:</span>
                            <span>+{selectedItem.add_defense}</span>
                          </div>
                        )}
                        {selectedItem.add_hp > 0 && (
                          <div className="flex justify-between text-blue-600 font-extrabold">
                            <span>Max HP:</span>
                            <span>+{selectedItem.add_hp}</span>
                          </div>
                        )}
                        {selectedItem.add_mp > 0 && (
                          <div className="flex justify-between text-purple-600 font-extrabold">
                            <span>Max SP:</span>
                            <span>+{selectedItem.add_mp}</span>
                          </div>
                        )}
                        {selectedItem.add_attack === 0 && selectedItem.add_defense === 0 && selectedItem.add_hp === 0 && selectedItem.add_mp === 0 && (
                          <span className="text-[#8c6b4f]/60 italic">Tidak ada bonus stat</span>
                        )}
                      </div>
                    </div>

                    {/* Actions panel */}
                    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-[#b88c42]/20">
                      {selectedItem.type === "equipment" ? (
                        <>
                          <button
                            onClick={() => sendEquipItem(selectedItem.id)}
                            className={`w-full py-1.5 rounded-lg text-[9px] font-black text-white transition-all active:scale-95 border ${
                              selectedItem.is_equipped
                                ? "bg-red-500 hover:bg-red-400 border-red-600"
                                : "bg-[#10b981] hover:bg-emerald-400 border-[#047857]/50"
                            }`}
                          >
                            {selectedItem.is_equipped ? "Unequip" : "Equip"}
                          </button>
                          
                          {!selectedItem.is_equipped && (
                            <button
                              onClick={() => sendRefineItem(selectedItem.id)}
                              className="w-full py-1.5 bg-gradient-to-b from-[#ffb547] to-[#e07b00] border border-[#b25900]/50 hover:brightness-110 text-white rounded-lg text-[9px] font-black transition-all active:scale-95 flex items-center justify-center gap-1"
                            >
                              <Hammer className="w-2.5 h-2.5" /> Tempa (+{1000 * (selectedItem.refine_level + 1)})
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => sendUseItem(selectedItem.id)}
                          className="w-full py-1.5 bg-[#0284c7] border border-[#0369a1]/50 hover:brightness-110 text-white rounded-lg text-[9px] font-black transition-all active:scale-95"
                        >
                          Gunakan
                        </button>
                      )}

                      {!selectedItem.is_equipped && (
                        <button
                          onClick={() => {
                            sendSellItem(selectedItem.id);
                            setSelectedItem(null);
                          }}
                          className="w-full py-1 bg-red-50 hover:bg-red-100 border border-red-300 text-red-600 rounded-lg text-[9px] font-bold transition-all active:scale-95"
                        >
                          Jual (Zeny)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-[#8c6b4f]/60 py-6">
                    <span className="text-xl">🔍</span>
                    <p className="text-[9px] font-medium mt-1 leading-normal">Pilih barang untuk melihat detail statistik & deskripsi</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
