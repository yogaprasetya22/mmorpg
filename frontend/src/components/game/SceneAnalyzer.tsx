'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * SceneAnalyzer - Diagnostic Tool
 * Scans the scene and logs heavy-hitting meshes and texture counts every 5 seconds.
 */
export const SceneAnalyzer = () => {
  const { scene, gl } = useThree();
  const lastLog = useRef(0);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastLog.current < 5) return; // Run every 5 seconds
    lastLog.current = now;

    let totalTriangles = 0;
    const meshes: any[] = [];
    const textures = new Set();

    scene.traverse((node: any) => {
      if (node.isMesh || node.isInstancedMesh) {
        const geometry = node.geometry;
        if (geometry) {
          const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
          const triangles = (count / 3) * (node.isInstancedMesh ? node.count : 1);
          totalTriangles += triangles;
          meshes.push({
            name: node.name || node.type,
            triangles: Math.round(triangles),
            isInstanced: !!node.isInstancedMesh
          });
        }

        const scanMaterial = (mat: any) => {
          if (!mat) return;
          if (Array.isArray(mat)) {
            mat.forEach(scanMaterial);
            return;
          }
          Object.values(mat).forEach(val => {
            if (val && (val as any).isTexture) textures.add((val as any).uuid);
          });
        };
        scanMaterial(node.material);
      }
    });

    meshes.sort((a, b) => b.triangles - a.triangles);

    console.log("%c--- 3D SCENE HEAVY HITTER REPORT ---", "color: #ff00ff; font-weight: bold; font-size: 14px;");
    console.log(`Total Triangles: ~${(totalTriangles / 1000000).toFixed(2)}M`);
    console.log(`Unique Textures: ${textures.size}`);
    console.log("Top 10 Heavy Meshes:", meshes.slice(0, 10));
    console.log(`GPU Memory: ~${(gl.info.memory.geometries + gl.info.memory.textures)} objects in GPU`);
    console.log("--------------------------------------");
  });

  return null;
};
