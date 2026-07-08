import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RAIN_COUNT = 500;
// Rain data stored on CPU for matrix update per frame (avoids custom vertex shader)
interface RainDrop { x: number; y: number; z: number; speed: number; }

export const Rain = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const drops = useMemo(() => {
        const arr: RainDrop[] = [];
        for (let i = 0; i < RAIN_COUNT; i++) {
            arr.push({
                x: (Math.random() - 0.5) * 200,
                y: Math.random() * 60,
                z: (Math.random() - 0.5) * 200,
                speed: 40 + Math.random() * 60,
            });
        }
        return arr;
    }, []);

    // Standard material — no custom shader needed
    const mat = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0x7a8aa8,
        transparent: true,
        opacity: 0.6,
    }), []);

    useFrame((_state, delta) => {
        const mesh = meshRef.current;
        if (!mesh) return;
        for (let i = 0; i < RAIN_COUNT; i++) {
            const d = drops[i];
            d.y -= d.speed * delta;
            if (d.y < -2) d.y += 62;
            dummy.position.set(d.x, d.y, d.z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, mat, RAIN_COUNT]}>
            <cylinderGeometry args={[0.015, 0.015, 1.2, 3]} />
        </instancedMesh>
    );
};

export const Lightning = () => {
    const lightRef = useRef<THREE.PointLight>(null!);
    useEffect(() => {
        let isMounted = true;
        const trigger = () => {
            if (!isMounted) return;
            if (lightRef.current) {
                lightRef.current.intensity = 200 + Math.random() * 300;
                setTimeout(() => {
                    if (isMounted && lightRef.current) lightRef.current.intensity = 0;
                }, 50);
            }
            setTimeout(trigger, 3000 + Math.random() * 6000);
        };
        trigger();
        return () => { isMounted = false; };
    }, []);
    return <pointLight ref={lightRef} position={[0, 40, -10]} distance={200} color="#cce6ff" intensity={0} />;
};
