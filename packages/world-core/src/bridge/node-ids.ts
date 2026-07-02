/**
 * Node ID generator — deterministic + crypto-safe.
 *
 * Location: packages/world-core/src/bridge/node-ids.ts
 */

export function buildNodeId(): string {
    // crypto.randomUUID() available in Node 19+, Bun, browsers
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return `node-${crypto.randomUUID()}`;
    }
    // Fallback for older runtimes
    const arr = new Uint32Array(4);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
    } else {
        // Seedless fallback: time + counter
        arr[0] = (Math.random() * 0xffffffff) >>> 0;
        arr[1] = (Math.random() * 0xffffffff) >>> 0;
        arr[2] = Date.now() >>> 0;
        arr[3] = (performance?.now?.() ?? 0) >>> 0;
    }
    const hex = Array.from(arr, (n) => n.toString(16).padStart(8, "0")).join(
        "",
    );
    return `node-${hex}`;
}
