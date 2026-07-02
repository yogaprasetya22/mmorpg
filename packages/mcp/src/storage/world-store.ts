/**
 * WorldStore — persistence interface + JSON file implementation.
 *
 * Location: packages/mcp/src/storage/world-store.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import type { WorldSnapshot } from "../../../world-core/src/schema/node";
import {
    ERROR_CODES,
    type OperationResult,
} from "../../../world-core/src/schema/error-codes";

// ─── Store metadata ───
export interface WorldMeta {
    id: string;
    name: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}

// ─── Store interface ───
export interface WorldStore {
    save(
        world: WorldSnapshot,
        expectedVersion?: number,
    ): Promise<OperationResult<void>>;
    load(worldId: string): Promise<OperationResult<WorldSnapshot>>;
    list(): Promise<OperationResult<WorldMeta[]>>;
    rename(worldId: string, name: string): Promise<OperationResult<void>>;
    delete(worldId: string): Promise<OperationResult<void>>;
}

// ─── JSON file implementation ───
export function createJsonWorldStore(dataDir: string): WorldStore {
    const worldsDir = path.join(dataDir, "worlds");
    if (!existsSync(worldsDir)) {
        mkdirSync(worldsDir, { recursive: true });
    }

    function worldPath(worldId: string): string {
        // Sanitize: only allow alphanumeric + dash + underscore
        const safe = worldId.replace(/[^a-zA-Z0-9\-_]/g, "_");
        return path.join(worldsDir, `${safe}.json`);
    }

    function metaPath(): string {
        return path.join(worldsDir, "_index.json");
    }

    async function readMeta(): Promise<WorldMeta[]> {
        try {
            const raw = await fs.readFile(metaPath(), "utf-8");
            return JSON.parse(raw) as WorldMeta[];
        } catch {
            return [];
        }
    }

    async function writeMeta(meta: WorldMeta[]): Promise<void> {
        await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2), "utf-8");
    }

    const store: WorldStore = {
        async save(world, expectedVersion) {
            try {
                const filePath = worldPath(world.id);

                // Optimistic locking
                if (expectedVersion !== undefined) {
                    try {
                        const existing = JSON.parse(
                            await fs.readFile(filePath, "utf-8"),
                        ) as WorldSnapshot;
                        if (existing.version !== expectedVersion) {
                            return {
                                success: false,
                                data: null,
                                error: {
                                    code: ERROR_CODES.VERSION_CONFLICT,
                                    message: `Expected version ${expectedVersion}, found ${existing.version}`,
                                },
                            };
                        }
                    } catch {
                        // File doesn't exist yet → first save, no conflict
                    }
                }

                await fs.writeFile(
                    filePath,
                    JSON.stringify(world, null, 2),
                    "utf-8",
                );

                // Update index
                const meta = await readMeta();
                const idx = meta.findIndex((m) => m.id === world.id);
                const entry: WorldMeta = {
                    id: world.id,
                    name: world.name,
                    version: world.version,
                    createdAt: world.createdAt,
                    updatedAt: world.updatedAt,
                };
                if (idx >= 0) meta[idx] = entry;
                else meta.push(entry);
                await writeMeta(meta);

                return { success: true, data: undefined, error: null };
            } catch (err: any) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: ERROR_CODES.INTERNAL_ERROR,
                        message: err.message,
                    },
                };
            }
        },

        async load(worldId) {
            try {
                const filePath = worldPath(worldId);
                const raw = await fs.readFile(filePath, "utf-8");
                const world = JSON.parse(raw) as WorldSnapshot;
                return { success: true, data: world, error: null };
            } catch (err: any) {
                if (err.code === "ENOENT") {
                    return {
                        success: false,
                        data: null,
                        error: {
                            code: ERROR_CODES.NOT_FOUND,
                            message: `World ${worldId} not found`,
                        },
                    };
                }
                return {
                    success: false,
                    data: null,
                    error: {
                        code: ERROR_CODES.INTERNAL_ERROR,
                        message: err.message,
                    },
                };
            }
        },

        async list() {
            try {
                const meta = await readMeta();
                return { success: true, data: meta, error: null };
            } catch (err: any) {
                return {
                    success: false,
                    data: null,
                    error: {
                        code: ERROR_CODES.INTERNAL_ERROR,
                        message: err.message,
                    },
                };
            }
        },

        async rename(worldId, name) {
            try {
                const filePath = worldPath(worldId);
                const raw = await fs.readFile(filePath, "utf-8");
                const world = JSON.parse(raw) as WorldSnapshot;
                world.name = name;
                world.updatedAt = new Date().toISOString();
                await fs.writeFile(
                    filePath,
                    JSON.stringify(world, null, 2),
                    "utf-8",
                );

                const meta = await readMeta();
                const idx = meta.findIndex((m) => m.id === worldId);
                if (idx >= 0) {
                    meta[idx].name = name;
                    meta[idx].updatedAt = world.updatedAt;
                    await writeMeta(meta);
                }

                return { success: true, data: undefined, error: null };
            } catch (err: any) {
                if (err.code === "ENOENT") {
                    return {
                        success: false,
                        data: null,
                        error: {
                            code: ERROR_CODES.NOT_FOUND,
                            message: `World ${worldId} not found`,
                        },
                    };
                }
                return {
                    success: false,
                    data: null,
                    error: {
                        code: ERROR_CODES.INTERNAL_ERROR,
                        message: err.message,
                    },
                };
            }
        },

        async delete(worldId) {
            try {
                const filePath = worldPath(worldId);
                await fs.unlink(filePath);

                const meta = await readMeta();
                await writeMeta(meta.filter((m) => m.id !== worldId));

                return { success: true, data: undefined, error: null };
            } catch (err: any) {
                if (err.code === "ENOENT") {
                    return {
                        success: false,
                        data: null,
                        error: {
                            code: ERROR_CODES.NOT_FOUND,
                            message: `World ${worldId} not found`,
                        },
                    };
                }
                return {
                    success: false,
                    data: null,
                    error: {
                        code: ERROR_CODES.INTERNAL_ERROR,
                        message: err.message,
                    },
                };
            }
        },
    };

    return store;
}
