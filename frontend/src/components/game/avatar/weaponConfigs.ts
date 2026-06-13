export interface WeaponOffset {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  hand: "left" | "right";
}

// Permanent configuration for each weapon type
export const weaponConfigs: Record<string, WeaponOffset> = {
    asset_weapon_sword: {
        position: [-33.5, -9.8, -7.22],
        rotation: [-6.28, -3.43, -5.2],
        scale: [3.2, 3.2, 3.2],
        hand: "right",
    },
    asset_weapon_scythe: {
        position: [-15.0, 26.9, 7.05],
        rotation: [6.6, 9.4, 2.0],
        scale: [3.1, 3.1, 3.1],
        hand: "right",
    },
    asset_weapon_hammer: {
        position: [0.0, -0.05, 0.05],
        rotation: [1.6, 3.14, 0.0],
        scale: [1.0, 1.0, 1.0],
        hand: "right",
    },
    asset_weapon_bow: {
        position: [84.93, -6.9, 14.08],
        rotation: [-0.08, -0.07, 1.45],
        scale: [3.2, 3.2, 3.2],
        hand: "left",
    },
    asset_weapon_axe: {
        position: [0.0, -0.08, 0.05],
        rotation: [1.6, 3.14, 0.0],
        scale: [1.0, 1.0, 1.0],
        hand: "right",
    },
    asset_weapon_arrow: {
        position: [35.59, 7.47, 6.75],
        rotation: [-2.49, 0.1, 1.65],
        scale: [1.23, 1.36, 1.36],
        hand: "right",
    },
};

// Maps weapon category (from backend) to the visual weapon asset ID and GLB file
export const classWeaponMap: Record<string, { assetId: string; filename: string }> = {
  "sword":  { assetId: "asset_weapon_sword",   filename: "Sword.glb" },
  "staff":  { assetId: "asset_weapon_scythe",  filename: "Battle_Scythe.glb" },
  "bow":    { assetId: "asset_weapon_bow",     filename: "Battle_Bow.glb" },
  "mace":   { assetId: "asset_weapon_hammer",  filename: "Battle_Hammer.glb" },
  "dagger": { assetId: "asset_weapon_scythe",  filename: "Battle_Scythe.glb" },
};

// Maps player class to default weapon category (used when no weapon_category is available)
export const classToWeaponCategory: Record<string, string> = {
  "Warrior": "sword",
  "Mage":    "staff",
  "Beginner": "bow",
  "Priest":  "mace",
  "Thief":   "dagger",
};

// Arrow asset config for Archer dual-weapon rendering (bow in left + arrow in right)
export const ARCHER_ARROW_ASSET = {
  id: "asset_weapon_arrow",
  name: "Arrow",
  group: "cat_weapon",
  url: "/assets/items/weapons/Arrow.glb",
  thumbnail: "",
};

// Helper to get customized weapon offset from localStorage or fallback to defaults
export const getWeaponConfig = (assetId: string): WeaponOffset => {
  const defaultOffset = weaponConfigs[assetId];
  if (!defaultOffset) {
    return {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      hand: "right"
    };
  }
  if (typeof window === "undefined") return defaultOffset;
  try {
    const saved = localStorage.getItem(`weapon_offset_${assetId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.position) && Array.isArray(parsed.rotation) && Array.isArray(parsed.scale)) {
        return {
          ...defaultOffset,
          position: parsed.position,
          rotation: parsed.rotation,
          scale: parsed.scale,
          hand: parsed.hand || defaultOffset.hand,
        };
      }
    }
  } catch (e) {
    console.warn("Failed to load customized weapon offset:", e);
  }
  return defaultOffset;
};

export interface ProjectileSpawnConfig {
  launchY: number;
  forwardOffset: number;
}

export const projectileSpawnConfigs: Record<string, ProjectileSpawnConfig> = {
  Beginner: {
    launchY: -1.1,       // Height of the arrow spawn point (aligned with bow)
    forwardOffset: 2.2, // Closer to character body (horizontal distance)
  },
  Mage: {
    launchY: 1.35,
    forwardOffset: 0.7,
  },
  default: {
    launchY: 1.35,
    forwardOffset: 0.7,
  }
};

export const getProjectileSpawnConfig = (playerClass: string): ProjectileSpawnConfig => {
  return projectileSpawnConfigs[playerClass] || projectileSpawnConfigs.default;
};

