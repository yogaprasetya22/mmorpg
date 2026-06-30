"use client";

import { useLayoutEffect } from "react";
import type { Object3D } from "three";
import { sceneRegistry } from "./scene-registry";

/**
 * Hook for components to self-register their root Object3D in the scene registry.
 *
 * Usage:
 * ```tsx
 * const ref = useRef<Group>(null!)
 * useRegistry(entityId, ref)
 * ```
 *
 * Systems (EntityUpdateSystem) then find this object by ID and
 * update its position/rotation/scale imperatively — no React re-render needed.
 */
export function useRegistry(
    id: string,
    ref: React.RefObject<Object3D | null>,
    type?: string,
) {
    useLayoutEffect(() => {
        const obj = ref.current;
        if (!obj) return;

        sceneRegistry.nodes.set(id, obj);

        if (type) {
            let byType = sceneRegistry.byType.get(type);
            if (!byType) {
                byType = new Set();
                sceneRegistry.byType.set(type, byType);
            }
            byType.add(id);
        }

        return () => {
            sceneRegistry.nodes.delete(id);
            if (type) {
                sceneRegistry.byType.get(type)?.delete(id);
            }
        };
    }, [id, ref, type]);
}
