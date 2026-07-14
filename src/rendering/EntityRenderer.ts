import Phaser from 'phaser';
import {
  TILE_SIZE, COLORS,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H, VIEWPORT_TILES,
  NEEDS_ENABLED,
} from '../config';
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

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.pathGraphics = scene.add.graphics().setDepth(4);
    this.setViewportClip();
  }

  private setViewportClip(): void {
    const mask = this.scene.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    mask.setVisible(false);
    this.pathGraphics.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, mask));
  }

  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;
  }

  private isInViewport(x: number, y: number): boolean {
    return x >= this.scrollX - 1 && x < this.scrollX + VIEWPORT_TILES + 1
        && y >= this.scrollY - 1 && y < this.scrollY + VIEWPORT_TILES + 1;
  }

  private worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: FIELD_X + (wx - this.scrollX) * TILE_SIZE + TILE_SIZE / 2,
      sy: FIELD_Y + (wy - this.scrollY) * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  updateVisuals(deltaMs: number, tilesPerMs: number): void {
    for (const entity of this.simulation.entityManager.getAll()) {
      entity.updateVisual(deltaMs, tilesPerMs);
    }
  }

  drawEntities(): void {
    this.entityGraphics.forEach(g => g.destroy());
    this.entityGraphics = [];
    this.entityTexts.forEach(t => t.destroy());
    this.entityTexts = [];

    for (const entity of this.simulation.entityManager.getAll()) {
      if (entity.entityType !== 'settler' && !this.isInViewport(entity.visualX, entity.visualY)) continue;
      if (entity.entityType !== 'settler' && !this.simulation.tileGrid.isRevealed(Math.round(entity.visualX), Math.round(entity.visualY))) continue;

      const g = this.scene.add.graphics().setDepth(10);
      const { sx: cx, sy: cy } = this.worldToScreen(entity.visualX, entity.visualY);

      if (entity.entityType === 'settler') {
        this.drawSettler(g, entity as Settler, cx, cy);
      } else if (entity.entityType === 'resource') {
        this.drawResource(g, entity as Resource, cx, cy);
      } else if (entity.entityType === 'building') {
        this.drawBuilding(g, entity as Building, cx, cy);
      } else if (entity.entityType === 'dinosaur') {
        this.drawDinosaur(g, entity as Dinosaur, cx, cy);
      } else if (entity.entityType === 'artifact') {
        this.drawArtifact(g, entity as Artifact, cx, cy);
      }

      this.entityGraphics.push(g);
    }
  }

  private drawSettler(g: Phaser.GameObjects.Graphics, settler: Settler, cx: number, cy: number): void {
    if (this.selectedSettler === settler) {
      g.lineStyle(2, 0xccaa00, 0.8);
      g.strokeCircle(cx, cy, TILE_SIZE / 2);
    }

    g.fillStyle(settler.color, 1);
    g.fillCircle(cx, cy, TILE_SIZE / 3);
    g.lineStyle(2, 0x000000);
    g.strokeCircle(cx, cy, TILE_SIZE / 3);

    const colorHex = '#' + settler.color.toString(16).padStart(6, '0');
    this.entityTexts.push(
      this.scene.add.text(cx, cy - TILE_SIZE / 2 - 10, settler.name, {
        fontSize: '12px', color: colorHex, fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(10)
    );

    if (this.selectedSettler === settler) {
      const barWidth = TILE_SIZE - 4;
      const barHeight = 5;
      const barX = cx - TILE_SIZE / 2 + 2;
      const barY = cy - TILE_SIZE / 2 - 8;

      if (NEEDS_ENABLED) {
        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY, barWidth, barHeight);
        g.fillStyle(0x22cc22, 1);
        g.fillRect(barX, barY, barWidth * (settler.hunger / 100), barHeight);

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY - barHeight - 2, barWidth, barHeight);
        g.fillStyle(0xff3333, 1);
        g.fillRect(barX, barY - barHeight - 2, barWidth * (settler.hp / settler.maxHp), barHeight);

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY + barHeight + 2, barWidth, barHeight);
        g.fillStyle(0x2299ff, 1);
        g.fillRect(barX, barY + barHeight + 2, barWidth * (settler.energy / 100), barHeight);
      } else {
        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY, barWidth, barHeight);
        g.fillStyle(0xff3333, 1);
        g.fillRect(barX, barY, barWidth * (settler.hp / settler.maxHp), barHeight);
      }
    }

    if (settler.inventory.length > 0) {
      g.fillStyle(0xffaa00, 0.9);
      g.fillRect(cx + TILE_SIZE / 4, cy - TILE_SIZE / 4, 8, 8);
    }
  }

  private drawResource(g: Phaser.GameObjects.Graphics, res: Resource, cx: number, cy: number): void {
    const size = TILE_SIZE / 2;
    const half = size / 2;

    if (res.resourceType === 'wood') {
      g.fillStyle(0x228B22, 0.9);
      g.fillCircle(cx, cy - 4, half * 0.8);
      g.fillCircle(cx - 4, cy + 2, half * 0.6);
      g.fillCircle(cx + 4, cy + 2, half * 0.6);
      g.fillStyle(0x8B4513, 0.9);
      g.fillRect(cx - 2, cy + half * 0.4, 4, 8);
    } else {
      g.fillStyle(0x808080, 0.9);
      g.fillCircle(cx, cy, half * 0.7);
      g.fillStyle(0x696969, 0.9);
      g.fillCircle(cx - 3, cy - 2, half * 0.4);
      g.fillCircle(cx + 4, cy + 1, half * 0.35);
    }

    this.entityTexts.push(
      this.scene.add.text(cx, cy + size / 2 + 2, `${res.quantity}`, {
        fontSize: '10px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(10)
    );
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, bld: Building, cx: number, cy: number): void {
    const baseColor = (buildingsData as any)[bld.buildingType]?.color ?? COLORS.building;
    const flash = bld.fireFlash;
    if (flash > 0) bld.fireFlash = Math.max(0, flash - 0.12);
    const dmgFlash = bld.damageFlash;
    if (dmgFlash > 0) bld.damageFlash = Math.max(0, dmgFlash - 0.15);

    // HP-based damage tint: shift toward dark red as HP drops
    const hpRatio = bld.built ? bld.hp / bld.maxHp : 1;
    let color = baseColor;
    if (hpRatio < 1) {
      const r = (baseColor >> 16) & 0xff;
      const gg = (baseColor >> 8) & 0xff;
      const b = baseColor & 0xff;
      // Blend toward dark red (0x440000) based on damage
      const dmg = 1 - hpRatio;
      const dr = 0x44, dg = 0x00, db = 0x00;
      const lr = Math.round(r + (dr - r) * dmg * 0.6);
      const lg = Math.round(gg + (dg - gg) * dmg * 0.6);
      const lb = Math.round(b + (db - b) * dmg * 0.6);
      color = (lr << 16) | (lg << 8) | lb;
    }

    // Fire flash overlay
    if (flash > 0) {
      const r = (color >> 16) & 0xff;
      const gg = (color >> 8) & 0xff;
      const b = color & 0xff;
      const lr = Math.min(255, Math.round(r + (255 - r) * flash));
      const lg = Math.min(255, Math.round(gg + (255 - gg) * flash));
      const lb = Math.min(255, Math.round(b + (255 - b) * flash));
      color = (lr << 16) | (lg << 8) | lb;
    }

    const alpha = bld.built ? 1.0 : 0.5 + bld.progressPercent * 0.5;
    g.fillStyle(color, alpha);
    g.fillRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);

    // Damage flash: red tint overlay
    if (dmgFlash > 0) {
      g.fillStyle(0xff0000, dmgFlash * 0.4);
      g.fillRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);
    }

    // Fire flash overlay
    if (flash > 0) {
      g.fillStyle(0xffffff, flash * 0.5);
      g.fillRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);
    }

    g.lineStyle(2, (flash > 0 || dmgFlash > 0) ? 0xffff66 : 0x000000);
    g.strokeRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);

    // Damage cracks: draw random lines when HP is low
    if (bld.built && hpRatio < 0.7) {
      const crackAlpha = (1 - hpRatio) * 0.8;
      const crackColor = hpRatio < 0.4 ? 0x330000 : 0x553300;
      g.lineStyle(1, crackColor, crackAlpha);
      // Use building position as seed for deterministic cracks
      const seed = bld.id * 17;
      for (let i = 0; i < Math.floor((1 - hpRatio) * 5); i++) {
        const ox = ((seed + i * 13) % 20) - 10;
        const oy = ((seed + i * 7) % 20) - 10;
        const len = 4 + ((seed + i * 3) % 6);
        g.lineBetween(
          cx + ox, cy + oy,
          cx + ox + len, cy + oy + (i % 2 === 0 ? 3 : -3)
        );
      }
    }

    // HP bar for damaged buildings
    if (bld.built && hpRatio < 1) {
      const barX = cx - TILE_SIZE / 3;
      const barY = cy - TILE_SIZE / 3 - 6;
      const barW = TILE_SIZE / 1.5;
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      const barColor = hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444;
      g.fillStyle(barColor, 1);
      g.fillRect(barX, barY, barW * hpRatio, 4);
    }

    if (!bld.built) {
      const barX = cx - TILE_SIZE / 3;
      const barY = cy - TILE_SIZE / 3 - 6;
      const barW = (TILE_SIZE / 1.5);
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      g.fillStyle(0xffcc00, 1);
      g.fillRect(barX, barY, barW * bld.progressPercent, 4);
    } else if (bld.storageCapacity > 0 && bld.storageUsed > 0) {
      const barX = cx - TILE_SIZE / 3;
      const barY = cy - TILE_SIZE / 3 - 6;
      const barW = (TILE_SIZE / 1.5);
      g.fillStyle(0x333333, 0.8);
      g.fillRect(barX, barY, barW, 4);
      g.fillStyle(0x44aaff, 1);
      g.fillRect(barX, barY, barW * (bld.storageUsed / bld.storageCapacity), 4);
    }
  }

  private drawDinosaur(g: Phaser.GameObjects.Graphics, dino: Dinosaur, cx: number, cy: number): void {
    const def = (dinosaursData as any)[dino.species];
    const color = def?.color ?? COLORS.dinosaur;
    const r = (TILE_SIZE / 3) * dino.size;
    g.fillStyle(color, 0.9);
    g.fillCircle(cx, cy, r);
    g.lineStyle(2, 0x000000);
    g.strokeCircle(cx, cy, r);

    const stateColors: Record<string, string> = {
      idle: '#888888', wander: '#ffaa00', investigate: '#ff4444', flee: '#44ff44',
    };
    this.entityTexts.push(
      this.scene.add.text(cx, cy - r - 8, `${dino.species}`, {
        fontSize: '13px', color: stateColors[dino.state] ?? '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(10)
    );

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

  private drawArtifact(g: Phaser.GameObjects.Graphics, artifact: Artifact, cx: number, cy: number): void {
    g.fillStyle(0xffd700, 0.9);
    g.fillCircle(cx, cy, 10);
    g.fillStyle(0xffaa00, 0.9);
    g.fillCircle(cx, cy, 6);
    g.lineStyle(2, 0x000000);
    g.strokeCircle(cx, cy, 10);

    this.entityTexts.push(
      this.scene.add.text(cx, cy + 14, artifact.name, {
        fontSize: '11px', color: '#ffd700', fontFamily: 'monospace',
      }).setOrigin(0.5, 0).setDepth(10)
    );
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
