/**
 * History slice — undo/redo, items, camera focus.
 *
 * Location: frontend/src/editor/app/store/slices/history.slice.ts
 */

import type { StateCreator } from "zustand";
import type { MapItem } from "@jagres/shared";

export interface HistorySlice {
    items: MapItem[];
    setItems: (items: MapItem[]) => void;

    history: MapItem[][];
    historyIndex: number;

    updateItemsWithHistory: (
        newItems: MapItem[] | ((prev: MapItem[]) => MapItem[]),
    ) => void;
    undo: () => void;
    redo: () => void;

    cameraFocusTarget: [number, number, number] | null;
    setCameraFocusTarget: (target: [number, number, number] | null) => void;
    cameraFocusObjectId: string | null;
    setCameraFocusObjectId: (id: string | null) => void;

    isEditorOpen: boolean;
    setIsEditorOpen: (open: boolean) => void;
    isSaving: boolean;
    setIsSaving: (saving: boolean) => void;

    lastUsedScales: Record<string, [number, number, number]>;
    setLastUsedScale: (
        assetPath: string,
        scale: [number, number, number],
    ) => void;
    lastUsedRotations: Record<string, [number, number, number]>;
    setLastUsedRotation: (
        assetPath: string,
        rotation: [number, number, number],
    ) => void;
}

export const createHistorySlice: StateCreator<
    HistorySlice,
    [],
    [],
    HistorySlice
> = (set, get) => ({
    items: [],
    setItems: (items) => set({ items }),

    history: [],
    historyIndex: -1,

    updateItemsWithHistory: (newItems) => {
        const { items, history, historyIndex } = get();
        const updated =
            typeof newItems === "function" ? newItems(items) : newItems;

        const nextH = history.slice(0, historyIndex + 1);
        const newHistory = [...nextH, updated].slice(-50);

        set({
            items: updated,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        });
    },

    undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
            set({
                items: history[historyIndex - 1],
                historyIndex: historyIndex - 1,
                selectedId: null,
                selectedIds: [],
            } as any);
        }
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
            set({
                items: history[historyIndex + 1],
                historyIndex: historyIndex + 1,
                selectedId: null,
                selectedIds: [],
            } as any);
        }
    },

    cameraFocusTarget: null,
    setCameraFocusTarget: (target) => set({ cameraFocusTarget: target }),
    cameraFocusObjectId: null,
    setCameraFocusObjectId: (id) => set({ cameraFocusObjectId: id }),

    isEditorOpen: false,
    setIsEditorOpen: (open) => set({ isEditorOpen: open }),
    isSaving: false,
    setIsSaving: (saving) => set({ isSaving: saving }),

    lastUsedScales: {},
    setLastUsedScale: (assetPath, scale) =>
        set((state) => ({
            lastUsedScales: { ...state.lastUsedScales, [assetPath]: scale },
        })),
    lastUsedRotations: {},
    setLastUsedRotation: (assetPath, rotation) =>
        set((state) => ({
            lastUsedRotations: {
                ...state.lastUsedRotations,
                [assetPath]: rotation,
            },
        })),
});
