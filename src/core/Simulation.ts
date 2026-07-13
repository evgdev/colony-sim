import { TileGrid } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';
import { TaskQueue } from '../core/TaskQueue';
import { SeededRandom } from '../replay/ReplayTypes';

export interface InventoryItem {
  resourceType: string;
  quantity: number;
  name?: string;
}

export interface SimulationState {
  grid: ReturnType<TileGrid['serialize']>;
  entities: ReturnType<EntityManager['serialize']>;
  tasks: ReturnType<TaskQueue['serialize']>;
  tickCount: number;
  nextEntityId: number;
  inventory: InventoryItem[];
  seed?: number;
}

export class Simulation {
  tileGrid: TileGrid;
  entityManager: EntityManager;
  taskQueue: TaskQueue;
  tickCount: number = 0;
  tickRate: number = 500;
  private tickAccumulator: number = 0;
  inventory: InventoryItem[] = [];
  seed: number;
  rng: SeededRandom;

  constructor(width: number = 20, height: number = 15, seed?: number) {
    this.tileGrid = new TileGrid(width, height);
    this.entityManager = new EntityManager();
    this.taskQueue = new TaskQueue();
    this.seed = seed ?? (Date.now() ^ (Math.random() * 0xFFFFFFFF));
    this.rng = new SeededRandom(this.seed);
    this.generateMap();
  }

  addToInventory(resourceType: string, quantity: number, name?: string): void {
    if (quantity <= 0) return;
    const existing = this.inventory.find(i => i.resourceType === resourceType);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.inventory.push({ resourceType, quantity, name });
    }
  }

  removeFromInventory(resourceType: string, quantity: number): boolean {
    const item = this.inventory.find(i => i.resourceType === resourceType);
    if (!item || item.quantity < quantity) return false;
    item.quantity -= quantity;
    if (item.quantity <= 0) {
      this.inventory = this.inventory.filter(i => i.resourceType !== resourceType);
    }
    return true;
  }

  hasResource(resourceType: string, quantity: number): boolean {
    const item = this.inventory.find(i => i.resourceType === resourceType);
    return item !== undefined && item.quantity >= quantity;
  }

  getResourceAmount(resourceType: string): number {
    const item = this.inventory.find(i => i.resourceType === resourceType);
    return item?.quantity ?? 0;
  }

  private generateMap(): void {
    for (let y = 0; y < this.tileGrid.height; y++) {
      for (let x = 0; x < this.tileGrid.width; x++) {
        const rand = this.rng.next();
        if (rand < 0.05) {
          this.tileGrid.setTile(x, y, { type: 'water', walkCost: 999, walkable: false });
        } else if (rand < 0.12) {
          this.tileGrid.setTile(x, y, { type: 'stone', walkCost: 2, walkable: true });
        } else if (rand < 0.18) {
          this.tileGrid.setTile(x, y, { type: 'sand', walkCost: 1, walkable: true });
        } else if (rand < 0.85) {
          this.tileGrid.setTile(x, y, { type: 'grass', walkCost: 1, walkable: true });
        } else {
          this.tileGrid.setTile(x, y, { type: 'dirt', walkCost: 1, walkable: true });
        }
      }
    }
  }

  update(deltaTime: number): boolean {
    const dt = Math.min(deltaTime, 100);
    this.tickAccumulator += dt;
    let ticked = false;
    while (this.tickAccumulator >= this.tickRate) {
      this.tickAccumulator -= this.tickRate;
      this.tick();
      ticked = true;
    }
    return ticked;
  }

  tick(): void {
    this.tickCount++;
  }

  serialize(): SimulationState {
    return {
      grid: this.tileGrid.serialize(),
      entities: this.entityManager.serialize(),
      tasks: [],
      tickCount: this.tickCount,
      nextEntityId: (this.entityManager.getAll().length > 0
        ? Math.max(...this.entityManager.getAll().map(e => e.id)) + 1
        : 1),
      inventory: this.inventory,
      seed: this.seed,
    };
  }

  static deserialize(data: SimulationState): Simulation {
    const sim = new Simulation(0, 0, data.seed);
    sim.tileGrid = TileGrid.deserialize(data.grid);
    sim.entityManager = EntityManager.deserialize(data.entities);
    sim.taskQueue = TaskQueue.deserialize(data.tasks);
    sim.tickCount = data.tickCount;
    sim.inventory = data.inventory || [];
    return sim;
  }
}
