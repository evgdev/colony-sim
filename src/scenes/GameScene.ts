import Phaser from 'phaser';
import {
  MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES,
  CANVAS_WIDTH, CANVAS_HEIGHT,
} from '../config';
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
import { ArtifactSystem } from '../systems/ArtifactSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { QuestManager } from '../systems/QuestManager';
import { DialogueBox } from '../ui/DialogueBox';
import { LabJournal } from '../ui/LabJournal';
import { TaskPriority } from '../core/Task';
import { SaveManager } from '../core/SaveManager';
import { DebugPanel } from '../ui/DebugPanel';
import { languageManager } from '../data/LanguageManager';
import dinosaursData from '../data/dinosaurs.json';

import { createBuildingIcons, createTileTextures, createDecorationTextures, createTrexSprite, createRaptorSprite, createBrontosaurSprite, createPterodactylSprite, createSettlerSprite } from '../rendering/TextureGenerator';
import { AnimatedMapRenderer } from '../rendering/AnimatedMapRenderer';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { DecorationGenerator } from '../rendering/DecorationGenerator';
import { UIManager } from '../ui/UIManager';
import { InputHandler } from '../ui/InputHandler';
import { MenuSystem } from '../ui/MenuSystem';
import { ToastManager } from '../ui/ToastManager';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';

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
  artifactSystem!: ArtifactSystem;
  questSystem!: QuestSystem;
  questManager!: QuestManager;
  dialogueBox!: DialogueBox;
  labJournal!: LabJournal;
  debugPanel!: DebugPanel;
  replayRecorder!: ReplayRecorder;
  toastManager!: ToastManager;

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
  private resourceSpawnInterval: number = 50;
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
    }) as any;

    this.input.keyboard!.on('scroll-up', () => this.scrollBy(0, -1));
    this.input.keyboard!.on('scroll-down', () => this.scrollBy(0, 1));
    this.input.keyboard!.on('scroll-left', () => this.scrollBy(-1, 0));
    this.input.keyboard!.on('scroll-right', () => this.scrollBy(1, 0));

    this.input.keyboard!.on('keydown-ONE', () => this.selectSettlerByIndex(0));
    this.input.keyboard!.on('keydown-TWO', () => this.selectSettlerByIndex(1));
    this.input.keyboard!.on('keydown-THREE', () => this.selectSettlerByIndex(2));

    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.dialogueBox?.isVisible) {
        this.dialogueBox.nextLine();
        return;
      }
      if (this.attackedSettler && this.attackedSettler.isAlive) {
        this.selectSettler(this.attackedSettler);
        this.attackedSettler = null;
      }
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.dialogueBox?.isVisible) {
        this.dialogueBox.nextLine();
      }
    });

    this.simulation = new Simulation(MAP_WIDTH, MAP_HEIGHT);
    this.rebindSystems();

    createTileTextures(this);
    createBuildingIcons(this);
    createDecorationTextures(this);
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
    this.inputHandler.createHoverRect();
    this.inputHandler.createSelectionRect();
    this.inputHandler.setupInputHandlers();
    this.inputHandler.updateScroll(this.scrollX, this.scrollY);

    this.inputHandler.recorder = this.replayRecorder;

    this.debugPanel = new DebugPanel(this);
    this.toastManager = new ToastManager(this);
    this.dialogueBox = new DialogueBox(this);
    this.labJournal = new LabJournal(this);
    this.wallOverlay = this.add.graphics().setDepth(6);
    this.exploreOverlay = this.add.graphics().setDepth(6);
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
    this.needsSystem = new NeedsSystem();
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

    // QuestManager — full quest tree
    this.questManager = new QuestManager();
    this.questManager.onEvent((event) => {
      if (event.type === 'dialogue' && event.dialogue) {
        this.dialoguePaused = true;
        this.inputHandler?.hideHover();
        this.dialogueBox?.show(event.dialogue, () => {
          this.dialoguePaused = false;
          this.questManager?.onDialogueComplete();
        });
      } else if (event.message) {
        this.uiManager?.addLog(event.message);
        this.uiManager?.addEvent(event.message);
        if (event.type !== 'quest_objective_progress') {
          this.toastManager?.show(event.message);
        }
      }
    });
    // Emit act1 intro dialogue now that callback is registered
    if (this.gameMode === 'story') {
      this.questManager!.flushPendingIntro();
    }
    // Start the first quest after short delay — decorations already generated
    // To skip to a specific quest, change SKIP_TO_QUEST (e.g. 'q2_2')
    const SKIP_TO_QUEST: string | null = null; // set to null for normal start
    //const SKIP_TO_QUEST: string | null = 'q2_2'; // set to null for normal start
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

      this.scrollX = Math.max(0, world.centerX - Math.floor(VIEWPORT_TILES / 2));
      this.scrollY = Math.max(0, world.centerY - Math.floor(VIEWPORT_TILES / 2));
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
    const allQuestIds = ['q1_1', 'q1_2'];
    for (const qid of allQuestIds) {
      if (qid === targetQuestId) break;
      const state = qm.getQuestState(qid);
      if (state && (state.status === 'active' || state.status === 'available')) {
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

    // Start the target quest
    qm['currentAct'] = 'act1_crash';
    qm.startQuest(targetQuestId, this.simulation.tickCount);
    this.uiManager?.addLog(`[SKIP] Квест: ${qm.getQuest(targetQuestId)?.title}`);
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
      this.handleScrollInput();

      if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
        this.cycleSettler();
      }

      if (!this.debugPanel.paused) {
        this.runSystems(delta);
      }

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
    this.workSystem.update(td);
    this.buildingSystem.update(td);
    this.dinosaurSystem.update(td, this.simulation.tickCount, this.gameMode === 'defense');
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
    if (existing >= 25) return;

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
        this.simulation.tileGrid.setOccupied(x, y, true);
        break;
      }
    }
  }

  private isDinosEnabled(): boolean { return false; }

  private dinoSpawnTimer: number = 0;

  private spawnQuestDinos(): void {
    const qm = this.questManager;
    if (!qm) return;

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
    this.simulation.tileGrid.updateFog(delta);
    this.mapRenderer.updateNight(this.simulation.tickCount);
    this.entityRenderer.drawEntities();
    this.entityRenderer.drawPath();
    this.decorationGenerator?.drawChopProgress(this.scrollX, this.scrollY);
    this.updateWallOverlay();
    this.updateExploreMarkers();
    this.uiManager.updateLeftPanel(this.gameOver, this.simulation.tickCount);
    this.uiManager.updateSelection();
    this.uiManager.updateInfoPanel();
    this.uiManager.updateMinimap();
    this.debugPanel.update(this.simulation);
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

    const tileSize = 50;
    const fieldX = 250;
    const fieldY = 50;
    const fieldMaxX = fieldX + VIEWPORT_TILES * tileSize;
    const fieldMaxY = fieldY + VIEWPORT_TILES * tileSize;
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

    // Show markers for active explore quests
    const active = qm.getActiveQuests();
    const exploreQuest = active.find(q => q.quest.type === 'explore');
    if (!exploreQuest) return;

    const tileSize = 50;
    const fieldX = 250;
    const fieldY = 50;
    const fieldMaxX = fieldX + VIEWPORT_TILES * tileSize;
    const fieldMaxY = fieldY + VIEWPORT_TILES * tileSize;
    const sx = this.scrollX;
    const sy = this.scrollY;
    const centerX = Math.floor(this.simulation.tileGrid.width / 2);
    const centerY = Math.floor(this.simulation.tileGrid.height / 2);
    const g = this.exploreOverlay;

    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;

    for (const obj of exploreQuest.state.objectives) {
      if (obj.type !== 'reach_tile' || obj.found) continue;
      if (obj.x === undefined || obj.y === undefined) continue;

      const tileX = centerX + obj.x;
      const tileY = centerY + obj.y;

      // Skip water tiles — natural barrier
      const tile = this.simulation.tileGrid.get(tileX, tileY);
      if (!tile || tile.type === 'water') continue;

      const px = fieldX + (tileX - sx) * tileSize + tileSize / 2;
      const py = fieldY + (tileY - sy) * tileSize + tileSize / 2;

      // Skip if outside viewport
      if (px < fieldX - tileSize || px > fieldMaxX + tileSize) continue;
      if (py < fieldY - tileSize || py > fieldMaxY + tileSize) continue;

      // Pulsing diamond marker
      g.lineStyle(2, 0xff8800, pulse);
      const r = 14;
      g.beginPath();
      g.moveTo(px, py - r);
      g.lineTo(px + r, py);
      g.lineTo(px, py + r);
      g.lineTo(px - r, py);
      g.closePath();
      g.strokePath();

      // Inner dot
      g.fillStyle(0xff8800, pulse * 0.5);
      g.fillCircle(px, py, 4);
    }
  }

  private handleScrollInput(): void {
    let dx = 0;
    let dy = 0;

    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const newScrollX = this.scrollX + dx;
      const newScrollY = this.scrollY + dy;
      if (newScrollX >= 0 && newScrollX <= MAP_WIDTH - VIEWPORT_TILES) {
        this.scrollX = newScrollX;
      }
      if (newScrollY >= 0 && newScrollY <= MAP_HEIGHT - VIEWPORT_TILES) {
        this.scrollY = newScrollY;
      }
      this.updateScrollPosition();
    }
  }

  private scrollBy(dx: number, dy: number): void {
    const newScrollX = this.scrollX + dx;
    const newScrollY = this.scrollY + dy;
    if (newScrollX >= 0 && newScrollX <= MAP_WIDTH - VIEWPORT_TILES) {
      this.scrollX = newScrollX;
    }
    if (newScrollY >= 0 && newScrollY <= MAP_HEIGHT - VIEWPORT_TILES) {
      this.scrollY = newScrollY;
    }
    this.updateScrollPosition();
  }

  private scrollTo(tileX: number, tileY: number): void {
    this.scrollX = Math.max(0, Math.min(tileX - Math.floor(VIEWPORT_TILES / 2), MAP_WIDTH - VIEWPORT_TILES));
    this.scrollY = Math.max(0, Math.min(tileY - Math.floor(VIEWPORT_TILES / 2), MAP_HEIGHT - VIEWPORT_TILES));
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
    this.scrollX = Math.max(0, Math.min(this.scrollX, MAP_WIDTH - VIEWPORT_TILES));
    this.scrollY = Math.max(0, Math.min(this.scrollY, MAP_HEIGHT - VIEWPORT_TILES));
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
    this.simulation.tileGrid.setOccupied(dino.x, dino.y, true);

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
      this.scrollX = Math.max(0, s.x - Math.floor(VIEWPORT_TILES / 2));
      this.scrollY = Math.max(0, s.y - Math.floor(VIEWPORT_TILES / 2));
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
