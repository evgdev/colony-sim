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
  size: number = 1;

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
  damageFlash: number = 0;

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
    const base = super.serialize() as any;
    return {
      i: base.id,
      t: 'building',
      x: base.x,
      y: base.y,
      bt: this.buildingType,
      hp: this.hp,
      mhp: this.maxHp,
      b: this.built,
      bp: this.buildProgress,
      bt2: this.buildTime,
      req: this.requires.length > 0 ? this.requires : undefined,
      rc: this.requiresConsumed || undefined,
      st: this.storage.length > 0 ? this.storage : undefined,
      sc: this.storageCapacity || undefined,
      pt: this.produceType || undefined,
      pr: this.produceRate || undefined,
      pi: this.produceInterval || undefined,
      pt2: this.produceTimer || undefined,
      ad: this.attackDamage || undefined,
      ar: this.attackRange || undefined,
      ai: this.attackInterval || undefined,
      ac: this.attackCooldown || undefined,
    };
  }

  static deserialize(data: any): Building {
    const b = new Building(
      data.x, data.y,
      data.bt ?? data.buildingType,
      data.mhp ?? data.maxHp ?? 100,
      data.bt2 ?? data.buildTime ?? 10,
      data.req ?? data.requires ?? []
    );
    b.id = data.i ?? data.id;
    b.hp = data.hp ?? 100;
    b.built = data.b ?? data.built ?? false;
    b.buildProgress = data.bp ?? data.buildProgress ?? 0;
    b.requiresConsumed = data.rc ?? data.requiresConsumed ?? false;
    b.storage = data.st ?? data.storage ?? [];
    b.storageCapacity = data.sc ?? data.storageCapacity ?? 0;
    b.produceType = data.pt ?? data.produceType ?? '';
    b.produceRate = data.pr ?? data.produceRate ?? 0;
    b.produceInterval = data.pi ?? data.produceInterval ?? 0;
    b.produceTimer = data.pt2 ?? data.produceTimer ?? 0;
    b.attackDamage = data.ad ?? data.attackDamage ?? 0;
    b.attackRange = data.ar ?? data.attackRange ?? 0;
    b.attackInterval = data.ai ?? data.attackInterval ?? 0;
    b.attackCooldown = data.ac ?? data.attackCooldown ?? 0;
    b.snapVisual();
    return b;
  }
}
