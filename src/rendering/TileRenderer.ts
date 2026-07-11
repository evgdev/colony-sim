import Phaser from 'phaser';
import { TileGrid } from '../core/TileGrid';
import { TILE_SIZE, COLORS } from '../config';

export class TileRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private grassGroup: Phaser.GameObjects.Group;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.grassGroup = scene.add.group();
  }

  draw(grid: TileGrid): void {
    this.graphics.clear();
    this.grassGroup.clear(true, true);

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.get(x, y);
        if (!tile) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile.type === 'grass') {
          const sprite = this.scene.add.image(px, py, 'grass');
          sprite.setOrigin(0, 0);
          sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
          this.grassGroup.add(sprite);
        } else {
          const color = COLORS[tile.type as keyof typeof COLORS] || 0x333333;
          this.graphics.fillStyle(color, 1);
          this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        this.graphics.lineStyle(1, 0x222222, 0.5);
        this.graphics.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
