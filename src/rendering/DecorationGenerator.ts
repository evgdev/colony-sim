import Phaser from 'phaser';
import { TILE_SIZE, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, VIEWPORT_TILES, MAP_WIDTH, MAP_HEIGHT } from '../config';
import { TileGrid } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';

function seededRandom(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

interface Decoration {
  bottomSprite: Phaser.GameObjects.Image;
  topSprite: Phaser.GameObjects.Image | null;
  tileX: number;
  tileY: number;
  isTree: boolean;
}

export class DecorationGenerator {
  private scene: Phaser.Scene;
  private decorations: Decoration[] = [];
  private bottomContainer!: Phaser.GameObjects.Container;
  private topContainer!: Phaser.GameObjects.Container;
  private scrollX = 0;
  private scrollY = 0;
  private tileGrid: TileGrid | null = null;
  private readonly DECORATION_SEED = 7777;
  private readonly PLACEMENT_CHANCE = 0.18;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bottomContainer = scene.add.container(0, 0).setDepth(0.5);
    this.topContainer = scene.add.container(0, 0).setDepth(12);
    this.applyViewportMask(this.bottomContainer);
    this.applyViewportMask(this.topContainer);
  }

  private applyViewportMask(container: Phaser.GameObjects.Container): void {
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    mask.setVisible(false);
    container.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, mask));
  }

  generateDecorations(tileGrid: TileGrid, entityManager: EntityManager): void {
    this.tileGrid = tileGrid;
    this.clear();

    for (let y = 0; y < tileGrid.height; y++) {
      for (let x = 0; x < tileGrid.width; x++) {
        const tile = tileGrid.get(x, y);
        if (!tile || tile.type !== 'grass') continue;
        if (tile.occupied || tile.building) continue;

        const r = seededRandom(x, y, this.DECORATION_SEED);
        if (r > this.PLACEMENT_CHANCE) continue;

        if (entityManager.getAt(x, y)) continue;

        const hasWaterNeighbor = this.hasAdjacentTileType(tileGrid, x, y, 'water');
        const decType = this.pickDecorationType(x, y, hasWaterNeighbor);
        const variant = Math.floor(seededRandom(x + 50, y + 50, this.DECORATION_SEED) * 3);
        const isTree = decType === 'palm';

        if (isTree) {
          const bottomKey = `dec_palm_${variant % 3}_bottom`;
          const topKey = `dec_palm_${variant % 3}_top`;

          if (!this.scene.textures.exists(bottomKey)) continue;

          const bottomSprite = this.scene.add.image(0, 0, bottomKey).setOrigin(0.5, 1);
          const topSprite = this.scene.textures.exists(topKey)
            ? this.scene.add.image(0, 0, topKey).setOrigin(0.5, 1)
            : null;

          this.bottomContainer.add(bottomSprite);
          if (topSprite) this.topContainer.add(topSprite);

          this.decorations.push({ bottomSprite, topSprite, tileX: x, tileY: y, isTree: true });
        } else {
          const key = this.getTextureKey(decType, variant);
          if (!this.scene.textures.exists(key)) continue;

          const sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.5);
          this.bottomContainer.add(sprite);

          this.decorations.push({ bottomSprite: sprite, topSprite: null, tileX: x, tileY: y, isTree: false });
        }
      }
    }

    this.updateScroll(this.scrollX, this.scrollY);
  }

  private hasAdjacentTileType(tileGrid: TileGrid, x: number, y: number, type: string): boolean {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const t = tileGrid.get(x + dx, y + dy);
      if (t && t.type === type) return true;
    }
    return false;
  }

  private pickDecorationType(x: number, y: number, nearWater: boolean): string {
    const seed = this.DECORATION_SEED + 999;
    const r = seededRandom(x + 30, y + 30, seed);

    if (nearWater) {
      if (r < 0.6) return 'palm';
      return 'shore';
    }

    if (r < 0.30) return 'palm';
    if (r < 0.50) return 'bush';
    if (r < 0.65) return 'flower';
    if (r < 0.80) return 'rock_s';
    if (r < 0.92) return 'rock_l';
    return 'grass_tall';
  }

  private getTextureKey(type: string, variant: number): string {
    switch (type) {
      case 'bush': return `dec_bush_${variant % 3}`;
      case 'flower': return `dec_flower_${variant % 3}`;
      case 'rock_s': return `dec_rock_s_${variant % 2}`;
      case 'rock_l': return `dec_rock_l_${variant % 2}`;
      case 'shore': return `dec_shore_${variant % 2}`;
      case 'grass_tall': return `dec_grass_tall_${variant % 2}`;
      default: return `dec_bush_0`;
    }
  }

  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;
    this.updateVisibility();
  }

  updateVisibility(): void {
    this.bottomContainer.setPosition(0, 0);
    this.topContainer.setPosition(0, 0);
    const sx = this.scrollX;
    const sy = this.scrollY;

    for (const dec of this.decorations) {
      const inView = dec.tileX >= sx - 2 && dec.tileX < sx + VIEWPORT_TILES + 2
                  && dec.tileY >= sy - 2 && dec.tileY < sy + VIEWPORT_TILES + 2;

      if (!inView) {
        dec.bottomSprite.setVisible(false);
        if (dec.topSprite) dec.topSprite.setVisible(false);
        continue;
      }

      const revealed = this.tileGrid ? this.tileGrid.isRevealed(dec.tileX, dec.tileY) : true;
      if (!revealed) {
        dec.bottomSprite.setVisible(false);
        if (dec.topSprite) dec.topSprite.setVisible(false);
        continue;
      }

      const px = FIELD_X + (dec.tileX - sx) * TILE_SIZE + TILE_SIZE / 2;
      const py = dec.isTree
        ? FIELD_Y + (dec.tileY - sy) * TILE_SIZE + TILE_SIZE
        : FIELD_Y + (dec.tileY - sy) * TILE_SIZE + TILE_SIZE / 2;

      dec.bottomSprite.setPosition(px, py);
      dec.bottomSprite.setVisible(true);
      if (dec.topSprite) {
        dec.topSprite.setPosition(px, py);
        dec.topSprite.setVisible(true);
      }
    }
  }

  clear(): void {
    for (const dec of this.decorations) {
      dec.bottomSprite.destroy();
      if (dec.topSprite) dec.topSprite.destroy();
    }
    this.decorations = [];
  }
}
