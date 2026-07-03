/**
 * History slice — undo/redo, items, camera focus.
 *
 * Location: frontend/src/editor/app/store/slices/history.slice.ts
 */

import type { StateCreator } from "zustand";
import type { MapItem } from "@jagres/shared";

export interface HistoryRecord {
    items: MapItem[];
    paintData: string | null;
    sculptData: string | null;
}

export interface HistorySlice {
    items: MapItem[];
    setItems: (items: MapItem[]) => void;

    history: HistoryRecord[];
    historyIndex: number;

    updateItemsWithHistory: (
        newItems: MapItem[] | ((prev: MapItem[]) => MapItem[]),
    ) => void;
    updateTerrainWithHistory: (
        type: "paint" | "sculpt",
        data: string | null,
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
        const { items, paintData, sculptData, history, historyIndex } = get() as any;
        const updated =
            typeof newItems === "function" ? newItems(items) : newItems;

        const nextH = history.slice(0, historyIndex + 1);
        const newRecord = { items: updated, paintData, sculptData };
        const newHistory = [...nextH, newRecord].slice(-50);

        set({
            items: updated,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        } as any);
    },

    updateTerrainWithHistory: (type, data) => {
        const { items, paintData, sculptData, history, historyIndex } = get() as any;
        const nextPaint = type === "paint" ? data : paintData;
        const nextSculpt = type === "sculpt" ? data : sculptData;

        const nextH = history.slice(0, historyIndex + 1);
        const newRecord = { items, paintData: nextPaint, sculptData: nextSculpt };
        const newHistory = [...nextH, newRecord].slice(-50);

        set({
            paintData: nextPaint,
            sculptData: nextSculpt,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        } as any);
    },

    undo: () => {
        const { history, historyIndex } = get() as any;
        if (historyIndex > 0) {
            const prevRecord = history[historyIndex - 1];
            set({
                items: prevRecord.items,
                paintData: prevRecord.paintData,
                sculptData: prevRecord.sculptData,
                historyIndex: historyIndex - 1,
                selectedId: null,
                selectedIds: [],
            } as any);
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("world_editor_paint", prevRecord.paintData || "");
                localStorage.setItem("world_editor_sculpt", prevRecord.sculptData || "");
            }
        }
    },

    redo: () => {
        const { history, historyIndex } = get() as any;
        if (historyIndex < history.length - 1) {
            const nextRecord = history[historyIndex + 1];
            set({
                items: nextRecord.items,
                paintData: nextRecord.paintData,
                sculptData: nextRecord.sculptData,
                historyIndex: historyIndex + 1,
                selectedId: null,
                selectedIds: [],
            } as any);
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("world_editor_paint", nextRecord.paintData || "");
                localStorage.setItem("world_editor_sculpt", nextRecord.sculptData || "");
            }
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
