import { TileGrid } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';
import { TaskQueue } from '../core/TaskQueue';

export interface SimulationState {
  grid: ReturnType<TileGrid['serialize']>;
  entities: ReturnType<EntityManager['serialize']>;
  tasks: ReturnType<TaskQueue['serialize']>;
  tickCount: number;
  nextEntityId: number;
}

export class Simulation {
  tileGrid: TileGrid;
  entityManager: EntityManager;
  taskQueue: TaskQueue;
  tickCount: number = 0;
  tickRate: number = 500;
  private tickAccumulator: number = 0;

  constructor(width: number = 20, height: number = 15) {
    this.tileGrid = new TileGrid(width, height);
    this.entityManager = new EntityManager();
    this.taskQueue = new TaskQueue();
    this.generateMap();
  }

  private generateMap(): void {
    for (let y = 0; y < this.tileGrid.height; y++) {
      for (let x = 0; x < this.tileGrid.width; x++) {
        const rand = Math.random();
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
    this.tickAccumulator += deltaTime;
    if (this.tickAccumulator >= this.tickRate) {
      this.tickAccumulator -= this.tickRate;
      this.tick();
      return true;
    }
    return false;
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
    };
  }

  static deserialize(data: SimulationState): Simulation {
    const sim = new Simulation(0, 0);
    sim.tileGrid = TileGrid.deserialize(data.grid);
    sim.entityManager = EntityManager.deserialize(data.entities);
    sim.taskQueue = TaskQueue.deserialize(data.tasks);
    sim.tickCount = data.tickCount;
    return sim;
  }
}
