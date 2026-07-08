import * as THREE from "three";

/**
 * Shared GLSL snippets for painterly effects
 * @deprecated ShaderMaterial utilities — use NodeMaterial+TSL equivalents for WebGPU.
 */
export const PainterlyShaderUtils = {
    snoise: `
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
            vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
            m = m*m;
            m = m*m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
    `,
    brushstrokeNoise: `
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }
        float painterlyNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float brushstrokes(vec2 p, float scale) {
            float n = 0.0;
            n += painterlyNoise(p * scale);
            n += painterlyNoise(p * scale * 2.1) * 0.5;
            n += painterlyNoise(p * scale * 4.3) * 0.25;
            return n / 1.75;
        }
    `,
    toonMix: `
        vec3 toonMix(vec3 c1, vec3 c2, float t) {
            float stepped = floor(t * 4.0) / 3.0;
            return mix(c1, c2, clamp(stepped, 0.0, 1.0));
        }
    `,
};

/** @deprecated Use createPainterlyWaterMaterial() (from painterly-client.ts) in useMemo instead. */
export const PainterlyWaterMaterial: any = null;

/**
 * @deprecated Dead code — PainterlyTerrainMaterial not used anywhere.
 * Will be removed in future cleanup.
 */
export const PainterlyTerrainMaterial: any = null;

/**
 * applyPainterlyStyle — onBeforeCompile hook (WebGL-only).
 *
 * For WebGPU: onBeforeCompile does not work. The painterly effect requires
 * manual NodeMaterial construction instead. For now, skip painterly style
 * on WebGPU renderers.
 *
 * @param material - MeshStandardMaterial to patch (WebGL) or skip (WebGPU).
 * ponytail: when WebGPU terrain assets need painterly style, build PainterlyNodeMaterial factory.
 * add when: WebGPU-specific terrain rendering enabled.
 */
export const applyPainterlyStyle = (material: THREE.Material) => {
    material.onBeforeCompile = (
        shader: THREE.WebGLProgramParametersWithUniforms,
    ) => {
        shader.uniforms.time = { value: 0 };

        shader.vertexShader = `
            varying vec3 vWorldPos;
            varying vec3 vPainterlyNormal;
            ${shader.vertexShader}
        `.replace(
            "#include <worldpos_vertex>",
            `
            #include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vPainterlyNormal = normalize(normalMatrix * normal);
            `,
        );

        shader.fragmentShader = `
            uniform float time;
            varying vec3 vWorldPos;
            varying vec3 vPainterlyNormal;
            ${PainterlyShaderUtils.brushstrokeNoise}
            ${shader.fragmentShader}
        `
            .replace(
                "#include <color_fragment>",
                `
            #include <color_fragment>
            float strokes = brushstrokes(vWorldPos.xz * 15.0 + vWorldPos.y * 5.0, 0.4);
            diffuseColor.rgb *= (0.85 + 0.3 * strokes);
            `,
            )
            .replace(
                "#include <opaque_fragment>",
                `
            #include <opaque_fragment>
            vec3 normalVec = normalize(vPainterlyNormal);
            float rim = 1.0 - max(0.0, dot(normalVec, vec3(0.0, 0.0, 1.0)));

            float pulse = (0.8 + 0.2 * sin(time * 4.0));

            vec3 shieldCol = emissive;
            float shieldLower = pow(rim, 4.0);
            float shieldUpper = pow(rim, 1.5) * 0.6;

            gl_FragColor.rgb += shieldCol * (shieldLower + shieldUpper) * pulse * 3.5;

            gl_FragColor.rgb += pow(rim, 4.0) * gl_FragColor.rgb * 0.2;
            `,
            );

        material.userData.painterlyShader = shader;
    };
};
