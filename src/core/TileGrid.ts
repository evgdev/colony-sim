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
  dinoBlocked: boolean;
  gate: boolean;
  building: boolean;
}

export class TileGrid {
  width: number;
  height: number;
  tiles: TileState[][];
  revealed: boolean[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.revealed = [];
    for (let y = 0; y < height; y++) {
      const row: TileState[] = [];
      const revRow: boolean[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ type: 'grass', walkCost: 1, walkable: true, x, y, occupied: false, dinoBlocked: false, gate: false, building: false });
        revRow.push(false);
      }
      this.tiles.push(row);
      this.revealed.push(revRow);
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

  setDinoBlocked(x: number, y: number, blocked: boolean): void {
    const tile = this.get(x, y);
    if (tile) tile.dinoBlocked = blocked;
  }

  setGate(x: number, y: number, gate: boolean): void {
    const tile = this.get(x, y);
    if (tile) tile.gate = gate;
  }

  setBuilding(x: number, y: number, building: boolean): void {
    const tile = this.get(x, y);
    if (tile) tile.building = building;
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.get(x, y);
    return tile !== null && tile.walkable && !tile.occupied;
  }

  isWalkableForDino(x: number, y: number): boolean {
    const tile = this.get(x, y);
    return tile !== null && tile.walkable && !tile.occupied && !tile.dinoBlocked;
  }

  isRevealed(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.revealed[y][x];
  }

  reveal(cx: number, cy: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          this.revealed[y][x] = true;
        }
      }
    }
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
        dinoBlocked: t.dinoBlocked,
        gate: t.gate,
        building: t.building,
      }))),
      revealed: this.revealed,
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
          dinoBlocked: saved.dinoBlocked ?? false,
          gate: saved.gate ?? false,
          building: saved.building ?? false,
          x,
          y,
        };
      }
    }
    if (data.revealed) {
      grid.revealed = data.revealed;
    }
    return grid;
  }
}
