export type StoryBranch = 'warrior' | 'scientist' | null;

export interface BranchConfig {
  unlockedBuildings: string[];
  questChain: string[];
  dinoBehavior: 'aggressive' | 'passive';
  finalQuest: string;
  title: string;
  description: string;
}

export const BRANCH_CONFIGS: Record<string, BranchConfig> = {
  warrior: {
    unlockedBuildings: ['wall', 'gate', 'house', 'farm', 'warehouse', 'turret', 'workshop', 'radio'],
    questChain: ['q1_1', 'q1_2', 'q1_3', 'qw_1', 'qw_2', 'qw_3', 'qw_4', 'qw_5'],
    dinoBehavior: 'aggressive',
    finalQuest: 'qw_5',
    title: 'Воин',
    description: 'Мы сильнее. Мы выживем.',
  },
  scientist: {
    unlockedBuildings: ['wall', 'gate', 'house', 'farm', 'warehouse', 'lab', 'workshop', 'radio', 'tracker'],
    questChain: ['q1_1', 'q1_2', 'q1_3', 'qs_1', 'qs_2', 'qs_3', 'qs_4', 'qs_5', 'qs_6'],
    dinoBehavior: 'passive',
    finalQuest: 'qs_6',
    title: 'Учёный',
    description: 'Мы понимаем. Мы найдём ответ.',
  },
};

const BRANCH_SAVE_KEY = 'colony-sim-branch';

export class StoryBranchManager {
  private currentBranch: StoryBranch = null;

  constructor() {
    this.load();
  }

  setBranch(branch: StoryBranch): void {
    this.currentBranch = branch;
    this.save();
  }

  getBranch(): StoryBranch {
    return this.currentBranch;
  }

  getBranchConfig(): BranchConfig | null {
    if (!this.currentBranch) return null;
    return BRANCH_CONFIGS[this.currentBranch] ?? null;
  }

  isWarrior(): boolean {
    return this.currentBranch === 'warrior';
  }

  isScientist(): boolean {
    return this.currentBranch === 'scientist';
  }

  isDinoBehaviorAggressive(): boolean {
    return this.getBranchConfig()?.dinoBehavior === 'aggressive';
  }

  isBuildingUnlocked(buildingType: string): boolean {
    const config = this.getBranchConfig();
    if (!config) return true; // default: all unlocked
    return config.unlockedBuildings.includes(buildingType);
  }

  private save(): void {
    localStorage.setItem(BRANCH_SAVE_KEY, JSON.stringify(this.currentBranch));
  }

  private load(): void {
    const raw = localStorage.getItem(BRANCH_SAVE_KEY);
    if (!raw) return;
    try {
      this.currentBranch = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  reset(): void {
    this.currentBranch = null;
    localStorage.removeItem(BRANCH_SAVE_KEY);
  }
}
