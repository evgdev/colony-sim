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
import { TaskPriority } from '../core/Task';
import { SaveManager } from '../core/SaveManager';
import { DebugPanel } from '../ui/DebugPanel';
import { languageManager } from '../data/LanguageManager';
import dinosaursData from '../data/dinosaurs.json';

import { createBuildingIcons, createTileTextures, createDecorationTextures, createTrexSprite } from '../rendering/TextureGenerator';
import { AnimatedMapRenderer } from '../rendering/AnimatedMapRenderer';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { DecorationGenerator } from '../rendering/DecorationGenerator';
import { UIManager } from '../ui/UIManager';
import { InputHandler } from '../ui/InputHandler';
import { ToastManager } from '../ui/ToastManager';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';

import { createInitialWorld, buildStartingPerimeter } from '../game/GameSetup';
import { StartMenu } from '../game/StartMenu';
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

  private gameOver: boolean = false;
  private worldReady: boolean = false;

  private startMenu!: StartMenu;
  private gameOverScreen!: GameOverScreen;

  private scrollX: number = 0;
  private scrollY: number = 0;
  private resourceSpawnTimer: number = 0;
  private resourceSpawnInterval: number = 50;
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

  preload(): void {}

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
      if (this.attackedSettler && this.attackedSettler.isAlive) {
        this.selectSettler(this.attackedSettler);
        this.attackedSettler = null;
      }
    });

    this.simulation = new Simulation(MAP_WIDTH, MAP_HEIGHT);
    this.rebindSystems();

    createTileTextures(this);
    createBuildingIcons(this);
    createDecorationTextures(this);
    createTrexSprite(this);
    this.createDinosaurAnims();

    this.mapRenderer = new AnimatedMapRenderer(this, this.simulation);
    this.mapRenderer.drawMap();
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);

    this.decorationGenerator = new DecorationGenerator(this);
    this.decorationGenerator.generateDecorations(this.simulation.tileGrid, this.simulation.entityManager);

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
    this.uiManager.createSettlerIcons((index) => this.selectSettlerByIndex(index));
    this.uiManager.updateScroll(this.scrollX, this.scrollY);

    this.entityRenderer = new EntityRenderer(this, this.simulation);
    this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.drawEntities();

    this.inputHandler = new InputHandler(this, this.simulation, this.uiManager, this.workSystem, this.artifactSystem);
    this.inputHandler.scrollTo = (tileX: number, tileY: number) => this.scrollTo(tileX, tileY);
    this.inputHandler.createHoverRect();
    this.inputHandler.createSelectionRect();
    this.inputHandler.setupInputHandlers();
    this.inputHandler.updateScroll(this.scrollX, this.scrollY);

    this.inputHandler.recorder = this.replayRecorder;

    this.debugPanel = new DebugPanel(this);
    this.toastManager = new ToastManager(this);
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
    this.buildingSystem = new BuildingSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
    this.buildingSystem.onDinoKilled = (dino) => this.dropArtifact(dino);
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
      onStart: (difficulty) => this.startGame(difficulty),
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

  private startGame(difficulty: 'easy' | 'hard'): void {
    this.startMenu.destroy();
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

      if (difficulty === 'easy') {
        buildStartingPerimeter(this.simulation, this.artifactSystem);
        this.uiManager?.addLog(`${languageManager.ui.logBuildingAt} perimeter wall + gate`);
      } else {
        this.uiManager.addLog(`${languageManager.ui.hard}: ${languageManager.ui.hardDesc}`);
      }

      // TEST: spawn T-Rex near settlers
      const trexDef = (dinosaursData as any).trex;
      const trex = new Dinosaur(
        world.centerX + 5, world.centerY,
        'trex', trexDef.hp, trexDef.speed, trexDef.aggroRange,
        trexDef.size, trexDef.attackDamage, trexDef.wallDamage ?? 30, trexDef.footprint ?? 1
      );
      this.simulation.entityManager.add(trex);
      this.simulation.tileGrid.setOccupiedArea(trex.x, trex.y, trex.footprint, true);
      this.uiManager?.addLog('TEST: T-Rex (1x1) spawned at ' + trex.x + ',' + trex.y);

      // Play T-Rex footstep sound (once)
      if (this.cache.audio.exists('trex_footstep')) {
        this.sound.play('trex_footstep', { volume: 0.5 });
      }

      this.mapRenderer.drawMap();
      this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
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

  update(time: number, delta: number): void {
    if (this.gameOver) return;
    if (!this.worldReady) return;

    try {
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
      this.simulation.tickCount
    );
    this.workSystem.update(td);
    this.buildingSystem.update(td);
    this.dinosaurSystem.update(td, this.simulation.tickCount);
    this.processCombat(this.combatSystem.update(td));

    for (const s of this.simulation.entityManager.getByType('settler') as Settler[]) {
      const prevHp = hpBefore.get(s.id) ?? s.hp;
      if (s.hp < prevHp && s.isAlive) {
        this.attackedSettler = s;
        this.toastManager.show(`${s.name} is under attack! (SPACE to jump)`);
      }
    }

    this.spawnResources();
    this.uiManager.updateThoughts(ticked);
    this.checkGameOver();
    this.uiManager.updateBuildButtonStates();
    this.replayRecorder.onTick(this.simulation.tickCount);
  }

  private spawnResources(): void {
    this.resourceSpawnTimer++;
    if (this.resourceSpawnTimer < this.resourceSpawnInterval) return;
    this.resourceSpawnTimer = 0;

    const existing = this.simulation.entityManager.getByType('resource').length;
    if (existing >= 20) return;

    for (let i = 0; i < 10; i++) {
      const x = Math.floor(Math.random() * MAP_WIDTH);
      const y = Math.floor(Math.random() * MAP_HEIGHT);
      const tile = this.simulation.tileGrid.get(x, y);
      if (!tile || !tile.walkable || tile.type === 'water' || tile.occupied) continue;

      const type = Math.random() < 0.5 ? 'wood' : 'stone';
      const qty = Math.floor(Math.random() * 15) + 5;
      const res = new Resource(x, y, type, qty);
      this.simulation.entityManager.add(res);
      this.simulation.tileGrid.setOccupied(x, y, true);
      break;
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
    this.uiManager.updateLeftPanel(this.gameOver, this.simulation.tickCount);
    this.uiManager.updateSelection();
    this.uiManager.updateInfoPanel();
    this.uiManager.updateMinimap();
    this.debugPanel.update(this.simulation);
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
    this.simulation.entityManager.remove(bld.id);
    this.simulation.tileGrid.setOccupied(bld.x, bld.y, false);
    this.simulation.tileGrid.setBuilding(bld.x, bld.y, false);
    if (bld.buildingType === 'gate') {
      this.simulation.tileGrid.setGate(bld.x, bld.y, false);
      this.simulation.tileGrid.setDinoBlocked(bld.x, bld.y, false);
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

    if (alive.length === 0) {
      this.showGameOver();
      return;
    }

    if (this.selectedSettler && !this.selectedSettler.isAlive) {
      this.selectedSettler = alive[0];
      this.uiManager.addLog(`Selected: ${this.selectedSettler.name} (${this.selectedSettler.settlerClass})`);
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

  private showGameOver(): void {
    this.gameOver = true;
    this.debugPanel.paused = true;
    this.inputHandler.hideHover();
    this.replayRecorder.stop();
    this.replayRecorder.autoSave();
    this.gameOverScreen.show(this.simulation.tickCount, () => this.scene.start('BootScene'));
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
