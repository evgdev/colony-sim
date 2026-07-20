import Phaser from 'phaser';
import {
  MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H, TILE_SIZE,
  FOG_REVEAL_RADIUS, isNight,
} from '../config';
import { getLayout } from '../ui/LayoutConfig';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Artifact } from '../entities/Artifact';
import { Dinosaur } from '../entities/Dinosaur';
import { MovementSystem } from '../systems/MovementSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { DinosaurSystem } from '../systems/DinosaurSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { AutoWorkSystem } from '../systems/AutoWorkSystem';
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { IncubatorSystem } from '../systems/IncubatorSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { QuestManager } from '../systems/QuestManager';
import { DialogueBox } from '../ui/DialogueBox';
import { LabJournal } from '../ui/LabJournal';
import { TaskPriority } from '../core/Task';
import { SaveManager } from '../core/SaveManager';
import { DebugPanel } from '../ui/DebugPanel';
import { languageManager } from '../data/LanguageManager';
import dinosaursData from '../data/dinosaurs.json';
import { Encyclopedia } from '../data/Encyclopedia';
import { EncyclopediaModal } from '../ui/EncyclopediaModal';
import { StoryBranchManager } from '../data/storyBranch';
import { BranchChoiceModal } from '../ui/BranchChoiceModal';
import buildingsData from '../data/buildings.json';

import { createBuildingIcons, createTileTextures, createDecorationTextures, createEncyclopediaTextures, createTrexSprite, createRaptorSprite, createBrontosaurSprite, createPterodactylSprite, createSettlerSprite } from '../rendering/TextureGenerator';
import { AnimatedMapRenderer } from '../rendering/AnimatedMapRenderer';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { DecorationGenerator } from '../rendering/DecorationGenerator';
import { UIManager } from '../ui/UIManager';
import { InputHandler } from '../ui/InputHandler';
import { MenuSystem } from '../ui/MenuSystem';
import { ToastManager } from '../ui/ToastManager';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';

import { gameConfig } from '../gameConfig';
import { createInitialWorld } from '../game/GameSetup';
import { StartMenu, GameMode } from '../game/StartMenu';
import { GameOverScreen } from '../game/GameOverScreen';

export class GameScene extends Phaser.Scene {
  simulation!: Simulation;
  movementSystem!: MovementSystem;
  workSystem!: WorkSystem;
  needsSystem!: NeedsSystem;
  buildingSystem!: BuildingSystem;
  dinosaurSystem!: DinosaurSystem;
  combatSystem!: CombatSystem;
  autoWorkSystem!: AutoWorkSystem;
  artifactSystem!: ArtifactSystem;
  incubatorSystem!: IncubatorSystem;
  questSystem!: QuestSystem;
  questManager!: QuestManager;
  dialogueBox!: DialogueBox;
  labJournal!: LabJournal;
  debugPanel!: DebugPanel;
  replayRecorder!: ReplayRecorder;
  toastManager!: ToastManager;
  encyclopedia!: import('../data/Encyclopedia').Encyclopedia;
  private encyclopediaModal!: import('../ui/EncyclopediaModal').EncyclopediaModal;
  storyBranchManager!: import('../data/storyBranch').StoryBranchManager;
  private branchChoiceModal!: import('../ui/BranchChoiceModal').BranchChoiceModal;

  selectedSettler!: Settler;
  private attackedSettler: Settler | null = null;

  private mapRenderer!: AnimatedMapRenderer;
  private entityRenderer!: EntityRenderer;
  private decorationGenerator!: DecorationGenerator;
  private uiManager!: UIManager;
  private inputHandler!: InputHandler;
  private menuSystem!: MenuSystem;

  private gameOver: boolean = false;
  private worldReady: boolean = false;
  private gameMode: GameMode = 'story';
  private dialoguePaused: boolean = false;

  private startMenu!: StartMenu;
  private gameOverScreen!: GameOverScreen;
  private wallOverlay!: Phaser.GameObjects.Graphics;
  private exploreOverlay!: Phaser.GameObjects.Graphics;

  private scrollX: number = 0;
  private scrollY: number = 0;
  private resourceSpawnTimer: number = 0;
  private resourceSpawnInterval: number = gameConfig.resourceSpawnInterval;
  private defenseWaveTimer: number = 0;
  private defenseWaveInterval: number = 40;
  private defenseWaveCount: number = 0;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
    TAB: Phaser.Input.Keyboard.Key;
    Z: Phaser.Input.Keyboard.Key;
  };

  // Shooting mode
  shootMode: boolean = false;
  private projectiles: { x: number; y: number; vx: number; vy: number; life: number; prevX: number; prevY: number }[] = [];
  private projectileGraphics!: Phaser.GameObjects.Graphics;
  private shootModeBorder!: Phaser.GameObjects.Graphics;
  private shootMoveTimer: number = 0;
  private settlerMoveTarget: { x: number; y: number } | null = null;
  private settlerVisualOffset: { x: number; y: number } = { x: 0, y: 0 };

  // Build hotkey mode (StarCraft-style)
  buildHotkeyMode: boolean = false;
  private buildHotkeyOverlay!: Phaser.GameObjects.Container;
  private static BUILD_HOTKEYS: Record<string, string> = {
    W: 'wall', G: 'gate', H: 'house', D: 'warehouse',
    F: 'farm', K: 'workshop', R: 'radio', T: 'turret', L: 'lab',
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void { }

  create(): void {
    this.children.removeAll(true);
    this.gameOver = false;
    this.scrollX = 0;
    this.scrollY = 0;

    this.keys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
      RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      TAB: Phaser.Input.Keyboard.KeyCodes.TAB,
      Z: Phaser.Input.Keyboard.KeyCodes.Z,
    }) as any;

    // Helper to block keys when encyclopedia/dialogue is open
    const keyGuard = (fn: () => void) => () => {
      if (this.encyclopediaModal?.isVisible()) return;
      fn();
    };

    this.input.keyboard!.on('scroll-up', keyGuard(() => this.scrollBy(0, -1)));
    this.input.keyboard!.on('scroll-down', keyGuard(() => this.scrollBy(0, 1)));
    this.input.keyboard!.on('scroll-left', keyGuard(() => this.scrollBy(-1, 0)));
    this.input.keyboard!.on('scroll-right', keyGuard(() => this.scrollBy(1, 0)));

    this.input.keyboard!.on('keydown-ONE', keyGuard(() => this.selectSettlerByIndex(0)));
    this.input.keyboard!.on('keydown-TWO', keyGuard(() => this.selectSettlerByIndex(1)));
    this.input.keyboard!.on('keydown-THREE', keyGuard(() => this.selectSettlerByIndex(2)));

    this.input.keyboard!.on('keydown-SPACE', keyGuard(() => {
      if (this.dialogueBox?.isVisible) {
        this.dialogueBox.nextLine();
        return;
      }
      if (this.attackedSettler && this.attackedSettler.isAlive) {
        this.selectSettler(this.attackedSettler);
        this.attackedSettler = null;
      }
    }));

    // Work mode hotkeys: Q=auto, E=gather, R=build, F=idle
    const setWorkMode = (mode: 'auto' | 'gather' | 'build' | 'idle') => {
      const s = this.selectedSettler;
      if (s && s.isAlive) {
        s.workMode = mode;
      }
    };
    this.input.keyboard!.on('keydown-Q', keyGuard(() => { if (!this.buildHotkeyMode) setWorkMode('auto'); }));
    this.input.keyboard!.on('keydown-E', keyGuard(() => { if (!this.buildHotkeyMode) setWorkMode('gather'); }));
    this.input.keyboard!.on('keydown-R', keyGuard(() => { if (!this.buildHotkeyMode) setWorkMode('build'); }));
    this.input.keyboard!.on('keydown-F', keyGuard(() => { if (!this.buildHotkeyMode) setWorkMode('idle'); }));

    // Z = toggle shoot mode
    this.input.keyboard!.on('keydown-Z', keyGuard(() => {
      this.shootMode = !this.shootMode;
      this.uiManager?.addLog(this.shootMode ? 'Shoot mode ON (WASD=move, click=fire, Z=cancel)' : 'Shoot mode OFF');
      this.inputHandler?.setShootMode(this.shootMode);
      this.input.setDefaultCursor(this.shootMode ? 'crosshair' : 'default');
      this.drawShootModeBorder();
    }));

    // B = build hotkey mode (StarCraft-style)
    this.buildHotkeyOverlay = this.add.container(0, 0).setDepth(50).setVisible(false);
    this.input.keyboard!.on('keydown-B', keyGuard(() => {
      if (this.shootMode) return; // blocked in shoot mode
      if (this.buildHotkeyMode) {
        this.cancelBuildHotkeyMode();
        return;
      }
      this.buildHotkeyMode = true;
      this.showBuildHotkeyOverlay();
      this.uiManager?.addLog('BUILD — press a key, ESC to cancel');
    }));
    // Second key = select building
    for (const [key, type] of Object.entries(GameScene.BUILD_HOTKEYS)) {
      this.input.keyboard!.on(`keydown-${key}`, () => {
        if (!this.buildHotkeyMode) return;
        this.cancelBuildHotkeyMode();
        this.selectBuildType(type);
      });
    }
    // Escape = cancel build/shoot mode OR close encyclopedia
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.encyclopediaModal?.isVisible()) {
        this.encyclopediaModal.hide();
        return;
      }
      if (this.buildHotkeyMode) {
        this.cancelBuildHotkeyMode();
        this.uiManager?.addLog('Build cancelled');
      } else if (this.shootMode) {
        this.shootMode = false;
        this.inputHandler?.setShootMode(false);
        this.input.setDefaultCursor('default');
        this.drawShootModeBorder();
        this.uiManager?.addLog('Shoot mode OFF');
      }
    });

    this.input.keyboard!.on('keydown-ENTER', keyGuard(() => {
      if (this.dialogueBox?.isVisible) {
        this.dialogueBox.nextLine();
      }
    }));

    this.simulation = new Simulation(MAP_WIDTH, MAP_HEIGHT);
    this.rebindSystems();

    createTileTextures(this);
    createBuildingIcons(this);
    createDecorationTextures(this);
    createEncyclopediaTextures(this);
    createTrexSprite(this);
    createRaptorSprite(this);
    createBrontosaurSprite(this);
    createPterodactylSprite(this);
    createSettlerSprite(this);
    this.createDinosaurAnims();
    this.createSettlerAnims();

    this.mapRenderer = new AnimatedMapRenderer(this, this.simulation);
    this.mapRenderer.drawMap();
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);

    this.decorationGenerator = new DecorationGenerator(this);
    this.workSystem.decorationGenerator = this.decorationGenerator;

    this.uiManager = new UIManager(this, this.simulation);
    this.uiManager.setArtifactSystem(this.artifactSystem);
    this.replayRecorder = new ReplayRecorder(this.simulation);
    this.uiManager.replayRecorder = this.replayRecorder;
    this.uiManager.createEventArea();
    this.uiManager.createLeftPanel();
    this.uiManager.createActionLog();
    this.uiManager.createInfoPanel();
    this.uiManager.onCollectCallback = (entity, queue) => this.handleCollect(entity, queue);
    this.uiManager.onDemolishCallback = (entity) => this.handleDemolish(entity);
    this.uiManager.onContinueCallback = (entity) => this.handleContinue(entity);
    this.uiManager.onRepairCallback = (entity) => this.handleRepair(entity);
    this.uiManager.onJournalCallback = (building) => this.showLabJournal(building);
    this.uiManager.onCraftCallback = (recipeId, workshop) => this.handleCraft(recipeId, workshop);
    this.uiManager.onUseCraftedCallback = (recipeId, workshop) => this.handleUseCrafted(recipeId, workshop);
    this.uiManager.createSettlerIcons((index) => this.selectSettlerByIndex(index));
    this.uiManager.updateScroll(this.scrollX, this.scrollY);

    this.entityRenderer = new EntityRenderer(this, this.simulation);
    this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.drawEntities();

    this.menuSystem = new MenuSystem(this);

    this.inputHandler = new InputHandler(this, this.simulation, this.uiManager, this.menuSystem, this.workSystem, this.artifactSystem);
    this.inputHandler.scrollTo = (tileX: number, tileY: number) => this.scrollTo(tileX, tileY);
    this.inputHandler.onMoveHere = (x, y, queue) => this.handleMoveHere(x, y, queue);
    this.inputHandler.onAttackEntity = (entity, queue) => this.handleAttackEntity(entity, queue);
    this.inputHandler.onShootClick = (tileX, tileY) => this.handleShoot(tileX, tileY);
    this.inputHandler.createHoverRect();
    this.inputHandler.createSelectionRect();
    this.inputHandler.setupInputHandlers();
    this.inputHandler.updateScroll(this.scrollX, this.scrollY);

    this.inputHandler.recorder = this.replayRecorder;

    this.debugPanel = new DebugPanel(this);
    this.toastManager = new ToastManager(this);
    this.dialogueBox = new DialogueBox(this);
    this.encyclopedia = new Encyclopedia();
    this.encyclopediaModal = new EncyclopediaModal(this, this.encyclopedia);
    this.storyBranchManager = new StoryBranchManager();
    this.branchChoiceModal = new BranchChoiceModal(this);
    this.labJournal = new LabJournal(this);
    this.wallOverlay = this.add.graphics().setDepth(6);
    this.exploreOverlay = this.add.graphics().setDepth(6);
    this.projectileGraphics = this.add.graphics().setDepth(15);
    this.shootModeBorder = this.add.graphics().setDepth(19);
    this.startMenu = new StartMenu(this);
    this.gameOverScreen = new GameOverScreen(this);

    this.uiManager.createBottomHUD(
      () => this.onSave(),
      () => this.onLoad(),
      () => this.onClearSave(),
      () => createBuildingIcons(this),
      this.debugPanel,
      () => {
        this.replayRecorder.stop();
        this.scene.start('BootScene');
      }
    );

    // Start background music (disabled)
    // if (this.cache.audio.exists('music_level1')) {
    //   this.sound.play('music_level1', { volume: 0.3, loop: true });
    // }

    this.uiManager.addLog(languageManager.narrative.intro[0] + ` [${languageManager.ui.day} 1]`);
    this.uiManager.addEvent(languageManager.narrative.intro[1]);

    this.uiManager.updateBuildButtonStates();
    this.showStartMenu();
  }

  private rebindSystems(): void {
    this.movementSystem = new MovementSystem(this.simulation.tileGrid);
    this.needsSystem = new NeedsSystem(this.simulation.entityManager);
    this.workSystem = new WorkSystem(
      this.movementSystem,
      this.simulation.tileGrid,
      this.simulation.entityManager,
      this.simulation.taskQueue,
      this.simulation
    );
    this.artifactSystem = new ArtifactSystem(this.simulation.entityManager);
    this.workSystem.artifactSystem = this.artifactSystem;
    this.questSystem = new QuestSystem();
    this.questSystem.onEvent((event) => {
      this.uiManager?.addLog(event.message);
      this.uiManager?.addEvent(event.message);
    });
    this.workSystem.questSystem = this.questSystem;
    this.workSystem.decorationGenerator = this.decorationGenerator ?? null;

    // AutoWorkSystem — автоматическая генерация задач для idle колонистов
    this.autoWorkSystem = new AutoWorkSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid,
      this.workSystem,
      this.simulation.taskQueue,
      this.simulation
    );
    if (this.decorationGenerator) {
      this.autoWorkSystem.setDecorationGenerator(this.decorationGenerator);
    }

    // IncubatorSystem — инкубация яиц динозавров
    this.incubatorSystem = new IncubatorSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid,
      this.simulation
    );
    this.incubatorSystem.setOnHatch((dino) => {
      this.uiManager?.addLog(`🥚 ${dino.species} вылупился!`);
      this.toastManager?.show(`Новый динозавр!`);
    });

    this.workSystem.onSettlerSleep = (settler) => {
      this.uiManager?.addLog(`${settler.name} is exhausted and sleeping!`);
      this.toastManager?.show(`${settler.name} fell asleep from exhaustion!`);
    };

    this.workSystem.onPlantDiscovered = (plantId: string) => {
      const info = this.encyclopedia.getPlantInfo(plantId);
      if (info && this.encyclopedia.discover(plantId, this.simulation.tickCount)) {
        this.uiManager?.addLog(`📖 Новое растение: ${info.name}`);
        this.toastManager?.show(`Энциклопедия: ${info.name} открыта!`);
      }
    };

    // QuestManager — full quest tree
    this.questManager = new QuestManager(this.storyBranchManager);
    this.questManager.onEvent((event) => {
      // Always log messages
      if (event.message && event.type !== 'dialogue') {
        this.uiManager?.addLog(event.message);
      }
      // Always show toast for quest start/complete
      if (event.type === 'quest_started' || event.type === 'quest_completed') {
        this.toastManager?.show(event.message);
      }
      // Show dialogue if present
      if (event.type === 'dialogue' && event.dialogue) {
        this.dialoguePaused = true;
        this.inputHandler?.hideHover();
        this.dialogueBox?.show(event.dialogue, () => {
          this.dialoguePaused = false;
          this.questManager?.onDialogueComplete();
        });
      }
      // Spawn dinos if requested by quest
      if (event.type === 'spawn_dinos' && event.spawnData) {
        this.spawnQuestDinosNow(event.spawnData.species, event.spawnData.count);
      }
    });
    // Emit act1 intro dialogue now that callback is registered
    if (this.gameMode === 'story') {
      this.questManager!.flushPendingIntro();
    }
    // Start the first quest after short delay — decorations already generated
    const SKIP_TO_QUEST = gameConfig.skipToQuest;
    this.time.delayedCall(2000, () => {
      if (this.gameMode === 'story') {
        if (SKIP_TO_QUEST) {
          this.skipToQuest(SKIP_TO_QUEST);
        } else if (this.dialogueBox?.isVisible) {
          // Act intro dialogue still showing — start first quest after it finishes
          this.questManager!.requestAutoStart();
        } else {
          this.questManager!.autoStartNextQuest();
        }
      }
    });
    this.buildingSystem = new BuildingSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
    this.buildingSystem.onDinoKilled = (dino) => {
      this.dropArtifact(dino);
      this.questManager?.onDinoKilled(dino.species);
    };
    this.dinosaurSystem = new DinosaurSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid,
      this.simulation.seed,
      (name) => this.uiManager?.addLog(`${name} was killed!`),
      (species) => {
        const spawns = languageManager.narrative.dinosaurSpawns[species as keyof typeof languageManager.narrative.dinosaurSpawns];
        if (spawns && spawns.length > 0) {
          const msg = spawns[Math.floor(Math.random() * spawns.length)];
          this.uiManager?.addLog(msg);
          this.uiManager?.addEvent(msg);
        }
      },
      (x, y) => {
        const lines = languageManager.narrative.combat.wallDestroyed;
        const msg = lines[Math.floor(Math.random() * lines.length)];
        this.uiManager?.addLog(msg);
        this.uiManager?.addEvent(msg);
      }
    );
    this.dinosaurSystem.setBranchManager(this.storyBranchManager);
    this.combatSystem = new CombatSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
  }

  private showStartMenu(): void {
    this.worldReady = false;
    this.startMenu.show({
      onStart: (mode, difficulty) => this.startGame(mode, difficulty),
      onLoadReplay: () => this.loadReplay(),
    });
    this.uiManager.setBuildButtonsEnabled(false);
    this.uiManager.setDayNightDimmed(true);
    this.uiManager.setHudButtonsEnabled(false);
    this.uiManager.setScrollButtonsEnabled(false);
    this.uiManager.startMenuOpen = true;
    this.debugPanel.setEnabled(false);
    this.input.setDefaultCursor('default');
  }

  private startGame(mode: GameMode, difficulty: 'easy' | 'hard'): void {
    this.startMenu.destroy();
    this.gameMode = mode;
    this.worldReady = true;
    this.questArtifactSpawned = false;
    this.uiManager.setBuildButtonsEnabled(true);
    this.uiManager.setDayNightDimmed(false);
    this.uiManager.setHudButtonsEnabled(true);
    this.uiManager.setScrollButtonsEnabled(true);
    this.uiManager.startMenuOpen = false;
    this.debugPanel.setEnabled(true);

    try {
      const world = createInitialWorld(this.simulation);
      this.selectedSettler = world.settlers[0];
      this.replayRecorder.start();

      this.scrollX = Math.max(0, world.centerX - Math.floor(getLayout().viewportTiles / 2));
      this.scrollY = Math.max(0, world.centerY - Math.floor(getLayout().viewportTiles / 2));
      this.clampScroll();

      if (mode === 'defense') {
        // Defense mode: spawn initial dinosaurs immediately
        this.spawnDefenseModeDinos(world);
        this.uiManager?.addLog('Режим обороны: динозавры атакуют!');
      }
      // Story mode: no dinosaurs at start — QuestManager controls spawning

      this.mapRenderer.drawMap();
      this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
      this.decorationGenerator.generateDecorations(this.simulation.tileGrid, this.simulation.entityManager);
      this.decorationGenerator.updateScroll(this.scrollX, this.scrollY);
      this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
      this.entityRenderer.drawEntities();
      this.uiManager.updateScroll(this.scrollX, this.scrollY);
      this.inputHandler.updateScroll(this.scrollX, this.scrollY);
      this.uiManager.updateBuildButtonStates();
    } catch (err) {
      console.error('startGame error:', err);
      this.uiManager?.addLog('START ERR: ' + (err as Error).message);
    }
  }

  private skipToQuest(targetQuestId: string): void {
    const qm = this.questManager;
    if (!qm) return;

    // Auto-complete all quests before the target
    const allQuestIds = ['q1_1', 'q1_2', 'q1_3', 'q2_1', 'q2_plants', 'q2_3', 'q3_1', 'q3_2', 'q3_3', 'q4_1', 'q4_2', 'q4_3', 'q4_4', 'q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5', 'q_dino_1', 'q_dino_2', 'q_dino_3', 'q_dino_4', 'q_dino_5'];
    for (const qid of allQuestIds) {
      if (qid === targetQuestId) break;
      const state = qm.getQuestState(qid);
      if (state && (state.status === 'active' || state.status === 'available' || state.status === 'locked')) {
        (state as any).status = 'completed';
        qm['completedQuests'].add(qid);
        const quest = qm.getQuest(qid);
        if (quest?.unlocks) {
          for (const uid of quest.unlocks) {
            const s = qm.getQuestState(uid);
            if (s && s.status === 'locked') (s as any).status = 'available';
          }
        }
      }
    }

    // Set current act based on target quest
    const targetQuest = qm.getQuest(targetQuestId);
    if (targetQuest) {
      qm['currentAct'] = targetQuest.act;
    }

    // Start the target quest
    qm.startQuest(targetQuestId, this.simulation.tickCount);
    this.uiManager?.addLog(`[SKIP] Квест: ${qm.getQuest(targetQuestId)?.title}`);

    // Build incubator and paddock if skipping to dino quests
    if (targetQuestId.startsWith('q_dino')) {
      this.buildSkipStructures();
    }
  }

  private buildSkipStructures(): void {
    const centerX = Math.floor(MAP_WIDTH / 2);
    const centerY = Math.floor(MAP_HEIGHT / 2);

    // Build incubator
    const incubatorDef = (buildingsData as any).incubator;
    if (incubatorDef) {
      const inc = new Building(centerX - 4, centerY, 'incubator');
      inc.built = true;
      inc.hp = incubatorDef.maxHp;
      this.simulation.entityManager.add(inc);
      for (let dy = 0; dy < (incubatorDef.size ?? 2); dy++) {
        for (let dx = 0; dx < (incubatorDef.size ?? 2); dx++) {
          this.simulation.tileGrid.setOccupied(centerX - 4 + dx, centerY + dy, true);
          this.simulation.tileGrid.setBuilding(centerX - 4 + dx, centerY + dy, true);
        }
      }
      this.uiManager?.addLog('[SKIP] Инкубатор построен');
    }

    // Build paddock
    const paddockDef = (buildingsData as any).paddock;
    if (paddockDef) {
      const pad = new Building(centerX + 2, centerY, 'paddock');
      pad.built = true;
      pad.hp = paddockDef.maxHp;
      this.simulation.entityManager.add(pad);
      for (let dy = 0; dy < (paddockDef.size ?? 3); dy++) {
        for (let dx = 0; dx < (paddockDef.size ?? 3); dx++) {
          this.simulation.tileGrid.setOccupied(centerX + 2 + dx, centerY + dy, true);
          this.simulation.tileGrid.setBuilding(centerX + 2 + dx, centerY + dy, true);
        }
      }
      this.uiManager?.addLog('[SKIP] Загон построен');
    }

    // Spawn a baby raptor near incubator
    const babyRaptor = new Dinosaur(centerX - 2, centerY + 1, 'raptor', 30, 3, 4, 1.1, 15, 8, 1);
    babyRaptor.isTamed = true;
    babyRaptor.loyalty = 50;
    babyRaptor.hunger = 100;
    this.simulation.entityManager.add(babyRaptor);
    this.uiManager?.addLog('[SKIP] Раптор вылупился!');
  }

  private spawnDefenseModeDinos(world: { centerX: number; centerY: number }): void {
    const speciesList = ['raptor', 'raptor', 'brontosaur'];
    const spawnOffsets = [
      { dx: 8, dy: 0 },
      { dx: -8, dy: 0 },
      { dx: 0, dy: 8 },
    ];
    speciesList.forEach((species, i) => {
      const def = (dinosaursData as any)[species];
      if (!def) return;
      const footprint = def.footprint ?? 1;
      const off = spawnOffsets[i] ?? { dx: i + 5, dy: 0 };
      let sx = world.centerX + off.dx;
      let sy = world.centerY + off.dy;
      for (let attempt = 0; attempt < 30; attempt++) {
        if (this.simulation.tileGrid.isAreaWalkableForDino(sx, sy, footprint)) break;
        sx += 1;
        if (sx >= this.simulation.tileGrid.width - footprint) {
          sx = world.centerX + off.dx;
          sy += 1;
        }
      }
      const dino = new Dinosaur(
        sx, sy, species,
        def.hp, def.speed, def.aggroRange,
        def.size, def.attackDamage, def.wallDamage ?? 5, footprint
      );
      this.simulation.entityManager.add(dino);
      this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, footprint, true);
    });
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;
    if (!this.worldReady) return;

    try {
      this.dialogueBox?.update(delta);
      const encycOpen = this.encyclopediaModal?.isVisible() ?? false;
      if (!encycOpen) {
        this.handleScrollInput();

        if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
          this.cycleSettler();
        }
      }

      if (!this.debugPanel.paused) {
        this.runSystems(delta);
      }

      // Projectiles update every frame (not tied to tick rate)
      this.updateProjectiles(delta);

      this.renderFrame(delta);
    } catch (err) {
      console.error('GameScene.update error:', err);
      this.uiManager?.addLog('UPDATE ERR: ' + (err as Error).message);
    }
  }

  private runSystems(delta: number): void {
    // Pause during dialogue
    if (this.dialoguePaused || this.dialogueBox?.isVisible) return;

    const adjustedDelta = delta * this.debugPanel.speed;
    const ticked = this.simulation.update(adjustedDelta);
    if (!ticked) return;

    const td = (this.simulation.tickRate / 1000) * this.debugPanel.speed;

    const hpBefore = new Map<number, number>();
    for (const s of this.simulation.entityManager.getByType('settler') as Settler[]) {
      hpBefore.set(s.id, s.hp);
    }

    this.needsSystem.update(
      this.simulation.entityManager.getByType('settler') as Settler[],
      td,
      this.simulation.tickCount,
      this.hasFarm()
    );
    this.autoWorkSystem.update(td);
    this.workSystem.update(td);
    this.buildingSystem.update(td);
    this.dinosaurSystem.update(td, this.simulation.tickCount, this.gameMode === 'defense');
    this.incubatorSystem?.update(td, !isNight(this.simulation.tickCount));
    if (this.gameMode === 'story') {
      this.spawnQuestDinos();
    }
    this.processCombat(this.combatSystem.update(td));

    for (const s of this.simulation.entityManager.getByType('settler') as Settler[]) {
      const prevHp = hpBefore.get(s.id) ?? s.hp;
      if (s.hp < prevHp && s.isAlive) {
        this.attackedSettler = s;
        this.toastManager.show(`${s.name} is under attack! (SPACE to jump)`);
      }
    }

    this.spawnResources();
    if (this.gameMode === 'defense') {
      this.spawnDefenseWave();
    }
    this.questManager?.update(this.simulation.tickCount, this.simulation);
    this.spawnQuestArtifacts();
    this.uiManager.updateThoughts(ticked);
    this.checkGameOver();
    this.uiManager.updateBuildButtonStates();
    this.replayRecorder.onTick(this.simulation.tickCount);
  }

  private spawnResources(): void {
    this.resourceSpawnTimer++;
    const interval = this.questManager?.isQuestActive('q1_2') ? 25 : this.resourceSpawnInterval;
    if (this.resourceSpawnTimer < interval) return;
    this.resourceSpawnTimer = 0;

    const existing = this.simulation.entityManager.getByType('resource').length;
    if (existing >= gameConfig.maxResourcesOnMap) return;

    // During q1_2: more stone, spawn near base
    const isWallQuest = this.questManager?.isQuestActive('q1_2');
    const spawnCount = isWallQuest ? 3 : 1;

    for (let i = 0; i < spawnCount; i++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        let x: number, y: number;
        if (isWallQuest) {
          // Spawn near center (within 12 tiles)
          x = Math.floor(MAP_WIDTH / 2 + (Math.random() - 0.5) * 24);
          y = Math.floor(MAP_HEIGHT / 2 + (Math.random() - 0.5) * 24);
        } else {
          x = Math.floor(Math.random() * MAP_WIDTH);
          y = Math.floor(Math.random() * MAP_HEIGHT);
        }
        const tile = this.simulation.tileGrid.get(x, y);
        if (!tile || !tile.walkable || tile.type === 'water' || tile.occupied) continue;

        const type = isWallQuest ? 'stone' : 'wood';
        const qty = Math.floor(Math.random() * 12) + 5;
        const res = new Resource(x, y, type, qty);
        this.simulation.entityManager.add(res);
        break;
      }
    }
  }

  private isDinosEnabled(): boolean { return false; }

  private dinoSpawnTimer: number = 0;

  private spawnQuestDinos(): void {
    const qm = this.questManager;
    if (!qm) return;

    // Don't spawn dinos if q2_1 is still active (exploration quest)
    if (qm.isQuestActive('q2_1')) return;

    // Only spawn dinos after certain quests are completed
    const q2_1Done = qm.getQuestState('q2_1')?.status === 'completed';
    const q_plants_2Done = qm.getQuestState('q_plants_2')?.status === 'completed';
    if (!q2_1Done && !q_plants_2Done) return;

    this.dinoSpawnTimer++;
    if (this.dinoSpawnTimer < 30) return; // spawn every 30 ticks
    this.dinoSpawnTimer = 0;

    const dinoCount = this.simulation.entityManager.getByType('dinosaur').length;
    if (dinoCount >= 4) return;

    // Default dino spawning (exploration focus)
    if (Math.random() < 0.3) {
      const species = Math.random() < 0.6 ? 'brontosaur' : 'raptor';
      this.spawnDinoAtEdge(species, ['east', 'west', 'north', 'south'][Math.floor(Math.random() * 4)] as any);
    }
  }

  private spawnDinoAtEdge(species: string, edge: string): void {
    const def = (dinosaursData as any)[species];
    if (!def) return;
    const footprint = def.footprint ?? 1;

    let sx = 0, sy = 0;
    switch (edge) {
      case 'east': sx = MAP_WIDTH - 2; sy = Math.floor(Math.random() * MAP_HEIGHT); break;
      case 'west': sx = 1; sy = Math.floor(Math.random() * MAP_HEIGHT); break;
      case 'north': sx = Math.floor(Math.random() * MAP_WIDTH); sy = 1; break;
      case 'south': sx = Math.floor(Math.random() * MAP_WIDTH); sy = MAP_HEIGHT - 2; break;
    }

    // Find walkable spot
    for (let attempt = 0; attempt < 20; attempt++) {
      if (this.simulation.tileGrid.isAreaWalkableForDino(sx, sy, footprint)) break;
      sx = Math.floor(Math.random() * (MAP_WIDTH - footprint));
      sy = Math.floor(Math.random() * (MAP_HEIGHT - footprint));
    }

    const dino = new Dinosaur(
      sx, sy, species,
      def.hp, def.speed, def.aggroRange,
      def.size, def.attackDamage, def.wallDamage ?? 5, footprint
    );
    this.simulation.entityManager.add(dino);
    this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, footprint, true);

    const msg = `${def.name} появился на ${edge === 'east' ? 'востоке' : edge === 'west' ? 'западе' : edge === 'north' ? 'севере' : 'юге'}!`;
    this.uiManager?.addLog(msg);
    this.toastManager?.show(msg);
  }

  private spawnQuestDinosNow(species: string, count: number): void {
    const def = (dinosaursData as any)[species];
    if (!def) return;
    const footprint = def.footprint ?? 1;
    const centerX = Math.floor(MAP_WIDTH / 2);
    const centerY = Math.floor(MAP_HEIGHT / 2);

    for (let i = 0; i < count; i++) {
      // Spawn at random position near edges, away from base
      let sx = 0, sy = 0;
      for (let attempt = 0; attempt < 30; attempt++) {
        sx = Math.floor(Math.random() * (MAP_WIDTH - footprint));
        sy = Math.floor(Math.random() * (MAP_HEIGHT - footprint));
        // Must be at least 10 tiles from center
        const distFromCenter = Math.abs(sx - centerX) + Math.abs(sy - centerY);
        if (distFromCenter >= 10 && this.simulation.tileGrid.isAreaWalkableForDino(sx, sy, footprint)) break;
      }

      const dino = new Dinosaur(
        sx, sy, species,
        def.hp, def.speed, def.aggroRange,
        def.size, def.attackDamage, def.wallDamage ?? 5, footprint
      );
      this.simulation.entityManager.add(dino);
      this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, footprint, true);
    }

    const msg = `${count > 1 ? count + ' ' : ''}${def.name}${count > 1 ? (species === 'brontosaur' ? 'а' : 'ов') : ''} появил${count > 1 ? 'ись' : 'ся'} на карте!`;
    this.uiManager?.addLog(msg);
    this.toastManager?.show(msg);
  }

  private questArtifactSpawned: boolean = false;

  private spawnQuestArtifacts(): void {
    const qm = this.questManager;
    if (!qm) return;

    // Only spawn artifacts once when q2_2 becomes active
    if (this.questArtifactSpawned) return;
    if (!qm.isQuestActive('q2_2')) return;
    this.questArtifactSpawned = true;

    const centerX = Math.floor(MAP_WIDTH / 2);
    const centerY = Math.floor(MAP_HEIGHT / 2);

    // Spawn 2 fossils and 1 strange_track at random locations
    const artifactSpawns = [
      { name: 'fossil', type: 'fossil' },
      { name: 'fossil', type: 'fossil' },
      { name: 'strange_track', type: 'strange_track' },
    ];

    for (const spawn of artifactSpawns) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = Math.floor(MAP_WIDTH / 2 + (Math.random() - 0.5) * 28);
        const y = Math.floor(MAP_HEIGHT / 2 + (Math.random() - 0.5) * 28);
        const tile = this.simulation.tileGrid.get(x, y);
        if (!tile || !tile.walkable || tile.type === 'water' || tile.occupied) continue;

        const artifact = new Artifact(x, y, spawn.type, spawn.name);
        this.simulation.entityManager.add(artifact);
        // No setOccupied — artifacts don't block movement
        break;
      }
    }

    this.uiManager?.addLog('На карте появились окаменелости и следы!');
    this.toastManager?.show('Найди окаменелости на карте!');
  }

  private spawnDefenseWave(): void {
    this.defenseWaveTimer++;
    if (this.defenseWaveTimer < this.defenseWaveInterval) return;
    this.defenseWaveTimer = 0;
    this.defenseWaveCount++;

    // Escalating difficulty: more dinos, faster interval
    const baseCount = 2 + Math.floor(this.defenseWaveCount / 3);
    const speciesPool = this.defenseWaveCount < 5
      ? ['raptor']
      : ['raptor', 'trex'];

    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    const aliveSettlers = settlers.filter(s => s.isAlive);
    if (aliveSettlers.length === 0) return;

    for (let i = 0; i < baseCount; i++) {
      const species = speciesPool[Math.floor(Math.random() * speciesPool.length)];
      const def = (dinosaursData as any)[species];
      if (!def) continue;

      const footprint = def.footprint ?? 1;
      // Spawn at random edge of map
      const edge = Math.floor(Math.random() * 4);
      let sx = 0, sy = 0;
      switch (edge) {
        case 0: sx = 1; sy = Math.floor(Math.random() * MAP_HEIGHT); break;
        case 1: sx = MAP_WIDTH - 1 - footprint; sy = Math.floor(Math.random() * MAP_HEIGHT); break;
        case 2: sx = Math.floor(Math.random() * MAP_WIDTH); sy = 1; break;
        case 3: sx = Math.floor(Math.random() * MAP_WIDTH); sy = MAP_HEIGHT - 1 - footprint; break;
      }

      // Find walkable spot
      for (let attempt = 0; attempt < 20; attempt++) {
        if (this.simulation.tileGrid.isAreaWalkableForDino(sx, sy, footprint)) break;
        sx = Math.floor(Math.random() * (MAP_WIDTH - footprint));
        sy = Math.floor(Math.random() * (MAP_HEIGHT - footprint));
      }

      const dino = new Dinosaur(
        sx, sy, species,
        def.hp, def.speed, def.aggroRange,
        def.size, def.attackDamage, def.wallDamage ?? 5, footprint
      );
      this.simulation.entityManager.add(dino);
      this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, footprint, true);
    }

    // Notify
    if (this.defenseWaveCount % 3 === 0) {
      const msg = `Волна ${this.defenseWaveCount}: ${baseCount} динозавров приближаются!`;
      this.uiManager?.addLog(msg);
      this.toastManager?.show(msg);
    }
  }

  private processCombat(events: any[]): void {
    for (const e of events) {
      if (e.type === 'settler_attack') {
        const lines = languageManager.narrative.combat.settlerAttack;
        const msg = lines[Math.floor(Math.random() * lines.length)]
          .replace('{attacker}', e.attacker)
          .replace('{defender}', e.defender);
        this.uiManager.addLog(msg);
        if (e.killed && e.killedAt && e.killedSpecies) {
          this.dropArtifact({
            x: e.killedAt.x,
            y: e.killedAt.y,
            species: e.killedSpecies,
            attacker: e.attacker,
          } as any);
        }
      } else if (e.type === 'dino_vs_dino') {
        const lines = languageManager.narrative.combat.dinoAttack;
        const msg = lines[Math.floor(Math.random() * lines.length)]
          .replace('{attacker}', e.attacker)
          .replace('{defender}', e.defender);
        this.uiManager.addLog(msg);
        if (e.killed) {
          const deathLines = languageManager.narrative.combat.dinoDeath;
          const deathMsg = deathLines[Math.floor(Math.random() * deathLines.length)]
            .replace('{species}', e.defender);
          this.uiManager.addLog(deathMsg);
        }
      }
    }
  }

  private renderFrame(delta: number): void {
    this.entityRenderer.selectedSettler = this.selectedSettler;
    const tilesPerMs = this.debugPanel.speed / this.simulation.tickRate;
    this.entityRenderer.updateVisuals(delta, tilesPerMs);
    this.mapRenderer.updateAnimations(delta);
    this.mapRenderer.redrawFog();
    this.decorationGenerator?.updateVisibility();
    this.decorationGenerator?.updateTreeAnimation(delta);
    this.decorationGenerator?.updateRegeneration(1);
    this.simulation.tileGrid.updateFog(delta);
    this.mapRenderer.updateNight(this.simulation.tickCount);
    this.entityRenderer.drawEntities();
    this.entityRenderer.drawPath();
    this.drawProjectiles();
    this.decorationGenerator?.drawChopProgress(this.scrollX, this.scrollY);
    this.updateWallOverlay();
    this.updateExploreMarkers();
    this.uiManager.updateLeftPanel(this.gameOver, this.simulation.tickCount);
    this.uiManager.updateSelection();
    this.uiManager.updateInfoPanel();
    this.uiManager.updateMinimap();
    this.debugPanel.update(this.simulation);
    this.debugPanel.projectileCount = this.projectiles.length;
  }

  private updateWallOverlay(): void {
    this.wallOverlay.clear();
    if (this.gameMode !== 'story') return;

    const qm = this.questManager;
    if (!qm) return;

    // Show after q1_1 completed, hide after q1_2 completed
    const q1_1Done = qm.getQuestState('q1_1')?.status === 'completed';
    const q1_2Done = qm.getQuestState('q1_2')?.status === 'completed' || qm.getQuestState('q1_2')?.status === 'failed';
    if (!q1_1Done || q1_2Done) return;

    // Fixed 10x10 area centered on spawn point
    const centerX = Math.floor(this.simulation.tileGrid.width / 2);
    const centerY = Math.floor(this.simulation.tileGrid.height / 2);
    const halfSize = 5;
    const minX = Math.max(0, centerX - halfSize);
    const maxX = Math.min(MAP_WIDTH - 1, centerX + halfSize - 1);
    const minY = Math.max(0, centerY - halfSize);
    const maxY = Math.min(MAP_HEIGHT - 1, centerY + halfSize - 1);

    const L = getLayout();
    const tileSize = L.tileSize;
    const fieldX = L.fieldX;
    const fieldY = L.fieldY;
    const fieldMaxX = fieldX + L.viewportTiles * tileSize;
    const fieldMaxY = fieldY + L.viewportTiles * tileSize;
    const sx = this.scrollX;
    const sy = this.scrollY;
    const g = this.wallOverlay;

    // Helper: draw rect only if inside field
    const safeRect = (px: number, py: number, w: number, h: number) => {
      if (px + w > fieldX && px < fieldMaxX && py + h > fieldY && py < fieldMaxY) {
        g.fillRect(px, py, w, h);
      }
    };
    const safeStrokeRect = (px: number, py: number, w: number, h: number) => {
      if (px + w > fieldX && px < fieldMaxX && py + h > fieldY && py < fieldMaxY) {
        g.strokeRect(px, py, w, h);
      }
    };

    // Semi-transparent fill
    g.fillStyle(0xffd700, 0.06);
    safeRect(
      fieldX + (minX - sx) * tileSize,
      fieldY + (minY - sy) * tileSize,
      (maxX - minX + 1) * tileSize,
      (maxY - minY + 1) * tileSize
    );

    // Wall outline — skip water tiles
    g.lineStyle(2, 0xffd700, 0.7);

    for (let x = minX; x <= maxX; x++) {
      const tileTop = this.simulation.tileGrid.get(x, minY);
      const tileBot = this.simulation.tileGrid.get(x, maxY);
      const px = fieldX + (x - sx) * tileSize;
      if (tileTop && tileTop.type !== 'water') {
        safeStrokeRect(px + 4, fieldY + (minY - sy) * tileSize + 4, tileSize - 8, tileSize - 8);
      }
      if (tileBot && tileBot.type !== 'water') {
        safeStrokeRect(px + 4, fieldY + (maxY - sy) * tileSize + 4, tileSize - 8, tileSize - 8);
      }
    }
    for (let y = minY + 1; y < maxY; y++) {
      const tileLeft = this.simulation.tileGrid.get(minX, y);
      const tileRight = this.simulation.tileGrid.get(maxX, y);
      const py = fieldY + (y - sy) * tileSize;
      if (tileLeft && tileLeft.type !== 'water') {
        safeStrokeRect(fieldX + (minX - sx) * tileSize + 4, py + 4, tileSize - 8, tileSize - 8);
      }
      if (tileRight && tileRight.type !== 'water') {
        safeStrokeRect(fieldX + (maxX - sx) * tileSize + 4, py + 4, tileSize - 8, tileSize - 8);
      }
    }

    // Gate at bottom center (green)
    const gateX = Math.floor((minX + maxX) / 2);
    const gateTile = this.simulation.tileGrid.get(gateX, maxY);
    if (gateTile && gateTile.type !== 'water') {
      g.lineStyle(2, 0x44ff44, 0.9);
      safeStrokeRect(
        fieldX + (gateX - sx) * tileSize + 2,
        fieldY + (maxY - sy) * tileSize + 2,
        tileSize - 4, tileSize - 4
      );
    }
  }

  private updateExploreMarkers(): void {
    this.exploreOverlay.clear();
    if (this.gameMode !== 'story') return;

    const qm = this.questManager;
    if (!qm) return;

    const L = getLayout();
    const tileSize = L.tileSize;
    const fieldX = L.fieldX;
    const fieldY = L.fieldY;
    const fieldMaxX = fieldX + L.viewportTiles * tileSize;
    const fieldMaxY = fieldY + L.viewportTiles * tileSize;
    const sx = this.scrollX;
    const sy = this.scrollY;
    const centerX = Math.floor(this.simulation.tileGrid.width / 2);
    const centerY = Math.floor(this.simulation.tileGrid.height / 2);
    const g = this.exploreOverlay;

    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;

    const active = qm.getActiveQuests();

    // 1. Show markers for explore quests (reach_tile objectives)
    const exploreQuest = active.find(q => q.quest.type === 'explore');
    if (exploreQuest) {
      for (const obj of exploreQuest.state.objectives) {
        if (obj.type !== 'reach_tile' || obj.found) continue;
        if (obj.x === undefined || obj.y === undefined) continue;

        const tileX = centerX + obj.x;
        const tileY = centerY + obj.y;

        // Skip if not revealed (fog of war)
        if (!this.simulation.tileGrid.isRevealed(tileX, tileY)) continue;

        const tile = this.simulation.tileGrid.get(tileX, tileY);
        if (!tile || tile.type === 'water') continue;

        const px = fieldX + (tileX - sx) * tileSize + tileSize / 2;
        const py = fieldY + (tileY - sy) * tileSize + tileSize / 2;

        if (px < fieldX - tileSize || px > fieldMaxX + tileSize) continue;
        if (py < fieldY - tileSize || py > fieldMaxY + tileSize) continue;

        // Orange diamond
        g.lineStyle(2, 0xff8800, pulse);
        const r = 14;
        g.beginPath();
        g.moveTo(px, py - r);
        g.lineTo(px + r, py);
        g.lineTo(px, py + r);
        g.lineTo(px - r, py);
        g.closePath();
        g.strokePath();
        g.fillStyle(0xff8800, pulse * 0.5);
        g.fillCircle(px, py, 4);
      }
    }

    // 2. Show markers for artifact quests (fossil / strange_track on map)
    const artifactQuest = active.find(q => q.quest.type === 'gather_artifact');
    if (artifactQuest) {
      const artifacts = this.simulation.entityManager.getByType('artifact') as Artifact[];
      for (const art of artifacts) {
        // Only mark artifacts that this quest needs
        const needed = artifactQuest.state.objectives.some(
          o => o.type === 'artifact' && o.name === art.name && (o.current ?? 0) < (o.amount ?? 0)
        );
        if (!needed) continue;

        // Skip if not revealed (fog of war)
        if (!this.simulation.tileGrid.isRevealed(art.x, art.y)) continue;

        const px = fieldX + (art.x - sx) * tileSize + tileSize / 2;
        const py = fieldY + (art.y - sy) * tileSize + tileSize / 2;

        if (px < fieldX - tileSize || px > fieldMaxX + tileSize) continue;
        if (py < fieldY - tileSize || py > fieldMaxY + tileSize) continue;

        // Cyan diamond for artifacts
        g.lineStyle(2, 0x00ccff, pulse);
        const r = 12;
        g.beginPath();
        g.moveTo(px, py - r);
        g.lineTo(px + r, py);
        g.lineTo(px, py + r);
        g.lineTo(px - r, py);
        g.closePath();
        g.strokePath();
        g.fillStyle(0x00ccff, pulse * 0.5);
        g.fillCircle(px, py, 3);
      }
    }
  }

  private handleScrollInput(): void {
    if (this.encyclopediaModal?.isVisible()) return;
    if (this.shootMode) {
      this.handleShootModeMovement();
      return;
    }
    let dx = 0;
    let dy = 0;

    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const L = getLayout();
      const newScrollX = this.scrollX + dx;
      const newScrollY = this.scrollY + dy;
      if (newScrollX >= 0 && newScrollX <= MAP_WIDTH - L.viewportTiles) {
        this.scrollX = newScrollX;
      }
      if (newScrollY >= 0 && newScrollY <= MAP_HEIGHT - L.viewportTiles) {
        this.scrollY = newScrollY;
      }
      this.updateScrollPosition();
    }
  }

  private handleShootModeMovement(): void {
    const settler = this.selectedSettler;
    if (!settler || !settler.isAlive) return;

    // Move every 6 frames for smooth movement
    this.shootMoveTimer++;
    if (this.shootMoveTimer < 6) return;
    this.shootMoveTimer = 0;

    let dx = 0;
    let dy = 0;
    if (this.keys.A.isDown) dx -= 1;
    if (this.keys.D.isDown) dx += 1;
    if (this.keys.W.isDown) dy -= 1;
    if (this.keys.S.isDown) dy += 1;

    if (dx === 0 && dy === 0) {
      settler.activity = 'idle';
      return;
    }

    const newX = settler.x + dx;
    const newY = settler.y + dy;

    // Check bounds
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;

    // Check tile walkability (allow walking through non-tree decorations)
    const tile = this.simulation.tileGrid.get(newX, newY);
    if (!tile || !tile.walkable) return;
    // Allow walking through occupied tiles that are just decorations (not buildings/dinos)
    if (tile.occupied) {
      const hasBuilding = this.simulation.entityManager.getByType('building') as any[];
      const blockingEntity = hasBuilding.find((b: any) => b.x === newX && b.y === newY);
      if (blockingEntity) return;
      // Check for dinosaurs
      const dinos = this.simulation.entityManager.getByType('dinosaur') as any[];
      const blockingDino = dinos.find((d: any) => d.x === newX && d.y === newY && d.isAlive);
      if (blockingDino) return;
    }

    // Set walk direction for animation
    if (dx !== 0 || dy !== 0) {
      settler.walkDirection = { x: dx, y: dy };
    }

    // Move settler
    settler.x = newX;
    settler.y = newY;
    settler.activity = 'walk';

    // Reveal fog around settler
    const fogBonus = (settler as any).getFogRadiusBonus?.() ?? 0;
    this.simulation.tileGrid.reveal(newX, newY, FOG_REVEAL_RADIUS + fogBonus);

    // Auto-scroll to keep settler near center
    this.autoScrollToSettler(settler);
  }

  private autoScrollToSettler(settler: Settler): void {
    const L = getLayout();
    const halfView = Math.floor(L.viewportTiles / 2);
    const centerX = this.scrollX + halfView;
    const centerY = this.scrollY + halfView;

    // Scroll when settler is within 3 tiles of screen edge
    const edgeMargin = 3;
    let newScrollX = this.scrollX;
    let newScrollY = this.scrollY;

    if (settler.x < centerX - edgeMargin) {
      newScrollX = settler.x - halfView + edgeMargin;
    } else if (settler.x > centerX + edgeMargin) {
      newScrollX = settler.x - halfView - edgeMargin;
    }

    if (settler.y < centerY - edgeMargin) {
      newScrollY = settler.y - halfView + edgeMargin;
    } else if (settler.y > centerY + edgeMargin) {
      newScrollY = settler.y - halfView - edgeMargin;
    }

    // Clamp
    const L2 = getLayout();
    newScrollX = Math.max(0, Math.min(newScrollX, MAP_WIDTH - L2.viewportTiles));
    newScrollY = Math.max(0, Math.min(newScrollY, MAP_HEIGHT - L2.viewportTiles));

    if (newScrollX !== this.scrollX || newScrollY !== this.scrollY) {
      this.scrollX = newScrollX;
      this.scrollY = newScrollY;
      this.updateScrollPosition();
    }
  }

  private drawShootModeBorder(): void {
    this.shootModeBorder.clear();
    if (!this.shootMode) return;

    const borderWidth = 3;
    const color = 0xff4444; // Red border
    const alpha = 0.8;

    // Top border
    const L = getLayout();
    this.shootModeBorder.lineStyle(borderWidth, color, alpha);
    this.shootModeBorder.strokeRect(L.fieldX, L.fieldY, L.fieldW, L.fieldH);

    // Inner glow
    this.shootModeBorder.lineStyle(1, 0xffaa00, 0.4);
    this.shootModeBorder.strokeRect(L.fieldX + 2, L.fieldY + 2, L.fieldW - 4, L.fieldH - 4);
  }

  private scrollBy(dx: number, dy: number): void {
    const L = getLayout();
    const newScrollX = this.scrollX + dx;
    const newScrollY = this.scrollY + dy;
    if (newScrollX >= 0 && newScrollX <= MAP_WIDTH - L.viewportTiles) {
      this.scrollX = newScrollX;
    }
    if (newScrollY >= 0 && newScrollY <= MAP_HEIGHT - L.viewportTiles) {
      this.scrollY = newScrollY;
    }
    this.updateScrollPosition();
  }

  private scrollTo(tileX: number, tileY: number): void {
    const L2 = getLayout();
    this.scrollX = Math.max(0, Math.min(tileX - Math.floor(L2.viewportTiles / 2), MAP_WIDTH - L2.viewportTiles));
    this.scrollY = Math.max(0, Math.min(tileY - Math.floor(L2.viewportTiles / 2), MAP_HEIGHT - L2.viewportTiles));
    this.updateScrollPosition();
  }

  private updateScrollPosition(): void {
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
    this.decorationGenerator?.updateScroll(this.scrollX, this.scrollY);
    this.inputHandler.updateScroll(this.scrollX, this.scrollY);
    this.uiManager.updateScroll(this.scrollX, this.scrollY);
  }

  private clampScroll(): void {
    const L = getLayout();
    this.scrollX = Math.max(0, Math.min(this.scrollX, MAP_WIDTH - L.viewportTiles));
    this.scrollY = Math.max(0, Math.min(this.scrollY, MAP_HEIGHT - L.viewportTiles));
  }

  getSelectedSettler(): Settler {
    return this.selectedSettler;
  }

  selectSettler(settler: Settler): void {
    if (this.selectedSettler && this.selectedSettler !== settler && this.uiManager.buildMode) {
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
    }
    this.selectedSettler = settler;
    this.scrollTo(this.selectedSettler.x, this.selectedSettler.y);
    this.uiManager.updateSettlerIcons(this.getAllSettlers().indexOf(settler));
  }

  showLabJournal(lab: Building): void {
    this.labJournal.show(lab);
  }

  cycleSettler(): void {
    const alive = this.getAllSettlers().filter(s => s.isAlive);
    if (alive.length <= 1) return;
    const idx = alive.indexOf(this.selectedSettler);
    const nextIdx = (idx + 1) % alive.length;
    this.selectedSettler = alive[nextIdx];
    this.replayRecorder.record(ReplayActionType.SelectSettler, { settlerId: this.selectedSettler.id });
    if (this.uiManager.buildMode) {
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
    }
    this.scrollTo(this.selectedSettler.x, this.selectedSettler.y);
    this.uiManager.updateSettlerIcons(this.getAllSettlers().indexOf(this.selectedSettler));
    this.uiManager.addLog(`Selected: ${this.selectedSettler.name} (${this.selectedSettler.settlerClass})`);
  }

  selectSettlerByIndex(index: number): void {
    const alive = this.getAllSettlers().filter(s => s.isAlive);
    if (index < 0 || index >= alive.length) return;
    this.selectedSettler = alive[index];
    this.replayRecorder.record(ReplayActionType.SelectSettler, { settlerId: this.selectedSettler.id });
    if (this.uiManager.buildMode) {
      this.uiManager.buildMode = null;
      this.uiManager.updateBuildButtonStates();
    }
    this.scrollTo(this.selectedSettler.x, this.selectedSettler.y);
    this.uiManager.updateSettlerIcons(index);
  }

  getAllSettlers(): Settler[] {
    return this.simulation.entityManager.getByType('settler') as Settler[];
  }

  private hasFarm(): boolean {
    const buildings = this.simulation.entityManager.getByType('building') as Building[];
    return buildings.some(b => b.buildingType === 'farm' && b.built);
  }

  private handleCollect(entity: import('../core/Entity').Entity, queue: boolean = false): void {
    const settler = this.selectedSettler;
    if (entity.entityType === 'resource') {
      const res = entity as Resource;
      this.workSystem.createPickUpTask(res, TaskPriority.High, settler, queue);
      this.uiManager.addLog(`${languageManager.ui.logHarvesting} ${res.resourceType} ${languageManager.ui.logFrom}...`);
      if (settler && settler.inventory.length === 0) {
        this.uiManager.checkMilestone('firstResource');
      }
    } else if (entity.entityType === 'artifact') {
      const artifact = entity as Artifact;
      this.workSystem.createPickUpArtifactTask(artifact, TaskPriority.High, settler);
      this.uiManager.addLog(`Picking up ${artifact.name}...`);
    }
    this.uiManager.deselectAll();
  }

  private handleDemolish(entity: import('../core/Entity').Entity): void {
    if (entity.entityType !== 'building') return;
    const bld = entity as Building;
    const bldSize = bld.size ?? 1;
    this.simulation.entityManager.remove(bld.id);
    // Clear all tiles in footprint
    for (let dy = 0; dy < bldSize; dy++) {
      for (let dx = 0; dx < bldSize; dx++) {
        this.simulation.tileGrid.setOccupied(bld.x + dx, bld.y + dy, false);
        this.simulation.tileGrid.setBuilding(bld.x + dx, bld.y + dy, false);
        if (bld.buildingType === 'gate') {
          this.simulation.tileGrid.setGate(bld.x + dx, bld.y + dy, false);
          this.simulation.tileGrid.setDinoBlocked(bld.x + dx, bld.y + dy, false);
        }
      }
    }
    this.uiManager.addLog(`Demolished ${bld.buildingType}`);
    this.uiManager.deselectAll();
  }

  private handleContinue(entity: import('../core/Entity').Entity): void {
    if (entity.entityType !== 'building') return;
    const bld = entity as Building;
    if (bld.built) return;
    const settler = this.selectedSettler;
    if (settler && settler.isAlive) {
      this.workSystem.createBuildTask(bld, TaskPriority.High, settler);
      this.uiManager.addLog(`Resuming construction of ${bld.buildingType}`);
    }
  }

  private handleRepair(entity: import('../core/Entity').Entity): void {
    if (entity.entityType !== 'building') return;
    const bld = entity as Building;
    if (!bld.built || bld.hp >= bld.maxHp) return;
    const settler = this.selectedSettler;
    if (settler && settler.isAlive) {
      this.workSystem.createRepairTask(bld, TaskPriority.High, settler);
      this.uiManager.addLog(`Repairing ${bld.buildingType} (needs wood:2 stone:2)`);
    }
  }

  private handleCraft(recipeId: string, workshop: Building): void {
    const settler = this.selectedSettler;
    if (settler && settler.isAlive) {
      this.workSystem.createCraftTask(workshop, recipeId, TaskPriority.High, settler);
      this.uiManager.addLog(`Crafting ${recipeId} at Workshop...`);
    }
  }

  private handleUseCrafted(recipeId: string, workshop: Building): void {
    const settler = this.selectedSettler;
    if (settler && settler.isAlive) {
      const used = this.workSystem.useCraftedItem(settler, workshop, recipeId);
      if (used) {
        this.uiManager.addLog(`${settler.name} used ${recipeId}`);
      }
    }
  }

  private handleMoveHere(x: number, y: number, queue: boolean): void {
    const settler = this.selectedSettler;
    if (!settler || !settler.isAlive) return;
    this.workSystem.createMoveTask(x, y, undefined, settler, queue);
    this.uiManager.addLog(`${languageManager.ui.menuMoveHere} (${x},${y})`);
  }

  private handleAttackEntity(entity: import('../core/Entity').Entity, queue: boolean): void {
    const settler = this.selectedSettler;
    if (!settler || !settler.isAlive) return;
    const target = this.findAdjacentWalkable(settler.x, settler.y, entity.x, entity.y);
    if (target) {
      this.workSystem.createMoveTask(target.x, target.y, undefined, settler, queue);
      this.uiManager.addLog(`Attack: moving to (${target.x},${target.y})`);
    } else {
      this.uiManager.addLog(`No path to target`);
    }
  }

  private showBuildHotkeyOverlay(): void {
    this.buildHotkeyOverlay.removeAll(true);
    const L = getLayout();
    const cx = L.fieldX + L.fieldW / 2;
    const cy = L.fieldY + L.fieldH / 2;
    const bg = this.add.rectangle(cx, cy, 260, 220, 0x0d1117, 0.95)
      .setOrigin(0.5).setStrokeStyle(2, 0x58a6ff);
    this.buildHotkeyOverlay.add(bg);

    const title = this.add.text(cx, cy - 95, '── BUILD ──', {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.buildHotkeyOverlay.add(title);

    let y = cy - 70;
    for (const [key, type] of Object.entries(GameScene.BUILD_HOTKEYS)) {
      const def = (buildingsData as any)[type];
      const name = def?.name ?? type;
      const line = this.add.text(cx - 100, y, `[${key}] ${name}`, {
        fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
      });
      this.buildHotkeyOverlay.add(line);
      y += 18;
    }

    const cancel = this.add.text(cx, y + 8, 'ESC to cancel', {
      fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.buildHotkeyOverlay.add(cancel);
  }

  private cancelBuildHotkeyMode(): void {
    this.buildHotkeyMode = false;
    this.buildHotkeyOverlay.setVisible(false);
  }

  private selectBuildType(type: string): void {
    const def = (buildingsData as any)[type];
    if (!def) return;
    if (!this.uiManager.canAfford(type as any)) {
      this.uiManager.addLog(`${def.name} — not enough resources`);
      return;
    }
    this.uiManager.buildMode = type as any;
    this.uiManager.updateBuildButtonStates();
    this.uiManager.addLog(`Build: ${def.name} — click a tile`);
  }

  private handleShoot(tileX: number, tileY: number): void {
    const settler = this.selectedSettler;
    if (!settler || !settler.isAlive) return;

    // Direction from settler to target
    const dx = tileX - settler.x;
    const dy = tileY - settler.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;

    const speed = 1.5; // tiles per frame — cross 15-tile screen in ~10 frames
    this.projectiles.push({
      x: settler.x,
      y: settler.y,
      prevX: settler.x,
      prevY: settler.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      life: 40,
    });
    this.uiManager?.addLog(`${settler.name} fires!`);
  }

  private updateProjectiles(delta: number): void {
    if (this.debugPanel.paused) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Check collision with dinosaurs
      const dinos = this.simulation.entityManager.getByType('dinosaur') as Dinosaur[];
      for (const dino of dinos) {
        if (!dino.isAlive) continue;
        const d = Math.abs(p.x - dino.x) + Math.abs(p.y - dino.y);
        if (d < 1.0) {
          dino.takeDamage(25);
          this.uiManager?.addLog(`Hit ${dino.species} for 25 damage!`);
          if (!dino.isAlive) {
            this.uiManager?.addLog(`${dino.species} killed by shot!`);
            this.simulation.entityManager.remove(dino.id);
            this.simulation.tileGrid.setOccupiedArea(dino.x, dino.y, dino.footprint ?? 1, false);
            this.dropArtifact({ x: dino.x, y: dino.y, species: dino.species, attacker: 'Shot' });
          }
          p.life = 0;
          break;
        }
      }

      // Check collision with buildings, trees, settlers
      if (p.life > 0) {
        const tileX = Math.round(p.x);
        const tileY = Math.round(p.y);
        const tile = this.simulation.tileGrid.get(tileX, tileY);
        if (tile && (tile.building || tile.occupied)) {
          p.life = 0;
        }
        // Check settlers
        const settlers = this.simulation.entityManager.getByType('settler') as any[];
        for (const s of settlers) {
          if (!s.isAlive) continue;
          const sd = Math.abs(p.x - s.x) + Math.abs(p.y - s.y);
          if (sd < 0.8) {
            p.life = 0;
            break;
          }
        }
      }

      // Remove expired or out-of-bounds
      if (p.life <= 0 || p.x < -1 || p.x >= MAP_WIDTH + 1 || p.y < -1 || p.y >= MAP_HEIGHT + 1) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private drawProjectiles(): void {
    this.projectileGraphics.clear();
    const L = getLayout();
    for (const p of this.projectiles) {
      const sx = L.fieldX + (p.x - this.scrollX) * L.tileSize + L.tileSize / 2;
      const sy = L.fieldY + (p.y - this.scrollY) * L.tileSize + L.tileSize / 2;
      const psx = L.fieldX + (p.prevX - this.scrollX) * L.tileSize + L.tileSize / 2;
      const psy = L.fieldY + (p.prevY - this.scrollY) * L.tileSize + L.tileSize / 2;

      // Elongated projectile (line from previous to current position)
      this.projectileGraphics.lineStyle(2, 0xffff00, 0.9);
      this.projectileGraphics.lineBetween(psx, psy, sx, sy);

      // Bright head
      this.projectileGraphics.fillStyle(0xffffff, 1);
      this.projectileGraphics.fillCircle(sx, sy, 2);

      // Dim tail
      this.projectileGraphics.fillStyle(0xffff00, 0.4);
      this.projectileGraphics.fillCircle(psx, psy, 1);
    }
  }

  private findAdjacentWalkable(sx: number, sy: number, tx: number, ty: number): { x: number; y: number } | null {
    const dirs = [
      { x: tx - 1, y: ty }, { x: tx + 1, y: ty },
      { x: tx, y: ty - 1 }, { x: tx, y: ty + 1 },
    ];
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const d of dirs) {
      const tile = this.simulation.tileGrid.get(d.x, d.y);
      if (!tile || !tile.walkable) continue;
      if (this.simulation.tileGrid.get(d.x, d.y)?.occupied) continue;
      const dist = Math.abs(d.x - sx) + Math.abs(d.y - sy);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  private dropArtifact(dino: { x: number; y: number; species: string; attacker?: string }): void {
    const artifactName = dino.species === 'pterodactyl' ? 'pterodactyl wing' : `${dino.species} tooth`;
    const artifact = new Artifact(dino.x, dino.y, 'trophy', artifactName);
    this.simulation.entityManager.add(artifact);
    // No setOccupied — artifacts don't block movement

    const achieveMsg = `${dino.attacker ?? 'Turret'} dropped: ${artifactName}`;
    this.uiManager.addEvent(achieveMsg);
    this.uiManager.addLog(achieveMsg);
    this.uiManager.checkMilestone('survivedDino');
  }

  private checkGameOver(): void {
    if (this.gameOver) return;
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    const alive = settlers.filter(s => s.isAlive);

    // Game over if any colonist dies (story requires all 3)
    if (alive.length < 3) {
      const dead = settlers.find(s => !s.isAlive);
      if (dead) {
        this.uiManager.addLog(`💀 ${dead.name} погиб. Колония не может функционировать без полного состава.`);
      }
      this.showGameOver();
      return;
    }

    if (this.selectedSettler && !this.selectedSettler.isAlive) {
      this.selectedSettler = alive[0];
      this.uiManager.addLog(`${languageManager.ui.selected}: ${this.selectedSettler.name} (${this.selectedSettler.settlerClass})`);
    }
  }

  private createDinosaurAnims(): void {
    for (const [species, def] of Object.entries(dinosaursData) as [string, any][]) {
      if (!def.animations) continue;
      for (const [animName, cfg] of Object.entries(def.animations) as [string, any][]) {
        const key = `${species}_${animName}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(species, {
            start: cfg.start,
            end: cfg.start + cfg.frames - 1,
          }),
          frameRate: cfg.rate,
          repeat: -1,
        });
      }
    }
  }

  private createSettlerAnims(): void {
    const defs: Record<string, { start: number; frames: number; rate: number }> = {
      idle: { start: 0, frames: 4, rate: 4 },
      walk: { start: 4, frames: 8, rate: 12 },
      gather: { start: 12, frames: 6, rate: 10 },
      attack: { start: 18, frames: 5, rate: 14 },
    };
    for (const [animName, cfg] of Object.entries(defs)) {
      const key = `settler_${animName}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('settler', {
          start: cfg.start,
          end: cfg.start + cfg.frames - 1,
        }),
        frameRate: cfg.rate,
        repeat: animName === 'attack' ? 0 : -1,
      });
    }
  }

  private showGameOver(): void {
    this.gameOver = true;
    this.debugPanel.paused = true;
    this.inputHandler.hideHover();
    this.replayRecorder.stop();
    this.replayRecorder.autoSave();
    this.gameOverScreen.show(this.simulation.tickCount, () => this.scene.start('BootScene'), this.questManager);
  }

  private onSave(): void {
    SaveManager.save(this.simulation);
    this.uiManager.addLog(languageManager.ui.logSaved);
  }

  private onLoad(): void {
    const loaded = SaveManager.load();
    if (!loaded) {
      this.uiManager.addLog(languageManager.ui.logNoSave);
      return;
    }
    this.simulation = loaded;
    this.rebindSystems();
    this.uiManager.setSimulation(loaded);
    this.inputHandler.setSimulation(loaded);
    this.inputHandler.setWorkSystem(this.workSystem);
    this.entityRenderer = new EntityRenderer(this, this.simulation);
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    for (const s of settlers) {
      s.currentTaskId = null;
      s.path = [];
      s.pathIndex = 0;
      s.snapVisual();
      this.artifactSystem.applyEffects(s);
    }
    for (const e of this.simulation.entityManager.getAll()) {
      e.snapVisual();
    }
    this.scrollX = 0;
    this.scrollY = 0;
    if (settlers.length > 0) {
      const s = settlers[0];
      this.scrollX = Math.max(0, s.x - Math.floor(getLayout().viewportTiles / 2));
      this.scrollY = Math.max(0, s.y - Math.floor(getLayout().viewportTiles / 2));
      this.clampScroll();
    }
    this.uiManager.selectedBuilding = null;
    this.uiManager.selectionRect.setVisible(false);
    this.uiManager.infoPanel.setVisible(false);
    this.mapRenderer.redrawMap();
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
    this.decorationGenerator?.generateDecorations(this.simulation.tileGrid, this.simulation.entityManager);
    this.decorationGenerator?.updateScroll(this.scrollX, this.scrollY);
    this.inputHandler.updateScroll(this.scrollX, this.scrollY);
    this.uiManager.updateScroll(this.scrollX, this.scrollY);
    this.uiManager.addLog(languageManager.ui.logLoaded);
    this.startMenu.destroy();
    this.worldReady = true;
    this.uiManager.setBuildButtonsEnabled(true);
    this.uiManager.setDayNightDimmed(false);
    this.uiManager.setHudButtonsEnabled(true);
    this.uiManager.setScrollButtonsEnabled(true);
    this.uiManager.startMenuOpen = false;
    this.debugPanel.setEnabled(true);
  }

  private onClearSave(): void {
    SaveManager.deleteSave();
    this.uiManager.addLog(languageManager.ui.logCleared);
  }

  private loadReplay(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          this.scene.start('ReplayScene', { replay: data });
        } catch {
          this.uiManager.addLog('Failed to load replay file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}
