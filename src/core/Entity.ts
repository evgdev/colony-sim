let nextId = 1;

export class Entity {
  id: number;
  entityType: string;
  x: number;
  y: number;

  constructor(entityType: string, x: number, y: number) {
    this.id = nextId++;
    this.entityType = entityType;
    this.x = x;
    this.y = y;
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  serialize(): object {
    return {
      id: this.id,
      entityType: this.entityType,
      x: this.x,
      y: this.y,
    };
  }

  static nextId(): number {
    return nextId;
  }

  static setNextId(id: number): void {
    nextId = id;
  }

  static deserialize(data: any): Entity {
    const e = new Entity(data.entityType, data.x, data.y);
    e.id = data.id;
    if (data.id >= nextId) nextId = data.id + 1;
    return e;
  }
}
