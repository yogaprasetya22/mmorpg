'use client';

import { NodeIO } from "@gltf-transform/core";
import { dedup, draco, prune, quantize } from "@gltf-transform/functions";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useRef, useMemo, useState, useImperativeHandle } from "react";
import { GLTFExporter, FBXLoader, SkeletonUtils } from "three-stdlib";
import { API_BASE_URL } from "@/src/core/config";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";
import { AvatarAsset } from "./AvatarAsset";
import * as THREE from "three";
import { createPortal, useFrame } from "@react-three/fiber";
import { getWeaponConfig } from "./weaponConfigs";

interface WeaponAssetProps {
  assetId: string;
  url: string;
  isConfigurator?: boolean;
  onHandChange?: (hand: "left" | "right") => void;
}

const WeaponAssetStatic = ({ assetId, url }: { assetId: string; url: string }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  // Load offset configuration (dynamic from localStorage if customized)
  const defaultOffset = useMemo(() => getWeaponConfig(assetId), [assetId]);

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

const useSafeLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const WeaponAssetConfigurable = ({ assetId, url, onHandChange }: { assetId: string; url: string; onHandChange?: (hand: "left" | "right") => void }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const weaponRef = useRef<THREE.Group>(null);

  // Read active editor configurations from Zustand
  const weaponOffsetTrigger = useAvatarConfiguratorStore((state) => state.weaponOffsetTrigger);
  const registerWeaponRef = useAvatarConfiguratorStore((state) => state.registerWeaponRef);
  const unregisterWeaponRef = useAvatarConfiguratorStore((state) => state.unregisterWeaponRef);

  // Load offset configuration (dynamic from localStorage if customized, re-evaluated on trigger)
  const defaultOffset = useMemo(() => getWeaponConfig(assetId), [assetId, weaponOffsetTrigger]);

  // Register/unregister the 3D group ref with the store safely on mount/unmount/change
  useSafeLayoutEffect(() => {
    const currentRef = weaponRef.current;
    if (currentRef) {
      registerWeaponRef(assetId, currentRef);
    }
    return () => {
      unregisterWeaponRef(assetId);
    };
  }, [assetId, registerWeaponRef, unregisterWeaponRef]);

  // Synchronize initial offset configuration to the HUD coordinate readout
  useEffect(() => {
    const eventDetail = {
      assetId,
      position: defaultOffset.position,
      rotation: defaultOffset.rotation,
      scale: defaultOffset.scale,
    };
    window.dispatchEvent(new CustomEvent("weapon-offset-change", { detail: eventDetail }));
  }, [assetId, defaultOffset]);

  // Propagate hand changes up to parent so it mounts portal to the correct hand bone
  useEffect(() => {
    if (onHandChange) {
      onHandChange(defaultOffset.hand);
    }
  }, [defaultOffset.hand, onHandChange]);

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
      ref={weaponRef}
      position={defaultOffset.position as [number, number, number]} 
      rotation={defaultOffset.rotation as [number, number, number]} 
      scale={defaultOffset.scale as [number, number, number]}
    >
      <primitive object={clonedScene} />
    </group>
  );
};

const WeaponAsset = ({ assetId, url, isConfigurator = false, onHandChange }: WeaponAssetProps) => {
  if (isConfigurator) {
    return <WeaponAssetConfigurable assetId={assetId} url={url} onHandChange={onHandChange} />;
  }
  return <WeaponAssetStatic assetId={assetId} url={url} />;
};

// Global cache for loaded Mixamo FBX AnimationClips to prevent redundant HTTP loads
let globalCachedClips: any[] | null = null;
let animationLoadingPromise: Promise<any[]> | null = null;

const ANIMATION_FILES: Record<string, string> = {
  // ── Locomotion ──
  "Idle": "/assets/animations/fbx/locomotion/idle.fbx",
  "Walking": "/assets/animations/fbx/locomotion/walking.fbx",
  "Jogging": "/assets/animations/fbx/locomotion/jogging.fbx",
  "Slow Run": "/assets/animations/fbx/locomotion/slow_run.fbx",
  "Run With Sword": "/assets/animations/fbx/locomotion/run_with_sword.fbx",
  "Fast Run": "/assets/animations/fbx/locomotion/fast_run.fbx",
  "Jump With Sword": "/assets/animations/fbx/locomotion/jump_with_sword.fbx",
  // ── Combat ──
  "Stable Sword Outward Slash": "/assets/animations/fbx/combat/stable_sword_outward_slash.fbx",
  "Magic Heal": "/assets/animations/fbx/combat/magic_heal.fbx",
  "Standing Draw Arrow": "/assets/animations/fbx/combat/standing_draw_arrow.fbx",
  // ── Damage / Debuff ──
  "Light Hit To Head": "/assets/animations/fbx/damage/light_hit_to_head.fbx",
  "Stunned": "/assets/animations/fbx/locomotion/stunned.fbx",
  "Dizzy": "/assets/animations/fbx/locomotion/dizzy.fbx",
  // ── Death ──
  "Standing React Death Right": "/assets/animations/fbx/damage/standing_react_death_right.fbx",
  "Sword And Shield Death": "/assets/animations/fbx/damage/sword_and_shield_death.fbx",
  "Standing Death Forward Archer": "/assets/animations/fbx/damage/standing_death_forward_archer.fbx"
};

// Locomotion clips: strip root Hips position & rotation tracks so BVHEcctrl
// has full control over world-space movement and facing direction.
// Without this, the FBX's forward hip displacement causes visible "snap-back"
// on loop, and the hip rotation fights BVHEcctrl's turn logic.
const LOCOMOTION_CLIPS = new Set([
  "Walking", "Jogging", "Slow Run", "Run With Sword", "Fast Run", "Jump With Sword",
]);

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
          
          const isLocomotion = LOCOMOTION_CLIPS.has(name);
          const correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

          if (isLocomotion) {
            // ── Locomotion: strip root Hips tracks entirely ──
            // BVHEcctrl drives world-space position & rotation.  Keeping the
            // FBX hips.position track would cause forward-displacement snap-back
            // on loop; keeping hips.quaternion would fight the controller's turn.
            clip.tracks = clip.tracks.filter((t: any) => {
              const n = t.name;
              if (n.startsWith("Armature.")) return false;
              if (n === "mixamorigHips.position" || n === "mixamorig:Hips.position") return false;
              if (n === "mixamorigHips.quaternion" || n === "mixamorig:Hips.quaternion") return false;
              return true;
            });
          } else {
            // ── Combat / Damage / Death: keep root tracks with correction ──
            // These clips need hips rotation for dramatic effect (flinch tilt,
            // death fall direction) and hips position for vertical bounce.
            const hipsRotTrack = clip.tracks.find((t: any) => t.name === "mixamorigHips.quaternion" || t.name === "mixamorig:Hips.quaternion");
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
                values[i+2] = v.z - 8.11; // Offset Hips translation to align foot animation with ground
              }
            }

            // Prune root tracks targeting "Armature"
            clip.tracks = clip.tracks.filter((t: any) => !t.name.startsWith("Armature."));
          }
          
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

const AvatarModelStatic = ({ customization, isConfigurator = false, ...props }: any) => {
  const gltf = useGLTF(`${API_BASE_URL}/assets/characters/base/Armature.glb`) as any;
  const equippedWeaponAsset = customization["Weapon"]?.asset;
  const [currentHand, setCurrentHand] = useState<"left" | "right">("right");
  const weaponOffsetTrigger = useAvatarConfiguratorStore((state) => state.weaponOffsetTrigger);

  useEffect(() => {
    if (equippedWeaponAsset?.id) {
      setCurrentHand(getWeaponConfig(equippedWeaponAsset.id)?.hand || "right");
    }
  }, [equippedWeaponAsset?.id, weaponOffsetTrigger]);

  // Clone the cached GLTF scene to ensure each static player has unique bones/skeletons
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

  // Auto-compute Y offset so character feet sit exactly at model origin (ground level).
  // The GLB's Armature applies rotation [0.707,0,0,0.707] + scale 0.01, so after
  // our React rotation [PI/2,0,0] + scale 0.01 the net transform places feet below
  // Y=0 in world space. We measure the bounding box and compensate inside the
  // Armature's local coordinate space (before rotation & scale).
  const armatureLocalYOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const feetWorldY = box.min.y;
    if (feetWorldY >= -0.01) return 0;
    // In world space the net transform maps Armature local Y to world Y with a
    // sign flip (local +Y → world -Y) and 0.01 scale, so:
    //   worldY = -(armatureLocalY) * 0.01 + currentFeetWorldY
    // To bring feet to world Y = 0:  armatureLocalY = -feetWorldY / 0.01
    return Math.round(-feetWorldY / 0.01 * 10) / 10;
  }, [gltf.scene]);

  // Re-build nodes lookup from unique clone
  const nodes = useMemo(() => {
    const result: Record<string, any> = {};
    clone.traverse((child: any) => {
      if (child.name) {
        result[child.name] = child;
      }
    });
    if (typeof window === "undefined") {
      try {
        require("fs").writeFileSync("/home/yoga/Dokumen/game mmorpg/scratch/nodes_keys.json", JSON.stringify(Object.keys(result), null, 2));
      } catch (e) {}
    }
    return result;
  }, [clone]);

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
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01} position={[0, armatureLocalYOffset, 0]}>
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
          {/* Render equipped weapon dynamically using createPortal */}
          {(() => {
            if (!equippedWeaponAsset?.url) return null;
            const elements: React.ReactNode[] = [];

            // Primary weapon placement
            const primaryHandNode = currentHand === "left"
              ? (nodes["mixamorig:LeftHand"] || nodes.mixamorigLeftHand)
              : (nodes["mixamorig:RightHand"] || nodes.mixamorigRightHand);

            if (primaryHandNode) {
              elements.push(
                <Suspense key={`primary-weapon-${equippedWeaponAsset.id}-${currentHand}`} fallback={null}>
                  {createPortal(
                    <WeaponAsset
                      assetId={equippedWeaponAsset.id}
                      url={`${API_BASE_URL}${equippedWeaponAsset.url}`}
                      isConfigurator={isConfigurator}
                      onHandChange={isConfigurator ? setCurrentHand : undefined}
                    />,
                    primaryHandNode
                  )}
                </Suspense>
              );
            }

            return elements;
          })()}
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
  controlRef,
  skipAnimControl,
  isConfigurator = false,
  onAttackLoop,
  ...props
}: any) => {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(`${API_BASE_URL}/assets/characters/base/Armature.glb`) as any;
  const { actions, mixer } = useAnimations(animations, group);
  const setDownload = useAvatarConfiguratorStore((state) => state.setDownload);
  const equippedWeaponAsset = customization["Weapon"]?.asset;
  const [currentHand, setCurrentHand] = useState<"left" | "right">("right");
  const weaponOffsetTrigger = useAvatarConfiguratorStore((state) => state.weaponOffsetTrigger);

  useEffect(() => {
    if (equippedWeaponAsset?.id) {
      setCurrentHand(getWeaponConfig(equippedWeaponAsset.id)?.hand || "right");
    }
  }, [equippedWeaponAsset?.id, weaponOffsetTrigger]);

  // Clone the cached GLTF scene to ensure each player instance has unique bones/skeletons
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

  // Auto-compute Y offset so character feet sit exactly at model origin (ground level).
  const armatureLocalYOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const feetWorldY = box.min.y;
    if (feetWorldY >= -0.01) return 0;
    return Math.round(-feetWorldY / 0.01 * 10) / 10;
  }, [gltf.scene]);

  // Re-build nodes lookup from unique clone
  const nodes = useMemo(() => {
    const result: Record<string, any> = {};
    clone.traverse((child: any) => {
      if (child.name) {
        result[child.name] = child;
      }
    });
    return result;
  }, [clone]);

  useFrame(() => {
    if (skipAnimControl) return; // External controller manages timescale
    const action = actions[pose];
    if (action) {
      if (!action.isRunning()) {
        action.play();
      }
      action.timeScale = paused ? 0 : timeScale;
    }
  });

  // Track the currently active action for proper crossFade transitions.
  // Without this, fadeIn/fadeOut plays both clips in parallel causing a
  // visible "standing pose" artifact during the blend window.
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const prevPoseRef = useRef<string>("");

  useEffect(() => {
    if (skipAnimControl) return; // External controller manages crossfade
    const nextAction = actions[pose];
    if (!nextAction) return;

    const currentAction = activeActionRef.current;

    // Determine crossfade duration: locomotion transitions need longer
    // blending to avoid the "stiff standing pose" artifact.
    const locomotionPoses = new Set([
      "Idle", "Walking", "Jogging", "Slow Run", "Run With Sword", "Fast Run", "Jump With Sword",
    ]);
    const isLocomotionTransition =
      locomotionPoses.has(prevPoseRef.current) && locomotionPoses.has(pose);
    const duration = isLocomotionTransition ? 0.25 : 0.12;

    if (currentAction && currentAction !== nextAction) {
      // Proper crossfade: smoothly blends from current → next over `duration` seconds.
      // This avoids the "parallel play" artifact where both clips fight each other.
      nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
      currentAction.crossFadeTo(nextAction, duration, true);
      nextAction.fadeIn(duration).play();
    } else if (!currentAction) {
      // First animation — just fade in.
      nextAction.reset().fadeIn(0.15).play();
    }
    // If currentAction === nextAction, do nothing (already playing).

    activeActionRef.current = nextAction;
    prevPoseRef.current = pose;
  }, [actions, pose, skipAnimControl]);

  // ── Arrow Release via AnimationMixer 'loop' event ────────────────────────────
  // This is the ground-truth sync mechanism.  Three.js fires the 'loop' event
  // INSIDE mixer.update() at the exact moment the attack clip finishes one full
  // cycle.  No timing math needed — the engine IS the clock.
  useEffect(() => {
    if (typeof onAttackLoop !== 'function') return;
    const attackAction = actions?.["Standing Draw Arrow"];
    if (!attackAction || !mixer) return;

    const handleLoop = (e: any): void => {
      // Guard: only fire for the attack action, not any other looping clip.
      if (e.action !== attackAction) return;
      onAttackLoop(performance.now());
    };

    mixer.addEventListener('loop', handleLoop);
    return () => {
      mixer.removeEventListener('loop', handleLoop);
    };
  }, [actions, mixer, onAttackLoop]);

  // ── Imperative handle for external animation control ──
  // Allows parent components (e.g. RemotePlayerInstance) to drive
  // animation transitions directly from useFrame, bypassing React entirely.
  const _meshCache = useRef<THREE.Mesh[]>([]);
  useImperativeHandle(controlRef, () => ({
    setPose: (newPose: string) => {
      if (!actions || prevPoseRef.current === newPose) return;
      const nextAction = actions[newPose];
      if (!nextAction) return;
      const currentAction = activeActionRef.current;
      const locomotionPoses = new Set([
        "Idle", "Walking", "Jogging", "Slow Run", "Run With Sword", "Fast Run", "Jump With Sword",
      ]);
      const isLoco = locomotionPoses.has(prevPoseRef.current) && locomotionPoses.has(newPose);
      const dur = isLoco ? 0.25 : 0.12;
      if (currentAction && currentAction !== nextAction) {
        nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
        currentAction.crossFadeTo(nextAction, dur, true);
        nextAction.fadeIn(dur).play();
      } else if (!currentAction) {
        nextAction.reset().fadeIn(0.15).play();
      }
      activeActionRef.current = nextAction;
      prevPoseRef.current = newPose;
    },
    setTimeScale: (ts: number) => {
      const action = activeActionRef.current;
      if (action) action.timeScale = ts;
    },
    setPaused: (p: boolean) => {
      const action = activeActionRef.current;
      if (action) action.timeScale = p ? 0 : action.timeScale || 1;
    },
    setShadowEnabled: (enabled: boolean) => {
      // Cache mesh list on first call to avoid traversal every frame
      if (_meshCache.current.length === 0 && group.current) {
        group.current.traverse((child: any) => {
          if (child.isMesh) _meshCache.current.push(child);
        });
      }
      for (let i = 0; i < _meshCache.current.length; i++) {
        _meshCache.current[i].castShadow = enabled;
      }
    },
    actions,
    group,
  }), [actions]);

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

  // Note: animation playback is now handled by the crossFade useEffect above.
  // This effect only tracks customization changes for the export/download feature.

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01} position={[0, armatureLocalYOffset, 0]}>
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
          {/* Render equipped weapon dynamically using createPortal */}
          {(() => {
            if (!equippedWeaponAsset?.url) return null;
            const elements: React.ReactNode[] = [];

            // Primary weapon placement
            const primaryHandNode = currentHand === "left"
              ? (nodes["mixamorig:LeftHand"] || nodes.mixamorigLeftHand)
              : (nodes["mixamorig:RightHand"] || nodes.mixamorigRightHand);

            if (primaryHandNode) {
              elements.push(
                <Suspense key={`primary-weapon-${equippedWeaponAsset.id}-${currentHand}`} fallback={null}>
                  {createPortal(
                    <WeaponAsset
                      assetId={equippedWeaponAsset.id}
                      url={`${API_BASE_URL}${equippedWeaponAsset.url}`}
                      isConfigurator={isConfigurator}
                      onHandChange={isConfigurator ? setCurrentHand : undefined}
                    />,
                    primaryHandNode
                  )}
                </Suspense>
              );
            }

            return elements;
          })()}
        </group>
      </group>
    </group>
  );
};

export interface AvatarHandle {
  setPose: (pose: string) => void;
  setTimeScale: (ts: number) => void;
  setPaused: (paused: boolean) => void;
  setShadowEnabled: (enabled: boolean) => void;
  actions: Record<string, THREE.AnimationAction | null> | null | undefined;
  group: React.RefObject<THREE.Group>;
}

export const AvatarModel = ({ customization: propCustomization, pose: propPose, timeScale: propTimeScale, paused: propPaused, controlRef, skipAnimControl, isConfigurator = false, ...props }: any) => {
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
    return <AvatarModelStatic customization={customization} isConfigurator={isConfigurator} {...props} />;
  }

  return (
    <AvatarModelAnimated
      customization={customization}
      pose={pose}
      timeScale={timeScale}
      paused={propPaused}
      animations={animations}
      propCustomization={propCustomization}
      controlRef={controlRef}
      skipAnimControl={skipAnimControl}
      isConfigurator={isConfigurator}
      {...props}
    />
  );
};

export { AvatarModel as Avatar };
