const fs = require('fs');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(dir + '/' + file);
    if (stat.isDirectory()) {
      fileList = walk(dir + '/' + file, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(dir + '/' + file);
    }
  }
  return fileList;
}

const files = walk('./src').concat(walk('./app'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Global replacements
  content = content.replace(/@\/src\/components\/game\/player\/buffers/g, '@/src/entities/player/buffers');
  content = content.replace(/@\/src\/components\/game\/PlayerController/g, '@/src/entities/player/ui/PlayerController');
  
  // Specific internal replacements for PlayerController
  if (file.includes('PlayerController.tsx')) {
    content = content.replace(/from '\.\/systems\//g, "from '@/src/core/systems/"); // I haven't moved systems yet, let's point to components for now
    content = content.replace(/from '\.\/systems\//g, "from '@/src/components/game/systems/");
    content = content.replace(/from '\.\/avatar\//g, "from '@/src/components/game/avatar/");
    content = content.replace(/from '\.\/player\/use/g, "from '../hooks/use");
    content = content.replace(/from '\.\/player\/types'/g, "from '../types/player.types'");
    content = content.replace(/from '\.\/player\/buffers'/g, "from '../buffers'");
  }

  if (file.includes('entities/player/hooks')) {
    content = content.replace(/from '\.\/buffers'/g, "from '../buffers'");
    content = content.replace(/from '\.\/types'/g, "from '../types/player.types'");
  }

  // Old hooks in components/game/hooks
  if (file.includes('components/game/hooks')) {
    content = content.replace(/from '\.\.\/PlayerController\.buffers'/g, "from '@/src/entities/player/buffers'");
  }
  
  // WorldEditor
  if (file.includes('WorldEditor.tsx')) {
    content = content.replace(/from '\.\.\/player\/buffers'/g, "from '@/src/entities/player/buffers'");
  }

  // GameCanvas, ModularMap, ArenaClient
  if (file.includes('GameCanvas.tsx') || file.includes('ModularMap.tsx') || file.includes('ArenaClient.tsx')) {
    content = content.replace(/from ['"](\.\.\/)*components\/game\/PlayerController['"]/g, "from '@/src/entities/player/ui/PlayerController'");
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
