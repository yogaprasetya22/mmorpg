/** ArenaClient — thin page-level wrapper composing all Arena sub-modules. */
'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Gavel, Scale, Gift, Sparkles, Gem, ChevronRight, LogOut, User, BookOpen } from 'lucide-react';
const AvatarExperience = dynamic(
  () => import('@/src/components/game/avatar/AvatarExperience'),
  { ssr: false }
);
import { AvatarConfiguratorUI } from '@/src/components/game/avatar/AvatarConfiguratorUI';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Stats } from '@react-three/drei';
import { SafePostProcessing } from '@/src/components/game/systems/SafePostProcessing';
import { PlayerController, keyboardMap } from '@/src/components/game/PlayerController';
import { RemotePlayersRenderer } from '@/src/components/game/RemotePlayersRenderer';
import { RemoteMonstersRenderer } from '@/src/components/game/RemoteMonstersRenderer';
import { FPSCounterUpdater } from './components/FPSCounter';
import { Minimap } from '@/src/components/game/Minimap';
import { EnvironmentMultiGlobal } from '@/src/components/game/environment/EnvironmentMultiGlobal';
import { ModularMap } from '@/src/components/game/environment/ModularMap';
import { CameraOcclusionManager } from '@/src/components/game/systems/CameraOcclusionManager';
import { VFXProvider } from '@/src/components/game/systems/VFXManager';
import { DamageHUDBatcher } from '@/src/components/game/systems/DamageHUDBatcher';
import { MMSpellEffect } from '@/src/components/game/systems/effects/MMSpellEffect';
import { FighterSpellEffect } from '@/src/components/game/systems/effects/FighterSpellEffect';
import { TankSpellEffect } from '@/src/components/game/systems/effects/TankSpellEffect';
import { AssassinSpellEffect } from '@/src/components/game/systems/effects/AssassinSpellEffect';
import { MageSpellEffect } from '@/src/components/game/systems/effects/MageSpellEffect';
import { useEditorStore } from '@/src/state/useEditorStore';

// BVH bootstrap + GLTF preloads (side-effect import)
import './ArenaClient.bootstrap';

// Hook
import { useArenaGameState } from './ArenaClient.hooks';

// Components
// FPSCounterUpdater removed — was adding useFrame overhead for CustomEvent dispatch every 1s
import { ExposureBridge } from './components/ExposureBridge';
import { ModelsPreloader } from './components/ModelsPreloader';
// PerformanceDiagnostics removed — ring buffer + DOM updates + WS telemetry every frame was adding overhead
import { GameChat } from './components/GameChat';
import { PlayerStatsHUD } from './components/PlayerStatsHUD';
import { GameStatusBar } from './components/GameStatusBar';
import { DeathOverlay } from './components/DeathOverlay';
import { AuthScreen } from './components/AuthScreen';
import { CharacterSelectScreen } from './components/CharacterSelectScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { CharacterStatsModal } from './components/CharacterStatsModal';
import { PlayerInventory } from './components/PlayerInventory';
import { PlayerShop } from './components/PlayerShop';
import { PlayerRewards } from './components/PlayerRewards';
import { PlayerAuction } from './components/PlayerAuction';
import { MonsterEditorModal } from './components/MonsterEditorModal';
import { SkillBar } from './components/SkillBar';
import { QuestPanel } from './components/QuestPanel';
import { SettingsDashboardModal } from './components/SettingsDashboardModal';

// Re-export types and constants for backward compatibility
export { CLASS_LABELS } from './ArenaClient.constants';
export type { GameChatRef, PlayerStatsHUDRef, GameStatusBarRef, DeathOverlayRef, QuestPanelRef } from './ArenaClient.types';

/** Stub camera director (reserved for epic ending cinematics). */
const CameraDirector = () => null;

export default function MultiplayerArena() {
  const state = useArenaGameState();
  const [showQuickMenu, setShowQuickMenu] = useState(true);
  const [showSettingsDashboard, setShowSettingsDashboard] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);

  // Set global modal open flag for input hooks
  useEffect(() => {
    (window as any).isModalOpen = !!(
      state.showStatsModal || 
      state.showInventoryModal || 
      state.showEnemyEditorModal || 
      showShopModal || 
      showAuctionModal || 
      showRewardsModal
    );
  }, [state.showStatsModal, state.showInventoryModal, state.showEnemyEditorModal, showShopModal, showAuctionModal, showRewardsModal]);

  // Expose statsHudRef to window for usePlayerCombat to update mana locally
  useEffect(() => {
    if (state.statsHudRef?.current) {
      (window as any).statsHudRef = state.statsHudRef;
    }
  }, [state.statsHudRef]);

  // Handle item drops visually via alerts and chat
  useEffect(() => {
    const handleItemDrop = (e: Event) => {
      const drop = (e as CustomEvent).detail;
      if (!drop) return;

      // Append to chat
      if (state.chatRef.current) {
        state.chatRef.current.appendMessage(
          "Sistem",
          `Looted: ${drop.itemName} x${drop.quantity} dari ${drop.monster}!`
        );
      }

      // Display animated toast
      const alertEl = document.getElementById("item-drop-alert");
      const nameEl = document.getElementById("item-drop-alert-name");
      if (alertEl && nameEl) {
        let statsStr = "";
        if (drop.addAttack > 0) statsStr += ` ATK+${drop.addAttack}`;
        if (drop.addDefense > 0) statsStr += ` DEF+${drop.addDefense}`;
        if (drop.addHp > 0) statsStr += ` HP+${drop.addHp}`;
        
        nameEl.innerText = `${drop.itemName} x${drop.quantity} ${statsStr ? `(${statsStr.trim()})` : ""}`;
        alertEl.style.opacity = "1";
        setTimeout(() => {
          alertEl.style.opacity = "0";
        }, 3200);
      }
    };

    window.addEventListener("item_drop_event", handleItemDrop);
    return () => {
      window.removeEventListener("item_drop_event", handleItemDrop);
    };
  }, [state.chatRef]);

  // Read bloom settings from editor store (saved by world editor, applied here in arena)
  const bloomStrength  = useEditorStore(s => s.bloomStrength);
  const bloomRadius    = useEditorStore(s => s.bloomRadius);
  const bloomThreshold = useEditorStore(s => s.bloomThreshold);

  // View 0: Session Recovery
  if (state.isRecoveringSession) {
    return <LoadingScreen type="session" successMsg={state.successMsg} />;
  }

  // View 1: Auth Screen
  if (!state.token) {
    return (
      <AuthScreen
        username={state.username} setUsername={state.setUsername}
        password={state.password} setPassword={state.setPassword}
        isLogin={state.isLogin} setIsLogin={state.setIsLogin}
        loading={state.loading} errorMsg={state.errorMsg} setErrorMsg={state.setErrorMsg}
        successMsg={state.successMsg} setSuccessMsg={state.setSuccessMsg}
        handleAuthSubmit={state.handleAuthSubmit}
      />
    );
  }

  // View 2: Character Selection
  if (state.token && !state.selectedCharacter) {
    if (state.isCreatingChar) {
      return (
        <div className="w-screen h-screen relative overflow-hidden bg-[#0a0a0e]">
          <AvatarConfiguratorUI onClose={() => state.setIsCreatingChar(false)} />
          <Canvas
            camera={{
              position: [0, 1.2, 3.2],
              fov: 45,
            }}
            gl={{
              preserveDrawingBuffer: true,
              antialias: true,
              powerPreference: "high-performance",
            }}
            dpr={[1, 1.5]}
            shadows
            className="w-full h-full"
          >
            <color attach="background" args={["#0a0a0e"]} />
            <fog attach="fog" args={["#0a0a0e", 8, 30]} />
            <group position-y={-0.6}>
              <Suspense fallback={null}>
                <AvatarExperience />
              </Suspense>
            </group>
          </Canvas>
        </div>
      );
    }

    return (
      <CharacterSelectScreen
        username={state.username} characters={state.characters}
        errorMsg={state.errorMsg} successMsg={state.successMsg} loading={state.loading}
        isCreatingChar={state.isCreatingChar} setIsCreatingChar={state.setIsCreatingChar}
        charName={state.charName} setCharName={state.setCharName}
        charClass={state.charClass} setCharClass={state.setCharClass}
        charGender={state.charGender} setCharGender={state.setCharGender}
        charHairStyle={state.charHairStyle} setCharHairStyle={state.setCharHairStyle}
        charHairColor={state.charHairColor} setCharHairColor={state.setCharHairColor}
        handleCreateCharacter={state.handleCreateCharacter}
        handleLogout={state.handleLogout}
        setSelectedCharacter={state.setSelectedCharacter}
        setEnvReady={state.setEnvReady}
      />
    );
  }

  // View 3: 3D Game Interface
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden touch-none select-none bg-black text-white font-sans">
      {/* Loading overlay */}
      {!state.envReady && <LoadingScreen type="world" />}

      {/* 3D CANVAS */}
      <div className="absolute inset-0 w-full h-full z-0">
        <KeyboardControls map={keyboardMap}>
          <Canvas
            shadows={{ type: THREE.BasicShadowMap }}
            dpr={state.dpr}
            gl={{
              antialias: false,
              powerPreference: "high-performance",
              logarithmicDepthBuffer: false,
              stencil: false,
              depth: true,
              alpha: false,
              failIfMajorPerformanceCaveat: false,
              precision: "mediump",
            }}
            className="w-full h-full"
          >
            <ExposureBridge exposure={1.0} />

            <VFXProvider>
              <CameraDirector />
              <ModelsPreloader onReady={() => state.setModelsReady(true)} />

              <EnvironmentMultiGlobal
                settingsRef={state.settingsRef}
                debug={false}
                onReady={() => { setTimeout(() => { state.setEnvFinished(true); }, 600); }}
              />
              <Suspense fallback={null}><ModularMap debug={false} /></Suspense>
              <CameraOcclusionManager />

              <MMSpellEffect spellsRef={state.mmSpellsRef} unitRegistry={state.unitRegistryRef} simTimeRef={state.simTimeRef} />
              <FighterSpellEffect fighterSpellsRef={state.fighterSpellsRef} simTimeRef={state.simTimeRef} />
              <TankSpellEffect tankSpellsRef={state.tankSpellsRef} simTimeRef={state.simTimeRef} unitRegistry={state.unitRegistryRef} />
              <AssassinSpellEffect assassinSpellsRef={state.assassinSpellsRef} simTimeRef={state.simTimeRef} />
              <MageSpellEffect spellsRef={state.spellsRef} unitRegistry={state.unitRegistryRef} simTimeRef={state.simTimeRef} />

              <DamageHUDBatcher 
                damageQueue={state.damageQueue} 
                playerStatsRef={state.playerStatsRef} 
              />

              <PlayerController
                paused={!state.envReady}
                modelPath={state.localPlayerModelPath}
                playerClass={state.selectedCharacter?.class || "Warrior"}
                settingsRef={state.settingsRef}
                damageQueue={state.damageQueue}
                mmSpellsRef={state.mmSpellsRef}
                spellsRef={state.spellsRef}
                fighterSpellsRef={state.fighterSpellsRef}
                tankSpellsRef={state.tankSpellsRef}
                assassinSpellsRef={state.assassinSpellsRef}
                simTimeRef={state.simTimeRef}
                dealPlayerDamage={state.handleAuthoritativeAttack}
                sendPlayerState={state.sendPlayerState}
                sendPlayerSkill={state.sendPlayerSkill}
                playerStats={state.playerStatsRef.current.hp >= 0 ? state.playerStatsRef.current : undefined}
                playerStatsRef={state.playerStatsRef}
                selectedCharacter={state.selectedCharacter}
                isAutoMode={state.isAutoMode}
              />

              <RemotePlayersRenderer
                activeRemotePlayers={state.activeRemotePlayers}
                connectedPlayersRef={state.connectedPlayersRef}
                gameConfig={state.gameConfig}
                mmSpellsRef={state.mmSpellsRef}
                spellsRef={state.spellsRef}
                fighterSpellsRef={state.fighterSpellsRef}
                tankSpellsRef={state.tankSpellsRef}
                assassinSpellsRef={state.assassinSpellsRef}
                unitRegistry={state.unitRegistryRef}
                localPlayerId={state.selectedCharacter?.id}
              />

              <RemoteMonstersRenderer
                worldMonstersRef={state.worldMonstersRef}
                onAttack={(monsterId) => {
                  (window as any).monsterClickedThisFrame = true;
                  (window as any).clickedTargetId = monsterId;
                  (window as any).hasAttackIntent = true;
                }}
                connectedPlayersRef={state.connectedPlayersRef}
                localPlayerId={state.selectedCharacter?.id}
                gameConfig={state.gameConfig}
              />

              {/* R3F performance stats — shows FPS, draw calls, triangles, memory */}
              <Stats className="!top-auto !bottom-2 !left-2" />
              {/* FPS counter that dispatches custom events for the top-bar FPSBadge */}
              <FPSCounterUpdater />
            </VFXProvider>

             {!state.settingsRef.current.potatoMode && (
              <SafePostProcessing
                bloomThreshold={bloomThreshold ?? 1.25}
                bloomStrength={bloomStrength ?? 0.35}
                bloomRadius={bloomRadius ?? 0.4}
              />
            )}
          </Canvas>
        </KeyboardControls>
      </div>

      {/* Death Overlay (Isolated Microservice) */}
      <DeathOverlay ref={state.deathOverlayRef} />

      {/* MULTIPLAYER HUD OVERLAY */}
      <div className="absolute inset-0 pointer-events-none z-10 select-none">
        {/* Alert toasts */}
        <div id="no-target-alert" className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/90 backdrop-blur-md border border-red-400/30 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-2xl pointer-events-none opacity-0 flex items-center gap-2" style={{transition:'opacity 0.25s ease-in-out'}}>
          <span className="animate-pulse">⚠️</span> BUTUH TARGET ENEMY UNTUK SKILL!
        </div>
        <div id="no-mana-alert" className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500/95 backdrop-blur-md border border-blue-400/30 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-2xl pointer-events-none opacity-0 flex items-center gap-2" style={{transition:'opacity 0.25s ease-in-out'}}>
          <span className="animate-pulse">🔷</span> MANA (MP) TIDAK CUKUP!
        </div>
        {/* Facing alignment alert */}
        <div id="facing-alignment-alert" className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500/90 backdrop-blur-md border border-amber-400/30 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-2xl pointer-events-none opacity-0 flex items-center gap-2" style={{transition:'opacity 0.25s ease-in-out'}}>
          <span className="animate-pulse">🔄</span> MENYELARASKAN HADAP TARGET...
        </div>

        {/* Item Drop Alert Toast (Classic RO Style) */}
        <div id="item-drop-alert" className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-[#ebdcb9] to-[#d8c39e] border-2 border-[#b88c42] text-[#5c3e16] font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl shadow-2xl pointer-events-none opacity-0 flex flex-col items-center gap-1.5" style={{transition:'opacity 0.3s ease-in-out', zIndex: 999}}>
          <span className="text-[10px] text-[#8c6b4f] tracking-wider animate-pulse">🎁 LOOT BARANG BARU!</span>
          <span id="item-drop-alert-name" className="text-[#047857] font-extrabold text-[12px] drop-shadow-sm"></span>
        </div>

        {/* Player Stats HUD (Isolated Microservice) */}
        <PlayerStatsHUD
          ref={state.statsHudRef}
          defaultUsername={state.selectedCharacter?.username || "Hero"}
          defaultLevel={state.selectedCharacter?.level || 1}
          onOpenStats={() => state.setShowStatsModal(true)}
        />

        {/* Top-Right: Minimap + Quick Menu + Status + Exit Portal */}
        <div className="absolute right-4 top-4 flex flex-col items-end gap-2.5 pointer-events-auto">
          {/* Quick Menu shortcuts above/left of minimap */}
          <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 shadow-md">
            {showQuickMenu && (
              <div className="flex items-center gap-3 mr-1 animate-in slide-in-from-right-3 duration-200">
                <button 
                  onClick={() => setShowAuctionModal(true)}
                  className="flex items-center gap-1 text-[8px] font-black text-zinc-300 hover:text-white transition-colors"
                >
                  <Gavel className="w-3 h-3 text-yellow-400" /> Auction
                </button>
                <button 
                  onClick={() => alert("Sistem Perdagangan (Trade) Peer-to-Peer akan hadir di fase berikutnya!")}
                  className="flex items-center gap-1 text-[8px] font-black text-zinc-300 hover:text-white transition-colors"
                >
                  <Scale className="w-3 h-3 text-cyan-400" /> Trade
                </button>
                <button 
                  onClick={() => setShowRewardsModal(true)}
                  className="flex items-center gap-1 text-[8px] font-black text-zinc-300 hover:text-white transition-colors"
                >
                  <Gift className="w-3 h-3 text-pink-400" /> Rewards
                </button>
                <button 
                  onClick={() => alert("Informasi Event Server sedang disiapkan!")}
                  className="flex items-center gap-1 text-[8px] font-black text-zinc-300 hover:text-white transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" /> Event
                </button>
                <button 
                  onClick={() => setShowShopModal(true)}
                  className="flex items-center gap-1 text-[8px] font-black text-zinc-300 hover:text-white transition-colors"
                >
                  <Gem className="w-3 h-3 text-amber-400" /> Shop
                </button>
              </div>
            )}
            <button
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="text-zinc-400 hover:text-white p-0.5 transition-transform"
              style={{ transform: showQuickMenu ? 'rotate(0deg)' : 'rotate(180deg)' }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-start gap-3">
            {/* Circular Exit Portal button on the left of Minimap */}
            <button
              onClick={state.handleLogout}
              className="w-10 h-10 rounded-full bg-blue-600/35 hover:bg-blue-600/50 backdrop-blur-md border-2 border-blue-400/50 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg self-center"
              title="Keluar / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <Minimap
              connectedPlayersRef={state.connectedPlayersRef}
              worldMonstersRef={state.worldMonstersRef}
              localPlayerId={state.selectedCharacter?.id || ""}
              mapId={state.selectedMapId || "Starter Zone"}
            />
          </div>

          <GameStatusBar ref={state.statusBarRef} mapId={state.selectedMapId} />

          {/* ── C, K, B & MENU Quick Access Buttons ── */}
          <div className="flex items-center gap-2 mt-1.5 bg-black/35 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-2xl shadow-lg">
            {/* C: Profile/Stats */}
            <div className="relative">
              <button
                onClick={() => state.setShowStatsModal(true)}
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-90"
                title="Profile & Stats (C)"
              >
                <User className="w-4 h-4 text-cyan-400" />
              </button>
              <span className="absolute -top-1.5 -left-1 px-1 bg-black/80 rounded text-[7px] font-black text-zinc-500">C</span>
            </div>

            {/* K: Skills */}
            <div className="relative">
              <button
                onClick={() => alert("Membuka jendela Skill & Kombinasi!")}
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-90"
                title="Skills (K)"
              >
                <BookOpen className="w-4 h-4 text-yellow-400" />
              </button>
              <span className="absolute -top-1.5 -left-1 px-1 bg-black/80 rounded text-[7px] font-black text-zinc-500">K</span>
            </div>

            {/* B: Bag / Inventory */}
            <div className="relative">
              <button
                onClick={() => state.setShowInventoryModal(true)}
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-90"
                title="Inventory Bag (B)"
              >
                <span className="text-sm">🎒</span>
              </button>
              <span className="absolute -top-1.5 -left-1 px-1 bg-black/80 rounded text-[7px] font-black text-zinc-500">B</span>
            </div>

            {/* Divider */}
            <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

            {/* Menu Circle Button (Witch Portrait) */}
            <button
              onClick={() => setShowSettingsDashboard(true)}
              className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all shadow-md overflow-hidden hover:brightness-110"
              title="Settings Dashboard & Menu"
            >
              {/* Cute Witch/Warlock Symbol Emoji */}
              <span className="text-lg relative z-10 leading-none">🧙‍♀️</span>
              {/* Red Notification Badge */}
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white/20 animate-pulse" />
            </button>
          </div>
        </div>

        {/* Quest Panel */}
        <QuestPanel ref={state.questPanelRef} />

        {/* Chat */}
        <GameChat ref={state.chatRef} sendChatMessage={state.sendChatMessage} />

        {/* Skill Bar */}
        <SkillBar
          selectedCharacter={state.selectedCharacter}
          isAutoMode={state.isAutoMode}
          setIsAutoMode={state.setIsAutoMode}
        />

        {/* Character Stats Modal */}
        {state.showStatsModal && (() => {
          const playerStats = state.statsHudRef.current?.getStats();
          if (!playerStats) return null;
          return (
            <CharacterStatsModal
              playerStats={playerStats}
              onClose={() => state.setShowStatsModal(false)}
              sendDistributeStat={state.sendDistributeStat}
            />
          );
        })()}

        {/* Dedicated Player Inventory */}
        {state.showInventoryModal && (() => {
          const playerStats = state.statsHudRef.current?.getStats();
          if (!playerStats) return null;
          return (
            <PlayerInventory
              playerStats={playerStats}
              onClose={() => state.setShowInventoryModal(false)}
              onOpenShop={() => {
                state.setShowInventoryModal(false);
                setShowShopModal(true);
              }}
              sendEquipItem={state.sendEquipItem}
              sendUseItem={state.sendUseItem}
              sendSellItem={state.sendSellItem}
              sendRefineItem={state.sendRefineItem}
            />
          );
        })()}

        {/* Dedicated Player Shop */}
        {showShopModal && (() => {
          const playerStats = state.statsHudRef.current?.getStats();
          if (!playerStats) return null;
          return (
            <PlayerShop
              playerStats={playerStats}
              onClose={() => setShowShopModal(false)}
              sendBuyItem={state.sendBuyItem}
            />
          );
        })()}

        {/* Dedicated Player Rewards */}
        {showRewardsModal && (() => {
          const playerStats = state.statsHudRef.current?.getStats();
          if (!playerStats) return null;
          return (
            <PlayerRewards
              playerStats={playerStats}
              onClose={() => setShowRewardsModal(false)}
              sendClaimDailyReward={state.sendClaimDailyReward}
            />
          );
        })()}

        {/* Dedicated Player Auction */}
        {showAuctionModal && (() => {
          const playerStats = state.statsHudRef.current?.getStats();
          if (!playerStats) return null;
          return (
            <PlayerAuction
              playerStats={playerStats}
              onClose={() => setShowAuctionModal(false)}
              sendGetAuctionItems={state.sendGetAuctionItems}
              sendListAuctionItem={state.sendListAuctionItem}
              sendBuyoutAuctionItem={state.sendBuyoutAuctionItem}
            />
          );
        })()}

        {/* Monster Editor Modal */}
        {state.showEnemyEditorModal && (
          <MonsterEditorModal
            monsterConfigs={state.monsterConfigs}
            editingMonster={state.editingMonster}
            setEditingMonster={state.setEditingMonster}
            errorMsg={state.errorMsg}
            successMsg={state.successMsg}
            onClose={() => state.setShowEnemyEditorModal(false)}
            handleSaveMonsterConfig={state.handleSaveMonsterConfig}
            handleDeleteMonsterConfig={state.handleDeleteMonsterConfig}
          />
        )}

        {/* Ragnarok settings Dashboard Grid Modal */}
        {showSettingsDashboard && (
          <SettingsDashboardModal
            onClose={() => setShowSettingsDashboard(false)}
            onOpenStats={() => state.setShowStatsModal(true)}
            onOpenInventory={() => state.setShowInventoryModal(true)}
          />
        )}
      </div>
    </div>
  );
}
