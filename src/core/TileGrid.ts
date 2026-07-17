export type TileType = 'grass' | 'dirt' | 'water' | 'stone' | 'sand';

export interface BiomeBlend {
  primary: TileType;
  secondary: TileType;
  ratio: number;
}

export interface TileData {
  type: TileType;
  walkCost: number;
  walkable: boolean;
  blend?: BiomeBlend;
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
  fogAlpha: number[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.revealed = [];
    this.fogAlpha = [];
    for (let y = 0; y < height; y++) {
      const row: TileState[] = [];
      const revRow: boolean[] = [];
      const fogRow: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          type: 'grass', walkCost: 1, walkable: true,
          blend: { primary: 'grass', secondary: 'grass', ratio: 0 },
          x, y, occupied: false, dinoBlocked: false, gate: false, building: false,
        });
        revRow.push(false);
        fogRow.push(0);
      }
      this.tiles.push(row);
      this.revealed.push(revRow);
      this.fogAlpha.push(fogRow);
    }
  }

  get(x: number, y: number): TileState | null {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return null;
    return this.tiles[iy][ix];
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

  setOccupiedArea(x: number, y: number, size: number, occupied: boolean): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        this.setOccupied(ix + dx, iy + dy, occupied);
      }
    }
  }

  isAreaWalkable(x: number, y: number, size: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const tile = this.get(ix + dx, iy + dy);
        if (!tile || !tile.walkable || tile.occupied) return false;
      }
    }
    return true;
  }

  isAreaWalkableForDino(x: number, y: number, size: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const tile = this.get(ix + dx, iy + dy);
        if (!tile || !tile.walkable || tile.type === 'water' || tile.occupied || tile.dinoBlocked || tile.building) return false;
      }
    }
    return true;
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
    return tile !== null && tile.walkable && tile.type !== 'water' && !tile.occupied && !tile.dinoBlocked && !tile.building;
  }

  isRevealed(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
    return this.revealed[iy]?.[ix] ?? false;
  }

  getFogAlpha(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return 1;
    return 1 - (this.fogAlpha[iy]?.[ix] ?? 1);
  }

  reveal(cx: number, cy: number, radius: number): void {
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    const r = Math.floor(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = icx + dx;
        const y = icy + dy;
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          if (!this.revealed[y][x]) {
            this.fogAlpha[y][x] = 0;
          }
          this.revealed[y][x] = true;
        }
      }
    }
  }

  updateFog(deltaMs: number): void {
    const fadeSpeed = 0.004;
    const step = fadeSpeed * deltaMs;
    for (let y = 0; y < this.height; y++) {
      if (!this.revealed[y] || !this.fogAlpha[y]) continue;
      for (let x = 0; x < this.width; x++) {
        if (this.revealed[y][x] && this.fogAlpha[y][x] < 1) {
          this.fogAlpha[y][x] = Math.min(1, this.fogAlpha[y][x] + step);
        }
      }
    }
  }

  serialize(): object {
    const tileMap: Record<string, string> = { grass: 'g', dirt: 'd', water: 'w', stone: 's', sand: 'a' };
    const tiles: string[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        let flags = tileMap[t.type] || 'g';
        if (t.occupied) flags += 'O';
        if (t.building) flags += 'B';
        if (t.gate) flags += 'G';
        if (t.dinoBlocked) flags += 'D';
        tiles.push(flags);
      }
    }
    const revealed: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.revealed[y]?.[x]) revealed.push(y * this.width + x);
      }
    }
    return {
      w: this.width,
      h: this.height,
      t: tiles.join(','),
      r: revealed,
    };
  }

  static deserialize(data: any): TileGrid {
    const w = data.w ?? data.width;
    const h = data.h ?? data.height;
    const grid = new TileGrid(w, h);

    const typeMap: Record<string, TileType> = { g: 'grass', d: 'dirt', w: 'water', s: 'stone', a: 'sand' };

    if (data.t && typeof data.t === 'string') {
      const tiles = data.t.split(',');
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const code = tiles[y * w + x] || 'g';
          const type = typeMap[code.charAt(0)] || 'grass';
          const occupied = code.includes('O');
          const building = code.includes('B');
          const gate = code.includes('G');
          const dinoBlocked = code.includes('D');
          const walkable = type !== 'water';
          const walkCost = type === 'stone' ? 2 : 1;
          grid.tiles[y][x] = { type, walkCost, walkable, x, y, occupied, dinoBlocked, gate, building };
        }
      }
    } else if (data.tiles) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
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
    }

    if (data.r && Array.isArray(data.r)) {
      for (const idx of data.r) {
        const y = Math.floor(idx / w);
        const x = idx % w;
        if (y < h && x < w) {
          grid.revealed[y][x] = true;
          grid.fogAlpha[y][x] = 1;
        }
      }
    } else if (data.revealed) {
      const src = data.revealed;
      if (Array.isArray(src) && src.length > 0 && Array.isArray(src[0])) {
        grid.revealed = src;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            grid.fogAlpha[y][x] = grid.revealed[y]?.[x] ? 1 : 0;
          }
        }
      } else if (Array.isArray(src)) {
        for (let i = 0; i < src.length; i++) {
          const ry = Math.floor(i / w);
          const rx = i % w;
          if (ry < h && rx < w && src[i]) {
            grid.revealed[ry][rx] = true;
            grid.fogAlpha[ry][rx] = 1;
          }
        }
      }
    }

    return grid;
  }
}
