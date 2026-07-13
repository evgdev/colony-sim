import { Simulation } from '../core/Simulation';
import { TileGrid } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';
import { ReplayAction, ReplayFile, ReplayActionType } from './ReplayTypes';
import { Entity } from '../core/Entity';
import { Task } from '../core/Task';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { WorkSystem } from '../systems/WorkSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { DinosaurSystem } from '../systems/DinosaurSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { TaskPriority } from '../core/Task';
import buildingsData from '../data/buildings.json';

export class ReplayPlayer {
  private replay: ReplayFile;
  private simulation: Simulation;
  private actionIndex: number = 0;
  private paused: boolean = false;
  private playbackSpeed: number = 1;
  private onAction?: (action: ReplayAction) => void;
  private onTick?: (tickCount: number) => void;
  private selectedSettlerId: number | null = null;

  movementSystem!: MovementSystem;
  workSystem!: WorkSystem;
  needsSystem!: NeedsSystem;
  buildingSystem!: BuildingSystem;
  dinosaurSystem!: DinosaurSystem;
  combatSystem!: CombatSystem;
  artifactSystem!: ArtifactSystem;

  constructor(replay: ReplayFile) {
    this.replay = replay;
    this.simulation = new Simulation(30, 30, replay.seed);

    Entity.resetIdCounter(1);
    Task.resetIdCounter(1);

    this.movementSystem = new MovementSystem(this.simulation.tileGrid);
    this.needsSystem = new NeedsSystem();
    this.artifactSystem = new ArtifactSystem(this.simulation.entityManager);
    this.workSystem = new WorkSystem(
      this.movementSystem,
      this.simulation.tileGrid,
      this.simulation.entityManager,
      this.simulation.taskQueue,
      this.simulation
    );
    this.workSystem.artifactSystem = this.artifactSystem;
    this.buildingSystem = new BuildingSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
    this.dinosaurSystem = new DinosaurSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid,
      this.simulation.seed
    );
    this.combatSystem = new CombatSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );

    this.setupInitialEntities();
  }

  private setupInitialEntities(): void {
    const centerX = Math.floor(this.simulation.tileGrid.width / 2);
    const centerY = Math.floor(this.simulation.tileGrid.height / 2);

    const settlers = [
      new Settler(centerX - 1, centerY, 'Engineer', 0x4488ff, 'engineer'),
      new Settler(centerX, centerY, 'Biologist', 0x44ff44, 'biologist'),
      new Settler(centerX + 1, centerY, 'Pilot', 0xffaa00, 'pilot'),
    ];
    for (const s of settlers) {
      this.simulation.entityManager.add(s);
      this.simulation.tileGrid.setOccupied(s.x, s.y, true);
    }
    this.simulation.tileGrid.reveal(centerX, centerY, 3);
    this.selectedSettlerId = settlers[0].id;

    const resources = [
      { x: centerX - 2, y: centerY - 1, type: 'wood', qty: 20 },
      { x: centerX + 2, y: centerY - 1, type: 'stone', qty: 15 },
      { x: centerX - 1, y: centerY + 2, type: 'wood', qty: 10 },
      { x: centerX + 1, y: centerY + 2, type: 'stone', qty: 8 },
      { x: centerX, y: centerY - 3, type: 'wood', qty: 12 },
      { x: centerX, y: centerY + 3, type: 'stone', qty: 10 },
    ];
    for (const r of resources) {
      const tile = this.simulation.tileGrid.get(r.x, r.y);
      if (!tile || !tile.walkable || tile.type === 'water') continue;
      const res = new Resource(r.x, r.y, r.type, r.qty);
      this.simulation.entityManager.add(res);
      this.simulation.tileGrid.setOccupied(r.x, r.y, true);
    }
  }

  initialize(_settlerNames: string[]): void {}

  getSimulation(): Simulation {
    return this.simulation;
  }

  getSelectedSettler(): Settler | null {
    if (this.selectedSettlerId === null) return null;
    const e = this.simulation.entityManager.get(this.selectedSettlerId);
    return e && e.entityType === 'settler' ? e as Settler : null;
  }

  setOnAction(callback: (action: ReplayAction) => void): void {
    this.onAction = callback;
  }

  setOnTick(callback: (tickCount: number) => void): void {
    this.onTick = callback;
  }

  isPaused(): boolean {
    return this.paused;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  cycleSpeed(): void {
    if (this.playbackSpeed === 1) this.playbackSpeed = 2;
    else if (this.playbackSpeed === 2) this.playbackSpeed = 4;
    else this.playbackSpeed = 1;
  }

  getProgress(): { current: number; total: number } {
    return {
      current: this.simulation.tickCount,
      total: this.replay.totalTicks,
    };
  }

  seekToTick(targetTick: number): void {
    const newSim = new Simulation(30, 30, this.replay.seed);
    this.simulation = newSim;

    Entity.resetIdCounter(1);
    Task.resetIdCounter(1);

    this.movementSystem = new MovementSystem(this.simulation.tileGrid);
    this.workSystem = new WorkSystem(
      this.movementSystem,
      this.simulation.tileGrid,
      this.simulation.entityManager,
      this.simulation.taskQueue,
      this.simulation
    );
    this.workSystem.artifactSystem = this.artifactSystem;
    this.buildingSystem = new BuildingSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
    this.dinosaurSystem = new DinosaurSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid,
      this.simulation.seed
    );
    this.combatSystem = new CombatSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );

    this.setupInitialEntities();
    this.actionIndex = 0;

    while (this.simulation.tickCount < targetTick) {
      this.simulation.update(500);
      this.processActionsAtTick(this.simulation.tickCount);
      const td = this.simulation.tickRate / 1000;
      this.needsSystem.update(
        this.simulation.entityManager.getByType('settler') as Settler[],
        td,
        this.simulation.tickCount
      );
      this.workSystem.update(td);
      this.buildingSystem.update(td);
      this.dinosaurSystem.update(td, this.simulation.tickCount);
      this.combatSystem.update(td);
    }
  }

  update(deltaTime: number): boolean {
    if (this.paused) return false;
    if (this.simulation.tickCount >= this.replay.totalTicks) return false;

    const adjustedDelta = deltaTime * this.playbackSpeed;
    const ticked = this.simulation.update(adjustedDelta);

    if (ticked) {
      this.processActionsAtTick(this.simulation.tickCount);
      const td = (this.simulation.tickRate / 1000) * this.playbackSpeed;
      this.needsSystem.update(
        this.simulation.entityManager.getByType('settler') as Settler[],
        td,
        this.simulation.tickCount
      );
      this.workSystem.update(td);
      this.buildingSystem.update(td);
      this.dinosaurSystem.update(td, this.simulation.tickCount);
      this.combatSystem.update(td);
      this.onTick?.(this.simulation.tickCount);
    }

    return ticked;
  }

  private processActionsAtTick(tick: number): void {
    while (this.actionIndex < this.replay.actions.length &&
           this.replay.actions[this.actionIndex].tick <= tick) {
      const action = this.replay.actions[this.actionIndex];
      this.executeAction(action);
      this.onAction?.(action);
      this.actionIndex++;
    }
  }

  private executeAction(action: ReplayAction): void {
    switch (action.type) {
      case ReplayActionType.SelectSettler: {
        const settlerId = action.data.settlerId as number;
        const settler = this.simulation.entityManager.get(settlerId);
        if (settler && settler.entityType === 'settler') {
          this.selectedSettlerId = settlerId;
        }
        break;
      }
      case ReplayActionType.MoveSettler: {
        const x = action.data.x as number;
        const y = action.data.y as number;
        const selected = this.getSelectedSettler();
        if (selected && selected.isAlive) {
          const tile = this.simulation.tileGrid.get(x, y);
          if (tile && tile.walkable) {
            this.workSystem.createMoveTask(x, y, undefined, selected);
          }
        }
        break;
      }
      case ReplayActionType.Build: {
        const x = action.data.x as number;
        const y = action.data.y as number;
        const buildingType = action.data.buildingType as string;
        const selected = this.getSelectedSettler();
        if (selected && selected.isAlive) {
          const tile = this.simulation.tileGrid.get(x, y);
          if (tile && tile.walkable) {
            const def = (buildingsData as any)[buildingType];
            if (def) {
              const building = new Building(x, y, buildingType, def.maxHp, def.buildTime,
                Object.entries(def.requires).map(([r, q]) => ({ resourceType: r, quantity: q as number }))
              );
              building.storageCapacity = def.storageCapacity ?? 0;
              building.produceType = def.produceType ?? '';
              building.produceRate = def.produceRate ?? 0;
              building.produceInterval = def.produceInterval ?? 0;
              building.attackDamage = def.attackDamage ?? 0;
              building.attackRange = def.attackRange ?? 0;
              building.attackInterval = def.attackInterval ?? 0;
              this.simulation.entityManager.add(building);
              this.simulation.tileGrid.setBuilding(x, y, true);
              if (def.isGate) {
                this.simulation.tileGrid.setGate(x, y, true);
                this.simulation.tileGrid.setDinoBlocked(x, y, true);
              } else {
                this.simulation.tileGrid.setOccupied(x, y, true);
              }
              this.workSystem.createBuildTask(building, TaskPriority.High, selected);
            }
          }
        }
        break;
      }
      case ReplayActionType.Collect: {
        const entityId = action.data.entityId as number;
        const entity = this.simulation.entityManager.get(entityId);
        if (entity && (entity.entityType === 'resource' || entity.entityType === 'artifact')) {
          const selected = this.getSelectedSettler();
          if (selected && selected.isAlive) {
            if (entity.entityType === 'resource') {
              this.workSystem.createPickUpTask(entity as Resource, TaskPriority.High, selected);
            }
          }
        }
        break;
      }
      case ReplayActionType.CancelBuild: {
        break;
      }
      case ReplayActionType.MinimapClick: {
        break;
      }
    }
  }
}
