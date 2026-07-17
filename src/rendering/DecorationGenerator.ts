/**
 * DecorationGenerator v2 — деревья с покачиванием и тенями
 *
 * Заменяет оригинальный DecorationGenerator.ts
 * Добавляет:
 *   - Тени под деревьями (эллипсы на земле)
 *   - Покачивание кроны на ветру (sin-волна)
 *   - Вызов updateTreeAnimation(delta) в renderFrame()
 *
 * В GameScene.renderFrame() добавить:
 *   this.decorationGenerator?.updateTreeAnimation(delta);
 */
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
  shadowSprite: Phaser.GameObjects.Graphics | null;
  tileX: number;
  tileY: number;
  isTree: boolean;
  chopProgress: number;
  chopTime: number;
  isChopping: boolean;
}

export class DecorationGenerator {
  private scene: Phaser.Scene;
  private decorations: Decoration[] = [];
  private bottomContainer!: Phaser.GameObjects.Container;
  private topContainer!: Phaser.GameObjects.Container;
  private shadowContainer!: Phaser.GameObjects.Container;
  private chopGraphics!: Phaser.GameObjects.Graphics;
  private scrollX = 0;
  private scrollY = 0;
  private tileGrid: TileGrid | null = null;
  private readonly DECORATION_SEED = 7777;
  private readonly PLACEMENT_CHANCE = 0.28;

  // Tree animation state
  private windTime = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Shadow layer (below everything)
    this.shadowContainer = scene.add.container(0, 0).setDepth(0.2);
    this.applyViewportMask(this.shadowContainer);

    // Bottom layer (trunks, bushes, etc.)
    this.bottomContainer = scene.add.container(0, 0).setDepth(0.5);
    this.applyViewportMask(this.bottomContainer);

    // Top layer (canopy, covers settlers)
    this.topContainer = scene.add.container(0, 0).setDepth(12);
    this.applyViewportMask(this.topContainer);

    // Chop progress bar layer
    this.chopGraphics = scene.add.graphics().setDepth(13);
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
        if (!tile || (tile.type !== 'grass' && tile.type !== 'sand' && tile.type !== 'stone' && tile.type !== 'dirt')) continue;
        if (tile.occupied || tile.building) continue;

        const r = seededRandom(x, y, this.DECORATION_SEED);
        if (r > this.PLACEMENT_CHANCE) continue;

        if (entityManager.getAt(x, y)) continue;

        const hasWaterNeighbor = this.hasAdjacentTileType(tileGrid, x, y, 'water');
        const isSand = tile.type === 'sand';
        const isStone = tile.type === 'stone';
        const isDirt = tile.type === 'dirt';
        const decType = this.pickDecorationType(x, y, hasWaterNeighbor, isSand, isStone, isDirt);
        const variant = Math.floor(seededRandom(x + 50, y + 50, this.DECORATION_SEED) * 3);
        const isTree = decType === 'palm' || decType === 'coconut' || decType === 'palm_tall' || decType === 'round';

        if (isTree) {
          // Determine texture prefix
          let texPrefix: string;
          if (decType === 'coconut') {
            texPrefix = `dec_coconut_${variant % 2}`;
          } else if (decType === 'palm_tall') {
            texPrefix = `dec_palm_tall_${variant % 2}`;
          } else if (decType === 'round') {
            texPrefix = `dec_round_${variant % 2}`;
          } else {
            texPrefix = `dec_palm_${variant % 3}`;
          }

          const bottomKey = `${texPrefix}_bottom`;
          const topKey = `${texPrefix}_top`;

          if (!this.scene.textures.exists(bottomKey)) continue;

          // Shadow (ellipse under the tree) — size varies by type
          let shadowW = 40, shadowH = 16;
          if (decType === 'coconut') { shadowW = 34; shadowH = 14; }
          if (decType === 'palm_tall') { shadowW = 28; shadowH = 12; }
          if (decType === 'round') { shadowW = 48; shadowH = 18; }

          const shadowGfx = this.scene.add.graphics();
          shadowGfx.fillStyle(0x000000, 0.2);
          shadowGfx.fillEllipse(0, 0, shadowW, shadowH);
          this.shadowContainer.add(shadowGfx);

          // Bottom (trunk)
          const bottomSprite = this.scene.add.image(0, 0, bottomKey).setOrigin(0.5, 1);
          this.bottomContainer.add(bottomSprite);

          // Top (canopy)
          const topSprite = this.scene.textures.exists(topKey)
            ? this.scene.add.image(0, 0, topKey).setOrigin(0.5, 1)
            : null;
          if (topSprite) this.topContainer.add(topSprite);

          this.decorations.push({ bottomSprite, topSprite, shadowSprite: shadowGfx, tileX: x, tileY: y, isTree: true, chopProgress: 0, chopTime: 3, isChopping: false });

          // Mark trunk tile as occupied (collision)
          tileGrid.setOccupied(x, y, true);
        } else {
          const key = this.getTextureKey(decType, variant);
          if (!this.scene.textures.exists(key)) continue;

          const sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.5);
          this.bottomContainer.add(sprite);

          this.decorations.push({ bottomSprite: sprite, topSprite: null, shadowSprite: null, tileX: x, tileY: y, isTree: false, chopProgress: 0, chopTime: 0, isChopping: false });
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

  private pickDecorationType(x: number, y: number, nearWater: boolean, isSand: boolean, isStone: boolean, isDirt: boolean): string {
    const seed = this.DECORATION_SEED + 999;
    const r = seededRandom(x + 30, y + 30, seed);

    // Stone biome decorations
    if (isStone) {
      if (nearWater) {
        if (r < 0.25) return 'rock_l';
        if (r < 0.45) return 'rock_s';
        if (r < 0.60) return 'mushroom';
        return 'shore';
      }
      if (r < 0.15) return 'stalagmite';
      if (r < 0.25) return 'crystal';
      if (r < 0.40) return 'rock_l';
      if (r < 0.55) return 'rock_s';
      if (r < 0.70) return 'mushroom';
      return 'grass_tall';
    }

    // Dirt biome decorations
    if (isDirt) {
      if (nearWater) {
        if (r < 0.25) return 'palm';
        if (r < 0.45) return 'dry_bush';
        if (r < 0.60) return 'shore';
        return 'grass_tall';
      }
      if (r < 0.12) return 'dead_tree';
      if (r < 0.22) return 'skull';
      if (r < 0.32) return 'tumbleweed';
      if (r < 0.45) return 'rock_s';
      if (r < 0.60) return 'rock_l';
      if (r < 0.75) return 'dry_bush';
      return 'grass_tall';
    }

    // Sand biome decorations
    if (isSand) {
      if (nearWater) {
        if (r < 0.30) return 'palm';
        if (r < 0.50) return 'coconut';
        if (r < 0.65) return 'shell';
        return 'shore';
      }
      if (r < 0.15) return 'cactus';
      if (r < 0.25) return 'palm';
      if (r < 0.35) return 'rock_s';
      if (r < 0.50) return 'rock_l';
      if (r < 0.65) return 'dry_bush';
      return 'grass_tall';
    }

    // Grass biome decorations
    if (nearWater) {
      if (r < 0.25) return 'palm';
      if (r < 0.45) return 'coconut';
      if (r < 0.60) return 'fern';
      return 'shore';
    }

    if (r < 0.14) return 'palm';
    if (r < 0.24) return 'palm_tall';
    if (r < 0.34) return 'coconut';
    if (r < 0.44) return 'round';
    if (r < 0.54) return 'fern';
    if (r < 0.64) return 'bush';
    if (r < 0.72) return 'flower';
    if (r < 0.80) return 'rock_s';
    if (r < 0.88) return 'rock_l';
    return 'grass_tall';
  }

  private getTextureKey(type: string, variant: number): string {
    switch (type) {
      case 'palm': return `dec_palm_${variant % 3}_bottom`;
      case 'palm_tall': return `dec_palm_tall_${variant % 2}_bottom`;
      case 'coconut': return `dec_coconut_${variant % 2}_bottom`;
      case 'round': return `dec_round_${variant % 2}_bottom`;
      case 'fern': return `dec_fern_${variant % 3}`;
      case 'bush': return `dec_bush_${variant % 3}`;
      case 'dry_bush': return `dec_dry_bush_${variant % 2}`;
      case 'cactus': return `dec_cactus_${variant % 3}`;
      case 'shell': return `dec_shell_${variant % 2}`;
      case 'stalagmite': return `dec_stalagmite_${variant % 3}`;
      case 'crystal': return `dec_crystal_${variant % 2}`;
      case 'mushroom': return `dec_mushroom_${variant % 2}`;
      case 'dead_tree': return `dec_dead_tree_${variant % 2}`;
      case 'skull': return `dec_skull_${variant % 2}`;
      case 'tumbleweed': return `dec_tumbleweed_${variant % 2}`;
      case 'flower': return `dec_flower_${variant % 3}`;
      case 'rock_s': return `dec_rock_s_${variant % 2}`;
      case 'rock_l': return `dec_rock_l_${variant % 2}`;
      case 'shore': return `dec_shore_${variant % 2}`;
      case 'grass_tall': return `dec_grass_tall_${variant % 2}`;
      default: return `dec_bush_0`;
    }
  }

  // ─── Scroll ──────────────────────────────────────────────
  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;
    this.updateVisibility();
  }

  // ─── Visibility + positioning ────────────────────────────
  updateVisibility(): void {
    this.bottomContainer.setPosition(0, 0);
    this.topContainer.setPosition(0, 0);
    this.shadowContainer.setPosition(0, 0);
    const sx = this.scrollX;
    const sy = this.scrollY;

    for (const dec of this.decorations) {
      const inView = dec.tileX >= sx - 2 && dec.tileX < sx + VIEWPORT_TILES + 2
                  && dec.tileY >= sy - 2 && dec.tileY < sy + VIEWPORT_TILES + 2;

      if (!inView) {
        dec.bottomSprite.setVisible(false);
        if (dec.topSprite) dec.topSprite.setVisible(false);
        if (dec.shadowSprite) dec.shadowSprite.setVisible(false);
        continue;
      }

      const revealed = this.tileGrid ? this.tileGrid.isRevealed(dec.tileX, dec.tileY) : true;
      if (!revealed) {
        dec.bottomSprite.setVisible(false);
        if (dec.topSprite) dec.topSprite.setVisible(false);
        if (dec.shadowSprite) dec.shadowSprite.setVisible(false);
        continue;
      }

      const px = FIELD_X + (dec.tileX - sx) * TILE_SIZE + TILE_SIZE / 2;
      const py = dec.isTree
        ? FIELD_Y + (dec.tileY - sy) * TILE_SIZE + TILE_SIZE
        : FIELD_Y + (dec.tileY - sy) * TILE_SIZE + TILE_SIZE / 2;

      // Shadow position (at base of tree, slightly offset)
      if (dec.shadowSprite && dec.isTree) {
        const shadowPy = FIELD_Y + (dec.tileY - sy) * TILE_SIZE + TILE_SIZE - 4;
        const shadowPx = px + 3; // slight offset for direction
        dec.shadowSprite.setPosition(shadowPx, shadowPy);
        dec.shadowSprite.setVisible(true);
      }

      // Bottom sprite
      dec.bottomSprite.setPosition(px, py);
      dec.bottomSprite.setVisible(true);

      // Top sprite
      if (dec.topSprite) {
        dec.topSprite.setPosition(px, py);
        dec.topSprite.setVisible(true);
      }
    }
  }

  // ─── Tree animation (call each frame from GameScene) ─────
  updateTreeAnimation(delta: number): void {
    this.windTime += delta * 0.001;

    for (const dec of this.decorations) {
      if (!dec.isTree) continue;

      // Only animate visible trees
      if (!dec.bottomSprite.visible) continue;

      // Gentle sway — small rotation + position offset
      const phase = seededRandom(dec.tileX, dec.tileY, 1234) * Math.PI * 2;
      const swayAmount = 0.015; // radians (~0.86 degrees)
      const swayX = 1.5; // pixels

      const rot = Math.sin(this.windTime * 1.2 + phase) * swayAmount;
      const offsetX = Math.sin(this.windTime * 0.8 + phase * 0.7) * swayX;

      // Top sprite (canopy) sways more than bottom (trunk)
      if (dec.topSprite) {
        dec.topSprite.setRotation(rot * 1.5);
        dec.topSprite.setPosition(
          dec.topSprite.x + offsetX,
          dec.topSprite.y
        );
      }

      // Trunk sways less
      dec.bottomSprite.setRotation(rot * 0.5);
      dec.bottomSprite.setPosition(
        dec.bottomSprite.x + offsetX * 0.3,
        dec.bottomSprite.y
      );

      // Shadow follows but with slight delay/offset
      if (dec.shadowSprite) {
        // Shadow stretches slightly based on sway
        const shadowScaleX = 1 + Math.sin(this.windTime * 1.2 + phase) * 0.05;
        dec.shadowSprite.setScale(shadowScaleX, 1);
        dec.shadowSprite.setPosition(
          dec.shadowSprite.x + offsetX * 0.5,
          dec.shadowSprite.y
        );
      }
    }
  }

  getTreeAt(tileX: number, tileY: number): Decoration | undefined {
    return this.decorations.find(d => d.tileX === tileX && d.tileY === tileY && d.isTree);
  }

  drawChopProgress(scrollX: number, scrollY: number): void {
    this.chopGraphics.clear();
    for (const dec of this.decorations) {
      if (!dec.isTree || !dec.isChopping || dec.chopProgress <= 0) continue;
      const sx = FIELD_X + (dec.tileX - scrollX) * TILE_SIZE + TILE_SIZE / 2;
      const sy = FIELD_Y + (dec.tileY - scrollY) * TILE_SIZE - TILE_SIZE / 2 - 8;
      if (sx < FIELD_X || sx > FIELD_X + FIELD_W || sy < FIELD_Y || sy > FIELD_Y + FIELD_H) continue;
      const barW = TILE_SIZE * 0.8;
      const barH = 4;
      const ratio = Math.min(1, dec.chopProgress / dec.chopTime);
      this.chopGraphics.fillStyle(0x333333, 0.8);
      this.chopGraphics.fillRect(sx - barW / 2, sy, barW, barH);
      this.chopGraphics.fillStyle(0xffcc00, 1);
      this.chopGraphics.fillRect(sx - barW / 2, sy, barW * ratio, barH);
    }
  }

  // ─── Clear ───────────────────────────────────────────────
  clear(): void {
    for (const dec of this.decorations) {
      dec.bottomSprite.destroy();
      if (dec.topSprite) dec.topSprite.destroy();
      if (dec.shadowSprite) dec.shadowSprite.destroy();
    }
    this.decorations = [];
  }

  removeAt(tileX: number, tileY: number): boolean {
    const idx = this.decorations.findIndex(d => d.tileX === tileX && d.tileY === tileY && d.isTree);
    if (idx === -1) return false;
    const dec = this.decorations[idx];
    dec.bottomSprite.destroy();
    if (dec.topSprite) dec.topSprite.destroy();
    if (dec.shadowSprite) dec.shadowSprite.destroy();
    this.decorations.splice(idx, 1);
    return true;
  }

  getDecorationAt(tileX: number, tileY: number): Decoration | undefined {
    return this.decorations.find(d => d.tileX === tileX && d.tileY === tileY);
  }
}
