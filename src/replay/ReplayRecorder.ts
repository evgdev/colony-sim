import { Simulation } from '../core/Simulation';
import { ReplayAction, ReplayActionType, ReplayFile, ReplaySnapshot } from './ReplayTypes';

const STORAGE_KEY = 'colony-sim-replays';
const MAX_REPLAYS = 10;

interface StoredReplay {
  id: string;
  name: string;
  data: ReplayFile;
}

export class ReplayRecorder {
  private actions: ReplayAction[] = [];
  private simulation: Simulation;
  private seed: number;
  private recording: boolean = false;

  constructor(simulation: Simulation) {
    this.simulation = simulation;
    this.seed = simulation.seed;
  }

  start(): void {
    this.recording = true;
    this.actions = [];
  }

  stop(): void {
    this.recording = false;
  }

  isRecording(): boolean {
    return this.recording;
  }

  onTick(_tickCount: number): void {}

  record(type: ReplayActionType, data: Record<string, number | string | boolean> = {}): void {
    if (!this.recording) return;
    this.actions.push({
      tick: this.simulation.tickCount,
      type,
      data,
    });
  }

  hasRecordedData(): boolean {
    return this.actions.length > 0;
  }

  export(): ReplayFile {
    return {
      version: 1,
      seed: this.seed,
      totalTicks: this.simulation.tickCount,
      actions: this.actions,
      snapshots: [],
    };
  }

  autoSave(): string | null {
    if (!this.hasRecordedData()) return null;

    const days = Math.floor(this.simulation.tickCount / 100);
    const hours = Math.floor((this.simulation.tickCount % 100) / (100 / 24));
    const id = `replay_${Date.now()}`;
    const name = `Day ${days} ${hours}h`;

    const stored: StoredReplay = {
      id,
      name,
      data: this.export(),
    };

    try {
      const replays = ReplayRecorder.loadStored();
      replays.unshift(stored);
      if (replays.length > MAX_REPLAYS) replays.length = MAX_REPLAYS;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(replays));
      return id;
    } catch (e) {
      console.warn('Failed to save replay to localStorage:', e);
      return null;
    }
  }

  exportToFile(id?: string): void {
    const data = id ? ReplayRecorder.loadById(id) : this.export();
    if (!data) return;

    const days = Math.floor(data.totalTicks / 100);
    const hours = Math.floor((data.totalTicks % 100) / (100 / 24));
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay_${days}d${hours}h_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private static loadStored(): StoredReplay[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static loadAll(): Array<{ id: string; name: string; totalTicks: number }> {
    return ReplayRecorder.loadStored().map(r => ({
      id: r.id,
      name: r.name,
      totalTicks: r.data.totalTicks,
    }));
  }

  static loadById(id: string): ReplayFile | null {
    const stored = ReplayRecorder.loadStored().find(r => r.id === id);
    return stored?.data ?? null;
  }

  static deleteById(id: string): void {
    const replays = ReplayRecorder.loadStored().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(replays));
  }

  static loadFromJson(json: string): ReplayFile | null {
    try {
      const data = JSON.parse(json) as ReplayFile;
      if (data.version === 1 && data.actions) {
        const stored: StoredReplay = {
          id: `import_${Date.now()}`,
          name: `Import ${new Date().toLocaleDateString('ru-RU')}`,
          data,
        };
        const replays = ReplayRecorder.loadStored();
        replays.unshift(stored);
        if (replays.length > MAX_REPLAYS) replays.length = MAX_REPLAYS;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(replays));
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }
}
