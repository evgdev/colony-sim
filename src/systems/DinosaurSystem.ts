import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { Dinosaur } from '../entities/Dinosaur';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import dinosaursData from '../data/dinosaurs.json';
import { isNight } from '../config';
import { SeededRandom } from '../replay/ReplayTypes';

const PREDATOR_SPECIES = ['trex', 'raptor'];
const HERBIVORE_SPECIES = ['brontosaur'];
const MIN_SPAWN_DISTANCE = 12;

export class DinosaurSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;
  private spawnTimer: number = 0;
  private spawnInterval: number = 30;
  private maxDinosaurs: number = 6;
  private onSettlerDeath?: (name: string) => void;
  private onSpawn?: (species: string) => void;
  private nightSpawnMultiplier: number = 2;
  rng: SeededRandom;

  constructor(entityManager: EntityManager, tileGrid: TileGrid, seed: number, onSettlerDeath?: (name: string) => void, onSpawn?: (species: string) => void) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
    this.rng = new SeededRandom(seed ^ 77777);
    this.onSettlerDeath = onSettlerDeath;
    this.onSpawn = onSpawn;
  }

  private isNightPhase(tickCount: number): boolean {
    return isNight(tickCount);
  }

  update(tickDelta: number, tickCount: number = 0): void {
    const night = this.isNightPhase(tickCount);
    const spawnInterval = night ? Math.floor(this.spawnInterval / this.nightSpawnMultiplier) : this.spawnInterval;

    if (tickCount > 0 && tickCount % spawnInterval === 0) {
      this.trySpawn(night);
    }

    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    for (const dino of dinos) {
      this.updateDino(dino, tickCount);
    }

    const dead = dinos.filter(d => !d.isAlive);
    for (const d of dead) {
      this.entityManager.remove(d.id);
      const artifactHere = this.entityManager.getAll().some(
        e => e.entityType === 'artifact' && e.x === d.x && e.y === d.y
      );
      if (!artifactHere) {
        this.tileGrid.setOccupied(d.x, d.y, false);
      }
    }

    const settlers = this.entityManager.getByType('settler') as Settler[];
    const deadSettlers = settlers.filter(s => !s.isAlive);
    for (const s of deadSettlers) {
      this.entityManager.remove(s.id);
      this.tileGrid.setOccupied(s.x, s.y, false);
      this.onSettlerDeath?.(s.name);
    }
  }

  private updateDino(dino: Dinosaur, _tickCount: number): void {
    dino.stateTimer++;
    dino.idleTime++;

    if (dino.attackCooldown > 0) {
      dino.attackCooldown--;
    }

    const nearestSettler = this.findNearestSettler(dino);
    const distToSettler = nearestSettler
      ? Math.abs(dino.x - nearestSettler.x) + Math.abs(dino.y - nearestSettler.y)
      : Infinity;

    const inAttackRange = nearestSettler && distToSettler <= 1;

    switch (dino.state) {
      case 'idle':
        if (HERBIVORE_SPECIES.includes(dino.species)) {
          const predator = this.findNearestPredator(dino);
          if (predator) {
            const predDist = Math.abs(dino.x - predator.x) + Math.abs(dino.y - predator.y);
            if (predDist <= dino.aggroRange) {
              dino.state = 'flee';
              dino.stateTimer = 0;
              break;
            }
          }
        }
        if (inAttackRange) {
          dino.state = 'attack';
          dino.stateTimer = 0;
        } else if (distToSettler <= dino.aggroRange && nearestSettler) {
          dino.state = 'investigate';
          dino.stateTimer = 0;
        } else if (dino.idleTime > 3 + this.rng.next() * 4) {
          dino.state = 'wander';
          dino.wanderTarget = this.getRandomWalkableTile();
          dino.stateTimer = 0;
          dino.idleTime = 0;
        }
        break;

      case 'wander':
        if (HERBIVORE_SPECIES.includes(dino.species)) {
          const predator = this.findNearestPredator(dino);
          if (predator) {
            const predDist = Math.abs(dino.x - predator.x) + Math.abs(dino.y - predator.y);
            if (predDist <= dino.aggroRange) {
              dino.state = 'flee';
              dino.stateTimer = 0;
              dino.wanderTarget = null;
              break;
            }
          }
        }
        if (inAttackRange) {
          dino.state = 'attack';
          dino.stateTimer = 0;
          dino.wanderTarget = null;
          break;
        }
        if (distToSettler <= dino.aggroRange && nearestSettler) {
          dino.state = 'investigate';
          dino.stateTimer = 0;
          dino.wanderTarget = null;
          break;
        }
        if (dino.wanderTarget) {
          this.moveToward(dino, dino.wanderTarget, dino.speed);
          if (dino.x === dino.wanderTarget.x && dino.y === dino.wanderTarget.y) {
            dino.state = 'idle';
            dino.wanderTarget = null;
            dino.stateTimer = 0;
          }
          if (dino.stateTimer > 20) {
            dino.state = 'idle';
            dino.wanderTarget = null;
            dino.stateTimer = 0;
          }
        } else {
          dino.state = 'idle';
        }
        break;

      case 'investigate':
        if (inAttackRange) {
          dino.state = 'attack';
          dino.stateTimer = 0;
          break;
        }
        if (nearestSettler && distToSettler <= dino.aggroRange) {
          this.moveToward(dino, nearestSettler, dino.speed);
          dino.stateTimer = 0;
        } else {
          dino.state = 'wander';
          dino.wanderTarget = this.getRandomWalkableTile();
          dino.stateTimer = 0;
        }
        if (dino.stateTimer > 15) {
          dino.state = 'idle';
          dino.stateTimer = 0;
        }
        break;

      case 'attack':
        if (!nearestSettler || distToSettler > 1) {
          dino.state = 'wander';
          dino.wanderTarget = this.getRandomWalkableTile();
          dino.stateTimer = 0;
          break;
        }
        if (dino.attackCooldown <= 0) {
          const died = nearestSettler.takeDamage(dino.attackDamage);
          dino.attackCooldown = 2;
          if (died) {
            dino.state = 'idle';
            dino.stateTimer = 0;
          }
        }
        break;

      case 'flee':
        const nearestPredator = this.findNearestPredator(dino);
        if (nearestPredator) {
          const predDist = Math.abs(dino.x - nearestPredator.x) + Math.abs(dino.y - nearestPredator.y);
          if (predDist > dino.aggroRange * 2) {
            dino.state = 'idle';
            dino.stateTimer = 0;
            break;
          }
          this.moveAwayFrom(dino, nearestPredator, dino.speed);
        } else {
          dino.state = 'idle';
          dino.stateTimer = 0;
        }
        if (dino.stateTimer > 20) {
          dino.state = 'idle';
          dino.stateTimer = 0;
        }
        break;
    }
  }

  private moveToward(dino: Dinosaur, target: { x: number; y: number }, stepSize: number): void {
    const steps = Math.max(1, Math.ceil(stepSize));
    for (let i = 0; i < steps; i++) {
      if (!this.stepOrthogonal(dino, target.x - dino.x, target.y - dino.y)) break;
    }
  }

  private moveAwayFrom(dino: Dinosaur, threat: { x: number; y: number }, stepSize: number): void {
    const steps = Math.max(1, Math.ceil(stepSize));
    for (let i = 0; i < steps; i++) {
      if (!this.stepOrthogonal(dino, dino.x - threat.x, dino.y - threat.y)) break;
    }
  }

  private stepOrthogonal(dino: Dinosaur, dx: number, dy: number): boolean {
    if (dx === 0 && dy === 0) return false;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);

    // Move strictly orthogonally, never cut diagonal corners through walls.
    const tryOrder: [number, number][] =
      Math.abs(dx) >= Math.abs(dy)
        ? [[sx, 0], [0, sy]]
        : [[0, sy], [sx, 0]];

    for (const [mx, my] of tryOrder) {
      if (mx === 0 && my === 0) continue;
      const nx = dino.x + mx;
      const ny = dino.y + my;
      if (this.tileGrid.isWalkableForDino(nx, ny)) {
        const oldTile = this.tileGrid.get(dino.x, dino.y);
        if (oldTile && !oldTile.building) {
          this.tileGrid.setOccupied(dino.x, dino.y, false);
        }
        dino.moveTo(nx, ny);
        this.tileGrid.setOccupied(nx, ny, true);
        return true;
      }
    }
    return false;
  }

  private findNearestSettler(dino: Dinosaur): Settler | null {
    const settlers = this.entityManager.getByType('settler') as Settler[];
    let nearest: Settler | null = null;
    let minDist = Infinity;
    for (const s of settlers) {
      if (!s.isAlive) continue;
      const dist = Math.abs(dino.x - s.x) + Math.abs(dino.y - s.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
    return nearest;
  }

  private findNearestPredator(dino: Dinosaur): Dinosaur | null {
    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    let nearest: Dinosaur | null = null;
    let minDist = Infinity;
    for (const d of dinos) {
      if (!d.isAlive || d.id === dino.id) continue;
      if (!PREDATOR_SPECIES.includes(d.species)) continue;
      const dist = Math.abs(dino.x - d.x) + Math.abs(dino.y - d.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    return nearest;
  }

  private getRandomWalkableTile(): { x: number; y: number } | null {
    for (let i = 0; i < 20; i++) {
      const x = this.rng.nextInt(this.tileGrid.width);
      const y = this.rng.nextInt(this.tileGrid.height);
      if (this.tileGrid.isWalkableForDino(x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  private trySpawn(night: boolean): void {
    const dinoCount = this.entityManager.getByType('dinosaur').length;
    if (dinoCount >= this.maxDinosaurs) return;

    const spawnPoint = this.getSpawnTile(MIN_SPAWN_DISTANCE);
    if (!spawnPoint) return;

    const species = this.getRandomSpecies(night);
    const def = (dinosaursData as any)[species];
    if (!def) return;

    const dino = new Dinosaur(
      spawnPoint.x, spawnPoint.y, species,
      def.hp, def.speed, def.aggroRange, def.size, def.attackDamage
    );
    this.entityManager.add(dino);
    this.tileGrid.setOccupied(spawnPoint.x, spawnPoint.y, true);
    this.onSpawn?.(species);
  }

  private getSpawnTile(minDist: number): { x: number; y: number } | null {
    const settlers = this.entityManager.getByType('settler') as Settler[];
    for (let i = 0; i < 40; i++) {
      const x = this.rng.nextInt(this.tileGrid.width);
      const y = this.rng.nextInt(this.tileGrid.height);
      if (!this.tileGrid.isWalkableForDino(x, y)) continue;
      const farEnough = settlers.every(s =>
        Math.abs(s.x - x) + Math.abs(s.y - y) >= minDist
      );
      if (farEnough) return { x, y };
    }
    return null;
  }

  private getRandomSpecies(night: boolean): string {
    const pool = night ? PREDATOR_SPECIES : HERBIVORE_SPECIES;
    return pool[this.rng.nextInt(pool.length)];
  }
}
