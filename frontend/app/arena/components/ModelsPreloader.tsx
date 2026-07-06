'use client';
/** Model cache warmer — triggers useGLTF downloads for NPC/monster glTF + lazy animation cache.
 *  No forced GPU compilation (that causes freeze). Models compile naturally when first rendered. */

import { useGLTF } from '@react-three/drei';

import { MeshoptDecoder } from 'meshoptimizer';
import { API_BASE_URL } from '@/src/core/config';

export const ModelsPreloader = ({ onReady }: { onReady: () => void }) => {
  // Trigger useGLTF cache for all NPC/monster models — downloads happen lazily via Suspense
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Chef_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Chef_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Knight_Golden_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Knight_Golden_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Wizard.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Witch.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Viking_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Viking_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Ninja_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Ninja_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Knight_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Cowboy_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Goblin_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Goblin_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Zombie_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
  useGLTF(API_BASE_URL + '/assets/characters/npcs/Zombie_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));

  // Unblock loading screen immediately
  onReady();

  return null;
};
