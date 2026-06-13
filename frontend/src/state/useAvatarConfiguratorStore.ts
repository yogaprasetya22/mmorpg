'use client';

import { create } from "zustand";
import { MeshStandardMaterial } from "three";
import { randInt } from "three/src/math/MathUtils.js";
import { API_BASE_URL } from "@/src/core/config";

export const PHOTO_POSES = {
  Idle: "Idle",
  Chill: "Chill",
  Cool: "Cool",
  Drama: "Drama",
  Busy: "Busy",
  Ninja: "Ninja",
  Punch: "Punch",
  HoldWeapon: "HoldWeapon",
  Run: "Run",
  Jogging: "Jogging",
  "Slow Run": "Slow Run",
  "Light Hit To Head": "Light Hit To Head",
  "Sword And Shield Death": "Sword And Shield Death",
} as const;

export type PhotoPose = typeof PHOTO_POSES[keyof typeof PHOTO_POSES];

export const UI_MODES = {
  PHOTO: "photo",
  CUSTOMIZE: "customize",
} as const;

export type UIMode = typeof UI_MODES[keyof typeof UI_MODES];

export interface CameraPlacement {
  position?: [number, number, number];
  target?: [number, number, number];
}

export interface ColorPalette {
  colors?: string[];
}

export interface AvatarAsset {
  id: string;
  name: string;
  group: string;
  lockedGroups?: string[];
  url: string;
  thumbnail: string;
}

export interface AvatarCategory {
  id: string;
  name: string;
  position: number;
  assets: AvatarAsset[];
  removable: boolean;
  startingAsset?: string;
  expand?: {
    colorPalette?: ColorPalette;
    cameraPlacement?: CameraPlacement;
  };
}

export interface CustomizationItem {
  color: string;
  asset?: AvatarAsset | null;
}

export interface LockedGroupDetail {
  name: string;
  categoryName: string;
}

export interface AvatarConfiguratorStore {
  loading: boolean;
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  pose: PhotoPose;
  setPose: (pose: PhotoPose) => void;
  categories: AvatarCategory[];
  currentCategory: AvatarCategory | null;
  assets: AvatarAsset[];
  lockedGroups: Record<string, LockedGroupDetail[]>;
  skin: MeshStandardMaterial;
  customization: Record<string, CustomizationItem>;
  download: () => void;
  setDownload: (download: () => void) => void;
  screenshot: () => void;
  setScreenshot: (screenshot: () => void) => void;
  updateColor: (color: string) => void;
  updateSkin: (color: string) => void;
  fetchCategories: () => Promise<void>;
  setCurrentCategory: (category: AvatarCategory | null) => void;
  changeAsset: (category: string, asset: AvatarAsset | null) => void;
  randomize: () => void;
  applyLockedAssets: () => void;
  selectedWeaponId: string | null;
  setSelectedWeaponId: (id: string | null) => void;
  weaponGizmoMode: "translate" | "rotate" | "scale" | "none";
  setWeaponGizmoMode: (mode: "translate" | "rotate" | "scale" | "none") => void;
  weaponOffsetTrigger: number;
  triggerWeaponUpdate: () => void;
  weaponRefs: Record<string, any>;
  registerWeaponRef: (id: string, ref: any) => void;
  unregisterWeaponRef: (id: string) => void;
}

export const useAvatarConfiguratorStore = create<AvatarConfiguratorStore>((set, get) => ({
  loading: true,
  mode: UI_MODES.CUSTOMIZE,
  setMode: (mode) => {
    set({ mode });
    if (mode === UI_MODES.CUSTOMIZE) {
      set({ pose: PHOTO_POSES.Idle });
    }
  },
  pose: PHOTO_POSES.Idle,
  setPose: (pose) => set({ pose }),
  categories: [],
  currentCategory: null,
  assets: [],
  lockedGroups: {},
  skin: new MeshStandardMaterial({ color: 0xf5c6a5, roughness: 1 }),
  customization: {},
  download: () => {},
  setDownload: (download) => set({ download }),
  screenshot: () => {},
  setScreenshot: (screenshot) => set({ screenshot }),
  selectedWeaponId: null,
  setSelectedWeaponId: (id) => set({ selectedWeaponId: id }),
  weaponGizmoMode: "translate",
  setWeaponGizmoMode: (mode) => set({ weaponGizmoMode: mode }),
  weaponOffsetTrigger: 0,
  triggerWeaponUpdate: () => set((state) => ({ weaponOffsetTrigger: state.weaponOffsetTrigger + 1 })),
  weaponRefs: {},
  registerWeaponRef: (id, ref) => set((state) => ({
    weaponRefs: { ...state.weaponRefs, [id]: ref }
  })),
  unregisterWeaponRef: (id) => set((state) => {
    const next = { ...state.weaponRefs };
    delete next[id];
    return { weaponRefs: next };
  }),
  updateColor: (color) => {
    const currentCategory = get().currentCategory;
    if (!currentCategory) return;
    set((state) => ({
      customization: {
        ...state.customization,
        [currentCategory.name]: {
          ...state.customization[currentCategory.name],
          color,
        },
      },
    }));
    if (currentCategory.name === "Head") {
      get().updateSkin(color);
    }
  },
  updateSkin: (color) => {
    get().skin.color.set(color as any);
  },
  fetchCategories: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/avatar/categories`);
      if (!response.ok) {
        throw new Error(`Failed to fetch avatar categories: ${response.statusText}`);
      }
      const categories: AvatarCategory[] = await response.json();

      const customization: Record<string, CustomizationItem> = {};
      const assets: AvatarAsset[] = [];

      categories.forEach((category) => {
        if (category.assets) {
          assets.push(...category.assets);
        }

        customization[category.name] = {
          color: category.expand?.colorPalette?.colors?.[0] || "",
        };
        if (category.startingAsset && category.assets) {
          customization[category.name].asset = category.assets.find(
            (asset) => asset.id === category.startingAsset
          );
        }
      });

      const weaponAsset = customization["Weapon"]?.asset;
      set({
        categories,
        currentCategory: categories[0] || null,
        assets,
        customization,
        loading: false,
        selectedWeaponId: weaponAsset?.id || null,
      });
      get().applyLockedAssets();
    } catch (error) {
      console.error("Error loading avatar categories:", error);
      set({ loading: false });
    }
  },
  setCurrentCategory: (category) => set({ currentCategory: category }),
  changeAsset: (category, asset) => {
    set((state) => ({
      customization: {
        ...state.customization,
        [category]: {
          ...state.customization[category],
          asset,
        },
      },
      ...(category === "Weapon" ? { selectedWeaponId: asset?.id || null } : {}),
    }));
    get().applyLockedAssets();
  },
  randomize: () => {
    const customization: Record<string, CustomizationItem> = { ...get().customization };
    const categories = get().categories;
    categories.forEach((category) => {
      if (category.name === "Weapon") return;
      let randomAsset: AvatarAsset | null = null;
      if (category.assets.length > 0) {
        randomAsset = category.assets[randInt(0, category.assets.length - 1)];
        if (category.removable) {
          if (randInt(0, category.assets.length - 1) === 0) {
            randomAsset = null;
          }
        }
      }
      const colors = category.expand?.colorPalette?.colors || [];
      const randomColor = colors.length > 0 ? colors[randInt(0, colors.length - 1)] : "";
      customization[category.name] = {
        asset: randomAsset,
        color: randomColor,
      };
      if (category.name === "Head") {
        get().updateSkin(randomColor);
      }
    });
    set({ customization });
    get().applyLockedAssets();
  },

  applyLockedAssets: () => {
    const customization = get().customization;
    const categories = get().categories;
    const lockedGroups: Record<string, LockedGroupDetail[]> = {};

    Object.values(customization).forEach((categoryVal) => {
      const asset = categoryVal.asset;
      if (asset?.lockedGroups) {
        asset.lockedGroups.forEach((group) => {
          const foundCategory = categories.find((cat) => cat.id === group);
          if (!foundCategory) return;
          const categoryName = foundCategory.name;
          if (!lockedGroups[categoryName]) {
            lockedGroups[categoryName] = [];
          }
          const foundLockingAsset = categories.find(
            (cat) => cat.id === asset.group
          );
          if (!foundLockingAsset) return;
          const lockingAssetCategoryName = foundLockingAsset.name;
          lockedGroups[categoryName].push({
            name: asset.name,
            categoryName: lockingAssetCategoryName,
          });
        });
      }
    });

    set({ lockedGroups });
  },
}));
