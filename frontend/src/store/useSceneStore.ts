"use client";

import { create } from "zustand";
import type { SceneEntity } from "./types";

/**
 * Scene store — flat entity map + dirty set for imperative rendering.
 *
 * Reasoning: 100 monster movements should trigger 0 React reconciliations.
 * Components mount an empty <group> and register via sceneRegistry.
 * EntityUpdateSystem reads dirtyEntities each frame and applies transforms
 * imperatively via refs.
 *
 * Pattern from `pascalorg/editor` — dirty set + imperative geometry rebuild
 * keeps React out of the per-frame update path entirely.
 */

export type SceneState = {
    /** Flat entity dictionary keyed by entity id */
    entities: Record<string, SceneEntity>;
    /** Set of entity ids whose Object3D needs syncing next frame */
    dirtyEntities: Set<string>;

    /** Replace the entire entity set (scene load) */
    setEntities: (entities: Record<string, SceneEntity>) => void;

    /** Mark a single entity dirty — triggers imperative sync next frame */
    markDirty: (id: string) => void;
    /** Clear dirty flag after sync */
    clearDirty: (id: string) => void;
    /** Clear all dirty flags */
    clearAllDirty: () => void;

    /** Update entity data + mark dirty (with RAF coalescing) */
    updateEntity: (id: string, data: Partial<SceneEntity>) => void;
    /** Batch update multiple entities */
    updateEntities: (
        updates: { id: string; data: Partial<SceneEntity> }[],
    ) => void;

    /** Remove entity */
    removeEntity: (id: string) => void;
    /** Clear all entities */
    clearEntities: () => void;
};

// RAF-coalescing state
let _pendingRafId: number | null = null;
const _pendingUpdates = new Set<string>();
const _pendingData = new Map<string, Partial<SceneEntity>>();

export const useSceneStore = create<SceneState>()((set) => ({
    entities: {},
    dirtyEntities: new Set(),

    setEntities: (entities) => {
        set({ entities, dirtyEntities: new Set(Object.keys(entities)) });
    },

    markDirty: (id) => {
        set((state) => {
            const next = new Set(state.dirtyEntities);
            next.add(id);
            return { dirtyEntities: next };
        });
    },

    clearDirty: (id) => {
        set((state) => {
            const next = new Set(state.dirtyEntities);
            next.delete(id);
            return { dirtyEntities: next };
        });
    },

    clearAllDirty: () => set({ dirtyEntities: new Set() }),

    updateEntity: (id, data) => {
        // Apply data to store immediately
        set((state) => ({
            entities: {
                ...state.entities,
                [id]: {
                    ...(state.entities[id] ?? { id }),
                    ...data,
                } as SceneEntity,
            },
        }));

        // Defer dirty marking to next RAF (coalesce multiple updates)
        _pendingUpdates.add(id);
        const existing = _pendingData.get(id) ?? {};
        _pendingData.set(id, { ...existing, ...data });

        if (_pendingRafId !== null) cancelAnimationFrame(_pendingRafId);
        _pendingRafId = requestAnimationFrame(() => {
            const ids = new Set(_pendingUpdates);
            _pendingUpdates.clear();
            _pendingData.clear();
            _pendingRafId = null;

            if (ids.size === 0) return;
            set((state) => {
                const next = new Set(state.dirtyEntities);
                for (const id of ids) next.add(id);
                return { dirtyEntities: next };
            });
        });
    },

    updateEntities: (updates) => {
        set((state) => {
            const nextEntities = { ...state.entities };
            for (const { id, data } of updates) {
                nextEntities[id] = {
                    ...(nextEntities[id] ?? { id }),
                    ...data,
                } as SceneEntity;
            }
            return { entities: nextEntities };
        });

        for (const { id } of updates) _pendingUpdates.add(id);

        if (_pendingRafId !== null) cancelAnimationFrame(_pendingRafId);
        _pendingRafId = requestAnimationFrame(() => {
            const ids = new Set(_pendingUpdates);
            _pendingUpdates.clear();
            _pendingData.clear();
            _pendingRafId = null;

            if (ids.size === 0) return;
            set((state) => {
                const next = new Set(state.dirtyEntities);
                for (const id of ids) next.add(id);
                return { dirtyEntities: next };
            });
        });
    },

    removeEntity: (id) => {
        set((state) => {
            const next = { ...state.entities };
            delete next[id];
            const dirty = new Set(state.dirtyEntities);
            dirty.delete(id);
            return { entities: next, dirtyEntities: dirty };
        });
    },

    clearEntities: () => set({ entities: {}, dirtyEntities: new Set() }),
}));
