export type TileType = 'grass' | 'dirt' | 'water' | 'stone' | 'sand';

export interface TileData {
  type: TileType;
  walkCost: number;
  walkable: boolean;
}

export interface TileState extends TileData {
  x: number;
  y: number;
  occupied: boolean;
}

export class TileGrid {
  width: number;
  height: number;
  tiles: TileState[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    for (let y = 0; y < height; y++) {
      const row: TileState[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ type: 'grass', walkCost: 1, walkable: true, x, y, occupied: false });
      }
      this.tiles.push(row);
    }
  }

  get(x: number, y: number): TileState | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }

  setTile(x: number, y: number, data: Partial<TileData>): void {
    const tile = this.get(x, y);
    if (!tile) return;
    if (data.type !== undefined) tile.type = data.type;
    if (data.walkCost !== undefined) tile.walkCost = data.walkCost;
    if (data.walkable !== undefined) tile.walkable = data.walkable;
  }

  setOccupied(x: number, y: number, occupied: boolean): void {
    const tile = this.get(x, y);
    if (tile) tile.occupied = occupied;
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.get(x, y);
    return tile !== null && tile.walkable && !tile.occupied;
  }

  serialize(): object {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles.map(row => row.map(t => ({
        type: t.type,
        walkCost: t.walkCost,
        walkable: t.walkable,
        occupied: t.occupied,
      }))),
    };
  }

  static deserialize(data: any): TileGrid {
    const grid = new TileGrid(data.width, data.height);
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const saved = data.tiles[y][x];
        grid.tiles[y][x] = {
          type: saved.type,
          walkCost: saved.walkCost,
          walkable: saved.walkable,
          occupied: saved.occupied,
          x,
          y,
        };
      }
    }
    return grid;
  }
}
