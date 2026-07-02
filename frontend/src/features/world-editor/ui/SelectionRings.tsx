/**
 * SelectionRings.tsx — sleek selection & hover ring indicators.
 *
 * Location: @/frontend/src/components/game/environment/editor/SelectionRings.tsx
 */

import { memo } from 'react';
import * as THREE from 'three';

export const SleekSelectionRing = memo(({ radius, isDragging }: { radius: number; isDragging: boolean }) => (
    <group position-y={0.02}>
        <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[radius - 0.04, radius, 64]} />
            <meshBasicMaterial
                color={isDragging ? '#6366f1' : '#818cf8'}
                transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide}
            />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0, radius]} />
            <meshBasicMaterial
                color={isDragging ? '#4f46e5' : '#6366f1'}
                transparent opacity={isDragging ? 0.22 : 0.12} depthWrite={false} side={THREE.DoubleSide}
            />
        </mesh>
    </group>
));

export const SleekHoverRing = memo(({ radius }: { radius: number }) => (
    <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[radius - 0.03, radius, 64]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.65} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
));
