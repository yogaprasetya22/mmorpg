/**
 * Selection slice — manages selected item state.
 *
 * Location: frontend/src/editor/app/store/slices/selection.slice.ts
 */

import type { StateCreator } from "zustand";

export interface SelectionSlice {
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    toggleSelectedId: (id: string) => void;
    mode: "translate" | "rotate" | "scale";
    setMode: (mode: "translate" | "rotate" | "scale") => void;
    gridSize: number;
    setGridSize: (size: number) => void;
    gridEnabled: boolean;
    setGridEnabled: (enabled: boolean) => void;
    activeAsset: import("@jagres/shared").AssetInfo | null;
    setActiveAsset: (asset: import("@jagres/shared").AssetInfo | null) => void;
}

export const createSelectionSlice: StateCreator<
    SelectionSlice,
    [],
    [],
    SelectionSlice
> = (set) => ({
    selectedId: null,
    setSelectedId: (id) =>
        set({
            selectedId: id,
            selectedIds: id ? [id] : [],
            paintMode: id === "terrain" ? true : false,
        } as any),
    selectedIds: [],
    setSelectedIds: (ids) =>
        set({
            selectedIds: ids,
            selectedId: ids.length > 0 ? ids[ids.length - 1] : null,
            paintMode:
                ids.length > 0 && ids[ids.length - 1] === "terrain"
                    ? true
                    : false,
        } as any),
    toggleSelectedId: (id) =>
        set((state) => {
            const isSelected = state.selectedIds.includes(id);
            const newIds = isSelected
                ? state.selectedIds.filter((x) => x !== id)
                : [...state.selectedIds, id];
            const newSelectedId =
                newIds.length > 0 ? newIds[newIds.length - 1] : null;
            return {
                selectedIds: newIds,
                selectedId: newSelectedId,
            };
        }),
    mode: "translate",
    setMode: (mode) => set({ mode }),
    gridSize: 1,
    setGridSize: (gridSize) => set({ gridSize }),
    gridEnabled: true,
    setGridEnabled: (gridEnabled) => set({ gridEnabled }),
    activeAsset: null,
    setActiveAsset: (asset) =>
        set((state) => {
            const isDeactivating =
                (state.activeAsset as any)?.path === (asset as any)?.path;
            const nextActiveAsset = isDeactivating ? null : asset;
            if (nextActiveAsset) {
                return {
                    activeAsset: nextActiveAsset,
                    selectedId: null,
                    selectedIds: [],
                    paintMode: false,
                } as any;
            }
            return { activeAsset: null } as any;
        }),
});
