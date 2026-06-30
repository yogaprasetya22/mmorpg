/**
 * Scene entity type — shared between scene store, systems, and renderers.
 *
 * Minimal shape: only the fields that are updated imperatively per frame.
 * Per-kind metadata lives in the system that owns the entity kind.
 */

export interface SceneEntity {
    /** Unique identifier (matches sceneRegistry key) */
    id: string;
    /** Optional type tag for by-type lookups (monster, player, item, projectile) */
    type?: string;
    /** World-space position */
    position?: [number, number, number];
    /** Euler rotation */
    rotation?: [number, number, number];
    /** Uniform or per-axis scale */
    scale?: [number, number, number];
    /** Visibility toggle */
    visible?: boolean;
    /** Mesh color override (applied by system) */
    color?: string;
    /** Per-kind payload (e.g. animation state for characters) */
    data?: Record<string, unknown>;
}
