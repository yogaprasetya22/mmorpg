'use client'

import { useFrame } from '@react-three/fiber'
import { useSceneStore } from '@/src/store/useSceneStore'
import { sceneRegistry } from '@/src/lib/scene-registry'

/**
 * EntityUpdateSystem — imperative entity transform sync.
 *
 * Reads dirtyEntities from the scene store each frame and applies
 * position/rotation/scale/visible changes directly to registered
 * Object3D refs.  Zero React renders for per-frame entity updates.
 *
 * runs at useFrame priority 0 (first, before physics and rendering)
 * so transforms settle before any system reads them.
 *
 * Pattern from `pascalorg/editor` — GeometrySystem reads dirtyNodes
 * and rebuilds mesh geometry imperatively; this is the positional
 * analogue for game entities.
 */
export const EntityUpdateSystem = () => {
    const dirtyEntities = useSceneStore((s) => s.dirtyEntities)
    const entities = useSceneStore((s) => s.entities)
    const clearAllDirty = useSceneStore((s) => s.clearAllDirty)

    useFrame(() => {
        if (dirtyEntities.size === 0) return

        for (const id of dirtyEntities) {
            const entity = entities[id]
            const obj = sceneRegistry.nodes.get(id)
            if (!entity || !obj) continue

            // Imperative update — no React involvement
            if (entity.position) {
                obj.position.set(entity.position[0], entity.position[1], entity.position[2])
            }
            if (entity.rotation) {
                obj.rotation.set(entity.rotation[0], entity.rotation[1], entity.rotation[2])
            }
            if (entity.scale) {
                obj.scale.set(entity.scale[0], entity.scale[1], entity.scale[2])
            }
            if (entity.visible !== undefined) {
                obj.visible = entity.visible
            }
        }

        // Clear all dirty flags — all dirty entities were processed
        clearAllDirty()
    })

    return null
}
