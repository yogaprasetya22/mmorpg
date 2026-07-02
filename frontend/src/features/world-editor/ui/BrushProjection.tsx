/**
 * BrushProjection.tsx — terrain brush mask projections + placed mask nodes.
 *
 * Location: @/frontend/src/components/game/environment/editor/BrushProjection.tsx
 */

import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { buildProjectedCirclePoints, buildProjectedPolygonPoints, buildProjectedStarPoints } from '../editorUtils';

// ─── HOLOGRAPHIC BRUSH PROJECTION ───

interface HolographicProps {
    maskId: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square';
    size: number; strength: number;
    position: [number, number, number];
    environment: string; terrainConfig: any;
}

export const HolographicBrushProjection = memo((props: HolographicProps) => {
    const { maskId, size, strength, position, environment, terrainConfig } = props;
    const [cx, cy, cz] = position;
    const SEGS = 64;

    const outerPts = useMemo(
        () => ['softCircle', 'hardCircle', 'star', 'starOutline'].includes(maskId)
            ? buildProjectedCirclePoints(cx, cy, cz, size, SEGS, environment, terrainConfig) : null,
        [cx, cy, cz, size, environment, terrainConfig, maskId],
    );
    const innerPts = useMemo(
        () => maskId === 'softCircle'
            ? buildProjectedCirclePoints(cx, cy, cz, size * strength, SEGS, environment, terrainConfig) : null,
        [cx, cy, cz, size, strength, environment, terrainConfig, maskId],
    );
    const outerPts70 = useMemo(
        () => maskId === 'starOutline'
            ? buildProjectedCirclePoints(cx, cy, cz, size * 0.7, SEGS, environment, terrainConfig) : null,
        [cx, cy, cz, size, environment, terrainConfig, maskId],
    );
    const hexPts = useMemo(
        () => maskId === 'hexagon'
            ? buildProjectedPolygonPoints(cx, cy, cz, size, 6, 0, environment, terrainConfig) : null,
        [cx, cy, cz, size, environment, terrainConfig, maskId],
    );
    const squarePts = useMemo(
        () => maskId === 'square'
            ? buildProjectedPolygonPoints(cx, cy, cz, size, 4, Math.PI / 4, environment, terrainConfig) : null,
        [cx, cy, cz, size, environment, terrainConfig, maskId],
    );
    const starPts = useMemo(
        () => maskId === 'star'
            ? buildProjectedStarPoints(cx, cy, cz, size, size * 0.45, 5, environment, terrainConfig) : null,
        [cx, cy, cz, size, environment, terrainConfig, maskId],
    );

    const lineMat = <lineBasicMaterial color="#3b82f6" linewidth={2} transparent opacity={0.9} depthWrite={false} />;
    const dimLineMat = <lineBasicMaterial color="#3b82f6" linewidth={1.5} transparent opacity={0.55} depthWrite={false} />;

    const ptsToJSX = (pts: Float32Array | null, mat = lineMat) => pts && (
        <lineLoop>
            <bufferGeometry>
                <float32BufferAttribute attach="attributes-position" args={[pts, 3]} />
            </bufferGeometry>
            {mat}
        </lineLoop>
    );

    return (
        <group>
            {maskId === 'softCircle' && outerPts && innerPts && (
                <group>
                    {ptsToJSX(outerPts, <lineBasicMaterial color="#3b82f6" linewidth={2} transparent opacity={0.75} depthWrite={false} />)}
                    {ptsToJSX(innerPts, <lineBasicMaterial color="#3b82f6" linewidth={1.5} transparent opacity={0.9} depthWrite={false} />)}
                </group>
            )}
            {maskId === 'hardCircle' && ptsToJSX(outerPts)}
            {maskId === 'star' && ptsToJSX(starPts)}
            {maskId === 'hexagon' && ptsToJSX(hexPts)}
            {maskId === 'square' && ptsToJSX(squarePts)}
            {maskId === 'starOutline' && outerPts && outerPts70 && (
                <group>
                    {ptsToJSX(outerPts)}
                    {ptsToJSX(outerPts70, dimLineMat)}
                </group>
            )}
        </group>
    );
});

// ─── PLACED MASK PROJECTION ───

import type { MapItem } from '@jagres/shared';

interface PlacedMaskProps {
    item: MapItem;
    isSelected: boolean;
    isHovered: boolean;
    onPointerOver: (e: any) => void;
    onPointerOut: (e: any) => void;
}

export const PlacedMaskProjection = memo(({ item, isSelected, isHovered, onPointerOver, onPointerOut }: PlacedMaskProps) => {
    const { pos, rot, sca, path: maskId, color } = item;
    const radius = sca[0];

    const starPoints = useMemo(() => {
        const pts: number[] = [];
        const spikes = 5;
        const outerRadius = radius;
        const innerRadius = radius * 0.45;
        let rotVal = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            pts.push(Math.cos(rotVal) * r, Math.sin(rotVal) * r, 0);
            rotVal += step;
        }
        return new Float32Array(pts);
    }, [radius]);

    const outlineColor = isSelected ? '#fbbf24' : isHovered ? '#60a5fa' : color || '#3b82f6';
    const filledColor = color || '#3b82f6';

    return (
        <group
            name={item.id}
            position={[pos[0], pos[1] + 0.08, pos[2]]}
            rotation={[-Math.PI / 2, 0, rot[1]]}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
        >
            {isSelected && (
                <mesh>
                    <ringGeometry args={[radius, radius + 0.15, 64]} />
                    <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
            )}

            {maskId === 'star' && (
                <group>
                    <lineLoop>
                        <bufferGeometry><float32BufferAttribute attach="attributes-position" args={[starPoints, 3]} /></bufferGeometry>
                        <lineBasicMaterial color={outlineColor} linewidth={2.5} transparent opacity={0.9} depthWrite={false} />
                    </lineLoop>
                    <mesh>
                        <ringGeometry args={[0, radius * 0.4, 32]} />
                        <meshBasicMaterial color={filledColor} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
                    </mesh>
                </group>
            )}

            {maskId === 'hexagon' && (
                <group>
                    <mesh><ringGeometry args={[radius - 0.05, radius, 6]} /><meshBasicMaterial color={outlineColor} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} /></mesh>
                    <mesh><ringGeometry args={[0, radius, 6]} /><meshBasicMaterial color={filledColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} /></mesh>
                </group>
            )}

            {maskId === 'starOutline' && (
                <group>
                    <mesh><ringGeometry args={[radius - 0.03, radius, 64]} /><meshBasicMaterial color={outlineColor} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} /></mesh>
                    <mesh><ringGeometry args={[radius * 0.7 - 0.03, radius * 0.7, 64]} /><meshBasicMaterial color={outlineColor} transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} /></mesh>
                </group>
            )}

            {maskId === 'square' && (
                <group rotation-z={Math.PI / 4}>
                    <mesh><ringGeometry args={[radius - 0.05, radius, 4]} /><meshBasicMaterial color={outlineColor} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} /></mesh>
                    <mesh><ringGeometry args={[0, radius, 4]} /><meshBasicMaterial color={filledColor} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} /></mesh>
                </group>
            )}
        </group>
    );
});
