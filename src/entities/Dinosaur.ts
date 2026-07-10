import { Entity } from '../core/Entity';

export type DinosaurState = 'wander' | 'investigate' | 'flee' | 'idle';

export class Dinosaur extends Entity {
  species: string;
  hp: number;
  maxHp: number;
  speed: number;
  aggroRange: number;
  size: number;
  state: DinosaurState = 'idle';
  wanderTarget: { x: number; y: number } | null = null;
  stateTimer: number = 0;
  idleTime: number = 0;

  constructor(x: number, y: number, species: string, maxHp: number, speed: number, aggroRange: number, size: number) {
    super('dinosaur', x, y);
    this.species = species;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.speed = speed;
    this.aggroRange = aggroRange;
    this.size = size;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  get isAlive(): boolean {
    return this.hp > 0;
  }

  serialize(): object {
    return {
      ...super.serialize(),
      species: this.species,
      hp: this.hp,
      maxHp: this.maxHp,
      speed: this.speed,
      aggroRange: this.aggroRange,
      size: this.size,
      state: this.state,
      wanderTarget: this.wanderTarget,
      stateTimer: this.stateTimer,
      idleTime: this.idleTime,
    };
  }

  static deserialize(data: any): Dinosaur {
    const d = new Dinosaur(data.x, data.y, data.species, data.maxHp, data.speed, data.aggroRange, data.size);
    d.id = data.id;
    d.hp = data.hp;
    d.state = data.state ?? 'idle';
    d.wanderTarget = data.wanderTarget ?? null;
    d.stateTimer = data.stateTimer ?? 0;
    d.idleTime = data.idleTime ?? 0;
    return d;
  }
}
