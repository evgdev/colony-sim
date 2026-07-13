import { Entity } from './Entity';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Artifact } from '../entities/Artifact';

export class EntityManager {
  private entities: Map<number, Entity> = new Map();

  add(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  remove(id: number): void {
    this.entities.delete(id);
  }

  get(id: number): Entity | undefined {
    return this.entities.get(id);
  }

  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }

  getByType(type: string): Entity[] {
    return this.getAll().filter(e => e.entityType === type);
  }

  getAt(x: number, y: number): Entity | undefined {
    return this.getAll().find(e => e.x === x && e.y === y);
  }

  serialize(): object[] {
    return this.getAll().map(e => e.serialize());
  }

  static deserialize(data: any[]): EntityManager {
    const manager = new EntityManager();
    for (const d of data) {
      let entity: Entity;
      switch (d.entityType) {
        case 'settler':
          entity = Settler.deserialize(d);
          break;
        case 'resource':
          entity = Resource.deserialize(d);
          break;
        case 'building':
          entity = Building.deserialize(d);
          break;
        case 'dinosaur':
          entity = Dinosaur.deserialize(d);
          break;
        case 'artifact':
          entity = Artifact.deserialize(d);
          break;
        default:
          entity = Entity.deserialize(d);
          break;
      }
      manager.add(entity);
    }
    return manager;
  }
}
