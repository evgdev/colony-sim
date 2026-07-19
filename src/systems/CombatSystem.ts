import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { Settler } from '../entities/Settler';
import { Dinosaur } from '../entities/Dinosaur';

export interface CombatEvent {
  type: 'settler_attack' | 'dino_attack' | 'dino_vs_dino';
  attacker: string;
  defender: string;
  damage: number;
  killed: boolean;
  killedAt?: { x: number; y: number };
  killedSpecies?: string;
}

const PREDATOR_SPECIES = ['trex', 'raptor'];

export class CombatSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;
  private events: CombatEvent[] = [];

  constructor(entityManager: EntityManager, tileGrid: TileGrid) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
  }

  update(tickDelta: number): CombatEvent[] {
    this.events = [];

    this.processSettlerCombat(tickDelta);
    this.processDinoVsDinoCombat(tickDelta);

    return this.events;
  }

  private processSettlerCombat(tickDelta: number): void {
    const settlers = this.entityManager.getByType('settler') as Settler[];
    for (const settler of settlers) {
      if (!settler.isAlive) continue;
      if (settler.attackCooldown > 0) {
        settler.attackCooldown -= tickDelta;
        continue;
      }

      const nearestDino = this.findNearestDino(settler, 1);
      if (nearestDino) {
        const damage = 10;
        nearestDino.takeDamage(damage);
        settler.attackCooldown = settler.getAttackCooldown();
        settler.triggerAttack();
        const killed = !nearestDino.isAlive;

        this.events.push({
          type: 'settler_attack',
          attacker: settler.name,
          defender: nearestDino.species,
          damage,
          killed,
          killedAt: killed ? { x: nearestDino.x, y: nearestDino.y } : undefined,
          killedSpecies: killed ? nearestDino.species : undefined,
        });
      }
    }
  }

  private processDinoVsDinoCombat(tickDelta: number): void {
    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    const processed = new Set<string>();

    for (const dino of dinos) {
      if (!dino.isAlive) continue;
      if (dino.attackCooldown > 0) {
        dino.attackCooldown -= tickDelta;
        continue;
      }

      const nearbyDinos = this.findNearbyEnemyDinos(dino, 1);
      for (const target of nearbyDinos) {
        if (!target.isAlive) continue;
        const pairKey = [dino.id, target.id].sort().join('-');
        if (processed.has(pairKey)) continue;

        const damage = dino.attackDamage;
        target.takeDamage(damage);
        dino.attackCooldown = 1.0;
        processed.add(pairKey);

        this.events.push({
          type: 'dino_vs_dino',
          attacker: `${dino.species}(${dino.id})`,
          defender: `${target.species}(${target.id})`,
          damage,
          killed: !target.isAlive,
        });
        break;
      }
    }
  }

  private findNearestDino(settler: Settler, range: number): Dinosaur | null {
    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    let nearest: Dinosaur | null = null;
    let minDist = Infinity;
    for (const d of dinos) {
      if (!d.isAlive) continue;
      if (d.isTamed) continue; // Don't attack tamed dinosaurs
      const dist = Math.abs(settler.x - d.x) + Math.abs(settler.y - d.y);
      if (dist <= range && dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    return nearest;
  }

  private findNearbyEnemyDinos(dino: Dinosaur, range: number): Dinosaur[] {
    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    const isPredator = PREDATOR_SPECIES.includes(dino.species);
    const result: Dinosaur[] = [];

    for (const other of dinos) {
      if (other.id === dino.id || !other.isAlive) continue;
      const dist = Math.abs(dino.x - other.x) + Math.abs(dino.y - other.y);
      if (dist > range) continue;

      if (isPredator) {
        result.push(other);
      } else {
        const otherIsPredator = PREDATOR_SPECIES.includes(other.species);
        if (otherIsPredator) {
          result.push(other);
        }
      }
    }
    return result;
  }
}
