// Global window augmentations for shared cross-component communication.
// All modules that read/write window globals must declare their types here.
// Avoid `(window as any)` — use `(window as WindowWithGameGlobals)` instead.

interface Window {
    /** Whether any modal is open — set by ArenaClient for input hook gating. */
    isModalOpen: boolean;

    /** Reference to PlayerStatsHUD for external updates (mana/hp sync). */
    statsHudRef: React.MutableRefObject<{
        updateHpMp(hp: number, maxHp: number, mp: number, maxMp: number): void;
        updateStats(s: Record<string, unknown>): void;
        getStats(): Record<string, unknown> | null;
    } | null> | null;

    /** Camera shake trigger exposed by PlayerCamera. */
    triggerCameraShake?(intensity: number): void;

    /** Map of monster IDs to their smoothed visual positions. */
    monsterVisualPositions?: Map<string, { x: number; y: number; z: number }>;

    /** Track last client-predicted hit times per target ID for dedup. */
    _lastClientHitTime?: Record<string, number>;

    /** Unstuck position override set by SettingsDashboard. */
    localPlayerPos?: { x: number; y: number; z: number };

    /** Last computed skill key dispatch, read by PlayerController. */
    __pendingSkillKey?: string;

    /** Pending archer skill key dispatch. */
    __pendingArcherSkillKey?: string;

    /** Last inventory snapshot for PlayerInventory initial state. */
    lastInventory?: Record<string, unknown>[];

    /** Archer skill cooldown map. */
    archerSkillCDs?: Record<string, number>;

    /** Callback to close settings modal from child components. */
    __closeSettingsDashboard?: () => void;
}
