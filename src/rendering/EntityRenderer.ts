import Phaser from 'phaser';
import {
  TILE_SIZE, COLORS,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H, VIEWPORT_TILES,
} from '../config';
import { getLayout } from '../ui/LayoutConfig';
import { Simulation } from '../core/Simulation';
import { Entity } from '../core/Entity';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Artifact } from '../entities/Artifact';
import buildingsData from '../data/buildings.json';
import dinosaursData from '../data/dinosaurs.json';

export class EntityRenderer {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  entityGraphics: Phaser.GameObjects.Graphics[] = [];
  entityTexts: Phaser.GameObjects.Text[] = [];
  pathGraphics: Phaser.GameObjects.Graphics;
  private scrollX: number = 0;
  private scrollY: number = 0;
  selectedSettler: Settler | null = null;
  private dinoSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private dinoLastX: Map<number, number> = new Map();
  private settlerSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private settlerLastX: Map<number, number> = new Map();
  private viewportMask: Phaser.Display.Masks.GeometryMask | null = null;
  private entityContainer: Phaser.GameObjects.Container;
  private buildingContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.buildingContainer = scene.add.container(0, 0).setDepth(9);
    this.entityContainer = scene.add.container(0, 0).setDepth(10);
    this.pathGraphics = scene.add.graphics().setDepth(4);
    this.setViewportClip();
  }

  private setViewportClip(): void {
    const L = getLayout();
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(L.fieldX, L.fieldY, L.fieldW, L.fieldH);
    mask.setVisible(false);
    this.viewportMask = new Phaser.Display.Masks.GeometryMask(this.scene, mask);
    this.pathGraphics.setMask(this.viewportMask);
    this.buildingContainer.setMask(this.viewportMask);
    this.entityContainer.setMask(this.viewportMask);
  }

  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;
  }

  private isInViewport(x: number, y: number): boolean {
    const L = getLayout();
    return x >= this.scrollX && x < this.scrollX + L.viewportTiles
      && y >= this.scrollY && y < this.scrollY + L.viewportTiles;
  }

  private worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    const L = getLayout();
    return {
      sx: L.fieldX + (wx - this.scrollX) * L.tileSize + L.tileSize / 2,
      sy: L.fieldY + (wy - this.scrollY) * L.tileSize + L.tileSize / 2,
    };
  }

  updateVisuals(deltaMs: number, tilesPerMs: number): void {
    for (const entity of this.simulation.entityManager.getAll()) {
      entity.updateVisual(deltaMs, tilesPerMs);
    }
  }

  drawEntities(): void {
    this.entityGraphics.forEach(g => {
      this.entityContainer.remove(g);
      this.buildingContainer.remove(g);
      g.destroy();
    });
    this.entityGraphics = [];
    this.entityTexts.forEach(t => {
      this.entityContainer.remove(t);
      t.destroy();
    });
    this.entityTexts = [];

    const aliveDinoIds = new Set<number>();
    const aliveSettlerIds = new Set<number>();

    for (const entity of this.simulation.entityManager.getAll()) {
      if (!this.isInViewport(entity.visualX, entity.visualY)) continue;
      if (!this.simulation.tileGrid.isRevealed(Math.round(entity.visualX), Math.round(entity.visualY))) continue;

      const { sx: cx, sy: cy } = this.worldToScreen(entity.visualX, entity.visualY);

      if (entity.entityType === 'dinosaur') {
        const dino = entity as Dinosaur;
        aliveDinoIds.add(dino.id);
        this.drawDinoSprite(dino, cx, cy);
      } else if (entity.entityType === 'settler') {
        const settler = entity as Settler;
        aliveSettlerIds.add(settler.id);
        this.drawSettlerSprite(settler, cx, cy);
      } else {
        const g = this.scene.add.graphics();
        if (entity.entityType === 'resource') {
          this.drawResource(g, entity as Resource, cx, cy);
          this.entityContainer.add(g);
        } else if (entity.entityType === 'building') {
          this.drawBuilding(g, entity as Building, cx, cy);
          this.buildingContainer.add(g);
        } else if (entity.entityType === 'artifact') {
          this.drawArtifact(g, entity as Artifact, cx, cy);
          this.entityContainer.add(g);
        }
        this.entityGraphics.push(g);
      }
    }

    // Cleanup dead dino sprites
    for (const [id, sprite] of this.dinoSprites) {
      if (!aliveDinoIds.has(id)) {
        this.entityContainer.remove(sprite);
        sprite.destroy();
        this.dinoSprites.delete(id);
        this.dinoLastX.delete(id);
      }
    }

    // Cleanup dead settler sprites
    for (const [id, sprite] of this.settlerSprites) {
      if (!aliveSettlerIds.has(id)) {
        this.entityContainer.remove(sprite);
        sprite.destroy();
        this.settlerSprites.delete(id);
        this.settlerLastX.delete(id);
      }
    }
  }

  private drawSettlerSprite(settler: Settler, cx: number, cy: number): void {
    const hasTexture = this.scene.textures.exists('settler');
    let sprite = this.settlerSprites.get(settler.id);

    if (!sprite || (sprite.texture && sprite.texture.key !== 'settler')) {
      if (sprite) {
        this.entityContainer.remove(sprite);
        sprite.destroy();
      }
      this.settlerSprites.delete(settler.id);
      sprite = undefined;
    }

    if (!hasTexture) {
      if (sprite) {
        this.entityContainer.remove(sprite);
        sprite.destroy();
        this.settlerSprites.delete(settler.id);
      }
      return;
    }

    if (!sprite) {
      sprite = this.scene.add.sprite(cx, cy, 'settler', 0);
      this.entityContainer.add(sprite);
      this.settlerSprites.set(settler.id, sprite);
    }

    const animKey = `settler_${settler.activity}`;
    if (this.scene.anims.exists(animKey)) {
      try {
        if (sprite.anims.currentAnim?.key !== animKey) sprite.play(animKey);
      } catch {
        try {
          sprite.stop();
          if (sprite.texture && sprite.texture.key === 'settler') {
            sprite.setFrame(0);
          } else {
            sprite.setTexture('settler');
            sprite.setFrame(0);
          }
        } catch {
          sprite.setTexture('settler');
        }
      }
    } else {
      try {
        sprite.setFrame(0);
      } catch {
        sprite.setTexture('settler');
      }
    }

    const scale = (TILE_SIZE * 0.9) / 64;
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 0.62);
    sprite.setPosition(cx, cy + TILE_SIZE * 0.18);
    sprite.setVisible(true);

    // Tint: exhaustion = blue-shift, attack flash = red
    if (settler.energy <= 0) {
      sprite.setTint(0x6666cc);
    } else if (settler.energy < 30) {
      // Lerp between normal color and blue exhaustion tint
      const t = 1 - settler.energy / 30;
      const r = ((settler.color >> 16) & 0xff);
      const g = ((settler.color >> 8) & 0xff);
      const b = (settler.color & 0xff);
      const nr = Math.round(r + (0x66 - r) * t);
      const ng = Math.round(g + (0x66 - g) * t);
      const nb = Math.round(b + (0xcc - b) * t);
      sprite.setTint((nr << 16) | (ng << 8) | nb);
    } else if (settler.attackFlash > 0) {
      sprite.setTint(0xff6666);
    } else {
      sprite.setTint(settler.color);
    }

    const lastX = this.settlerLastX.get(settler.id);
    if (lastX !== undefined && settler.x !== lastX) {
      sprite.setFlipX(settler.x < lastX);
    }
    this.settlerLastX.set(settler.id, settler.x);

    const g = this.scene.add.graphics();
    if (this.selectedSettler === settler) {
      g.lineStyle(2, 0xccaa00, 0.8);
      g.strokeCircle(cx, cy, TILE_SIZE / 2);
    }

    const colorHex = '#' + settler.color.toString(16).padStart(6, '0');
    const nameText = this.scene.add.text(cx, cy - TILE_SIZE / 2 - 10, settler.name, {
      fontSize: '12px', color: colorHex, fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.entityContainer.add(nameText);
    this.entityTexts.push(nameText);

    if (settler.inventory.length > 0) {
      g.fillStyle(0xffaa00, 0.9);
      g.fillRect(cx + TILE_SIZE / 4, cy - TILE_SIZE / 4, 8, 8);
    }

    this.entityContainer.add(g);
    this.entityGraphics.push(g);
  }

  private drawResource(g: Phaser.GameObjects.Graphics, res: Resource, cx: number, cy: number): void {
    const size = TILE_SIZE / 2;
    const half = size / 2;

    if (res.resourceType === 'wood') {
      const logW = half * 1.4;
      const logH = half * 0.5;

      const y1 = cy + 4;
      this.drawSingleLog(g, cx, y1, logW, logH);

      const y2 = cy;
      this.drawSingleLog(g, cx, y2, logW, logH);

      const y3 = cy - 4;
      this.drawSingleLog(g, cx, y3, logW, logH);

    } else {
      const r = half * 0.75;
      const points: { x: number; y: number }[] = [];
      const numPoints = 7;
      const seed = res.id * 7;
      for (let i = 0; i < numPoints; i++) {
        const angle = (Math.PI * 2 * i) / numPoints - Math.PI / 2;
        const variation = 0.8 + ((seed * (i + 1) * 13) % 100) / 250;
        points.push({
          x: cx + Math.cos(angle) * r * variation,
          y: cy + Math.sin(angle) * r * variation,
        });
      }

      g.fillStyle(0x808080, 0.95);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
      }
      g.closePath();
      g.fillPath();

      g.lineStyle(2.5, 0x555555, 1);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
      }
      g.closePath();
      g.strokePath();

      g.fillStyle(0x999999, 0.5);
      g.beginPath();
      g.moveTo(cx - 2, cy - r * 0.6);
      g.lineTo(cx + r * 0.5, cy - r * 0.2);
      g.lineTo(cx + r * 0.3, cy + r * 0.3);
      g.lineTo(cx - r * 0.3, cy + r * 0.1);
      g.closePath();
      g.fillPath();

      g.lineStyle(1.5, 0xbbbbbb, 0.4);
      g.beginPath();
      g.moveTo(cx - r * 0.6, cy - r * 0.3);
      g.lineTo(cx, cy - r * 0.7);
      g.lineTo(cx + r * 0.5, cy - r * 0.4);
      g.strokePath();
    }

    const quantityText = this.scene.add.text(cx, cy + size / 2 + 2, `${res.quantity}`, {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.entityContainer.add(quantityText);
    this.entityTexts.push(quantityText);
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, bld: Building, cx: number, cy: number): void {
    const baseColor = (buildingsData as any)[bld.buildingType]?.color ?? COLORS.building;
    const flash = bld.fireFlash;
    if (flash > 0) bld.fireFlash = Math.max(0, flash - 0.12);
    const dmgFlash = bld.damageFlash;
    if (dmgFlash > 0) bld.damageFlash = Math.max(0, dmgFlash - 0.15);

    const hpRatio = bld.built ? bld.hp / bld.maxHp : 1;
    let color = baseColor;
    if (hpRatio < 1) {
      const r = (baseColor >> 16) & 0xff;
      const gg = (baseColor >> 8) & 0xff;
      const b = baseColor & 0xff;
      const dmg = 1 - hpRatio;
      const dr = 0x44, dg = 0x00, db = 0x00;
      const lr = Math.round(r + (dr - r) * dmg * 0.6);
      const lg = Math.round(gg + (dg - gg) * dmg * 0.6);
      const lb = Math.round(b + (db - b) * dmg * 0.6);
      color = (lr << 16) | (lg << 8) | lb;
    }

    if (flash > 0) {
      const r = (color >> 16) & 0xff;
      const gg = (color >> 8) & 0xff;
      const b = color & 0xff;
      const lr = Math.min(255, Math.round(r + (255 - r) * flash));
      const lg = Math.min(255, Math.round(gg + (255 - gg) * flash));
      const lb = Math.min(255, Math.round(b + (255 - b) * flash));
      color = (lr << 16) | (lg << 8) | lb;
    }

    const isWall = bld.buildingType === 'wall' || bld.buildingType === 'gate';
    const bldSize = bld.size ?? 1;
    const half = isWall ? TILE_SIZE / 2 - 1 : TILE_SIZE / 3;
    const drawSize = isWall ? TILE_SIZE - 2 : TILE_SIZE / 1.5;

    // Multi-tile buildings: offset center to middle of footprint
    const footprintPx = bldSize * TILE_SIZE;
    const bldCx = cx + (bldSize - 1) * TILE_SIZE / 2;
    const bldCy = cy + (bldSize - 1) * TILE_SIZE / 2;

    const alpha = bld.built ? 1.0 : 0.5 + bld.progressPercent * 0.5;
    g.fillStyle(color, alpha);
    if (bldSize > 1) {
      // Large building: fill entire footprint
      g.fillRect(bldCx - footprintPx / 2, bldCy - footprintPx / 2, footprintPx, footprintPx);
    } else {
      g.fillRect(bldCx - half, bldCy - half, drawSize, drawSize);
    }

    // Wall texture — horizontal mortar lines
    if (bld.buildingType === 'wall' && bld.built) {
      const mortarColor = 0x6b4226;
      g.lineStyle(1, mortarColor, 0.35);
      const step = 8;
      for (let row = 0; row < Math.floor(drawSize / step); row++) {
        const ly = bldCy - half + step + row * step;
        if (ly >= bldCy + half) break;
        g.lineBetween(bldCx - half, ly, bldCx + half, ly);
      }
      g.lineStyle(1, mortarColor, 0.25);
      for (let row = 0; row < Math.floor(drawSize / step); row++) {
        const ly = bldCy - half + step + row * step;
        if (ly >= bldCy + half) break;
        const offset = row % 2 === 0 ? 0 : step / 2;
        for (let vx = bldCx - half + offset; vx < bldCx + half; vx += step) {
          g.lineBetween(vx, ly, vx, Math.min(ly + step, bldCy + half));
        }
      }
    }

    // Gate — archway with opening
    if (bld.buildingType === 'gate' && bld.built) {
      g.fillStyle(0x1a0e06, 0.9);
      g.fillRect(bldCx - 6, bldCy - half + 8, 12, drawSize - 8);
      g.fillStyle(0x7a5c34, 1);
      g.fillRect(bldCx - half, bldCy - half, 10, drawSize);
      g.fillRect(bldCx + half - 10, bldCy - half, 10, drawSize);
      g.lineStyle(1, 0x5a4020, 0.4);
      const step = 8;
      for (let row = 0; row < Math.floor(drawSize / step); row++) {
        const ly = bldCy - half + step + row * step;
        if (ly >= bldCy + half) break;
        g.lineBetween(bldCx - half, ly, bldCx + half, ly);
      }
      g.fillStyle(0x5a3a1a, 1);
      g.fillRect(bldCx - half, bldCy - half, drawSize, 6);
      g.fillStyle(0xccaa44, 1);
      g.fillCircle(bldCx - 3, bldCy + 2, 2);
      g.fillCircle(bldCx + 3, bldCy + 2, 2);
    }

    // Lab — special 2x2 rendering with noise texture
    if (bld.buildingType === 'lab' && bld.built && bldSize > 1) {
      const labLeft = bldCx - footprintPx / 2;
      const labTop = bldCy - footprintPx / 2;

      // Brick/stone texture noise
      const seed = bld.id * 31;
      g.fillStyle(0x3a5577, 0.3);
      for (let i = 0; i < 40; i++) {
        const nx = labLeft + ((seed + i * 17) % Math.floor(footprintPx));
        const ny = labTop + ((seed + i * 13) % Math.floor(footprintPx));
        const nw = 3 + ((seed + i * 7) % 4);
        const nh = 2 + ((seed + i * 3) % 3);
        g.fillRect(nx, ny, nw, nh);
      }

      // Wall shading (darker edges)
      g.fillStyle(0x2a3a50, 0.4);
      g.fillRect(labLeft, labTop, footprintPx, 4);
      g.fillRect(labLeft, labTop + footprintPx - 4, footprintPx, 4);
      g.fillRect(labLeft, labTop, 4, footprintPx);
      g.fillRect(labLeft + footprintPx - 4, labTop, 4, footprintPx);

      // Window with glow
      g.fillStyle(0x88ccee, 0.5);
      g.fillRect(bldCx - 16, bldCy - 10, 32, 20);
      g.lineStyle(1, 0x224466); g.strokeRect(bldCx - 16, bldCy - 10, 32, 20);

      // Microscope
      g.fillStyle(0x224466);
      g.fillRect(bldCx - 2, bldCy - 8, 2, 10);
      g.fillRect(bldCx - 5, bldCy - 8, 6, 2);
      g.fillCircle(bldCx, bldCy - 10, 3);

      // Door
      g.fillStyle(0x334455); g.fillRect(bldCx - 6, bldCy + footprintPx / 2 - 16, 12, 14);
      g.fillStyle(0x445566); g.fillRect(bldCx - 5, bldCy + footprintPx / 2 - 15, 10, 12);

      // Roof edge
      g.lineStyle(2, 0x335577);
      g.lineBetween(labLeft, labTop + 6, labLeft + footprintPx, labTop + 6);
      g.fillStyle(0x2a3a50, 0.5);
      g.fillRect(labLeft, labTop, footprintPx, 6);

      // DNA helix decorations
      g.lineStyle(1, 0x66aacc, 0.6);
      g.lineBetween(bldCx - 20, labTop + 12, bldCx - 18, labTop + 16);
      g.lineBetween(bldCx - 18, labTop + 16, bldCx - 20, labTop + 20);
      g.lineBetween(bldCx + 20, labTop + 12, bldCx + 18, labTop + 16);
      g.lineBetween(bldCx + 18, labTop + 16, bldCx + 20, labTop + 20);

      // Small vent pipes
      g.fillStyle(0x556677, 0.7);
      g.fillRect(labLeft + 8, labTop + 2, 3, 8);
      g.fillRect(labLeft + footprintPx - 12, labTop + 2, 3, 8);
    }

    if (dmgFlash > 0) {
      g.fillStyle(0xff0000, dmgFlash * 0.4);
      if (bldSize > 1) {
        g.fillRect(bldCx - footprintPx / 2, bldCy - footprintPx / 2, footprintPx, footprintPx);
      } else {
        g.fillRect(bldCx - half, bldCy - half, drawSize, drawSize);
      }
    }

    if (flash > 0) {
      g.fillStyle(0xffffff, flash * 0.5);
      if (bldSize > 1) {
        g.fillRect(bldCx - footprintPx / 2, bldCy - footprintPx / 2, footprintPx, footprintPx);
      } else {
        g.fillRect(bldCx - half, bldCy - half, drawSize, drawSize);
      }
    }

    g.lineStyle(2, (flash > 0 || dmgFlash > 0) ? 0xffff66 : 0x000000);
    if (bldSize > 1) {
      g.strokeRect(bldCx - footprintPx / 2, bldCy - footprintPx / 2, footprintPx, footprintPx);
    } else {
      g.strokeRect(bldCx - half, bldCy - half, drawSize, drawSize);
    }

    if (bld.built && hpRatio < 0.7) {
      const crackAlpha = (1 - hpRatio) * 0.8;
      const crackColor = hpRatio < 0.4 ? 0x330000 : 0x553300;
      g.lineStyle(1, crackColor, crackAlpha);
      const seed = bld.id * 17;
      const crackArea = bldSize > 1 ? footprintPx / 2 : 10;
      for (let i = 0; i < Math.floor((1 - hpRatio) * 5); i++) {
        const ox = ((seed + i * 13) % (crackArea * 2)) - crackArea;
        const oy = ((seed + i * 7) % (crackArea * 2)) - crackArea;
        const len = 4 + ((seed + i * 3) % 6);
        g.lineBetween(
          bldCx + ox, bldCy + oy,
          bldCx + ox + len, bldCy + oy + (i % 2 === 0 ? 3 : -3)
        );
      }
    }

    if (bld.built && hpRatio < 1) {
      const barX = bldCx - half;
      const barY = bldCy - half - 6;
      const barW = bldSize > 1 ? footprintPx : drawSize;
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      const barColor = hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444;
      g.fillStyle(barColor, 1);
      g.fillRect(barX, barY, barW * hpRatio, 4);
    }

    if (!bld.built) {
      let barX = bldCx - half;
      const barY = bldCy - half - 6;
      let barW = bldSize > 1 ? footprintPx : drawSize;
      // Lab: shift left 50px, reduce width 40%
      if (bld.buildingType === 'lab') {
        barX -= 50;
        barW *= 0.6;
      }
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      g.fillStyle(0xffcc00, 1);
      g.fillRect(barX, barY, barW * bld.progressPercent, 4);
    } else if (bld.storageCapacity > 0 && bld.storageUsed > 0) {
      const barX = bldCx - half;
      const barY = bldCy - half - 6;
      const barW = bldSize > 1 ? footprintPx : drawSize;
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      g.fillStyle(0x44aaff, 1);
      g.fillRect(barX, barY, barW * (bld.storageUsed / bld.storageCapacity), 4);
    }
  }

  private drawDinoSprite(dino: Dinosaur, cx: number, cy: number): void {
    const def = (dinosaursData as any)[dino.species];
    const hasSprite = def?.sprite && this.scene.textures.exists(def.sprite);

    if (hasSprite) {
      this.drawDinoAsSprite(dino, cx, cy, def);
    } else {
      this.drawDinoAsCircle(dino, cx, cy, def);
    }
  }

  private drawDinoAsSprite(dino: Dinosaur, cx: number, cy: number, def: any): void {
    if (!this.scene.textures.exists(def.sprite)) {
      this.drawDinoAsCircle(dino, cx, cy, def);
      return;
    }

    let sprite = this.dinoSprites.get(dino.id);
    if (sprite && (!sprite.texture || sprite.texture.key !== def.sprite)) {
      this.entityContainer.remove(sprite);
      sprite.destroy();
      this.dinoSprites.delete(dino.id);
      this.dinoLastX.delete(dino.id);
      sprite = undefined;
    }
    if (!sprite) {
      sprite = this.scene.add.sprite(cx, cy, def.sprite, 0);
      this.entityContainer.add(sprite);
      this.dinoSprites.set(dino.id, sprite);
    }

    const animKey = `${def.sprite}_${this.stateToAnim(dino.state)}`;
    const animExists = this.scene.anims.exists(animKey);
    if (animExists && sprite.anims.currentAnim?.key !== animKey) {
      try {
        sprite.play(animKey);
      } catch {
        this.entityContainer.remove(sprite);
        sprite.destroy();
        this.dinoSprites.delete(dino.id);
        this.dinoLastX.delete(dino.id);
        this.drawDinoAsCircle(dino, cx, cy, def);
        return;
      }
    } else if (!animExists) {
      sprite.setVisible(true);
    }

    const frameSize = def.frameSize || 64;
    const spriteScale = def.spriteScale || 1.0;
    const footprint = dino.footprint;
    const footprintCenterOffset = (footprint - 1) * TILE_SIZE / 2;
    const scale = ((TILE_SIZE / 3) * dino.size * footprint) / (frameSize / 2) * spriteScale;
    sprite.setScale(scale);
    sprite.setPosition(cx + footprintCenterOffset, cy + footprintCenterOffset);
    sprite.setVisible(true);

    const lastX = this.dinoLastX.get(dino.id);
    if (lastX !== undefined && dino.x !== lastX) {
      sprite.setFlipX(dino.x < lastX);
    }
    this.dinoLastX.set(dino.id, dino.x);

    const g = this.scene.add.graphics();
    this.drawDinoOverlay(g, dino, cx + footprintCenterOffset, cy + footprintCenterOffset, (TILE_SIZE / 3) * dino.size * footprint);
    this.entityContainer.add(g);
    this.entityGraphics.push(g);
  }

  private drawSingleLog(g: Phaser.GameObjects.Graphics, cx: number, cy: number, logW: number, logH: number): void {
    g.fillStyle(0x8B4513, 0.95);
    g.fillRoundedRect(cx - logW / 2, cy - logH / 2, logW, logH, 3);

    g.lineStyle(2, 0x5a2d0c, 1);
    g.strokeRoundedRect(cx - logW / 2, cy - logH / 2, logW, logH, 3);

    g.lineStyle(1, 0x6b3a1a, 0.5);
    g.lineBetween(cx - logW / 2 + 4, cy - logH / 2 + 2, cx - logW / 2 + 4, cy + logH / 2 - 2);
    g.lineBetween(cx - logW / 2 + 8, cy - logH / 2 + 2, cx - logW / 2 + 8, cy + logH / 2 - 2);
    g.lineBetween(cx + logW / 2 - 4, cy - logH / 2 + 2, cx + logW / 2 - 4, cy + logH / 2 - 2);

    g.fillStyle(0xc4a265, 0.95);
    g.fillCircle(cx + logW / 2, cy, logH / 2 - 1);
    g.lineStyle(1.5, 0x8B4513, 0.8);
    g.strokeCircle(cx + logW / 2, cy, logH / 2 - 1);
    g.lineStyle(0.8, 0x8B4513, 0.4);
    g.strokeCircle(cx + logW / 2, cy, logH / 2 - 4);
    g.strokeCircle(cx + logW / 2, cy, logH / 2 - 7);

    g.lineStyle(1.5, 0xcc8844, 0.3);
    g.lineBetween(cx - logW / 2 + 3, cy - logH / 2 + 1, cx + logW / 2 - 3, cy - logH / 2 + 1);
  }

  private drawDinoAsCircle(dino: Dinosaur, cx: number, cy: number, def: any): void {
    const g = this.scene.add.graphics();
    const color = def?.color ?? COLORS.dinosaur;
    const footprint = dino.footprint;
    const footprintCenterOffset = (footprint - 1) * TILE_SIZE / 2;
    const r = (TILE_SIZE / 3) * dino.size * footprint;
    g.fillStyle(color, 0.9);
    g.fillCircle(cx + footprintCenterOffset, cy + footprintCenterOffset, r);
    g.lineStyle(2, 0x000000);
    g.strokeCircle(cx + footprintCenterOffset, cy + footprintCenterOffset, r);
    this.drawDinoOverlay(g, dino, cx + footprintCenterOffset, cy + footprintCenterOffset, r);
    this.entityContainer.add(g);
    this.entityGraphics.push(g);
  }

  private drawDinoOverlay(g: Phaser.GameObjects.Graphics, dino: Dinosaur, cx: number, cy: number, r: number): void {
    const stateColors: Record<string, string> = {
      idle: '#888888', wander: '#ffaa00', investigate: '#ff4444', flee: '#44ff44',
    };
    const speciesText = this.scene.add.text(cx, cy - r - 8, `${dino.species}`, {
      fontSize: '13px', color: stateColors[dino.state] ?? '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.entityContainer.add(speciesText);
    this.entityTexts.push(speciesText);

    if (dino.hp < dino.maxHp) {
      const barW = r * 2;
      const barX = cx - r;
      const barY = cy + r + 4;
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      g.fillStyle(0xff3333, 1);
      g.fillRect(barX, barY, barW * (dino.hp / dino.maxHp), 4);
    }
  }

  private stateToAnim(state: string): string {
    switch (state) {
      case 'wander':
      case 'investigate':
      case 'flee': return 'walk';
      case 'attack': return 'attack';
      default: return 'idle';
    }
  }

  private drawArtifact(g: Phaser.GameObjects.Graphics, artifact: Artifact, cx: number, cy: number): void {
    g.fillStyle(0xffd700, 0.9);
    g.fillCircle(cx, cy, 10);
    g.fillStyle(0xffaa00, 0.9);
    g.fillCircle(cx, cy, 6);
    g.lineStyle(2, 0x000000);
    g.strokeCircle(cx, cy, 10);

    const nameText = this.scene.add.text(cx, cy + 14, artifact.name, {
      fontSize: '11px', color: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.entityContainer.add(nameText);
    this.entityTexts.push(nameText);
  }

  drawPath(): void {
    this.pathGraphics.clear();
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    for (const settler of settlers) {
      if (settler.path.length > 1) {
        this.pathGraphics.lineStyle(2, COLORS.pathHighlight, 0.6);
        this.pathGraphics.beginPath();
        const { sx: startX, sy: startY } = this.worldToScreen(settler.visualX, settler.visualY);
        this.pathGraphics.moveTo(startX, startY);
        for (let i = settler.pathIndex; i < settler.path.length; i++) {
          const p = settler.path[i];
          if (!this.isInViewport(p.x, p.y)) continue;
          const { sx: px, sy: py } = this.worldToScreen(p.x, p.y);
          this.pathGraphics.lineTo(px, py);
        }
        this.pathGraphics.strokePath();
      }
    }
  }
}
