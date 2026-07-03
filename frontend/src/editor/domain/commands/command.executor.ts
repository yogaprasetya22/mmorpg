/**
 * Command executor — pure function that applies a command to an items array.
 * Headless: no React dependency. Takes items in, returns new items out.
 *
 * Location: frontend/src/editor/domain/commands/command.executor.ts
 */

import type { MapItem } from "@jagres/shared";
import {
    assertNoDuplicateIds,
    assertFiniteTransform,
    assertNoHoles,
} from "@/src/features/world-editor/constants/invariants";
import { newItemId } from "@/src/features/world-editor/utils/ids";
import type {
    EditorCommand,
    CommandResult,
    CreateItemCommand,
    CreateItemsBatchCommand,
    UpdateItemCommand,
    DeleteItemsCommand,
    DuplicateItemsCommand,
    TransformItemsCommand,
} from "./command.types";

// ─── Execute single command ───
export function executeCommand(
    items: readonly MapItem[],
    command: EditorCommand,
): CommandResult {
    const before = items;

    try {
        let after: MapItem[];

        switch (command.type) {
            case "createItem":
                after = executeCreateItem(items, command);
                break;
            case "createItemsBatch":
                after = executeCreateItemsBatch(items, command);
                break;
            case "updateItem":
                after = executeUpdateItem(items, command);
                break;
            case "deleteItems":
                after = executeDeleteItems(items, command);
                break;
            case "duplicateItems":
                after = executeDuplicateItems(items, command);
                break;
            case "transformItems":
                after = executeTransformItems(items, command);
                break;
            default:
                return {
                    success: false,
                    itemsBefore: before,
                    itemsAfter: before,
                    error: `Unknown command type: ${(command as any).type}`,
                };
        }

        // Invariant checks on result
        assertNoHoles(after);
        assertNoDuplicateIds(after);
        for (const item of after) {
            assertFiniteTransform(item.pos, item.rot, item.sca);
        }

        return { success: true, itemsBefore: before, itemsAfter: after };
    } catch (err: any) {
        return {
            success: false,
            itemsBefore: before,
            itemsAfter: before,
            error: err.message,
        };
    }
}

// ─── Individual command handlers ───

function executeCreateItem(
    items: readonly MapItem[],
    cmd: CreateItemCommand,
): MapItem[] {
    return [...items, cmd.payload.item];
}

function executeCreateItemsBatch(
    items: readonly MapItem[],
    cmd: CreateItemsBatchCommand,
): MapItem[] {
    return [...items, ...cmd.payload.items];
}

function executeUpdateItem(
    items: readonly MapItem[],
    cmd: UpdateItemCommand,
): MapItem[] {
    return items.map((item) =>
        item.id === cmd.payload.id ? { ...item, ...cmd.payload.patch } : item,
    );
}

function executeDeleteItems(
    items: readonly MapItem[],
    cmd: DeleteItemsCommand,
): MapItem[] {
    const idSet = new Set(cmd.payload.ids);
    return items.filter((item) => !idSet.has(item.id));
}

function executeDuplicateItems(
    items: readonly MapItem[],
    cmd: DuplicateItemsCommand,
): MapItem[] {
    const offset = cmd.payload.offset ?? [1, 0, 1];
    const idSet = new Set(cmd.payload.ids);
    const duplicates: MapItem[] = [];

    for (const item of items) {
        if (idSet.has(item.id)) {
            duplicates.push({
                ...item,
                id: newItemId(),
                pos: [
                    item.pos[0] + offset[0],
                    item.pos[1] + offset[1],
                    item.pos[2] + offset[2],
                ],
            });
        }
    }

    return [...items, ...duplicates];
}

function executeTransformItems(
    items: readonly MapItem[],
    cmd: TransformItemsCommand,
): MapItem[] {
    const idToTransform = new Map(
        cmd.payload.ids.map((id, idx) => [id, cmd.payload.transforms[idx]]),
    );

    return items.map((item) => {
        const t = idToTransform.get(item.id);
        if (!t) return item;
        return {
            ...item,
            pos: t.pos ?? item.pos,
            rot: t.rot ?? item.rot,
            sca: t.sca ?? item.sca,
        };
    });
}
