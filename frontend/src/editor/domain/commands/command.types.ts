/**
 * Command bus types — all editor mutations flow through typed commands.
 *
 * Location: frontend/src/editor/domain/commands/command.types.ts
 */

import type { MapItem } from "@jagres/shared";

// ─── Command metadata ───
export interface CommandMeta {
    id: string;
    timestamp: number;
    actor: "user" | "ai" | "system";
    source: string; // e.g. "WorldEditor.raycast", "AIPromptWidget"
}

// ─── Command variants ───
export type EditorCommand =
    | CreateItemCommand
    | CreateItemsBatchCommand
    | UpdateItemCommand
    | DeleteItemsCommand
    | DuplicateItemsCommand
    | TransformItemsCommand;

export interface CreateItemCommand {
    type: "createItem";
    meta: CommandMeta;
    payload: {
        item: MapItem;
    };
}

export interface CreateItemsBatchCommand {
    type: "createItemsBatch";
    meta: CommandMeta;
    payload: {
        items: MapItem[];
    };
}

export interface UpdateItemCommand {
    type: "updateItem";
    meta: CommandMeta;
    payload: {
        id: string;
        patch: Partial<Pick<MapItem, "pos" | "rot" | "sca" | "color" | "path">>;
    };
}

export interface DeleteItemsCommand {
    type: "deleteItems";
    meta: CommandMeta;
    payload: {
        ids: string[];
    };
}

export interface DuplicateItemsCommand {
    type: "duplicateItems";
    meta: CommandMeta;
    payload: {
        ids: string[];
        offset?: [number, number, number];
    };
}

export interface TransformItemsCommand {
    type: "transformItems";
    meta: CommandMeta;
    payload: {
        ids: string[];
        transforms: Array<{
            pos?: [number, number, number];
            rot?: [number, number, number];
            sca?: [number, number, number];
        }>;
    };
}

// ─── Command result ───
export interface CommandResult {
    success: boolean;
    itemsBefore: readonly MapItem[];
    itemsAfter: readonly MapItem[];
    error?: string;
}
