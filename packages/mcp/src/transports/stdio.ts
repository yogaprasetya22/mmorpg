/**
 * stdio transport — line-delimited JSON-RPC 2.0.
 *
 * Location: packages/mcp/src/transports/stdio.ts
 */

import { createInterface } from "node:readline";
import type { RpcRequest, RpcResponse, TransportHandler } from "./types";

export function runStdio(handler: TransportHandler): void {
    console.error("[world-mcp] Server started via stdio");
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });
    rl.on("line", async (line: string) => {
        if (!line.trim()) return;
        try {
            const req = JSON.parse(line) as RpcRequest;
            if (req.jsonrpc !== "2.0" || !req.method) return;
            if (req.id === undefined) return; // skip notifications
            const res = await handler(req);
            process.stdout.write(JSON.stringify(res) + "\n");
        } catch {
            /* skip malformed */
        }
    });
}
