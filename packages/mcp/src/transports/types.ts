/**
 * Transport shared types.
 *
 * Location: packages/mcp/src/transports/types.ts
 */

export type RpcId = string | number;

export interface RpcRequest {
    jsonrpc: "2.0";
    id?: RpcId;
    method: string;
    params?: Record<string, unknown>;
}

export interface RpcResponse {
    jsonrpc: "2.0";
    id?: RpcId;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

export type TransportHandler = (req: RpcRequest) => Promise<RpcResponse>;

export function ok(id: RpcId | undefined, result: unknown): RpcResponse {
    return { jsonrpc: "2.0", id, result };
}

export function err(
    id: RpcId | undefined,
    code: number,
    message: string,
): RpcResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
}
