import { Entity } from '../core/Entity';
import { FOOD_START_AMOUNT } from '../config';

export interface InventoryItem {
  id?: string;
  name: string;
  quantity: number;
  resourceType: string;
}

export type SettlerClass = 'engineer' | 'biologist' | 'pilot';
export type WorkMode = 'auto' | 'gather' | 'build' | 'idle';

export class Settler extends Entity {
  private static nextItemId = 1;
  name: string;
  color: number;
  settlerClass: SettlerClass;
  inventory: InventoryItem[] = [];
  hunger: number = 100;
  energy: number = 100;
  hp: number = 100;
  maxHp: number = 100;
  food: number = FOOD_START_AMOUNT;
  foodTimer: number = 0;
  currentTaskId: string | null = null;
  attackCooldown: number = 0;
  path: { x: number; y: number }[] = [];
  pathIndex: number = 0;
  artifactFogBonus: number = 0;
  artifactAttackSpeedBonus: number = 0;
  collectedArtifacts: Map<string, number> = new Map();
  workMode: WorkMode = 'idle';

  // Visual animation state
  activity: 'idle' | 'walk' | 'gather' | 'attack' = 'idle';
  attackFlash: number = 0; // ms remaining of attack animation
  walkDirection: { x: number; y: number } | null = null;

  constructor(x: number, y: number, name: string = 'Settler', color: number = 0xffd700, settlerClass: SettlerClass = 'engineer') {
    super('settler', x, y);
    this.name = name;
    this.color = color;
    this.settlerClass = settlerClass;
    this.workMode = 'idle';
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  get isAlive(): boolean {
    return this.hp > 0;
  }

  addToInventory(item: Omit<InventoryItem, 'id'>): void {
    const existing = this.inventory.find(i => i.resourceType === item.resourceType);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this.inventory.push({ ...item, id: `item_${Settler.nextItemId++}` });
    }
  }

  static resetItemIdCounter(start: number = 1): void {
    Settler.nextItemId = start;
  }

  removeFromInventory(resourceType: string, quantity: number): boolean {
    const item = this.inventory.find(i => i.resourceType === resourceType);
    if (!item || item.quantity < quantity) return false;
    item.quantity -= quantity;
    if (item.quantity <= 0) {
      this.inventory = this.inventory.filter(i => i.resourceType !== resourceType);
    }
    return true;
  }

  hasResource(resourceType: string, quantity: number): boolean {
    const item = this.inventory.find(i => i.resourceType === resourceType);
    return item !== undefined && item.quantity >= quantity;
  }

  getBuildSpeedBonus(): number {
    let bonus = this.settlerClass === 'engineer' ? 1.5 : 1.0;
    if (this.energy <= 0) bonus *= 0.3;
    else if (this.energy < 30) bonus *= 0.6;
    return bonus;
  }

  getFogRadiusBonus(): number {
    const classBonus = this.settlerClass === 'biologist' ? 1 : 0;
    return classBonus + this.artifactFogBonus;
  }

  getMoveSpeedBonus(): number {
    let bonus = this.settlerClass === 'pilot' ? 1.2 : 1.0;
    if (this.energy <= 0) bonus *= 0.4;
    else if (this.energy < 30) bonus *= 0.7;
    return bonus;
  }

  getAttackCooldown(): number {
    return 1.0 / (1.0 + this.artifactAttackSpeedBonus);
  }

  addArtifact(name: string): void {
    const count = this.collectedArtifacts.get(name) || 0;
    this.collectedArtifacts.set(name, count + 1);
  }

  getArtifactCount(name: string): number {
    return this.collectedArtifacts.get(name) || 0;
  }

  /** Trigger the attack animation for a short duration. */
  triggerAttack(): void {
    this.activity = 'attack';
    this.attackFlash = 350;
  }

  updateVisual(deltaMs: number, tilesPerMs: number): void {
    if (this.attackFlash > 0) {
      this.attackFlash = Math.max(0, this.attackFlash - deltaMs);
      if (this.attackFlash === 0 && this.activity === 'attack') {
        this.activity = 'idle';
      }
    }
    super.updateVisual(deltaMs, tilesPerMs);
  }

  serialize(): object {
    const base = super.serialize() as any;
    return {
      i: base.id,
      t: base.entityType,
      x: base.x,
      y: base.y,
      n: this.name,
      c: this.color,
      s: this.settlerClass,
      inv: this.inventory.length > 0 ? this.inventory : undefined,
      h: Math.round(this.hunger),
      e: Math.round(this.energy),
      hp: this.hp,
      mhp: this.maxHp,
      f: this.food,
      ft: Math.round(this.foodTimer),
      task: this.currentTaskId,
      p: this.path.length > 0 ? this.path : undefined,
      pi: this.pathIndex > 0 ? this.pathIndex : undefined,
      fb: this.artifactFogBonus || undefined,
      ab: this.artifactAttackSpeedBonus || undefined,
      ca: this.collectedArtifacts.size > 0 ? Object.fromEntries(this.collectedArtifacts) : undefined,
      wm: this.workMode !== 'idle' ? this.workMode : undefined,
    };
  }

  static deserialize(data: any): Settler {
    const x = data.x;
    const y = data.y;
    const name = data.n ?? data.name ?? 'Worker';
    const color = data.c ?? data.color ?? 0xffd700;
    const settlerClass = data.s ?? data.settlerClass ?? 'engineer';
    const s = new Settler(x, y, name, color, settlerClass);
    s.id = data.i ?? data.id;
    s.inventory = data.inv ?? data.inventory ?? [];
    s.hunger = data.h ?? data.hunger ?? 100;
    s.energy = data.e ?? data.energy ?? 100;
    s.hp = data.hp ?? 100;
    s.maxHp = data.mhp ?? data.maxHp ?? 100;
    s.food = data.f ?? data.food ?? 5;
    s.foodTimer = data.ft ?? data.foodTimer ?? 0;
    s.currentTaskId = data.task ?? data.currentTaskId ?? null;
    s.path = data.p ?? data.path ?? [];
    s.pathIndex = data.pi ?? data.pathIndex ?? 0;
    s.artifactFogBonus = data.fb ?? data.artifactFogBonus ?? 0;
    s.artifactAttackSpeedBonus = data.ab ?? data.artifactAttackSpeedBonus ?? 0;
    s.collectedArtifacts = new Map(Object.entries(data.ca ?? data.collectedArtifacts ?? {}));
    s.workMode = data.wm ?? data.workMode ?? 'idle';
    s.snapVisual();
    return s;
  }
}
