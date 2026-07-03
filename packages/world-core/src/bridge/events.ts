/**
 * Event emitter — minimal pub/sub for bridge state changes.
 * No external deps.
 *
 * Location: packages/world-core/src/bridge/events.ts
 */

import type { WorldSnapshot } from "../schema/node";

export type WorldEventType =
    | "snapshot:changed"
    | "node:created"
    | "node:updated"
    | "node:deleted"
    | "undo"
    | "redo";

export interface WorldEvent {
    type: WorldEventType;
    snapshot: WorldSnapshot;
    timestamp: string;
    detail?: unknown;
}

type Listener = (event: WorldEvent) => void;

export interface WorldEventBus {
    on(type: WorldEventType, fn: Listener): () => void;
    emit(event: WorldEvent): void;
    removeAll(): void;
}

export function createEventBus(): WorldEventBus {
    const listeners = new Map<WorldEventType, Set<Listener>>();

    return {
        on(type, fn) {
            let s = listeners.get(type);
            if (!s) {
                s = new Set();
                listeners.set(type, s);
            }
            s.add(fn);
            return () => s?.delete(fn);
        },
        emit(event) {
            const s = listeners.get(event.type);
            if (s) for (const fn of s) fn(event);
            // Also emit to "snapshot:changed" for all mutation events
            if (event.type !== "snapshot:changed") {
                const all = listeners.get("snapshot:changed");
                if (all) for (const fn of all) fn(event);
            }
        },
        removeAll() {
            listeners.clear();
        },
    };
}
