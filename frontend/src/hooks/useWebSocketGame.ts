import { useEffect, useRef } from "react";
import { encode, decode } from "@msgpack/msgpack";

export interface PlayerNetworkState {
    id: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    animation: string;
    class?: string;
    gender?: string;
    username?: string;
    targetId?: string;
    hp?: number;
    maxHp?: number;
    gold?: number;
    level?: number;
    aspd?: number;
}

// Lean flat struct — matches the backend domain.MonsterNetworkState exactly.
// Flat x/y/z avoids creating a nested position object during msgpack decode (GC pressure reduction).
export interface MonsterNetworkState {
    id: string;
    name: string;
    type: string;
    // Flat coordinates (not nested position object) — matches new lean backend payload
    x: number;
    y: number;
    z: number;
    hp: number;
    max_hp: number;
    is_dead: boolean;
    target_player_id?: string;
    animation?: string;
    ai_state?: string;
}

export interface GameStatePayload {
    players: PlayerNetworkState[];
    monsters: MonsterNetworkState[];
}

export const useWebSocketGame = (
    serverUrl: string,
    token: string,
    characterId: string,
    onStateReceived: (payload: GameStatePayload) => void,
    onChatReceived: (sender: string, msg: string) => void,
) => {
    const wsRef = useRef<WebSocket | null>(null);
    // Throttle: limit sendPlayerState to 20Hz regardless of how often called (60fps client)
    const lastSendTime = useRef(0);
    // Throttle: deduplicate WS messages within same animation state (micro-stutter prevention)
    const lastAnimation = useRef("");
    const lastX = useRef(0);
    const lastY = useRef(0);
    const lastZ = useRef(0);

    useEffect(() => {
        if (!token || !characterId) return;

        const wsUrl = `${serverUrl}?token=${token}&character_id=${characterId}`;
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                try {
                    const payload = decode(new Uint8Array(event.data)) as GameStatePayload;
                    onStateReceived(payload);
                } catch (err) {
                    console.error("Failed to parse binary game state payload via MessagePack", err);
                }
            } else if (typeof event.data === "string") {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.type === "chat") {
                        onChatReceived(data.name || "Unknown", data.msg || "");
                    } else {
                        onStateReceived(data as GameStatePayload);
                    }
                } catch (err) {
                    console.error("Failed to parse game state payload", err);
                }
            }
        };

        ws.onopen = () => console.log("✅ Terhubung ke Server Real-time Go!");
        ws.onclose = () => console.log("❌ Koneksi Server Real-time Terputus");
        ws.onerror = (err) => console.error("⚠️ WebSocket Error:", err);

        return () => {
            ws.close();
        };
    }, [serverUrl, token, characterId]);

    // Send local player state at max 20Hz — prevents flooding WS with 60fps movement updates
    const sendPlayerState = (state: Omit<PlayerNetworkState, "id">) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const now = performance.now();
        // Hard throttle: 50ms = 20Hz max send rate
        if (now - lastSendTime.current < 50) return;
        
        // Skip sending if position and animation haven't meaningfully changed (save ~30% WS sends)
        const dx = Math.abs(state.x - lastX.current);
        const dy = Math.abs(state.y - lastY.current);
        const dz = Math.abs(state.z - lastZ.current);
        const animChanged = state.animation !== lastAnimation.current;
        if (!animChanged && dx < 0.01 && dy < 0.01 && dz < 0.01) return;
        
        lastSendTime.current = now;
        lastAnimation.current = state.animation;
        lastX.current = state.x;
        lastY.current = state.y;
        lastZ.current = state.z;

        // Encode object to raw binary byte array (MessagePack)
        const binaryData = encode({
            action: "move",
            ...state
        });
        wsRef.current.send(binaryData);
    };

    // Send authoritative player combat actions (attack target)
    const sendPlayerAttack = (targetType: "monster" | "player", targetId: string, damage?: number, isCrit?: boolean) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const binaryData = encode({
                action: "attack",
                targetType,
                targetId,
                damage,
                isCrit
            });
            wsRef.current.send(binaryData);
        }
    };

    // Send authoritative player attribute allocation request to Go backend
    const sendDistributeStat = (stat: string, amount: number) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const binaryData = encode({
                action: "distribute_stat",
                stat,
                amount
            });
            wsRef.current.send(binaryData);
        }
    };

    // Send client chat message over WebSocket
    const sendChatMessage = (msg: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: "chat",
                msg: msg
            }));
        }
    };

    // Send client-side aggregated performance telemetry metrics
    const sendPerformanceReport = (report: {
        min_fps: number;
        max_fps: number;
        avg_fps: number;
        jitter_ms: number;
        stutter_count: number;
        p99_dt_ms: number;
    }) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const binaryData = encode({
                action: "telemetry_performance",
                ...report
            });
            wsRef.current.send(binaryData);
        }
    };

    return { sendPlayerState, sendPlayerAttack, sendDistributeStat, sendChatMessage, sendPerformanceReport };
};
