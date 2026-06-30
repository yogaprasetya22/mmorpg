'use client';

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";
import { Mesh, Skeleton, MeshStandardMaterial, Color } from "three";
import { SkeletonUtils } from "three-stdlib";

interface AvatarAssetProps {
  url: string;
  categoryName: string;
  skeleton: Skeleton;
  customization?: Record<string, any>;
}

interface AttachedItem {
  geometry: any;
  material: any;
  morphTargetDictionary?: { [key: string]: number };
  morphTargetInfluences?: number[];
}

export const AvatarAsset = ({ 
  url, 
  categoryName, 
  skeleton,
  customization: propCustomization
}: AvatarAssetProps) => {
  const gltf = useGLTF(url);
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

  const storeCustomization = useAvatarConfiguratorStore((state) => state.customization);
  const customization = propCustomization || storeCustomization;

  const assetColor = customization[categoryName]?.color || "";

  const skinColor = customization["Head"]?.color || "#f5c6a5";
  const skin = useMemo(() => {
    return new MeshStandardMaterial({ color: new Color(skinColor), roughness: 1 });
  }, [skinColor]);

  // Determine outfit locks locally to ensure robustness in game
  const isOutfitEquipped = !!customization["Outfit"]?.asset;
  const isHatEquipped = !!customization["Hat"]?.asset;

  useEffect(() => {
    scene.traverse((child: import('three').Object3D) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          
          let modified = false;
          const newMaterials = materials.map((mat: any) => {
            if (mat && mat.name && mat.name.includes("Color_") && 'color' in mat) {
              let targetMat = mat;
              if (!mat.isClonedMaterial) {
                targetMat = mat.clone();
                targetMat.isClonedMaterial = true;
                modified = true;
              }
              targetMat.color.set(assetColor);
              return targetMat;
            }
            return mat;
          });

          if (modified) {
            mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];
          } else {
            // Update colors on already cloned materials
            newMaterials.forEach((mat: any) => {
              if (mat && mat.isClonedMaterial && 'color' in mat) {
                mat.color.set(assetColor);
              }
            });
          }
        }
      }
    });
  }, [assetColor, scene]);

  const assetSkeleton = useMemo(() => {
    let originalSkeleton: any = null;
    scene.traverse((child: any) => {
      if (child.isSkinnedMesh && child.skeleton) {
        originalSkeleton = child.skeleton;
      }
    });

    if (!originalSkeleton) return skeleton;

    const mappedBones = originalSkeleton.bones.map((bone: any) => {
      const mainBone = skeleton?.bones?.find((b: any) => b.name === bone.name);
      return mainBone || bone;
    });

    return new Skeleton(mappedBones, originalSkeleton.boneInverses);
  }, [scene, skeleton]);

  const attachedItems = useMemo<AttachedItem[]>(() => {
    const items: AttachedItem[] = [];
    scene.traverse((child: import('three').Object3D) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        items.push({
          geometry: mesh.geometry,
          material: (mesh.material as any)?.name?.includes("Skin_")
            ? skin
            : mesh.material,
          morphTargetDictionary: mesh.morphTargetDictionary,
          morphTargetInfluences: mesh.morphTargetInfluences,
        });
      }
    });
    return items;
  }, [scene, skin]);

  if (isOutfitEquipped && (categoryName === "Top" || categoryName === "Bottom")) {
    return null;
  }
  if (isHatEquipped && categoryName === "Hair") {
    return null;
  }

  return (
    <>
      {attachedItems.map((item, index) => (
        <skinnedMesh
          key={index}
          geometry={item.geometry}
          material={item.material}
          skeleton={assetSkeleton}
          morphTargetDictionary={item.morphTargetDictionary}
          morphTargetInfluences={item.morphTargetInfluences}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
};
