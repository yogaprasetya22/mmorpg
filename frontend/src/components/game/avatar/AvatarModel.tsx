'use client';

import { NodeIO } from "@gltf-transform/core";
import { dedup, draco, prune, quantize } from "@gltf-transform/functions";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import { GLTFExporter, FBXLoader } from "three-stdlib";
import { API_BASE_URL } from "@/src/core/config";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";
import { AvatarAsset } from "./AvatarAsset";
import * as THREE from "three";
import { createPortal, useFrame } from "@react-three/fiber";
import { weaponConfigs } from "./weaponConfigs";

interface WeaponAssetProps {
  assetId: string;
  url: string;
}

const WeaponAsset = ({ assetId, url }: WeaponAssetProps) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  // Load default offset configurations from weaponConfigs.ts
  const defaultOffset = weaponConfigs[assetId] || {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }, [clonedScene]);

  return (
    <group 
      position={defaultOffset.position as [number, number, number]} 
      rotation={defaultOffset.rotation as [number, number, number]} 
      scale={defaultOffset.scale as [number, number, number]}
    >
      <primitive object={clonedScene} />
    </group>
  );
};

// Global cache for loaded Mixamo FBX AnimationClips to prevent redundant HTTP loads
let globalCachedClips: any[] | null = null;
let animationLoadingPromise: Promise<any[]> | null = null;

const ANIMATION_FILES: Record<string, string> = {
  "Idle": "/assets/animations/fbx/Idle.fbx",
  "Jogging": "/assets/animations/fbx/Jogging.fbx",
  "Slow Run": "/assets/animations/fbx/Slow Run.fbx",
  "Light Hit To Head": "/assets/animations/fbx/Light Hit To Head.fbx",
  "Sword And Shield Death": "/assets/animations/fbx/Sword And Shield Death.fbx",
  "Stable Sword Outward Slash": "/assets/animations/fbx/Stable Sword Outward Slash.fbx",
  "Magic Heal": "/assets/animations/fbx/Magic Heal.fbx",
  "Run With Sword": "/assets/animations/fbx/Run With Sword.fbx",
  "Standing React Death Right": "/assets/animations/fbx/Standing React Death Right.fbx"
};

export const loadFBXAnimations = async (): Promise<any[]> => {
  if (globalCachedClips) return globalCachedClips;
  if (animationLoadingPromise) return animationLoadingPromise;

  animationLoadingPromise = (async () => {
    console.log("⚙️ Loading individual FBX animations...");
    const loader = new FBXLoader();
    const clips: any[] = [];

    const promises = Object.entries(ANIMATION_FILES).map(async ([name, path]) => {
      try {
        const fullUrl = `${API_BASE_URL}${path}`;
        const fbx = await new Promise<any>((resolve, reject) => {
          loader.load(fullUrl, resolve, undefined, reject);
        });

        if (fbx.animations && fbx.animations.length > 0) {
          const clip = fbx.animations[0].clone();
          clip.name = name; // Rename to our friendly name
          
          // Mixamo FBX animations have a 90-degree offset on the X axis, causing the model to lie down.
          // We rotate the root tracks back by -90 degrees on the X-axis to correct this.
          const hipsRotTrack = clip.tracks.find((t: any) => t.name === "mixamorigHips.quaternion" || t.name === "mixamorig:Hips.quaternion");
          const correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          if (hipsRotTrack) {
            const values = hipsRotTrack.values;
            const q = new THREE.Quaternion();
            for (let i = 0; i < values.length; i += 4) {
              q.set(values[i], values[i+1], values[i+2], values[i+3]);
              q.premultiply(correction);
              values[i] = q.x;
              values[i+1] = q.y;
              values[i+2] = q.z;
              values[i+3] = q.w;
            }
          }

          const hipsPosTrack = clip.tracks.find((t: any) => t.name === "mixamorigHips.position" || t.name === "mixamorig:Hips.position");
          if (hipsPosTrack) {
            const values = hipsPosTrack.values;
            const v = new THREE.Vector3();
            for (let i = 0; i < values.length; i += 3) {
              v.set(values[i], values[i+1], values[i+2]);
              v.applyQuaternion(correction);
              values[i] = v.x;
              values[i+1] = v.y;
              values[i+2] = v.z;
            }
          }

          // Prune root tracks targeting "Armature" (e.g., Armature.quaternion) to prevent
          // Three.js AnimationMixer from overriding the React group's default rotation.
          clip.tracks = clip.tracks.filter((t: any) => !t.name.startsWith("Armature."));
          
          clips.push(clip);
        }
      } catch (err) {
        console.error(`❌ Failed to load FBX animation "${name}" from ${path}:`, err);
      }
    });

    await Promise.all(promises);
    globalCachedClips = clips;
    console.log(`✅ Loaded and cached ${clips.length} FBX animations:`, clips.map(c => c.name));
    return clips;
  })();

  return animationLoadingPromise;
};

const AvatarModelStatic = ({ customization, ...props }: any) => {
  const { nodes } = useGLTF(`${API_BASE_URL}/assets/characters/base/Armature.glb`) as any;
  const equippedWeaponAsset = customization["Weapon"]?.asset;

  useEffect(() => {
    // Hide all internal hardcoded weapon meshes in Armature.glb
    const internalWeapons = ["Sword", "Battle_Scythe", "Battle_Hammer", "Battle_Bow", "Battle_Axe", "Arrow"];
    internalWeapons.forEach((meshName) => {
      const mesh = nodes[meshName];
      if (mesh) {
        mesh.visible = false;
      }
    });
  }, [nodes]);

  return (
    <group {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <primitive object={nodes["mixamorig:Hips"] || nodes.mixamorigHips} />
          {Object.keys(customization).map(
            (key) =>
              key !== "Weapon" && customization[key]?.asset?.url && (
                <Suspense key={customization[key].asset!.id}>
                  <AvatarAsset
                    categoryName={key}
                    url={`${API_BASE_URL}${customization[key].asset!.url}`}
                    skeleton={nodes.ARMS?.skeleton || nodes.Plane?.skeleton}
                    customization={customization}
                  />
                </Suspense>
              )
          )}
          {/* Render equipped weapon dynamically attached to RightHand bone using createPortal */}
          {(nodes["mixamorig:RightHand"] || nodes.mixamorigRightHand) && equippedWeaponAsset?.url && (
            createPortal(
              <Suspense fallback={null}>
                <WeaponAsset
                  assetId={equippedWeaponAsset.id}
                  url={`${API_BASE_URL}${equippedWeaponAsset.url}`}
                />
              </Suspense>,
              nodes["mixamorig:RightHand"] || nodes.mixamorigRightHand
            )
          )}
        </group>
      </group>
    </group>
  );
};

const AvatarModelAnimated = ({
  customization,
  pose,
  timeScale,
  paused,
  animations,
  propCustomization,
  ...props
}: any) => {
  const group = useRef<THREE.Group>(null);
  const { nodes } = useGLTF(`${API_BASE_URL}/assets/characters/base/Armature.glb`) as any;
  const { actions } = useAnimations(animations, group);
  const setDownload = useAvatarConfiguratorStore((state) => state.setDownload);

  useFrame(() => {
    const action = actions[pose];
    if (action) {
      action.timeScale = paused ? 0 : timeScale;
    }
  });

  useEffect(() => {
    if (propCustomization) return; // Skip in-game export registration
    
    function download() {
      if (!group.current) return;
      const exporter = new GLTFExporter();
      exporter.parse(
        group.current,
        async function (result) {
          let rawData: ArrayBuffer;
          if (result instanceof ArrayBuffer) {
            rawData = result;
          } else {
            rawData = new TextEncoder().encode(JSON.stringify(result)).buffer;
          }

          // Prepare the raw binary GLB
          const rawBlob = new Blob([rawData], { type: "application/octet-stream" });
          const filename = `avatar_${+new Date()}.glb`;

          try {
            console.log("📤 Uploading raw GLB to server for optimization...");
            const formData = new FormData();
            formData.append("file", rawBlob, filename);

            const response = await fetch(`${API_BASE_URL}/api/export/optimize`, {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              throw new Error(`Server optimization failed: ${response.statusText}`);
            }

            const optimizedBlob = await response.blob();
            save(optimizedBlob, filename);
            console.log("🎉 Server-side Draco + WebP optimization complete.");
          } catch (serverErr) {
            console.warn("⚠️ Server optimization failed, falling back to client-side...", serverErr);
            try {
              const io = new NodeIO();
              const document = await io.readBinary(new Uint8Array(rawData)); // Uint8Array → Document
              await document.transform(
                // Remove unused nodes, textures, or other data.
                prune(),
                // Remove duplicate vertex or texture data, if any.
                dedup(),
                // Compress mesh geometry with Draco.
                draco(),
                // Quantize mesh geometry.
                quantize()
              );

              // Write.
              const glb = await io.writeBinary(document); // Document → Uint8Array
              save(
                new Blob([glb as any], { type: "application/octet-stream" }),
                filename
              );
            } catch (clientErr) {
              console.error("❌ Client-side fallback also failed, saving raw GLB...", clientErr);
              save(rawBlob, filename);
            }
          }
        },
        function (error) {
          console.error(error);
        },
        { binary: true, animations, onlyVisible: true }
      );
    }

    const link = document.createElement("a");
    link.style.display = "none";
    document.body.appendChild(link); // Firefox workaround, see #6594

    function save(blob: Blob, filename: string) {
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    }
    setDownload(download);

    return () => {
      document.body.removeChild(link);
    };
  }, [setDownload, animations, propCustomization]);

  const equippedWeaponAsset = customization["Weapon"]?.asset;

  useEffect(() => {
    // Hide all internal hardcoded weapon meshes in Armature.glb
    const internalWeapons = ["Sword", "Battle_Scythe", "Battle_Hammer", "Battle_Bow", "Battle_Axe", "Arrow"];
    internalWeapons.forEach((meshName) => {
      const mesh = nodes[meshName];
      if (mesh) {
        mesh.visible = false;
      }
    });
  }, [nodes]);

  useEffect(() => {
    const action = actions[pose];
    if (action) {
      action.fadeIn(0.2).play();
      return () => {
        action.fadeOut(0.2).stop();
      };
    }
  }, [actions, pose]);

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <primitive object={nodes["mixamorig:Hips"] || nodes.mixamorigHips} />
          {Object.keys(customization).map(
            (key) =>
              key !== "Weapon" && customization[key]?.asset?.url && (
                <Suspense key={customization[key].asset!.id}>
                  <AvatarAsset
                    categoryName={key}
                    url={`${API_BASE_URL}${customization[key].asset!.url}`}
                    skeleton={nodes.ARMS?.skeleton || nodes.Plane?.skeleton}
                    customization={customization}
                  />
                </Suspense>
              )
          )}
          {/* Render equipped weapon dynamically attached to RightHand bone using createPortal */}
          {(nodes["mixamorig:RightHand"] || nodes.mixamorigRightHand) && equippedWeaponAsset?.url && (
            createPortal(
              <Suspense fallback={null}>
                <WeaponAsset
                  assetId={equippedWeaponAsset.id}
                  url={`${API_BASE_URL}${equippedWeaponAsset.url}`}
                />
              </Suspense>,
              nodes["mixamorig:RightHand"] || nodes.mixamorigRightHand
            )
          )}
        </group>
      </group>
    </group>
  );
};

export const AvatarModel = ({ customization: propCustomization, pose: propPose, timeScale: propTimeScale, paused: propPaused, ...props }: any) => {
  const [animations, setAnimations] = useState<any[]>(() => globalCachedClips || []);
  
  useEffect(() => {
    if (animations.length === 0) {
      loadFBXAnimations().then(setAnimations);
    }
  }, [animations]);
  
  const storeCustomization = useAvatarConfiguratorStore((state) => state.customization);
  const customization = propCustomization || storeCustomization;

  const storePose = useAvatarConfiguratorStore((state) => state.pose);
  const pose = propPose || storePose;
  const timeScale = typeof propTimeScale === 'number' ? propTimeScale : 1.0;

  if (animations.length === 0) {
    return <AvatarModelStatic customization={customization} {...props} />;
  }

  return (
    <AvatarModelAnimated
      customization={customization}
      pose={pose}
      timeScale={timeScale}
      paused={propPaused}
      animations={animations}
      propCustomization={propCustomization}
      {...props}
    />
  );
};

export { AvatarModel as Avatar };
