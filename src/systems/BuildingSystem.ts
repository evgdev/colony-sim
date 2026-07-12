import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import buildingsData from '../data/buildings.json';

export class BuildingSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;

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

      if (def.produceType && def.produceRate > 0) {
        this.applyFarmEffect(bld, def.produceType, def.produceRate, def.produceInterval, tickDelta);
      }

      if (def.produceType === 'food') {
        this.collectFoodFromFarm(bld, settlers);
      }
    }
  }

  private applyHouseEffect(bld: Building, settlers: Settler[], reduction: number, tickDelta: number): void {
    for (const settler of settlers) {
      if (this.isNearby(settler, bld, 3)) {
        settler.hunger = Math.min(100, settler.hunger + reduction * tickDelta);
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
