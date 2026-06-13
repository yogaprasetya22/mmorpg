/** Arena-specific constant values and label mappings. */

export const CLASS_LABELS: Record<string, string> = {
  Beginner: "Archer",
  Warrior: "Fighter",
  Mage: "Mage"
};

export const HAIR_COLORS = [
  "#5A3E2D", "#C8B195", "#A64B2A", "#1F2937",
  "#3B82F6", "#EAB308", "#10B981"
];

export const CLASS_OPTIONS = [
  { key: "Beginner", label: "Archer" },
  { key: "Warrior", label: "Fighter" },
  { key: "Mage", label: "Mage" }
];

export const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: "Fighter adalah petarung garis depan yang handal. Memiliki daya serang fisik luar biasa dan pertahanan tinggi dengan pedang besarnya.",
  Mage: "Mage menguasai sihir kuno. Mampu memberikan serangan jarak jauh ber-damage tinggi dengan sihir elemen badai api dan es.",
  Beginner: "Archer adalah penembak jitu jarak jauh. Memberikan serangan fisik beruntun yang presisi dari jarak aman."
};

/** Stat attributes displayed in the Character Stats Modal. */
export const STAT_ATTRIBUTES = [
  { key: "str", label: "STR", name: "Strength", desc: "Meningkatkan Serangan Fisik" },
  { key: "agi", label: "AGI", name: "Agility", desc: "Meningkatkan Kecepatan Serang & Flee" },
  { key: "vit", label: "VIT", name: "Vitality", desc: "Meningkatkan Maks HP & Soft DEF" },
  { key: "int", label: "INT", name: "Intelligence", desc: "Meningkatkan Serangan Sihir & Maks MP" },
  { key: "dex", label: "DEX", name: "Dexterity", desc: "Meningkatkan Casting Speed & ASPD" },
  { key: "luk", label: "LUK", name: "Luck", desc: "Meningkatkan Critical Rate & Status Bonus" },
];

export const TALENT_ATTRIBUTES = [
  { key: "pow", label: "POW", name: "Power", desc: "Meningkatkan Status ATK & P.ATK (+1 per poin)" },
  { key: "sta", label: "STA", name: "Stamina", desc: "Meningkatkan RES (Fisik) (+1 per poin)" },
  { key: "wis", label: "WIS", name: "Wisdom", desc: "Meningkatkan M.RES (Sihir) (+1 per poin)" },
  { key: "spl", label: "SPL", name: "Spell", desc: "Meningkatkan Status MATK & S.MATK (+1 per poin)" },
  { key: "con", label: "CON", name: "Concentration", desc: "Meningkatkan HIT, FLEE, P.ATK & S.MATK (+2 HIT/FLEE, +1 P.ATK/S.MATK)" },
  { key: "crt", label: "CRT", name: "Creative", desc: "Meningkatkan H.PLUS & C.RATE (+1 H.PLUS/C.RATE)" },
];

/** Secondary combat stats displayed in the Character Stats Modal. */
export const COMBAT_STAT_FIELDS = [
  { label: "Serangan Fisik", key: "attack", fallback: 50 },
  { label: "Serangan Sihir", key: "magic_attack", fallback: 10 },
  { label: "Pertahanan Fisik", key: "defense", fallback: 10 },
  { label: "Pertahanan Sihir", key: "magic_defense", fallback: 10 },
  { label: "Akurasi (HIT)", key: "hit", fallback: 175 },
  { label: "Hindaran (FLEE)", key: "flee", fallback: 100 },
  { label: "Maks HP", key: "max_hp", fallback: 1000 },
  { label: "Maks MP", key: "max_mp", fallback: 200 },
  { label: "Critical Rate", key: "critical_rate", fallback: 0.05, format: "percent" },
  { label: "Perfect Dodge", key: "perfect_dodge", fallback: 1.0, format: "percent_direct" },
  { label: "Cast Reduction", key: "cast_time", fallback: 0.0, format: "cast_reduction" },
  { label: "Kecepatan Gerak", key: "speed", fallback: 5.0, format: "decimal" },
  { label: "P.ATK", key: "p_atk", fallback: 0 },
  { label: "S.MATK", key: "s_matk", fallback: 0 },
  { label: "RES", key: "res", fallback: 0 },
  { label: "M.RES", key: "m_res", fallback: 0 },
  { label: "Heal Plus", key: "h_plus", fallback: 0 },
  { label: "C.RATE", key: "c_rate", fallback: 0 },
];

/** GLTF model paths to preload at module scope. */
export const PRELOAD_MODELS = [
  '/assets/characters/npcs/Chef_Male.glb',
  '/assets/characters/npcs/Chef_Female.glb',
  '/assets/characters/npcs/Knight_Golden_Male.glb',
  '/assets/characters/npcs/Knight_Golden_Female.glb',
  '/assets/characters/npcs/Wizard.glb',
  '/assets/characters/npcs/Witch.glb',
  '/assets/characters/npcs/Viking_Male.glb',
  '/assets/characters/npcs/Viking_Female.glb',
  '/assets/characters/npcs/Ninja_Male.glb',
  '/assets/characters/npcs/Ninja_Female.glb',
  '/assets/characters/npcs/Knight_Male.glb',
  '/assets/characters/npcs/Cowboy_Female.glb',
  '/assets/characters/npcs/Goblin_Male.glb',
  '/assets/characters/npcs/Goblin_Female.glb',
  '/assets/characters/npcs/Zombie_Male.glb',
  '/assets/characters/npcs/Zombie_Female.glb',
];
