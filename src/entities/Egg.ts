import { Entity } from '../core/Entity';

export class Egg extends Entity {
  species: string;
  collected: boolean = false;

  constructor(x: number, y: number, species: string) {
    super('egg', x, y);
    this.species = species;
  }

  collect(): boolean {
    if (this.collected) return false;
    this.collected = true;
    return true;
  }

  serialize(): object {
    const base = super.serialize() as any;
    return {
      i: base.i,
      t: 'egg',
      x: base.x,
      y: base.y,
      sp: this.species,
      c: this.collected,
    };
  }

  static deserialize(data: any): Egg {
    const e = new Egg(data.x, data.y, data.sp ?? data.species);
    e.id = data.i ?? data.id;
    e.collected = data.c ?? data.collected ?? false;
    e.snapVisual();
    return e;
  }
}
