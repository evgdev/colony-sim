import { Settler } from '../entities/Settler';

export class NeedsSystem {
  update(settlers: Settler[], tickDelta: number): void {
    for (const settler of settlers) {
      settler.hunger = Math.max(0, settler.hunger - tickDelta * 0.05);
      settler.energy = Math.max(0, settler.energy - tickDelta * 0.03);

      if (settler.hunger <= 0) {
        settler.energy = Math.max(0, settler.energy - tickDelta * 0.3);
      }
    }
  }
}
