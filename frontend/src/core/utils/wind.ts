import * as THREE from 'three';

export const windUniforms = {
  time: { value: 0 }
};

export const applyWindSway = (material: THREE.Material, path: string) => {
  if (!material || !path) return;
  
  const pathLower = path.toLowerCase();
  const isGrassOrFlower = 
    pathLower.includes('grass') ||
    pathLower.includes('flower') ||
    pathLower.includes('clover') ||
    pathLower.includes('fern') ||
    pathLower.includes('plant') ||
    pathLower.includes('mushroom');
  
  const isVegetation = 
    isGrassOrFlower ||
    pathLower.includes('vegetation') ||
    pathLower.includes('bush') ||
    pathLower.includes('tree') ||
    pathLower.includes('pine') ||
    pathLower.includes('cherry') ||
    pathLower.includes('autumn');

  if (!isVegetation) return;

  const swayFactor = isGrassOrFlower ? 0.35 : 0.08;

  // Prevent double application
  if (material.userData && material.userData.windApplied) return;
  if (!material.userData) material.userData = {};
  material.userData.windApplied = true;

  const originalOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile(shader, renderer);
    }
    
    shader.uniforms.time = windUniforms.time;
    
    // Add uniform time if not present
    if (!shader.vertexShader.includes('uniform float time;')) {
      shader.vertexShader = `
        uniform float time;
      ` + shader.vertexShader;
    }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 instanceWorldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      #else
        vec4 instanceWorldPos = modelMatrix * vec4(position, 1.0);
      #endif
        float swayTime = time * 2.2;
        float wind = sin(swayTime + instanceWorldPos.x * 0.15 + instanceWorldPos.z * 0.1) * ${swayFactor};
        wind += cos(swayTime * 0.7 + instanceWorldPos.x * 0.08) * ${swayFactor * 0.4};
        float heightFactor = max(0.0, position.y);
        transformed.x += wind * heightFactor;
        transformed.z += wind * heightFactor * 0.6;
      `
    );
  };
};
