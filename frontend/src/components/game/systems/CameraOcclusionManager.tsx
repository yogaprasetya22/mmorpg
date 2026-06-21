'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/src/state/useStore';

interface GhostedObject {
  id: string;
  geometry: THREE.BufferGeometry;
  originalMaterial: THREE.Material | THREE.Material[];
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  parentMesh: THREE.InstancedMesh | THREE.Mesh;
  instanceId?: number;
  originalScale: THREE.Vector3;
  progress: number;
  holoMesh: THREE.Mesh;
  gpuHidden: boolean;
}

export const CameraOcclusionManager = () => {
  const { camera, scene } = useThree();

  const hologramGroupRef = useRef<THREE.Group>(new THREE.Group());
  const ghostedTracker = useRef<Map<string, GhostedObject>>(new Map());

  // Memori Cache yang dioptimalkan (EdgesCache dihapus total)
  const hologramMeshCache = useRef<Map<string, THREE.Mesh>>(new Map());
  const holoMaterialCache = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());

  // ZERO-GARBAGE COLLECTION: Semua alokasi objek dikeluarkan dari useFrame
  const activeFrameKeys = useRef<Set<string>>(new Set());
  const meshesToUpdateBatch = useRef<Set<THREE.InstancedMesh>>(new Set());
  const frameCounter = useRef(0);

  useEffect(() => {
    const group = hologramGroupRef.current;
    scene.add(group);
    return () => { scene.remove(group); };
  }, [scene]);

  // Pembuat Shader dengan Kunci Cache Spesifik
  const createHoloMaterialFromOriginal = (sourceMat: THREE.Material) => {
    const mat = sourceMat.clone();
    mat.transparent = true;
    mat.opacity = 1.0;
    mat.depthWrite = false;

    const originalOnBeforeCompile = sourceMat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      if (originalOnBeforeCompile) {
        originalOnBeforeCompile(shader, renderer);
      }
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        // Dibagi 2.0 (sebelumnya 3.0) agar pola checkerboard lebih rapat, 
        // sehingga bentuk 3D lebih tajam walau tanpa garis pinggir.
        vec2 pos = gl_FragCoord.xy / 2.0; 
        if (mod(floor(pos.x) + floor(pos.y), 2.0) == 0.0) discard;
        `
      );
    };
    mat.customProgramCacheKey = () => 'holo_dither_' + sourceMat.uuid;
    return mat;
  };

  // Variabel Matematika Statis (Pre-allocated)
  const _tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const _tempPos = useMemo(() => new THREE.Vector3(), []);
  const _playerPos = useMemo(() => new THREE.Vector3(), []);
  const _zeroVector = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const _raycaster = useMemo(() => {
    const rc = new THREE.Raycaster();
    rc.firstHitOnly = false;
    return rc;
  }, []);

  const getOrCreateHologram = (
    geometry: THREE.BufferGeometry,
    originalMaterial: THREE.Material | THREE.Material[],
    key: string
  ) => {
    if (hologramMeshCache.current.has(key)) return hologramMeshCache.current.get(key)!;

    const matKey = Array.isArray(originalMaterial)
      ? originalMaterial.map(m => m.uuid).join(',')
      : originalMaterial.uuid;

    let holoMaterial = holoMaterialCache.current.get(matKey);
    if (!holoMaterial) {
      if (Array.isArray(originalMaterial)) {
        holoMaterial = originalMaterial.map(mat => createHoloMaterialFromOriginal(mat));
      } else {
        holoMaterial = createHoloMaterialFromOriginal(originalMaterial);
      }
      holoMaterialCache.current.set(matKey, holoMaterial);
    }

    const mesh = new THREE.Mesh(geometry, holoMaterial);
    mesh.visible = false;

    hologramGroupRef.current.add(mesh);
    hologramMeshCache.current.set(key, mesh);
    return mesh;
  };

  useFrame((_, delta) => {
    frameCounter.current++;
    const shouldRaycast = frameCounter.current % 3 === 0;

    const playerPosArr = useStore.getState().playerPosition;
    if (!playerPosArr) return;

    _playerPos.set(playerPosArr[0], playerPosArr[1] + 1.2, playerPosArr[2]);
    const camPos = camera.position;
    const direction = _tempPos.subVectors(_playerPos, camPos).normalize();

    const colliders = (window as any).globalColliders || [];
    if (colliders.length === 0) return;

    meshesToUpdateBatch.current.clear();

    if (shouldRaycast) {
      // 1. KEMBALIKAN KE CPU
      ghostedTracker.current.forEach((ghost) => {
        if (ghost.instanceId !== undefined) {
          const instMesh = ghost.parentMesh as THREE.InstancedMesh;
          instMesh.setMatrixAt(ghost.instanceId, ghost.matrix);
        } else {
          ghost.parentMesh.visible = true;
        }
      });

      // 2. RAYCAST
      _raycaster.set(camPos, direction);
      _raycaster.far = camPos.distanceTo(_playerPos) - 0.2;
      const intersects = _raycaster.intersectObjects(colliders, true);

      activeFrameKeys.current.clear();

      intersects.forEach((hit) => {
        if (hit.object.name === 'terrain') return;
        const mesh = hit.object as THREE.Mesh | THREE.InstancedMesh;
        if (!mesh.geometry || !mesh.material) return;

        const isInstanced = (mesh as any).isInstancedMesh;
        const key = isInstanced ? `${mesh.uuid}_${hit.instanceId}` : `${mesh.uuid}`;
        activeFrameKeys.current.add(key);

        if (!ghostedTracker.current.has(key)) {
          const originalScale = new THREE.Vector3();
          let matrix = new THREE.Matrix4();
          let pos = new THREE.Vector3();
          let quat = new THREE.Quaternion();

          if (isInstanced) {
            const instMesh = mesh as THREE.InstancedMesh;
            instMesh.getMatrixAt(hit.instanceId!, matrix);
            matrix.decompose(pos, quat, originalScale);
          } else {
            matrix = mesh.matrixWorld.clone();
            mesh.matrixWorld.decompose(pos, quat, originalScale);
          }

          const holoMesh = getOrCreateHologram(mesh.geometry, mesh.material, key);

          holoMesh.position.copy(pos);
          holoMesh.quaternion.copy(quat);
          holoMesh.scale.copy(originalScale);
          holoMesh.updateMatrixWorld();
          holoMesh.visible = true;

          ghostedTracker.current.set(key, {
            id: key,
            geometry: mesh.geometry,
            originalMaterial: mesh.material,
            position: pos,
            quaternion: quat,
            scale: originalScale,
            matrix,
            parentMesh: mesh,
            instanceId: isInstanced ? hit.instanceId : undefined,
            originalScale,
            progress: 0.0,
            holoMesh,
            gpuHidden: false
          });
        }
      });

      // 3. SEMBUNYIKAN KEMBALI DI CPU
      ghostedTracker.current.forEach((ghost) => {
        if (ghost.instanceId !== undefined) {
          const instMesh = ghost.parentMesh as THREE.InstancedMesh;
          _tempMatrix.compose(ghost.position, ghost.quaternion, _zeroVector);
          instMesh.setMatrixAt(ghost.instanceId, _tempMatrix);
        } else {
          ghost.parentMesh.visible = false;
        }
      });
    }

    // ==========================================
    // ANIMASI MULUS & BATCHING GPU (ANTI-LAG)
    // ==========================================
    const transitionSpeed = delta * 5;

    ghostedTracker.current.forEach((ghost, key) => {
      const isBlocked = activeFrameKeys.current.has(key);

      ghost.progress = isBlocked
        ? Math.min(1.0, ghost.progress + transitionSpeed)
        : Math.max(0.0, ghost.progress - transitionSpeed);

      if (ghost.progress === 0.0 && !isBlocked) {
        ghost.holoMesh.visible = false;

        if (ghost.instanceId !== undefined) {
          const instMesh = ghost.parentMesh as THREE.InstancedMesh;
          instMesh.setMatrixAt(ghost.instanceId, ghost.matrix);
          meshesToUpdateBatch.current.add(instMesh);
        } else {
          ghost.parentMesh.visible = true;
        }
        ghostedTracker.current.delete(key);

      } else {
        if (!ghost.gpuHidden) {
          if (ghost.instanceId !== undefined) {
            const instMesh = ghost.parentMesh as THREE.InstancedMesh;
            _tempMatrix.compose(ghost.position, ghost.quaternion, _zeroVector);
            instMesh.setMatrixAt(ghost.instanceId, _tempMatrix);
            meshesToUpdateBatch.current.add(instMesh);
          } else {
            ghost.parentMesh.visible = false;
          }
          ghost.gpuHidden = true;
        }

        // Fading Opacity
        const targetOpacity = 1.0 - (ghost.progress * 0.5);

        if (Array.isArray(ghost.holoMesh.material)) {
          for (let i = 0; i < ghost.holoMesh.material.length; i++) {
            ghost.holoMesh.material[i].opacity = targetOpacity;
          }
        } else {
          (ghost.holoMesh.material as THREE.Material).opacity = targetOpacity;
        }
      }
    });

    // EKSEKUSI BATCH GPU
    meshesToUpdateBatch.current.forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  // Cleanup Cache
  useEffect(() => {
    return () => {
      hologramMeshCache.current.forEach(mesh => {
        mesh.geometry.dispose();
      });
      holoMaterialCache.current.forEach(mat => {
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      });
      hologramMeshCache.current.clear();
      holoMaterialCache.current.clear();
    };
  }, []);

  return null;
};