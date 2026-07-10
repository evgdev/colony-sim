import Phaser from 'phaser';
import { Entity } from '../core/Entity';
import { TILE_SIZE, COLORS } from '../config';

export class EntityRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
  }

  draw(entities: Entity[]): void {
    this.graphics.clear();
    for (const entity of entities) {
      const cx = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = entity.y * TILE_SIZE + TILE_SIZE / 2;

      let color = COLORS.settler;
      let radius = TILE_SIZE / 3;

      if (entity.entityType === 'resource') {
        color = COLORS.resource;
        this.graphics.fillStyle(color, 0.9);
        this.graphics.fillRect(cx - TILE_SIZE / 4, cy - TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);
        continue;
      } else if (entity.entityType === 'building') {
        color = COLORS.building;
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);
        continue;
      }

      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(cx, cy, radius);
      this.graphics.lineStyle(2, 0x000000);
      this.graphics.strokeCircle(cx, cy, radius);
    }
  }
}
