import { TileGrid, BiomeBlend, TileType } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';
import { TaskQueue } from '../core/TaskQueue';
import { SeededRandom } from '../replay/ReplayTypes';
import { InventoryItem } from '../entities/Settler';

export type { InventoryItem };

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

  addToInventory(resourceType: string, quantity: number, name: string): void {
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
        const warpStrength = 3.0;
        const wx = x + this.fbm(x * 0.08, y * 0.08, this.seed + 10000, 2) * warpStrength;
        const wy = y + this.fbm(x * 0.08, y * 0.08, this.seed + 11000, 2) * warpStrength;

        const e = this.fbm(wx * 0.12, wy * 0.12, this.seed, 4);
        const m = this.fbm(wx * 0.15, wy * 0.15, this.seed + 5000, 3);

        const blend = this.calculateBlend(e, m);
        const type = blend.primary;

        const defs: Record<string, { walkCost: number; walkable: boolean }> = {
          water: { walkCost: 999, walkable: false },
          stone: { walkCost: 2, walkable: true },
          sand: { walkCost: 1, walkable: true },
          dirt: { walkCost: 1, walkable: true },
          grass: { walkCost: 1, walkable: true },
        };
        this.tileGrid.setTile(x, y, { type, blend, ...defs[type] });
      }
    }
  }

  private calculateBlend(e: number, m: number): BiomeBlend {
    const waterSand = this.smoothstep(0.18, 0.38, e);
    const sandGrass = this.smoothstep(0.30, 0.50, e);
    const grassStone = this.smoothstep(0.60, 0.82, e);
    const grassDirt = this.smoothstep(0.45, 0.65, m);

    const water = 1 - waterSand;
    const sand = waterSand * (1 - sandGrass);
    const stone = grassStone;
    const dirt = grassDirt * (1 - water) * (1 - stone) * 0.4;
    const grass = Math.max(0, 1 - water - sand - stone - dirt);

    const values: [TileType, number][] = [
      ['water', water], ['sand', sand], ['stone', stone],
      ['dirt', dirt], ['grass', grass],
    ];
    values.sort((a, b) => b[1] - a[1]);

    const primary = values[0][0];
    const secondary = values[1][0];
    const total = values[0][1] + values[1][1];
    const ratio = total > 0 ? values[1][1] / total : 0;

    return { primary, secondary, ratio };
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  private noise2D(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
  }

  private smoothNoise(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const a = this.noise2D(ix, iy, seed);
    const b = this.noise2D(ix + 1, iy, seed);
    const c = this.noise2D(ix, iy + 1, seed);
    const d = this.noise2D(ix + 1, iy + 1, seed);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  private fbm(x: number, y: number, seed: number, octaves: number = 3): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.smoothNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value / maxValue;
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
