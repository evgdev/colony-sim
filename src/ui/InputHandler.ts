import Phaser from 'phaser';
import {
  TILE_SIZE, FIELD_X, FIELD_Y, FIELD_W, FIELD_H, MAP_WIDTH, MAP_HEIGHT,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Artifact } from '../entities/Artifact';
import { WorkSystem } from '../systems/WorkSystem';
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { TaskPriority } from '../core/Task';
import { UIManager } from './UIManager';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';

type BuildingType = keyof typeof buildingsData;

const MINIMAP_X = 14;
const MINIMAP_Y = 584;
const MINIMAP_TILE_SIZE = 7;
const MINIMAP_SIZE = 210;

export class InputHandler {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  private uiManager: UIManager;
  private workSystem: WorkSystem;
  private artifactSystem: ArtifactSystem;
  recorder: ReplayRecorder | null = null;
  hoverRect!: Phaser.GameObjects.Rectangle;
  private scrollX: number = 0;
  private scrollY: number = 0;
  private isPainting: boolean = false;
  private lastPaintX: number = -1;
  private lastPaintY: number = -1;
  scrollTo: ((tileX: number, tileY: number) => void) | null = null;

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

  setSimulation(simulation: Simulation): void {
    this.simulation = simulation;
  }

  setWorkSystem(workSystem: WorkSystem): void {
    this.workSystem = workSystem;
  }

  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;
  }

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

  setupInputHandlers(): void {
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.uiManager.startMenuOpen) {
        this.hoverRect.setVisible(false);
        return;
      }
      const coords = this.screenToTile(pointer.x, pointer.y);
      if (coords) {
        const { sx, sy } = this.tileToScreen(coords.tileX, coords.tileY);
        this.hoverRect.setPosition(sx, sy);
        this.hoverRect.setVisible(true);
        if (this.isPainting && this.uiManager.buildMode && !pointer.rightButtonDown()) {
          this.paintAt(coords.tileX, coords.tileY);
        }
      } else {
        this.hoverRect.setVisible(false);
      }
    });

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.uiManager.startMenuOpen) return;

      if (pointer.rightButtonDown()) {
        this.cancelBuildMode();
        return;
      }

      const minimapCoords = this.screenToMinimapTile(pointer.x, pointer.y);
      if (minimapCoords) {
        this.handleMinimapClick(minimapCoords.tileX, minimapCoords.tileY);
        return;
      }

      const coords = this.screenToTile(pointer.x, pointer.y);
      if (!coords) return;
      const shiftHeld = (pointer.event as MouseEvent).shiftKey;
      if (this.uiManager.buildMode) {
        this.isPainting = true;
        this.paintAt(coords.tileX, coords.tileY);
      } else {
        this.handleTileClick(coords.tileX, coords.tileY, shiftHeld);
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      this.isPainting = false;
      this.lastPaintX = -1;
      this.lastPaintY = -1;
    });

    this.scene.input.keyboard?.on('keydown-ESC', () => this.cancelBuildMode());
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

  handleTileClick(tileX: number, tileY: number, queue: boolean = false): void {
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;

    if (this.uiManager.buildMode) {
      this.handleBuildClick(tileX, tileY, tile);
      return;
    }

    const buildingAtTile = this.simulation.entityManager.getAll().find(
      e => e.entityType === 'building' && e.x === tileX && e.y === tileY
    ) as Building | undefined;

    if (buildingAtTile) {
      this.uiManager.selectedBuilding = buildingAtTile;
      this.uiManager.selectedEntity = null;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
      const def = (buildingsData as any)[buildingAtTile.buildingType];
      this.uiManager.addLog(`${languageManager.ui.selected}: ${def?.name ?? buildingAtTile.buildingType}`);
      return;
    }

    const settlerAtTile = this.simulation.entityManager.getAll().find(
      e => e.entityType === 'settler' && e.x === tileX && e.y === tileY
    ) as Settler | undefined;

    if (settlerAtTile) {
      this.recorder?.record(ReplayActionType.SelectSettler, { settlerId: settlerAtTile.id });
      (this.scene as any).selectSettler(settlerAtTile);
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = null;
      this.uiManager.addLog(`${languageManager.ui.selected}: ${settlerAtTile.name} (${settlerAtTile.settlerClass})`);
      return;
    }

    const entityAtTile = this.simulation.entityManager.getAll().find(
      e => (e.entityType === 'resource' || e.entityType === 'dinosaur' || e.entityType === 'artifact') && e.x === tileX && e.y === tileY
    );

    if (entityAtTile) {
      if (entityAtTile.entityType === 'resource' || entityAtTile.entityType === 'artifact') {
        const settler = (this.scene as any).getSelectedSettler() as Settler;
        this.recorder?.record(ReplayActionType.Collect, { entityId: entityAtTile.id, settlerId: settler?.id ?? 0 });
        this.uiManager.selectedBuilding = null;
        this.uiManager.selectedEntity = entityAtTile;
        this.uiManager.buildMode = null;
        this.uiManager.updateBuildButtonStates();
        this.uiManager.onCollectCallback?.(entityAtTile, queue);
        return;
      }
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = entityAtTile;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
      if (entityAtTile.entityType === 'dinosaur') {
        const dino = entityAtTile as import('../entities/Dinosaur').Dinosaur;
        this.uiManager.addLog(`${languageManager.ui.selected}: ${dino.species} (${dino.state})`);
      }
      return;
    }

    this.uiManager.deselectAll();
    this.uiManager.buildMode = null;
    this.uiManager.updateBuildButtonStates();

    if (tile.walkable) {
      const settler = (this.scene as any).getSelectedSettler() as Settler;
      if (settler) {
        this.recorder?.record(ReplayActionType.MoveSettler, { x: tileX, y: tileY, settlerId: settler.id });
        this.workSystem.createMoveTask(tileX, tileY, undefined, settler, queue);
      }
    }
  }

  private handleBuildClick(tileX: number, tileY: number, tile: any): void {
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;
    if (!tile.walkable) {
      this.uiManager.addLog(languageManager.ui.logCannotBuildHere);
      return;
    }

    const entityAt = this.simulation.entityManager.getAll().find(
      e => e.x === tileX && e.y === tileY
    );
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

    const def = (buildingsData as any)[this.uiManager.buildMode!];
    const hasAll = Object.entries(def.requires).every(([res, qty]) =>
      this.simulation.hasResource(res, qty as number)
    );
    if (!hasAll) {
      const need = Object.entries(def.requires).map(([r, q]) => `${r}:${q}`).join(', ');
      this.uiManager.addLog(`${languageManager.ui.logNeed}: ${need}`);
      return;
    }

    const building = new Building(tileX, tileY, this.uiManager.buildMode!, def.maxHp, def.buildTime,
      Object.entries(def.requires).map(([r, q]) => ({ resourceType: r, quantity: q as number }))
    );
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

    if (buildingType !== 'wall') {
      this.uiManager.buildMode = null;
    }
    this.uiManager.updateBuildButtonStates();
  }

  hideHover(): void {
    this.hoverRect.setVisible(false);
  }

  private handleMinimapClick(tileX: number, tileY: number): void {
    this.recorder?.record(ReplayActionType.MinimapClick, { x: tileX, y: tileY });
    if (this.scrollTo) {
      this.scrollTo(tileX, tileY);
    }
    this.uiManager.addLog(`${languageManager.ui.logAt} (${tileX},${tileY})`);
  }
}
