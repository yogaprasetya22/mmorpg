"use client";

import * as THREE from "three";

type TSL = typeof import("three/tsl");
let _tsl: TSL | null = null;
let _NodeMaterial: any = null;
let _loadPromise: Promise<void> | null = null;

async function loadTSLAndNodes() {
    if (!_loadPromise) {
        _loadPromise = (async () => {
            const tslModule = await import("three/tsl");
            const webgpuModule = await import("three/webgpu");
            _tsl = tslModule;
            _NodeMaterial = webgpuModule.NodeMaterial;
        })();
    }
    await _loadPromise;
    return { tsl: _tsl!, NodeMaterial: _NodeMaterial };
}

export async function createPainterlyWaterMaterial(): Promise<any> {
    const { tsl, NodeMaterial } = await loadTSLAndNodes();
    const {
        time,
        float,
        vec3,
        vec4,
        sin,
        cos,
        length,
        smoothstep,
        mix,
        positionLocal,
        positionWorld,
    } = tsl;

    const m = new NodeMaterial();
    m.transparent = true;
    m.side = THREE.DoubleSide;

    const wave1 = sin(positionWorld.x.mul(0.2).add(time.mul(1.5))).mul(0.1);
    const wave2 = cos(positionWorld.z.mul(0.15).add(time.mul(1.2))).mul(0.08);
    m.positionNode = positionLocal.add(vec3(0, wave1.add(wave2), 0));

    const c1 = vec3(0.0, 0.96, 0.83);
    const c2 = vec3(0.0, 0.73, 0.69);
    const strokes = sin(
        positionWorld.x
            .mul(0.5)
            .add(positionWorld.z.mul(0.5))
            .add(time.mul(0.1)),
    )
        .mul(0.5)
        .add(0.5);
    const stepped = strokes.mul(4.0).floor().div(3.0);
    const col = mix(c2, c1, stepped);
    const edge = smoothstep(float(200), float(100), length(positionWorld.xz));
    m.colorNode = vec4(col, edge.mul(0.9));
    return m;
}

export async function createPainterlyGrassMaterial(): Promise<any> {
    const { tsl, NodeMaterial } = await loadTSLAndNodes();
    const {
        time,
        float,
        vec3,
        vec4,
        uv,
        sin,
        cos,
        mix,
        positionLocal,
        positionWorld,
    } = tsl;

    const m = new NodeMaterial();
    m.side = THREE.DoubleSide;
    m.vertexColors = true;

    const wind1 = sin(
        time
            .mul(2.0)
            .add(positionWorld.x.mul(0.1))
            .add(positionWorld.z.mul(0.05)),
    ).mul(0.4);
    const wind2 = cos(time.mul(1.4).add(positionWorld.x.mul(0.08))).mul(0.16);
    const wind = wind1.add(wind2);
    const heightFactor = positionLocal.y.max(float(0));
    m.positionNode = positionLocal.add(
        vec3(wind.mul(heightFactor), 0, wind.mul(heightFactor).mul(0.6)),
    );

    const c1 = vec3(0.29, 0.49, 0.27);
    const c2 = vec3(0.62, 0.94, 0.1);
    const gradient = positionLocal.y
        .mul(0.5)
        .add(0.5)
        .clamp(float(0), float(1));
    const col = mix(c1, c2, gradient);
    const shimmer = sin(uv().x.mul(10.0).add(time)).mul(0.1).add(0.9);
    m.colorNode = vec4(col.mul(shimmer), 1.0);
    return m;
}
