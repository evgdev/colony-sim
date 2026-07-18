import { Entity } from '../core/Entity';

export type DinosaurState = 'wander' | 'investigate' | 'flee' | 'idle' | 'attack' | 'sleeping' | 'eating';

export class Dinosaur extends Entity {
  species: string;
  hp: number;
  maxHp: number;
  speed: number;
  aggroRange: number;
  attackDamage: number;
  wallDamage: number;
  attackCooldown: number = 0;
  size: number;
  footprint: number = 1;
  state: DinosaurState = 'idle';
  wanderTarget: { x: number; y: number } | null = null;
  stateTimer: number = 0;
  idleTime: number = 0;

  // Territory properties
  territoryCenterX: number = 0;
  territoryCenterY: number = 0;
  territoryRadius: number = 8;
  warningRange: number = 5;
  attackRange: number = 2;
  aggression: number = 0.5; // 0 = passive, 1 = aggressive
  dailySchedule: { activeStart: number; activeEnd: number } = { activeStart: 6, activeEnd: 18 };
  isSleeping: boolean = false;

  constructor(x: number, y: number, species: string, maxHp: number, speed: number, aggroRange: number, size: number, attackDamage: number = 10, wallDamage: number = 5, footprint: number = 1) {
    super('dinosaur', x, y);
    this.species = species;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.speed = speed;
    this.aggroRange = aggroRange;
    this.attackDamage = attackDamage;
    this.wallDamage = wallDamage;
    this.size = size;
    this.footprint = footprint;
    this.territoryCenterX = x;
    this.territoryCenterY = y;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  get isAlive(): boolean {
    return this.hp > 0;
  }

  isInRange(x: number, y: number, range: number): boolean {
    return Math.abs(this.x - x) + Math.abs(this.y - y) <= range;
  }

  isOutsideTerritory(): boolean {
    const dist = Math.abs(this.x - this.territoryCenterX) + Math.abs(this.y - this.territoryCenterY);
    return dist > this.territoryRadius;
  }

  serialize(): object {
    const base = super.serialize() as any;
    return {
      i: base.i,
      t: 'dinosaur',
      x: base.x,
      y: base.y,
      sp: this.species,
      hp: this.hp,
      mhp: this.maxHp,
      s: this.speed,
      ar: this.aggroRange,
      ad: this.attackDamage,
      wd: this.wallDamage,
      sz: this.size,
      fp: this.footprint,
      st: this.state,
      wt: this.wanderTarget,
      st2: this.stateTimer,
      it: this.idleTime,
      tcx: this.territoryCenterX,
      tcy: this.territoryCenterY,
      tr: this.territoryRadius,
      wr: this.warningRange,
      ar2: this.attackRange,
      ag: this.aggression,
      sl: this.isSleeping,
    };
  }

  static deserialize(data: any): Dinosaur {
    const d = new Dinosaur(
      data.x, data.y,
      data.sp ?? data.species,
      data.mhp ?? data.maxHp,
      data.s ?? data.speed,
      data.ar ?? data.aggroRange,
      data.sz ?? data.size,
      data.ad ?? data.attackDamage,
      data.wd ?? data.wallDamage ?? 5,
      data.fp ?? 1
    );
    d.id = data.i ?? data.id;
    d.hp = data.hp ?? d.maxHp;
    d.state = data.st ?? data.state ?? 'idle';
    d.wanderTarget = data.wt ?? data.wanderTarget ?? null;
    d.stateTimer = data.st2 ?? data.stateTimer ?? 0;
    d.idleTime = data.it ?? data.idleTime ?? 0;
    d.territoryCenterX = data.tcx ?? d.x;
    d.territoryCenterY = data.tcy ?? d.y;
    d.territoryRadius = data.tr ?? 8;
    d.warningRange = data.wr ?? 5;
    d.attackRange = data.ar2 ?? 2;
    d.aggression = data.ag ?? 0.5;
    d.isSleeping = data.sl ?? false;
    d.snapVisual();
    return d;
  }
}
