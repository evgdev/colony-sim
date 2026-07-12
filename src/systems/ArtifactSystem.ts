import { Settler } from '../entities/Settler';
import { EntityManager } from '../core/EntityManager';
import artifactsData from '../data/artifacts.json';

export interface ArtifactEffect {
  icon: string;
  color: string;
  effect: string;
  value: number;
  description: string;
}

export class ArtifactSystem {
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  getArtifactEffect(name: string): ArtifactEffect | null {
    const key = name.toLowerCase();
    const def = (artifactsData as any)[key];
    if (!def) return null;
    return def as ArtifactEffect;
  }

  applyEffects(settler: Settler): void {
    for (const [name, count] of settler.collectedArtifacts) {
      const effect = this.getArtifactEffect(name);
      if (!effect) continue;

      switch (effect.effect) {
        case 'maxHp':
          settler.maxHp = 100 + effect.value * count;
          break;
        case 'fogRadius':
          settler.artifactFogBonus = effect.value * count;
          break;
        case 'attackSpeed':
          settler.artifactAttackSpeedBonus = effect.value * count;
          break;
      }
    }
  }

  getStorageBonus(): number {
    let total = 0;
    const settlers = this.entityManager.getByType('settler') as Settler[];
    for (const settler of settlers) {
      for (const [name, count] of settler.collectedArtifacts) {
        const effect = this.getArtifactEffect(name);
        if (effect && effect.effect === 'storage') {
          total += effect.value * count;
        }
      }
    }
    return total;
  }
}
