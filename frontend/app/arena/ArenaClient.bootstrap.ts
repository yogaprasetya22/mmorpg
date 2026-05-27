/** BVH spatial acceleration bootstrap and GLTF model preloading at module scope. */

import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { MeshoptDecoder } from 'meshoptimizer';
import { API_BASE_URL } from '@/src/core/config';
import { PRELOAD_MODELS } from './ArenaClient.constants';

// Extend THREE global prototype for spatial acceleration structures (BVH)
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

// Preload all character and monster models at module initialization
const _preload = (path: string) =>
  useGLTF.preload(API_BASE_URL + path, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));

PRELOAD_MODELS.forEach(_preload);
