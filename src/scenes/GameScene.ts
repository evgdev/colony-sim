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
import { TaskPriority } from '../core/Task';
import { SaveManager } from '../core/SaveManager';
import { DebugPanel } from '../ui/DebugPanel';
import { languageManager } from '../data/LanguageManager';

import { createBuildingIcons, createTileTextures } from '../rendering/TextureGenerator';
import { MapRenderer } from '../rendering/MapRenderer';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { UIManager } from '../ui/UIManager';
import { InputHandler } from '../ui/InputHandler';

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
  debugPanel!: DebugPanel;

  private mapRenderer!: MapRenderer;
  private entityRenderer!: EntityRenderer;
  private uiManager!: UIManager;
  private inputHandler!: InputHandler;

  private gameOver: boolean = false;
  private gameOverContainer!: Phaser.GameObjects.Container;

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
    }) as any;

    this.input.keyboard!.on('scroll-up', () => this.scrollBy(0, -1));
    this.input.keyboard!.on('scroll-down', () => this.scrollBy(0, 1));
    this.input.keyboard!.on('scroll-left', () => this.scrollBy(-1, 0));
    this.input.keyboard!.on('scroll-right', () => this.scrollBy(1, 0));

    this.simulation = new Simulation(MAP_WIDTH, MAP_HEIGHT);
    this.movementSystem = new MovementSystem(this.simulation.tileGrid);
    this.needsSystem = new NeedsSystem();
    this.workSystem = new WorkSystem(
      this.movementSystem,
      this.simulation.tileGrid,
      this.simulation.entityManager,
      this.simulation.taskQueue
    );
    this.artifactSystem = new ArtifactSystem();
    this.workSystem.artifactSystem = this.artifactSystem;
    this.buildingSystem = new BuildingSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
    this.dinosaurSystem = new DinosaurSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid,
      (name) => {
        const lines = languageManager.narrative.combat.settlerDeath;
        const msg = lines[Math.floor(Math.random() * lines.length)].replace('{name}', name);
        this.uiManager.addLog(msg);
      },
      (species) => {
        const spawns = languageManager.narrative.dinosaurSpawns[species as keyof typeof languageManager.narrative.dinosaurSpawns];
        if (spawns && spawns.length > 0) {
          const msg = spawns[Math.floor(Math.random() * spawns.length)];
          this.uiManager.addLog(msg);
          this.uiManager.addEvent(msg);
        }
      }
    );
    this.combatSystem = new CombatSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );
    this.artifactSystem = new ArtifactSystem();

    const centerX = Math.floor(MAP_WIDTH / 2);
    const centerY = Math.floor(MAP_HEIGHT / 2);
    const settler = new Settler(centerX, centerY, 'Worker');
    this.simulation.entityManager.add(settler);
    this.simulation.tileGrid.setOccupied(centerX, centerY, true);
    this.simulation.tileGrid.reveal(centerX, centerY, FOG_REVEAL_RADIUS);

    this.scrollX = Math.max(0, centerX - Math.floor(VIEWPORT_TILES / 2));
    this.scrollY = Math.max(0, centerY - Math.floor(VIEWPORT_TILES / 2));
    this.clampScroll();

    const resources = [
      { x: 2, y: 2, type: 'wood', qty: 20 },
      { x: 27, y: 3, type: 'stone', qty: 15 },
      { x: 4, y: 25, type: 'wood', qty: 10 },
      { x: 20, y: 8, type: 'stone', qty: 8 },
      { x: 8, y: 18, type: 'wood', qty: 12 },
      { x: 22, y: 22, type: 'stone', qty: 10 },
    ];

    for (const r of resources) {
      const tile = this.simulation.tileGrid.get(r.x, r.y);
      if (!tile || !tile.walkable || tile.type === 'water') continue;
      const res = new Resource(r.x, r.y, r.type, r.qty);
      this.simulation.entityManager.add(res);
      this.simulation.tileGrid.setOccupied(r.x, r.y, true);
    }

    createTileTextures(this);
    createBuildingIcons(this);

    this.mapRenderer = new MapRenderer(this, this.simulation);
    this.mapRenderer.drawMap();
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);

    this.uiManager = new UIManager(this, this.simulation);
    this.uiManager.setArtifactSystem(this.artifactSystem);
    this.uiManager.createEventArea();
    this.uiManager.createLeftPanel();
    this.uiManager.createActionLog();
    this.uiManager.createInfoPanel();
    this.uiManager.onCollectCallback = (entity) => this.handleCollect(entity);
    this.uiManager.updateScroll(this.scrollX, this.scrollY);

    this.entityRenderer = new EntityRenderer(this, this.simulation);
    this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.drawEntities();

    this.inputHandler = new InputHandler(this, this.simulation, this.uiManager, this.workSystem);
    this.inputHandler.scrollTo = (tileX: number, tileY: number) => this.scrollTo(tileX, tileY);
    this.inputHandler.createHoverRect();
    this.inputHandler.createSelectionRect();
    this.inputHandler.setupInputHandlers();
    this.inputHandler.updateScroll(this.scrollX, this.scrollY);

    this.uiManager.createBottomHUD(
      () => {
        SaveManager.save(this.simulation);
        this.uiManager.addLog(languageManager.ui.logSaved);
      },
      () => {
        const loaded = SaveManager.load();
        if (loaded) {
          this.simulation = loaded;
          this.uiManager.setSimulation(loaded);
          this.inputHandler.setSimulation(loaded);
          this.entityRenderer = new EntityRenderer(this, this.simulation);
          this.movementSystem = new MovementSystem(this.simulation.tileGrid);
          this.needsSystem = new NeedsSystem();
          this.workSystem = new WorkSystem(
            this.movementSystem, this.simulation.tileGrid,
            this.simulation.entityManager, this.simulation.taskQueue
          );
          this.inputHandler.setWorkSystem(this.workSystem);
          this.buildingSystem = new BuildingSystem(
            this.simulation.entityManager, this.simulation.tileGrid
          );
          this.dinosaurSystem = new DinosaurSystem(
            this.simulation.entityManager, this.simulation.tileGrid,
            (name) => this.uiManager.addLog(`${name} was killed!`),
            (species) => {}
          );
          const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
          for (const s of settlers) {
            s.currentTaskId = null;
            s.path = [];
            s.pathIndex = 0;
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
      }
    );

    this.debugPanel = new DebugPanel(this);

    this.uiManager.addLog(languageManager.narrative.intro[0] + ` [${languageManager.ui.day} 1]`);
    this.uiManager.addEvent(languageManager.narrative.intro[1]);

    this.uiManager.updateBuildButtonStates();
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;

    this.handleScrollInput();

    if (!this.debugPanel.paused) {
      const adjustedDelta = delta * this.debugPanel.speed;
      const ticked = this.simulation.update(adjustedDelta);
      if (ticked) {
        const td = (this.simulation.tickRate / 1000) * this.debugPanel.speed;
        this.needsSystem.update(
          this.simulation.entityManager.getByType('settler') as Settler[],
          td
        );
        this.workSystem.update(td);
        this.buildingSystem.update(td);
        this.dinosaurSystem.update(td);
        const combatEvents = this.combatSystem.update(td);
        for (const e of combatEvents) {
          if (e.type === 'settler_attack') {
            const lines = languageManager.narrative.combat.settlerAttack;
            const msg = lines[Math.floor(Math.random() * lines.length)]
              .replace('{attacker}', e.attacker)
              .replace('{defender}', e.defender);
            this.uiManager.addLog(msg);
            if (e.killed && e.killedAt && e.killedSpecies) {
              const deathLines = languageManager.narrative.combat.settlerDeath;
              const deathMsg = deathLines[Math.floor(Math.random() * deathLines.length)]
                .replace('{name}', e.attacker);
              this.uiManager.addLog(deathMsg);

              const artifactName = `${e.killedSpecies} tooth`;
              const artifact = new Artifact(e.killedAt.x, e.killedAt.y, 'trophy', artifactName);
              this.simulation.entityManager.add(artifact);
              this.simulation.tileGrid.setOccupied(e.killedAt.x, e.killedAt.y, true);

              const achieveMsg = `${e.attacker} earned achievement: T-Rex Killer!`;
              this.uiManager.addEvent(achieveMsg);
              this.uiManager.addLog(achieveMsg);
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
        this.uiManager.updateThoughts(ticked);
        this.checkGameOver();
        this.uiManager.updateBuildButtonStates();
      }
    }
    this.mapRenderer.redrawFog();
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

  private formatDays(ticks: number): string {
    const days = Math.floor(ticks / TICKS_PER_DAY);
    const hours = Math.floor((ticks % TICKS_PER_DAY));
    if (days === 0) return `${hours}h`;
    return `${days}d ${hours}h`;
  }

  private handleCollect(entity: import('../core/Entity').Entity): void {
    if (entity.entityType === 'resource') {
      const res = entity as Resource;
      this.workSystem.createPickUpTask(res, TaskPriority.High);
      this.uiManager.addLog(`${languageManager.ui.logHarvesting} ${res.resourceType} ${languageManager.ui.logFrom}...`);
      const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;
      if (settler && settler.inventory.length === 0) {
        this.uiManager.checkMilestone('firstResource');
      }
    } else if (entity.entityType === 'artifact') {
      const artifact = entity as Artifact;
      this.workSystem.createPickUpArtifactTask(artifact, TaskPriority.High);
      this.uiManager.addLog(`Picking up ${artifact.name}...`);
    }
    this.uiManager.deselectAll();
  }

  private checkGameOver(): void {
    if (this.gameOver) return;
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    const alive = settlers.filter(s => s.isAlive);
    if (alive.length === 0) {
      this.showGameOver();
    }
  }

  private showGameOver(): void {
    this.gameOver = true;
    this.debugPanel.paused = true;
    this.inputHandler.hideHover();

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
}
