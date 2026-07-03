import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Configuration
const BACKEND_DIR = path.resolve('../backend/assets');
const OUT_DIR = path.resolve('../backend/assets/thumbs');
const MANIFEST_PATH = path.resolve('src/features/world-editor/core/blueprints.manifest.json');
const SIZE = 256;
const API_BASE_URL = 'http://localhost:8080';

type ManifestItem = {
  id: string;
  name: string;
  modelUrl: string;
  thumbnailUrl?: string;
  category: 'all' | 'trees' | 'vegetation' | 'rocks' | 'characters' | 'materials';
};

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listModelFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(listModelFiles(filePath));
    } else if (file.endsWith('.glb') || file.endsWith('.gltf')) {
      results.push(filePath);
    }
  }
  return results;
}

function toModelWebPath(absPath: string): string {
  const rel = path.relative(path.resolve('../backend/assets'), absPath).replaceAll('\\', '/');
  return `/assets/${rel}`;
}

function determineCategory(filePath: string): ManifestItem['category'] {
  const lower = filePath.toLowerCase();
  if (lower.includes('/trees/')) return 'trees';
  if (lower.includes('/vegetation/')) return 'vegetation';
  if (lower.includes('/rocks/')) return 'rocks';
  if (lower.includes('/characters/')) return 'characters';
  if (lower.includes('/materials/')) return 'materials';
  return 'all';
}

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: #111216; overflow: hidden; }
    canvas { width: ${SIZE}px; height: ${SIZE}px; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
</head>
<body>
  <canvas id="canvas" width="${SIZE}" height="${SIZE}"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(${SIZE}, ${SIZE});
    renderer.setPixelRatio(1);
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111216');
    
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);
    
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);
    
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    window.renderModel = async function(modelUrl) {
      // Clear previous children (keep lights)
      while(scene.children.length > 3) {
        scene.remove(scene.children[scene.children.length - 1]);
      }
      
      const loader = new THREE.GLTFLoader();
      return new Promise((resolve, reject) => {
        loader.load(modelUrl, (gltf) => {
          const model = gltf.scene;
          
          // Center model geometry to get clean angles
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          
          scene.add(model);
          
          // Recalculate camera position based on centered object
          const newBox = new THREE.Box3().setFromObject(model);
          const size = newBox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          
          const fov = (camera.fov * Math.PI) / 180;
          let cameraZ = Math.abs((maxDim / 2) * Math.tan(Math.PI / 2 - fov / 2));
          cameraZ *= 1.9; // Padding
          
          camera.position.set(maxDim * 0.85, maxDim * 0.6, cameraZ);
          camera.lookAt(new THREE.Vector3(0, 0, 0));
          camera.near = 0.01;
          camera.far = maxDim * 20;
          camera.updateProjectionMatrix();
          
          // Render multiple times to ensure loading completed
          renderer.render(scene, camera);
          setTimeout(() => {
            renderer.render(scene, camera);
            resolve(canvas.toDataURL('image/webp', 0.9));
          }, 50);
        }, undefined, (err) => {
          reject(err);
        });
      });
    }
  </script>
</body>
</html>
`;

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(path.dirname(MANIFEST_PATH));

  const modelFiles = listModelFiles(BACKEND_DIR);
  const manifest: ManifestItem[] = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    : [];

  const byModel = new Map(manifest.map((m) => [m.modelUrl, m]));

  console.log('Launching headless browser via Playwright...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set HTML Page with ThreeJS scripts
  await page.setContent(htmlContent);

  for (const file of modelFiles) {
    const base = path.basename(file, path.extname(file));
    const outWebpPath = path.join(OUT_DIR, `${base}.webp`);
    const modelUrl = toModelWebPath(file);
    const fullModelUrl = `${API_BASE_URL}${modelUrl}`;
    const category = determineCategory(file);

    // Skip generating if it is a directory itself or already generated (optional, here we recreate for fresh assets)
    console.log(`Rendering: ${base}...`);
    try {
      const dataUrl = await page.evaluate(async (url) => {
        return await (window as any).renderModel(url);
      }, fullModelUrl);

      const base64Data = dataUrl.replace(/^data:image\/webp;base64,/, '');
      fs.writeFileSync(outWebpPath, Buffer.from(base64Data, 'base64'));
      console.log(`Success: Generated webp thumbnail for ${base}`);
    } catch (e) {
      console.error(`Failed to render ${base}:`, e);
      continue;
    }

    const thumbWebUrl = `/assets/thumbs/${base}.webp`;

    if (byModel.has(modelUrl)) {
      const existing = byModel.get(modelUrl)!;
      existing.thumbnailUrl = thumbWebUrl;
      existing.category = category;
    } else {
      manifest.push({
        id: base.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: base.replace(/[-_]/g, ' '),
        modelUrl,
        thumbnailUrl: thumbWebUrl,
        category,
      });
    }
  }

  await browser.close();

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('Manifest updated successfully:', MANIFEST_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
