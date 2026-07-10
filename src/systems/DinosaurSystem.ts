import { EntityManager } from '../core/EntityManager';
import { TileGrid } from '../core/TileGrid';
import { Dinosaur } from '../entities/Dinosaur';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import dinosaursData from '../data/dinosaurs.json';

export class DinosaurSystem {
  private entityManager: EntityManager;
  private tileGrid: TileGrid;
  private spawnTimer: number = 0;
  private spawnInterval: number = 30;
  private maxDinosaurs: number = 6;

  constructor(entityManager: EntityManager, tileGrid: TileGrid) {
    this.entityManager = entityManager;
    this.tileGrid = tileGrid;
  }

  update(tickDelta: number): void {
    this.spawnTimer += tickDelta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval;
      this.trySpawn();
    }

    const dinos = this.entityManager.getByType('dinosaur') as Dinosaur[];
    for (const dino of dinos) {
      this.updateDino(dino, tickDelta);
    }

    const dead = dinos.filter(d => !d.isAlive);
    for (const d of dead) {
      this.entityManager.remove(d.id);
    }
  }

  private updateDino(dino: Dinosaur, tickDelta: number): void {
    dino.stateTimer += tickDelta;
    dino.idleTime += tickDelta;

    const nearestSettler = this.findNearestSettler(dino);
    const distToSettler = nearestSettler
      ? Math.abs(dino.x - nearestSettler.x) + Math.abs(dino.y - nearestSettler.y)
      : Infinity;

    switch (dino.state) {
      case 'idle':
        if (distToSettler <= dino.aggroRange && nearestSettler) {
          dino.state = 'investigate';
          dino.stateTimer = 0;
        } else if (dino.idleTime > 3 + Math.random() * 4) {
          dino.state = 'wander';
          dino.wanderTarget = this.getRandomWalkableTile();
          dino.stateTimer = 0;
          dino.idleTime = 0;
        }
        break;

      case 'wander':
        if (distToSettler <= dino.aggroRange && nearestSettler) {
          dino.state = 'investigate';
          dino.stateTimer = 0;
          dino.wanderTarget = null;
          break;
        }
        if (dino.wanderTarget) {
          this.moveToward(dino, dino.wanderTarget, dino.speed * tickDelta);
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
        if (nearestSettler && distToSettler <= dino.aggroRange) {
          this.moveToward(dino, nearestSettler, dino.speed * tickDelta);
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
    }
  }

  private moveToward(dino: Dinosaur, target: { x: number; y: number }, stepSize: number): void {
    const dx = target.x - dino.x;
    const dy = target.y - dino.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;

    const step = Math.min(stepSize, dist);
    const nx = dx / dist;
    const ny = dy / dist;

    const newX = Math.round(dino.x + nx * step);
    const newY = Math.round(dino.y + ny * step);

    if (this.tileGrid.isWalkable(newX, newY)) {
      this.tileGrid.setOccupied(dino.x, dino.y, false);
      dino.x = newX;
      dino.y = newY;
      this.tileGrid.setOccupied(newX, newY, true);
    }
  }

  private findNearestSettler(dino: Dinosaur): Settler | null {
    const settlers = this.entityManager.getByType('settler') as Settler[];
    let nearest: Settler | null = null;
    let minDist = Infinity;
    for (const s of settlers) {
      const dist = Math.abs(dino.x - s.x) + Math.abs(dino.y - s.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
    return nearest;
  }

  private getRandomWalkableTile(): { x: number; y: number } | null {
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * this.tileGrid.width);
      const y = Math.floor(Math.random() * this.tileGrid.height);
      if (this.tileGrid.isWalkable(x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  private trySpawn(): void {
    const dinoCount = this.entityManager.getByType('dinosaur').length;
    if (dinoCount >= this.maxDinosaurs) return;

    const spawnPoint = this.getRandomWalkableTile();
    if (!spawnPoint) return;

    const species = this.getRandomSpecies();
    const def = (dinosaursData as any)[species];
    if (!def) return;

    const dino = new Dinosaur(
      spawnPoint.x, spawnPoint.y, species,
      def.hp, def.speed, def.aggroRange, def.size
    );
    this.entityManager.add(dino);
    this.tileGrid.setOccupied(spawnPoint.x, spawnPoint.y, true);
  }

  private getRandomSpecies(): string {
    const species = Object.keys(dinosaursData);
    return species[Math.floor(Math.random() * species.length)];
  }
}
