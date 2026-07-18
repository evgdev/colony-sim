import questsData from '../data/quests.json';
import dialoguesData from '../data/dialogues.json';
import plantsData from '../data/plants.json';
import { EntityManager } from '../core/EntityManager';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Artifact } from '../entities/Artifact';
import { Simulation } from '../core/Simulation';
import { TileGrid } from '../core/TileGrid';
import { StoryBranch, StoryBranchManager } from '../data/storyBranch';

export type QuestType = 'gather' | 'build' | 'explore' | 'observe' | 'kill' | 'kill_melee' | 'survive' | 'gather_artifact' | 'activate' | 'wave_defense' | 'gather_plants' | 'deliver' | 'choice' | 'observe_dino' | 'explore_territory' | 'build_craft';

export interface QuestObjective {
  type: string;
  resource?: string;
  building?: string;
  species?: string;
  name?: string;
  plantId?: string;
  amount?: number;
  distance?: number;
  pointName?: string;
  researchType?: string;
  x?: number;
  y?: number;
  // runtime state
  current?: number;
  found?: boolean;
}

export interface QuestReward {
  type: string;
  resource?: string;
  amount?: number;
  building?: string;
  effect?: string;
  value?: number;
  name?: string;
  quest?: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  act: string;
  order: number;
  objectives: QuestObjective[];
  timeLimit?: number | null;
  rewards: QuestReward[];
  unlocks: string[];
  spawnOnStart?: { species: string; count: number };
  waves?: any[];
  dialogue_start?: string;
  dialogue_success?: string;
  dialogue_fail?: string;
  dialogue_kill?: string;
  dialogue_checkpoint_1?: string;
  dialogue_checkpoint_2?: string;
  dialogue_checkpoint_3?: string;
  dialogue_wave?: string;
}

export interface QuestState {
  id: string;
  status: 'locked' | 'available' | 'active' | 'completed' | 'failed';
  objectives: QuestObjective[];
  ticksRemaining?: number;
  startedAtTick: number;
}

export interface DialogueLine {
  speaker: 'engineer' | 'biologist' | 'pilot' | 'narrator';
  text: string;
}

export interface Dialogue {
  lines: DialogueLine[];
}

export interface QuestEvent {
  type: 'quest_available' | 'quest_started' | 'quest_completed' | 'quest_failed' | 'quest_objective_progress' | 'act_started' | 'dialogue';
  questId?: string;
  actId?: string;
  message: string;
  dialogue?: Dialogue;
}

export class QuestManager {
  private quests: Map<string, QuestDefinition> = new Map();
  private questStates: Map<string, QuestState> = new Map();
  private actDefinitions: any[] = [];
  private completedQuests: Set<string> = new Set();
  private currentAct: string = 'act1_crash';
  private eventCallback: ((event: QuestEvent) => void) | null = null;
  private tickCount: number = 0;
  private checkpointShown: Map<string, Set<number>> = new Map();
  private pendingAutoStart: boolean = false;
  private pendingActIntro: string | null = null;
  private branchManager: StoryBranchManager;

  constructor(branchManager: StoryBranchManager) {
    this.branchManager = branchManager;
    this.loadQuestData();
    this.loadDialogueData();
  }

  private getPlantDrop(plantId: string): { resource: string; amount: number } | null {
    const plant = (plantsData as any)[plantId];
    if (plant && plant.harvestDrop) {
      return { resource: plant.harvestDrop.resource, amount: plant.harvestDrop.amount };
    }
    return null;
  }

  private loadQuestData(): void {
    for (const act of questsData.acts) {
      this.actDefinitions.push(act);
    }
    for (const [id, quest] of Object.entries(questsData.quests)) {
      this.quests.set(id, quest as QuestDefinition);
    }
    // Initialize quest states
    for (const [id, quest] of this.quests) {
      this.questStates.set(id, {
        id,
        status: 'locked',
        objectives: JSON.parse(JSON.stringify(quest.objectives)),
        startedAtTick: 0,
      });
    }
    // Unlock first act quests
    this.unlockAct('act1_crash');
  }

  private loadDialogueData(): void {
    // Dialogues are accessed by string key from questsData
  }

  onEvent(callback: (event: QuestEvent) => void): void {
    this.eventCallback = callback;
  }

  private emit(event: QuestEvent): void {
    if (!this.eventCallback) return;
    this.eventCallback(event);
  }

  private unlockAct(actId: string): void {
    const act = this.actDefinitions.find(a => a.id === actId);
    if (!act) return;

    this.currentAct = actId;

    // Store act intro to emit later (after callback is registered)
    if (act.dialogue_intro) {
      this.pendingActIntro = act.dialogue_intro;
    }

    for (const questId of act.quests) {
      const state = this.questStates.get(questId);
      if (state && state.status === 'locked') {
        state.status = 'available';
        this.emit({
          type: 'quest_available',
          questId,
          message: `Новый квест: ${this.quests.get(questId)?.title}`,
        });
      }
    }
  }

  startQuest(questId: string, tickCount: number): boolean {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'available') return false;

    state.status = 'active';
    state.startedAtTick = tickCount;
    if (this.quests.get(questId)?.timeLimit) {
      state.ticksRemaining = this.quests.get(questId)!.timeLimit!;
    }

    const quest = this.quests.get(questId);
    if (quest?.dialogue_start) {
      const dialogue = this.getDialogue(quest.dialogue_start);
      if (dialogue) {
        this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
      }
    }

    this.emit({
      type: 'quest_started',
      questId,
      message: `Квест начат: ${quest?.title}`,
    });

    return true;
  }

  onDialogueComplete(): void {
    if (this.pendingAutoStart) {
      this.pendingAutoStart = false;
      this.autoStartNextQuest();
    }
  }

  requestAutoStart(): void {
    this.pendingAutoStart = true;
  }

  flushPendingIntro(): boolean {
    if (this.pendingActIntro) {
      const dialogue = this.getDialogue(this.pendingActIntro);
      this.pendingActIntro = null;
      if (dialogue) {
        this.emit({ type: 'dialogue', message: 'dialogue', dialogue });
        return true;
      }
    }
    return false;
  }

  clearPendingState(): void {
    this.pendingAutoStart = false;
    this.pendingActIntro = null;
    this.eventCallback = null;
  }

  autoStartNextQuest(): void {
    // Don't start new quest if one is already active
    const hasActive = Array.from(this.questStates.values()).some(s => s.status === 'active');
    if (hasActive) return;

    // Find the next available quest in current act
    const act = this.actDefinitions.find(a => a.id === this.currentAct);
    if (!act) return;

    for (const questId of act.quests) {
      const state = this.questStates.get(questId);
      if (state?.status === 'available') {
        this.startQuest(questId, this.tickCount);
        return;
      }
    }
  }

  update(tickCount: number, simulation: Simulation): void {
    this.tickCount = tickCount;

    // Update active quests
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'active') continue;

      const quest = this.quests.get(questId);
      if (!quest) continue;

      // Check time limit
      if (state.ticksRemaining !== undefined && state.ticksRemaining !== null) {
        state.ticksRemaining--;
        if (state.ticksRemaining <= 0) {
          this.failQuest(questId);
          continue;
        }
      }

      // Update objectives based on quest type
      this.updateObjectives(questId, state, quest, simulation);

      // Check if all objectives complete
      if (this.areObjectivesComplete(state.objectives)) {
        this.completeQuest(questId);
      }
    }
  }

  private updateObjectives(questId: string, state: QuestState, quest: QuestDefinition, simulation: Simulation): void {
    // Update ALL objective types regardless of quest type
    for (const obj of state.objectives) {
      switch (obj.type) {
        case 'resource':
          if (obj.resource && obj.amount) {
            let total = simulation.getResourceAmount(obj.resource);
            if (obj.resource === 'food') {
              // Count food in farm storage
              const buildings = simulation.entityManager.getByType('building') as Building[];
              for (const b of buildings) {
                if (b.built && b.produceType === 'food') {
                  total += b.getStorageAmount('food');
                }
              }
              // Count settler's personal food
              const settlers = simulation.entityManager.getByType('settler') as Settler[];
              for (const s of settlers) {
                if (s.isAlive) total += s.food;
              }
            }
            obj.current = total;
          }
          break;
        case 'building':
          if (obj.building && obj.amount) {
            const buildings = simulation.entityManager.getByType('building') as Building[];
            obj.current = buildings.filter(b => b.buildingType === obj.building && b.built).length;
          }
          break;
        case 'building_any':
          if (obj.amount) {
            const allBuildings = simulation.entityManager.getByType('building') as Building[];
            obj.current = allBuildings.filter(b => b.built).length;
          }
          break;
        case 'reach_tile':
          if (obj.x !== undefined && obj.y !== undefined && !obj.found) {
            const settlers = simulation.entityManager.getByType('settler') as Settler[];
            const settler = settlers.find(s => s.isAlive);
            if (settler) {
              const baseX = Math.floor(simulation.tileGrid.width / 2);
              const baseY = Math.floor(simulation.tileGrid.height / 2);
              const targetX = baseX + obj.x;
              const targetY = baseY + obj.y;
              const dist = Math.abs(settler.x - targetX) + Math.abs(settler.y - targetY);
              if (dist <= 2) {
                obj.found = true;
                this.emit({ type: 'quest_objective_progress', questId, message: `Точка найдена: ${obj.pointName}` });
              }
            }
          }
          break;
        case 'survive_ticks':
          if (obj.amount) obj.current = (obj.current || 0) + 1;
          break;
        case 'kill':
          // Updated externally via onDinoKilled
          break;
        case 'kill_melee':
          // Updated externally via onSettlerKillsDino
          break;
        case 'artifact':
          if (obj.name && obj.amount) {
            const settlers = simulation.entityManager.getByType('settler') as Settler[];
            let total = 0;
            for (const s of settlers) total += s.getArtifactCount(obj.name);
            obj.current = total;
          }
          break;
        case 'research':
          // Updated externally via onPlantResearched
          break;
        case 'harvest_plant':
          // Track plant harvesting - check if we have the resource from the plant
          if (obj.plantId && obj.amount) {
            const plantDrop = this.getPlantDrop(obj.plantId);
            if (plantDrop) {
              obj.current = Math.min(obj.amount, Math.floor(simulation.getResourceAmount(plantDrop.resource) / plantDrop.amount));
            }
          }
          break;
        case 'observe_dino':
          // Check if settler is near a dinosaur of specified species
          if (obj.species && obj.distance !== undefined && !obj.found) {
            const settlers = simulation.entityManager.getByType('settler') as Settler[];
            const dinos = simulation.entityManager.getByType('dinosaur') as Dinosaur[];
            const settler = settlers.find(s => s.isAlive);
            if (settler) {
              const nearDino = dinos.find(d => d.species === obj.species && d.isAlive &&
                Math.abs(d.x - settler.x) + Math.abs(d.y - settler.y) >= obj.distance!);
              if (nearDino) {
                obj.found = true;
                this.emit({ type: 'quest_objective_progress', questId, message: `Observed ${obj.species}` });
              }
            }
          }
          break;
        case 'explore_territory':
          // Same as reach_tile but for territory mapping
          if (obj.x !== undefined && obj.y !== undefined && !obj.found) {
            const settlers = simulation.entityManager.getByType('settler') as Settler[];
            const settler = settlers.find(s => s.isAlive);
            if (settler) {
              const baseX = Math.floor(simulation.tileGrid.width / 2);
              const baseY = Math.floor(simulation.tileGrid.height / 2);
              const targetX = baseX + obj.x;
              const targetY = baseY + obj.y;
              const dist = Math.abs(settler.x - targetX) + Math.abs(settler.y - targetY);
              if (dist <= 2) {
                obj.found = true;
                this.emit({ type: 'quest_objective_progress', questId, message: `Territory mapped: ${obj.pointName}` });
              }
            }
          }
          break;
        case 'build_craft':
          // Check building + craft completion
          if (obj.building && obj.amount) {
            const buildings = simulation.entityManager.getByType('building') as Building[];
            obj.current = buildings.filter(b => b.buildingType === obj.building && b.built).length;
          }
          break;
        case 'choice':
          // Branch choice - auto-complete when branch is selected
          if (this.branchManager.getBranch()) {
            obj.current = obj.amount ?? 1;
          }
          break;
      }
    }

    // Checkpoints for build quests
    if (quest.type === 'build') {
      this.checkBuildCheckpoints(questId, state, quest, simulation);
    }

    // Checkpoints for explore quests
    if (quest.type === 'explore') {
      this.checkExploreCheckpoints(questId, state, quest);
    }
  }

  private checkBuildCheckpoints(questId: string, state: QuestState, quest: QuestDefinition, simulation: Simulation): void {
    // Don't fire checkpoints in first 5 ticks after quest start
    if (this.tickCount - state.startedAtTick < 5) return;

    const buildings = simulation.entityManager.getByType('building') as Building[];
    let totalRequired = 0;
    let totalBuilt = 0;
    for (const obj of state.objectives) {
      if (obj.type === 'building' && obj.building && obj.amount !== undefined) {
        totalRequired += obj.amount;
        totalBuilt += buildings.filter(b => b.buildingType === obj.building && b.built).length;
      }
    }
    if (totalRequired === 0) return;

    const progress = totalBuilt / totalRequired;
    const checkpointDialogues = [
      quest.dialogue_checkpoint_1,
      quest.dialogue_checkpoint_2,
    ];
    if (!checkpointDialogues[0] && !checkpointDialogues[1]) return;

    if (!this.checkpointShown.has(questId)) {
      this.checkpointShown.set(questId, new Set());
    }
    const shown = this.checkpointShown.get(questId)!;

    if (progress >= 0.5 && !shown.has(0) && checkpointDialogues[0]) {
      shown.add(0);
      const dialogue = this.getDialogue(checkpointDialogues[0]);
      if (dialogue) this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
    }
    if (progress >= 0.8 && !shown.has(1) && checkpointDialogues[1]) {
      shown.add(1);
      const dialogue = this.getDialogue(checkpointDialogues[1]);
      if (dialogue) this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
    }
  }

  private checkExploreCheckpoints(questId: string, state: QuestState, quest: QuestDefinition): void {
    if (this.tickCount - state.startedAtTick < 5) return;

    const completedCheckpoints = state.objectives.filter(o => o.found).length;
    const checkpointDialogues = [
      quest.dialogue_checkpoint_1,
      quest.dialogue_checkpoint_2,
      quest.dialogue_checkpoint_3,
    ];
    if (!this.checkpointShown.has(questId)) {
      this.checkpointShown.set(questId, new Set());
    }
    const shown = this.checkpointShown.get(questId)!;
    for (let i = 0; i < completedCheckpoints; i++) {
      if (!shown.has(i) && checkpointDialogues[i]) {
        shown.add(i);
        const dialogue = this.getDialogue(checkpointDialogues[i]!);
        if (dialogue) this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
      }
    }
  }

  private updateWaveDefense(questId: string, state: QuestState, simulation: Simulation): void {
    // Wave defense just tracks survive_ticks
    for (const obj of state.objectives) {
      if (obj.type === 'survive_ticks' && obj.amount) {
        obj.current = (obj.current || 0) + 1;
      }
    }

    // Show wave dialogue periodically
    const quest = this.quests.get(questId);
    if (quest?.dialogue_wave && state.objectives[0]?.current) {
      const elapsed = state.objectives[0].current;
      if (elapsed % 20 === 0 && elapsed > 0) {
        const dialogue = this.getDialogue(quest.dialogue_wave);
        if (dialogue) {
          this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
        }
      }
    }
  }

  private areObjectivesComplete(objectives: QuestObjective[]): boolean {
    for (const obj of objectives) {
      if (obj.amount !== undefined && obj.current !== undefined) {
        if (obj.current < obj.amount) return false;
      }
      if (obj.found !== undefined && !obj.found) return false;
    }
    return true;
  }

  private completeQuest(questId: string): void {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') return;

    state.status = 'completed';
    this.completedQuests.add(questId);

    const quest = this.quests.get(questId);
    if (quest?.dialogue_success) {
      const dialogue = this.getDialogue(quest.dialogue_success);
      if (dialogue) {
        this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
      }
    }

    this.emit({
      type: 'quest_completed',
      questId,
      message: `Квест выполнен: ${quest?.title}`,
    });

    // Unlock next quests
    if (quest?.unlocks) {
      for (const unlockId of quest.unlocks) {
        const state = this.questStates.get(unlockId);
        if (state?.status === 'locked') {
          state.status = 'available';
          const unlockQuest = this.quests.get(unlockId);
          this.emit({
            type: 'quest_available',
            questId: unlockId,
            message: `Новый квест: ${unlockQuest?.title}`,
          });
        }
      }
    }

    // Check if act is complete
    this.checkActComplete(quest?.act);

    // Auto-start next quest — defer if dialogue is shown
    if (quest?.dialogue_success && this.getDialogue(quest.dialogue_success)) {
      this.pendingAutoStart = true;
    } else {
      this.autoStartNextQuest();
    }
  }

  handleBranchChoice(branch: StoryBranch): void {
    this.branchManager.setBranch(branch);

    // Complete the choice quest
    const choiceQuest = this.questStates.get('q_branch_choice');
    if (choiceQuest && choiceQuest.status === 'active') {
      this.completeQuest('q_branch_choice');
    }

    // Emit branch selection event
    this.emit({
      type: 'quest_completed',
      questId: 'q_branch_choice',
      message: `Path chosen: ${branch === 'scientist' ? 'Scientist' : 'Warrior'}`,
    });
  }

  private failQuest(questId: string): void {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') return;

    state.status = 'failed';

    const quest = this.quests.get(questId);
    if (quest?.dialogue_fail) {
      const dialogue = this.getDialogue(quest.dialogue_fail);
      if (dialogue) {
        this.emit({ type: 'dialogue', questId, message: 'dialogue', dialogue });
      }
    }

    this.emit({
      type: 'quest_failed',
      questId,
      message: `Квест провален: ${quest?.title}`,
    });

    // Unlock next quests anyway (fail forward)
    if (quest?.unlocks) {
      for (const unlockId of quest.unlocks) {
        const state = this.questStates.get(unlockId);
        if (state?.status === 'locked') {
          state.status = 'available';
        }
      }
    }

    this.checkActComplete(quest?.act);

    // Auto-start next quest even after fail — defer if dialogue is shown
    if (quest?.dialogue_fail && this.getDialogue(quest.dialogue_fail)) {
      this.pendingAutoStart = true;
    } else {
      this.autoStartNextQuest();
    }
  }

  private checkActComplete(actId?: string): void {
    if (!actId) return;
    const act = this.actDefinitions.find(a => a.id === actId);
    if (!act) return;

    const allDone = act.quests.every((qId: string) => {
      const s = this.questStates.get(qId);
      return s?.status === 'completed' || s?.status === 'failed';
    });

    if (allDone) {
      // Find next act
      const currentIdx = this.actDefinitions.findIndex(a => a.id === actId);
      if (currentIdx < this.actDefinitions.length - 1) {
        const nextAct = this.actDefinitions[currentIdx + 1];
        // Check if requirements met
        const reqsMet = !nextAct.requires || nextAct.requires.every((r: string) => this.completedQuests.has(r));
        if (reqsMet) {
          this.unlockAct(nextAct.id);
          this.emit({
            type: 'act_started',
            actId: nextAct.id,
            message: `Новый акт: ${nextAct.title}`,
          });
          // Emit act intro dialogue if any
          this.flushPendingIntro();
        }
      }
    }
  }

  getDialogue(key: string): Dialogue | null {
    return (dialoguesData as any)[key] || null;
  }

  getQuest(id: string): QuestDefinition | undefined {
    return this.quests.get(id);
  }

  getQuestState(id: string): QuestState | undefined {
    return this.questStates.get(id);
  }

  getActiveQuests(): { quest: QuestDefinition; state: QuestState }[] {
    const result: { quest: QuestDefinition; state: QuestState }[] = [];
    for (const [id, state] of this.questStates) {
      if (state.status === 'active') {
        const quest = this.quests.get(id);
        if (quest) result.push({ quest, state });
      }
    }
    return result;
  }

  getAvailableQuests(): { quest: QuestDefinition; state: QuestState }[] {
    const result: { quest: QuestDefinition; state: QuestState }[] = [];
    for (const [id, state] of this.questStates) {
      if (state.status === 'available') {
        const quest = this.quests.get(id);
        if (quest) result.push({ quest, state });
      }
    }
    return result;
  }

  getCurrentAct(): string {
    return this.currentAct;
  }

  getProgressText(questId: string): string {
    const state = this.questStates.get(questId);
    const quest = this.quests.get(questId);
    if (!state || !quest) return '';

    const parts: string[] = [];
    for (const obj of state.objectives) {
      if (obj.type === 'resource' && obj.resource && obj.amount !== undefined) {
        parts.push(`${obj.resource}: ${obj.current || 0}/${obj.amount}`);
      } else if (obj.type === 'building' && obj.building && obj.amount !== undefined) {
        parts.push(`${obj.building}: ${obj.current || 0}/${obj.amount}`);
      } else if (obj.type === 'kill' && obj.species && obj.amount !== undefined) {
        parts.push(`${obj.species}: ${obj.current || 0}/${obj.amount}`);
      } else if (obj.type === 'survive_ticks' && obj.amount !== undefined) {
        parts.push(`${obj.current || 0}/${obj.amount} тиков`);
      } else if (obj.type === 'artifact' && obj.name && obj.amount !== undefined) {
        parts.push(`${obj.name}: ${obj.current || 0}/${obj.amount}`);
      } else if (obj.type === 'reach_tile' || obj.type === 'reach_dino') {
        const done = obj.found ? '✓' : '...';
        parts.push(`${obj.pointName || obj.species || 'точка'}: ${done}`);
      } else if (obj.type === 'research' && obj.amount !== undefined) {
        parts.push(`исследования: ${obj.current || 0}/${obj.amount}`);
      }
    }

    if (state.ticksRemaining !== undefined && state.ticksRemaining !== null) {
      parts.push(`Время: ${state.ticksRemaining}`);
    }

    return parts.join(' | ');
  }

  // Called when a settler kills a dino manually (not turret)
  onSettlerKillsDino(species: string): void {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'active') continue;
      for (const obj of state.objectives) {
        if (obj.type === 'kill_melee' && obj.species === species && obj.amount !== undefined) {
          obj.current = (obj.current || 0) + 1;
          this.emit({
            type: 'quest_objective_progress',
            questId,
            message: `${species} убит (${obj.current}/${obj.amount})`,
          });
        }
      }
    }
  }

  // Called when any dino is killed
  onDinoKilled(species: string): void {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'active') continue;
      for (const obj of state.objectives) {
        if (obj.type === 'kill' && obj.species === species && obj.amount !== undefined) {
          obj.current = (obj.current || 0) + 1;
          this.emit({
            type: 'quest_objective_progress',
            questId,
            message: `${species} убит (${obj.current}/${obj.amount})`,
          });
        }
      }
    }
  }

  // Called when Marina researches a plant
  onPlantResearched(): void {
    for (const [questId, state] of this.questStates) {
      if (state.status !== 'active') continue;
      for (const obj of state.objectives) {
        if (obj.type === 'research' && obj.researchType === 'plant' && obj.amount !== undefined) {
          obj.current = (obj.current || 0) + 1;
          this.emit({
            type: 'quest_objective_progress',
            questId,
            message: `Растение изучено (${obj.current}/${obj.amount})`,
          });
        }
      }
    }
  }

  // Apply rewards to simulation
  applyRewards(questId: string, simulation: Simulation, artifactSystem?: any): void {
    const quest = this.quests.get(questId);
    if (!quest) return;

    for (const reward of quest.rewards) {
      switch (reward.type) {
        case 'resource':
          if (reward.resource && reward.amount) {
            simulation.addToInventory(reward.resource, reward.amount, reward.resource);
          }
          break;
        case 'unlock':
          // Buildings are unlocked via building type check in UIManager
          break;
        case 'effect':
          // Effects are applied via ArtifactSystem
          break;
        case 'heal_all': {
          const settlers = simulation.entityManager.getByType('settler') as Settler[];
          for (const s of settlers) {
            if (s.isAlive) s.hp = s.maxHp;
          }
          break;
        }
      }
    }
  }

  isQuestUnlocked(buildingType: string): boolean {
    // Check if a building type is unlocked by completed quests
    for (const questId of this.completedQuests) {
      const quest = this.quests.get(questId);
      if (quest?.rewards) {
        for (const reward of quest.rewards) {
          if (reward.type === 'unlock' && reward.building === buildingType) return true;
        }
      }
    }
    // First act buildings are always available
    return ['wall', 'gate', 'house', 'turret'].includes(buildingType);
  }

  isQuestActive(questId: string): boolean {
    return this.questStates.get(questId)?.status === 'active';
  }

  serialize(): object {
    const states: any = {};
    for (const [id, state] of this.questStates) {
      states[id] = {
        status: state.status,
        objectives: state.objectives,
        ticksRemaining: state.ticksRemaining,
        startedAtTick: state.startedAtTick,
      };
    }
    return {
      currentAct: this.currentAct,
      completedQuests: Array.from(this.completedQuests),
      questStates: states,
    };
  }

  static deserialize(data: any, branchManager: StoryBranchManager): QuestManager {
    const qm = new QuestManager(branchManager);
    if (data.currentAct) qm.currentAct = data.currentAct;
    if (data.completedQuests) qm.completedQuests = new Set(data.completedQuests);
    if (data.questStates) {
      for (const [id, state] of Object.entries(data.questStates)) {
        const existing = qm.questStates.get(id);
        if (existing && state) {
          const s = state as any;
          existing.status = s.status;
          existing.ticksRemaining = s.ticksRemaining;
          existing.startedAtTick = s.startedAtTick;
          if (s.objectives) {
            existing.objectives = s.objectives;
          }
        }
      }
    }
    return qm;
  }
}
