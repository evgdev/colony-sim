import { Entity } from '../core/Entity';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  resourceType: string;
}

export class Settler extends Entity {
  name: string;
  inventory: InventoryItem[] = [];
  hunger: number = 100;
  energy: number = 100;
  hp: number = 1000;
  maxHp: number = 1000;
  food: number = 5;
  foodTimer: number = 0;
  currentTaskId: string | null = null;
  attackCooldown: number = 0;
  path: { x: number; y: number }[] = [];
  pathIndex: number = 0;

  constructor(x: number, y: number, name: string = 'Settler') {
    super('settler', x, y);
    this.name = name;
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

  serialize(): object {
    return {
      ...super.serialize(),
      name: this.name,
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
    };
  }

  static deserialize(data: any): Settler {
    const s = new Settler(data.x, data.y, data.name);
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
    return s;
  }
}
