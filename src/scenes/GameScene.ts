import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES, COLORS,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  FOG_REVEAL_RADIUS,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Artifact } from '../entities/Artifact';
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
import buildingsData from '../data/buildings.json';

import { createBuildingIcons, createTileTextures } from '../rendering/TextureGenerator';
import { MapRenderer } from '../rendering/MapRenderer';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { UIManager } from '../ui/UIManager';
import { InputHandler } from '../ui/InputHandler';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayActionType } from '../replay/ReplayTypes';

const TICKS_PER_DAY = 24;

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

  selectedSettler!: Settler;

  private mapRenderer!: MapRenderer;
  private entityRenderer!: EntityRenderer;
  private uiManager!: UIManager;
  private inputHandler!: InputHandler;

  private gameOver: boolean = false;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private worldReady: boolean = false;
  private startMenu: Phaser.GameObjects.Container | null = null;

  private scrollX: number = 0;
  private scrollY: number = 0;
  private scrollSpeed: number = 5;
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

  preload(): void {
  }

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

    this.simulation = new Simulation(MAP_WIDTH, MAP_HEIGHT);
    this.rebindSystems();

    createTileTextures(this);
    createBuildingIcons(this);

    this.mapRenderer = new MapRenderer(this, this.simulation);
    this.mapRenderer.drawMap();
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);

    this.uiManager = new UIManager(this, this.simulation);
    this.uiManager.setArtifactSystem(this.artifactSystem);
    this.replayRecorder = new ReplayRecorder(this.simulation);
    this.uiManager.replayRecorder = this.replayRecorder;
    this.uiManager.createEventArea();
    this.uiManager.createLeftPanel();
    this.uiManager.createActionLog();
    this.uiManager.createInfoPanel();
    this.uiManager.onCollectCallback = (entity) => this.handleCollect(entity);
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

    this.uiManager.createBottomHUD(
      () => {
        SaveManager.save(this.simulation);
        this.uiManager.addLog(languageManager.ui.logSaved);
      },
      () => {
        const loaded = SaveManager.load();
        if (loaded) {
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
          this.inputHandler.updateScroll(this.scrollX, this.scrollY);
          this.uiManager.updateScroll(this.scrollX, this.scrollY);
          this.uiManager.addLog(languageManager.ui.logLoaded);
          this.destroyStartMenu();
          this.worldReady = true;
          this.uiManager.setBuildButtonsEnabled(true);
          this.uiManager.setDayNightDimmed(false);
          this.uiManager.setHudButtonsEnabled(true);
          this.uiManager.setScrollButtonsEnabled(true);
          this.uiManager.startMenuOpen = false;
          this.debugPanel.setEnabled(true);
        } else {
          this.uiManager.addLog(languageManager.ui.logNoSave);
        }
      },
      () => {
        SaveManager.deleteSave();
        this.uiManager.addLog(languageManager.ui.logCleared);
      },
      () => {
        createBuildingIcons(this);
      },
      this.debugPanel,
      () => {
        this.replayRecorder.stop();
        this.scene.start('BootScene');
      }
    );

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
      }
    );
    this.combatSystem = new CombatSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
  }

  private showStartMenu(): void {
    this.worldReady = false;
    const menuX = FIELD_X;
    const menuY = FIELD_Y;
    const menuW = FIELD_W;
    const menuH = FIELD_H;
    const cx = menuX + menuW / 2;
    const cy = menuY + menuH / 2;
    const menu = this.add.container(0, 0).setDepth(100);

    const img = this.add.image(cx, cy, 'startMenuBg').setDisplaySize(menuW, menuH);
    menu.add(img);

    const bg = this.add.rectangle(cx, cy, menuW, menuH, 0x0d1117, 0.5)
      .setStrokeStyle(2, 0x58a6ff);
    menu.add(bg);

    const title = this.add.text(cx, cy - 78, languageManager.ui.difficulty, {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.add(title);

    const makeButton = (label: string, desc: string, y: number, cb: () => void) => {
      const btn = this.add.text(cx, y, `${label}\n${desc}`, {
        fontSize: '16px', color: '#c9d1d9', fontFamily: 'monospace',
        backgroundColor: '#21262d', padding: { x: 12, y: 8 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#58a6ff'));
      btn.on('pointerout', () => btn.setColor('#c9d1d9'));
      btn.on('pointerdown', cb);
      menu.add(btn);
    };

    makeButton(languageManager.ui.easy, languageManager.ui.easyDesc, cy - 12, () => this.time.delayedCall(0, () => this.startGame('easy')));
    makeButton(languageManager.ui.hard, languageManager.ui.hardDesc, cy + 52, () => this.time.delayedCall(0, () => this.startGame('hard')));

    const replayLabel = this.add.text(cx, cy + 116, '--- Replay ---', {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    menu.add(replayLabel);

    const loadFileBtn = this.add.text(cx, cy + 140, '[Load replay from file]', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      backgroundColor: '#21262d', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    loadFileBtn.on('pointerover', () => loadFileBtn.setColor('#58a6ff'));
    loadFileBtn.on('pointerout', () => loadFileBtn.setColor('#c9d1d9'));
    loadFileBtn.on('pointerdown', () => this.loadReplay());
    menu.add(loadFileBtn);

    this.uiManager.setBuildButtonsEnabled(false);
    this.uiManager.setDayNightDimmed(true);
    this.uiManager.setHudButtonsEnabled(false);
    this.uiManager.setScrollButtonsEnabled(false);
    this.uiManager.startMenuOpen = true;
    this.debugPanel.setEnabled(false);
    this.input.setDefaultCursor('default');

    this.startMenu = menu;
  }

  private destroyStartMenu(): void {
    if (this.startMenu) {
      this.startMenu.destroy();
      this.startMenu = null;
    }
  }

  private startGame(difficulty: 'easy' | 'hard'): void {
    this.destroyStartMenu();
    this.worldReady = true;
    this.uiManager.setBuildButtonsEnabled(true);
    this.uiManager.setDayNightDimmed(false);
    this.uiManager.setHudButtonsEnabled(true);
    this.uiManager.setScrollButtonsEnabled(true);
    this.uiManager.startMenuOpen = false;
    this.debugPanel.setEnabled(true);
    try {
      const centerX = Math.floor(MAP_WIDTH / 2);
      const centerY = Math.floor(MAP_HEIGHT / 2);

      const settlers = [
        new Settler(centerX - 1, centerY, 'Engineer', 0x4488ff, 'engineer'),
        new Settler(centerX, centerY, 'Biologist', 0x44ff44, 'biologist'),
        new Settler(centerX + 1, centerY, 'Pilot', 0xffaa00, 'pilot'),
      ];
      for (const s of settlers) {
        this.simulation.entityManager.add(s);
        this.simulation.tileGrid.setOccupied(s.x, s.y, true);
      }
      this.simulation.tileGrid.reveal(centerX, centerY, FOG_REVEAL_RADIUS);
      this.selectedSettler = settlers[0];

      this.replayRecorder.start();

      this.scrollX = Math.max(0, centerX - Math.floor(VIEWPORT_TILES / 2));
      this.scrollY = Math.max(0, centerY - Math.floor(VIEWPORT_TILES / 2));
      this.clampScroll();

      const resources = [
        { x: centerX - 2, y: centerY - 1, type: 'wood', qty: 20 },
        { x: centerX + 2, y: centerY - 1, type: 'stone', qty: 15 },
        { x: centerX - 1, y: centerY + 2, type: 'wood', qty: 10 },
        { x: centerX + 1, y: centerY + 2, type: 'stone', qty: 8 },
        { x: centerX, y: centerY - 3, type: 'wood', qty: 12 },
        { x: centerX, y: centerY + 3, type: 'stone', qty: 10 },
      ];

      for (const r of resources) {
        const tile = this.simulation.tileGrid.get(r.x, r.y);
        if (!tile || !tile.walkable || tile.type === 'water') continue;
        const res = new Resource(r.x, r.y, r.type, r.qty);
        this.simulation.entityManager.add(res);
        this.simulation.tileGrid.setOccupied(r.x, r.y, true);
      }

      if (difficulty === 'easy') {
        this.buildStartingPerimeter();
      } else {
        this.uiManager.addLog(`${languageManager.ui.hard}: ${languageManager.ui.hardDesc}`);
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
    this.needsSystem.update(
      this.simulation.entityManager.getByType('settler') as Settler[],
      td,
      this.simulation.tickCount
    );
    this.workSystem.update(td);
    this.buildingSystem.update(td);
    this.dinosaurSystem.update(td, this.simulation.tickCount);
    this.processCombat(this.combatSystem.update(td));
    this.uiManager.updateThoughts(ticked);
    this.checkGameOver();
    this.uiManager.updateBuildButtonStates();
    this.replayRecorder.onTick(this.simulation.tickCount);
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
    this.mapRenderer.redrawFog();
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

  private buildStartingPerimeter(): void {
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    if (settlers.length === 0) return;

    let minX = Math.min(...settlers.map(s => s.x));
    let maxX = Math.max(...settlers.map(s => s.x));
    let minY = Math.min(...settlers.map(s => s.y));
    let maxY = Math.max(...settlers.map(s => s.y));
    const margin = 3;
    minX = Math.max(0, minX - margin);
    maxX = Math.min(MAP_WIDTH - 1, maxX + margin);
    minY = Math.max(0, minY - margin);
    maxY = Math.min(MAP_HEIGHT - 1, maxY + margin);

    const wallDef = (buildingsData as any).wall;
    const gateDef = (buildingsData as any).gate;

    const findFreeInterior = (): { x: number; y: number } | null => {
      for (let y = minY + 1; y < maxY; y++) {
        for (let x = minX + 1; x < maxX; x++) {
          const t = this.simulation.tileGrid.get(x, y);
          if (!t || !t.walkable || t.occupied) continue;
          if (this.simulation.entityManager.getAll().some(e => e.x === x && e.y === y)) continue;
          return { x, y };
        }
      }
      return null;
    };

    const placePerimeter = (x: number, y: number, isGate: boolean) => {
      const tile = this.simulation.tileGrid.get(x, y);
      if (!tile || !tile.walkable) return;

      const occupant = this.simulation.entityManager.getAll().find(e => e.x === x && e.y === y);
      if (occupant && occupant.entityType === 'settler') return;
      if (occupant && occupant.entityType === 'resource') {
        const spot = findFreeInterior();
        if (spot) {
          (occupant as Resource).moveTo(spot.x, spot.y);
          (occupant as Resource).snapVisual();
          this.simulation.tileGrid.setOccupied(spot.x, spot.y, true);
        } else {
          this.simulation.entityManager.remove(occupant.id);
        }
        this.simulation.tileGrid.setOccupied(x, y, false);
      }

      const def = isGate ? gateDef : wallDef;
      const b = new Building(x, y, isGate ? 'gate' : 'wall', def.maxHp, def.buildTime, []);
      b.hp = def.maxHp;
      b.built = true;
      b.buildProgress = def.buildTime;
      b.requiresConsumed = true;
      b.storageCapacity = (def.storageCapacity ?? 0) + this.artifactSystem.getStorageBonus();
      this.simulation.entityManager.add(b);
      this.simulation.tileGrid.reveal(x, y, 1);
      this.simulation.tileGrid.setBuilding(x, y, true);
      if (isGate) {
        this.simulation.tileGrid.setGate(x, y, true);
        this.simulation.tileGrid.setDinoBlocked(x, y, true);
      } else {
        this.simulation.tileGrid.setOccupied(x, y, true);
      }
    };

    const gateX = Math.floor((minX + maxX) / 2);
    const gateY = maxY;

    for (let x = minX; x <= maxX; x++) {
      placePerimeter(x, minY, false);
      placePerimeter(x, maxY, x === gateX);
    }
    for (let y = minY + 1; y < maxY; y++) {
      placePerimeter(minX, y, false);
      placePerimeter(maxX, y, false);
    }

    this.uiManager?.addLog(`${languageManager.ui.logBuildingAt} perimeter wall + gate`);
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
      this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
      this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
      this.inputHandler.updateScroll(this.scrollX, this.scrollY);
      this.uiManager.updateScroll(this.scrollX, this.scrollY);
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
    this.uiManager.addLog(`Selected: ${this.selectedSettler.name} (${this.selectedSettler.settlerClass})`);
  }

  getAllSettlers(): Settler[] {
    return this.simulation.entityManager.getByType('settler') as Settler[];
  }

  private formatDays(ticks: number): string {
    const days = Math.floor(ticks / TICKS_PER_DAY);
    const hours = Math.floor((ticks % TICKS_PER_DAY));
    if (days === 0) return `${hours}h`;
    return `${days}d ${hours}h`;
  }

  private handleCollect(entity: import('../core/Entity').Entity): void {
    const settler = this.selectedSettler;
    if (entity.entityType === 'resource') {
      const res = entity as Resource;
      this.workSystem.createPickUpTask(res, TaskPriority.High, settler);
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

  private showGameOver(): void {
    this.gameOver = true;
    this.debugPanel.paused = true;
    this.inputHandler.hideHover();
    this.replayRecorder.stop();
    this.replayRecorder.autoSave();

    this.gameOverContainer = this.add.container(0, 0).setDepth(100);

    const bg = this.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.9)
      .setOrigin(0);
    this.gameOverContainer.add(bg);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    const title = this.add.text(cx, cy - 80, languageManager.ui.gameOver, {
      fontSize: '32px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gameOverContainer.add(title);

    const lines = languageManager.narrative.combat.settlerDeath;
    const epitaph = lines[Math.floor(Math.random() * lines.length)].replace('{name}', 'Worker');
    const sub = this.add.text(cx, cy - 20, epitaph, {
      fontSize: '16px', color: '#c9d1d9', fontFamily: 'monospace',
      align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5);
    this.gameOverContainer.add(sub);

    const ticks = this.add.text(cx, cy + 30, `${languageManager.ui.survived} ${this.formatDays(this.simulation.tickCount)}`, {
      fontSize: '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.gameOverContainer.add(ticks);

    const restartBtn = this.add.text(cx, cy + 90, `[${languageManager.ui.restart}]`, {
      fontSize: '20px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('BootScene');
      })
      .on('pointerover', () => restartBtn.setColor('#ffffff'))
      .on('pointerout', () => restartBtn.setColor('#ffd700'));
    this.gameOverContainer.add(restartBtn);
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
        } catch (err) {
          this.uiManager.addLog('Failed to load replay file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
}
