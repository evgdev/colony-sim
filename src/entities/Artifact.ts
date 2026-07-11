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
    return {
      ...super.serialize(),
      artifactType: this.artifactType,
      name: this.name,
    };
  }

  static deserialize(data: any): Artifact {
    const a = new Artifact(data.x, data.y, data.artifactType, data.name);
    a.id = data.id;
    return a;
  }
}
