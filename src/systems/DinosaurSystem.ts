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
  private onWallDestroyed?: (x: number, y: number) => void;
  private nightSpawnMultiplier: number = 2;
  rng: SeededRandom;

  constructor(entityManager: EntityManager, tileGrid: TileGrid, seed: number, onSettlerDeath?: (name: string) => void, onSpawn?: (species: string) => void, onWallDestroyed?: (x: number, y: number) => void) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
    this.rng = new SeededRandom(seed ^ 77777);
    this.onSettlerDeath = onSettlerDeath;
    this.onSpawn = onSpawn;
    this.onWallDestroyed = onWallDestroyed;
  }

  private isNightPhase(tickCount: number): boolean {
    return isNight(tickCount);
  }

  update(tickDelta: number, tickCount: number = 0, dinosEnabled: boolean = false): void {
    const night = this.isNightPhase(tickCount);
    const spawnInterval = night ? Math.floor(this.spawnInterval / this.nightSpawnMultiplier) : this.spawnInterval;

    // Spawn dinosaurs when enabled by quest system
    if (dinosEnabled && tickCount > 0 && tickCount % spawnInterval === 0) {
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
        this.tileGrid.setOccupiedArea(d.x, d.y, d.footprint, false);
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
          const moved = this.moveToward(dino, nearestSettler, dino.speed);
          if (!moved) {
            // Blocked — check for adjacent wall to attack
            const targetBuilding = this.findAdjacentBuilding(dino);
            if (targetBuilding && dino.attackCooldown <= 0) {
              targetBuilding.damage(dino.wallDamage);
              targetBuilding.damageFlash = 1.0;
              dino.attackCooldown = 2;
              if (targetBuilding.hp <= 0) {
                this.destroyBuilding(targetBuilding);
              }
            }
          }
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
          // Can't reach settler — look for a wall/building to attack
          const targetBuilding = this.findAdjacentBuilding(dino);
          if (targetBuilding) {
            if (dino.attackCooldown <= 0) {
              targetBuilding.damage(dino.wallDamage);
              targetBuilding.damageFlash = 1.0;
              dino.attackCooldown = 2;
              if (targetBuilding.hp <= 0) {
                this.destroyBuilding(targetBuilding);
                dino.state = 'idle';
                dino.stateTimer = 0;
              }
            }
          } else {
            dino.state = 'wander';
            dino.wanderTarget = this.getRandomWalkableTile();
            dino.stateTimer = 0;
          }
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

  private moveToward(dino: Dinosaur, target: { x: number; y: number }, stepSize: number): boolean {
    const steps = Math.max(1, Math.ceil(stepSize));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (!this.stepOrthogonal(dino, target.x - dino.x, target.y - dino.y)) break;
      moved = true;
    }
    return moved;
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

    const tryOrder: [number, number][] =
      Math.abs(dx) >= Math.abs(dy)
        ? [[sx, 0], [0, sy]]
        : [[0, sy], [sx, 0]];

    for (const [mx, my] of tryOrder) {
      if (mx === 0 && my === 0) continue;
      const nx = dino.x + mx;
      const ny = dino.y + my;
      const fp = dino.footprint;

      if (this.tileGrid.isAreaWalkableForDino(nx, ny, fp)) {
        this.tileGrid.setOccupiedArea(dino.x, dino.y, fp, false);
        dino.moveTo(nx, ny);
        this.tileGrid.setOccupiedArea(nx, ny, fp, true);
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

    const species = this.getRandomSpecies(night);
    const def = (dinosaursData as any)[species];
    if (!def) return;

    const footprint = def.footprint ?? 1;
    const spawnPoint = this.getSpawnTile(MIN_SPAWN_DISTANCE, footprint);
    if (!spawnPoint) return;

    const dino = new Dinosaur(
      spawnPoint.x, spawnPoint.y, species,
      def.hp, def.speed, def.aggroRange, def.size, def.attackDamage, def.wallDamage ?? 5, footprint
    );
    this.entityManager.add(dino);
    this.tileGrid.setOccupiedArea(spawnPoint.x, spawnPoint.y, footprint, true);
    this.onSpawn?.(species);
  }

  private getSpawnTile(minDist: number, footprint: number = 1): { x: number; y: number } | null {
    const settlers = this.entityManager.getByType('settler') as Settler[];
    for (let i = 0; i < 40; i++) {
      const x = this.rng.nextInt(this.tileGrid.width - footprint + 1);
      const y = this.rng.nextInt(this.tileGrid.height - footprint + 1);
      if (!this.tileGrid.isAreaWalkableForDino(x, y, footprint)) continue;
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

  private findAdjacentBuilding(dino: Dinosaur): Building | null {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = dino.x + dx;
      const ny = dino.y + dy;
      const tile = this.tileGrid.get(nx, ny);
      if (!tile || !tile.building) continue;
      const building = this.entityManager.getAt(nx, ny, 'building') as Building | undefined;
      if (building) return building;
    }
    return null;
  }

  private destroyBuilding(building: Building): void {
    this.entityManager.remove(building.id);
    this.tileGrid.setOccupied(building.x, building.y, false);
    this.tileGrid.setBuilding(building.x, building.y, false);
    if ((building as any).buildingType === 'gate') {
      this.tileGrid.setGate(building.x, building.y, false);
      this.tileGrid.setDinoBlocked(building.x, building.y, false);
    }
    this.onWallDestroyed?.(building.x, building.y);
  }
}
