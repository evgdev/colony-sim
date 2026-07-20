import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Simulation } from '../core/Simulation';
import { gameConfig } from '../gameConfig';
import dinosaursData from '../data/dinosaurs.json';

interface Incubation {
  buildingId: number;
  eggType: string;
  progress: number;
  requiredTime: number;
}

export class IncubatorSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;
  private simulation: Simulation;
  private incubations: Map<number, Incubation> = new Map();
  private onHatch?: (dino: Dinosaur) => void;

  constructor(entityManager: EntityManager, tileGrid: TileGrid, simulation: Simulation) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
    this.simulation = simulation;
  }

  setOnHatch(callback: (dino: Dinosaur) => void): void {
    this.onHatch = callback;
  }

  startIncubation(buildingId: number, eggType: string): boolean {
    const eggToSpecies: Record<string, string> = {
      'raptor_egg': 'raptor',
      'bronto_egg': 'brontosaur',
      'trex_egg': 'trex',
    };
    const species = eggToSpecies[eggType];
    if (!species) return false;

    const incubationTime = gameConfig.incubationTimes as Record<string, number>;

    // Check if egg is available
    const eggAmount = this.simulation.getResourceAmount(eggType);
    if (eggAmount <= 0) return false;

    // Consume egg
    this.simulation.removeFromInventory(eggType, 1);

    this.incubations.set(buildingId, {
      buildingId,
      eggType,
      progress: 0,
      requiredTime: incubationTime[species] ?? 30,
    });

    return true;
  }

  update(tickDelta: number, isDaytime: boolean): void {
    for (const [buildingId, inc] of this.incubations) {
      // Daytime = faster incubation
      const speed = isDaytime ? 1.2 : 0.8;
      inc.progress += tickDelta * speed;

      if (inc.progress >= inc.requiredTime) {
        this.hatchEgg(buildingId, inc);
      }
    }
  }

  private hatchEgg(buildingId: number, inc: Incubation): void {
    const eggToSpecies: Record<string, string> = {
      'raptor_egg': 'raptor',
      'bronto_egg': 'brontosaur',
      'trex_egg': 'trex',
    };

    const species = eggToSpecies[inc.eggType];
    if (!species) return;

    const def = (dinosaursData as any)[species];
    if (!def) return;

    // Find the incubator building
    const buildings = this.entityManager.getByType('building') as Building[];
    const incubator = buildings.find(b => b.id === buildingId);
    if (!incubator) return;

    // Find free adjacent tile
    const footprint = def.footprint ?? 1;
    const bldSize = incubator.size ?? 2;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: bldSize },
      { dx: -1, dy: 0 }, { dx: bldSize, dy: 0 },
      { dx: -1, dy: -1 }, { dx: bldSize, dy: -1 },
      { dx: -1, dy: bldSize }, { dx: bldSize, dy: bldSize },
    ];
    let spawnX = incubator.x + bldSize;
    let spawnY = incubator.y + bldSize;
    for (const d of dirs) {
      const tx = incubator.x + d.dx;
      const ty = incubator.y + d.dy;
      const tile = this.tileGrid.get(tx, ty);
      if (tile && tile.walkable && !tile.occupied) {
        spawnX = tx;
        spawnY = ty;
        break;
      }
    }

    // Create baby dinosaur at adjacent tile
    const dino = new Dinosaur(
      spawnX, spawnY,
      species,
      Math.floor(def.hp * 0.5), // Baby has half HP
      def.speed,
      def.aggroRange,
      def.size,
      def.attackDamage,
      def.wallDamage ?? 5,
      footprint
    );
    dino.isTamed = true;
    dino.loyalty = 50; // Start tamed
    dino.isTamed = true;
    dino.hunger = 100;

    this.entityManager.add(dino);
    this.incubations.delete(buildingId);

    this.onHatch?.(dino);
  }

  getIncubation(buildingId: number): Incubation | undefined {
    return this.incubations.get(buildingId);
  }

  getProgressPercent(buildingId: number): number {
    const inc = this.incubations.get(buildingId);
    if (!inc) return 0;
    return Math.min(1, inc.progress / inc.requiredTime);
  }

  isIncubating(buildingId: number): boolean {
    return this.incubations.has(buildingId);
  }
}
