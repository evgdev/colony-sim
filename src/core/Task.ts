export enum TaskType {
  MoveTo = 'move_to',
  PickUp = 'pick_up',
  Build = 'build',
  Repair = 'repair',
  Harvest = 'harvest',
  PickUpArtifact = 'pick_up_artifact',
  Chop = 'chop',
  DeliverArtifact = 'deliver_artifact',
  Craft = 'craft',
  HarvestPlant = 'harvest_plant',
  Mine = 'mine',
}

export enum TaskPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Urgent = 3,
}

export type AutoTaskIcon = 'chop' | 'gather' | 'build' | 'repair' | 'research' | 'scout' | 'food' | 'mine';

export interface TaskData {
  type: TaskType;
  priority: TaskPriority;
  targetX: number;
  targetY: number;
  itemId?: string;
  buildingId?: string;
  resourceType?: string;
  recipeId?: string;
  assignedSettlerId?: number;
  returnX?: number;
  returnY?: number;
  isQuestTask?: boolean;
  autoIcon?: AutoTaskIcon;
}

export class Task {
  private static nextIdCounter = 1;
  id: string;
  type: TaskType;
  priority: TaskPriority;
  targetX: number;
  targetY: number;
  itemId?: string;
  buildingId?: string;
  resourceType?: string;
  recipeId?: string;
  assignedSettlerId?: number;
  returnX?: number;
  returnY?: number;
  isQuestTask: boolean;
  autoIcon?: AutoTaskIcon;
  completed: boolean = false;

  constructor(data: TaskData) {
    this.id = `task_${Task.nextIdCounter++}`;
    this.type = data.type;
    this.priority = data.priority;
    this.targetX = data.targetX;
    this.targetY = data.targetY;
    this.itemId = data.itemId;
    this.buildingId = data.buildingId;
    this.resourceType = data.resourceType;
    this.recipeId = data.recipeId;
    this.assignedSettlerId = data.assignedSettlerId;
    this.returnX = data.returnX;
    this.returnY = data.returnY;
    this.isQuestTask = data.isQuestTask ?? false;
    this.autoIcon = data.autoIcon;
  }

  static resetIdCounter(start: number = 1): void {
    Task.nextIdCounter = start;
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
      recipeId: this.recipeId,
      completed: this.completed,
      isQuestTask: this.isQuestTask,
      autoIcon: this.autoIcon,
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
      recipeId: data.recipeId,
      isQuestTask: data.isQuestTask,
      autoIcon: data.autoIcon,
    });
    task.id = data.id;
    task.completed = data.completed;
    return task;
  }
}
