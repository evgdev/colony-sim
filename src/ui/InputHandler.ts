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
import { getLayout } from './LayoutConfig';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { WorkSystem } from '../systems/WorkSystem';
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { TaskPriority } from '../core/Task';
import { UIManager } from './UIManager';
import { MenuSystem } from './MenuSystem';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';
import { Dinosaur } from '../entities/Dinosaur';
import { getContextMenuForEntity, getTooltipForEntity, EntityMenuContext } from './EntityMenuBuilder';

type BuildingType = keyof typeof buildingsData;

const MINIMAP_X = 14;
const MINIMAP_Y = 644;
const MINIMAP_TILE_SIZE = 7;
const MINIMAP_SIZE = 210;

const DRAG_THRESHOLD = 6; // pixels before it counts as drag

export class InputHandler {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  private uiManager: UIManager;
  private menuSystem: MenuSystem;
  private workSystem: WorkSystem;
  private artifactSystem: ArtifactSystem;
  recorder: ReplayRecorder | null = null;
  hoverRect!: Phaser.GameObjects.Rectangle;
  private blockedTilesGfx!: Phaser.GameObjects.Graphics;
  private scrollX = 0;
  private scrollY = 0;
  private isPainting = false;
  private lastPaintX = -1;
  private lastPaintY = -1;
  scrollTo: ((tileX: number, tileY: number) => void) | null = null;
  onMoveHere: ((x: number, y: number, queue: boolean) => void) | null = null;
  onAttackEntity: ((entity: import('../core/Entity').Entity, queue: boolean) => void) | null = null;
  onShootClick: ((tileX: number, tileY: number) => void) | null = null;
  private shootMode: boolean = false;
  encyclopediaOpen: boolean = false;

  // Selection indicators
  private selectionIndicator!: Phaser.GameObjects.Graphics;
  private commandIndicator!: Phaser.GameObjects.Graphics;

  // ── Drag-select state ──
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;
  private dragGfx!: Phaser.GameObjects.Graphics;

  // ── Hover tooltip state ──
  private lastHoverEntity: import('../core/Entity').Entity | null = null;
  private lastPointerWasRight = false;
  selectedTreeTile: { x: number; y: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    simulation: Simulation,
    uiManager: UIManager,
    menuSystem: MenuSystem,
    workSystem: WorkSystem,
    artifactSystem: ArtifactSystem
  ) {
    this.scene = scene;
    this.simulation = simulation;
    this.uiManager = uiManager;
    this.menuSystem = menuSystem;
    this.workSystem = workSystem;
    this.artifactSystem = artifactSystem;
  }

  setSimulation(simulation: Simulation): void { this.simulation = simulation; }
  setWorkSystem(workSystem: WorkSystem): void { this.workSystem = workSystem; }
  setShootMode(enabled: boolean): void { this.shootMode = enabled; }
  updateScroll(sx: number, sy: number): void { this.scrollX = sx; this.scrollY = sy; }

  private screenToTile(px: number, py: number): { tileX: number; tileY: number } | null {
    const L = getLayout();
    if (px < L.fieldX || px >= L.fieldX + L.fieldW) return null;
    if (py < L.fieldY || py >= L.fieldY + L.fieldH) return null;
    const tileX = Math.floor((px - L.fieldX) / L.tileSize) + this.scrollX;
    const tileY = Math.floor((py - L.fieldY) / L.tileSize) + this.scrollY;
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
    const L = getLayout();
    return {
      sx: L.fieldX + (tileX - this.scrollX) * L.tileSize,
      sy: L.fieldY + (tileY - this.scrollY) * L.tileSize,
    };
  }

  createHoverRect(): void {
    const L = getLayout();
    this.hoverRect = this.scene.add.rectangle(L.fieldX, L.fieldY, L.tileSize, L.tileSize)
      .setStrokeStyle(2, 0xffffff)
      .setFillStyle(0xffffff, 0.15)
      .setOrigin(0)
      .setDepth(5)
      .setVisible(false);
    this.blockedTilesGfx = this.scene.add.graphics().setDepth(5);
  }

  createSelectionRect(): void {
    const L = getLayout();
    this.uiManager.selectionRect = this.scene.add.rectangle(L.fieldX, L.fieldY, L.tileSize + 4, L.tileSize + 4)
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
      if ((this.scene as any).dialoguePaused) return;
      if (this.encyclopediaOpen) return;

      // Right-click
      if (pointer.rightButtonDown()) {
        this.lastPointerWasRight = true;
        this.menuSystem.hideAll();
        if (this.uiManager.buildMode) {
          this.cancelBuildMode();
          return;
        }
        const coords = this.screenToTile(pointer.x, pointer.y);
        if (!coords) return;

        // Right-click on lab → auto deliver artifact
        const building = this.simulation.entityManager.getAt(coords.tileX, coords.tileY, 'building') as Building | undefined;
        const settler = (this.scene as any).getSelectedSettler() as Settler | undefined;
        if (building?.buildingType === 'lab' && building.built && settler?.isAlive) {
          const artifactItem = settler.inventory.find(i => i.resourceType === 'artifact');
          if (artifactItem) {
            this.workSystem.createDeliverArtifactTask(settler, TaskPriority.High);
            this.uiManager.addLog(`${settler.name} несёт ${artifactItem.name} в лабораторию`);
            return;
          }
        }

        // Right-click on incubator → start incubation
        if (building?.buildingType === 'incubator' && building.built) {
          this.showIncubatorContextMenu(building, coords.tileX, coords.tileY);
          return;
        }

        // Right-click on paddock → show stored dinosaurs
        if (building?.buildingType === 'paddock' && building.built) {
          this.showPaddockContextMenu(building, coords.tileX, coords.tileY);
          return;
        }

        this.handleCommand(coords.tileX, coords.tileY, (pointer.event as MouseEvent).shiftKey);
        return;
      }

      // Left-click — close context menu if open
      if (this.menuSystem.isContextMenuVisible()) {
        this.menuSystem.hideContextMenu();
        return;
      }
      this.lastPointerWasRight = false;

      // Shoot mode — left-click fires projectile, block everything else
      if (this.shootMode) {
        const coords = this.screenToTile(pointer.x, pointer.y);
        if (coords) this.onShootClick?.(coords.tileX, coords.tileY);
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
      if (this.uiManager.startMenuOpen || (this.scene as any).dialoguePaused || this.encyclopediaOpen) {
        this.hoverRect.setVisible(false);
        this.menuSystem.hideTooltip();
        return;
      }

      const coords = this.screenToTile(pointer.x, pointer.y);

      // Hover
      if (coords && !this.isDragging) {
        // Check if hovering over any tile of a multi-tile building
        let hoverTileX = coords.tileX;
        let hoverTileY = coords.tileY;
        let hoverSize = 1;
        if (!this.uiManager.buildMode) {
          const allBuildings = this.simulation.entityManager.getByType('building') as Building[];
          for (const b of allBuildings) {
            const bldSize = b.size ?? 1;
            if (coords.tileX >= b.x && coords.tileX < b.x + bldSize &&
                coords.tileY >= b.y && coords.tileY < b.y + bldSize) {
              hoverTileX = b.x;
              hoverTileY = b.y;
              hoverSize = bldSize;
              break;
            }
          }
        }

        const { sx: hsx, sy: hsy } = this.tileToScreen(hoverTileX, hoverTileY);
        this.hoverRect.setPosition(hsx, hsy);

        // Resize hover rect for multi-tile buildings
        if (this.uiManager.buildMode) {
          const def = (buildingsData as any)[this.uiManager.buildMode];
          const bldSize = def?.size ?? 1;
          this.hoverRect.setSize(TILE_SIZE * bldSize, TILE_SIZE * bldSize);
        } else {
          this.hoverRect.setSize(TILE_SIZE * hoverSize, TILE_SIZE * hoverSize);
        }

        this.hoverRect.setVisible(true);
        this.updateHoverStyle(coords.tileX, coords.tileY);

        // Draw red rects on blocked tiles in footprint
        this.blockedTilesGfx.clear();
        if (this.uiManager.buildMode) {
          const def = (buildingsData as any)[this.uiManager.buildMode];
          const bldSize = def?.size ?? 1;
          for (let dy = 0; dy < bldSize; dy++) {
            for (let dx = 0; dx < bldSize; dx++) {
              const fx = coords.tileX + dx;
              const fy = coords.tileY + dy;
              const ft = this.simulation.tileGrid.get(fx, fy);
              const decGen = (this.scene as any).decorationGenerator;
              const hasTree = decGen?.getTreeAt(fx, fy);
              const hasEntity = this.simulation.entityManager.getAt(fx, fy);
              const blocked = !ft || !ft.walkable || ft.occupied || ft.building || hasTree || hasEntity;
              if (blocked) {
                const { sx: rx, sy: ry } = this.tileToScreen(fx, fy);
                this.blockedTilesGfx.fillStyle(0xff4444, 0.4);
                this.blockedTilesGfx.fillRect(rx, ry, TILE_SIZE, TILE_SIZE);
              }
            }
          }
        }

        // Show tooltip for entity under cursor
        const hoverEntity = this.simulation.entityManager.getAt(coords.tileX, coords.tileY);
        if (hoverEntity && hoverEntity !== this.lastHoverEntity) {
          this.lastHoverEntity = hoverEntity;
          const lines = getTooltipForEntity(hoverEntity);
          this.menuSystem.showTooltip(lines, pointer.x, pointer.y);
        } else if (!hoverEntity) {
          this.lastHoverEntity = null;
          this.menuSystem.hideTooltip();
        }
      } else if (!this.isDragging) {
        this.hoverRect.setVisible(false);
        this.blockedTilesGfx.clear();
        this.lastHoverEntity = null;
        this.menuSystem.hideTooltip();
      }

      // Build painting
      if (this.isPainting && this.uiManager.buildMode && !pointer.rightButtonDown()) {
        if (coords) this.paintAt(coords.tileX, coords.tileY);
        return;
      }

      // ── Drag-select rectangle ──
      if (pointer.leftButtonDown() && !this.uiManager.buildMode && !this.shootMode) {
        const dx = pointer.x - this.dragStartX;
        const dy = pointer.y - this.dragStartY;

        if (!this.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          this.isDragging = true;
          this.hoverRect.setVisible(false);
          this.menuSystem.hideTooltip();
        }

        if (this.isDragging) {
          this.drawDragRect(this.dragStartX, this.dragStartY, pointer.x, pointer.y);
        }
      }
    });

    // ── Pointer UP ──
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.lastPointerWasRight) return;
      if (this.encyclopediaOpen) return;

      // End paint
      this.isPainting = false;
      this.lastPaintX = -1;
      this.lastPaintY = -1;

      // ── End drag-select ──
      if (this.isDragging) {
        this.isDragging = false;
        this.dragGfx.clear();
        this.dragGfx.setVisible(false);
        if (!this.shootMode) this.handleDragSelect(this.dragStartX, this.dragStartY, pointer.x, pointer.y);
        return;
      }

      // ── Single click select ──
      if (this.uiManager.startMenuOpen || (this.scene as any).dialoguePaused) return;
      if (this.shootMode) return; // no selection in shoot mode
      const coords = this.screenToTile(pointer.x, pointer.y);
      if (!coords) return;

      if (this.uiManager.buildMode) {
        // Already handled in pointerdown
        return;
      }

      this.handleSelect(coords.tileX, coords.tileY);
    });

    // ── Keyboard ──
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      this.menuSystem.hideAll();
      this.cancelBuildMode();
    });

    // ── Block browser context menu ──
    this.scene.input.mouse?.disableContextMenu();
    const canvas = this.scene.game.canvas;
    canvas.addEventListener('contextmenu', (e: Event) => { e.preventDefault(); });
  }

  // ── Draw drag selection rectangle ──
  private drawDragRect(x1: number, y1: number, x2: number, y2: number): void {
    // Clamp to viewport
    const L = getLayout();
    const clampX = (v: number) => Math.max(L.fieldX, Math.min(L.fieldX + L.fieldW, v));
    const clampY = (v: number) => Math.max(L.fieldY, Math.min(L.fieldY + L.fieldH, v));
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
    const L = getLayout();
    const cx1 = Math.max(L.fieldX, Math.min(L.fieldX + L.fieldW, x1));
    const cy1 = Math.max(L.fieldY, Math.min(L.fieldY + L.fieldH, y1));
    const cx2 = Math.max(L.fieldX, Math.min(L.fieldX + L.fieldW, x2));
    const cy2 = Math.max(L.fieldY, Math.min(L.fieldY + L.fieldH, y2));

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
    const L = getLayout();
    const tileLeft = Math.floor((left - L.fieldX) / L.tileSize) + this.scrollX;
    const tileRight = Math.floor((right - L.fieldX) / L.tileSize) + this.scrollX;
    const tileTop = Math.floor((top - L.fieldY) / L.tileSize) + this.scrollY;
    const tileBottom = Math.floor((bottom - L.fieldY) / L.tileSize) + this.scrollY;

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
      // Check multi-tile buildings
      const allBuildings = this.simulation.entityManager.getByType('building') as Building[];
      let isMultiTileBuilding = false;
      for (const b of allBuildings) {
        const bldSize = b.size ?? 1;
        if (bldSize > 1 && tileX >= b.x && tileX < b.x + bldSize &&
            tileY >= b.y && tileY < b.y + bldSize) {
          isMultiTileBuilding = true;
          break;
        }
      }
      if (isMultiTileBuilding) {
        this.hoverRect.setStrokeStyle(2, 0x88aaff);
        this.hoverRect.setFillStyle(0x88aaff, 0.15);
      } else {
        this.hoverRect.setStrokeStyle(2, 0xffffff);
        this.hoverRect.setFillStyle(0xffffff, 0.1);
      }
    }
  }

  // ── Single click select ──
  private handleSelect(tileX: number, tileY: number): void {
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;

    const settlerAtTile = this.simulation.entityManager.getAt(tileX, tileY, 'settler') as Settler | undefined;
    if (settlerAtTile) {
      // Double-select: if already selected, show context menu
      if (this.uiManager.selectedEntity === settlerAtTile ||
        ((this.scene as any).getSelectedSettler?.() === settlerAtTile &&
          !this.uiManager.selectedBuilding && !this.uiManager.selectedEntity)) {
        this.showEntityContextMenu(settlerAtTile, tileX, tileY);
        return;
      }
      this.recorder?.record(ReplayActionType.SelectSettler, { settlerId: settlerAtTile.id });
      (this.scene as any).selectSettler(settlerAtTile);
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = null;
      this.uiManager.addLog(`${languageManager.ui.selected}: ${settlerAtTile.name} (${settlerAtTile.settlerClass})`);
      this.showSelectionRing(tileX, tileY, 0x44ff44);
      return;
    }

    // Check multi-tile buildings first
    if (!this.uiManager.buildMode) {
      const allBuildings = this.simulation.entityManager.getByType('building') as Building[];
      for (const b of allBuildings) {
        const bldSize = b.size ?? 1;
        if (bldSize > 1 && tileX >= b.x && tileX < b.x + bldSize &&
            tileY >= b.y && tileY < b.y + bldSize) {
          if (this.uiManager.selectedBuilding === b) {
            this.showEntityContextMenu(b, b.x, b.y);
            return;
          }
          this.uiManager.selectedBuilding = b;
          this.uiManager.selectedEntity = null;
          this.uiManager.buildMode = null;
          this.uiManager.updateBuildButtonStates();
          const def = (buildingsData as any)[b.buildingType];
          this.uiManager.addLog(`${languageManager.ui.selected}: ${def?.name ?? b.buildingType}`);
          this.showSelectionRing(b.x, b.y, 0x88aaff);
          return;
        }
      }
    }

    const buildingAtTile = this.simulation.entityManager.getAt(tileX, tileY, 'building') as Building | undefined;
    if (buildingAtTile) {
      // Double-select: if already selected, show context menu
      if (this.uiManager.selectedBuilding === buildingAtTile) {
        this.showEntityContextMenu(buildingAtTile, tileX, tileY);
        return;
      }
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
      // Double-select: if already selected, show context menu
      if (this.uiManager.selectedEntity === entityAtTile) {
        this.showEntityContextMenu(entityAtTile, tileX, tileY);
        return;
      }
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = entityAtTile;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();

      if (entityAtTile.entityType === 'dinosaur') {
        const dino = entityAtTile as Dinosaur;
        if (dino.isTamed) {
          // Tamed dinosaur - always show context menu on first click
          this.selectedTreeTile = { x: tileX, y: tileY };
          this.showDinoContextMenu(tileX, tileY, dino);
          return;
        } else {
          this.uiManager.addLog(`${languageManager.ui.selected}: ${dino.species} (${dino.state})`);
          this.showSelectionRing(tileX, tileY, 0xff4444);
        }
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

    // Check for tree or harvestable plant at this tile
    const decGen = (this.scene as any).decorationGenerator;
    if (decGen) {
      const dec = decGen.getDecorationAt(tileX, tileY);
      if (dec && dec.isTree) {
        if (this.selectedTreeTile && this.selectedTreeTile.x === tileX && this.selectedTreeTile.y === tileY) {
          // Second click — show context menu
          this.showTreeContextMenu(tileX, tileY);
          return;
        }
        // First click — select tree
        this.selectedTreeTile = { x: tileX, y: tileY };
        this.showSelectionRing(tileX, tileY, 0x88cc44);
        this.uiManager.addLog('Дерево выделено');
        return;
      }
      // Check for mineable rock
      if (decGen.isRockAt(tileX, tileY)) {
        if (this.selectedTreeTile && this.selectedTreeTile.x === tileX && this.selectedTreeTile.y === tileY) {
          this.showRockContextMenu(tileX, tileY);
          return;
        }
        this.selectedTreeTile = { x: tileX, y: tileY };
        this.showSelectionRing(tileX, tileY, 0x888888);
        this.uiManager.addLog('Скала выделена');
        return;
      }
      // Check for harvestable plant
      const plantInfo = decGen.getPlantAt(tileX, tileY);
      if (plantInfo && plantInfo.plant.harvestable) {
        // Check if depleted
        if (decGen.isDepleted(tileX, tileY)) {
          this.uiManager.addLog(`${plantInfo.plant.name} — нужно время для восстановления`);
          return;
        }
        if (this.selectedTreeTile && this.selectedTreeTile.x === tileX && this.selectedTreeTile.y === tileY) {
          // Second click — show harvest context menu
          this.showPlantContextMenu(tileX, tileY, plantInfo);
          return;
        }
        // First click — select plant
        this.selectedTreeTile = { x: tileX, y: tileY };
        this.showSelectionRing(tileX, tileY, 0x44cc88);
        this.uiManager.addLog(`${plantInfo.plant.name} выделено`);
        return;
      }
    }

    this.selectedTreeTile = null;
    this.uiManager.deselectAll();
    this.uiManager.buildMode = null;
    this.uiManager.updateBuildButtonStates();
  }

  private showEntityContextMenu(entity: import('../core/Entity').Entity, tileX: number, tileY: number): void {
    const ctx: EntityMenuContext = {
      selectedSettler: (this.scene as any).getSelectedSettler?.() ?? null,
      onMoveHere: (x, y, queue) => this.onMoveHere?.(x, y, queue),
      onCollect: (entity, queue) => this.uiManager.onCollectCallback?.(entity, queue),
      onAttack: (entity, queue) => this.onAttackEntity?.(entity, queue),
      onDemolish: (entity) => this.uiManager.onDemolishCallback?.(entity),
      onContinue: (entity) => this.uiManager.onContinueCallback?.(entity),
      onRepair: (entity) => this.uiManager.onRepairCallback?.(entity),
      onSelectSettler: (settler) => (this.scene as any).selectSettler(settler),
    };
    const items = getContextMenuForEntity(entity, ctx);
    if (items.length > 0) {
      const { sx, sy } = this.tileToScreen(tileX, tileY);
      this.menuSystem.showContextMenu(items, sx + TILE_SIZE, sy);
    }
  }

  // ── Right-click command ──
  private handleCommand(tileX: number, tileY: number, queue: boolean = false): void {
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;

    const settler = (this.scene as any).getSelectedSettler() as Settler;
    if (!settler || !settler.isAlive) return;

    // Check for tamed dinosaur FIRST - show menu instead of attacking
    const dinoAtTile = this.simulation.entityManager.getAt(tileX, tileY, 'dinosaur');
    if (dinoAtTile) {
      const dino = dinoAtTile as Dinosaur;
      if (dino.isTamed) {
        this.showDinoContextMenu(tileX, tileY, dino);
        return;
      }
    }

    const entityAtTile = this.simulation.entityManager.getAllAt(tileX, tileY)
      .find(e => e.entityType === 'resource' || e.entityType === 'artifact');

    if (entityAtTile) {
      this.recorder?.record(ReplayActionType.Collect, { entityId: entityAtTile.id, settlerId: settler.id });
      this.uiManager.selectedEntity = entityAtTile;
      this.uiManager.onCollectCallback?.(entityAtTile, queue);
      this.showCommandMarker(tileX, tileY, 0xffaa00);
      return;
    }

    // Wild dinosaur - attack
    if (dinoAtTile) {
      this.uiManager.selectedEntity = dinoAtTile;
      const target = this.findAdjacentWalkable(settler.x, settler.y, tileX, tileY);
      if (target) {
        this.workSystem.createMoveTask(target.x, target.y, undefined, settler, queue);
        this.showCommandMarker(target.x, target.y, 0xff4444);
      } else {
        this.uiManager.addLog(`No path to target`);
      }
      return;
    }

    if (tile.walkable) {
      this.recorder?.record(ReplayActionType.MoveSettler, { x: tileX, y: tileY, settlerId: settler.id });
      this.workSystem.createMoveTask(tileX, tileY, undefined, settler, queue);
      this.showCommandMarker(tileX, tileY, 0x44ff44);
    }
  }

  private showTreeContextMenu(tileX: number, tileY: number): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const screenX = sx + TILE_SIZE;
    const screenY = sy;

    const settler = (this.scene as any).getSelectedSettler() as Settler;
    const isBiologist = settler?.settlerClass === 'biologist';

    const items: import('./menu/MenuItem').MenuItem[] = [
      {
        icon: '🪓',
        label: 'Срубить',
        action: () => {
          this.selectedTreeTile = null;
          this.workSystem.createChopTask(tileX, tileY, TaskPriority.High, settler);
          this.uiManager.addLog(`${settler ? settler.name : 'Поселенец'} направляется рубить дерево`);
        }
      },
    ];

    if (isBiologist) {
      items.push({
        icon: '🔬',
        label: 'Исследовать',
        action: () => {
          this.selectedTreeTile = null;
          this.uiManager.addLog(`${settler.name} изучает растительность...`);
          settler.artifactFogBonus += 0.5;
          // Notify quest system
          const qm = (this.scene as any).questManager;
          if (qm) qm.onPlantResearched();
        }
      });
    }

    this.menuSystem.showContextMenu(items, screenX, screenY);
  }

  private showPlantContextMenu(tileX: number, tileY: number, plantInfo: { id: string; plant: any }): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const screenX = sx + TILE_SIZE;
    const screenY = sy;

    const settler = (this.scene as any).getSelectedSettler() as Settler;
    const drop = plantInfo.plant.harvestDrop;
    const dropText = drop ? `${drop.resource} x${drop.amount}` : '';

    const decGen = (this.scene as any).decorationGenerator;
    const isDepleted = decGen?.isDepleted(tileX, tileY) ?? false;

    const items: import('./menu/MenuItem').MenuItem[] = [];

    if (isDepleted) {
      items.push({
        icon: '⏳',
        label: 'Восстанавливается...',
        disabled: true,
      });
    } else {
      items.push({
        icon: '🌿',
        label: `Собрать${dropText ? ` (${dropText})` : ''}`,
        action: () => {
          this.selectedTreeTile = null;
          this.workSystem.createHarvestPlantTask(tileX, tileY, TaskPriority.High, settler);
          this.uiManager.addLog(`${settler ? settler.name : 'Поселенец'} направляется собирать ${plantInfo.plant.name}`);
        }
      });
    }

    this.menuSystem.showContextMenu(items, screenX, screenY);
  }

  private showRockContextMenu(tileX: number, tileY: number): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const screenX = sx + TILE_SIZE;
    const screenY = sy;

    const settler = (this.scene as any).getSelectedSettler() as Settler;
    const decGen = (this.scene as any).decorationGenerator;
    const plantInfo = decGen?.getPlantAt(tileX, tileY);
    const drop = plantInfo?.plant.harvestDrop;
    const dropText = drop ? `${drop.resource} x${drop.amount}` : '';

    const hasAxe = settler?.inventory.some((i: any) => i.resourceType === 'stone_axe');

    const items: import('./menu/MenuItem').MenuItem[] = [];

    if (hasAxe) {
      items.push({
        icon: '⛏️',
        label: `Добыть${dropText ? ` (${dropText})` : ''}`,
        action: () => {
          this.selectedTreeTile = null;
          this.workSystem.createMineTask(tileX, tileY, TaskPriority.High, settler);
          this.uiManager.addLog(`${settler ? settler.name : 'Поселенец'} направляется добывать камень`);
        }
      });
    } else {
      items.push({
        icon: '🪓',
        label: 'Нужна каменная секира',
        disabled: true,
      });
    }

    this.menuSystem.showContextMenu(items, screenX, screenY);
  }

  private showDinoContextMenu(tileX: number, tileY: number, dino: Dinosaur): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const screenX = sx + TILE_SIZE;
    const screenY = sy;

    const settler = (this.scene as any).getSelectedSettler() as Settler;
    const items: import('./menu/MenuItem').MenuItem[] = [];

    // Feed options
    const feedOptions = [
      { type: 'herb', label: 'Плоды' },
      { type: 'fiber', label: 'Волокно' },
      { type: 'meat', label: 'Мясо' },
    ];

    for (const feed of feedOptions) {
      const amount = this.simulation.getResourceAmount(feed.type);
      if (amount > 0) {
        items.push({
          icon: '🍃',
          label: `Накормить (${feed.label}) [${amount}]`,
          action: () => {
            this.selectedTreeTile = null;
            this.simulation.removeFromInventory(feed.type, 1);
            const gain = dino.feed(feed.type);
            this.uiManager.addLog(`${dino.species} накормлен. Лояльность +${gain} (${Math.floor(dino.loyalty)}%)`);
          }
        });
      }
    }

    if (items.length === 0) {
      items.push({
        icon: '❌',
        label: 'Нет еды для кормления',
        disabled: true,
      });
    }

    // Show loyalty status
    items.push({
      icon: '❤️',
      label: `Лояльность: ${Math.floor(dino.loyalty)}%`,
      disabled: true,
    });

    // Attack command (if loyalty >= 80)
    if (dino.loyalty >= 80) {
      // Find nearest wild predator
      const dinos = this.simulation.entityManager.getByType('dinosaur') as Dinosaur[];
      const wildPredator = dinos.find(d =>
        !d.isTamed && d.isAlive &&
        Math.abs(d.x - dino.x) + Math.abs(d.y - dino.y) <= 8
      );
      if (wildPredator) {
        items.push({
          icon: '⚔️',
          label: `Атаковать ${wildPredator.species}`,
          action: () => {
            this.selectedTreeTile = null;
            dino.setAttackTarget(wildPredator);
            this.uiManager.addLog(`${dino.species} атакует ${wildPredator.species}!`);
          }
        });
      }
    }

    // Send to paddock option
    const buildings = this.simulation.entityManager.getByType('building') as Building[];
    const paddock = buildings.find(b => b.buildingType === 'paddock' && b.built);
    if (paddock) {
      items.push({
        icon: '🏠',
        label: 'Отправить в загон',
        action: () => {
          this.selectedTreeTile = null;
          // Find ANY free tile near paddock (wider search)
          const bldSize = paddock.size ?? 3;
          const dirs = [
            // Adjacent tiles
            { dx: 0, dy: -1 }, { dx: 0, dy: bldSize },
            { dx: -1, dy: 0 }, { dx: bldSize, dy: 0 },
            // Diagonal tiles
            { dx: -1, dy: -1 }, { dx: bldSize, dy: -1 },
            { dx: -1, dy: bldSize }, { dx: bldSize, dy: bldSize },
            // Further out
            { dx: 0, dy: -2 }, { dx: 0, dy: bldSize + 1 },
            { dx: -2, dy: 0 }, { dx: bldSize + 1, dy: 0 },
          ];
          let moved = false;
          for (const d of dirs) {
            const tx = paddock.x + d.dx;
            const ty = paddock.y + d.dy;
            if (this.simulation.tileGrid.isWalkable(tx, ty)) {
              this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, dino.footprint, false);
              dino.x = tx;
              dino.y = ty;
              this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, dino.footprint, true);
              this.uiManager.addLog(`${dino.species} отправлен в загон`);
              moved = true;
              break;
            }
          }
          if (!moved) {
            this.uiManager.addLog('Нет свободного места рядом с загоном');
          }
        }
      });
    }

    // Follow command - make dinosaur follow nearest settler
    items.push({
      icon: '👣',
      label: 'Следовать за мной',
      action: () => {
        this.selectedTreeTile = null;
        // Move dinosaur close to settler
        if (settler) {
          const tx = settler.x + 1;
          const ty = settler.y;
          if (this.simulation.tileGrid.isWalkable(tx, ty)) {
            this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, dino.footprint, false);
            dino.x = tx;
            dino.y = ty;
            this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, dino.footprint, true);
            this.uiManager.addLog(`${dino.species} следует за ${settler.name}`);
          }
        }
      }
    });

    // Show loyalty status
    items.push({
      icon: '❤️',
      label: `Лояльность: ${Math.floor(dino.loyalty)}% | Голод: ${Math.floor(dino.hunger)}%`,
      disabled: true,
    });

    this.menuSystem.showContextMenu(items, screenX, screenY);
  }

  private showIncubatorContextMenu(building: Building, tileX: number, tileY: number): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const screenX = sx + TILE_SIZE;
    const screenY = sy;

    const incubatorSystem = (this.scene as any).incubatorSystem;
    if (!incubatorSystem) return;

    const items: import('./menu/MenuItem').MenuItem[] = [];

    // Check if already incubating
    if (incubatorSystem.isIncubating(building.id)) {
      const progress = incubatorSystem.getProgressPercent(building.id);
      items.push({
        icon: '🥚',
        label: `Инкубация... ${Math.floor(progress * 100)}%`,
        disabled: true,
      });
    } else {
      // Show available eggs
      const eggTypes = ['raptor_egg', 'bronto_egg', 'trex_egg'];
      const eggNames: Record<string, string> = {
        'raptor_egg': 'Яйцо раптора',
        'bronto_egg': 'Яйцо бронтозавра',
        'trex_egg': 'Яйцо ти-рекса',
      };

      for (const eggType of eggTypes) {
        const amount = this.simulation.getResourceAmount(eggType);
        if (amount > 0) {
          items.push({
            icon: '🥚',
            label: `${eggNames[eggType]} [${amount}]`,
            action: () => {
              const success = incubatorSystem.startIncubation(building.id, eggType);
              if (success) {
                this.uiManager.addLog(`Инкубация начата: ${eggNames[eggType]}`);
              }
            }
          });
        }
      }

      if (items.length === 0) {
        items.push({
          icon: '❌',
          label: 'Нет яиц для инкубации',
          disabled: true,
        });
      }
    }

    this.menuSystem.showContextMenu(items, screenX, screenY);
  }

  private showPaddockContextMenu(building: Building, tileX: number, tileY: number): void {
    const { sx, sy } = this.tileToScreen(tileX, tileY);
    const screenX = sx + TILE_SIZE;
    const screenY = sy;

    const items: import('./menu/MenuItem').MenuItem[] = [];

    // Find dinosaurs near paddock (within 4 tiles)
    const dinos = this.simulation.entityManager.getByType('dinosaur') as Dinosaur[];
    const nearbyDinos = dinos.filter(d =>
      d.isTamed && d.isAlive &&
      Math.abs(d.x - building.x) + Math.abs(d.y - building.y) <= 4
    );

    if (nearbyDinos.length === 0) {
      items.push({
        icon: '🦕',
        label: 'Загон пуст',
        disabled: true,
      });
    } else {
      for (const dino of nearbyDinos) {
        items.push({
          icon: '🦕',
          label: `${dino.species} (❤️${Math.floor(dino.loyalty)}%)`,
          action: () => {
            // Release dinosaur from paddock - it will follow settler
            this.uiManager.addLog(`${dino.species} выпущен из загона`);
          }
        });
      }
    }

    // Capacity info
    items.push({
      icon: '📊',
      label: `Вместимость: ${nearbyDinos.length}/3`,
      disabled: true,
    });

    this.menuSystem.showContextMenu(items, screenX, screenY);
  }

  // ── Selection ring ──
  private showSelectionRing(tileX: number, tileY: number, color: number): void {
    // Check if this tile belongs to a multi-tile building
    const building = this.simulation.entityManager.getAt(tileX, tileY, 'building') as Building | undefined;
    const bldSize = building?.size ?? 1;

    this.selectionIndicator.clear();
    this.selectionIndicator.setVisible(true);

    if (bldSize > 1) {
      // Draw rectangle around full footprint
      const { sx, sy } = this.tileToScreen(tileX, tileY);
      const pad = 3;
      this.selectionIndicator.lineStyle(2, color, 0.8);
      this.selectionIndicator.strokeRect(sx - pad, sy - pad, TILE_SIZE * bldSize + pad * 2, TILE_SIZE * bldSize + pad * 2);
      this.selectionIndicator.lineStyle(1, color, 0.4);
      this.selectionIndicator.strokeRect(sx - pad - 3, sy - pad - 3, TILE_SIZE * bldSize + (pad + 3) * 2, TILE_SIZE * bldSize + (pad + 3) * 2);
    } else {
      // Circle for single-tile entities
      const { sx, sy } = this.tileToScreen(tileX, tileY);
      const cx = sx + TILE_SIZE / 2;
      const cy = sy + TILE_SIZE / 2;
      const r = TILE_SIZE / 2 + 4;
      this.selectionIndicator.lineStyle(2, color, 0.8);
      this.selectionIndicator.strokeCircle(cx, cy, r);
      this.selectionIndicator.lineStyle(1, color, 0.4);
      this.selectionIndicator.strokeCircle(cx, cy, r + 3);
    }

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
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    this.handleBuildClick(tileX, tileY, tile);
  }

  private handleBuildClick(tileX: number, tileY: number, tile: any): void {
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;
    if (!tile.walkable) { this.uiManager.addLog(languageManager.ui.logCannotBuildHere); return; }

    const decGen = (this.scene as any).decorationGenerator;
    if (decGen?.getTreeAt(tileX, tileY)) {
      this.uiManager.addLog(languageManager.ui.logChopTreeFirst);
      return;
    }

    const def = (buildingsData as any)[this.uiManager.buildMode!];
    const bldSize = def.size ?? 1;

    // Check full footprint for multi-tile buildings
    for (let dy = 0; dy < bldSize; dy++) {
      for (let dx = 0; dx < bldSize; dx++) {
        const fx = tileX + dx;
        const fy = tileY + dy;
        const ft = this.simulation.tileGrid.get(fx, fy);
        if (!ft || !ft.walkable) {
          this.uiManager.addLog(languageManager.ui.logCannotBuildHere);
          return;
        }
        if (ft.occupied || ft.building) {
          this.uiManager.addLog(languageManager.ui.logTileOccupied);
          return;
        }
        if (decGen?.getTreeAt(fx, fy)) {
          this.uiManager.addLog(languageManager.ui.logChopTreeFirst);
          return;
        }
        const entityAt = this.simulation.entityManager.getAt(fx, fy);
        if (entityAt && entityAt.entityType === 'settler') {
          const s = entityAt as Settler;
          (this.scene as any).selectSettler(s);
          this.uiManager.addLog(`${languageManager.ui.selected}: ${s.name} (${s.settlerClass})`);
          return;
        }
        if (entityAt) {
          this.uiManager.addLog(languageManager.ui.logTileOccupied);
          return;
        }
      }
    }

    const hasAll = Object.entries(def.requires).every(([res, qty]) => this.simulation.hasResource(res, qty as number));
    if (!hasAll) {
      const need = Object.entries(def.requires).map(([r, q]) => `${r}:${q}`).join(', ');
      this.uiManager.addLog(`${languageManager.ui.logNeed}: ${need}`);
      return;
    }

    const building = new Building(tileX, tileY, this.uiManager.buildMode!, def.maxHp, def.buildTime,
      Object.entries(def.requires).map(([r, q]) => ({ resourceType: r, quantity: q as number })));
    building.size = bldSize;
    building.storageCapacity = def.storageCapacity ? def.storageCapacity + this.artifactSystem.getStorageBonus() : 0;
    building.produceType = def.produceType ?? '';
    building.produceRate = def.produceRate ?? 0;
    building.produceInterval = def.produceInterval ?? 0;
    building.attackDamage = def.attackDamage ?? 0;
    building.attackRange = def.attackRange ?? 0;
    building.attackInterval = def.attackInterval ?? 0;
    this.simulation.entityManager.add(building);

    // Mark all tiles in footprint
    for (let dy = 0; dy < bldSize; dy++) {
      for (let dx = 0; dx < bldSize; dx++) {
        this.simulation.tileGrid.setBuilding(tileX + dx, tileY + dy, true);
        if (def.isGate) {
          this.simulation.tileGrid.setGate(tileX + dx, tileY + dy, true);
          this.simulation.tileGrid.setDinoBlocked(tileX + dx, tileY + dy, true);
        } else {
          this.simulation.tileGrid.setOccupied(tileX + dx, tileY + dy, true);
        }
      }
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

  private findAdjacentWalkable(sx: number, sy: number, tx: number, ty: number): { x: number; y: number } | null {
    const dirs = [
      { x: tx - 1, y: ty }, { x: tx + 1, y: ty },
      { x: tx, y: ty - 1 }, { x: tx, y: ty + 1 },
    ];
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const d of dirs) {
      const tile = this.simulation.tileGrid.get(d.x, d.y);
      if (!tile || !tile.walkable) continue;
      if (this.simulation.tileGrid.get(d.x, d.y)?.occupied) continue;
      const dist = Math.abs(d.x - sx) + Math.abs(d.y - sy);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }
}
