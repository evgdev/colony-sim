import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { MovementSystem } from './MovementSystem';
import { ArtifactSystem } from './ArtifactSystem';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Artifact } from '../entities/Artifact';
import { Task, TaskType, TaskPriority } from '../core/Task';
import { TaskQueue } from '../core/TaskQueue';
import { QuestSystem } from './QuestSystem';
import { Simulation } from '../core/Simulation';

export class WorkSystem {
  private movementSystem: MovementSystem;
  private tileGrid: TileGrid;
  private entityManager: EntityManager;
  private taskQueue: TaskQueue;
  private simulation: Simulation;
  artifactSystem: ArtifactSystem | null = null;
  questSystem: QuestSystem | null = null;

  constructor(
    movementSystem: MovementSystem,
    tileGrid: TileGrid,
    entityManager: EntityManager,
    taskQueue: TaskQueue,
    simulation: Simulation
  ) {
    this.movementSystem = movementSystem;
    this.tileGrid = tileGrid;
    this.entityManager = entityManager;
    this.taskQueue = taskQueue;
    this.simulation = simulation;
  }

  update(tickDelta: number): void {
    const settlers = this.entityManager.getByType('settler') as Settler[];

    this.cleanupDeadSettlerTasks(settlers);

    for (const settler of settlers) {
      if (!settler.isAlive) continue;
      if (settler.currentTaskId) {
        this.executeCurrentTask(settler, tickDelta);
      } else {
        this.assignNextTask(settler);
      }
    }
  }

  private cleanupDeadSettlerTasks(settlers: Settler[]): void {
    const aliveIds = new Set(settlers.filter(s => s.isAlive).map(s => s.id));
    const tasks = this.taskQueue.getAll();
    for (const task of tasks) {
      if (task.assignedSettlerId !== undefined && !aliveIds.has(task.assignedSettlerId)) {
        this.taskQueue.remove(task.id);
      }
    }
  }

  private assignNextTask(settler: Settler): void {
    const task = this.taskQueue.peek();
    if (!task) return;
    if (task.assignedSettlerId && task.assignedSettlerId !== settler.id) return;
    settler.currentTaskId = task.id;
  }

  interruptSettler(settler: Settler): void {
    if (settler.currentTaskId) {
      this.taskQueue.remove(settler.currentTaskId);
    }
    settler.currentTaskId = null;
    settler.path = [];
    settler.pathIndex = 0;
  }

  private executeCurrentTask(settler: Settler, tickDelta: number): void {
    const task = this.findTaskById(settler.currentTaskId!);
    if (!task) {
      settler.currentTaskId = null;
      return;
    }

    switch (task.type) {
      case TaskType.MoveTo:
        this.executeMoveTo(settler, task, tickDelta);
        break;
      case TaskType.PickUp:
        this.executePickUp(settler, task, tickDelta);
        break;
      case TaskType.Build:
        this.executeBuild(settler, task, tickDelta);
        break;
      case TaskType.Harvest:
        this.executePickUp(settler, task, tickDelta);
        break;
      case TaskType.PickUpArtifact:
        this.executePickUpArtifact(settler, task, tickDelta);
        break;
      default:
        task.completed = true;
        break;
    }

    if (task.completed) {
      this.taskQueue.remove(settler.currentTaskId!);
      settler.currentTaskId = null;
    }
  }

  private executeMoveTo(settler: Settler, task: Task, tickDelta: number): void {
    if (settler.path.length === 0 || settler.pathIndex === 0) {
      const path = this.movementSystem.findPath(settler.x, settler.y, task.targetX, task.targetY);
      if (path.length <= 1) {
        task.completed = true;
        return;
      }
      settler.path = path;
      settler.pathIndex = 1;
    }

    const speedBonus = settler.getMoveSpeedBonus();
    const steps = speedBonus > 1 ? 2 : 1;
    for (let i = 0; i < steps && settler.pathIndex < settler.path.length; i++) {
      settler.pathIndex = this.movementSystem.stepAlongPath(settler, settler.path, settler.pathIndex);
    }

    if (settler.pathIndex >= settler.path.length) {
      task.completed = true;
      settler.path = [];
      settler.pathIndex = 0;
    }
  }

  private executePickUp(settler: Settler, task: Task, tickDelta: number): void {
    if (settler.path.length === 0 || settler.pathIndex === 0) {
      const resource = this.findResourceAt(task.targetX, task.targetY);
      if (!resource || resource.depleted) {
        task.completed = true;
        return;
      }

      if (settler.x === task.targetX && settler.y === task.targetY) {
        const amount = resource.harvest(5);
        if (amount > 0) {
          this.simulation.addToInventory(resource.resourceType, amount, resource.resourceType);
        }
        if (resource.depleted) {
          this.entityManager.remove(resource.id);
          task.completed = true;
        }
        return;
      }

      const path = this.movementSystem.findPath(settler.x, settler.y, task.targetX, task.targetY);
      if (path.length <= 1) {
        task.completed = true;
        return;
      }
      settler.path = path;
      settler.pathIndex = 1;
    }

    settler.pathIndex = this.movementSystem.stepAlongPath(settler, settler.path, settler.pathIndex);

    if (settler.pathIndex >= settler.path.length) {
      const resource = this.findResourceAt(task.targetX, task.targetY);
      if (resource && !resource.depleted) {
        const amount = resource.harvest(5);
        if (amount > 0) {
          this.simulation.addToInventory(resource.resourceType, amount, resource.resourceType);
        }
        if (resource.depleted) {
          this.entityManager.remove(resource.id);
          task.completed = true;
        }
      } else {
        task.completed = true;
      }
      settler.path = [];
      settler.pathIndex = 0;
    }
  }

  private executeBuild(settler: Settler, task: Task, tickDelta: number): void {
    const building = this.findBuildingAt(task.targetX, task.targetY);

    if (!building || building.built) {
      if (task.returnX !== undefined && task.returnY !== undefined) {
        if (settler.x !== task.returnX || settler.y !== task.returnY) {
          if (settler.path.length === 0 || settler.pathIndex === 0) {
            const path = this.movementSystem.findPath(settler.x, settler.y, task.returnX, task.returnY);
            if (path.length <= 1) {
              task.completed = true;
              return;
            }
            settler.path = path;
            settler.pathIndex = 1;
          }

          settler.pathIndex = this.movementSystem.stepAlongPath(settler, settler.path, settler.pathIndex);

          if (settler.pathIndex < settler.path.length) return;
          settler.path = [];
          settler.pathIndex = 0;
        }
      }
      task.completed = true;
      return;
    }

    if (settler.x !== task.targetX || settler.y !== task.targetY) {
      if (settler.path.length === 0 || settler.pathIndex === 0) {
        const path = this.movementSystem.findPath(settler.x, settler.y, task.targetX, task.targetY);
        if (path.length <= 1) {
          task.completed = true;
          return;
        }
        settler.path = path;
        settler.pathIndex = 1;
      }

      settler.pathIndex = this.movementSystem.stepAlongPath(settler, settler.path, settler.pathIndex);

      if (settler.pathIndex < settler.path.length) return;
      settler.path = [];
      settler.pathIndex = 0;
    }

    if (!building.requiresConsumed) {
      const hasAll = building.requires.every(r => this.simulation.hasResource(r.resourceType, r.quantity));
      if (!hasAll) {
        task.completed = true;
        return;
      }
      building.requires.forEach(r => this.simulation.removeFromInventory(r.resourceType, r.quantity));
      building.requiresConsumed = true;
    }

    const buildBonus = settler.getBuildSpeedBonus();
    building.work(buildBonus);
  }

  private findTaskById(id: string): Task | undefined {
    return this.taskQueue.getAll().find(t => t.id === id);
  }

  private findResourceAt(x: number, y: number): Resource | undefined {
    return this.entityManager.getAll().find(
      e => e.entityType === 'resource' && e.x === x && e.y === y
    ) as Resource | undefined;
  }

  private findBuildingAt(x: number, y: number): Building | undefined {
    return this.entityManager.getAll().find(
      e => e.entityType === 'building' && e.x === x && e.y === y
    ) as Building | undefined;
  }

  private findArtifactAt(x: number, y: number): Artifact | undefined {
    return this.entityManager.getAll().find(
      e => e.entityType === 'artifact' && e.x === x && e.y === y
    ) as Artifact | undefined;
  }

  private executePickUpArtifact(settler: Settler, task: Task, tickDelta: number): void {
    if (settler.path.length === 0 || settler.pathIndex === 0) {
      const artifact = this.findArtifactAt(task.targetX, task.targetY);
      if (!artifact) {
        task.completed = true;
        return;
      }

      if (settler.x === task.targetX && settler.y === task.targetY) {
        if (this.artifactSystem) {
          this.artifactSystem.addArtifact(artifact.name);
          this.artifactSystem.applyEffects(settler);
        }
        this.simulation.addToInventory(artifact.name, 1, artifact.name);
        this.entityManager.remove(artifact.id);
        this.tileGrid.setOccupied(task.targetX, task.targetY, false);
        task.completed = true;
        return;
      }

      const path = this.movementSystem.findPath(settler.x, settler.y, task.targetX, task.targetY);
      if (path.length <= 1) {
        task.completed = true;
        return;
      }
      settler.path = path;
      settler.pathIndex = 1;
    }

    settler.pathIndex = this.movementSystem.stepAlongPath(settler, settler.path, settler.pathIndex);

    if (settler.pathIndex >= settler.path.length) {
      const artifact = this.findArtifactAt(task.targetX, task.targetY);
      if (artifact) {
        if (this.artifactSystem) {
          this.artifactSystem.addArtifact(artifact.name);
          this.artifactSystem.applyEffects(settler);
        }
        this.simulation.addToInventory(artifact.name, 1, artifact.name);
        this.entityManager.remove(artifact.id);
        this.tileGrid.setOccupied(task.targetX, task.targetY, false);
      }
      task.completed = true;
      settler.path = [];
      settler.pathIndex = 0;
    }
  }

  createMoveTask(targetX: number, targetY: number, priority: TaskPriority = TaskPriority.Normal, settler?: Settler): Task {
    if (settler) {
      this.interruptSettler(settler);
    } else {
      const settlers = this.entityManager.getByType('settler') as Settler[];
      for (const s of settlers) this.interruptSettler(s);
    }
    const task = new Task({
      type: TaskType.MoveTo,
      priority,
      targetX,
      targetY,
      assignedSettlerId: settler?.id,
    });
    this.taskQueue.add(task);
    return task;
  }

  createPickUpTask(resource: Resource, priority: TaskPriority = TaskPriority.Normal, settler?: Settler): Task {
    if (settler) {
      this.interruptSettler(settler);
    } else {
      const settlers = this.entityManager.getByType('settler') as Settler[];
      for (const s of settlers) this.interruptSettler(s);
    }
    const task = new Task({
      type: TaskType.PickUp,
      priority,
      targetX: resource.x,
      targetY: resource.y,
      resourceType: resource.resourceType,
      assignedSettlerId: settler?.id,
    });
    this.taskQueue.add(task);
    return task;
  }

  createBuildTask(building: Building, priority: TaskPriority = TaskPriority.Normal, settler?: Settler): Task {
    if (settler) {
      this.interruptSettler(settler);
    } else {
      const settlers = this.entityManager.getByType('settler') as Settler[];
      for (const s of settlers) this.interruptSettler(s);
    }
    const task = new Task({
      type: TaskType.Build,
      priority,
      targetX: building.x,
      targetY: building.y,
      buildingId: `${building.id}`,
      assignedSettlerId: settler?.id,
      returnX: settler?.x,
      returnY: settler?.y,
    });
    this.taskQueue.add(task);
    return task;
  }

  createPickUpArtifactTask(artifact: Artifact, priority: TaskPriority = TaskPriority.Normal, settler?: Settler): Task {
    if (settler) {
      this.interruptSettler(settler);
    } else {
      const settlers = this.entityManager.getByType('settler') as Settler[];
      for (const s of settlers) this.interruptSettler(s);
    }
    const task = new Task({
      type: TaskType.PickUpArtifact,
      priority,
      targetX: artifact.x,
      targetY: artifact.y,
      assignedSettlerId: settler?.id,
    });
    this.taskQueue.add(task);
    return task;
  }
}
