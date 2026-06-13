const fs = require('fs');
const path = require('path');

const glbPath = path.resolve(__dirname, "../backend/assets/characters/base/Armature.glb");
const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

async function run() {
  const { GLTFLoader } = await import('three-stdlib');
  const loader = new GLTFLoader();
  loader.parse(arrayBuffer, "", (gltf) => {
    const names = [];
    gltf.scene.traverse((child) => {
      if (child.name) {
        names.push(child.name);
      }
    });
    console.log("Three.js GLTFLoader parsed names:");
    console.log(JSON.stringify(names.filter(n => n.includes("Hand") || n.includes("Hips")), null, 2));
  }, (err) => {
    console.error("Parse error:", err);
  });
}

run().catch(console.error);
