'use client';

import { useThree } from '@react-three/fiber';
import { forwardRef, type ReactNode, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
  SAH,
  type SplitStrategy,
} from 'three-mesh-bvh';

type SceneBvhProps = {
  children?: ReactNode;
  enabled?: boolean;
  firstHitOnly?: boolean;
  strategy?: SplitStrategy;
  verbose?: boolean;
  setBoundingBox?: boolean;
  maxDepth?: number;
  maxLeafSize?: number;
  indirect?: boolean;
};

const isMesh = (object: unknown): object is THREE.Mesh =>
  !!object && typeof object === 'object' && (object as THREE.Mesh).isMesh === true;

const hasBvhCompatibleGeometry = (geometry?: THREE.BufferGeometry | null) => {
  if (!geometry) return false;

  const position = geometry.getAttribute('position');
  if (!position) return false;

  const vertexCount = geometry.getIndex()?.count ?? position.count;
  return vertexCount >= 3;
};

export const SceneBvh = forwardRef<THREE.Group, SceneBvhProps>(
  (
    {
      children,
      enabled = true,
      firstHitOnly = false,
      strategy = SAH,
      verbose = false,
      setBoundingBox = true,
      maxDepth = 40,
      maxLeafSize = 10,
      indirect = false,
    },
    forwardedRef,
  ) => {
    const ref = useRef<THREE.Group>(null);
    const raycaster = useThree((state) => state.raycaster);

    useImperativeHandle(forwardedRef, () => ref.current!, []);

    useEffect(() => {
      if (!enabled || !ref.current) return;

      const options = {
        strategy,
        verbose,
        setBoundingBox,
        maxDepth,
        maxLeafSize,
        indirect,
      };
      const group = ref.current;
      const acceleratedMeshes = new Set<THREE.Mesh>();
      const computedGeometries = new Set<THREE.BufferGeometry>();

      (raycaster as any).firstHitOnly = firstHitOnly;

      group.traverse((child) => {
        if (!isMesh(child)) return;

        if (child.raycast === THREE.Mesh.prototype.raycast) {
          child.raycast = acceleratedRaycast;
          acceleratedMeshes.add(child);
        }

        if (child.raycast !== acceleratedRaycast) return;

        const geometry = child.geometry;
        if (geometry.boundsTree || !hasBvhCompatibleGeometry(geometry)) return;

        try {
          (geometry as any).computeBoundsTree = computeBoundsTree;
          (geometry as any).disposeBoundsTree = disposeBoundsTree;
          (geometry as any).computeBoundsTree(options);
          computedGeometries.add(geometry);
        } catch (error) {
          console.warn('[game] Skipping BVH for incompatible mesh geometry.', {
            mesh: child.name || child.type,
            error,
          });
        }
      });

      return () => {
        delete (raycaster as any).firstHitOnly;

        for (const geometry of computedGeometries) {
          if (geometry.boundsTree) {
            (geometry as any).disposeBoundsTree();
          }
        }

        for (const mesh of acceleratedMeshes) {
          if (mesh.raycast === acceleratedRaycast) {
            mesh.raycast = THREE.Mesh.prototype.raycast;
          }
        }
      };
    }, [
      enabled,
      firstHitOnly,
      strategy,
      verbose,
      setBoundingBox,
      maxDepth,
      maxLeafSize,
      indirect,
      raycaster,
    ]);

    return <group ref={ref}>{children}</group>;
  },
);

SceneBvh.displayName = 'SceneBvh';
