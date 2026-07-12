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
import { TaskPriority } from '../core/Task';
import { UIManager } from './UIManager';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';

type BuildingType = keyof typeof buildingsData;

export class InputHandler {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  private uiManager: UIManager;
  private workSystem: WorkSystem;
  hoverRect!: Phaser.GameObjects.Rectangle;
  private scrollX: number = 0;
  private scrollY: number = 0;

  constructor(
    scene: Phaser.Scene,
    simulation: Simulation,
    uiManager: UIManager,
    workSystem: WorkSystem
  ) {
    this.scene = scene;
    this.simulation = simulation;
    this.uiManager = uiManager;
    this.workSystem = workSystem;
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
    const tileY = Math.floor((py - FIELD_Y) / TILE_SIZE) + 1 + this.scrollY;
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return null;
    return { tileX, tileY };
  }

  private tileToScreen(tileX: number, tileY: number): { sx: number; sy: number } {
    return {
      sx: FIELD_X + (tileX - this.scrollX) * TILE_SIZE,
      sy: FIELD_Y + (tileY - 1 - this.scrollY) * TILE_SIZE,
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
      const coords = this.screenToTile(pointer.x, pointer.y);
      if (coords) {
        const { sx, sy } = this.tileToScreen(coords.tileX, coords.tileY);
        this.hoverRect.setPosition(sx, sy);
        this.hoverRect.setVisible(true);
      } else {
        this.hoverRect.setVisible(false);
      }
    });

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const coords = this.screenToTile(pointer.x, pointer.y);
      if (!coords) return;
      this.handleTileClick(coords.tileX, coords.tileY);
    });
  }

  handleTileClick(tileX: number, tileY: number): void {
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;
    if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) return;

    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler | undefined;
    if (!settler) return;

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

    const entityAtTile = this.simulation.entityManager.getAll().find(
      e => (e.entityType === 'resource' || e.entityType === 'dinosaur' || e.entityType === 'artifact') && e.x === tileX && e.y === tileY
    );

    if (entityAtTile) {
      this.uiManager.selectedBuilding = null;
      this.uiManager.selectedEntity = entityAtTile;
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
      if (entityAtTile.entityType === 'resource') {
        const res = entityAtTile as Resource;
        this.uiManager.addLog(`${languageManager.ui.selected}: ${res.resourceType} (${res.quantity})`);
      } else if (entityAtTile.entityType === 'dinosaur') {
        const dino = entityAtTile as import('../entities/Dinosaur').Dinosaur;
        this.uiManager.addLog(`${languageManager.ui.selected}: ${dino.species} (${dino.state})`);
      } else if (entityAtTile.entityType === 'artifact') {
        const artifact = entityAtTile as Artifact;
        this.uiManager.addLog(`${languageManager.ui.selected}: ${artifact.name}`);
      }
      return;
    }

    this.uiManager.deselectAll();
    this.uiManager.buildMode = null;
    this.uiManager.updateBuildButtonStates();

    if (tile.walkable) {
      this.workSystem.createMoveTask(tileX, tileY);
      this.uiManager.addLog(`${settler.name} ${languageManager.ui.logWorkerHeadsTo} (${tileX},${tileY})`);
    }
  }

  private handleBuildClick(tileX: number, tileY: number, tile: any): void {
    if (!tile.walkable) {
      this.uiManager.addLog(languageManager.ui.logCannotBuildHere);
      return;
    }

    const existing = this.simulation.entityManager.getAll().find(
      e => e.x === tileX && e.y === tileY
    );
    if (existing) {
      this.uiManager.addLog(languageManager.ui.logTileOccupied);
      return;
    }

    const def = (buildingsData as any)[this.uiManager.buildMode!];
    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;
    const hasAll = Object.entries(def.requires).every(([res, qty]) =>
      settler.hasResource(res, qty as number)
    );
    if (!hasAll) {
      const need = Object.entries(def.requires).map(([r, q]) => `${r}:${q}`).join(', ');
      this.uiManager.addLog(`${languageManager.ui.logNeed}: ${need}`);
      return;
    }

    const building = new Building(tileX, tileY, this.uiManager.buildMode!, def.maxHp, def.buildTime,
      Object.entries(def.requires).map(([r, q]) => ({ resourceType: r, quantity: q as number }))
    );
    building.storageCapacity = def.storageCapacity ?? 0;
    building.produceType = def.produceType ?? '';
    building.produceRate = def.produceRate ?? 0;
    building.produceInterval = def.produceInterval ?? 0;
    this.simulation.entityManager.add(building);
    this.simulation.tileGrid.setOccupied(tileX, tileY, true);

    this.workSystem.createBuildTask(building, TaskPriority.High);
    this.uiManager.addLog(`${languageManager.ui.logBuildingAt} ${def.name} ${tileX},${tileY}`);
    this.uiManager.checkMilestone('firstBuilding');

    this.uiManager.buildMode = null;
    this.uiManager.updateBuildButtonStates();
  }

  hideHover(): void {
    this.hoverRect.setVisible(false);
  }
}
