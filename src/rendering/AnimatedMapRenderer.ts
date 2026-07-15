/**
 * AnimatedMapRenderer v2 — плавные переходы биомов + анимированная среда
 *
 * Подключить в GameScene:
 *   import { AnimatedMapRenderer } from '../rendering/AnimatedMapRenderer';
 *   this.mapRenderer = new AnimatedMapRenderer(this, this.simulation);
 *
 * В renderFrame() вызывать:
 *   this.mapRenderer.updateAnimations(delta);
 */
import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  NIGHT_TINT, nightAlpha,
} from '../config';
import { Simulation } from '../core/Simulation';
import { TileType } from '../core/TileGrid';

// ─── Helpers ────────────────────────────────────────────────
function seeded(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

const BIOME_COLORS: Record<TileType, number[]> = {
  grass: [0x3a5a2a, 0x336b25, 0x458a35, 0x2d4f1f, 0x3e6830],
  dirt:  [0x8b7355, 0x7a6548, 0x9c8562, 0x6e5a40],
  water: [0x3b7dd8, 0x2a6bc8, 0x4a8de8],
  stone: [0x808080, 0x555555, 0x606060, 0x4a4a4a],
  sand:  [0xc2b280, 0xd4c490, 0xb8a870],
};

interface GrassBlade {
  tileX: number;
  tileY: number;
  localX: number;
  localY: number;
  height: number;
  color: number;
  phase: number;
}

// ─── AnimatedMapRenderer ────────────────────────────────────
export class AnimatedMapRenderer {
  private scene: Phaser.Scene;
  private simulation: Simulation;

  // Tile layers
  private tileSprites: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[][] = [];
  private tileBlendSprites: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[][] = [];

  // Single graphics for animated layers (redrawn each frame)
  private animGfx!: Phaser.GameObjects.Graphics;

  // Fog
  private fogGfx!: Phaser.GameObjects.Graphics;

  // Night
  private nightOverlay!: Phaser.GameObjects.Rectangle;

  // Grass data (positions only, drawn via animGfx)
  private grassBlades: GrassBlade[] = [];

  // Water shimmer points (world coords)
  private waterShimmer: { x: number; y: number; phase: number; speed: number }[] = [];

  // Ambient particles
  private particles: {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number; color: number; rotation: number; rotSpeed: number;
  }[] = [];

  // Timing
  private windOffset = 0;
  private particleTimer = 0;

  // Scroll
  private scrollX = 0;
  private scrollY = 0;

  // Variant maps for texture selection
  private grassVariantMap: number[][] = [];
  private sandVariantMap: number[][] = [];
  private dirtVariantMap: number[][] = [];
  private stoneVariantMap: number[][] = [];
  private waterPhase: number = 0;

  // Viewport mask
  private viewportMask!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;

    // Viewport mask
    this.viewportMask = scene.add.graphics();
    this.viewportMask.fillStyle(0xffffff);
    this.viewportMask.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    this.viewportMask.setVisible(false);
    const mask = new Phaser.Display.Masks.GeometryMask(scene, this.viewportMask);

    // Animated graphics layer (water, transitions, grass, particles — all in one, redrawn each frame)
    this.animGfx = scene.add.graphics().setDepth(1.5);
    this.animGfx.setMask(mask);

    // Fog layer
    this.fogGfx = scene.add.graphics().setDepth(3);

    // Night overlay
    this.nightOverlay = scene.add.rectangle(FIELD_X, FIELD_Y, FIELD_W, FIELD_H, NIGHT_TINT, 0)
      .setOrigin(0).setDepth(4);

    // Generate water shimmer points
    for (let i = 0; i < 50; i++) {
      this.waterShimmer.push({
        x: Math.random() * MAP_WIDTH * TILE_SIZE,
        y: Math.random() * MAP_HEIGHT * TILE_SIZE,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      });
    }

    // Generate variant maps for textures
    this.generateVariantMaps();
  }

  // ─── Variant maps for texture selection ───────────────────
  private generateVariantMaps(): void {
    this.grassVariantMap = [];
    this.sandVariantMap = [];
    this.dirtVariantMap = [];
    this.stoneVariantMap = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.grassVariantMap[y] = [];
      this.sandVariantMap[y] = [];
      this.dirtVariantMap[y] = [];
      this.stoneVariantMap[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.grassVariantMap[y][x] = Math.floor(seeded(x, y, 5555) * 8);
        this.sandVariantMap[y][x] = Math.floor(seeded(x, y, 6666) * 8);
        this.dirtVariantMap[y][x] = Math.floor(seeded(x, y, 7777) * 8);
        this.stoneVariantMap[y][x] = Math.floor(seeded(x, y, 8888) * 8);
      }
    }
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

  // ─── Night ───────────────────────────────────────────────
  updateNight(tickCount: number): void {
    this.nightOverlay.setAlpha(nightAlpha(tickCount));
  }

  // ─── Draw map (call once) ────────────────────────────────
  drawMap(): void {
    // Destroy old
    for (const row of this.tileSprites) for (const s of row) s.destroy();
    for (const row of this.tileBlendSprites) for (const s of row) s.destroy();
    this.tileSprites = [];
    this.tileBlendSprites = [];
    this.grassBlades = [];

    const grid = this.simulation.tileGrid;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      this.tileBlendSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = grid.get(x, y)!;
        const blend = tile.blend;

        // Get texture key for this tile
        const texKey = this.getBaseTextureKey(tile.type as TileType, x, y);
        const hasTexture = this.scene.textures.exists(texKey);

        let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
        if (hasTexture) {
          sprite = this.scene.add.image(0, 0, texKey)
            .setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(0);
        } else {
          // Fallback to solid color
          const baseColors = BIOME_COLORS[tile.type] || BIOME_COLORS.grass;
          const variant = Math.floor(seeded(x, y, 42) * baseColors.length);
          sprite = this.scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, baseColors[variant])
            .setOrigin(0).setDepth(0);
        }
        this.tileSprites[y][x] = sprite;

        // Blend overlay (texture-based if available)
        if (blend && blend.ratio > 0.05 && blend.secondary !== blend.primary) {
          const secTexKey = this.getBaseTextureKey(blend.secondary as TileType, x, y);
          const hasSecTexture = this.scene.textures.exists(secTexKey);

          let blendSprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
          if (hasSecTexture) {
            blendSprite = this.scene.add.image(0, 0, secTexKey)
              .setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(0.1).setAlpha(blend.ratio * 0.6);
          } else {
            const secColors = BIOME_COLORS[blend.secondary as TileType] || BIOME_COLORS.grass;
            const secVar = Math.floor(seeded(x + 100, y + 100, 42) * secColors.length);
            blendSprite = this.scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, secColors[secVar])
              .setOrigin(0).setDepth(0.1).setAlpha(blend.ratio * 0.6);
          }
          this.tileBlendSprites[y][x] = blendSprite;
        } else {
          const empty = this.scene.add.rectangle(0, 0, 1, 1, 0x000000, 0)
            .setOrigin(0).setVisible(false);
          this.tileBlendSprites[y][x] = empty;
        }

        // Collect grass blade data
        if (tile.type === 'grass' && seeded(x, y, 3333) < 0.35) {
          const count = 2 + Math.floor(seeded(x, y, 5555) * 3);
          for (let i = 0; i < count; i++) {
            this.grassBlades.push({
              tileX: x, tileY: y,
              localX: seeded(x + i * 7, y, 6666) * TILE_SIZE,
              localY: seeded(x, y + i * 11, 7777) * TILE_SIZE * 0.5 + TILE_SIZE * 0.5,
              height: 6 + seeded(x + i, y, 8888) * 10,
              color: [0x4a8a3a, 0x5a9a4a, 0x3a7a2a, 0x6aaa5a][Math.floor(seeded(x + i, y, 9999) * 4)],
              phase: seeded(x + i, y, 1111) * Math.PI * 2,
            });
          }
        }
      }
    }

    this.updateScroll(this.scrollX, this.scrollY);
  }

  // ─── Scroll ──────────────────────────────────────────────
  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const inView = x >= sx && x < sx + VIEWPORT_TILES && y >= sy && y < sy + VIEWPORT_TILES;

        const sprite = this.tileSprites[y]?.[x];
        if (sprite) {
          if (inView) {
            sprite.setPosition(FIELD_X + (x - sx) * TILE_SIZE, FIELD_Y + (y - sy) * TILE_SIZE);
            sprite.setVisible(true);
          } else {
            sprite.setVisible(false);
          }
        }

        const blend = this.tileBlendSprites[y]?.[x];
        if (blend) {
          if (inView) {
            blend.setPosition(FIELD_X + (x - sx) * TILE_SIZE, FIELD_Y + (y - sy) * TILE_SIZE);
            blend.setVisible(true);
          } else {
            blend.setVisible(false);
          }
        }
      }
    }

    this.drawFog();
  }

  // ─── Per-frame animation (call from renderFrame) ─────────
  updateAnimations(delta: number): void {
    this.windOffset += delta * 0.0008;

    const sx = this.scrollX;
    const sy = this.scrollY;
    const grid = this.simulation.tileGrid;
    const time = Date.now() * 0.001;

    // Clear the animated layer — redraw everything each frame
    this.animGfx.clear();

    // ── BIOME TRANSITIONS (smooth gradient edges) ──
    this.drawTransitions(sx, sy, grid);

    // ── WATER ANIMATION ──
    this.drawWater(sx, sy, grid, time);

    // ── GRASS BLADES (animated wind) ──
    this.drawGrass(sx, sy, time);

    // ── AMBIENT PARTICLES ──
    this.updateParticles(delta, sx, sy, grid, time);
  }

  // ─── Smooth biome transitions ────────────────────────────
  private drawTransitions(sx: number, sy: number, grid: any): void {
    const minX = Math.max(0, sx - 1);
    const maxX = Math.min(MAP_WIDTH, sx + VIEWPORT_TILES + 1);
    const minY = Math.max(0, sy - 1);
    const maxY = Math.min(MAP_HEIGHT, sy + VIEWPORT_TILES + 1);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const tile = grid.get(x, y);
        if (!tile) continue;
        const blend = tile.blend;
        if (!blend || blend.ratio < 0.08 || blend.secondary === blend.primary) continue;

        const px = FIELD_X + (x - sx) * TILE_SIZE;
        const py = FIELD_Y + (y - sy) * TILE_SIZE;

        const secColor = (BIOME_COLORS[blend.secondary as TileType] || [0x333333])[0];

        // Check each neighbor — draw gradient toward matching secondary type
        const dirs = [
          { dx: 1, dy: 0, side: 'right' },
          { dx: -1, dy: 0, side: 'left' },
          { dx: 0, dy: 1, side: 'bottom' },
          { dx: 0, dy: -1, side: 'top' },
        ];

        for (const { dx, dy, side } of dirs) {
          const neighbor = grid.get(x + dx, y + dy);
          if (!neighbor || neighbor.type !== blend.secondary) continue;

          const depth = TILE_SIZE * blend.ratio * 0.5;
          const steps = 5;

          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            const alpha = blend.ratio * 0.5 * (1 - t * 0.8);
            const d = depth * (1 - t);

            this.animGfx.fillStyle(secColor, alpha);

            if (side === 'right') {
              this.animGfx.fillRect(px + TILE_SIZE - d, py, d, TILE_SIZE);
            } else if (side === 'left') {
              this.animGfx.fillRect(px, py, d, TILE_SIZE);
            } else if (side === 'bottom') {
              this.animGfx.fillRect(px, py + TILE_SIZE - d, TILE_SIZE, d);
            } else {
              this.animGfx.fillRect(px, py, TILE_SIZE, d);
            }
          }
        }
      }
    }
  }

  // ─── Water animation ─────────────────────────────────────
  private drawWater(sx: number, sy: number, grid: any, time: number): void {
    const minX = Math.max(0, sx);
    const maxX = Math.min(MAP_WIDTH, sx + VIEWPORT_TILES);
    const minY = Math.max(0, sy);
    const maxY = Math.min(MAP_HEIGHT, sy + VIEWPORT_TILES);

    for (let vy = minY; vy < maxY; vy++) {
      for (let vx = minX; vx < maxX; vx++) {
        const tile = grid.get(vx, vy);
        if (!tile || tile.type !== 'water') continue;

        const px = FIELD_X + (vx - sx) * TILE_SIZE;
        const py = FIELD_Y + (vy - sy) * TILE_SIZE;

        // Wave line 1
        this.animGfx.lineStyle(1.5, 0x5599ee, 0.3);
        const w1 = py + 12 + Math.sin(time * 1.5 + vx * 0.5) * 2.5;
        this.animGfx.beginPath();
        this.animGfx.moveTo(px, w1);
        this.animGfx.lineTo(px + 12, w1 - 2 + Math.sin(time * 2 + vx) * 1.5);
        this.animGfx.lineTo(px + 25, w1 + 1 + Math.cos(time * 1.8 + vx) * 1);
        this.animGfx.lineTo(px + 38, w1 - 1 + Math.sin(time * 1.6 + vx * 0.7) * 1.5);
        this.animGfx.lineTo(px + TILE_SIZE, w1 + 0.5);
        this.animGfx.strokePath();

        // Wave line 2
        this.animGfx.lineStyle(1, 0x77bbee, 0.2);
        const w2 = py + 28 + Math.cos(time * 1.2 + vx * 0.3) * 2;
        this.animGfx.beginPath();
        this.animGfx.moveTo(px, w2);
        this.animGfx.lineTo(px + 15, w2 + 1.5);
        this.animGfx.lineTo(px + 30, w2 - 1 + Math.sin(time + vx * 0.4) * 1);
        this.animGfx.lineTo(px + TILE_SIZE, w2 + 0.5);
        this.animGfx.strokePath();

        // Wave line 3 (subtle)
        this.animGfx.lineStyle(0.5, 0x99ccff, 0.12);
        const w3 = py + 40 + Math.sin(time * 0.8 + vx * 0.2 + 2) * 1.5;
        this.animGfx.beginPath();
        this.animGfx.moveTo(px + 5, w3);
        this.animGfx.lineTo(px + 20, w3 - 1);
        this.animGfx.lineTo(px + 40, w3 + 0.5);
        this.animGfx.strokePath();
      }
    }

    // Shimmer sparkles on water
    for (const shimmer of this.waterShimmer) {
      const tileX = Math.floor(shimmer.x / TILE_SIZE);
      const tileY = Math.floor(shimmer.y / TILE_SIZE);
      if (tileX < sx || tileX >= sx + VIEWPORT_TILES) continue;
      if (tileY < sy || tileY >= sy + VIEWPORT_TILES) continue;
      const tile = grid.get(tileX, tileY);
      if (!tile || tile.type !== 'water') continue;

      const screenX = FIELD_X + (tileX - sx) * TILE_SIZE + (shimmer.x % TILE_SIZE);
      const screenY = FIELD_Y + (tileY - sy) * TILE_SIZE + (shimmer.y % TILE_SIZE);
      const brightness = Math.sin(time * shimmer.speed + shimmer.phase) * 0.5 + 0.5;

      if (brightness > 0.55) {
        this.animGfx.fillStyle(0xffffff, brightness * 0.2);
        this.animGfx.fillCircle(screenX, screenY, 1.5 + brightness * 2);
      }
    }
  }

  // ─── Grass blades (animated) ─────────────────────────────
  private drawGrass(sx: number, sy: number, time: number): void {
    for (const blade of this.grassBlades) {
      // Skip if not in viewport
      if (blade.tileX < sx - 1 || blade.tileX >= sx + VIEWPORT_TILES + 1) continue;
      if (blade.tileY < sy - 1 || blade.tileY >= sy + VIEWPORT_TILES + 1) continue;

      const baseX = FIELD_X + (blade.tileX - sx) * TILE_SIZE + blade.localX;
      const baseY = FIELD_Y + (blade.tileY - sy) * TILE_SIZE + blade.localY;

      // Wind sway
      const sway1 = Math.sin(this.windOffset * 2 + blade.phase) * 3;
      const sway2 = Math.cos(this.windOffset * 1.3 + blade.phase * 0.7) * 1.5;

      this.animGfx.lineStyle(1.5, blade.color, 0.7);
      this.animGfx.beginPath();
      this.animGfx.moveTo(baseX, baseY);
      this.animGfx.lineTo(baseX + sway1 * 0.5, baseY - blade.height * 0.4);
      this.animGfx.lineTo(baseX + sway1 + sway2 * 0.3, baseY - blade.height * 0.75);
      this.animGfx.lineTo(baseX + sway1 + sway2, baseY - blade.height);
      this.animGfx.strokePath();
    }
  }

  // ─── Ambient particles ───────────────────────────────────
  private updateParticles(delta: number, sx: number, sy: number, grid: any, time: number): void {
    // Spawn
    this.particleTimer += delta;
    if (this.particleTimer > 600 && this.particles.length < 12) {
      this.particleTimer = 0;

      const tx = sx + Math.random() * VIEWPORT_TILES;
      const ty = sy + Math.random() * VIEWPORT_TILES;
      const tile = grid.get(Math.floor(tx), Math.floor(ty));

      if (tile && (tile.type === 'grass' || tile.type === 'dirt' || tile.type === 'sand')) {
        const isLeaf = tile.type !== 'sand';
        this.particles.push({
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.08 - Math.random() * 0.15,
          life: 0,
          maxLife: 2500 + Math.random() * 3000,
          size: isLeaf ? 2 + Math.random() * 2 : 1 + Math.random(),
          color: isLeaf
            ? [0x5a9a4a, 0x8b7355, 0x3a7a2a, 0xccaa44][Math.floor(Math.random() * 4)]
            : 0xd4c490,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.015,
        });
      }
    }

    // Update & render
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) { this.particles.splice(i, 1); continue; }

      p.x += p.vx + Math.sin(this.windOffset + p.rotation) * 0.08;
      p.y += p.vy;
      p.rotation += p.rotSpeed;

      // Screen coords
      const screenX = FIELD_X + p.x - sx * TILE_SIZE;
      const screenY = FIELD_Y + p.y - sy * TILE_SIZE;

      // Cull
      if (screenX < FIELD_X - 20 || screenX > FIELD_X + FIELD_W + 20) continue;
      if (screenY < FIELD_Y - 20 || screenY > FIELD_Y + FIELD_H + 20) continue;

      // Fade
      const lr = p.life / p.maxLife;
      const alpha = lr < 0.1 ? lr / 0.1 : lr > 0.8 ? (1 - lr) / 0.2 : 1;

      this.animGfx.fillStyle(p.color, alpha * 0.5);
      const cos = Math.cos(p.rotation);
      const sin = Math.sin(p.rotation);
      const s = p.size;
      this.animGfx.beginPath();
      this.animGfx.moveTo(screenX + cos * s, screenY + sin * s);
      this.animGfx.lineTo(screenX - sin * s * 0.5, screenY + cos * s * 0.5);
      this.animGfx.lineTo(screenX - cos * s, screenY - sin * s);
      this.animGfx.lineTo(screenX + sin * s * 0.5, screenY - cos * s * 0.5);
      this.animGfx.closePath();
      this.animGfx.fillPath();
    }
  }

  // ─── Fog of war ──────────────────────────────────────────
  drawFog(): void {
    this.fogGfx.clear();
    const grid = this.simulation.tileGrid;
    const sx = this.scrollX;
    const sy = this.scrollY;

    const minX = Math.max(0, sx);
    const maxX = Math.min(MAP_WIDTH, sx + VIEWPORT_TILES);
    const minY = Math.max(0, sy);
    const maxY = Math.min(MAP_HEIGHT, sy + VIEWPORT_TILES);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        if (grid.isRevealed(x, y)) continue;
        const px = FIELD_X + (x - sx) * TILE_SIZE;
        const py = FIELD_Y + (y - sy) * TILE_SIZE;

        const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        let rev = 0;
        for (const [dx, dy] of dirs) {
          if (grid.isRevealed(x + dx, y + dy)) rev++;
        }

        if (rev > 0) {
          this.fogGfx.fillStyle(0x000000, 0.35 + (1 - rev / 4) * 0.3);
          this.fogGfx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          this.fogGfx.fillStyle(0x000000, 0.12);
          this.fogGfx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else {
          this.fogGfx.fillStyle(0x000000, 0.9);
          this.fogGfx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ─── API compat ──────────────────────────────────────────
  updateWater(_delta: number): void { /* now handled in updateAnimations */ }
  redrawMap(): void { this.drawMap(); }
  redrawFog(): void { this.drawFog(); }

  destroy(): void {
    for (const row of this.tileSprites) for (const s of row) s.destroy();
    for (const row of this.tileBlendSprites) for (const s of row) s.destroy();
    this.animGfx.destroy();
    this.fogGfx.destroy();
    this.nightOverlay.destroy();
    this.viewportMask.destroy();
  }
}
