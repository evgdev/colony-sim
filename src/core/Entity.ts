export class Entity {
  private static nextIdCounter = 1;
  id: number;
  entityType: string;
  x: number;
  y: number;

  visualX: number;
  visualY: number;

  constructor(entityType: string, x: number, y: number) {
    this.id = Entity.nextIdCounter++;
    this.entityType = entityType;
    this.x = x;
    this.y = y;
    this.visualX = x;
    this.visualY = y;
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  updateVisual(deltaMs: number, tilesPerMs: number): void {
    const dx = this.x - this.visualX;
    const dy = this.y - this.visualY;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist < 0.005) {
      this.visualX = this.x;
      this.visualY = this.y;
      return;
    }
    const step = tilesPerMs * deltaMs;
    if (step >= dist) {
      this.visualX = this.x;
      this.visualY = this.y;
    } else {
      const ratio = step / dist;
      this.visualX += dx * ratio;
      this.visualY += dy * ratio;
    }
  }

  snapVisual(): void {
    this.visualX = this.x;
    this.visualY = this.y;
  }

  serialize(): object {
    return {
      i: this.id,
      t: this.entityType,
      x: this.x,
      y: this.y,
    };
  }

  static nextId(): number {
    return Entity.nextIdCounter;
  }

  static setNextId(id: number): void {
    Entity.nextIdCounter = id;
  }

  static resetIdCounter(start: number = 1): void {
    Entity.nextIdCounter = start;
  }

  static deserialize(data: any): Entity {
    const entityType = data.t ?? data.entityType;
    const e = new Entity(entityType, data.x, data.y);
    e.id = data.i ?? data.id;
    e.snapVisual();
    const id = e.id;
    if (id >= Entity.nextIdCounter) Entity.nextIdCounter = id + 1;
    return e;
  }
}
