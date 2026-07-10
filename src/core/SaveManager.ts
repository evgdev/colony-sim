import { Simulation } from './Simulation';

const SAVE_KEY = 'colony-sim-save';

export class SaveManager {
  static save(simulation: Simulation): void {
    const state = simulation.serialize();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  static load(): Simulation | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return Simulation.deserialize(data);
    } catch {
      return null;
    }
  }

  static hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  static deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  static exportToFile(simulation: Simulation): void {
    const state = simulation.serialize();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'colony-sim-save.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  static async importFromFile(): Promise<Simulation | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const text = await file.text();
        try {
          const data = JSON.parse(text);
          resolve(Simulation.deserialize(data));
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  }
}
