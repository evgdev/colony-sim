import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { TileGrid } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { MAP_WIDTH, FOG_REVEAL_RADIUS } from '../config';
import buildingsData from '../data/buildings.json';

export interface WorldConfig {
  centerX: number;
  centerY: number;
  settlers: Settler[];
}

export function createInitialWorld(simulation: Simulation): WorldConfig {
  const centerX = Math.floor(MAP_WIDTH / 2);
  const centerY = Math.floor(MAP_WIDTH / 2);

  // Find nearest walkable tile to center (not water)
  const findSpawn = (ox: number, oy: number): { x: number; y: number } => {
    for (let r = 0; r < 15; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = ox + dx;
          const ty = oy + dy;
          const tile = simulation.tileGrid.get(tx, ty);
          if (tile && tile.walkable && tile.type !== 'water') {
            return { x: tx, y: ty };
          }
        }
      }
    }
    return { x: ox, y: oy };
  };

  const spawn = findSpawn(centerX, centerY);

  const settlers = [
    new Settler(spawn.x - 1, spawn.y, 'Алексей', 0x4488ff, 'engineer'),
    new Settler(spawn.x, spawn.y, 'Марина', 0x44ff44, 'biologist'),
    new Settler(spawn.x + 1, spawn.y, 'Дмитрий', 0xffaa00, 'pilot'),
  ];

  // Ensure all settlers are on walkable tiles
  for (const s of settlers) {
    const tile = simulation.tileGrid.get(s.x, s.y);
    if (!tile || !tile.walkable || tile.type === 'water') {
      const safe = findSpawn(s.x, s.y);
      s.x = safe.x;
      s.y = safe.y;
      s.snapVisual();
    }
    simulation.entityManager.add(s);
    simulation.tileGrid.setOccupied(s.x, s.y, true);
  }
  simulation.tileGrid.reveal(spawn.x, spawn.y, FOG_REVEAL_RADIUS);

  const resources = [
    { x: centerX - 2, y: centerY - 1, type: 'wood', qty: 20 },
    { x: centerX + 2, y: centerY - 1, type: 'stone', qty: 15 },
    { x: centerX - 1, y: centerY + 2, type: 'wood', qty: 10 },
    { x: centerX + 1, y: centerY + 2, type: 'stone', qty: 8 },
    { x: centerX, y: centerY - 3, type: 'wood', qty: 12 },
    { x: centerX, y: centerY + 3, type: 'stone', qty: 10 },
  ];

  for (const r of resources) {
    const tile = simulation.tileGrid.get(r.x, r.y);
    if (!tile || !tile.walkable || tile.type === 'water') continue;
    const res = new Resource(r.x, r.y, r.type, r.qty);
    simulation.entityManager.add(res);
  }

  return { centerX: spawn.x, centerY: spawn.y, settlers };
}

export function buildStartingPerimeter(
  simulation: Simulation,
  artifactSystem: ArtifactSystem,
): void {
  const settlers = simulation.entityManager.getByType('settler') as Settler[];
  if (settlers.length === 0) return;

  let minX = Math.min(...settlers.map(s => s.x));
  let maxX = Math.max(...settlers.map(s => s.x));
  let minY = Math.min(...settlers.map(s => s.y));
  let maxY = Math.max(...settlers.map(s => s.y));
  const margin = 3;
  minX = Math.max(0, minX - margin);
  maxX = Math.min(MAP_WIDTH - 1, maxX + margin);
  minY = Math.max(0, minY - margin);
  maxY = Math.min(MAP_WIDTH - 1, maxY + margin);

  const wallDef = (buildingsData as any).wall;
  const gateDef = (buildingsData as any).gate;

  const findFreeInterior = (): { x: number; y: number } | null => {
    for (let y = minY + 1; y < maxY; y++) {
      for (let x = minX + 1; x < maxX; x++) {
        const t = simulation.tileGrid.get(x, y);
        if (!t || !t.walkable || t.occupied) continue;
        if (simulation.entityManager.getAt(x, y)) continue;
        return { x, y };
      }
    }
    return null;
  };

  const placePerimeter = (x: number, y: number, isGate: boolean) => {
    const tile = simulation.tileGrid.get(x, y);
    if (!tile || !tile.walkable) return;

    const occupant = simulation.entityManager.getAt(x, y);
    if (occupant && occupant.entityType === 'settler') return;
    if (occupant && occupant.entityType === 'resource') {
      const spot = findFreeInterior();
      if (spot) {
        (occupant as Resource).moveTo(spot.x, spot.y);
        (occupant as Resource).snapVisual();
        simulation.tileGrid.setOccupied(spot.x, spot.y, true);
      } else {
        simulation.entityManager.remove(occupant.id);
      }
      simulation.tileGrid.setOccupied(x, y, false);
    }

    const def = isGate ? gateDef : wallDef;
    const b = new Building(x, y, isGate ? 'gate' : 'wall', def.maxHp, def.buildTime, []);
    b.hp = def.maxHp;
    b.built = true;
    b.buildProgress = def.buildTime;
    b.requiresConsumed = true;
    b.storageCapacity = def.storageCapacity ? def.storageCapacity + artifactSystem.getStorageBonus() : 0;
    simulation.entityManager.add(b);
    simulation.tileGrid.reveal(x, y, 1);
    simulation.tileGrid.setBuilding(x, y, true);
    if (isGate) {
      simulation.tileGrid.setGate(x, y, true);
      simulation.tileGrid.setDinoBlocked(x, y, true);
    } else {
      simulation.tileGrid.setOccupied(x, y, true);
    }
  };

  const gateX = Math.floor((minX + maxX) / 2);
  const gateY = maxY;

  for (let x = minX; x <= maxX; x++) {
    placePerimeter(x, minY, false);
    placePerimeter(x, maxY, x === gateX);
  }
  for (let y = minY + 1; y < maxY; y++) {
    placePerimeter(minX, y, false);
    placePerimeter(maxX, y, false);
  }
}
