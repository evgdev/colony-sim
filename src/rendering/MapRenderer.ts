import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, COLORS,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
} from '../config';
import { Simulation } from '../core/Simulation';

export class MapRenderer {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  tileSprites: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[][] = [];

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
  }

  drawMap(): void {
    for (let y = 1; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const texKey = `tile_${tile.type}`;
        const hasTexture = this.scene.textures.exists(texKey);

        if (hasTexture) {
          const img = this.scene.add.image(
            FIELD_X + x * TILE_SIZE, FIELD_Y + (y - 1) * TILE_SIZE,
            texKey
          ).setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE);
          this.tileSprites[y][x] = img;
        } else {
          const color = COLORS[tile.type as keyof typeof COLORS] || 0x333333;
          const rect = this.scene.add.rectangle(
            FIELD_X + x * TILE_SIZE, FIELD_Y + (y - 1) * TILE_SIZE,
            TILE_SIZE, TILE_SIZE, color
          ).setOrigin(0).setStrokeStyle(1, 0x222222);
          this.tileSprites[y][x] = rect;
        }
      }
    }
    this.drawTileTransitions();
  }

  private drawTileTransitions(): void {
    const g = this.scene.add.graphics().setDepth(1);
    const tileSize = TILE_SIZE;
    const STEP = 2;
    const SAMPLE_STEP = 8;

    const getColor = (type: string): number => {
      if (type === 'water') return 0x3b7dd8;
      if (type === 'stone') return 0x808080;
      if (type === 'sand') return 0xc2b280;
      if (type === 'dirt') return 0x8b7355;
      if (type === 'grass') return 0x4a7c3f;
      return 0x333333;
    };

    const priority: Record<string, number> = {
      water: 4,
      stone: 3,
      sand: 2,
      dirt: 1,
      grass: 0,
    };

    const seededRandom = (x: number, y: number, seed: number): number => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
      return n - Math.floor(n);
    };

    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

    const sampleDepths = (x: number, y: number, seed: number, count: number): number[] => {
      const depths: number[] = [];
      for (let i = 0; i <= count; i++) {
        depths.push(Math.floor(seededRandom(x, y + i * SAMPLE_STEP, seed) * 14) + 2);
      }
      return depths;
    };

    for (let y = 1; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const myPriority = priority[tile.type] ?? 0;
        if (myPriority === 0) continue;

        const px = FIELD_X + x * tileSize;
        const py = FIELD_Y + (y - 1) * tileSize;
        const seed = x * 100 + y;
        const c = getColor(tile.type);

        const neighbors = [
          { dx: 1, dy: 0, seedOff: 0 },
          { dx: 0, dy: 1, seedOff: 50 },
          { dx: -1, dy: 0, seedOff: 100 },
          { dx: 0, dy: -1, seedOff: 150 },
        ];

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          const neighbor = this.simulation.tileGrid.get(nx, ny);
          if (!neighbor) continue;
          const neighborPriority = priority[neighbor.type] ?? 0;
          if (myPriority <= neighborPriority) continue;

          const seed2 = seed + n.seedOff;
          const sampleCount = Math.ceil(tileSize / SAMPLE_STEP);
          const depths = sampleDepths(x, y, seed2, sampleCount);

          if (n.dx === 1) {
            for (let dy = 0; dy < tileSize; dy += STEP) {
              const idx = dy / SAMPLE_STEP;
              const i = Math.floor(idx);
              const t = idx - i;
              const d1 = depths[i] ?? depths[depths.length - 1];
              const d2 = depths[Math.min(i + 1, depths.length - 1)];
              const depth = lerp(d1, d2, t);
              const alpha = 1.0 - (dy / tileSize) * 0.6;
              g.fillStyle(c, alpha);
              g.fillRect(px + tileSize, py + dy, depth, STEP);
            }
          } else if (n.dy === 1) {
            for (let dx = 0; dx < tileSize; dx += STEP) {
              const idx = dx / SAMPLE_STEP;
              const i = Math.floor(idx);
              const t = idx - i;
              const d1 = depths[i] ?? depths[depths.length - 1];
              const d2 = depths[Math.min(i + 1, depths.length - 1)];
              const depth = lerp(d1, d2, t);
              const alpha = 1.0 - (dx / tileSize) * 0.6;
              g.fillStyle(c, alpha);
              g.fillRect(px + dx, py + tileSize, STEP, depth);
            }
          } else if (n.dx === -1) {
            for (let dy = 0; dy < tileSize; dy += STEP) {
              const idx = dy / SAMPLE_STEP;
              const i = Math.floor(idx);
              const t = idx - i;
              const d1 = depths[i] ?? depths[depths.length - 1];
              const d2 = depths[Math.min(i + 1, depths.length - 1)];
              const depth = lerp(d1, d2, t);
              const alpha = 1.0 - (dy / tileSize) * 0.6;
              g.fillStyle(c, alpha);
              g.fillRect(px - depth, py + dy, depth, STEP);
            }
          } else if (n.dy === -1) {
            for (let dx = 0; dx < tileSize; dx += STEP) {
              const idx = dx / SAMPLE_STEP;
              const i = Math.floor(idx);
              const t = idx - i;
              const d1 = depths[i] ?? depths[depths.length - 1];
              const d2 = depths[Math.min(i + 1, depths.length - 1)];
              const depth = lerp(d1, d2, t);
              const alpha = 1.0 - (dx / tileSize) * 0.6;
              g.fillStyle(c, alpha);
              g.fillRect(px + dx, py - depth, STEP, depth);
            }
          }
        }
      }
    }
  }

  redrawMap(): void {
    for (const row of this.tileSprites) {
      for (const rect of row) {
        rect.destroy();
      }
    }
    this.tileSprites = [];
    this.drawMap();
  }
}
