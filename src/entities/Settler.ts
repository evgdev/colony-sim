import { Entity } from '../core/Entity';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  resourceType: string;
}

export type SettlerClass = 'engineer' | 'biologist' | 'pilot';

export class Settler extends Entity {
  name: string;
  color: number;
  settlerClass: SettlerClass;
  inventory: InventoryItem[] = [];
  hunger: number = 100;
  energy: number = 100;
  hp: number = 100;
  maxHp: number = 100;
  food: number = 5;
  foodTimer: number = 0;
  currentTaskId: string | null = null;
  attackCooldown: number = 0;
  path: { x: number; y: number }[] = [];
  pathIndex: number = 0;
  artifactFogBonus: number = 0;
  artifactAttackSpeedBonus: number = 0;
  collectedArtifacts: Map<string, number> = new Map();

  constructor(x: number, y: number, name: string = 'Settler', color: number = 0xffd700, settlerClass: SettlerClass = 'engineer') {
    super('settler', x, y);
    this.name = name;
    this.color = color;
    this.settlerClass = settlerClass;
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
      this.inventory.push({ ...item, id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    }
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
    return this.settlerClass === 'engineer' ? 1.5 : 1.0;
  }

  getFogRadiusBonus(): number {
    const classBonus = this.settlerClass === 'biologist' ? 1 : 0;
    return classBonus + this.artifactFogBonus;
  }

  getMoveSpeedBonus(): number {
    return this.settlerClass === 'pilot' ? 1.2 : 1.0;
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

  serialize(): object {
    return {
      ...super.serialize(),
      name: this.name,
      color: this.color,
      settlerClass: this.settlerClass,
      inventory: this.inventory,
      hunger: this.hunger,
      energy: this.energy,
      hp: this.hp,
      maxHp: this.maxHp,
      food: this.food,
      foodTimer: this.foodTimer,
      currentTaskId: this.currentTaskId,
      path: this.path,
      pathIndex: this.pathIndex,
      artifactFogBonus: this.artifactFogBonus,
      artifactAttackSpeedBonus: this.artifactAttackSpeedBonus,
      collectedArtifacts: Object.fromEntries(this.collectedArtifacts),
    };
  }

  static deserialize(data: any): Settler {
    const s = new Settler(data.x, data.y, data.name, data.color ?? 0xffd700, data.settlerClass ?? 'engineer');
    s.id = data.id;
    s.inventory = data.inventory || [];
    s.hunger = data.hunger ?? 100;
    s.energy = data.energy ?? 100;
    s.hp = data.hp ?? 100;
    s.maxHp = data.maxHp ?? 100;
    s.food = data.food ?? 5;
    s.foodTimer = data.foodTimer ?? 0;
    s.currentTaskId = data.currentTaskId ?? null;
    s.path = data.path || [];
    s.pathIndex = data.pathIndex ?? 0;
    s.artifactFogBonus = data.artifactFogBonus ?? 0;
    s.artifactAttackSpeedBonus = data.artifactAttackSpeedBonus ?? 0;
    s.collectedArtifacts = new Map(Object.entries(data.collectedArtifacts || {}));
    return s;
  }
}
