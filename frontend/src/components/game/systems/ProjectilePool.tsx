import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVFX } from './VFXManager';

const MAX_BULLETS = 100;
const BULLET_SPEED = 2.2; // Increased speed for better feel
const BULLET_LIFETIME = 2.5;

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  
  let totalVertices = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    totalVertices += g.attributes.position.count;
    if (g.index) totalIndices += g.index.count;
  }
  
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const partIds = new Float32Array(totalVertices);
  const indices: number[] = [];
  
  let vertexOffset = 0;
  for (const g of geometries) {
    const posAttr = g.attributes.position;
    const normAttr = g.attributes.normal;
    const uvAttr = g.attributes.uv;
    const partAttr = g.attributes.partId;
    
    positions.set(posAttr.array, vertexOffset * 3);
    if (normAttr) normals.set(normAttr.array, vertexOffset * 3);
    if (uvAttr) uvs.set(uvAttr.array, vertexOffset * 2);
    if (partAttr) partIds.set(partAttr.array, vertexOffset);
    
    if (g.index) {
      const indexArray = g.index.array;
      for (let i = 0; i < indexArray.length; i++) {
        indices.push(indexArray[i] + vertexOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + vertexOffset);
      }
    }
    
    vertexOffset += posAttr.count;
  }
  
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute('partId', new THREE.BufferAttribute(partIds, 1));
  merged.setIndex(indices);
  
  return merged;
}

function createArrowGeometry(): THREE.BufferGeometry {
  const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4);
  shaftGeo.rotateX(Math.PI / 2);
  shaftGeo.translate(0, 0, -0.05);
  const shaftPart = new Float32Array(shaftGeo.attributes.position.count).fill(0.0);
  shaftGeo.setAttribute('partId', new THREE.BufferAttribute(shaftPart, 1));

  const tipGeo = new THREE.ConeGeometry(0.045, 0.25, 4);
  tipGeo.rotateX(Math.PI / 2);
  tipGeo.translate(0, 0, 0.775);
  const tipPart = new Float32Array(tipGeo.attributes.position.count).fill(1.0);
  tipGeo.setAttribute('partId', new THREE.BufferAttribute(tipPart, 1));

  const feather1 = new THREE.BoxGeometry(0.004, 0.08, 0.25);
  feather1.translate(0, 0, -0.625);
  const f1Part = new Float32Array(feather1.attributes.position.count).fill(2.0);
  feather1.setAttribute('partId', new THREE.BufferAttribute(f1Part, 1));

  const feather2 = new THREE.BoxGeometry(0.08, 0.004, 0.25);
  feather2.translate(0, 0, -0.625);
  const f2Part = new Float32Array(feather2.attributes.position.count).fill(2.0);
  feather2.setAttribute('partId', new THREE.BufferAttribute(f2Part, 1));

  return mergeGeometries([shaftGeo, tipGeo, feather1, feather2]);
}

const ArrowShaderMat = () => new THREE.ShaderMaterial({
  vertexShader: `
    attribute float partId;
    varying float vPartId;
    varying vec2 vUv;
    varying vec3 vColor;
    #ifndef USE_INSTANCING_COLOR
      attribute vec3 instanceColor;
    #endif
    void main() {
      vPartId = partId;
      vUv = uv;
      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying float vPartId;
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vec3 finalColor;
      float alpha = 1.0;
      if (vPartId < 0.5) {
        // Shaft: wood brown
        vec3 woodColor = vec3(0.40, 0.25, 0.12);
        finalColor = mix(woodColor, vColor, 0.25);
      } else if (vPartId < 1.5) {
        // Tip: steel metal
        vec3 metalColor = vec3(0.75, 0.78, 0.82);
        finalColor = mix(metalColor, vColor * 2.0, 0.65);
      } else {
        // Feathers: off-white fletching
        vec3 featherColor = vec3(0.92, 0.92, 0.95);
        finalColor = mix(featherColor, vColor, 0.45);
      }
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
});

export interface ProjectilePoolHandle {
  fire: (origin: THREE.Vector3, direction: THREE.Vector3) => void;
}

interface ProjectilePoolProps {
  damageQueue?: React.RefObject<any[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
  playerClass?: string;
}

const ProjectilePool = forwardRef<ProjectilePoolHandle, ProjectilePoolProps>((props, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { scene } = useThree();
  const { spawnVFX } = useVFX();
  
  // High-performance static array pool
  const pool = useMemo(() => Array.from({ length: MAX_BULLETS }, () => ({
    active: false,
    position: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    life: 0
  })), []);

  // Pre-allocated objects for zero-allocation frame updates
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const _vMove = useMemo(() => new THREE.Vector3(), []);
  const _target = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(ref, () => ({
    fire: (origin, direction) => {
      const b = pool.find(bullet => !bullet.active);
      if (b) {
        b.active = true;
        b.position.copy(origin);
        b.direction.copy(direction).normalize();
        b.life = BULLET_LIFETIME;
      }
    }
  }));

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = pool[i];
      if (!b.active) {
        // Hide inactive bullets efficiently
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // 1. Calculate next movement vector
      _vMove.copy(b.direction).multiplyScalar(BULLET_SPEED);
      
      // 2. High-Precision Raycast Hit Detection (via BVH)
      raycaster.set(b.position, b.direction);
      raycaster.far = _vMove.length() * 1.5; // Slightly more for safety
      
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        
        // Find onHit in the hierarchy (traverse up)
        let targetId: string | null = null;
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if (curr.userData?.onHit && curr.userData?.unitId) {
            targetId = curr.userData.unitId;
            curr.userData.onHit(); // Triggers aggro
            break;
          }
          curr = curr.parent;
        }

        if (targetId) {
          spawnVFX([hit.point.x, hit.point.y, hit.point.z], 'spark', '#ff0000');
          
          const damage = 1200 + Math.random() * 2500;
          const isCrit = Math.random() > 0.8;
          
          if (props.dealPlayerDamage) {
            props.dealPlayerDamage(targetId, damage, isCrit);
          } else if (props.damageQueue?.current) {
            props.damageQueue.current.push({
                value: damage,
                position: [hit.point.x, hit.point.y, hit.point.z],
                isCrit,
                isMagic: false,
                color: isCrit ? '#ff4400' : '#ffaa00'
            });
          }
          b.active = false;
        } else {
          // Hit world or something else
          b.position.add(_vMove);
          b.life -= delta;
          if (b.life <= 0) b.active = false;
        }
      } else {
        // 3. Update Position & Life
        b.position.add(_vMove);
        b.life -= delta;
        if (b.life <= 0) b.active = false;
      }

      // 4. Update Visuals
      dummy.position.copy(b.position);
      _target.copy(b.position).add(b.direction);
      dummy.lookAt(_target);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Dynamically memoize geometry and material based on playerClass
  const [geom, mat] = useMemo(() => {
    if (props.playerClass === 'Beginner') {
      return [createArrowGeometry(), ArrowShaderMat()];
    }
    const g = new THREE.BoxGeometry(0.02, 0.02, 0.8);
    const m = new THREE.MeshStandardMaterial({
      color: "#00f3ff",
      emissive: "#00f3ff",
      emissiveIntensity: 1.2,
      toneMapped: true,
    });
    return [g, m];
  }, [props.playerClass]);

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, MAX_BULLETS]} frustumCulled={false}>
      <primitive object={geom} attach="geometry" />
      <primitive object={mat} attach="material" />
    </instancedMesh>
  );
});

export default ProjectilePool;
