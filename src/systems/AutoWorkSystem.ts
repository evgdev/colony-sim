import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { TaskQueue } from '../core/TaskQueue';
import { Simulation } from '../core/Simulation';
import { WorkSystem } from './WorkSystem';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Artifact } from '../entities/Artifact';
import { TaskType, TaskPriority, AutoTaskIcon } from '../core/Task';
import { DecorationGenerator } from '../rendering/DecorationGenerator';

interface CandidateTask {
  type: TaskType;
  priority: TaskPriority;
  targetX: number;
  targetY: number;
  icon: AutoTaskIcon;
  distance: number;
  resource?: Resource;
  building?: Building;
  artifact?: Artifact;
}

export class AutoWorkSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;
  private workSystem: WorkSystem;
  private taskQueue: TaskQueue;
  private simulation: Simulation;
  private decorationGenerator: DecorationGenerator | null = null;
  private woodThreshold: number = 20;
  private maxSearchRadius: number = 15;

  constructor(
    entityManager: EntityManager,
    tileGrid: TileGrid,
    workSystem: WorkSystem,
    taskQueue: TaskQueue,
    simulation: Simulation,
  ) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
    this.workSystem = workSystem;
    this.taskQueue = taskQueue;
    this.simulation = simulation;
  }

  setDecorationGenerator(dg: DecorationGenerator): void {
    this.decorationGenerator = dg;
  }

  private assignedTargets = new Set<string>();

  update(tickDelta: number): void {
    const settlers = this.entityManager.getByType('settler') as Settler[];
    this.assignedTargets.clear();

    for (const settler of settlers) {
      if (!settler.isAlive) continue;
      if (settler.energy <= 0) continue;
      if (settler.workMode === 'idle') continue;
      if (settler.currentTaskId !== null) continue;

      const candidate = this.findBestTask(settler);
      if (!candidate) continue;

      this.assignedTargets.add(`${candidate.targetX},${candidate.targetY}`);
      this.createAutoTask(settler, candidate);
    }
  }

  private findBestTask(settler: Settler): CandidateTask | null {
    const candidates: CandidateTask[] = [];
    const mode = settler.workMode;

    if (mode === 'auto' || mode === 'build') {
      this.addRepairCandidates(settler, candidates);
      this.addBuildCandidates(settler, candidates);
    }

    if (mode === 'auto' || mode === 'gather') {
      this.addGatherCandidates(settler, candidates);
      this.addChopCandidates(settler, candidates);
      this.addArtifactCandidates(settler, candidates);
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.distance - b.distance;
    });

    return candidates[0];
  }

  private addRepairCandidates(settler: Settler, out: CandidateTask[]): void {
    const buildings = this.entityManager.getByType('building') as Building[];
    for (const b of buildings) {
      if (!b.built) continue;
      if (!this.tileGrid.isRevealed(b.x, b.y)) continue;
      if (b.hp >= b.maxHp) continue;
      if (b.hp > b.maxHp * 0.5) continue;
      if (this.assignedTargets.has(`${b.x},${b.y}`)) continue;
      const dist = Math.abs(settler.x - b.x) + Math.abs(settler.y - b.y);
      if (dist > this.maxSearchRadius) continue;
      out.push({
        type: TaskType.Repair,
        priority: TaskPriority.Urgent,
        targetX: b.x,
        targetY: b.y,
        icon: 'repair',
        distance: dist,
        building: b,
      });
    }
  }

  private addBuildCandidates(settler: Settler, out: CandidateTask[]): void {
    const buildings = this.entityManager.getByType('building') as Building[];
    const existingTasks = this.taskQueue.getAll();
    for (const b of buildings) {
      if (b.built) continue;
      if (!this.tileGrid.isRevealed(b.x, b.y)) continue;
      const dist = Math.abs(settler.x - b.x) + Math.abs(settler.y - b.y);
      if (dist > this.maxSearchRadius) continue;
      if (this.assignedTargets.has(`${b.x},${b.y}`)) continue;
      const alreadyAssigned = existingTasks.some(
        t => t.type === TaskType.Build && t.buildingId === `${b.id}` && !t.completed
      );
      if (alreadyAssigned) continue;
      if (!b.requiresConsumed) {
        const hasAll = b.requires.every(r => this.simulation.hasResource(r.resourceType, r.quantity));
        if (!hasAll) continue;
      }
      out.push({
        type: TaskType.Build,
        priority: TaskPriority.Normal,
        targetX: b.x,
        targetY: b.y,
        icon: 'build',
        distance: dist,
        building: b,
      });
    }
  }

  private addGatherCandidates(settler: Settler, out: CandidateTask[]): void {
    const resources = this.entityManager.getByType('resource') as Resource[];
    for (const r of resources) {
      if (r.depleted) continue;
      if (!this.tileGrid.isRevealed(r.x, r.y)) continue;
      if (this.assignedTargets.has(`${r.x},${r.y}`)) continue;
      const dist = Math.abs(settler.x - r.x) + Math.abs(settler.y - r.y);
      if (dist > this.maxSearchRadius) continue;
      out.push({
        type: TaskType.PickUp,
        priority: TaskPriority.High,
        targetX: r.x,
        targetY: r.y,
        icon: 'gather',
        distance: dist,
        resource: r,
      });
    }
  }

  private addChopCandidates(settler: Settler, out: CandidateTask[]): void {
    if (!this.decorationGenerator) return;
    const woodAmount = this.simulation.getResourceAmount('wood');
    if (woodAmount >= this.woodThreshold) return;

    const trees = this.decorationGenerator.getAllTrees();
    for (const t of trees) {
      if (!this.tileGrid.isRevealed(t.tileX, t.tileY)) continue;
      if (this.assignedTargets.has(`${t.tileX},${t.tileY}`)) continue;
      const dist = Math.abs(settler.x - t.tileX) + Math.abs(settler.y - t.tileY);
      if (dist > this.maxSearchRadius) continue;
      out.push({
        type: TaskType.Chop,
        priority: TaskPriority.High,
        targetX: t.tileX,
        targetY: t.tileY,
        icon: 'chop',
        distance: dist,
      });
    }
  }

  private addArtifactCandidates(settler: Settler, out: CandidateTask[]): void {
    const artifacts = this.entityManager.getByType('artifact') as Artifact[];
    for (const a of artifacts) {
      if (!this.tileGrid.isRevealed(a.x, a.y)) continue;
      if (this.assignedTargets.has(`${a.x},${a.y}`)) continue;
      const dist = Math.abs(settler.x - a.x) + Math.abs(settler.y - a.y);
      if (dist > this.maxSearchRadius) continue;
      out.push({
        type: TaskType.PickUpArtifact,
        priority: TaskPriority.Low,
        targetX: a.x,
        targetY: a.y,
        icon: 'gather',
        distance: dist,
        artifact: a,
      });
    }
  }

  private createAutoTask(settler: Settler, candidate: CandidateTask): void {
    switch (candidate.type) {
      case TaskType.PickUp: {
        if (candidate.resource) {
          const task = this.workSystem.createPickUpTask(
            candidate.resource, candidate.priority, settler, true
          );
          task.autoIcon = candidate.icon;
        }
        break;
      }
      case TaskType.Chop: {
        const task = this.workSystem.createChopTask(
          candidate.targetX, candidate.targetY, candidate.priority, settler, true
        );
        task.autoIcon = candidate.icon;
        break;
      }
      case TaskType.Build: {
        if (candidate.building) {
          const task = this.workSystem.createBuildTask(
            candidate.building, candidate.priority, settler, true
          );
          task.autoIcon = candidate.icon;
        }
        break;
      }
      case TaskType.Repair: {
        if (candidate.building) {
          const task = this.workSystem.createRepairTask(
            candidate.building, candidate.priority, settler, true
          );
          task.autoIcon = candidate.icon;
        }
        break;
      }
      case TaskType.PickUpArtifact: {
        if (candidate.artifact) {
          const task = this.workSystem.createPickUpArtifactTask(
            candidate.artifact, candidate.priority, settler, true
          );
          task.autoIcon = candidate.icon;
        }
        break;
      }
    }
  }
}
