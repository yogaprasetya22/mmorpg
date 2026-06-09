/** GPU shader and texture preloader using React Suspense & GLTFLoader cache. */
'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { MeshoptDecoder } from 'meshoptimizer';
import { VFX_TEXTURES } from '@/src/components/game/systems/effects/VFXAssets';
import { API_BASE_URL } from '@/src/core/config';
import { loadFBXAnimations } from '@/src/components/game/avatar/AvatarModel';

export const ModelsPreloader = ({ onReady }: { onReady: () => void }) => {
  const { gl, camera } = useThree();

  // Preload all character models
  const g1 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Chef_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g2 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Chef_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g3 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Knight_Golden_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g4 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Knight_Golden_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g5 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Wizard.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g6 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Witch.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g7 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Viking_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g8 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Viking_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g9 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Ninja_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g10 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Ninja_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g11 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Knight_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g12 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Cowboy_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));

  // Preload all monster models
  const g13 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Goblin_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g14 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Goblin_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g15 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Zombie_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  const g16 = useGLTF(API_BASE_URL + '/assets/characters/npcs/Zombie_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));

  useEffect(() => {
    let active = true;

    const compileAll = async () => {
      console.log("🚀 Starting Asynchronous GPU Shader/Texture Compilation...");

      // Preload and cache Mixamo FBX animations
      try {
        await loadFBXAnimations();
      } catch (err) {
        console.warn("Failed to preload FBX animations:", err);
      }

      // Pre-upload all VFX textures to GPU to avoid stutter on first spell cast
      const texturesToInit: THREE.Texture[] = [];
      const collectTextures = (obj: any) => {
        if (obj instanceof THREE.Texture) {
          texturesToInit.push(obj);
        } else if (Array.isArray(obj)) {
          obj.forEach(collectTextures);
        } else if (obj && typeof obj === 'object') {
          Object.values(obj).forEach(collectTextures);
        }
      };
      collectTextures(VFX_TEXTURES);

      console.log(`Pre-uploading ${texturesToInit.length} VFX textures to GPU...`);
      texturesToInit.forEach(tex => {
        try {
          if (tex && (gl as any).initTexture) {
            (gl as any).initTexture(tex);
          }
        } catch (e) {
          console.warn("Failed to pre-upload texture to GPU:", e);
        }
      });

      const tempGroup = new THREE.Group();

      const gltfs = [g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16];
      gltfs.forEach((g: any) => {
        if (g && g.scene) {
          tempGroup.add(g.scene);
        }
      });

      try {
        if (typeof (gl as any).compileAsync === 'function') {
          await (gl as any).compileAsync(tempGroup, camera);
          console.log("✅ Asynchronous GPU compilation complete!");
        } else {
          gl.compile(tempGroup, camera);
          console.log("✅ Synchronous GPU compilation complete (fallback)!");
        }
      } catch (err) {
        console.warn("GPU compilation failed or timed out:", err);
      } finally {
        gltfs.forEach((g: any) => {
          if (g && g.scene) {
            tempGroup.remove(g.scene);
          }
        });

        if (active) {
          onReady();
        }
      }
    };

    compileAll();

    return () => {
      active = false;
    };
  }, [onReady, gl, camera, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16]);

  return null;
};
