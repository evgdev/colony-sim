export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = (seed | 0) || 1;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) / 4294967296);
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  fork(subSeed: number): SeededRandom {
    return new SeededRandom(this.state ^ (subSeed * 2654435761));
  }
}

export enum ReplayActionType {
  Scroll = 'scroll',
  SelectSettler = 'select_settler',
  MoveSettler = 'move_settler',
  Build = 'build',
  Collect = 'collect',
  ToggleBuildMode = 'toggle_build',
  MinimapClick = 'minimap_click',
  CancelBuild = 'cancel_build',
}

export interface ReplayAction {
  tick: number;
  type: ReplayActionType;
  data: Record<string, number | string | boolean>;
}

export interface ReplaySnapshot {
  tick: number;
  state: any;
}

export interface ReplayFile {
  version: 1;
  seed: number;
  totalTicks: number;
  actions: ReplayAction[];
  snapshots: ReplaySnapshot[];
}
