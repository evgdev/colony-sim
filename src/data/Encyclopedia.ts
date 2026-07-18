import plantsData from './plants.json';

const SAVE_KEY = 'colony-sim-encyclopedia';

export interface EncyclopediaEntry {
  id: string;
  discoveredAt: number; // tick when discovered
}

export class Encyclopedia {
  private discovered: Map<string, EncyclopediaEntry> = new Map();

  constructor() {
    this.load();
  }

  discover(plantId: string, tickCount: number): boolean {
    if (this.discovered.has(plantId)) return false;

    this.discovered.set(plantId, {
      id: plantId,
      discoveredAt: tickCount,
    });
    this.save();
    return true;
  }

  isDiscovered(plantId: string): boolean {
    return this.discovered.has(plantId);
  }

  getDiscovered(): EncyclopediaEntry[] {
    return Array.from(this.discovered.values());
  }

  getDiscoveryCount(): number {
    return this.discovered.size;
  }

  getTotalPlants(): number {
    return Object.keys(plantsData).length;
  }

  getPlantInfo(plantId: string): any {
    return (plantsData as any)[plantId] ?? null;
  }

  getAllPlantIds(): string[] {
    return Object.keys(plantsData);
  }

  private save(): void {
    const data = Array.from(this.discovered.entries());
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  private load(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as [string, EncyclopediaEntry][];
      this.discovered = new Map(data);
    } catch {
      // ignore corrupt save
    }
  }

  reset(): void {
    this.discovered.clear();
    localStorage.removeItem(SAVE_KEY);
  }
}
