/** ArenaClient — thin page-level wrapper composing all Arena sub-modules. */
'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { PlayerController, keyboardMap } from '@/src/components/game/PlayerController';
import { RemotePlayersRenderer } from '@/src/components/game/RemotePlayersRenderer';
import { RemoteMonstersRenderer } from '@/src/components/game/RemoteMonstersRenderer';
import { Minimap } from '@/src/components/game/Minimap';
import { EnvironmentMultiGlobal } from '@/src/components/game/environment/EnvironmentMultiGlobal';
import { ModularMap } from '@/src/components/game/environment/ModularMap';
import { VFXProvider } from '@/src/components/game/systems/VFXManager';
import { DamageHUDBatcher } from '@/src/components/game/systems/DamageHUDBatcher';
import { MMSpellEffect } from '@/src/components/game/systems/effects/MMSpellEffect';
import { FighterSpellEffect } from '@/src/components/game/systems/effects/FighterSpellEffect';
import { TankSpellEffect } from '@/src/components/game/systems/effects/TankSpellEffect';
import { AssassinSpellEffect } from '@/src/components/game/systems/effects/AssassinSpellEffect';
import { MageSpellEffect } from '@/src/components/game/systems/effects/MageSpellEffect';
import { Users, Sparkles, Skull, LogOut } from 'lucide-react';
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
import { MonsterEditorModal } from './components/MonsterEditorModal';
import { SkillBar } from './components/SkillBar';
import { QuestPanel } from './components/QuestPanel';

// Re-export types and constants for backward compatibility
export { CLASS_LABELS } from './ArenaClient.constants';
export type { GameChatRef, PlayerStatsHUDRef, GameStatusBarRef, DeathOverlayRef } from './ArenaClient.types';

/** Stub camera director (reserved for epic ending cinematics). */
const CameraDirector = () => null;

export default function MultiplayerArena() {
  const state = useArenaGameState();

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
            <ExposureBridge exposure={2.0} />

            <VFXProvider>
              <CameraDirector />
              <ModelsPreloader onReady={() => state.setModelsReady(true)} />

              <EnvironmentMultiGlobal
                settingsRef={state.settingsRef}
                debug={false}
                onReady={() => { setTimeout(() => { state.setEnvFinished(true); }, 600); }}
              />
              <ModularMap debug={false} />

              <MMSpellEffect spellsRef={state.mmSpellsRef} unitRegistry={state.unitRegistryRef} simTimeRef={state.simTimeRef} />
              <FighterSpellEffect fighterSpellsRef={state.fighterSpellsRef} simTimeRef={state.simTimeRef} />
              <TankSpellEffect tankSpellsRef={state.tankSpellsRef} simTimeRef={state.simTimeRef} unitRegistry={state.unitRegistryRef} />
              <AssassinSpellEffect assassinSpellsRef={state.assassinSpellsRef} simTimeRef={state.simTimeRef} />
              <MageSpellEffect spellsRef={state.spellsRef} unitRegistry={state.unitRegistryRef} simTimeRef={state.simTimeRef} />

              <DamageHUDBatcher damageQueue={state.damageQueue} />

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
                playerStats={state.playerStatsRef.current.hp >= 0 ? { hp: state.playerStatsRef.current.hp, max_hp: state.playerStatsRef.current.maxHp, aspd: (state.playerStatsRef.current as any).aspd } : undefined}
                playerStatsRef={state.playerStatsRef}
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
            </VFXProvider>

            {!state.settingsRef.current.potatoMode && (
              <EffectComposer enableNormalPass={false} multisampling={0}>
                <Bloom luminanceThreshold={1.0} mipmapBlur intensity={0.5} radius={0.4} />
                <ToneMapping adaptive={false} />
              </EffectComposer>
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
        <div id="facing-alignment-alert" className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500/90 backdrop-blur-md border border-amber-400/30 text-white font-black text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-2xl pointer-events-none opacity-0 flex items-center gap-2" style={{transition:'opacity 0.25s ease-in-out'}}>
          <span className="animate-pulse">🔄</span> MENYELARASKAN HADAP TARGET...
        </div>

        {/* Player Stats HUD (Isolated Microservice) */}
        <PlayerStatsHUD
          ref={state.statsHudRef}
          defaultUsername={state.selectedCharacter?.username || "Hero"}
          defaultLevel={state.selectedCharacter?.level || 1}
          onOpenStats={() => state.setShowStatsModal(true)}
        />

        {/* Top-Right: Minimap + Status + Menu */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2 pointer-events-auto">
          <Minimap
            connectedPlayersRef={state.connectedPlayersRef}
            worldMonstersRef={state.worldMonstersRef}
            localPlayerId={state.selectedCharacter?.id || ""}
            mapId={state.selectedMapId || "Starter Zone"}
          />
          <GameStatusBar ref={state.statusBarRef} />

          <button
            onClick={() => state.setShowMiniActions(v => !v)}
            className="bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-[8px] font-black text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all"
          >
            <span>☰</span> MENU
          </button>
          {state.showMiniActions && (
            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
              <button onClick={state.handleSwitchCharacter} className="bg-cyan-500/15 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-cyan-400 flex items-center gap-1.5 transition-all hover:bg-cyan-500/25">
                <Users className="w-3 h-3" /> Ganti Kelas
              </button>
              <button onClick={async () => { const s = useEditorStore.getState(); let l = s.mapList; if (!l.length) { await s.fetchMapList(); l = s.mapList; } if (l.length > 1) { const i = l.findIndex(m => m.id === s.selectedMapId); state.setEnvReady(false); await s.setSelectedMapId(l[(i + 1) % l.length].id); } else { state.setEnvReady(false); await s.loadFromDatabase(); } }} className="bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-indigo-300 flex items-center gap-1.5 transition-all hover:bg-indigo-500/25">
                <Sparkles className="w-3 h-3" /> Ganti Peta
              </button>
              <button onClick={() => { state.fetchMonsterConfigs(); state.setShowEnemyEditorModal(true); state.setShowMiniActions(() => false); }} className="bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-amber-400 flex items-center gap-1.5 transition-all hover:bg-amber-500/25">
                <Skull className="w-3 h-3" /> Edit Monster
              </button>
              <button onClick={state.handleLogout} className="bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl text-[8.5px] font-black text-red-400 flex items-center gap-1.5 transition-all hover:bg-red-500/25">
                <LogOut className="w-3 h-3" /> Keluar
              </button>
            </div>
          )}
        </div>

        {/* Quest Panel */}
        <QuestPanel />

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
      </div>

      {/* Bottom EXP Bar */}
      <div className="absolute bottom-0 inset-x-0 h-1.5 bg-zinc-950 z-20 flex items-center pointer-events-auto border-t border-white/5">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ width: "40.98%" }}
        />
        <div className="absolute bottom-2 left-6 text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none drop-shadow">
          EXP 40.98%
        </div>
      </div>
    </div>
  );
}
