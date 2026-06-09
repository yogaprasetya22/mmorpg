export interface WeaponOffset {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

// Permanent configuration for each weapon type
export const weaponConfigs: Record<string, WeaponOffset> = {
  "asset_weapon_sword": {
    position: [-25.0, 10.95, 14.03],
    rotation: [2.6, 9.14, 8.0],
    scale: [3.2, 3.2, 3.2],
  },
  "asset_weapon_scythe": {
    position: [-15.0, 26.9, 7.05],
    rotation: [6.6, 9.4, 2.0],
    scale: [3.1, 3.1, 3.1],
  },
  "asset_weapon_hammer": {
    position: [0.0, -0.05, 0.05],
    rotation: [1.6, 3.14, 0.0],
    scale: [1.0, 1.0, 1.0],
  },
  "asset_weapon_bow": {
    position: [0.05, -0.05, 0.0],
    rotation: [0.0, 1.57, 1.57],
    scale: [1.0, 1.0, 1.0],
  },
  "asset_weapon_axe": {
    position: [0.0, -0.08, 0.05],
    rotation: [1.6, 3.14, 0.0],
    scale: [1.0, 1.0, 1.0],
  },
  "asset_weapon_arrow": {
    position: [0.0, 0.0, 0.0],
    rotation: [0.0, 0.0, 0.0],
    scale: [1.0, 1.0, 1.0],
  },
};
