import { Entity } from '../core/Entity';

export class Resource extends Entity {
  resourceType: string;
  quantity: number;

  constructor(x: number, y: number, resourceType: string, quantity: number) {
    super('resource', x, y);
    this.resourceType = resourceType;
    this.quantity = quantity;
  }

  harvest(amount: number): number {
    const taken = Math.min(amount, this.quantity);
    this.quantity -= taken;
    return taken;
  }

  get depleted(): boolean {
    return this.quantity <= 0;
  }

  serialize(): object {
    return {
      ...super.serialize(),
      resourceType: this.resourceType,
      quantity: this.quantity,
    };
  }

  static deserialize(data: any): Resource {
    const r = new Resource(data.x, data.y, data.resourceType, data.quantity);
    r.id = data.id;
    return r;
  }
}
