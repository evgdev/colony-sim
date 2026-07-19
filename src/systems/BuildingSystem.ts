import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import buildingsData from '../data/buildings.json';

export class BuildingSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;
  onDinoKilled?: (dino: Dinosaur) => void;

  constructor(entityManager: EntityManager, tileGrid: TileGrid) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
  }

  update(tickDelta: number): void {
    const buildings = this.entityManager.getByType('building') as Building[];
    const settlers = this.entityManager.getByType('settler') as Settler[];

    for (const bld of buildings) {
      if (!bld.built) continue;
      const def = (buildingsData as any)[bld.buildingType];
      if (!def) continue;

      if (def.hungerReduction) {
        this.applyHouseEffect(bld, settlers, def.hungerReduction, tickDelta);
      }

      if (def.healRate) {
        this.applyHealEffect(bld, settlers, def.healRate, tickDelta);
      }

      if (def.produceType && def.produceRate > 0) {
        this.applyFarmEffect(bld, def.produceType, def.produceRate, def.produceInterval, tickDelta);
      }

      if (def.produceType === 'food') {
        this.collectFoodFromFarm(bld, settlers);
      }

      if (bld.attackDamage > 0 && bld.attackRange > 0) {
        this.processTurret(bld, tickDelta);
      }
    }
  }

  private processTurret(bld: Building, tickDelta: number): void {
    if (bld.attackCooldown > 0) {
      bld.attackCooldown -= tickDelta;
      return;
    }

    const target = this.findNearestDino(bld, bld.attackRange);
    if (!target) return;

    target.takeDamage(bld.attackDamage);
    bld.attackCooldown = bld.attackInterval;
    bld.fireFlash = 1;
    if (!target.isAlive) {
      this.onDinoKilled?.(target);
    }
  }

  private findNearestDino(bld: Building, range: number): Dinosaur | null {
    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    let nearest: Dinosaur | null = null;
    let minDist = Infinity;
    for (const d of dinos) {
      if (!d.isAlive) continue;
      if (d.isTamed) continue; // Don't attack tamed dinosaurs
      if (d.spawnTime < 50) continue; // Immune for first 50 ticks
      const dist = Math.abs(bld.x - d.x) + Math.abs(bld.y - d.y);
      if (dist <= range && dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    return nearest;
  }

  private applyHouseEffect(bld: Building, settlers: Settler[], reduction: number, tickDelta: number): void {
    for (const settler of settlers) {
      if (this.isNearby(settler, bld, 3)) {
        settler.hunger = Math.min(100, settler.hunger + reduction * tickDelta);
      }
    }
  }

  private applyHealEffect(bld: Building, settlers: Settler[], rate: number, tickDelta: number): void {
    for (const settler of settlers) {
      if (this.isNearby(settler, bld, 3)) {
        settler.hp = Math.min(settler.maxHp, settler.hp + rate * tickDelta);
      }
    }
  }

  private applyFarmEffect(bld: Building, produceType: string, rate: number, interval: number, tickDelta: number): void {
    bld.produceTimer += tickDelta;
    if (bld.produceTimer >= interval) {
      bld.produceTimer -= interval;
      const added = bld.addToStorage(produceType, rate);
      if (added < rate) {
        bld.produceTimer = 0;
      }
    }
  }

  private collectFoodFromFarm(bld: Building, settlers: Settler[]): void {
    const foodInStorage = bld.getStorageAmount('food');
    if (foodInStorage <= 0) return;

    for (const settler of settlers) {
      if (!this.isNearby(settler, bld, 3)) continue;
      if (settler.food >= 10) continue;

      const toCollect = Math.min(foodInStorage, 10 - settler.food);
      const collected = bld.removeFromStorage('food', toCollect);
      if (collected > 0) {
        settler.food += collected;
        break;
      }
    }
  }

  private isNearby(a: { x: number; y: number }, b: { x: number; y: number }, range: number): boolean {
    return Math.abs(a.x - b.x) <= range && Math.abs(a.y - b.y) <= range;
  }

  findWarehouse(): Building | undefined {
    return (this.entityManager.getByType('building') as Building[])
      .find(b => b.built && b.buildingType === 'warehouse' && !b.isFull);
  }
}
