/**
 * Editor invariants — runtime guard functions that validate editor state integrity.
 * Throws descriptive errors on violation. Call at trust boundaries.
 *
 * Location: frontend/src/editor/core/invariants.ts
 */

import type { MapItem } from "@jagres/shared";

/** No duplicate IDs across the item array */
export function assertNoDuplicateIds(items: readonly MapItem[]): void {
    const seen = new Set<string>();
    for (const item of items) {
        if (seen.has(item.id)) {
            throw new Error(`[Invariant] Duplicate item ID: ${item.id}`);
        }
        seen.add(item.id);
    }
}

/** Selection must reference existing items (or be "terrain" or null) */
export function assertValidSelection(
    selectedIds: readonly string[],
    items: readonly MapItem[],
): void {
    if (selectedIds.length === 0) return;
    const itemIdSet = new Set(items.map((i) => i.id));
    for (const id of selectedIds) {
        if (id === "terrain") continue;
        if (!itemIdSet.has(id)) {
            throw new Error(
                `[Invariant] Selected ID "${id}" not found in items`,
            );
        }
    }
}

/** Transform values must be finite numbers */
export function assertFiniteTransform(
    pos: readonly number[],
    rot: readonly number[],
    sca: readonly number[],
): void {
    for (const v of [...pos, ...rot, ...sca]) {
        if (!Number.isFinite(v)) {
            throw new Error(
                `[Invariant] Non-finite transform value found: pos=${pos} rot=${rot} sca=${sca}`,
            );
        }
    }
}

/** Items array must not contain undefined/null entries */
export function assertNoHoles(items: readonly MapItem[]): void {
    for (let i = 0; i < items.length; i++) {
        if (!items[i]) {
            throw new Error(`[Invariant] Hole at index ${i} in items array`);
        }
    }
}
