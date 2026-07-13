import { Simulation } from '../core/Simulation';
import { ReplayAction, ReplayActionType, ReplayFile, ReplaySnapshot } from './ReplayTypes';

const replayIndex: Map<string, ReplayFile> = new Map();

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

  autoSave(): void {
    if (!this.hasRecordedData()) return;

    const days = Math.floor(this.simulation.tickCount / 100);
    const hours = Math.floor((this.simulation.tickCount % 100) / (100 / 24));
    const id = `replay_${Date.now()}`;

    const data = this.export();
    replayIndex.set(id, data);

    const json = JSON.stringify(data);
    this.downloadFile(json, `replay_${days}d${hours}h_${Date.now()}.json`);
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  static loadAll(): Array<{ id: string; name: string; totalTicks: number }> {
    const result: Array<{ id: string; name: string; totalTicks: number }> = [];
    for (const [id, data] of replayIndex) {
      const days = Math.floor(data.totalTicks / 100);
      const hours = Math.floor((data.totalTicks % 100) / (100 / 24));
      result.push({
        id,
        name: `Day ${days} ${hours}h`,
        totalTicks: data.totalTicks,
      });
    }
    return result;
  }

  static loadById(id: string): ReplayFile | null {
    return replayIndex.get(id) ?? null;
  }

  static deleteById(id: string): void {
    replayIndex.delete(id);
  }

  static loadFromJson(json: string): ReplayFile | null {
    try {
      const data = JSON.parse(json) as ReplayFile;
      if (data.version === 1 && data.actions) {
        const id = `import_${Date.now()}`;
        replayIndex.set(id, data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }
}
