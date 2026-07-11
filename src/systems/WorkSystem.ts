import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { MovementSystem } from './MovementSystem';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Task, TaskType, TaskPriority } from '../core/Task';
import { TaskQueue } from '../core/TaskQueue';

export class WorkSystem {
  private movementSystem: MovementSystem;
  private tileGrid: TileGrid;
  private entityManager: EntityManager;
  private taskQueue: TaskQueue;

  constructor(
    movementSystem: MovementSystem,
    tileGrid: TileGrid,
    entityManager: EntityManager,
    taskQueue: TaskQueue
  ) {
    this.movementSystem = movementSystem;
    this.tileGrid = tileGrid;
    this.entityManager = entityManager;
    this.taskQueue = taskQueue;
  }

  update(tickDelta: number): void {
    const settlers = this.entityManager.getByType('settler') as Settler[];

    for (const settler of settlers) {
      if (settler.currentTaskId) {
        this.executeCurrentTask(settler, tickDelta);
      } else {
        this.assignNextTask(settler);
      }
    }
  }

  private assignNextTask(settler: Settler): void {
    const task = this.taskQueue.peek();
    if (!task) return;
    settler.currentTaskId = task.id;
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

    settler.pathIndex = this.movementSystem.stepAlongPath(settler, settler.path, settler.pathIndex);

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
          settler.addToInventory({
            name: resource.resourceType,
            quantity: amount,
            resourceType: resource.resourceType,
          });
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
          settler.addToInventory({
            name: resource.resourceType,
            quantity: amount,
            resourceType: resource.resourceType,
          });
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
      const hasAll = building.requires.every(r => settler.hasResource(r.resourceType, r.quantity));
      if (!hasAll) {
        task.completed = true;
        return;
      }
      building.requires.forEach(r => settler.removeFromInventory(r.resourceType, r.quantity));
      building.requiresConsumed = true;
    }

    building.work(1);

    if (building.built) {
      task.completed = true;
    }
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

  createMoveTask(targetX: number, targetY: number, priority: TaskPriority = TaskPriority.Normal): Task {
    const task = new Task({
      type: TaskType.MoveTo,
      priority,
      targetX,
      targetY,
    });
    this.taskQueue.add(task);
    return task;
  }

  createPickUpTask(resource: Resource, priority: TaskPriority = TaskPriority.Normal): Task {
    const task = new Task({
      type: TaskType.PickUp,
      priority,
      targetX: resource.x,
      targetY: resource.y,
      resourceType: resource.resourceType,
    });
    this.taskQueue.add(task);
    return task;
  }

  createBuildTask(building: Building, priority: TaskPriority = TaskPriority.Normal): Task {
    const task = new Task({
      type: TaskType.Build,
      priority,
      targetX: building.x,
      targetY: building.y,
      buildingId: `${building.id}`,
    });
    this.taskQueue.add(task);
    return task;
  }
}
