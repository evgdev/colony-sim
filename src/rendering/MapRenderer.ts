import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES, COLORS,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  NIGHT_TINT, nightAlpha,
} from '../config';
import { Simulation } from '../core/Simulation';
import { TextureCache } from './TextureCache';
import { TileType } from '../core/TileGrid';

function seededRandom(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

export class MapRenderer {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  tileSprites: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[][] = [];
  private transitionGraphics: Phaser.GameObjects.Graphics;
  private fogGraphics: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private scrollX: number = 0;
  private scrollY: number = 0;
  private waterPhase: number = 0;
  private waterTimer: number = 0;
  private grassVariantMap: number[][] = [];
  private sandVariantMap: number[][] = [];
  private dirtVariantMap: number[][] = [];
  private stoneVariantMap: number[][] = [];
  private textureCache: TextureCache;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.textureCache = new TextureCache(scene);
    this.transitionGraphics = scene.add.graphics().setDepth(1);
    this.fogGraphics = scene.add.graphics().setDepth(3);
    this.debugGraphics = scene.add.graphics().setDepth(15);
    this.setViewportClip();
    this.createNightOverlay();
    this.generateGrassVariants();
    this.generateSandVariants();
    this.generateDirtVariants();
    this.generateStoneVariants();
  }

  private generateGrassVariants(): void {
    this.grassVariantMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.grassVariantMap[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.grassVariantMap[y][x] = Math.floor(seededRandom(x, y, 5555) * 8);
      }
    }
  }

  private generateSandVariants(): void {
    this.sandVariantMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.sandVariantMap[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.sandVariantMap[y][x] = Math.floor(seededRandom(x, y, 6666) * 8);
      }
    }
  }

  private generateDirtVariants(): void {
    this.dirtVariantMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.dirtVariantMap[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.dirtVariantMap[y][x] = Math.floor(seededRandom(x, y, 7777) * 8);
      }
    }
  }

  private generateStoneVariants(): void {
    this.stoneVariantMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.stoneVariantMap[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.stoneVariantMap[y][x] = Math.floor(seededRandom(x, y, 8888) * 8);
      }
    }
  }

  private createNightOverlay(): void {
    this.nightOverlay = this.scene.add.rectangle(FIELD_X, FIELD_Y, FIELD_W, FIELD_H, NIGHT_TINT, 0)
      .setOrigin(0)
      .setDepth(4);
  }

  updateNight(tickCount: number): void {
    this.nightOverlay.setFillStyle(NIGHT_TINT);
    this.nightOverlay.setAlpha(nightAlpha(tickCount));
  }

  private setViewportClip(): void {
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    mask.setVisible(false);
    this.transitionGraphics.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, mask));
  }

  private getTileTextureKey(tileType: string, x: number, y: number): string {
    return this.getBaseTextureKey(tileType as TileType, x, y);
  }

  private getBaseTextureKey(type: TileType, x: number, y: number): string {
    if (type === 'grass') {
      const variant = this.grassVariantMap[y]?.[x] ?? 0;
      const key = `tile_grass_${variant}`;
      return this.scene.textures.exists(key) ? key : 'tile_grass';
    }
    if (type === 'sand') {
      const variant = this.sandVariantMap[y]?.[x] ?? 0;
      const key = `tile_sand_${variant}`;
      return this.scene.textures.exists(key) ? key : 'tile_sand';
    }
    if (type === 'dirt') {
      const variant = this.dirtVariantMap[y]?.[x] ?? 0;
      const key = `tile_dirt_${variant}`;
      return this.scene.textures.exists(key) ? key : 'tile_dirt';
    }
    if (type === 'stone') {
      const variant = this.stoneVariantMap[y]?.[x] ?? 0;
      const key = `tile_stone_${variant}`;
      return this.scene.textures.exists(key) ? key : 'tile_stone';
    }
    if (type === 'water') {
      const key = `tile_water_${this.waterPhase}`;
      return this.scene.textures.exists(key) ? key : 'tile_water';
    }
    return `tile_${type}`;
  }

  drawMap(): void {
    this.textureCache.clear();

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
        const texKey = this.getBaseTextureKey(tile.type as any, x, y);

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
    this.drawTileTransitions();
  }

  private getTileKeyWithTransitions(x: number, y: number, biomeType: string): string {
    return this.getBaseTextureKey(biomeType as any, x, y);
  }

  private getBoundaryNeighbors(x: number, y: number, primaryType: string): { dx: number; dy: number; type: string }[] {
    const neighbors: { dx: number; dy: number; type: string }[] = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const t = this.simulation.tileGrid.get(x + dx, y + dy);
      if (t && t.type !== primaryType) {
        neighbors.push({ dx, dy, type: t.type });
      }
    }
    return neighbors;
  }

  updateWater(delta: number): void {
    this.waterTimer += delta;
    if (this.waterTimer < 500) return;
    this.waterTimer = 0;
    this.waterPhase = (this.waterPhase + 1) % 3;

    const sx = this.scrollX;
    const sy = this.scrollY;
    const grid = this.simulation.tileGrid;

    for (let y = sy; y < sy + VIEWPORT_TILES; y++) {
      for (let x = sx; x < sx + VIEWPORT_TILES; x++) {
        const tile = grid.get(x, y);
        if (!tile || tile.type !== 'water') continue;
        const sprite = this.tileSprites[y]?.[x];
        if (!sprite || !(sprite instanceof Phaser.GameObjects.Image)) continue;
        const key = `tile_water_${this.waterPhase}`;
        if (this.scene.textures.exists(key)) {
          sprite.setTexture(key);
        }
      }
    }
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

    // this.drawDebugDots();
    this.drawFog();
    this.drawTileTransitions();
  }

  private drawDebugDots(): void {
    this.debugGraphics.clear();
    const sx = this.scrollX;
    const sy = this.scrollY;
    const grid = this.simulation.tileGrid;

    for (let y = sy; y < sy + VIEWPORT_TILES; y++) {
      for (let x = sx; x < sx + VIEWPORT_TILES; x++) {
        const tile = grid.get(x, y);
        if (!tile) continue;

        const up = grid.get(x, y - 1)?.type ?? tile.type;
        const upRight = grid.get(x + 1, y - 1)?.type ?? tile.type;
        const right = grid.get(x + 1, y)?.type ?? tile.type;
        const down = grid.get(x, y + 1)?.type ?? tile.type;
        const downLeft = grid.get(x - 1, y + 1)?.type ?? tile.type;
        const left = grid.get(x - 1, y)?.type ?? tile.type;

        const isT1 = (t: string) => t === tile.type;
        const isT2 = (t: string) => t !== tile.type;

        const case1 = isT1(up) && isT1(upRight) && isT1(right) &&
                       isT2(down) && isT2(downLeft) && isT2(left) &&
                       down === downLeft && downLeft === left;

        const case2 = isT2(right) && isT2(upRight) && isT2(up) &&
                       isT1(left) && isT1(downLeft) && isT1(down) &&
                       right === upRight && upRight === up;

        if (case1 || case2) {
          const px = FIELD_X + (x - sx) * TILE_SIZE + TILE_SIZE / 2;
          const py = FIELD_Y + (y - sy) * TILE_SIZE + TILE_SIZE / 2;
          this.debugGraphics.fillStyle(0xff0000, 1);
          this.debugGraphics.fillCircle(px, py, 6);
        }
      }
    }
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

        // Check adjacent revealed tiles for soft edge
        let hasRevealedNeighbor = false;
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of dirs) {
          if (grid.isRevealed(x + dx, y + dy)) {
            hasRevealedNeighbor = true;
            break;
          }
        }

        if (hasRevealedNeighbor) {
          // Soft fog edge (semi-transparent)
          this.fogGraphics.fillStyle(0x000000, 0.6);
          this.fogGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        } else {
          // Solid fog
          this.fogGraphics.fillStyle(0x000000, 1);
          this.fogGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
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
      sand: 3,
      stone: 2,
      dirt: 1,
      grass: 0,
    };

    const minX = Math.max(0, sx - 1);
    const maxX = Math.min(MAP_WIDTH, sx + VIEWPORT_TILES + 1);
    const minY = Math.max(0, sy - 1);
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

        // Check all 8 neighbors for angular protrusion shapes
        const dirs = [
          { dx: 1, dy: 0 },   // right
          { dx: 0, dy: 1 },   // down
          { dx: -1, dy: 0 },  // left
          { dx: 0, dy: -1 },  // up
          { dx: 1, dy: 1 },   // down-right
          { dx: -1, dy: 1 },  // down-left
          { dx: 1, dy: -1 },  // up-right
          { dx: -1, dy: -1 }, // up-left
        ];

        for (const d of dirs) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          const neighbor = this.simulation.tileGrid.get(nx, ny);
          if (!neighbor) continue;
          const neighborPriority = priority[neighbor.type] ?? 0;
          if (myPriority <= neighborPriority) continue;

          this.transitionGraphics.fillStyle(c, 1);
          const seed2 = seed + d.dx * 73 + d.dy * 137;

          // Generate angular block protrusions
          const isHorizontal = d.dx !== 0 && d.dy === 0;
          const isVertical = d.dy !== 0 && d.dx === 0;
          const isDiagonal = d.dx !== 0 && d.dy !== 0;

          if (isHorizontal) {
            // Protrusion along vertical edge
            const dir = d.dx > 0 ? 1 : -1;
            const edgeX = dir > 0 ? tileSize : 0;
            // Generate angular blocks
            let yy = 0;
            while (yy < tileSize) {
              const blockH = 3 + Math.floor(seededRandom(x + seed2, yy, 42) * 6);
              const blockDepth = 2 + Math.floor(seededRandom(x, yy + seed2, 99) * 6);
              const solidDepth = Math.floor(blockDepth * 0.75);
              // Solid block
              this.transitionGraphics.fillRect(
                px + edgeX - (dir < 0 ? solidDepth : 0),
                py + yy,
                solidDepth,
                blockH
              );
              // Angular tip
              if (blockDepth > solidDepth) {
                const tipW = 1 + Math.floor(seededRandom(x + 50, yy, seed2) * 2);
                this.transitionGraphics.fillRect(
                  px + edgeX - (dir < 0 ? blockDepth : 0),
                  py + yy + 1,
                  tipW,
                  blockH - 2
                );
              }
              yy += blockH + 1 + Math.floor(seededRandom(x, yy, seed2 + 200) * 3);
            }
          } else if (isVertical) {
            // Protrusion along horizontal edge
            const dir = d.dy > 0 ? 1 : -1;
            const edgeY = dir > 0 ? tileSize : 0;
            let xx = 0;
            while (xx < tileSize) {
              const blockW = 3 + Math.floor(seededRandom(xx, y + seed2, 42) * 6);
              const blockDepth = 2 + Math.floor(seededRandom(xx + seed2, y, 99) * 6);
              const solidDepth = Math.floor(blockDepth * 0.75);
              this.transitionGraphics.fillRect(
                px + xx,
                py + edgeY - (dir < 0 ? solidDepth : 0),
                blockW,
                solidDepth
              );
              if (blockDepth > solidDepth) {
                const tipH = 1 + Math.floor(seededRandom(xx, y + 50, seed2) * 2);
                this.transitionGraphics.fillRect(
                  px + xx + 1,
                  py + edgeY - (dir < 0 ? blockDepth : 0),
                  blockW - 2,
                  tipH
                );
              }
              xx += blockW + 1 + Math.floor(seededRandom(xx, y, seed2 + 200) * 3);
            }
          } else if (isDiagonal) {
            // Diagonal corner protrusion — angular chunk
            const cx2 = d.dx > 0 ? tileSize : 0;
            const cy2 = d.dy > 0 ? tileSize : 0;
            const chunkSize = 4 + Math.floor(seededRandom(x + seed2, y, 77) * 5);
            const ox = d.dx > 0 ? -chunkSize : 0;
            const oy = d.dy > 0 ? -chunkSize : 0;
            // Main diagonal block
            this.transitionGraphics.fillRect(px + cx2 + ox, py + cy2 + oy, chunkSize, chunkSize);
            // Angular extensions
            const ext1 = 2 + Math.floor(seededRandom(x, y + seed2, 88) * 3);
            const ext2 = 2 + Math.floor(seededRandom(x + seed2, y, 88) * 3);
            if (d.dx > 0) {
              this.transitionGraphics.fillRect(px + tileSize - chunkSize - ext1, py + cy2 + oy, ext1, chunkSize / 2);
            } else {
              this.transitionGraphics.fillRect(px + chunkSize, py + cy2 + oy, ext1, chunkSize / 2);
            }
            if (d.dy > 0) {
              this.transitionGraphics.fillRect(px + cx2 + ox, py + tileSize - chunkSize - ext2, chunkSize / 2, ext2);
            } else {
              this.transitionGraphics.fillRect(px + cx2 + ox, py + chunkSize, chunkSize / 2, ext2);
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
