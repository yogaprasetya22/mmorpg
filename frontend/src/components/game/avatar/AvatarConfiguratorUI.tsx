'use client';

import { useAvatarConfiguratorStore, PHOTO_POSES, UI_MODES, PhotoPose, AvatarAsset } from "@/src/state/useAvatarConfiguratorStore";
import { API_BASE_URL } from "@/src/core/config";
import { useState, useEffect } from "react";
import { Gamepad2, Shuffle, Camera, Download, X, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AssetThumbnailProps {
  asset: AvatarAsset;
}

const AssetThumbnail = ({ asset }: AssetThumbnailProps) => {
  return (
    <img
      src={`${API_BASE_URL}${asset.thumbnail}`}
      alt={asset.name}
      className="object-cover w-full h-full scale-[2.5] my-16"
      loading="lazy"
    />
  );
};

const PosesBox = () => {
  const curPose = useAvatarConfiguratorStore((state) => state.pose);
  const setPose = useAvatarConfiguratorStore((state) => state.setPose);
  return (
    <div className="grid grid-cols-2 gap-2 w-full transform translate-z-0 pointer-events-auto">
      {(Object.keys(PHOTO_POSES) as Array<keyof typeof PHOTO_POSES>).map((pose) => {
        const isActive = curPose === PHOTO_POSES[pose];
        return (
          <button
            key={pose}
            className={`px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-300 border text-center
              ${
                isActive
                  ? "bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-600/20"
                  : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:text-white"
              }`}
            onClick={() => setPose(PHOTO_POSES[pose] as PhotoPose)}
          >
            {pose}
          </button>
        );
      })}
    </div>
  );
};

const PosesBoxMobile = () => {
  const curPose = useAvatarConfiguratorStore((state) => state.pose);
  const setPose = useAvatarConfiguratorStore((state) => state.setPose);
  return (
    <div className="flex flex-row flex-nowrap gap-2 overflow-x-auto noscrollbar py-1 pointer-events-auto">
      {(Object.keys(PHOTO_POSES) as Array<keyof typeof PHOTO_POSES>).map((pose) => {
        const isActive = curPose === PHOTO_POSES[pose];
        return (
          <button
            key={pose}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 border
              ${
                isActive
                  ? "bg-cyan-600 text-white border-cyan-500 shadow-md"
                  : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:text-white"
              }`}
            onClick={() => setPose(PHOTO_POSES[pose] as PhotoPose)}
          >
            {pose}
          </button>
        );
      })}
    </div>
  );
};

const ColorPicker = () => {
  const updateColor = useAvatarConfiguratorStore((state) => state.updateColor);
  const currentCategory = useAvatarConfiguratorStore(
    (state) => state.currentCategory
  );
  const customization = useAvatarConfiguratorStore((state) => state.customization);
  const categoryName = currentCategory?.name || "";

  if (!categoryName || !customization[categoryName]?.asset) {
    return null;
  }
  
  const colors = currentCategory?.expand?.colorPalette?.colors || [];

  return (
    <div className="flex flex-row flex-wrap gap-2 py-1 transform translate-z-0 pointer-events-auto">
      {colors.map((color, index) => {
        const isSelected = customization[categoryName]?.color === color;
        return (
          <button
            key={`${index}-${color}`}
            className={`w-8 h-8 rounded-full border-2 transition-all duration-300 shrink-0 p-0.5 flex items-center justify-center
               ${
                 isSelected
                   ? "border-cyan-400 scale-110 shadow-lg shadow-cyan-500/20"
                   : "border-transparent hover:scale-105"
               }
            `}
            onClick={() => updateColor(color)}
          >
            <div
              className="w-full h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </button>
        );
      })}
    </div>
  );
};

interface AvatarConfiguratorUIProps {
  onClose?: () => void;
}

export const AvatarConfiguratorUI = ({ onClose }: AvatarConfiguratorUIProps) => {
  const router = useRouter();
  const {
    categories,
    currentCategory,
    setCurrentCategory,
    changeAsset,
    customization,
    lockedGroups,
    mode,
    setMode,
    loading,
    randomize,
    screenshot,
    download,
    fetchCategories,
  } = useAvatarConfiguratorStore();

  const categoryName = currentCategory?.name || "";

  // Core character creation settings
  const [charName, setCharName] = useState("");
  const [charClass, setCharClass] = useState("Warrior");
  const [charGender, setCharGender] = useState("Male");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories();
    }
  }, [categories, fetchCategories]);

  const handleSaveCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      setErrorMessage("Character name cannot be empty");
      return;
    }

    const token = localStorage.getItem("game_auth_token");
    if (!token) {
      setErrorMessage("Auth token not found. Please log in first.");
      router.push("/arena");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      // Fetch details of hair color from current customization state
      const hairColor = customization["Hair"]?.color || "#5A3E2D";
      // HairStyle index mapping: if Head asset is chosen, style style
      const hairStyleAsset = customization["Hair"]?.asset;
      const hairStyleIndex = hairStyleAsset ? parseInt(hairStyleAsset.id.replace("asset_hair_", "")) || 1 : 1;

      const response = await fetch(`${API_BASE_URL}/api/player/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: charName.trim(),
          class: charClass,
          gender: charGender,
          hair_style: hairStyleIndex,
          hair_color: hairColor,
          custom_avatar_url: JSON.stringify(customization),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create character");
      }

      if (data.player && data.player.id) {
        localStorage.setItem("game_active_char_id", data.player.id);
      }
      
      if (onClose) {
        onClose();
        window.location.reload();
      } else {
        router.push("/arena");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save character");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="pointer-events-none fixed inset-0 select-none flex flex-col justify-between h-screen w-screen z-10 font-sans">
      {/* 1. Loading Splash Screen */}
      <div
        className={`absolute inset-0 bg-zinc-950 z-50 pointer-events-none flex flex-col items-center justify-center transition-opacity duration-1000 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="text-4xl font-extrabold text-white tracking-widest uppercase mb-4 animate-pulse flex items-center gap-3">
          <Gamepad2 className="w-10 h-10 text-cyan-400 animate-spin" /> MMORPG
        </div>
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-6">Loading Assets Model...</p>
        <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 w-1/2 animate-pulse rounded-full"></div>
        </div>
      </div>

      {/* 2. Top Header Navigation */}
      <div className="w-full flex items-center justify-between p-6 pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <Link 
            href="/arena" 
            onClick={(e) => {
              if (onClose) {
                e.preventDefault();
                onClose();
              }
            }}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-cyan-400 leading-none">
              Character Creator
            </h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Configure your ultimate gear</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Randomize avatar"
            className="p-3 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
            onClick={randomize}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            title="Take snapshot"
            className="p-3 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
            onClick={screenshot}
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            title="Export GLB Model"
            onClick={download}
            className="p-3 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Main Workspace Area (Dual Sidebars) */}
      <div className="flex-1 flex flex-row justify-between items-center overflow-hidden min-h-0 relative">
        
        {/* LEFT PANEL: Identity & Categories */}
        <div className="hidden lg:flex flex-col gap-5 p-6 w-72 bg-zinc-950/80 border-r border-white/5 shadow-2xl pointer-events-auto h-full overflow-y-auto noscrollbar transform translate-z-0">
          
          {/* Form Info */}
          <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
            <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase leading-none">IDENTITY</span>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                value={charName} 
                onChange={(e) => setCharName(e.target.value)} 
                placeholder="Hero name..."
                className="w-full bg-zinc-900/60 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder-zinc-600" 
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Gender</label>
              <div className="grid grid-cols-2 gap-2">
                {["Male", "Female"].map((gender) => (
                  <button 
                    key={gender} 
                    type="button" 
                    onClick={() => setCharGender(gender)}
                    className={`py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${charGender === gender ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" : "bg-zinc-900/30 border-white/5 text-zinc-500 hover:border-white/10"}`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Class</label>
              <select 
                value={charClass} 
                onChange={(e) => setCharClass(e.target.value)}
                className="w-full bg-zinc-900/60 border border-white/10 px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 focus:outline-none focus:border-cyan-500/50"
              >
                {["Warrior", "Mage", "Priest", "Thief", "Beginner"].map((c) => (
                  <option key={c} value={c} className="bg-zinc-950 text-white font-bold">{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase leading-none mb-1">CATEGORIES</span>
            {categories.map((category) => {
              const isActive = currentCategory?.id === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setCurrentCategory(category)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-300 font-semibold flex items-center justify-between border text-xs
                    ${
                      isActive
                        ? "bg-cyan-600/90 text-white border-cyan-500 shadow-lg shadow-cyan-600/20"
                        : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  <span>{category.name}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Space */}
        <div className="flex-1" />

        {/* RIGHT PANEL: Customization Options */}
        <div className="hidden lg:flex flex-col gap-6 p-6 w-96 bg-zinc-950/80 border-l border-white/5 shadow-2xl pointer-events-auto h-full overflow-y-auto noscrollbar transform translate-z-0">
          {mode === UI_MODES.CUSTOMIZE ? (
            <>
              <div>
                <h2 className="text-xl font-black text-white tracking-wide">{categoryName}</h2>
                <p className="text-zinc-500 text-xs mt-1">Select style and color palette</p>
              </div>

              {/* Color swatches if any */}
              {currentCategory?.expand?.colorPalette &&
                categoryName &&
                customization[categoryName] && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase leading-none">Color Palette</span>
                    <ColorPicker />
                  </div>
              )}

              {/* Assets list */}
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase leading-none">Assets</span>
                
                {categoryName && lockedGroups[categoryName] ? (
                  <div className="bg-red-950/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-2">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1.5 leading-none">
                      Slot Locked
                    </span>
                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                      This category is locked by your equipped:
                    </p>
                    <ul className="text-xs text-red-300 list-disc list-inside font-bold">
                      {lockedGroups[categoryName].map((asset, index) => (
                        <li key={index}>{asset.name} ({asset.categoryName})</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 noscrollbar">
                    {currentCategory?.removable && (
                      <button
                        onClick={() => changeAsset(categoryName, null)}
                        className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-300 pointer-events-auto
                          ${
                            !customization[categoryName]?.asset
                              ? "border-cyan-500 bg-cyan-600/20 text-white shadow-lg"
                              : "border-white/5 bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white"
                          }`}
                      >
                        <X className="w-5 h-5" />
                        <span className="text-[10px] mt-1 font-medium">None</span>
                      </button>
                    )}
                    {currentCategory?.assets?.map((asset) => {
                      const isSelected = customization[categoryName]?.asset?.id === asset.id;
                      return (
                        <button
                          key={asset.id}
                          onClick={() => changeAsset(categoryName, asset)}
                          className={`aspect-square relative rounded-xl overflow-hidden border-2 transition-all duration-300 pointer-events-auto group
                            ${
                              isSelected
                                ? "border-cyan-500 bg-cyan-600/20"
                                : "border-white/5 bg-white/5 hover:border-white/20"
                            }`}
                        >
                          <AssetThumbnail asset={asset} />
                          <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1 px-1 text-center text-[9px] font-bold text-gray-300 truncate z-10">
                            {asset.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit / Save Button */}
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-red-400 text-xs font-semibold">
                  {errorMessage}
                </div>
              )}
              <button
                onClick={handleSaveCharacter}
                disabled={saving}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-black text-xs py-4 rounded-xl border border-cyan-400/30 uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 pointer-events-auto"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Character
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-black text-white tracking-wide">Photo Booth</h2>
                <p className="text-zinc-500 text-xs mt-1">Select a pose for your avatar</p>
              </div>
              <PosesBox />
            </div>
          )}
        </div>

      </div>

      {/* 4. Bottom Area (Mobile Panels & Floating Mode Switcher) */}
      <div className="flex flex-col items-center w-full bg-gradient-to-t from-black/80 to-transparent">
        
        {/* Floating Capsule Mode Tabs (Desktop Only) */}
        <div className="hidden lg:flex bg-zinc-950/90 border border-white/5 rounded-full p-1 shadow-2xl mb-6 pointer-events-auto transform translate-z-0">
          <button
            onClick={() => setMode(UI_MODES.CUSTOMIZE)}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300
              ${
                mode === UI_MODES.CUSTOMIZE
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                  : "text-gray-400 hover:text-white"
              }`}
          >
            Customize
          </button>
          <button
            onClick={() => setMode(UI_MODES.PHOTO)}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all duration-300
              ${
                mode === UI_MODES.PHOTO
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                  : "text-gray-400 hover:text-white"
              }`}
          >
            Photo Booth
          </button>
        </div>

        {/* Adaptive Panel for Mobile (Mobile Only) */}
        <div className="lg:hidden w-full bg-zinc-950/95 border-t border-white/5 shadow-2xl p-4 flex flex-col gap-4 pointer-events-auto transform translate-z-0">
          
          {/* Identity input card for Mobile */}
          {mode === UI_MODES.CUSTOMIZE && (
            <div className="flex flex-col gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <input 
                type="text" 
                value={charName} 
                onChange={(e) => setCharName(e.target.value)} 
                placeholder="Hero name..."
                className="w-full bg-zinc-900/60 border border-white/10 px-3 py-2 rounded-lg text-xs font-semibold text-white focus:outline-none" 
              />
              <div className="flex items-center gap-2">
                <select 
                  value={charClass} 
                  onChange={(e) => setCharClass(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/10 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-zinc-300"
                >
                  {["Warrior", "Mage", "Priest", "Thief", "Beginner"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="flex bg-zinc-900 border border-white/10 rounded-lg p-0.5">
                  {["Male", "Female"].map((gender) => (
                    <button 
                      key={gender} 
                      type="button" 
                      onClick={() => setCharGender(gender)}
                      className={`px-2 py-1 rounded text-[9px] font-bold ${charGender === gender ? "bg-cyan-600 text-white" : "text-zinc-500"}`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs for Mobile */}
          <div className="flex w-full bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setMode(UI_MODES.CUSTOMIZE)}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all duration-300
                ${
                  mode === UI_MODES.CUSTOMIZE
                    ? "bg-cyan-600 text-white"
                    : "text-gray-400"
                }`}
            >
              Customize
            </button>
            <button
              onClick={() => setMode(UI_MODES.PHOTO)}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all duration-300
                ${
                  mode === UI_MODES.PHOTO
                    ? "bg-cyan-600 text-white"
                    : "text-gray-400"
                }`}
            >
              Photo Booth
            </button>
          </div>

          {mode === UI_MODES.CUSTOMIZE ? (
            <>
              {/* Category selector row */}
              <div className="flex flex-row flex-nowrap gap-1.5 overflow-x-auto noscrollbar py-0.5">
                {categories.map((category) => {
                  const isActive = currentCategory?.id === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setCurrentCategory(category)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 border
                        ${
                          isActive
                            ? "bg-cyan-600 text-white border-cyan-500 shadow-md"
                            : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>

              {/* Color swatches */}
              {currentCategory?.expand?.colorPalette &&
                categoryName &&
                customization[categoryName] && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase leading-none">Color Palette</span>
                    <ColorPicker />
                  </div>
              )}

              {/* Thumbnails row */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase leading-none">Assets</span>
                
                {categoryName && lockedGroups[categoryName] ? (
                  <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 text-center font-bold">
                    Category Locked by Outfit
                  </div>
                ) : (
                  <div className="flex flex-row flex-nowrap gap-2 overflow-x-auto noscrollbar py-0.5">
                    {currentCategory?.removable && (
                      <button
                        onClick={() => changeAsset(categoryName, null)}
                        className={`w-16 h-16 shrink-0 flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-300
                          ${
                            !customization[categoryName]?.asset
                              ? "border-cyan-500 bg-cyan-600/20 text-white"
                              : "border-white/5 bg-white/5 text-gray-500"
                          }`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    {currentCategory?.assets?.map((asset) => {
                      const isSelected = customization[categoryName]?.asset?.id === asset.id;
                      return (
                        <button
                          key={asset.id}
                          onClick={() => changeAsset(categoryName, asset)}
                          className={`w-16 h-16 shrink-0 relative rounded-xl overflow-hidden border-2 transition-all duration-300
                            ${
                              isSelected
                                ? "border-cyan-500 bg-cyan-600/20"
                                : "border-white/5 bg-white/5"
                            }`}
                        >
                          <AssetThumbnail asset={asset} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-red-400 text-[10px] font-semibold">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleSaveCharacter}
                disabled={saving}
                className="w-full bg-cyan-500 text-white font-black text-xs py-3.5 rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Character
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase leading-none">Poses</span>
              <PosesBoxMobile />
            </div>
          )}

        </div>

      </div>

    </main>
  );
};
