import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import { EntityManager } from '../core/EntityManager';
import {
  FOOD_EAT_INTERVAL,
  FOOD_HUNGER_RESTORE,
  STARVATION_DAMAGE,
  HUNGER_STARVATION_THRESHOLD,
  HUNGER_STARVATION_MULTIPLIER,
  NEEDS_ENABLED,
} from '../config';

const TICKS_PER_DAY = 24;
const NIGHT_START = 18;
const NIGHT_END = 6;
const NIGHT_ENERGY_MULTIPLIER = 1.5;

// Base hunger rate — slows down after building farm
const HUNGER_RATE_BASE = 0.04;
const HUNGER_RATE_AFTER_FARM = 0.015;

export class NeedsSystem {
  private entityManager: EntityManager | null = null;

  constructor(entityManager?: EntityManager) {
    this.entityManager = entityManager ?? null;
  }

  private isNight(tickCount: number): boolean {
    const hour = tickCount % TICKS_PER_DAY;
    return hour >= NIGHT_START || hour < NIGHT_END;
  }

  update(settlers: Settler[], tickDelta: number, tickCount: number = 0, hasFarm: boolean = false): void {
    if (!NEEDS_ENABLED) return;
    const isNight = this.isNight(tickCount);
    const energyMultiplier = isNight ? NIGHT_ENERGY_MULTIPLIER : 1;

    // Hunger slows down after farm is built
    const hungerRate = hasFarm ? HUNGER_RATE_AFTER_FARM : HUNGER_RATE_BASE;

    for (const settler of settlers) {
      if (!settler.isAlive) continue;

      const currentHungerRate = settler.hunger <= HUNGER_STARVATION_THRESHOLD
        ? hungerRate * HUNGER_STARVATION_MULTIPLIER
        : hungerRate;
      settler.hunger = Math.max(0, settler.hunger - currentHungerRate * tickDelta);

      settler.energy = Math.max(0, settler.energy - 0.02 * energyMultiplier * tickDelta);

      if (settler.hunger <= 0) {
        settler.energy = Math.max(0, settler.energy - 0.2 * tickDelta);
      }

      settler.foodTimer += tickDelta;
      if (settler.foodTimer >= FOOD_EAT_INTERVAL) {
        settler.foodTimer -= FOOD_EAT_INTERVAL;
        if (settler.food > 0) {
          settler.food--;
          settler.hunger = Math.min(100, settler.hunger + FOOD_HUNGER_RESTORE);
        }
      }

      if (settler.hunger <= HUNGER_STARVATION_THRESHOLD) {
        settler.takeDamage(STARVATION_DAMAGE * tickDelta);
      }

      // Auto-collect food from nearby farm when hungry and low on personal food
      if (settler.hunger < 50 && settler.food < 5 && this.entityManager) {
        this.autoCollectFood(settler);
      }
    }
  }

  private autoCollectFood(settler: Settler): void {
    const buildings = this.entityManager!.getByType('building') as Building[];
    for (const bld of buildings) {
      if (!bld.built || bld.produceType !== 'food') continue;
      const dist = Math.abs(settler.x - bld.x) + Math.abs(settler.y - bld.y);
      if (dist > 5) continue; // wider range for auto-collect

      const foodInStorage = bld.getStorageAmount('food');
      if (foodInStorage <= 0) continue;

      const toCollect = Math.min(foodInStorage, 15 - settler.food);
      const collected = bld.removeFromStorage('food', toCollect);
      if (collected > 0) {
        settler.food += collected;
        break;
      }
    }
  }
}
