export type QuestStage = 'find_fragments' | 'find_components' | 'build_radio' | 'activate_beacon';

export interface QuestState {
  currentStage: QuestStage;
  fragmentsFound: number;
  fragmentsRequired: number;
  componentsFound: number;
  componentsRequired: number;
  radioBuilt: boolean;
  radioActivated: boolean;
  completed: boolean;
}

export interface QuestEvent {
  type: 'quest_progress' | 'quest_stage_complete' | 'quest_complete';
  message: string;
}

const QUEST_DATA: Record<QuestStage, { description: string; next: QuestStage | null }> = {
  find_fragments: { description: 'Find radio fragments', next: 'find_components' },
  find_components: { description: 'Find components', next: 'build_radio' },
  build_radio: { description: 'Build radio', next: 'activate_beacon' },
  activate_beacon: { description: 'Activate beacon', next: null },
};

export class QuestSystem {
  private state: QuestState;
  private eventCallback: ((event: QuestEvent) => void) | null = null;

  constructor() {
    this.state = {
      currentStage: 'find_fragments',
      fragmentsFound: 0,
      fragmentsRequired: 3,
      componentsFound: 0,
      componentsRequired: 5,
      radioBuilt: false,
      radioActivated: false,
      completed: false,
    };
  }

  onEvent(callback: (event: QuestEvent) => void): void {
    this.eventCallback = callback;
  }

  private emit(type: QuestEvent['type'], message: string): void {
    this.eventCallback?.({ type, message });
  }

  getState(): QuestState {
    return { ...this.state };
  }

  onFragmentFound(): void {
    if (this.state.currentStage !== 'find_fragments' || this.state.completed) return;
    this.state.fragmentsFound++;
    this.emit('quest_progress', `Fragment found (${this.state.fragmentsFound}/${this.state.fragmentsRequired})`);
    if (this.state.fragmentsFound >= this.state.fragmentsRequired) {
      this.state.currentStage = 'find_components';
      this.emit('quest_stage_complete', 'All fragments collected! Now find components.');
    }
  }

  onComponentFound(): void {
    if (this.state.currentStage !== 'find_components' || this.state.completed) return;
    this.state.componentsFound++;
    this.emit('quest_progress', `Component found (${this.state.componentsFound}/${this.state.componentsRequired})`);
    if (this.state.componentsFound >= this.state.componentsRequired) {
      this.state.currentStage = 'build_radio';
      this.emit('quest_stage_complete', 'All components collected! Now build the radio.');
    }
  }

  onRadioBuilt(): void {
    if (this.state.currentStage !== 'build_radio' || this.state.completed) return;
    this.state.radioBuilt = true;
    this.state.currentStage = 'activate_beacon';
    this.emit('quest_stage_complete', 'Radio built! Now activate the beacon.');
  }

  onRadioActivated(): void {
    if (this.state.currentStage !== 'activate_beacon' || this.state.completed) return;
    this.state.radioActivated = true;
    this.state.completed = true;
    this.emit('quest_complete', 'Beacon activated! Rescue incoming!');
  }

  getStageDescription(): string {
    return QUEST_DATA[this.state.currentStage].description;
  }

  getProgressText(): string {
    switch (this.state.currentStage) {
      case 'find_fragments':
        return `Fragments: ${this.state.fragmentsFound}/${this.state.fragmentsRequired}`;
      case 'find_components':
        return `Components: ${this.state.componentsFound}/${this.state.componentsRequired}`;
      case 'build_radio':
        return 'Build radio at base';
      case 'activate_beacon':
        return 'Activate the beacon';
      default:
        return 'Quest complete!';
    }
  }

  serialize(): object {
    return { ...this.state };
  }

  static deserialize(data: any): QuestSystem {
    const qs = new QuestSystem();
    qs.state = { ...qs.state, ...data };
    return qs;
  }
}
