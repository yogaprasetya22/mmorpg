/** Shared TypeScript interfaces for the Arena game client sub-components. */

export interface GameChatRef {
  appendMessage: (sender: string, msg: string) => void;
}

export interface PlayerStatsHUDRef {
  updateStats: (stats: any) => void;
  updateHpMp: (hp: number, maxHp: number) => void;
  getStats: () => any;
}

export interface GameStatusBarRef {
  update: (playerCount: number, aliveMonsterCount: number) => void;
}

export interface DeathOverlayRef {
  setDead: (isDead: boolean) => void;
}

export interface ArenaGameState {
  // Auth
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  token: string;
  setToken: (v: string) => void;
  isLogin: boolean;
  setIsLogin: (v: boolean) => void;
  loading: boolean;
  errorMsg: string;
  setErrorMsg: (v: string) => void;
  successMsg: string;
  setSuccessMsg: (v: string) => void;
  isRecoveringSession: boolean;

  // Character
  characters: any[];
  selectedCharacter: any;
  setSelectedCharacter: (v: any) => void;
  isCreatingChar: boolean;
  setIsCreatingChar: (v: boolean) => void;
  charName: string;
  setCharName: (v: string) => void;
  charClass: string;
  setCharClass: (v: string) => void;
  charGender: string;
  setCharGender: (v: string) => void;
  charHairStyle: number;
  setCharHairStyle: (v: number) => void;
  charHairColor: string;
  setCharHairColor: (v: string) => void;

  // Game config
  gameConfig: any;
  dpr: number;
  setDpr: (v: number) => void;
  envReady: boolean;
  setEnvReady: (v: boolean) => void;
  envFinished: boolean;
  setEnvFinished: (v: boolean) => void;
  modelsReady: boolean;
  setModelsReady: (v: boolean) => void;

  // Modals
  showStatsModal: boolean;
  setShowStatsModal: (v: boolean) => void;
  showEnemyEditorModal: boolean;
  setShowEnemyEditorModal: (v: boolean) => void;
  monsterConfigs: any[];
  editingMonster: any;
  setEditingMonster: (v: any) => void;
  isAutoMode: boolean;
  setIsAutoMode: (v: (prev: boolean) => boolean) => void;
  showMiniActions: boolean;
  setShowMiniActions: (v: (prev: boolean) => boolean) => void;

  // Refs
  chatRef: React.RefObject<GameChatRef>;
  statsHudRef: React.RefObject<PlayerStatsHUDRef>;
  statusBarRef: React.RefObject<GameStatusBarRef>;
  deathOverlayRef: React.RefObject<DeathOverlayRef>;
  connectedPlayersRef: React.RefObject<any[]>;
  worldMonstersRef: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  damageQueue: React.RefObject<any[]>;
  mmSpellsRef: React.RefObject<any[]>;
  spellsRef: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  unitRegistryRef: React.RefObject<any[]>;
  simTimeRef: React.RefObject<number>;
  activeRemotePlayers: { id: string; username: string; class: string; gender: string }[];

  // Actions
  handleAuthSubmit: (e: React.FormEvent) => void;
  handleCreateCharacter: (e: React.FormEvent) => void;
  handleSwitchCharacter: () => void;
  handleLogout: () => void;
  handleAuthoritativeAttack: (monsterId: string, damage?: number, isCrit?: boolean) => void;
  fetchMonsterConfigs: () => void;
  handleSaveMonsterConfig: (config: any) => void;
  handleDeleteMonsterConfig: (type: string) => void;
  localPlayerModelPath: string;
  playerStatsRef: React.RefObject<{ hp: number; maxHp: number }>;

  // WebSocket
  sendPlayerState: any;
  sendPlayerAttack: any;
  sendDistributeStat: any;
  sendChatMessage: any;
}
