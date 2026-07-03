/**
 * HTTP transport — JSON-RPC 2.0 POST + SSE GET /events.
 *
 * Location: packages/mcp/src/transports/http.ts
 */

import type { RpcResponse, TransportHandler } from "./types";
import type { WorldSnapshot } from "../../../world-core/src/schema/node";

export type SseBroadcaster = (data: string) => void;
export type SseRegisterFn = (send: SseBroadcaster) => () => void;

export interface HttpTransportOptions {
    port: number;
    token?: string;
    getSnapshot: () => WorldSnapshot;
    sseClients: Set<SseBroadcaster>;
    handler: TransportHandler;
}

export async function runHttp(opts: HttpTransportOptions): Promise<void> {
    const http = await import("node:http");
    const { port, token, getSnapshot, sseClients, handler } = opts;

    const server = http.createServer(async (req, res) => {
        // SSE event stream
        if (req.method === "GET" && req.url === "/events") {
            if (token) {
                const auth = req.headers.authorization;
                if (!auth || auth !== `Bearer ${token}`) {
                    res.writeHead(401, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Unauthorized" }));
                    return;
                }
            }
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
            });
            const snap = getSnapshot();
            res.write(
                `data: ${JSON.stringify({ type: "snapshot:changed", snapshot: { id: snap.id, name: snap.name, version: snap.version, nodeCount: snap.nodes.length } })}\n\n`,
            );
            const send: SseBroadcaster = (data: string) =>
                res.write(`data: ${data}\n\n`);
            sseClients.add(send);
            req.on("close", () => sseClients.delete(send));
            return;
        }

        // Auth
        if (token) {
            const auth = req.headers.authorization;
            if (!auth || auth !== `Bearer ${token}`) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization",
        );

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.method !== "POST") {
            res.writeHead(405);
            res.end('{"error":"Method not allowed"}');
            return;
        }

        let body = "";
        req.on("data", (c: string) => (body += c));
        req.on("end", async () => {
            try {
                const r = JSON.parse(body);
                const result: RpcResponse = await handler(r);
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                });
                res.end(`data: ${JSON.stringify(result)}\n\n`);
            } catch {
                res.writeHead(400);
                res.end('{"error":"Invalid JSON"}');
            }
        });
    });

    server.listen(port, () =>
        console.error(`[world-mcp] HTTP on http://localhost:${port}`),
    );
}
