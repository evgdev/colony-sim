import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

export class TextureCache {
  private scene: Phaser.Scene;
  private cache: Map<string, string> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  has(key: string): boolean {
    return this.cache.has(key) || this.scene.textures.exists(key);
  }

  clear(): void {
    for (const key of this.cache.values()) {
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }
    }
    this.cache.clear();
  }
}
