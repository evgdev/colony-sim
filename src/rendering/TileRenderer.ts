import Phaser from 'phaser';
import { TileGrid } from '../core/TileGrid';
import { TILE_SIZE, COLORS } from '../config';

export class TileRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
  }

  draw(grid: TileGrid): void {
    this.graphics.clear();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.get(x, y);
        if (!tile) continue;
        const color = COLORS[tile.type as keyof typeof COLORS] || 0x333333;
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.lineStyle(1, 0x222222, 0.5);
        this.graphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
