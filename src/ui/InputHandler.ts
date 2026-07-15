/**
 * InputHandler v3 — режим выделения + drag-select (рамка выделения)
 *
 * Left-click: выделение одиночное
 * Left-click + drag: рамка выделения — автоматически находит динозавров внутри
 * Right-click: команда движения / сбора / атаки
 */
import Phaser from 'phaser';
import {
  TILE_SIZE, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, MAP_WIDTH, MAP_HEIGHT,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { WorkSystem } from '../systems/WorkSystem';
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { TaskPriority } from '../core/Task';
import { UIManager } from './UIManager';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';
import { Dinosaur } from '../entities/Dinosaur';

type BuildingType = keyof typeof buildingsData;

const MINIMAP_X = 14;
const MINIMAP_Y = 584;
const MINIMAP_TILE_SIZE = 7;
const MINIMAP_SIZE = 210;

const DRAG_THRESHOLD = 6; // pixels before it counts as drag

export class InputHandler {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  private uiManager: UIManager;
  private workSystem: WorkSystem;
  private artifactSystem: ArtifactSystem;
  recorder: ReplayRecorder | null = null;
  hoverRect!: Phaser.GameObjects.Rectangle;
  private scrollX = 0;
  private scrollY = 0;
  private isPainting = false;
  private lastPaintX = -1;
  private lastPaintY = -1;
  scrollTo: ((tileX: number, tileY: number) => void) | null = null;

  // Selection indicators
  private selectionIndicator!: Phaser.GameObjects.Graphics;
  private commandIndicator!: Phaser.GameObjects.Graphics;

  // ── Drag-select state ──
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;
  private dragGfx!: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    simulation: Simulation,
    uiManager: UIManager,
    workSystem: WorkSystem,
    artifactSystem: ArtifactSystem
  ) {
    this.scene = scene;
    this.simulation = simulation;
    this.uiManager = uiManager;
    this.workSystem = workSystem;
    this.artifactSystem = artifactSystem;
  }

  setSimulation(simulation: Simulation): void { this.simulation = simulation; }
  setWorkSystem(workSystem: WorkSystem): void { this.workSystem = workSystem; }
  updateScroll(sx: number, sy: number): void { this.scrollX = sx; this.scrollY = sy; }

  private screenToTile(px: number, py: number): { tileX: number; tileY: number } | null {
    if (px < FIELD_X || px >= FIELD_X + FIELD_W) return null;
    if (py < FIELD_Y || py >= FIELD_Y + FIELD_H) return null;
    const tileX = Math.floor((px - FIELD_X) / TILE_SIZE) + this.scrollX;
    const tileY = Math.floor((py - FIELD_Y) / TILE_SIZE) + this.scrollY;
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return null;
    return { tileX, tileY };
  }

  private screenToMinimapTile(px: number, py: number): { tileX: number; tileY: number } | null {
    if (px < MINIMAP_X || px >= MINIMAP_X + MINIMAP_SIZE) return null;
    if (py < MINIMAP_Y || py >= MINIMAP_Y + MINIMAP_SIZE) return null;
    const tileX = Math.floor((px - MINIMAP_X) / MINIMAP_TILE_SIZE);
    const tileY = Math.floor((py - MINIMAP_Y) / MINIMAP_TILE_SIZE);
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return null;
    return { tileX, tileY };
  }

  private tileToScreen(tileX: number, tileY: number): { sx: number; sy: number } {
    return {
      sx: FIELD_X + (tileX - this.scrollX) * TILE_SIZE,
      sy: FIELD_Y + (tileY - this.scrollY) * TILE_SIZE,
    };
  }

  createHoverRect(): void {
    this.hoverRect = this.scene.add.rectangle(FIELD_X, FIELD_Y, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(2, 0xffffff)
      .setFillStyle(0xffffff, 0.15)
      .setOrigin(0)
      .setDepth(5)
      .setVisible(false);
  }

  createSelectionRect(): void {
    this.uiManager.selectionRect = this.scene.add.rectangle(FIELD_X, FIELD_Y, TILE_SIZE + 4, TILE_SIZE + 4)
      .setStrokeStyle(3, 0x00ff00)
      .setFillStyle(0x00ff00, 0.1)
      .setOrigin(0.5)
      .setDepth(6)
      .setVisible(false);
  }

  private createIndicators(): void {
    this.selectionIndicator = this.scene.add.graphics().setDepth(7).setVisible(false);
    this.commandIndicator = this.scene.add.graphics().setDepth(7).setVisible(false);
    this.dragGfx = this.scene.add.graphics().setDepth(8).setVisible(false);
  }

  setupInputHandlers(): void {
    this.createIndicators();

    // ── Pointer DOWN ──
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Resume AudioContext on first user gesture (browser policy)
      const ctx = (this.scene.sound as any)?.context;
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (this.uiManager.startMenuOpen) return;

      // Right-click
      if (pointer.rightButtonDown()) {
        if (this.uiManager.buildMode) {
          this.cancelBuildMode();
          return;
        }
        const coords = this.screenToTile(pointer.x, pointer.y);
        if (!coords) return;
        this.handleCommand(coords.tileX, coords.tileY, (pointer.event as MouseEvent).shiftKey);
        return;
      }

      // Left-click
      const minimapCoords = this.screenToMinimapTile(pointer.x, pointer.y);
      if (minimapCoords) {
        this.handleMinimapClick(minimapCoords.tileX, minimapCoords.tileY);
        return;
      }

      const coords = this.screenToTile(pointer.x, pointer.y);
      if (!coords) return;

      if (this.uiManager.buildMode) {
        this.isPainting = true;
        this.paintAt(coords.tileX, coords.tileY);
        return;
      }

      // ── Start drag-select ──
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.isDragging = false;
    });

    // ── Pointer MOVE ──
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.uiManager.startMenuOpen) {
        this.hoverRect.setVisible(false);
        return;
      }

      const coords = this.screenToTile(pointer.x, pointer.y);

      // Hover
      if (coords && !this.isDragging) {
        const { sx, sy } = this.tileToScreen(coords.tileX, coords.tileY);
        this.hoverRect.setPosition(sx, sy);
        this.hoverRect.setVisible(true);
        this.updateHoverStyle(coords.tileX, coords.tileY);
      } else if (!this.isDragging) {
        this.hoverRect.setVisible(false);
      }

      // Build painting
      if (this.isPainting && this.uiManager.buildMode && !pointer.rightButtonDown()) {
        if (coords) this.paintAt(coords.tileX, coords.tileY);
        return;
      }

      // ── Drag-select rectangle ──
      if (pointer.leftButtonDown() && !this.uiManager.buildMode) {
        const dx = pointer.x - this.dragStartX;
        const dy = pointer.y - this.dragStartY;

        if (!this.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          this.isDragging = true;
          this.hoverRect.setVisible(false);
        }

        if (this.isDragging) {
          this.drawDragRect(this.dragStartX, this.dragStartY, pointer.x, pointer.y);
        }
      }
    });

    // ── Pointer UP ──
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      // End paint
      this.isPainting = false;
      this.lastPaintX = -1;
      this.lastPaintY = -1;

      // ── End drag-select ──
      if (this.isDragging) {
        this.isDragging = false;
        this.dragGfx.clear();
        this.dragGfx.setVisible(false);
        this.handleDragSelect(this.dragStartX, this.dragStartY, pointer.x, pointer.y);
        return;
      }

      // ── Single click select ──
      if (this.uiManager.startMenuOpen) return;
      const coords = this.screenToTile(pointer.x, pointer.y);
      if (!coords) return;

      if (this.uiManager.buildMode) {
        // Already handled in pointerdown
        return;
      }

      this.handleSelect(coords.tileX, coords.tileY);
    });

    // ── Keyboard ──
    this.scene.input.keyboard?.on('keydown-ESC', () => this.cancelBuildMode());

    // ── Block browser context menu ──
    this.scene.input.mouse?.disableContextMenu();
    const canvas = this.scene.game.canvas;
    canvas.addEventListener('contextmenu', (e: Event) => { e.preventDefault(); });
  }

  // ── Draw drag selection rectangle ──
  private drawDragRect(x1: number, y1: number, x2: number, y2: number): void {
    // Clamp to viewport
    const clampX = (v: number) => Math.max(FIELD_X, Math.min(FIELD_X + FIELD_W, v));
    const clampY = (v: number) => Math.max(FIELD_Y, Math.min(FIELD_Y + FIELD_H, v));
    const cx1 = clampX(x1), cy1 = clampY(y1);
    const cx2 = clampX(x2), cy2 = clampY(y2);

    const left = Math.min(cx1, cx2);
    const top = Math.min(cy1, cy2);
    const w = Math.abs(cx2 - cx1);
    const h = Math.abs(cy2 - cy1);

    this.dragGfx.clear();
    this.dragGfx.setVisible(true);

    // Fill
    this.dragGfx.fillStyle(0x00ff00, 0.08);
    this.dragGfx.fillRect(left, top, w, h);

    // Border
    this.dragGfx.lineStyle(1.5, 0x00ff00, 0.6);
    this.dragGfx.strokeRect(left, top, w, h);

    // Corner markers
    const m = 4;
    this.dragGfx.lineStyle(2, 0x00ff00, 0.9);
    // Top-left
    this.dragGfx.lineBetween(left, top + m, left, top);
    this.dragGfx.lineBetween(left, top, left + m, top);
    // Top-right
    this.dragGfx.lineBetween(left + w - m, top, left + w, top);
    this.dragGfx.lineBetween(left + w, top, left + w, top + m);
    // Bottom-left
    this.dragGfx.lineBetween(left, top + h - m, left, top + h);
    this.dragGfx.lineBetween(left, top + h, left + m, top + h);
    // Bottom-right
    this.dragGfx.lineBetween(left + w - m, top + h, left + w, top + h);
    this.dragGfx.lineBetween(left + w, top + h - m, left + w, top + h);

    // Count entities in box
    const box = this.getEntitiesInScreenRect(cx1, cy1, cx2, cy2);
    if (box.dinosaurs.length > 0) {
      // Show count
      this.dragGfx.fillStyle(0xff4444, 0.9);
      const labelX = left + w / 2;
      const labelY = top - 12;
      // Small indicator above the box
      this.dragGfx.fillCircle(labelX, labelY, 8);
      // We can't easily render text in Graphics, so just use a colored dot
    }
  }

  // ── Handle drag-select completion ──
  private handleDragSelect(x1: number, y1: number, x2: number, y2: number): void {
    // Clamp
    const cx1 = Math.max(FIELD_X, Math.min(FIELD_X + FIELD_W, x1));
    const cy1 = Math.max(FIELD_Y, Math.min(FIELD_Y + FIELD_H, y1));
    const cx2 = Math.max(FIELD_X, Math.min(FIELD_X + FIELD_W, x2));
    const cy2 = Math.max(FIELD_Y, Math.min(FIELD_Y + FIELD_H, y2));

    // Too small — treat as click
    if (Math.abs(cx2 - cx1) < DRAG_THRESHOLD && Math.abs(cy2 - cy1) < DRAG_THRESHOLD) {
      return;
    }

    const box = this.getEntitiesInScreenRect(cx1, cy1, cx2, cy2);

    // Priority: dinosaurs > settlers > resources
    if (box.dinosaurs.length > 0) {
      // Select closest dinosaur to center of box
      const centerX = (cx1 + cx2) / 2;
      const centerY = (cy1 + cy2) / 2;
      let closest = box.dinosaurs[0];
      let closestDist = Infinity;
      for (const d of box.dinosaurs) {
        const { sx, sy } = this.tileToScreen(d.x, d.y);
        const dist = Math.hypot(sx - centerX, sy - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = d;
        }
      }

      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = closest;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
      this.uiManager.addLog(`${languageManager.ui.selected}: ${closest.species} (${closest.state})`);
      this.showSelectionRing(closest.x, closest.y, 0xff4444);

      // Scroll to it
      if (this.scrollTo) this.scrollTo(closest.x, closest.y);
      return;
    }

    if (box.settlers.length > 0) {
      const s = box.settlers[0];
      (this.scene as any).selectSettler(s);
      this.uiManager.addLog(`${languageManager.ui.selected}: ${s.name} (${s.settlerClass})`);
      this.showSelectionRing(s.x, s.y, 0x44ff44);
      return;
    }

    if (box.resources.length > 0) {
      const r = box.resources[0];
      this.uiManager.selectedEntity = r;
      this.uiManager.addLog(`${languageManager.ui.selected}: ${r.resourceType} (${r.quantity})`);
      this.showSelectionRing(r.x, r.y, 0xffaa00);
    }
  }

  // ── Get all entities inside a screen-space rectangle ──
  private getEntitiesInScreenRect(
    sx1: number, sy1: number, sx2: number, sy2: number
  ): { dinosaurs: Dinosaur[]; settlers: Settler[]; resources: Resource[] } {
    const result = { dinosaurs: [] as Dinosaur[], settlers: [] as Settler[], resources: [] as Resource[] };

    const left = Math.min(sx1, sx2);
    const right = Math.max(sx1, sx2);
    const top = Math.min(sy1, sy2);
    const bottom = Math.max(sy1, sy2);

    // Convert screen rect to tile range
    const tileLeft = Math.floor((left - FIELD_X) / TILE_SIZE) + this.scrollX;
    const tileRight = Math.floor((right - FIELD_X) / TILE_SIZE) + this.scrollX;
    const tileTop = Math.floor((top - FIELD_Y) / TILE_SIZE) + this.scrollY;
    const tileBottom = Math.floor((bottom - FIELD_Y) / TILE_SIZE) + this.scrollY;

    // Search entities in tile range (with margin for large dinos)
    const margin = 2;
    const minX = Math.max(0, tileLeft - margin);
    const maxX = Math.min(MAP_WIDTH - 1, tileRight + margin);
    const minY = Math.max(0, tileTop - margin);
    const maxY = Math.min(MAP_HEIGHT - 1, tileBottom + margin);

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        // Check if entity screen position is inside the box
        const entities = this.simulation.entityManager.getAllAt(tx, ty);
        for (const e of entities) {
          const { sx, sy } = this.tileToScreen(e.x, e.y);
          const cx = sx + TILE_SIZE / 2;
          const cy = sy + TILE_SIZE / 2;

          if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
            if (e.entityType === 'dinosaur') {
              result.dinosaurs.push(e as Dinosaur);
            } else if (e.entityType === 'settler') {
              result.settlers.push(e as Settler);
            } else if (e.entityType === 'resource') {
              result.resources.push(e as Resource);
            }
          }
        }
      }
    }

    return result;
  }

  // ── Hover style ──
  private updateHoverStyle(tileX: number, tileY: number): void {
    if (this.uiManager.buildMode) {
      this.hoverRect.setStrokeStyle(2, 0xffff00);
      this.hoverRect.setFillStyle(0xffff00, 0.15);
      return;
    }

    const entity = this.simulation.entityManager.getAt(tileX, tileY);
    if (entity) {
      if (entity.entityType === 'settler') {
        this.hoverRect.setStrokeStyle(2, 0x44ff44);
        this.hoverRect.setFillStyle(0x44ff44, 0.15);
      } else if (entity.entityType === 'dinosaur') {
        this.hoverRect.setStrokeStyle(2, 0xff4444);
        this.hoverRect.setFillStyle(0xff4444, 0.15);
      } else if (entity.entityType === 'resource' || entity.entityType === 'artifact') {
        this.hoverRect.setStrokeStyle(2, 0xffaa00);
        this.hoverRect.setFillStyle(0xffaa00, 0.15);
      } else if (entity.entityType === 'building') {
        this.hoverRect.setStrokeStyle(2, 0x88aaff);
        this.hoverRect.setFillStyle(0x88aaff, 0.15);
      }
    } else {
      this.hoverRect.setStrokeStyle(2, 0xffffff);
      this.hoverRect.setFillStyle(0xffffff, 0.1);
    }
  }

  // ── Single click select ──
  private handleSelect(tileX: number, tileY: number): void {
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;

    const settlerAtTile = this.simulation.entityManager.getAt(tileX, tileY, 'settler') as Settler | undefined;
    if (settlerAtTile) {
      this.recorder?.record(ReplayActionType.SelectSettler, { settlerId: settlerAtTile.id });
      (this.scene as any).selectSettler(settlerAtTile);
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = null;
      this.uiManager.addLog(`${languageManager.ui.selected}: ${settlerAtTile.name} (${settlerAtTile.settlerClass})`);
      this.showSelectionRing(tileX, tileY, 0x44ff44);
      return;
    }

    const buildingAtTile = this.simulation.entityManager.getAt(tileX, tileY, 'building') as Building | undefined;
    if (buildingAtTile) {
      this.uiManager.selectedBuilding = buildingAtTile;
      this.uiManager.selectedEntity = null;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
      const def = (buildingsData as any)[buildingAtTile.buildingType];
      this.uiManager.addLog(`${languageManager.ui.selected}: ${def?.name ?? buildingAtTile.buildingType}`);
      this.showSelectionRing(tileX, tileY, 0x88aaff);
      return;
    }

    const entityAtTile = this.simulation.entityManager.getAllAt(tileX, tileY)
      .find(e => e.entityType === 'resource' || e.entityType === 'dinosaur' || e.entityType === 'artifact');

    if (entityAtTile) {
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = entityAtTile;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();

      if (entityAtTile.entityType === 'dinosaur') {
        const dino = entityAtTile as Dinosaur;
        this.uiManager.addLog(`${languageManager.ui.selected}: ${dino.species} (${dino.state})`);
        this.showSelectionRing(tileX, tileY, 0xff4444);
      } else if (entityAtTile.entityType === 'resource') {
        const res = entityAtTile as Resource;
        this.uiManager.addLog(`${languageManager.ui.selected}: ${res.resourceType} (${res.quantity})`);
        this.showSelectionRing(tileX, tileY, 0xffaa00);
      } else {
        this.uiManager.addLog(`${languageManager.ui.selected}: artifact`);
        this.showSelectionRing(tileX, tileY, 0xaa44ff);
      }
      return;
    }

    this.uiManager.deselectAll();
    this.uiManager.buildMode = null;
    this.uiManager.updateBuildButtonStates();
  }

  // ── Right-click command ──
  private handleCommand(tileX: number, tileY: number, queue: boolean = false): void {
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;

    const settler = (this.scene as any).getSelectedSettler() as Settler;
    if (!settler || !settler.isAlive) return;

    const entityAtTile = this.simulation.entityManager.getAllAt(tileX, tileY)
      .find(e => e.entityType === 'resource' || e.entityType === 'artifact');

    if (entityAtTile) {
      this.recorder?.record(ReplayActionType.Collect, { entityId: entityAtTile.id, settlerId: settler.id });
      this.uiManager.selectedEntity = entityAtTile;
      this.uiManager.onCollectCallback?.(entityAtTile, queue);
      this.showCommandMarker(tileX, tileY, 0xffaa00);
      return;
    }

    const dinoAtTile = this.simulation.entityManager.getAt(tileX, tileY, 'dinosaur');
    if (dinoAtTile) {
      this.uiManager.selectedEntity = dinoAtTile;
      this.uiManager.addLog(`Attack command: ${tileX},${tileY}`);
      this.showCommandMarker(tileX, tileY, 0xff4444);
      return;
    }

    if (tile.walkable) {
      this.recorder?.record(ReplayActionType.MoveSettler, { x: tileX, y: tileY, settlerId: settler.id });
      this.workSystem.createMoveTask(tileX, tileY, undefined, settler, queue);
      this.showCommandMarker(tileX, tileY, 0x44ff44);
    }
  }

  // ── Selection ring ──
  private showSelectionRing(tileX: number, tileY: number, color: number): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const cx = sx + TILE_SIZE / 2;
    const cy = sy + TILE_SIZE / 2;
    const r = TILE_SIZE / 2 + 4;

    this.selectionIndicator.clear();
    this.selectionIndicator.setVisible(true);
    this.selectionIndicator.lineStyle(2, color, 0.8);
    this.selectionIndicator.strokeCircle(cx, cy, r);
    this.selectionIndicator.lineStyle(1, color, 0.4);
    this.selectionIndicator.strokeCircle(cx, cy, r + 3);

    this.scene.tweens.add({
      targets: this.selectionIndicator,
      alpha: { from: 1, to: 0 },
      duration: 600,
      onComplete: () => { this.selectionIndicator.setVisible(false); this.selectionIndicator.setAlpha(1); },
    });
  }

  // ── Command marker ──
  private showCommandMarker(tileX: number, tileY: number, color: number): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const cx = sx + TILE_SIZE / 2;
    const cy = sy + TILE_SIZE / 2;

    this.commandIndicator.clear();
    this.commandIndicator.setVisible(true);
    this.commandIndicator.lineStyle(2, color, 0.9);
    const size = 8;
    this.commandIndicator.lineBetween(cx - size, cy, cx + size, cy);
    this.commandIndicator.lineBetween(cx, cy - size, cx, cy + size);
    this.commandIndicator.lineStyle(1, color, 0.6);
    this.commandIndicator.beginPath();
    this.commandIndicator.moveTo(cx, cy - 6);
    this.commandIndicator.lineTo(cx + 6, cy);
    this.commandIndicator.lineTo(cx, cy + 6);
    this.commandIndicator.lineTo(cx - 6, cy);
    this.commandIndicator.closePath();
    this.commandIndicator.strokePath();

    this.scene.tweens.add({
      targets: this.commandIndicator,
      alpha: { from: 1, to: 0 },
      duration: 800,
      onComplete: () => { this.commandIndicator.setVisible(false); this.commandIndicator.setAlpha(1); },
    });
  }

  private cancelBuildMode(): void {
    this.isPainting = false;
    this.lastPaintX = -1;
    this.lastPaintY = -1;
    if (this.uiManager.buildMode) {
      this.recorder?.record(ReplayActionType.CancelBuild);
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
      this.uiManager.addLog('Build mode off (right-click / Esc)');
    }
  }

  private paintAt(tileX: number, tileY: number): void {
    if (tileX === this.lastPaintX && tileY === this.lastPaintY) return;
    this.lastPaintX = tileX;
    this.lastPaintY = tileY;
    this.handleBuildClick(tileX, tileY, this.simulation.tileGrid.get(tileX, tileY)!);
  }

  private handleBuildClick(tileX: number, tileY: number, tile: any): void {
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;
    if (!tile.walkable) { this.uiManager.addLog(languageManager.ui.logCannotBuildHere); return; }

    const entityAt = this.simulation.entityManager.getAt(tileX, tileY);
    if (entityAt && entityAt.entityType === 'settler') {
      const s = entityAt as Settler;
      (this.scene as any).selectSettler(s);
      this.uiManager.addLog(`${languageManager.ui.selected}: ${s.name} (${s.settlerClass})`);
      return;
    }
    if (entityAt) { this.uiManager.addLog(languageManager.ui.logTileOccupied); return; }

    const def = (buildingsData as any)[this.uiManager.buildMode!];
    const hasAll = Object.entries(def.requires).every(([res, qty]) => this.simulation.hasResource(res, qty as number));
    if (!hasAll) {
      const need = Object.entries(def.requires).map(([r, q]) => `${r}:${q}`).join(', ');
      this.uiManager.addLog(`${languageManager.ui.logNeed}: ${need}`);
      return;
    }

    const building = new Building(tileX, tileY, this.uiManager.buildMode!, def.maxHp, def.buildTime,
      Object.entries(def.requires).map(([r, q]) => ({ resourceType: r, quantity: q as number })));
    building.storageCapacity = def.storageCapacity ? def.storageCapacity + this.artifactSystem.getStorageBonus() : 0;
    building.produceType = def.produceType ?? '';
    building.produceRate = def.produceRate ?? 0;
    building.produceInterval = def.produceInterval ?? 0;
    building.attackDamage = def.attackDamage ?? 0;
    building.attackRange = def.attackRange ?? 0;
    building.attackInterval = def.attackInterval ?? 0;
    this.simulation.entityManager.add(building);
    this.simulation.tileGrid.setBuilding(tileX, tileY, true);
    if (def.isGate) {
      this.simulation.tileGrid.setGate(tileX, tileY, true);
      this.simulation.tileGrid.setDinoBlocked(tileX, tileY, true);
    } else {
      this.simulation.tileGrid.setOccupied(tileX, tileY, true);
    }

    const selected = (this.scene as any).getSelectedSettler() as Settler;
    const buildingType = this.uiManager.buildMode!;
    this.recorder?.record(ReplayActionType.Build, { x: tileX, y: tileY, buildingType, settlerId: selected?.id ?? 0 });
    this.workSystem.createBuildTask(building, TaskPriority.High, selected);
    this.uiManager.addLog(`${languageManager.ui.logBuildingAt} ${def.name} ${tileX},${tileY}`);
    this.uiManager.checkMilestone('firstBuilding');
    if (buildingType !== 'wall') this.uiManager.buildMode = null;
    this.uiManager.updateBuildButtonStates();
  }

  hideHover(): void { this.hoverRect.setVisible(false); }

  private handleMinimapClick(tileX: number, tileY: number): void {
    this.recorder?.record(ReplayActionType.MinimapClick, { x: tileX, y: tileY });
    if (this.scrollTo) this.scrollTo(tileX, tileY);
    this.uiManager.addLog(`${languageManager.ui.logAt} (${tileX},${tileY})`);
  }
}
