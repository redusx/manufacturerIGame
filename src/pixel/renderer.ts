import { PALETTE } from './palette';

export function createPixelCanvas(spriteMap: string[], scale: number = 1): HTMLCanvasElement {
  const height = spriteMap.length;
  const width = spriteMap[0].length;
  
  const canvas = document.createElement('canvas');
  // Ölçeğin tam sayı olduğundan emin olalım (devicePixelRatio gözetilebilir ama tam sayı kalmalı)
  const intScale = Math.max(1, Math.floor(scale));
  canvas.width = width * intScale;
  canvas.height = height * intScale;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  // Anti-aliasing kapalı
  ctx.imageSmoothingEnabled = false;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const char = spriteMap[y][x];
      if (char !== '.') {
        ctx.fillStyle = PALETTE[char] || '#000000';
        ctx.fillRect(x * intScale, y * intScale, intScale, intScale);
      }
    }
  }
  
  return canvas;
}

export function generatePhaserTexture(
  scene: Phaser.Scene, 
  key: string, 
  spriteMap: string[], 
  scale: number = 1
): void {
  if (scene.textures.exists(key)) return;
  const canvas = createPixelCanvas(spriteMap, scale);
  scene.textures.addCanvas(key, canvas);
}
