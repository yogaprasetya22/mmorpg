/**
 * SQLite world store — stub implementation.
 * ponytail: full SQLite with better-sqlite3 when needed.
 *
 * Location: packages/mcp/src/storage/sqlite-world-store.ts
 */

import type {
    WorldSnapshot,
    OperationResult,
} from "../../../world-core/src/index";
import type { WorldMeta, WorldStore } from "./types";

/**
 * Create a SQLite-backed world store. Currently a stub that throws.
 * Replace with real SQLite (better-sqlite3) when persistence needs grow
 * beyond JSON files.
 */
export function createSqliteWorldStore(_dbPath: string): WorldStore {
    return {
        async save(_world: WorldSnapshot, _expectedVersion?: number) {
            throw new Error(
                "SQLite store not yet implemented — use JSON store",
            );
        },
        async load(_worldId: string): Promise<OperationResult<WorldSnapshot>> {
            throw new Error(
                "SQLite store not yet implemented — use JSON store",
            );
        },
        async list(): Promise<OperationResult<WorldMeta[]>> {
            throw new Error(
                "SQLite store not yet implemented — use JSON store",
            );
        },
        async rename(
            _worldId: string,
            _name: string,
        ): Promise<OperationResult<void>> {
            throw new Error(
                "SQLite store not yet implemented — use JSON store",
            );
        },
        async delete(_worldId: string): Promise<OperationResult<void>> {
            throw new Error(
                "SQLite store not yet implemented — use JSON store",
            );
        },
    };
}
