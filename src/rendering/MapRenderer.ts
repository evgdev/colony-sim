import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES, COLORS,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
} from '../config';
import { Simulation } from '../core/Simulation';

const TICKS_PER_DAY = 24;
const NIGHT_START = 18;
const NIGHT_END = 6;
const NIGHT_MAX_ALPHA = 0.4;

export class MapRenderer {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  tileSprites: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[][] = [];
  private transitionGraphics: Phaser.GameObjects.Graphics;
  private fogGraphics: Phaser.GameObjects.Graphics;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private scrollX: number = 0;
  private scrollY: number = 0;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.transitionGraphics = scene.add.graphics().setDepth(1);
    this.fogGraphics = scene.add.graphics().setDepth(3);
    this.setViewportClip();
    this.createNightOverlay();
  }

  private createNightOverlay(): void {
    this.nightOverlay = this.scene.add.rectangle(FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 0x000033, 0)
      .setOrigin(0)
      .setDepth(4);
  }

  updateNight(tickCount: number): void {
    const hour = tickCount % TICKS_PER_DAY;
    let alpha = 0;

    if (hour >= NIGHT_START) {
      const hoursSinceNight = hour - NIGHT_START;
      alpha = Math.min(hoursSinceNight / 2, 1) * NIGHT_MAX_ALPHA;
    } else if (hour < NIGHT_END) {
      const hoursUntilDawn = NIGHT_END - hour;
      alpha = Math.min(hoursUntilDawn / 2, 1) * NIGHT_MAX_ALPHA;
    }

    this.nightOverlay.setAlpha(alpha);
  }

  private setViewportClip(): void {
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    mask.setVisible(false);
    this.transitionGraphics.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, mask));
  }

  drawMap(): void {
    for (const row of this.tileSprites) {
      for (const rect of row) {
        rect.destroy();
      }
    }
    this.tileSprites = [];

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const texKey = `tile_${tile.type}`;
        const hasTexture = this.scene.textures.exists(texKey);

        let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
        if (hasTexture) {
          sprite = this.scene.add.image(0, 0, texKey)
            .setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE);
        } else {
          const color = COLORS[tile.type as keyof typeof COLORS] || 0x333333;
          sprite = this.scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, color)
            .setOrigin(0).setStrokeStyle(1, 0x222222);
        }
        this.tileSprites[y][x] = sprite;
      }
    }
    this.updateScroll(this.scrollX, this.scrollY);
  }

  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;

    const minX = sx;
    const maxX = sx + VIEWPORT_TILES;
    const minY = sy;
    const maxY = sy + VIEWPORT_TILES;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const sprite = this.tileSprites[y]?.[x];
        if (!sprite) continue;

        if (x >= minX && x < maxX && y >= minY && y < maxY) {
          sprite.setPosition(
            FIELD_X + (x - sx) * TILE_SIZE,
            FIELD_Y + (y - sy) * TILE_SIZE
          );
          sprite.setVisible(true);
        } else {
          sprite.setVisible(false);
        }
      }
    }

    this.drawTileTransitions();
    this.drawFog();
  }

  private drawFog(): void {
    this.fogGraphics.clear();
    const sx = this.scrollX;
    const sy = this.scrollY;
    const grid = this.simulation.tileGrid;

    const minX = Math.max(0, sx);
    const maxX = Math.min(MAP_WIDTH, sx + VIEWPORT_TILES);
    const minY = Math.max(0, sy);
    const maxY = Math.min(MAP_HEIGHT, sy + VIEWPORT_TILES);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        if (grid.isRevealed(x, y)) continue;
        const px = FIELD_X + (x - sx) * TILE_SIZE;
        const py = FIELD_Y + (y - sy) * TILE_SIZE;
        this.fogGraphics.fillStyle(0x000000, 1);
        this.fogGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawTileTransitions(): void {
    this.transitionGraphics.clear();
    const tileSize = TILE_SIZE;
    const sx = this.scrollX;
    const sy = this.scrollY;

    const getColor = (type: string): number => {
      if (type === 'water') return 0x3b7dd8;
      if (type === 'stone') return 0x808080;
      if (type === 'sand') return 0xc2b280;
      if (type === 'dirt') return 0x8b7355;
      if (type === 'grass') return 0x3a5a2a;
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

    const minX = Math.max(0, sx - 1);
    const maxX = Math.min(MAP_WIDTH, sx + VIEWPORT_TILES + 1);
    const minY = Math.max(1, sy);
    const maxY = Math.min(MAP_HEIGHT, sy + VIEWPORT_TILES + 2);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const myPriority = priority[tile.type] ?? 0;
        if (myPriority === 0) continue;

        const px = FIELD_X + (x - sx) * tileSize;
        const py = FIELD_Y + (y - sy) * tileSize;
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

          this.transitionGraphics.fillStyle(c, 1);
          const seed2 = seed + n.seedOff;

          if (n.dx === 1) {
            for (let dy = 0; dy < tileSize; dy += 3) {
              const edgeFactor = 1 - Math.abs(dy - tileSize / 2) / (tileSize / 2);
              const maxDepth = 3 + Math.floor(edgeFactor * 4);
              const depth = Math.floor(seededRandom(x, dy, seed2) * maxDepth) + 1;
              const w = seededRandom(x + 200, dy, seed2) > 0.5 ? 1 : 2;
              const solidLen = Math.floor(depth * 0.7);
              this.transitionGraphics.fillRect(px + tileSize, py + dy, solidLen, w);
              for (let px2 = solidLen; px2 < depth; px2++) {
                if (seededRandom(x + 300, dy + px2, seed2) > 0.4) {
                  this.transitionGraphics.fillRect(px + tileSize + px2, py + dy, 1, w);
                }
              }
            }
          } else if (n.dy === 1) {
            for (let dx = 0; dx < tileSize; dx += 3) {
              const edgeFactor = 1 - Math.abs(dx - tileSize / 2) / (tileSize / 2);
              const maxDepth = 3 + Math.floor(edgeFactor * 4);
              const depth = Math.floor(seededRandom(dx, y, seed2) * maxDepth) + 1;
              const w = seededRandom(dx, y + 200, seed2) > 0.5 ? 1 : 2;
              const solidLen = Math.floor(depth * 0.7);
              this.transitionGraphics.fillRect(px + dx, py + tileSize, w, solidLen);
              for (let py2 = solidLen; py2 < depth; py2++) {
                if (seededRandom(dx + 300, y + py2, seed2) > 0.4) {
                  this.transitionGraphics.fillRect(px + dx, py + tileSize + py2, w, 1);
                }
              }
            }
          } else if (n.dx === -1) {
            for (let dy = 0; dy < tileSize; dy += 3) {
              const edgeFactor = 1 - Math.abs(dy - tileSize / 2) / (tileSize / 2);
              const maxDepth = 3 + Math.floor(edgeFactor * 4);
              const depth = Math.floor(seededRandom(x, dy, seed2) * maxDepth) + 1;
              const w = seededRandom(x + 200, dy, seed2) > 0.5 ? 1 : 2;
              const solidLen = Math.floor(depth * 0.7);
              this.transitionGraphics.fillRect(px - solidLen, py + dy, solidLen, w);
              for (let px2 = solidLen; px2 < depth; px2++) {
                if (seededRandom(x + 300, dy + px2, seed2) > 0.4) {
                  this.transitionGraphics.fillRect(px - px2 - 1, py + dy, 1, w);
                }
              }
            }
          } else if (n.dy === -1) {
            for (let dx = 0; dx < tileSize; dx += 3) {
              const edgeFactor = 1 - Math.abs(dx - tileSize / 2) / (tileSize / 2);
              const maxDepth = 3 + Math.floor(edgeFactor * 4);
              const depth = Math.floor(seededRandom(dx, y, seed2) * maxDepth) + 1;
              const w = seededRandom(dx, y + 200, seed2) > 0.5 ? 1 : 2;
              const solidLen = Math.floor(depth * 0.7);
              this.transitionGraphics.fillRect(px + dx, py - solidLen, w, solidLen);
              for (let py2 = solidLen; py2 < depth; py2++) {
                if (seededRandom(dx + 300, y + py2, seed2) > 0.4) {
                  this.transitionGraphics.fillRect(px + dx, py - py2 - 1, w, 1);
                }
              }
            }
          }
        }
      }
    }
  }

  redrawMap(): void {
    this.drawMap();
  }

  redrawFog(): void {
    this.drawFog();
  }
}
