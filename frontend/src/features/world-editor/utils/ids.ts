/**
 * Editor ID generation — uses crypto.randomUUID() for deterministic,
 * collision-resistant IDs. Replaces all Math.random() string generation.
 *
 * Location: frontend/src/editor/core/ids.ts
 */

export function newItemId(): string {
    return crypto.randomUUID();
}

export function newBlueprintId(): string {
    return `bp_${crypto.randomUUID()}`;
}

export function newCommandId(): string {
    return `cmd_${crypto.randomUUID()}`;
}
