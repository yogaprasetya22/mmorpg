/**
 * editorUtils.ts — shared helpers for Jagres Map Studio 3D editor.
 *
 * Location: @/frontend/src/components/game/environment/editor/editorUtils.ts
 *
 * Exports:
 *  - buildProjectedCirclePoints, buildProjectedPolygonPoints, buildProjectedStarPoints
 *  - SafeErrorBoundary
 *  - Module-level scratch objects (zero alloc)
 *  - isGrassAssetPath (re-export from GrassField)
 */

import { Component, ErrorInfo, ReactNode } from "react";
import * as THREE from "three";
import { getTerrainElevation } from "@jagres/shared";
import { isGrassAssetPath } from "@/src/components/game/environment/GrassField";

export { isGrassAssetPath };

// ── Module-level scratch objects for useFrame (zero alloc) ──
export const _scratchBox3 = new THREE.Box3();
export const _scratchSize = new THREE.Vector3();
export const _scratchDir = new THREE.Vector3();
export const _scratchTarget = new THREE.Vector3();

// ─── TERRAIN PROJECTION HELPERS ───

/**
 * Convert a closed-loop float32 vertex array [x,y,z, x,y,z, ...] into
 * a lineSegments-compatible array (each edge duplicated) so it works
 * with both WebGL and WebGPU (LineLoop unsupported in WebGPU).
 */
export function loopToSegments(pts: Float32Array): Float32Array {
    const n = pts.length / 3;
    if (n < 2) return pts;
    const out = new Float32Array(n * 6); // 2 vertices per edge
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const oi = i * 6,
            ni = next * 3,
            ci = i * 3;
        out[oi] = pts[ci];
        out[oi + 1] = pts[ci + 1];
        out[oi + 2] = pts[ci + 2];
        out[oi + 3] = pts[ni];
        out[oi + 4] = pts[ni + 1];
        out[oi + 5] = pts[ni + 2];
    }
    return out;
}

export const buildProjectedCirclePoints = (
    cx: number,
    _cy: number,
    cz: number,
    radius: number,
    segments: number,
    environment: string,
    terrainConfig: any,
): Float32Array => {
    const pts = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const wx = cx + Math.cos(angle) * radius;
        const wz = cz + Math.sin(angle) * radius;
        let wy = getTerrainElevation(
            wx,
            wz,
            environment as any,
            24,
            terrainConfig,
        );
        if (typeof window !== "undefined" && (window as any).getGroundHeight) {
            const h = (window as any).getGroundHeight(wx, wz, -9999);
            if (h !== -9999) wy = h;
        }
        pts[i * 3 + 0] = wx;
        pts[i * 3 + 1] = wy + 0.35;
        pts[i * 3 + 2] = wz;
    }
    return pts;
};

export const buildProjectedPolygonPoints = (
    cx: number,
    _cy: number,
    cz: number,
    radius: number,
    sides: number,
    rotOffset: number,
    environment: string,
    terrainConfig: any,
): Float32Array => {
    const pts = new Float32Array((sides + 1) * 3);
    for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + rotOffset;
        const wx = cx + Math.cos(angle) * radius;
        const wz = cz + Math.sin(angle) * radius;
        let wy = getTerrainElevation(
            wx,
            wz,
            environment as any,
            24,
            terrainConfig,
        );
        if (typeof window !== "undefined" && (window as any).getGroundHeight) {
            const h = (window as any).getGroundHeight(wx, wz, -9999);
            if (h !== -9999) wy = h;
        }
        pts[i * 3 + 0] = wx;
        pts[i * 3 + 1] = wy + 0.35;
        pts[i * 3 + 2] = wz;
    }
    return pts;
};

export const buildProjectedStarPoints = (
    cx: number,
    _cy: number,
    cz: number,
    outerR: number,
    innerR: number,
    spikes: number,
    environment: string,
    terrainConfig: any,
): Float32Array => {
    const total = spikes * 2;
    const pts = new Float32Array((total + 1) * 3);
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    for (let i = 0; i <= total; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const wx = cx + Math.cos(rot) * r;
        const wz = cz + Math.sin(rot) * r;
        let wy = getTerrainElevation(
            wx,
            wz,
            environment as any,
            24,
            terrainConfig,
        );
        if (typeof window !== "undefined" && (window as any).getGroundHeight) {
            const h = (window as any).getGroundHeight(wx, wz, -9999);
            if (h !== -9999) wy = h;
        }
        pts[i * 3 + 0] = wx;
        pts[i * 3 + 1] = wy + 0.35;
        pts[i * 3 + 2] = wz;
        rot += step;
    }
    return pts;
};

// ─── SAFE ERROR BOUNDARY ───

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback: ReactNode;
}
interface ErrorBoundaryState {
    hasError: boolean;
}

export class SafeErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };
    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.warn("R3F Asset Load Error caught:", error, errorInfo);
    }
    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}
