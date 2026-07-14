import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

function noise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

export class TextureMixer {
  private scene: Phaser.Scene;
  private cache: Map<string, string> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  mixTextures(keyA: string, keyB: string, ratio: number, outputKey: string): string {
    if (ratio <= 0.01) return keyA;
    if (ratio >= 0.99) return keyB;

    const r = Math.round(ratio * 100) / 100;
    const cacheKey = `${keyA}_${keyB}_${r}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d')!;

    const texA = this.scene.textures.get(keyA);
    if (texA && texA.getSourceImage()) {
      ctx.drawImage(texA.getSourceImage() as HTMLImageElement, 0, 0, TILE_SIZE, TILE_SIZE);
    }

    ctx.globalAlpha = r;
    const texB = this.scene.textures.get(keyB);
    if (texB && texB.getSourceImage()) {
      ctx.drawImage(texB.getSourceImage() as HTMLImageElement, 0, 0, TILE_SIZE, TILE_SIZE);
    }
    ctx.globalAlpha = 1;

    if (this.scene.textures.exists(outputKey)) {
      this.scene.textures.remove(outputKey);
    }
    this.scene.textures.addCanvas(outputKey, canvas);

    this.cache.set(cacheKey, outputKey);
    return outputKey;
  }

  blendBoundary(
    keyA: string, keyB: string,
    tileX: number, tileY: number,
    neighbors: { dx: number; dy: number; type: string }[],
    outputKey: string
  ): string {
    const cacheKey = `boundary_${tileX}_${tileY}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d')!;

    const texA = this.scene.textures.get(keyA);
    if (texA && texA.getSourceImage()) {
      ctx.drawImage(texA.getSourceImage() as HTMLImageElement, 0, 0, TILE_SIZE, TILE_SIZE);
    }

    const texB = this.scene.textures.get(keyB);
    if (!texB || !texB.getSourceImage()) {
      if (this.scene.textures.exists(outputKey)) this.scene.textures.remove(outputKey);
      this.scene.textures.addCanvas(outputKey, canvas);
      this.cache.set(cacheKey, outputKey);
      return outputKey;
    }

    const imgB = texB.getSourceImage() as HTMLImageElement;

    for (const n of neighbors) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = TILE_SIZE;
      maskCanvas.height = TILE_SIZE;
      const maskCtx = maskCanvas.getContext('2d')!;

      maskCtx.drawImage(imgB, 0, 0, TILE_SIZE, TILE_SIZE);

      const maskData = maskCtx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
      const pixels = maskData.data;

      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const idx = (py * TILE_SIZE + px) * 4;

          let edgeDist = 1;
          if (n.dx === 1) edgeDist = (TILE_SIZE - 1 - px) / TILE_SIZE;
          else if (n.dx === -1) edgeDist = px / TILE_SIZE;
          else if (n.dy === 1) edgeDist = (TILE_SIZE - 1 - py) / TILE_SIZE;
          else if (n.dy === -1) edgeDist = py / TILE_SIZE;

          const nVal = noise(px + tileX * TILE_SIZE, py + tileY * TILE_SIZE, 7777 + n.dx * 3 + n.dy * 5);
          const threshold = edgeDist + (nVal - 0.5) * 0.35;

          const alpha = threshold < 0.25 ? 0 : Math.min(1, (threshold - 0.15) / 0.2);
          pixels[idx + 3] = Math.round(alpha * 255);
        }
      }

      maskCtx.putImageData(maskData, 0, 0);
      ctx.drawImage(maskCanvas, 0, 0);
    }

    if (this.scene.textures.exists(outputKey)) {
      this.scene.textures.remove(outputKey);
    }
    this.scene.textures.addCanvas(outputKey, canvas);
    this.cache.set(cacheKey, outputKey);
    return outputKey;
  }

  clearCache(): void {
    for (const key of this.cache.values()) {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
    }
    this.cache.clear();
  }
}
