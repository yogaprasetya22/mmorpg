import * as THREE from "three";

// Shared initial uniform values
const initialUniforms = {
    baseColor: new THREE.Color("#3d5c36"),
    peakColor: new THREE.Color("#95b58b"),
    rockColor: new THREE.Color("#5a5e52"),
    uSplatCol0: new THREE.Color("#3d5c36"),
    uSplatCol1: new THREE.Color("#7c6a4a"),
    uSplatCol2: new THREE.Color("#5a4d3a"),
    uSplatCol3: new THREE.Color("#e8e0d0"),
};

// ── WebGPU Material & TSL Setup ──
let webgpuMaterial: any = null;
let tslUniforms: any = null;
let dummyTex: any = null;
let initPromise: Promise<void> | null = null;

export async function initWebGPUMaterial() {
    if (webgpuMaterial) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const { MeshStandardNodeMaterial, Texture } =
            await import("three/webgpu");
        const tsl = await import("three/tsl");

        dummyTex = new Texture();

        tslUniforms = {
            baseColor: tsl.uniform(initialUniforms.baseColor),
            peakColor: tsl.uniform(initialUniforms.peakColor),
            rockColor: tsl.uniform(initialUniforms.rockColor),
            uMap: tsl.texture(dummyTex),
            uUseMap: tsl.uniform(0.0),
            uPaintMap: tsl.texture(dummyTex),
            uUsePaint: tsl.uniform(0.0),
            uSplatTex0: tsl.texture(dummyTex),
            uSplatTex1: tsl.texture(dummyTex),
            uSplatTex2: tsl.texture(dummyTex),
            uSplatTex3: tsl.texture(dummyTex),
            uSplatCol0: tsl.uniform(initialUniforms.uSplatCol0),
            uSplatCol1: tsl.uniform(initialUniforms.uSplatCol1),
            uSplatCol2: tsl.uniform(initialUniforms.uSplatCol2),
            uSplatCol3: tsl.uniform(initialUniforms.uSplatCol3),
            uUseSplat0: tsl.uniform(0.0),
            uUseSplat1: tsl.uniform(0.0),
            uUseSplat2: tsl.uniform(0.0),
            uUseSplat3: tsl.uniform(0.0),
            uBrushTex: tsl.texture(dummyTex),
            uUseBrushTex: tsl.uniform(0.0),
        };

        const {
            float,
            vec2,
            vec3,
            smoothstep,
            mix,
            positionLocal,
            positionWorld,
            normalWorld,
            uv,
            fract,
            floor,
        } = tsl;

        const hashNode = (p: any) => {
            const p1 = fract(p.mul(vec2(123.34, 456.21)));
            const p2 = (p1 as any).add((p1 as any).dot(p1.add(float(45.32))));
            return fract((p2 as any).x.mul((p2 as any).y));
        };

        const painterlyNoiseNode = (p: any) => {
            const i = floor(p);
            const f = fract(p);
            const f_stepped = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
            const a = hashNode(i);
            const b = hashNode(i.add(vec2(1.0, 0.0)));
            const c = hashNode(i.add(vec2(0.0, 1.0)));
            const d = hashNode(i.add(vec2(1.0, 1.0)));
            return mix(
                mix(a, b, (f_stepped as any).x),
                mix(c, d, (f_stepped as any).x),
                (f_stepped as any).y,
            );
        };

        const brushstrokesNode = (p: any, scale: any) => {
            const n0 = painterlyNoiseNode(p.mul(scale));
            const n1 = painterlyNoiseNode(p.mul(scale).mul(2.1)).mul(0.5);
            const n2 = painterlyNoiseNode(p.mul(scale).mul(4.3)).mul(0.25);
            return n0.add(n1).add(n2).div(1.75);
        };

        const toonMixNode = (c1: any, c2: any, t: any) => {
            const stepped = t.mul(4.0).floor().div(3.0);
            return mix(c1, c2, stepped.clamp(float(0), float(1)));
        };

        const sampleTriplanarNode = (
            texNode: any,
            posNode: any,
            blendNode: any,
            scaleNode: any,
        ) => {
            const x = texNode.sample(posNode.zy.mul(scaleNode)).rgb;
            const y = texNode.sample(posNode.xz.mul(scaleNode)).rgb;
            const z = texNode.sample(posNode.xy.mul(scaleNode)).rgb;
            return x
                .mul(blendNode.x)
                .add(y.mul(blendNode.y))
                .add(z.mul(blendNode.z));
        };

        const elevation = positionLocal.z;
        const strokesVal = brushstrokesNode(
            positionWorld.xz.mul(0.053),
            float(0.35),
        );
        const tNode = smoothstep(float(0.0), float(35.0), elevation).add(
            strokesVal.mul(0.08),
        );
        let mountainColor = toonMixNode(
            tslUniforms.baseColor,
            tslUniforms.peakColor,
            tNode.mul(1.5),
        );

        const rockMask = smoothstep(float(22.0), float(35.0), elevation);
        mountainColor = mix(
            mountainColor,
            tslUniforms.rockColor,
            rockMask.mul(0.6),
        );

        const TEX_SCALE = float(0.02);
        const triplanarNorm = normalWorld.normalize() as any;
        const triplanarBlend = triplanarNorm.abs().pow(float(4.0));
        const blendNode = triplanarBlend.div(
            triplanarBlend.x.add(triplanarBlend.y).add(triplanarBlend.z),
        ) as any;

        const floorTex = sampleTriplanarNode(
            tslUniforms.uMap,
            positionWorld,
            blendNode,
            TEX_SCALE,
        );
        const floorMask = smoothstep(float(12.0), float(5.0), elevation);
        let finalColor = mix(
            mountainColor as any,
            floorTex as any,
            floorMask.mul(tslUniforms.uUseMap) as any,
        ) as any;

        const splat = tslUniforms.uPaintMap.sample(uv()) as any;
        const splatBase0 = mix(
            tslUniforms.uSplatCol0 as any,
            sampleTriplanarNode(
                tslUniforms.uSplatTex0,
                positionWorld,
                blendNode,
                TEX_SCALE,
            ) as any,
            tslUniforms.uUseSplat0 as any,
        ) as any;
        const splat0Factor = (float(0.0) as any).max(
            (float(1.0) as any).sub(splat.r.add(splat.g).add(splat.b)),
        ) as any;
        finalColor = mix(
            finalColor as any,
            splatBase0 as any,
            splat0Factor.mul(tslUniforms.uUsePaint) as any,
        ) as any;

        const splatBase1 = mix(
            tslUniforms.uSplatCol1 as any,
            sampleTriplanarNode(
                tslUniforms.uSplatTex1,
                positionWorld,
                blendNode,
                TEX_SCALE,
            ) as any,
            tslUniforms.uUseSplat1 as any,
        ) as any;
        finalColor = mix(
            finalColor as any,
            splatBase1 as any,
            splat.r.mul(tslUniforms.uUsePaint) as any,
        ) as any;

        const splatBase2 = mix(
            tslUniforms.uSplatCol2 as any,
            sampleTriplanarNode(
                tslUniforms.uSplatTex2,
                positionWorld,
                blendNode,
                TEX_SCALE,
            ) as any,
            tslUniforms.uUseSplat2 as any,
        ) as any;
        finalColor = mix(
            finalColor as any,
            splatBase2 as any,
            splat.g.mul(tslUniforms.uUsePaint) as any,
        ) as any;

        const splatBase3 = mix(
            tslUniforms.uSplatCol3 as any,
            sampleTriplanarNode(
                tslUniforms.uSplatTex3,
                positionWorld,
                blendNode,
                TEX_SCALE,
            ) as any,
            tslUniforms.uUseSplat3 as any,
        ) as any;
        finalColor = mix(
            finalColor as any,
            splatBase3 as any,
            splat.b.mul(tslUniforms.uUsePaint) as any,
        ) as any;

        const road = smoothstep(
            float(6.0) as any,
            float(3.0) as any,
            positionWorld.x.abs().mul(0.2) as any,
        ) as any;
        finalColor = mix(
            finalColor as any,
            vec3(0.5, 0.45, 0.4) as any,
            road.mul(0.4).mul(floorMask) as any,
        ) as any;

        webgpuMaterial = new MeshStandardNodeMaterial({
            roughness: 0.85,
            metalness: 0.15,
        });
        webgpuMaterial.colorNode = finalColor;
    })();

    return initPromise;
}

export function getActiveTerrainMaterial() {
    return webgpuMaterial;
}

// ── Uniforms Proxy — routes uniform writes to TSL nodes ──
const uniformsProxy = new Proxy({} as any, {
    get(_, prop: string) {
        return {
            get value() {
                return tslUniforms?.[prop]?.value;
            },
            set value(newVal: any) {
                if (tslUniforms?.[prop]) {
                    if (tslUniforms[prop].isTextureNode) {
                        tslUniforms[prop].value = newVal || dummyTex;
                    } else {
                        tslUniforms[prop].value = newVal;
                    }
                }
            },
        };
    },
});

// Proxy that looks like a Material to external modules
export const TerrainMaterial = new Proxy({} as any, {
    get(_, prop: string) {
        if (prop === "uniforms") return uniformsProxy;
        return webgpuMaterial?.[prop];
    },
    set(_, prop: string, value: any) {
        if (webgpuMaterial) webgpuMaterial[prop] = value;
        return true;
    },
});
