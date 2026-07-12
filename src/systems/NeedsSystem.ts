import { Settler } from '../entities/Settler';
import {
  FOOD_EAT_INTERVAL,
  FOOD_HUNGER_RESTORE,
  STARVATION_DAMAGE,
  HUNGER_STARVATION_THRESHOLD,
  HUNGER_STARVATION_MULTIPLIER,
} from '../config';

export class NeedsSystem {
  update(settlers: Settler[], tickDelta: number): void {
    for (const settler of settlers) {
      if (!settler.isAlive) continue;

      const hungerRate = settler.hunger <= HUNGER_STARVATION_THRESHOLD
        ? 0.05 * HUNGER_STARVATION_MULTIPLIER
        : 0.05;
      settler.hunger = Math.max(0, settler.hunger - hungerRate * tickDelta);

      settler.energy = Math.max(0, settler.energy - 0.03 * tickDelta);

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
