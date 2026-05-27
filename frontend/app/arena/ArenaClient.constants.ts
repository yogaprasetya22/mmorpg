/** Arena-specific constant values and label mappings. */

export const CLASS_LABELS: Record<string, string> = {
  Beginner: "MM",
  Warrior: "Fighter",
  Mage: "Mage",
  Priest: "Tank",
  Thief: "Assassin"
};

export const HAIR_COLORS = [
  "#5A3E2D", "#C8B195", "#A64B2A", "#1F2937",
  "#3B82F6", "#EAB308", "#10B981"
];

export const CLASS_OPTIONS = [
  { key: "Beginner", label: "MM" },
  { key: "Warrior", label: "Fighter" },
  { key: "Mage", label: "Mage" },
  { key: "Priest", label: "Tank" },
  { key: "Thief", label: "Assassin" }
];

export const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: "Fighter adalah petarung garis depan yang handal. Memiliki daya serang fisik luar biasa dan pertahanan tinggi dengan pedang besarnya.",
  Mage: "Mage menguasai sihir kuno. Mampu memberikan serangan jarak jauh ber-damage tinggi dengan sihir elemen badai api dan es.",
  Priest: "Tank adalah pelindung garis depan yang kokoh. Mampu menyerap kerusakan besar dan memberikan perlindungan suci bagi tim.",
  Thief: "Assassin menyerang dari bayangan dengan kelincahan penuh. Memiliki kecepatan serang tertinggi dan peluang kritikal tebasan belati mematikan.",
  Beginner: "MM (Marksman) adalah penembak jitu jarak jauh. Memberikan serangan fisik beruntun yang presisi dari jarak aman."
};

/** Stat attributes displayed in the Character Stats Modal. */
export const STAT_ATTRIBUTES = [
  { key: "str", label: "STR", name: "Strength", desc: "Meningkatkan Serangan Fisik" },
  { key: "int", label: "INT", name: "Intelligence", desc: "Meningkatkan Serangan Sihir & Maks MP" },
  { key: "con", label: "CON", name: "Constitution", desc: "Meningkatkan Maks HP & Pertahanan Fisik" },
  { key: "vit", label: "VIT", name: "Vitality", desc: "Meningkatkan Maks HP & Pertahanan Utama" },
  { key: "wis", label: "WIS", name: "Wisdom", desc: "Meningkatkan Maks MP & Pertahanan Sihir" },
  { key: "luk", label: "LUK", name: "Luck", desc: "Meningkatkan Critical Rate & Speed" },
];

/** Secondary combat stats displayed in the Character Stats Modal. */
export const COMBAT_STAT_FIELDS = [
  { label: "Serangan Fisik", key: "attack", fallback: 50 },
  { label: "Serangan Sihir", key: "magic_attack", fallback: 10 },
  { label: "Pertahanan Fisik", key: "defense", fallback: 10 },
  { label: "Pertahanan Sihir", key: "magic_defense", fallback: 10 },
  { label: "Maks HP", key: "max_hp", fallback: 1000 },
  { label: "Maks MP", key: "max_mp", fallback: 200 },
  { label: "Critical Rate", key: "critical_rate", fallback: 0.05, format: "percent" },
  { label: "Kecepatan Gerak", key: "speed", fallback: 5.0, format: "decimal" },
];

/** GLTF model paths to preload at module scope. */
export const PRELOAD_MODELS = [
  '/assets-model/Chef_Male.glb',
  '/assets-model/Chef_Female.glb',
  '/assets-model/Knight_Golden_Male.glb',
  '/assets-model/Knight_Golden_Female.glb',
  '/assets-model/Wizard.glb',
  '/assets-model/Witch.glb',
  '/assets-model/Viking_Male.glb',
  '/assets-model/Viking_Female.glb',
  '/assets-model/Ninja_Male.glb',
  '/assets-model/Ninja_Female.glb',
  '/assets-model/Knight_Male.glb',
  '/assets-model/Cowboy_Female.glb',
  '/assets-model/Goblin_Male.glb',
  '/assets-model/Goblin_Female.glb',
  '/assets-model/Zombie_Male.glb',
  '/assets-model/Zombie_Female.glb',
];
