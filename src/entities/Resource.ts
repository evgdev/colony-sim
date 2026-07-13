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
    const base = super.serialize() as any;
    return {
      i: base.i,
      t: 'resource',
      x: base.x,
      y: base.y,
      rt: this.resourceType,
      q: this.quantity,
    };
  }

  static deserialize(data: any): Resource {
    const r = new Resource(data.x, data.y, data.rt ?? data.resourceType, data.q ?? data.quantity);
    r.id = data.i ?? data.id;
    r.snapVisual();
    return r;
  }
}
