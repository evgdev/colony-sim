import { Entity } from '../core/Entity';

export interface BuildRequirement {
  resourceType: string;
  quantity: number;
}

export interface StorageItem {
  resourceType: string;
  quantity: number;
}

export class Building extends Entity {
  buildingType: string;
  hp: number;
  maxHp: number;
  built: boolean;
  buildProgress: number;
  buildTime: number;
  requires: BuildRequirement[];
  requiresConsumed: boolean = false;

  storage: StorageItem[] = [];
  storageCapacity: number = 0;
  produceType: string = '';
  produceRate: number = 0;
  produceInterval: number = 0;
  produceTimer: number = 0;

  attackDamage: number = 0;
  attackRange: number = 0;
  attackInterval: number = 0;
  attackCooldown: number = 0;
  fireFlash: number = 0;

  constructor(
    x: number, y: number, buildingType: string,
    maxHp: number = 100, buildTime: number = 10,
    requires: BuildRequirement[] = []
  ) {
    super('building', x, y);
    this.buildingType = buildingType;
    this.maxHp = maxHp;
    this.hp = 0;
    this.built = false;
    this.buildProgress = 0;
    this.buildTime = buildTime;
    this.requires = requires;
  }

  work(ticks: number = 1): boolean {
    if (this.built) return true;
    this.buildProgress += ticks;
    this.hp = Math.floor((this.buildProgress / this.buildTime) * this.maxHp);
    if (this.buildProgress >= this.buildTime) {
      this.buildProgress = this.buildTime;
      this.hp = this.maxHp;
      this.built = true;
      return true;
    }
    return false;
  }

  get progressPercent(): number {
    return this.buildTime > 0 ? this.buildProgress / this.buildTime : 1;
  }

  addToStorage(resourceType: string, quantity: number): number {
    const freeSpace = this.storageCapacity - this.storageUsed;
    const toAdd = Math.min(quantity, freeSpace);
    if (toAdd <= 0) return 0;

    const existing = this.storage.find(s => s.resourceType === resourceType);
    if (existing) {
      existing.quantity += toAdd;
    } else {
      this.storage.push({ resourceType, quantity: toAdd });
    }
    return toAdd;
  }

  removeFromStorage(resourceType: string, quantity: number): number {
    const item = this.storage.find(s => s.resourceType === resourceType);
    if (!item) return 0;
    const toRemove = Math.min(quantity, item.quantity);
    item.quantity -= toRemove;
    if (item.quantity <= 0) {
      this.storage = this.storage.filter(s => s.resourceType !== resourceType);
    }
    return toRemove;
  }

  getStorageAmount(resourceType: string): number {
    const item = this.storage.find(s => s.resourceType === resourceType);
    return item ? item.quantity : 0;
  }

  get storageUsed(): number {
    return this.storage.reduce((sum, s) => sum + s.quantity, 0);
  }

  get isFull(): boolean {
    return this.storageCapacity > 0 && this.storageUsed >= this.storageCapacity;
  }

  damage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  repair(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  serialize(): object {
    return {
      ...super.serialize(),
      buildingType: this.buildingType,
      hp: this.hp,
      maxHp: this.maxHp,
      built: this.built,
      buildProgress: this.buildProgress,
      buildTime: this.buildTime,
      requires: this.requires,
      requiresConsumed: this.requiresConsumed,
      storage: this.storage,
      storageCapacity: this.storageCapacity,
      produceType: this.produceType,
      produceRate: this.produceRate,
      produceInterval: this.produceInterval,
      produceTimer: this.produceTimer,
      attackDamage: this.attackDamage,
      attackRange: this.attackRange,
      attackInterval: this.attackInterval,
      attackCooldown: this.attackCooldown,
    };
  }

  static deserialize(data: any): Building {
    const b = new Building(
      data.x, data.y, data.buildingType,
      data.maxHp, data.buildTime, data.requires || []
    );
    b.id = data.id;
    b.hp = data.hp;
    b.built = data.built;
    b.buildProgress = data.buildProgress ?? 0;
    b.requiresConsumed = data.requiresConsumed ?? false;
    b.storage = data.storage ?? [];
    b.storageCapacity = data.storageCapacity ?? 0;
    b.produceType = data.produceType ?? '';
    b.produceRate = data.produceRate ?? 0;
    b.produceInterval = data.produceInterval ?? 0;
    b.produceTimer = data.produceTimer ?? 0;
    b.attackDamage = data.attackDamage ?? 0;
    b.attackRange = data.attackRange ?? 0;
    b.attackInterval = data.attackInterval ?? 0;
    b.attackCooldown = data.attackCooldown ?? 0;
    b.fireFlash = data.fireFlash ?? 0;
    return b;
  }
}
