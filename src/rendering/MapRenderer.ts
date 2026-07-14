import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES, COLORS,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  NIGHT_TINT, nightAlpha,
} from '../config';
import { Simulation } from '../core/Simulation';
import { TextureMixer } from './TextureMixer';
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
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private scrollX: number = 0;
  private scrollY: number = 0;
  private waterPhase: number = 0;
  private waterTimer: number = 0;
  private grassVariantMap: number[][] = [];
  private textureMixer: TextureMixer;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.textureMixer = new TextureMixer(scene);
    this.transitionGraphics = scene.add.graphics().setDepth(1);
    this.fogGraphics = scene.add.graphics().setDepth(3);
    this.setViewportClip();
    this.createNightOverlay();
    this.generateGrassVariants();
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
    if (type === 'water') {
      const key = `tile_water_${this.waterPhase}`;
      return this.scene.textures.exists(key) ? key : 'tile_water';
    }
    return `tile_${type}`;
  }

  drawMap(): void {
    this.textureMixer.clearCache();

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
        const texKey = this.getTileKeyWithTransitions(x, y, tile.type);

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

  private getTileKeyWithTransitions(x: number, y: number, biomeType: string): string {
    const grid = this.simulation.tileGrid;
    const up = grid.get(x, y - 1)?.type ?? biomeType;
    const right = grid.get(x + 1, y)?.type ?? biomeType;
    const down = grid.get(x, y + 1)?.type ?? biomeType;
    const left = grid.get(x - 1, y)?.type ?? biomeType;

    const upSame = up === biomeType;
    const rightSame = right === biomeType;
    const downSame = down === biomeType;
    const leftSame = left === biomeType;

    const hasCardinalDifferent = !upSame || !rightSame || !downSame || !leftSame;

    if (hasCardinalDifferent) {
      let mask = 0;
      if (upSame) mask |= 1;
      if (rightSame) mask |= 2;
      if (downSame) mask |= 4;
      if (leftSame) mask |= 8;

      const outerBiome = this.chooseOuterBiomeForMask(mask, up, right, down, left, biomeType);
      const transKey = `trans_${biomeType}_${outerBiome}_${mask}`;
      if (this.scene.textures.exists(transKey)) return transKey;
      return this.getBaseTextureKey(biomeType as any, x, y);
    }

    const upRight = grid.get(x + 1, y - 1)?.type ?? biomeType;
    const downRight = grid.get(x + 1, y + 1)?.type ?? biomeType;
    const downLeft = grid.get(x - 1, y + 1)?.type ?? biomeType;
    const upLeft = grid.get(x - 1, y - 1)?.type ?? biomeType;

    const diagonals: [string, string][] = [
      [upRight, 'corner_ur'],
      [downRight, 'corner_dr'],
      [downLeft, 'corner_dl'],
      [upLeft, 'corner_ul'],
    ];

    for (const [diagType, cornerName] of diagonals) {
      if (diagType !== biomeType) {
        const outerBiome = diagType;
        const cornerKey = `trans_${biomeType}_${outerBiome}_${cornerName}`;
        if (this.scene.textures.exists(cornerKey)) return cornerKey;
      }
    }

    return this.getBaseTextureKey(biomeType as any, x, y);
  }

  private chooseOuterBiomeForMask(mask: number, up: string, right: string, down: string, left: string, current: string): string {
    const priority: Record<string, number> = { water: 0, sand: 1, stone: 2, dirt: 3, grass: 4 };
    const edges: [boolean, string][] = [
      [(mask & 1) === 0, up],
      [(mask & 2) === 0, right],
      [(mask & 4) === 0, down],
      [(mask & 8) === 0, left],
    ];

    const differentNeighbors = edges
      .filter(([isDifferent, type]) => isDifferent && type !== current)
      .map(([_, type]) => type);

    if (differentNeighbors.length === 0) return current;

    differentNeighbors.sort((a, b) => (priority[a] ?? 10) - (priority[b] ?? 10));
    return differentNeighbors[0];
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
      stone: 3,
      sand: 2,
      dirt: 1,
      grass: 0,
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
