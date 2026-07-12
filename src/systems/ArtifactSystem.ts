import { Settler } from '../entities/Settler';
import artifactsData from '../data/artifacts.json';

export interface ArtifactEffect {
  icon: string;
  color: string;
  effect: string;
  value: number;
  description: string;
}

export class ArtifactSystem {
  private collectedArtifacts: Map<string, number> = new Map();

  getArtifactEffect(name: string): ArtifactEffect | null {
    const key = name.toLowerCase();
    const def = (artifactsData as any)[key];
    if (!def) return null;
    return def as ArtifactEffect;
  }

  addArtifact(name: string): void {
    const count = this.collectedArtifacts.get(name) || 0;
    this.collectedArtifacts.set(name, count + 1);
  }

  getCollectedArtifacts(): Map<string, number> {
    return this.collectedArtifacts;
  }

  applyEffects(settler: Settler): void {
    for (const [name, count] of this.collectedArtifacts) {
      const effect = this.getArtifactEffect(name);
      if (!effect) continue;

      switch (effect.effect) {
        case 'maxHp':
          settler.maxHp = 100 + effect.value * count;
          break;
      }
    }
  }

  getBonusValue(effectType: string): number {
    let total = 0;
    for (const [name, count] of this.collectedArtifacts) {
      const effect = this.getArtifactEffect(name);
      if (effect && effect.effect === effectType) {
        total += effect.value * count;
      }
    }
    return total;
  }

  serialize(): object {
    const artifacts: Record<string, number> = {};
    this.collectedArtifacts.forEach((count, name) => {
      artifacts[name] = count;
    });
    return { artifacts };
  }

  deserialize(data: any): void {
    this.collectedArtifacts.clear();
    if (data.artifacts) {
      for (const [name, count] of Object.entries(data.artifacts)) {
        this.collectedArtifacts.set(name, count as number);
      }
    }
  }
}
