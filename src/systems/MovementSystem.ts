import { TileGrid, TileType } from '../core/TileGrid';
import { EntityManager } from '../core/EntityManager';
import { Entity } from '../core/Entity';
import { FOG_REVEAL_RADIUS } from '../config';
import tilesData from '../data/tiles.json';

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

export class MovementSystem {
  private tileGrid: TileGrid;

  constructor(tileGrid: TileGrid) {
    this.tileGrid = tileGrid;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] {
    const openList: AStarNode[] = [];
    const closedSet = new Set<string>();

    const startNode: AStarNode = {
      x: startX, y: startY,
      g: 0, h: this.heuristic(startX, startY, endX, endY),
      f: 0, parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openList.push(startNode);

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;

      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }

      closedSet.add(`${current.x},${current.y}`);

      for (const neighbor of this.getNeighbors(current.x, current.y)) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (closedSet.has(key)) continue;

        const tile = this.tileGrid.get(neighbor.x, neighbor.y);
        if (!tile || !tile.walkable) continue;

        const isEnd = neighbor.x === endX && neighbor.y === endY;
        if (!isEnd && (tile.occupied || tile.building) && !tile.gate) continue;
        if (isEnd && tile.building) continue;

        const tileDef = (tilesData as Record<string, any>)[tile.type];
        const moveCost = tileDef ? tileDef.walkCost : 1;
        const tentativeG = current.g + moveCost;

        const existing = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);
        if (existing && tentativeG >= existing.g) continue;

        const node: AStarNode = {
          x: neighbor.x, y: neighbor.y,
          g: tentativeG,
          h: this.heuristic(neighbor.x, neighbor.y, endX, endY),
          f: 0,
          parent: current,
        };
        node.f = node.g + node.h;

        if (existing) {
          existing.g = node.g;
          existing.h = node.h;
          existing.f = node.f;
          existing.parent = current;
        } else {
          openList.push(node);
        }
      }
    }

    return [];
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  private getNeighbors(x: number, y: number): { x: number; y: number }[] {
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    return dirs.map(d => ({ x: x + d.x, y: y + d.y }));
  }

  private reconstructPath(node: AStarNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: AStarNode | null = node;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  }

  stepAlongPath(entity: Entity, path: { x: number; y: number }[], pathIndex: number): number {
    if (pathIndex >= path.length) return pathIndex;

    const target = path[pathIndex];
    const tx = Math.floor(target.x);
    const ty = Math.floor(target.y);
    const walkable = this.tileGrid.get(tx, ty)?.walkable ?? false;
    if (!walkable) return pathIndex;

    const oldTile = this.tileGrid.get(entity.x, entity.y);
    if (!oldTile?.building) {
      this.tileGrid.setOccupied(entity.x, entity.y, false);
    }
    entity.moveTo(tx, ty);
    const fogBonus = (entity as any).getFogRadiusBonus?.() ?? 0;
    this.tileGrid.reveal(tx, ty, FOG_REVEAL_RADIUS + fogBonus);
    const targetTile = this.tileGrid.get(tx, ty);
    if (!targetTile?.gate && !targetTile?.building) {
      this.tileGrid.setOccupied(tx, ty, true);
    }
    return pathIndex + 1;
  }
}
