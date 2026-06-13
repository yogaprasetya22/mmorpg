/** Custom hook orchestrating all Arena game state: auth, WebSocket, profile polling, and combat. */
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWebSocketGame, GameStatePayload } from '@/src/hooks/useWebSocketGame';
import { useEditorStore } from '@/src/state/useEditorStore';
import { battleGrid } from '@/src/core/logic/combat/spatialGrid';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';
import { CLASS_CONFIG, INITIAL_SETTINGS } from '@/src/core/logic/combat/constants';
import { API_BASE_URL, WS_BASE_URL } from '@/src/core/config';
import type { GameChatRef, PlayerStatsHUDRef, GameStatusBarRef, DeathOverlayRef, QuestPanelRef } from './ArenaClient.types';

export function useArenaGameState() {
  const selectedMapId = useEditorStore(s => s.selectedMapId);
  const [envReady, setEnvReady] = useState(false);
  const [envFinished, setEnvFinished] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    if (!envReady) {
      setEnvFinished(false);
      setModelsReady(false);
    }
  }, [envReady]);

  useEffect(() => {
    if (envFinished && modelsReady) {
      setEnvReady(true);
    }
  }, [envFinished, modelsReady]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [characters, setCharacters] = useState<any[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);
  const [gameConfig, setGameConfig] = useState<any>(null);
  const [dpr] = useState(0.8); // Fixed DPR — dynamic scaling via PerformanceMonitor removed to reduce useFrame overhead

  // Customization & creation states
  const [isCreatingChar, setIsCreatingChar] = useState(false);
  const [charName, setCharName] = useState("");
  const [charClass, setCharClass] = useState("Warrior");
  const [charGender, setCharGender] = useState("Male");
  const [charHairStyle, setCharHairStyle] = useState(1);
  const [charHairColor, setCharHairColor] = useState("#5A3E2D");

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showEnemyEditorModal, setShowEnemyEditorModal] = useState(false);
  const [monsterConfigs, setMonsterConfigs] = useState<any[]>([]);
  const [editingMonster, setEditingMonster] = useState<any>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [showMiniActions, setShowMiniActions] = useState(false);
  const chatRef = useRef<GameChatRef>(null);

  // Isolated microservice refs
  const statsHudRef = useRef<PlayerStatsHUDRef>(null);
  const statusBarRef = useRef<GameStatusBarRef>(null);
  const deathOverlayRef = useRef<DeathOverlayRef>(null);
  const questPanelRef = useRef<QuestPanelRef>(null);

  const lastPlayerHp = useRef(0);
  const playerStatsRef = useRef({ hp: -1, maxHp: -1, mp: -1, maxMp: -1, gold: -1, level: -1, aspd: 150, xp: -1 });

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [activeRemotePlayers] = useState<{ id: string; username: string; class: string; gender: string }[]>([]);
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const activeRemotePlayersRef = useRef<{ id: string; username: string; class: string; gender: string }[]>([]);

  // ── Pre-initialize playerStatsRef when selectedCharacter changes ──
  useEffect(() => {
    if (selectedCharacter) {
      playerStatsRef.current = {
        ...playerStatsRef.current,
        hp: selectedCharacter.hp ?? playerStatsRef.current.hp,
        maxHp: selectedCharacter.max_hp ?? selectedCharacter.maxHp ?? playerStatsRef.current.maxHp,
        gold: selectedCharacter.gold ?? playerStatsRef.current.gold,
        level: selectedCharacter.level ?? playerStatsRef.current.level,
        xp: selectedCharacter.xp ?? playerStatsRef.current.xp,
        custom_avatar_url: selectedCharacter.custom_avatar_url ?? (selectedCharacter as any).customAvatarUrl,
        gender: selectedCharacter.gender || "Male",
        hair_style: selectedCharacter.hair_style ?? (selectedCharacter as any).hairStyle ?? 1,
        hair_color: selectedCharacter.hair_color ?? (selectedCharacter as any).hairColor ?? "#5A3E2D",
      } as any;
    }
  }, [selectedCharacter]);
  const lastRosterUpdate = useRef(0);

  const connectedPlayersRef = useRef<any[]>([]);
  const worldMonstersRef = useRef<any[]>([]);

  const settingsRef = useRef({
    potatoMode: false,
    globalHpMultiplier: 1.0,
    globalDamageMultiplier: 1.0,
    globalSpeedMultiplier: 1.0,
    globalAttackCooldown: 250,
    critChance: 0.2,
    mouseSensitivity: 0.002,
    vfxQuality: 'HIGH',
  });
  const simTimeRef = useRef(0);
  const damageQueue = useRef<any[]>([]);
  const mmSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const spellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const fighterSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const tankSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const assassinSpellsRef = useRef<any[]>(new Array(300).fill(null).map(() => ({ active: false })));
  const unitRegistryRef = useRef<UnitRuntimeData[]>([]);
  const lastBattleGridUpdate = useRef(0);
  const lastRemotePlayerHash = useRef("");

  // ── INITIALIZATION: Fetch config, classes, settings, recover session ──
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/initialize`);
        if (res.ok) {
          const data = await res.json();
          setGameConfig(data);
        }

        const resClasses = await fetch(`${API_BASE_URL}/api/config/classes`);
        if (resClasses.ok) {
          const dataClasses = await resClasses.json();
          dataClasses.forEach((row: any) => {
            const classKey = row.id as keyof typeof CLASS_CONFIG;
            if (CLASS_CONFIG[classKey]) {
              CLASS_CONFIG[classKey] = {
                hp: row.hp, hp_regen: row.hp_regen, atk: row.atk,
                physical_defense: row.physical_defense, magic_defense: row.magic_defense,
                physical_pen: row.physical_pen, magic_pen: row.magic_pen,
                lifesteal: row.lifesteal, spell_vamp: row.spell_vamp,
                move_speed_mult: row.move_speed_mult, attack_speed_mult: row.attack_speed_mult,
                crit_chance: row.crit_chance, crit_damage: row.crit_damage,
                range: row.range, tenacity: row.tenacity,
                cooldown_reduction: row.cooldown_reduction, skill_cooldown: row.skill_cooldown,
                skill_range: row.skill_range, skill_duration: row.skill_duration,
                ai_behavior: {
                  separation: row.ai_separation, encirclement: row.ai_encirclement,
                  swagger: row.ai_swagger, perception_radius: row.ai_perception_radius,
                  chase_range: row.ai_chase_range,
                }
              };
            }
          });
          console.log("🎮 CLASS_CONFIG dynamically synced from database!", CLASS_CONFIG);
        }

        try {
          await useEditorStore.getState().fetchMapList();
        } catch (e) {
          console.warn("Failed to fetch map list on mount:", e);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get("room");

        const resSettings = await fetch(`${API_BASE_URL}/api/config/settings`);
        if (resSettings.ok) {
          const dataSettings = await resSettings.json();
          Object.assign(INITIAL_SETTINGS, dataSettings);
          console.log("🎮 INITIAL_SETTINGS dynamically synced from database!", INITIAL_SETTINGS);
          
          const targetMapId = roomParam || dataSettings.activeMapId;
          if (targetMapId) {
            console.log(`🎮 Setting active map: ${targetMapId} (room parameter override: ${!!roomParam})`);
            if (useEditorStore.getState().selectedMapId !== targetMapId) {
              await useEditorStore.getState().setSelectedMapId(targetMapId);
            } else {
              await useEditorStore.getState().loadFromDatabase();
            }
          }
        }
      } catch (err) {
        console.error("Gagal memuat konfigurasi aset game dari backend", err);
      }
    };
    fetchConfig();

    const savedToken = localStorage.getItem("game_auth_token");
    if (savedToken) {
      setIsRecoveringSession(true);
      setToken(savedToken);
      setSuccessMsg("Mengembalikan sesi login aktif...");
    }
  }, []);

  // ── FETCH CHARACTERS when token changes ──
  useEffect(() => {
    if (!token) {
      setIsRecoveringSession(false);
      return;
    }

    const fetchCharacters = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/player/characters`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const charList = data.characters || [];
          setCharacters(charList);

          if (charList.length === 0) {
            setIsCreatingChar(true);
            setIsRecoveringSession(false);
          } else {
            setIsCreatingChar(false);
            const savedCharId = localStorage.getItem("game_active_char_id");
            if (savedCharId) {
              const matchedChar = charList.find((c: any) => c.id === savedCharId);
              if (matchedChar) {
                setEnvReady(false);
                setSelectedCharacter(matchedChar);
                setSuccessMsg("Sesi karakter dikembalikan!");
                setIsRecoveringSession(false);
              } else {
                setIsRecoveringSession(false);
              }
            } else {
              setIsRecoveringSession(false);
            }
          }
        } else if (res.status === 401) {
          handleLogout();
          setIsRecoveringSession(false);
        } else {
          setIsRecoveringSession(false);
        }
      } catch (err) {
        console.error("Gagal mengambil daftar karakter", err);
        setIsRecoveringSession(false);
      }
    };

    fetchCharacters();
  }, [token]);

  // ── WEBSOCKET: Connect to Go server ──
  const { 
    sendPlayerState, 
    sendPlayerAttack, 
    sendPlayerSkill, 
    sendDistributeStat, 
    sendChatMessage,
    sendEquipItem,
    sendUseItem,
    sendBuyItem,
    sendSellItem,
    sendRefineItem
  } = useWebSocketGame(
    WS_BASE_URL,
    token,
    selectedCharacter?.id || "",
    (payload: GameStatePayload) => {
      const packetReceivedTime = performance.now();
      for (let i = 0; i < payload.players.length; i++) {
        (payload.players[i] as any).receivedAt = packetReceivedTime;
      }
      for (let i = 0; i < payload.monsters.length; i++) {
        (payload.monsters[i] as any).receivedAt = packetReceivedTime;
      }

      connectedPlayersRef.current = payload.players;
      worldMonstersRef.current = payload.monsters;

      const me = payload.players.find(p => p.id === (selectedCharacter?.id || ""));
      if (me && typeof (me as any).hp !== "undefined") {
        const rawHP = (me as any).hp;
        const rawMaxHP = (me as any).maxHp;
        const rawGold = (me as any).gold;
        const rawLevel = (me as any).level;
        const rawASPD = (me as any).aspd ?? 150;
        
        playerStatsRef.current.aspd = rawASPD;
        const rawMP = (me as any).mp ?? 50;
        const rawMaxMP = (me as any).maxMp ?? 50;

        if (playerStatsRef.current.hp !== rawHP || 
            playerStatsRef.current.maxHp !== rawMaxHP ||
            playerStatsRef.current.mp !== rawMP ||
            playerStatsRef.current.maxMp !== rawMaxMP) {
          
          if (lastPlayerHp.current > 0 && rawHP < lastPlayerHp.current) {
            (window as any).triggerCameraShake?.(0.35);
          }
          lastPlayerHp.current = rawHP;
          playerStatsRef.current.hp = rawHP;
          playerStatsRef.current.maxHp = rawMaxHP;
          playerStatsRef.current.mp = rawMP;
          playerStatsRef.current.maxMp = rawMaxMP;
          (playerStatsRef.current as any).max_hp = rawMaxHP;
          
          statsHudRef.current?.updateHpMp(rawHP, rawMaxHP, rawMP, rawMaxMP);
          deathOverlayRef.current?.setDead(rawHP <= 0);
        }

        // Real-time stats sync via WebSocket — no more waiting for 5s HTTP profile poll
        const rawXP = (me as any).xp ?? 0;
        const currentStats = playerStatsRef.current as any;
        
        const wsStats = {
          hp: rawHP,
          max_hp: rawMaxHP,
          maxHp: rawMaxHP,
          gold: rawGold,
          level: rawLevel,
          xp: rawXP,
          aspd: rawASPD,
          custom_avatar_url: (me as any).custom_avatar_url,
          gender: (me as any).gender,
          hair_style: (me as any).hair_style,
          hair_color: (me as any).hair_color,
          
          // Talent Stats
          base_pow: (me as any).base_pow,
          base_sta: (me as any).base_sta,
          base_wis: (me as any).base_wis,
          base_spl: (me as any).base_spl,
          base_con: (me as any).base_con,
          base_crt: (me as any).base_crt,
          talent_points: (me as any).talent_points,

          // Amplified Substats
          p_atk: (me as any).p_atk,
          s_matk: (me as any).s_matk,
          res: (me as any).res,
          m_res: (me as any).m_res,
          h_plus: (me as any).h_plus,
          c_rate: (me as any).c_rate,

          // Base Primary Stats
          base_str: (me as any).base_str,
          base_agi: (me as any).base_agi,
          base_vit: (me as any).base_vit,
          base_int: (me as any).base_int,
          base_dex: (me as any).base_dex,
          base_luk: (me as any).base_luk,
          stat_points: (me as any).stat_points,

          // Derived Combat Stats
          attack: (me as any).attack,
          magic_attack: (me as any).magic_attack,
          defense: (me as any).defense,
          magic_defense: (me as any).magic_defense,
          critical_rate: (me as any).critical_rate,
          speed: (me as any).speed,
          hit: (me as any).hit,
          flee: (me as any).flee,
          perfect_dodge: (me as any).perfect_dodge,
          cast_time: (me as any).cast_time,
          debuff: (me as any).debuff,
        };

        let changed = false;
        for (const key in wsStats) {
          if (currentStats[key] !== (wsStats as any)[key]) {
            changed = true;
            break;
          }
        }

        if (changed) {
          Object.assign(currentStats, wsStats);
          statsHudRef.current?.updateStats(wsStats);
        }
      }

      const now = performance.now();
      if (now - lastRosterUpdate.current >= 1000) {
        lastRosterUpdate.current = now;
        const remotes = payload.players.filter(p => p.id !== (selectedCharacter?.id || ""));
        const nextHash = remotes.map(p => `${p.id}-${p.class}-${p.gender}`).join(",");
        if (lastRemotePlayerHash.current !== nextHash) {
          lastRemotePlayerHash.current = nextHash;
          const nextList = remotes.map(p => ({
            id: p.id, username: p.username || "",
            class: p.class || "Beginner", gender: p.gender || "Male"
          }));
          activeRemotePlayersRef.current = nextList;
          // Throttled parent state update is completely disabled to eliminate parent component re-renders (Canvas, UI HUD).
          // RemotePlayersRenderer now polls connectedPlayersRef directly and safely at 1Hz in a local effect.
          // setActiveRemotePlayers(nextList);
        }
      }

      if (now - lastBattleGridUpdate.current >= 200) {
        lastBattleGridUpdate.current = now;
        const mockUnits: UnitRuntimeData[] = payload.monsters.map((m) => {
          const visualPos = (window as any).monsterVisualPositions?.get(m.id);
          return {
            id: m.id, name: m.name, type: "enemy",
            isActive: !m.is_dead, isDying: m.is_dead,
            hp: m.hp, maxHp: m.max_hp,
            position: [visualPos ? visualPos.x : m.x, m.y, visualPos ? visualPos.z : m.z],
            level: m.type === "boss" ? 50 : 15, rarity: "common",
            class: "monster", poolIdx: 0,
            isAggro: m.target_player_id !== "",
          } as any;
        });
        unitRegistryRef.current = mockUnits;
        battleGrid.update(mockUnits);
      }
    },
    (sender: string, msg: string) => {
      chatRef.current?.appendMessage(sender, msg);
    }
  );

  // ── Authoritative Combat Damage Event Listener ──
  useEffect(() => {
    const onCombatDamage = (e: Event) => {
      const ev = (e as CustomEvent).detail;
      if (!ev) return;

      const targetId = ev.targetId;
      const isCrit = !!ev.isCrit;
      const isMiss = !!ev.isMiss;
      const isMagic = !!ev.isMagic;
      const damage = ev.damage;

      // Find target coordinates
      let targetX = 0, targetY = 1.0, targetZ = 0;
      if (ev.targetType === "monster") {
        const targetMonster = worldMonstersRef.current.find(m => m.id === targetId);
        if (targetMonster) {
          const visualPos = (window as any).monsterVisualPositions?.get(targetId);
          targetX = visualPos ? visualPos.x : targetMonster.x;
          targetY = targetMonster.y + 0.8;
          targetZ = visualPos ? visualPos.z : targetMonster.z;
        } else {
          return;
        }
      } else {
        const targetPlayer = connectedPlayersRef.current.find(p => p.id === targetId);
        if (targetPlayer) {
          targetX = targetPlayer.x;
          targetY = targetPlayer.y + 1.2;
          targetZ = targetPlayer.z;
        } else {
          return;
        }
      }

      if (damageQueue.current) {
        damageQueue.current.push({
          value: Math.round(damage),
          position: [targetX, targetY, targetZ],
          isCrit,
          isMagic,
          isMiss,
          color: isMiss ? "#90a4ae" : (isCrit ? "#ff3b30" : (isMagic ? "#00e5ff" : "#ffcc00")),
          timestamp: performance.now()
        });

        // Authoritative camera shakes synced with server hits
        if (isCrit) {
          (window as any).triggerCameraShake?.(0.5);
        } else if (!isMiss) {
          (window as any).triggerCameraShake?.(0.2);
        }
      }
    };

    window.addEventListener("combat_damage_event", onCombatDamage);
    return () => {
      window.removeEventListener("combat_damage_event", onCombatDamage);
    };
  }, []);

  // ── PROFILE POLLING: requestIdleCallback (DONT-TOUCH: never setInterval) ──
  useEffect(() => {
    if (!token || !selectedCharacter) return;

    let destroyed = false;
    let lastProfileFetch = 0;
    const PROFILE_FETCH_INTERVAL = 5000;

    const scheduleIdleFetch = () => {
      if (destroyed) return;

      const idleHandle = requestIdleCallback((deadline) => {
        if (destroyed) return;

        const now = performance.now();
        const timeSinceLast = now - lastProfileFetch;

        if (timeSinceLast >= PROFILE_FETCH_INTERVAL && deadline.timeRemaining() > 5) {
          lastProfileFetch = now;

          const pCount = (connectedPlayersRef.current?.length ?? 0) + 1;
          const mCount = worldMonstersRef.current?.filter((m: any) => !m.is_dead).length ?? 0;
          statusBarRef.current?.update(pCount, mCount);

          fetch(`${API_BASE_URL}/api/player/profile?character_id=${selectedCharacter.id}`, {
            headers: { "Authorization": `Bearer ${token}` },
            signal: AbortSignal.timeout(4000),
          })
            .then(async (response) => {
              if (destroyed) return;
              if (response.ok) {
                const data = await response.json();
                if (data.player) {
                  // Copy all server-authoritative properties to local ref so combat engine gets accurate stats
                  Object.assign(playerStatsRef.current, data.player);
                  // Ensure both camelCase and snake_case fields are kept in sync
                  playerStatsRef.current.maxHp = data.player.max_hp;
                  statsHudRef.current?.updateStats(data.player);
                  questPanelRef.current?.updateQuests(data.player.quests || []);
                }
              } else if (response.status === 401) {
                handleLogout();
              }
            })
            .catch(() => { /* Ignore — next tick retries */ });
        }

        if (!destroyed) {
          setTimeout(scheduleIdleFetch, 1000);
        }
      }, { timeout: 2000 });

      return idleHandle;
    };

    scheduleIdleFetch();

    return () => {
      destroyed = true;
    };
  }, [token, selectedCharacter]);

  // ── AUTH ACTIONS ──
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal melakukan autentikasi");
      }
      if (isLogin) {
        localStorage.setItem("game_auth_token", data.token);
        setIsRecoveringSession(true);
        setToken(data.token);
        setSuccessMsg("Selamat Datang! Mengambil daftar karakter...");
      } else {
        setSuccessMsg("Pendaftaran Sukses! Silakan masuk dengan akun Anda.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      setErrorMsg("Nama karakter tidak boleh kosong");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/player/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          name: charName.trim(), class: charClass, gender: charGender,
          hair_style: charHairStyle, hair_color: charHairColor,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat karakter");

      setSuccessMsg("Karakter berhasil dibuat! Memasuki Arena...");
      setCharName("");
      const resList = await fetch(`${API_BASE_URL}/api/player/characters`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resList.ok) {
        const dataList = await resList.json();
        setCharacters(dataList.characters || []);
      }
      if (data.player && data.player.id) {
        localStorage.setItem("game_active_char_id", data.player.id);
      }
      setSelectedCharacter(data.player);
      setIsCreatingChar(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat karakter");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchCharacter = async () => {
    localStorage.removeItem("game_active_char_id");
    setSelectedCharacter(null);
    statsHudRef.current?.updateStats({ hp: 100, max_hp: 100, mp: 50, max_mp: 50, level: 1, gold: 0, username: "Hero" });
    playerStatsRef.current = { hp: -1, maxHp: -1, mp: -1, maxMp: -1, gold: -1, level: -1, aspd: 150, xp: -1 };
    questPanelRef.current?.updateQuests([]);
    setIsCreatingChar(false);
    setSuccessMsg("");
    setErrorMsg("");
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/player/characters`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCharacters(data.characters || []);
        }
      } catch (e) {
        console.error("Gagal memperbarui daftar karakter:", e);
      }
    }
  };

  const fetchMonsterConfigs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/monsters`);
      if (res.ok) {
        const data = await res.json();
        setMonsterConfigs(data || []);
      }
    } catch (e) {
      console.error("Gagal memuat konfigurasi monster:", e);
    }
  };

  const handleSaveMonsterConfig = async (config: any) => {
    try {
      setErrorMsg("");
      const res = await fetch(`${API_BASE_URL}/api/config/monsters`, {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSuccessMsg("Konfigurasi monster berhasil disimpan ke database!");
        fetchMonsterConfigs();
        setEditingMonster(null);
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Gagal menyimpan konfigurasi");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal menghubungi server");
    }
  };

  const handleDeleteMonsterConfig = async (type: string) => {
    try {
      setErrorMsg("");
      const res = await fetch(`${API_BASE_URL}/api/config/monsters/${type}`, { 
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      if (res.ok) {
        setSuccessMsg("Konfigurasi monster berhasil dihapus dari database!");
        fetchMonsterConfigs();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || "Gagal menghapus konfigurasi");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal menghapus monster");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("game_auth_token");
    localStorage.removeItem("game_active_char_id");
    setToken("");
    setSelectedCharacter(null);
    statsHudRef.current?.updateStats({ hp: 100, max_hp: 100, mp: 50, max_mp: 50, level: 1, gold: 0, username: "Hero" });
    playerStatsRef.current = { hp: -1, maxHp: -1, mp: -1, maxMp: -1, gold: -1, level: -1, aspd: 150, xp: -1 };
    questPanelRef.current?.updateQuests([]);
    setCharacters([]);
    setIsCreatingChar(false);
    connectedPlayersRef.current = [];
    worldMonstersRef.current = [];
    setSuccessMsg("");
  };

  const handleAuthoritativeAttack = (monsterId: string, damage?: number, isCrit?: boolean) => {
    sendPlayerAttack("monster", monsterId, damage, isCrit);
  };

  const localPlayerModelPath = useMemo(() => {
    if (selectedCharacter && gameConfig && gameConfig.character_models) {
      const genderModels = gameConfig.character_models[selectedCharacter.gender] || gameConfig.character_models["Male"];
      const path = genderModels[selectedCharacter.class];
      if (path) return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    }
    return `${API_BASE_URL}/assets-model/Chef_Male.glb`;
  }, [selectedCharacter, gameConfig]);

  return {
    // State
    selectedMapId, envReady, setEnvReady, envFinished, setEnvFinished,
    modelsReady, setModelsReady,
    username, setUsername, password, setPassword,
    token, isLogin, setIsLogin, loading, errorMsg, setErrorMsg,
    successMsg, setSuccessMsg, isRecoveringSession,
    characters, selectedCharacter, setSelectedCharacter,
    gameConfig, dpr,
    isCreatingChar, setIsCreatingChar,
    charName, setCharName, charClass, setCharClass,
    charGender, setCharGender, charHairStyle, setCharHairStyle,
    charHairColor, setCharHairColor,
    showStatsModal, setShowStatsModal,
    showInventoryModal, setShowInventoryModal,
    showEnemyEditorModal, setShowEnemyEditorModal,
    monsterConfigs, editingMonster, setEditingMonster,
    isAutoMode, setIsAutoMode, showMiniActions, setShowMiniActions,

    // Refs
    chatRef, statsHudRef, statusBarRef, deathOverlayRef, questPanelRef,
    connectedPlayersRef, worldMonstersRef, settingsRef,
    damageQueue, mmSpellsRef, spellsRef, fighterSpellsRef,
    tankSpellsRef, assassinSpellsRef, unitRegistryRef, simTimeRef,
    activeRemotePlayers, playerStatsRef,

    // Actions
    handleAuthSubmit, handleCreateCharacter, handleSwitchCharacter,
    handleLogout, handleAuthoritativeAttack,
    fetchMonsterConfigs, handleSaveMonsterConfig, handleDeleteMonsterConfig,
    localPlayerModelPath,

    // WebSocket
    sendPlayerState, sendPlayerAttack, sendPlayerSkill, sendDistributeStat, sendChatMessage,
    sendEquipItem, sendUseItem, sendBuyItem, sendSellItem, sendRefineItem,
  };
}
