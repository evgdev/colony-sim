import { Settler } from '../entities/Settler';
import {
  FOOD_EAT_INTERVAL,
  FOOD_HUNGER_RESTORE,
  STARVATION_DAMAGE,
  HUNGER_STARVATION_THRESHOLD,
  HUNGER_STARVATION_MULTIPLIER,
} from '../config';

const TICKS_PER_DAY = 24;
const NIGHT_START = 18;
const NIGHT_END = 6;
const NIGHT_ENERGY_MULTIPLIER = 1.5;

export class NeedsSystem {
  private isNight(tickCount: number): boolean {
    const hour = tickCount % TICKS_PER_DAY;
    return hour >= NIGHT_START || hour < NIGHT_END;
  }

  update(settlers: Settler[], tickDelta: number, tickCount: number = 0): void {
    const isNight = this.isNight(tickCount);
    const energyMultiplier = isNight ? NIGHT_ENERGY_MULTIPLIER : 1;

    for (const settler of settlers) {
      if (!settler.isAlive) continue;

      const hungerRate = settler.hunger <= HUNGER_STARVATION_THRESHOLD
        ? 0.05 * HUNGER_STARVATION_MULTIPLIER
        : 0.05;
      settler.hunger = Math.max(0, settler.hunger - hungerRate * tickDelta);

      settler.energy = Math.max(0, settler.energy - 0.03 * energyMultiplier * tickDelta);

      if (settler.hunger <= 0) {
        settler.energy = Math.max(0, settler.energy - 0.3 * tickDelta);
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
    }
  }
}
