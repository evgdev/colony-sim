import { Entity } from '../core/Entity';

export class Artifact extends Entity {
  artifactType: string;
  name: string;

  constructor(x: number, y: number, artifactType: string, name: string) {
    super('artifact', x, y);
    this.artifactType = artifactType;
    this.name = name;
  }

  serialize(): object {
    const base = super.serialize() as any;
    return {
      i: base.i,
      t: 'artifact',
      x: base.x,
      y: base.y,
      at: this.artifactType,
      n: this.name,
    };
  }

  static deserialize(data: any): Artifact {
    const a = new Artifact(data.x, data.y, data.at ?? data.artifactType, data.n ?? data.name);
    a.id = data.i ?? data.id;
    a.snapVisual();
    return a;
  }
}
