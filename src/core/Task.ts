export enum TaskType {
  MoveTo = 'move_to',
  PickUp = 'pick_up',
  Build = 'build',
  Repair = 'repair',
  Harvest = 'harvest',
}

export enum TaskPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Urgent = 3,
}

export interface TaskData {
  type: TaskType;
  priority: TaskPriority;
  targetX: number;
  targetY: number;
  itemId?: string;
  buildingId?: string;
  resourceType?: string;
}

export class Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  targetX: number;
  targetY: number;
  itemId?: string;
  buildingId?: string;
  resourceType?: string;
  completed: boolean = false;

  constructor(data: TaskData) {
    this.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.type = data.type;
    this.priority = data.priority;
    this.targetX = data.targetX;
    this.targetY = data.targetY;
    this.itemId = data.itemId;
    this.buildingId = data.buildingId;
    this.resourceType = data.resourceType;
  }

  serialize(): object {
    return {
      id: this.id,
      type: this.type,
      priority: this.priority,
      targetX: this.targetX,
      targetY: this.targetY,
      itemId: this.itemId,
      buildingId: this.buildingId,
      resourceType: this.resourceType,
      completed: this.completed,
    };
  }

  static deserialize(data: any): Task {
    const task = new Task({
      type: data.type,
      priority: data.priority,
      targetX: data.targetX,
      targetY: data.targetY,
      itemId: data.itemId,
      buildingId: data.buildingId,
      resourceType: data.resourceType,
    });
    task.id = data.id;
    task.completed = data.completed;
    return task;
  }
}
