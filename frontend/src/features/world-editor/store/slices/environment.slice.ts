/**
 * Environment slice — sky, lighting, fog, bloom, terrain material/color.
 *
 * Location: frontend/src/editor/app/store/slices/environment.slice.ts
 */

import type { StateCreator } from "zustand";

export interface EnvironmentSlice {
    sky: string;
    setSky: (sky: string) => void;
    environment: string;
    setEnvironment: (env: string) => void;
    lightIntensity: number | null;
    setLightIntensity: (intensity: number | null) => void;
    ambientIntensity: number | null;
    setAmbientIntensity: (intensity: number | null) => void;
    sunAngle: number;
    setSunAngle: (angle: number) => void;
    fogDensity: number;
    setFogDensity: (density: number) => void;
    skyboxIntensity: number | null;
    setSkyboxIntensity: (intensity: number | null) => void;
    bloomThreshold: number | null;
    setBloomThreshold: (threshold: number | null) => void;
    bloomStrength: number | null;
    setBloomStrength: (strength: number | null) => void;
    bloomRadius: number | null;
    setBloomRadius: (radius: number | null) => void;
    terrainMaterialId: string | null;
    setTerrainMaterialId: (id: string | null) => void;
    terrainColor: string;
    setTerrainColor: (color: string) => void;
}

export const createEnvironmentSlice: StateCreator<
    EnvironmentSlice,
    [],
    [],
    EnvironmentSlice
> = (set) => ({
    sky: "sunset",
    setSky: (sky) => set({ sky }),
    environment: "STORM",
    setEnvironment: (environment) => set({ environment }),
    lightIntensity: null,
    setLightIntensity: (lightIntensity) => set({ lightIntensity }),
    ambientIntensity: null,
    setAmbientIntensity: (ambientIntensity) => set({ ambientIntensity }),
    sunAngle: 45,
    setSunAngle: (sunAngle) => set({ sunAngle }),
    fogDensity: 0.002,
    setFogDensity: (fogDensity) => set({ fogDensity }),
    skyboxIntensity: null,
    setSkyboxIntensity: (skyboxIntensity) => set({ skyboxIntensity }),
    bloomThreshold: null,
    setBloomThreshold: (bloomThreshold) => set({ bloomThreshold }),
    bloomStrength: null,
    setBloomStrength: (bloomStrength) => set({ bloomStrength }),
    bloomRadius: null,
    setBloomRadius: (bloomRadius) => set({ bloomRadius }),
    terrainMaterialId: null,
    setTerrainMaterialId: (id) => set({ terrainMaterialId: id }),
    terrainColor: "#3d5c36",
    setTerrainColor: (color) => set({ terrainColor: color }),
});
