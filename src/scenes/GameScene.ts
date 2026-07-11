import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, COLORS,
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  LEFT_PANEL_WIDTH, FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  PANEL_X, BOTTOM_HUD_Y, PANEL_WIDTH, EVENT_HEIGHT,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Entity } from '../core/Entity';
import { MovementSystem } from '../systems/MovementSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { DinosaurSystem } from '../systems/DinosaurSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { TaskPriority } from '../core/Task';
import { SaveManager } from '../core/SaveManager';
import { DebugPanel } from '../ui/DebugPanel';
import { ToastManager } from '../ui/ToastManager';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';
import dinosaursData from '../data/dinosaurs.json';

type BuildingType = keyof typeof buildingsData;

const TICKS_PER_DAY = 24;

export class GameScene extends Phaser.Scene {
  simulation!: Simulation;
  movementSystem!: MovementSystem;
  workSystem!: WorkSystem;
  needsSystem!: NeedsSystem;
  buildingSystem!: BuildingSystem;
  dinosaurSystem!: DinosaurSystem;
  combatSystem!: CombatSystem;
  debugPanel!: DebugPanel;

  private entityGraphics: Phaser.GameObjects.Graphics[] = [];
  private entityTexts: Phaser.GameObjects.Text[] = [];
  private hoverRect!: Phaser.GameObjects.Rectangle;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private tileSprites: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[][] = [];

  private taskLog: string[] = [];
  private taskLogText!: Phaser.GameObjects.Text;

  private leftPanelContainer!: Phaser.GameObjects.Container;
  private colonistStatusText!: Phaser.GameObjects.Text;
  private colonistTaskText!: Phaser.GameObjects.Text;
  private colonistInvText!: Phaser.GameObjects.Text;
  private thoughtText!: Phaser.GameObjects.Text;

  private buildMode: BuildingType | null = null;
  private buildButtons: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
  private buildStatusTexts: Phaser.GameObjects.Text[] = [];
  private buildTypeMap: Map<Phaser.GameObjects.Text | Phaser.GameObjects.Container, BuildingType> = new Map();

  private selectedBuilding: Building | null = null;
  private selectedEntity: Entity | null = null;
  private selectionRect!: Phaser.GameObjects.Rectangle;
  private infoPanel!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private collectBtn!: Phaser.GameObjects.Text;

  private gameOver: boolean = false;
  private gameOverContainer!: Phaser.GameObjects.Container;

  private thoughtIndex: number = 0;
  private thoughtTimer: number = 0;
  private milestonesShown: Set<string> = new Set();

  private eventText!: Phaser.GameObjects.Text;
  private eventLog: string[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
  }

  private createBuildingIcons(): void {
    const s = 40;

    const houseG = this.add.graphics().setVisible(false);
    houseG.fillStyle(0x8b4513);
    houseG.fillRect(6, 18, 28, 18);
    houseG.fillStyle(0xcc4444);
    houseG.fillTriangle(20, 4, 4, 20, 36, 20);
    houseG.fillStyle(0x654321);
    houseG.fillRect(16, 26, 8, 10);
    houseG.generateTexture('icon_house', s, s);
    houseG.destroy();

    const whG = this.add.graphics().setVisible(false);
    whG.fillStyle(0x778899);
    whG.fillRect(4, 14, 32, 22);
    whG.fillStyle(0x556677);
    whG.fillRect(4, 12, 32, 4);
    whG.lineStyle(1, 0x445566);
    whG.strokeRect(4, 14, 32, 22);
    whG.fillStyle(0x99aabb);
    whG.fillRect(14, 22, 12, 14);
    whG.generateTexture('icon_warehouse', s, s);
    whG.destroy();

    const fG = this.add.graphics().setVisible(false);
    fG.fillStyle(0x8b7355);
    fG.fillRect(2, 28, 36, 8);
    fG.fillStyle(0x44aa44);
    fG.fillCircle(12, 18, 6);
    fG.fillCircle(28, 18, 6);
    fG.fillStyle(0x338833);
    fG.fillRect(11, 18, 2, 12);
    fG.fillRect(27, 18, 2, 12);
    fG.fillStyle(0xffcc00);
    fG.fillCircle(12, 14, 3);
    fG.fillCircle(28, 14, 3);
    fG.generateTexture('icon_farm', s, s);
    fG.destroy();

    const wG = this.add.graphics().setVisible(false);
    wG.fillStyle(0x808080);
    wG.fillRect(8, 8, 24, 24);
    wG.fillStyle(0x606060);
    wG.fillRect(8, 8, 24, 6);
    wG.fillStyle(0xaaaaaa);
    wG.fillRect(12, 20, 16, 8);
    wG.lineStyle(2, 0xffd700);
    wG.strokeCircle(20, 24, 4);
    wG.generateTexture('icon_workshop', s, s);
    wG.destroy();
  }

  private createTileTextures(): void {
    const s = TILE_SIZE;

    const grassG = this.add.graphics().setVisible(false);
    grassG.fillStyle(0x4a7c3f);
    grassG.fillRect(0, 0, s, s);
    grassG.fillStyle(0x5a8c4f);
    grassG.fillCircle(6, 8, 2);
    grassG.fillCircle(18, 5, 1);
    grassG.fillCircle(32, 10, 2);
    grassG.fillCircle(42, 6, 1);
    grassG.fillCircle(10, 22, 1);
    grassG.fillCircle(25, 18, 2);
    grassG.fillCircle(38, 24, 1);
    grassG.fillCircle(5, 36, 2);
    grassG.fillCircle(20, 32, 1);
    grassG.fillCircle(35, 38, 2);
    grassG.fillCircle(45, 34, 1);
    grassG.lineStyle(1, 0x3a6c2f, 0.4);
    grassG.beginPath();
    grassG.moveTo(8, 4);
    grassG.lineTo(8, 12);
    grassG.strokePath();
    grassG.beginPath();
    grassG.moveTo(22, 16);
    grassG.lineTo(22, 24);
    grassG.strokePath();
    grassG.beginPath();
    grassG.moveTo(38, 30);
    grassG.lineTo(38, 38);
    grassG.strokePath();
    grassG.beginPath();
    grassG.moveTo(14, 34);
    grassG.lineTo(14, 42);
    grassG.strokePath();
    grassG.lineStyle(1, 0x6a9c5f, 0.3);
    grassG.beginPath();
    grassG.moveTo(30, 6);
    grassG.lineTo(30, 14);
    grassG.strokePath();
    grassG.beginPath();
    grassG.moveTo(44, 22);
    grassG.lineTo(44, 30);
    grassG.strokePath();
    grassG.beginPath();
    grassG.moveTo(4, 20);
    grassG.lineTo(4, 28);
    grassG.strokePath();
    grassG.generateTexture('tile_grass', s, s);
    grassG.destroy();

    const stoneG = this.add.graphics().setVisible(false);
    stoneG.fillStyle(0x808080);
    stoneG.fillRect(0, 0, s, s);
    stoneG.fillStyle(0x909090);
    stoneG.fillRect(2, 2, 10, 8);
    stoneG.fillRect(14, 4, 12, 6);
    stoneG.fillRect(28, 2, 8, 10);
    stoneG.fillRect(6, 14, 14, 8);
    stoneG.fillRect(22, 12, 10, 8);
    stoneG.fillRect(2, 26, 12, 10);
    stoneG.fillRect(16, 24, 16, 12);
    stoneG.fillRect(34, 28, 8, 8);
    stoneG.lineStyle(1, 0x606060);
    stoneG.strokeRect(2, 2, 10, 8);
    stoneG.strokeRect(14, 4, 12, 6);
    stoneG.strokeRect(28, 2, 8, 10);
    stoneG.strokeRect(6, 14, 14, 8);
    stoneG.strokeRect(22, 12, 10, 8);
    stoneG.strokeRect(2, 26, 12, 10);
    stoneG.strokeRect(16, 24, 16, 12);
    stoneG.strokeRect(34, 28, 8, 8);
    stoneG.generateTexture('tile_stone', s, s);
    stoneG.destroy();

    const sandG = this.add.graphics().setVisible(false);
    sandG.fillStyle(0xc2b280);
    sandG.fillRect(0, 0, s, s);
    sandG.fillStyle(0xd4c490);
    for (let i = 0; i < 12; i++) {
      const dx = (i * 7 + 3) % s;
      const dy = (i * 11 + 5) % s;
      sandG.fillCircle(dx, dy, 1);
    }
    sandG.fillStyle(0xb8a870);
    for (let i = 0; i < 8; i++) {
      const dx = (i * 13 + 8) % s;
      const dy = (i * 9 + 2) % s;
      sandG.fillCircle(dx, dy, 1);
    }
    sandG.generateTexture('tile_sand', s, s);
    sandG.destroy();

    const waterG = this.add.graphics().setVisible(false);
    waterG.fillStyle(0x3b7dd8);
    waterG.fillRect(0, 0, s, s);
    waterG.lineStyle(2, 0x5599ee, 0.5);
    waterG.beginPath();
    waterG.moveTo(0, 12);
    waterG.lineTo(12, 10);
    waterG.lineTo(25, 14);
    waterG.lineTo(38, 11);
    waterG.lineTo(50, 13);
    waterG.strokePath();
    waterG.beginPath();
    waterG.moveTo(0, 28);
    waterG.lineTo(10, 26);
    waterG.lineTo(22, 30);
    waterG.lineTo(35, 27);
    waterG.lineTo(50, 29);
    waterG.strokePath();
    waterG.lineStyle(1, 0x77bbee, 0.3);
    waterG.beginPath();
    waterG.moveTo(0, 40);
    waterG.lineTo(15, 38);
    waterG.lineTo(30, 42);
    waterG.lineTo(45, 39);
    waterG.lineTo(50, 41);
    waterG.strokePath();
    waterG.generateTexture('tile_water', s, s);
    waterG.destroy();

    const dirtG = this.add.graphics().setVisible(false);
    dirtG.fillStyle(0x8b7355);
    dirtG.fillRect(0, 0, s, s);
    dirtG.fillStyle(0x7a6548);
    dirtG.fillCircle(8, 10, 2);
    dirtG.fillCircle(22, 6, 1);
    dirtG.fillCircle(35, 14, 2);
    dirtG.fillCircle(12, 28, 1);
    dirtG.fillCircle(28, 32, 2);
    dirtG.fillCircle(40, 38, 1);
    dirtG.fillStyle(0x9c8562);
    dirtG.fillCircle(5, 40, 1);
    dirtG.fillCircle(18, 20, 1);
    dirtG.fillCircle(32, 26, 1);
    dirtG.fillCircle(42, 8, 1);
    dirtG.generateTexture('tile_dirt', s, s);
    dirtG.destroy();
  }

  create(): void {
    this.children.removeAll(true);
    this.gameOver = false;
    this.taskLog = [];
    this.eventLog = [];
    this.thoughtIndex = 0;
    this.thoughtTimer = 0;
    this.milestonesShown.clear();
    this.buildMode = null;
    this.selectedBuilding = null;
    this.selectedEntity = null;
    this.buildButtons = [];
    this.buildStatusTexts = [];
    this.buildTypeMap.clear();

    this.simulation = new Simulation(MAP_WIDTH, MAP_HEIGHT);
    this.movementSystem = new MovementSystem(this.simulation.tileGrid);
    this.needsSystem = new NeedsSystem();
    this.workSystem = new WorkSystem(
      this.movementSystem,
      this.simulation.tileGrid,
      this.simulation.entityManager,
      this.simulation.taskQueue
    );
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
        this.addLog(msg);
      },
      (species) => {
        const spawns = languageManager.narrative.dinosaurSpawns[species as keyof typeof languageManager.narrative.dinosaurSpawns];
        if (spawns && spawns.length > 0) {
          const msg = spawns[Math.floor(Math.random() * spawns.length)];
          this.addLog(msg);
          this.addEvent(msg);
        }
      }
    );
    this.combatSystem = new CombatSystem(
      this.simulation.entityManager,
      this.simulation.tileGrid
    );

    const centerX = Math.floor(MAP_WIDTH / 2);
    const centerY = Math.floor(MAP_HEIGHT / 2);
    const settler = new Settler(centerX, centerY, 'Worker');
    this.simulation.entityManager.add(settler);
    this.simulation.tileGrid.setOccupied(centerX, centerY, true);

    const resources = [
      { x: 2, y: 2, type: 'wood', qty: 20 },
      { x: 11, y: 3, type: 'stone', qty: 15 },
      { x: 4, y: 10, type: 'wood', qty: 10 },
      { x: 9, y: 8, type: 'stone', qty: 8 },
    ];

    for (const r of resources) {
      const tile = this.simulation.tileGrid.get(r.x, r.y);
      if (!tile || !tile.walkable || tile.type === 'water') continue;
      const res = new Resource(r.x, r.y, r.type, r.qty);
      this.simulation.entityManager.add(res);
      this.simulation.tileGrid.setOccupied(r.x, r.y, true);
    }

    this.createTileTextures();
    this.drawMap();
    this.createEventArea();
    this.drawEntities();
    this.createLeftPanel();
    this.createActionLog();
    this.createBottomHUD();
    this.createInfoPanel();
    this.debugPanel = new DebugPanel(this);

    this.addLog(languageManager.narrative.intro[0] + ` [${languageManager.ui.day} 1]`);
    this.addEvent(languageManager.narrative.intro[1]);

    this.hoverRect = this.add.rectangle(FIELD_X, FIELD_Y, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(2, COLORS.hoverTile)
      .setFillStyle(0xffffff, 0.15)
      .setOrigin(0)
      .setDepth(5)
      .setVisible(false);

    this.selectionRect = this.add.rectangle(FIELD_X, FIELD_Y, TILE_SIZE + 4, TILE_SIZE + 4)
      .setStrokeStyle(3, 0x00ff00)
      .setFillStyle(0x00ff00, 0.1)
      .setOrigin(0.5)
      .setDepth(6)
      .setVisible(false);

    this.pathGraphics = this.add.graphics().setDepth(4);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor((pointer.x - FIELD_X) / TILE_SIZE);
      const tileY = Math.floor((pointer.y - FIELD_Y) / TILE_SIZE) + 1;
      const tile = this.simulation.tileGrid.get(tileX, tileY);
      if (tile && pointer.x >= FIELD_X && pointer.x < FIELD_X + FIELD_W && pointer.y >= FIELD_Y && pointer.y < FIELD_Y + FIELD_H) {
        this.hoverRect.setPosition(FIELD_X + tileX * TILE_SIZE, FIELD_Y + (tileY - 1) * TILE_SIZE);
        this.hoverRect.setVisible(true);
      } else {
        this.hoverRect.setVisible(false);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < FIELD_X || pointer.x >= FIELD_X + FIELD_W) return;
      if (pointer.y < FIELD_Y || pointer.y >= FIELD_Y + FIELD_H) return;
      const tileX = Math.floor((pointer.x - FIELD_X) / TILE_SIZE);
      const tileY = Math.floor((pointer.y - FIELD_Y) / TILE_SIZE) + 1;
      this.handleTileClick(tileX, tileY);
    });

    this.updateBuildButtonStates();
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;
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
            this.addLog(msg);
            if (e.killed) {
              const deathLines = languageManager.narrative.combat.settlerDeath;
              const deathMsg = deathLines[Math.floor(Math.random() * deathLines.length)]
                .replace('{name}', e.attacker);
              this.addLog(deathMsg);
            }
          } else if (e.type === 'dino_vs_dino') {
            const lines = languageManager.narrative.combat.dinoAttack;
            const msg = lines[Math.floor(Math.random() * lines.length)]
              .replace('{attacker}', e.attacker)
              .replace('{defender}', e.defender);
            this.addLog(msg);
            if (e.killed) {
              const deathLines = languageManager.narrative.combat.dinoDeath;
              const deathMsg = deathLines[Math.floor(Math.random() * deathLines.length)]
                .replace('{species}', e.defender);
              this.addLog(deathMsg);
            }
          }
        }
        this.updateThoughts(ticked);
        this.checkGameOver();
        this.updateBuildButtonStates();
      }
    }
    this.drawEntities();
    this.drawPath();
    this.updateLeftPanel();
    this.updateSelection();
    this.updateInfoPanel();
    this.debugPanel.update(this.simulation);
  }

  private updateThoughts(ticked: boolean): void {
    if (!ticked) return;
    this.thoughtTimer++;
    if (this.thoughtTimer >= 10) {
      this.thoughtTimer = 0;
      const thoughts = languageManager.narrative.settlerThoughts;
      this.thoughtText.setText(thoughts[this.thoughtIndex % thoughts.length]);
      this.thoughtIndex++;
    }
  }

  private checkMilestone(key: string): void {
    if (this.milestonesShown.has(key)) return;
    const lines = (languageManager.narrative.milestones as any)[key];
    if (lines && lines.length > 0) {
      this.milestonesShown.add(key);
      const msg = lines[Math.floor(Math.random() * lines.length)];
      this.addLog(msg);
    }
  }

  private formatDays(ticks: number): string {
    const days = Math.floor(ticks / TICKS_PER_DAY);
    const hours = Math.floor((ticks % TICKS_PER_DAY));
    if (days === 0) return `${hours}h`;
    return `${days}d ${hours}h`;
  }

  private createLeftPanel(): void {
    this.leftPanelContainer = this.add.container(0, 0).setDepth(20);

    const bg = this.add.rectangle(0, 0, LEFT_PANEL_WIDTH, CANVAS_HEIGHT, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.leftPanelContainer.add(bg);

    const title = this.add.text(14, 12, languageManager.ui.colonyStatus, {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(title);

    const line1 = this.add.rectangle(14, 38, LEFT_PANEL_WIDTH - 28, 1, COLORS.panelBorder, 0.5)
      .setOrigin(0);
    this.leftPanelContainer.add(line1);

    this.colonistStatusText = this.add.text(14, 48, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistStatusText);

    this.colonistTaskText = this.add.text(14, 200, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistTaskText);

    this.colonistInvText = this.add.text(14, 350, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistInvText);

    const thoughtTitle = this.add.text(14, 480, `\u2500\u2500 ${languageManager.ui.thoughts} \u2500\u2500`, {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(thoughtTitle);

    this.thoughtText = this.add.text(14, 505, '', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 3,
      fontStyle: 'italic',
    });
    this.leftPanelContainer.add(this.thoughtText);
  }

  private createActionLog(): void {
    const logX = FIELD_X + FIELD_W + 10;
    const logY = 220;

    const logBg = this.add.rectangle(logX, logY, 230, 500, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);

    const logTitle = this.add.text(logX + 8, logY + 8, `\u2500\u2500 ${languageManager.ui.actionLog} \u2500\u2500`, {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(21);

    this.taskLogText = this.add.text(logX + 8, logY + 32, '', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: 214 },
      lineSpacing: 3,
    }).setDepth(21);
  }

  private createEventArea(): void {
    const evBg = this.add.rectangle(FIELD_X, 0, FIELD_W, EVENT_HEIGHT, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);

    this.eventText = this.add.text(FIELD_X + 8, 8, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: FIELD_W - 16 },
      lineSpacing: 4,
    }).setDepth(21);
  }

  private addEvent(msg: string): void {
    this.eventLog.push(msg);
    if (this.eventLog.length > 3) this.eventLog.shift();
    this.eventText.setText(this.eventLog.join('\n'));
  }

  private createBottomHUD(): void {
    this.add.rectangle(FIELD_X, BOTTOM_HUD_Y, FIELD_W, HUD_HEIGHT, COLORS.uiPanel, 0.95)
      .setOrigin(0).setDepth(20);
    this.add.rectangle(FIELD_X, BOTTOM_HUD_Y, FIELD_W, 2, COLORS.settler, 0.5)
      .setOrigin(0).setDepth(21);

    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '16px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 4 },
    };

    this.add.text(FIELD_X + 10, BOTTOM_HUD_Y + 10, `[${languageManager.ui.save}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        SaveManager.save(this.simulation);
        this.addLog(languageManager.ui.logSaved);
      });

    this.add.text(FIELD_X + 80, BOTTOM_HUD_Y + 10, `[${languageManager.ui.load}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        const loaded = SaveManager.load();
        if (loaded) {
          this.simulation = loaded;
          this.movementSystem = new MovementSystem(this.simulation.tileGrid);
          this.needsSystem = new NeedsSystem();
          this.workSystem = new WorkSystem(
            this.movementSystem, this.simulation.tileGrid,
            this.simulation.entityManager, this.simulation.taskQueue
          );
          this.buildingSystem = new BuildingSystem(
            this.simulation.entityManager, this.simulation.tileGrid
          );
          this.dinosaurSystem = new DinosaurSystem(
            this.simulation.entityManager, this.simulation.tileGrid,
            (name) => this.addLog(`${name} was killed!`),
            (species) => {}
          );
          const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
          for (const s of settlers) {
            s.currentTaskId = null;
            s.path = [];
            s.pathIndex = 0;
          }
          this.selectedBuilding = null;
          this.selectionRect.setVisible(false);
          this.infoPanel.setVisible(false);
          this.redrawMap();
          this.addLog(languageManager.ui.logLoaded);
        } else {
          this.addLog(languageManager.ui.logNoSave);
        }
      });

    this.add.text(FIELD_X + 150, BOTTOM_HUD_Y + 10, `[${languageManager.ui.clear}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        SaveManager.deleteSave();
        this.addLog(languageManager.ui.logCleared);
      });

    this.createBuildingIcons();
    this.createBuildButtons();
  }

  private createBuildButtons(): void {
    const types = Object.keys(buildingsData) as BuildingType[];
    const btnY = BOTTOM_HUD_Y + 50;
    const ICON_SIZE = 40;
    const ICON_GAP = 8;

    const cancelBtn = this.add.text(FIELD_X + 10, btnY, '[X]', {
      fontSize: '14px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 6, y: 3 },
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        this.buildMode = null;
        this.updateBuildButtonStates();
      });
    this.buildButtons.push(cancelBtn);

    let xOff = FIELD_X + 45;
    for (const type of types) {
      const def = (buildingsData as any)[type];
      const reqStr = Object.entries(def.requires).map(([k, v]) => `${k}:${v}`).join(' ');

      const container = this.add.container(xOff, btnY).setDepth(22);

      const icon = this.add.image(0, 0, `icon_${type}`)
        .setOrigin(0)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      container.add(icon);

      const label = this.add.text(ICON_SIZE + 4, 2, def.name, {
        fontSize: '13px', color: '#c9d1d9', fontFamily: 'monospace',
      });
      container.add(label);

      const cost = this.add.text(ICON_SIZE + 4, 18, reqStr, {
        fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
      });
      container.add(cost);

      const status = this.add.text(ICON_SIZE + 4, 32, '', {
        fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
      });
      container.add(status);
      this.buildStatusTexts.push(status);

      container.setSize(ICON_SIZE + 120, ICON_SIZE);
      container.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selectedBuilding = null;
          this.selectionRect.setVisible(false);
          this.infoPanel.setVisible(false);
          if (!this.canAfford(type)) {
            this.addLog(`${languageManager.ui.logBuild} ${def.name} \u2014 ${languageManager.ui.logNeed}...`);
            return;
          }
          this.buildMode = type;
          this.updateBuildButtonStates();
          this.addLog(`${languageManager.ui.logBuild}: ${def.name} \u2014 ${languageManager.ui.logClickTile}`);
        });

      this.buildTypeMap.set(container, type);
      this.buildButtons.push(container);

      xOff += ICON_SIZE + 120 + ICON_GAP;
    }
  }

  private canAfford(type: BuildingType): boolean {
    const def = (buildingsData as any)[type];
    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;
    if (!settler) return false;
    return Object.entries(def.requires).every(([res, qty]) =>
      settler.hasResource(res, qty as number)
    );
  }

  private updateBuildButtonStates(): void {
    const types = Object.keys(buildingsData) as BuildingType[];
    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;

    for (let i = 0; i < this.buildStatusTexts.length; i++) {
      const type = types[i];
      const def = (buildingsData as any)[type];
      const status = this.buildStatusTexts[i];
      const btn = this.buildButtons[i + 1];
      const icon = (btn as Phaser.GameObjects.Container).list[0] as Phaser.GameObjects.Image;

      const affordable = settler && Object.entries(def.requires).every(([res, qty]) =>
        (settler.inventory.find(item => item.resourceType === res)?.quantity ?? 0) >= (qty as number)
      );

      if (!settler) {
        status.setText('');
        icon.setTint(0x888888);
        continue;
      }

      if (affordable) {
        status.setText('\u2713');
        status.setColor('#44cc44');
        icon.clearTint();
      } else {
        const missing: string[] = [];
        for (const [res, qty] of Object.entries(def.requires)) {
          const have = settler.inventory.find(item => item.resourceType === res)?.quantity ?? 0;
          const need = qty as number;
          if (have < need) {
            missing.push(`${res}:${need - have}`);
          }
        }
        status.setText(`${languageManager.ui.logNeed} ${missing.join(' ')}`);
        status.setColor('#ff4444');
        icon.setTint(0x666666);
      }
    }

    for (let i = 0; i < this.buildButtons.length; i++) {
      const btn = this.buildButtons[i];
      if (i === 0) {
        btn.setAlpha(this.buildMode ? 1.0 : 0.4);
      } else {
        const type = this.buildTypeMap.get(btn)!;
        btn.setAlpha(this.buildMode === type ? 1.0 : 0.8);
      }
    }
  }

  private createInfoPanel(): void {
    const px = PANEL_X - 240;
    const py = 10;

    this.infoPanel = this.add.container(px, py).setDepth(25).setVisible(false);

    const bg = this.add.rectangle(0, 0, 230, 200, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, 0x44cc44);
    this.infoPanel.add(bg);

    this.infoText = this.add.text(10, 8, '', {
      fontSize: '14px', color: '#e0e0e0', fontFamily: 'monospace',
      wordWrap: { width: 210 },
    });
    this.infoPanel.add(this.infoText);

    this.collectBtn = this.add.text(10, 160, `[${languageManager.ui.collect}]`, {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleCollect());
    this.infoPanel.add(this.collectBtn);
  }

  private updateInfoPanel(): void {
    if (!this.selectedBuilding && !this.selectedEntity) {
      this.infoPanel.setVisible(false);
      return;
    }

    this.infoPanel.setVisible(true);

    if (this.selectedBuilding) {
      const bld = this.selectedBuilding;
      if (!this.simulation.entityManager.get(bld.id)) {
        this.selectedBuilding = null;
        this.infoPanel.setVisible(false);
        return;
      }
      const def = (buildingsData as any)[bld.buildingType];
      const name = def?.name ?? bld.buildingType;

      let lines = [
        `${name}  (${bld.x},${bld.y})`,
        `${languageManager.ui.hp}: ${bld.hp}/${bld.maxHp}`,
      ];

      if (!bld.built) {
        lines.push(`${languageManager.ui.building}: ${Math.round(bld.progressPercent * 100)}%`);
      }

      if (bld.storageCapacity > 0) {
        const storStr = bld.storage.map(s => `${s.resourceType}:${s.quantity}`).join(', ') || languageManager.ui.empty;
        lines.push(`${languageManager.ui.storage}: ${bld.storageUsed}/${bld.storageCapacity} [${storStr}]`);
      }

      if (bld.produceType) {
        lines.push(`${languageManager.ui.produces}: ${bld.produceType} x${bld.produceRate}`);
        const storAmount = bld.getStorageAmount(bld.produceType);
        lines.push(`${languageManager.ui.inStorage}: ${storAmount}`);
      }

      this.infoText.setText(lines.join('\n'));
      this.collectBtn.setVisible(false);
    } else if (this.selectedEntity) {
      const e = this.selectedEntity;
      let lines: string[] = [];
      if (e.entityType === 'resource') {
        const res = e as Resource;
        lines = [
          `${languageManager.ui.infoResource} (${res.x},${res.y})`,
          `${languageManager.ui.infoType}: ${res.resourceType}`,
          `${languageManager.ui.infoQuantity}: ${res.quantity}`,
        ];
        this.collectBtn.setVisible(!res.depleted);
      } else if (e.entityType === 'dinosaur') {
        const dino = e as Dinosaur;
        lines = [
          `${dino.species} (${dino.x},${dino.y})`,
          `${languageManager.ui.hp}: ${dino.hp}/${dino.maxHp}`,
          `${languageManager.ui.infoState}: ${dino.state}`,
          `${languageManager.ui.infoDamage}: ${dino.attackDamage}`,
          `${languageManager.ui.infoAggro}: ${dino.aggroRange}`,
        ];
        this.collectBtn.setVisible(false);
      }
      this.infoText.setText(lines.join('\n'));
    }
  }

  private updateSelection(): void {
    if (this.selectedBuilding) {
      this.selectionRect.setPosition(
        FIELD_X + this.selectedBuilding.x * TILE_SIZE + TILE_SIZE / 2,
        FIELD_Y + (this.selectedBuilding.y - 1) * TILE_SIZE + TILE_SIZE / 2
      );
      this.selectionRect.setVisible(true);
    } else if (this.selectedEntity) {
      this.selectionRect.setPosition(
        FIELD_X + this.selectedEntity.x * TILE_SIZE + TILE_SIZE / 2,
        FIELD_Y + (this.selectedEntity.y - 1) * TILE_SIZE + TILE_SIZE / 2
      );
      this.selectionRect.setVisible(true);
    } else {
      this.selectionRect.setVisible(false);
    }
  }

  private updateLeftPanel(): void {
    if (this.gameOver) return;
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    if (settlers.length > 0) {
      const s = settlers[0];
      const taskStr = s.currentTaskId ? languageManager.ui.working : languageManager.ui.idle;
      const invItems = s.inventory.map(i => `${i.resourceType}: ${i.quantity}`).join('\n') || `  (${languageManager.ui.empty})`;
      const buildStr = this.buildMode ? `\n${languageManager.ui.buildMode}: ${(buildingsData as any)[this.buildMode].name}` : '';

      this.colonistStatusText.setText(
        `${s.name}\n` +
        `${languageManager.ui.position}: ${s.x},${s.y}\n` +
        `${languageManager.ui.hp}: ${Math.round(s.hp)}/${s.maxHp}\n` +
        `${languageManager.ui.hunger}: ${Math.round(s.hunger)}%\n` +
        `${languageManager.ui.energy}: ${Math.round(s.energy)}%\n` +
        `${languageManager.ui.tick}: ${this.simulation.tickCount}` +
        buildStr
      );

      this.colonistTaskText.setText(
        `\u2500\u2500 ${languageManager.ui.taskSection} \u2500\u2500\n` +
        `${languageManager.ui.status}: ${taskStr}\n` +
        `${languageManager.ui.taskId}: ${s.currentTaskId ?? languageManager.ui.none}\n` +
        `${languageManager.ui.pathLen}: ${s.path.length}`
      );

      this.colonistInvText.setText(
        `\u2500\u2500 ${languageManager.ui.inventorySection} \u2500\u2500\n` +
        invItems
      );
    }
  }

  private addLog(msg: string): void {
    this.taskLog.push(msg);
    if (this.taskLog.length > 8) this.taskLog.shift();
    this.taskLogText.setText(this.taskLog.join('\n'));
  }

  private deselectAll(): void {
    this.selectedBuilding = null;
    this.selectedEntity = null;
    this.selectionRect.setVisible(false);
    this.infoPanel.setVisible(false);
  }

  private handleCollect(): void {
    if (!this.selectedEntity || this.selectedEntity.entityType !== 'resource') return;
    const res = this.selectedEntity as Resource;
    this.workSystem.createPickUpTask(res, TaskPriority.High);
    this.addLog(`${languageManager.ui.logHarvesting} ${res.resourceType} ${languageManager.ui.logFrom}...`);
    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;
    if (settler && settler.inventory.length === 0) {
      this.checkMilestone('firstResource');
    }
    this.deselectAll();
  }

  private drawMap(): void {
    for (let y = 1; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const texKey = `tile_${tile.type}`;
        const hasTexture = this.textures.exists(texKey);

        if (hasTexture) {
          const img = this.add.image(
            FIELD_X + x * TILE_SIZE, FIELD_Y + (y - 1) * TILE_SIZE,
            texKey
          ).setOrigin(0).setDisplaySize(TILE_SIZE, TILE_SIZE);
          this.tileSprites[y][x] = img;
        } else {
          const color = COLORS[tile.type as keyof typeof COLORS] || 0x333333;
          const rect = this.add.rectangle(
            FIELD_X + x * TILE_SIZE, FIELD_Y + (y - 1) * TILE_SIZE,
            TILE_SIZE, TILE_SIZE, color
          ).setOrigin(0).setStrokeStyle(1, 0x222222);
          this.tileSprites[y][x] = rect;
        }
      }
    }
    this.drawTileTransitions();
  }

  private drawTileTransitions(): void {
    const g = this.add.graphics().setDepth(1);
    const tileSize = TILE_SIZE;

    const getColor = (type: string): number => {
      if (type === 'water') return 0x3b7dd8;
      if (type === 'stone') return 0x808080;
      if (type === 'sand') return 0xc2b280;
      if (type === 'dirt') return 0x8b7355;
      if (type === 'grass') return 0x4a7c3f;
      return 0x333333;
    };

    const priority: Record<string, number> = {
      water: 4,
      stone: 3,
      sand: 2,
      dirt: 1,
      grass: 0,
    };

    const seededRandom = (x: number, y: number, seed: number): number => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let y = 1; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const myPriority = priority[tile.type] ?? 0;
        if (myPriority === 0) continue;

        const px = FIELD_X + x * tileSize;
        const py = FIELD_Y + (y - 1) * tileSize;
        const seed = x * 100 + y;
        const c = getColor(tile.type);

        const neighbors = [
          { dx: 1, dy: 0, seedOff: 0 },
          { dx: 0, dy: 1, seedOff: 50 },
          { dx: -1, dy: 0, seedOff: 100 },
          { dx: 0, dy: -1, seedOff: 150 },
        ];

        for (const n of neighbors) {
          const nx = x + n.dx;
          const ny = y + n.dy;
          const neighbor = this.simulation.tileGrid.get(nx, ny);
          if (!neighbor) continue;
          const neighborPriority = priority[neighbor.type] ?? 0;
          if (myPriority <= neighborPriority) continue;

          g.fillStyle(c, 1);
          const seed2 = seed + n.seedOff;

          if (n.dx === 1) {
            for (let dy = 0; dy < tileSize; dy += 4) {
              const depth = Math.floor(seededRandom(x, dy, seed2) * 14) + 2;
              g.fillRect(px + tileSize, py + dy, depth, 4);
            }
          } else if (n.dy === 1) {
            for (let dx = 0; dx < tileSize; dx += 4) {
              const depth = Math.floor(seededRandom(dx, y, seed2) * 14) + 2;
              g.fillRect(px + dx, py + tileSize, 4, depth);
            }
          } else if (n.dx === -1) {
            for (let dy = 0; dy < tileSize; dy += 4) {
              const depth = Math.floor(seededRandom(x, dy, seed2) * 14) + 2;
              g.fillRect(px - depth, py + dy, depth, 4);
            }
          } else if (n.dy === -1) {
            for (let dx = 0; dx < tileSize; dx += 4) {
              const depth = Math.floor(seededRandom(dx, y, seed2) * 14) + 2;
              g.fillRect(px + dx, py - depth, 4, depth);
            }
          }
        }
      }
    }
  }

  private redrawMap(): void {
    for (const row of this.tileSprites) {
      for (const rect of row) {
        rect.destroy();
      }
    }
    this.tileSprites = [];
    this.drawMap();
  }

  private drawEntities(): void {
    this.entityGraphics.forEach(g => g.destroy());
    this.entityGraphics = [];
    this.entityTexts.forEach(t => t.destroy());
    this.entityTexts = [];

    for (const entity of this.simulation.entityManager.getAll()) {
      if (entity.y === 0) continue;
      const g = this.add.graphics().setDepth(10);
      const cx = FIELD_X + entity.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = FIELD_Y + (entity.y - 1) * TILE_SIZE + TILE_SIZE / 2;

      if (entity.entityType === 'settler') {
        const settler = entity as Settler;
        g.fillStyle(COLORS.settler, 1);
        g.fillCircle(cx, cy, TILE_SIZE / 3);
        g.lineStyle(2, 0x000000);
        g.strokeCircle(cx, cy, TILE_SIZE / 3);

        this.entityTexts.push(
          this.add.text(cx, cy - TILE_SIZE / 2 - 10, settler.name, {
            fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
          }).setOrigin(0.5).setDepth(10)
        );

        const barWidth = TILE_SIZE - 4;
        const barHeight = 5;
        const barX = FIELD_X + entity.x * TILE_SIZE + 2;
        const barY = FIELD_Y + (entity.y - 1) * TILE_SIZE - 8;

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY, barWidth, barHeight);
        g.fillStyle(0x22cc22, 1);
        g.fillRect(barX, barY, barWidth * (settler.hunger / 100), barHeight);

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY - barHeight - 2, barWidth, barHeight);
        g.fillStyle(0xff3333, 1);
        g.fillRect(barX, barY - barHeight - 2, barWidth * (settler.hp / settler.maxHp), barHeight);

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY + barHeight + 2, barWidth, barHeight);
        g.fillStyle(0x2299ff, 1);
        g.fillRect(barX, barY + barHeight + 2, barWidth * (settler.energy / 100), barHeight);

        if (settler.inventory.length > 0) {
          g.fillStyle(0xffaa00, 0.9);
          g.fillRect(cx + TILE_SIZE / 4, cy - TILE_SIZE / 4, 8, 8);
        }
      } else if (entity.entityType === 'resource') {
        const res = entity as Resource;
        g.fillStyle(COLORS.resource, 0.9);
        g.fillRect(cx - TILE_SIZE / 4, cy - TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);
        g.lineStyle(2, 0x000000);
        g.strokeRect(cx - TILE_SIZE / 4, cy - TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);

        this.entityTexts.push(
          this.add.text(cx, cy + TILE_SIZE / 4 + 6, `${res.resourceType} ${res.quantity}`, {
            fontSize: '13px', color: '#ff6347', fontFamily: 'monospace',
          }).setOrigin(0.5, 0).setDepth(10)
        );
      } else if (entity.entityType === 'building') {
        const bld = entity as Building;
        const color = (buildingsData as any)[bld.buildingType]?.color ?? COLORS.building;
        const alpha = bld.built ? 1.0 : 0.5 + bld.progressPercent * 0.5;
        g.fillStyle(color, alpha);
        g.fillRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);
        g.lineStyle(2, 0x000000);
        g.strokeRect(cx - TILE_SIZE / 3, cy - TILE_SIZE / 3, TILE_SIZE / 1.5, TILE_SIZE / 1.5);

        const name = (buildingsData as any)[bld.buildingType]?.name ?? bld.buildingType;
        this.entityTexts.push(
          this.add.text(cx, cy + TILE_SIZE / 3 + 4, name, {
            fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
          }).setOrigin(0.5, 0).setDepth(10)
        );

        if (!bld.built) {
          const barX = cx - TILE_SIZE / 3;
          const barY = cy - TILE_SIZE / 3 - 6;
          const barW = (TILE_SIZE / 1.5);
          g.fillStyle(0x333333, 0.8);
          g.fillRect(barX, barY, barW, 4);
          g.fillStyle(0xffcc00, 1);
          g.fillRect(barX, barY, barW * bld.progressPercent, 4);
        } else if (bld.storageCapacity > 0 && bld.storageUsed > 0) {
          const barX = cx - TILE_SIZE / 3;
          const barY = cy - TILE_SIZE / 3 - 6;
          const barW = (TILE_SIZE / 1.5);
          g.fillStyle(0x333333, 0.8);
          g.fillRect(barX, barY, barW, 4);
          g.fillStyle(0x44aaff, 1);
          g.fillRect(barX, barY, barW * (bld.storageUsed / bld.storageCapacity), 4);
        }
      } else if (entity.entityType === 'dinosaur') {
        const dino = entity as Dinosaur;
        const def = (dinosaursData as any)[dino.species];
        const color = def?.color ?? COLORS.dinosaur;
        const r = (TILE_SIZE / 3) * dino.size;
        g.fillStyle(color, 0.9);
        g.fillCircle(cx, cy, r);
        g.lineStyle(2, 0x000000);
        g.strokeCircle(cx, cy, r);

        const stateColors: Record<string, string> = {
          idle: '#888888', wander: '#ffaa00', investigate: '#ff4444', flee: '#44ff44',
        };
        this.entityTexts.push(
          this.add.text(cx, cy - r - 8, `${dino.species}`, {
            fontSize: '13px', color: stateColors[dino.state] ?? '#ffffff', fontFamily: 'monospace',
          }).setOrigin(0.5).setDepth(10)
        );

        if (dino.hp < dino.maxHp) {
          const barW = r * 2;
          const barX = cx - r;
          const barY = cy + r + 4;
          g.fillStyle(0x333333, 0.8);
          g.fillRect(barX, barY, barW, 4);
          g.fillStyle(0xff3333, 1);
          g.fillRect(barX, barY, barW * (dino.hp / dino.maxHp), 4);
        }
      }

      this.entityGraphics.push(g);
    }
  }

  private drawPath(): void {
    this.pathGraphics.clear();
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    for (const settler of settlers) {
      if (settler.path.length > 1) {
        this.pathGraphics.lineStyle(2, COLORS.pathHighlight, 0.6);
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(
          FIELD_X + settler.x * TILE_SIZE + TILE_SIZE / 2,
          FIELD_Y + (settler.y - 1) * TILE_SIZE + TILE_SIZE / 2
        );
        for (let i = settler.pathIndex; i < settler.path.length; i++) {
          const p = settler.path[i];
          this.pathGraphics.lineTo(
            FIELD_X + p.x * TILE_SIZE + TILE_SIZE / 2,
            FIELD_Y + (p.y - 1) * TILE_SIZE + TILE_SIZE / 2
          );
        }
        this.pathGraphics.strokePath();
      }
    }
  }

  private handleTileClick(tileX: number, tileY: number): void {
    if (this.gameOver) return;
    const tile = this.simulation.tileGrid.get(tileX, tileY);
    if (!tile) return;

    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler | undefined;
    if (!settler) return;

    if (this.buildMode) {
      this.handleBuildClick(tileX, tileY, tile);
      return;
    }

    const buildingAtTile = this.simulation.entityManager.getAll().find(
      e => e.entityType === 'building' && e.x === tileX && e.y === tileY
    ) as Building | undefined;

    if (buildingAtTile) {
      this.selectedBuilding = buildingAtTile;
      this.selectedEntity = null;
      this.buildMode = null;
      this.updateBuildButtonStates();
      const def = (buildingsData as any)[buildingAtTile.buildingType];
      this.addLog(`${languageManager.ui.selected}: ${def?.name ?? buildingAtTile.buildingType}`);
      return;
    }

    const entityAtTile = this.simulation.entityManager.getAll().find(
      e => (e.entityType === 'resource' || e.entityType === 'dinosaur') && e.x === tileX && e.y === tileY
    );

    if (entityAtTile) {
      this.selectedBuilding = null;
      this.selectedEntity = entityAtTile;
      this.buildMode = null;
      this.updateBuildButtonStates();
      if (entityAtTile.entityType === 'resource') {
        const res = entityAtTile as Resource;
        this.addLog(`${languageManager.ui.selected}: ${res.resourceType} (${res.quantity})`);
      } else if (entityAtTile.entityType === 'dinosaur') {
        const dino = entityAtTile as Dinosaur;
        this.addLog(`${languageManager.ui.selected}: ${dino.species} (${dino.state})`);
      }
      return;
    }

    this.deselectAll();
    this.buildMode = null;
    this.updateBuildButtonStates();

    if (tile.walkable) {
      this.workSystem.createMoveTask(tileX, tileY);
      this.addLog(`${settler.name} ${languageManager.ui.logWorkerHeadsTo} (${tileX},${tileY})`);
    }
  }

  private handleBuildClick(tileX: number, tileY: number, tile: any): void {
    if (!tile.walkable) {
      this.addLog(languageManager.ui.logCannotBuildHere);
      return;
    }

    const existing = this.simulation.entityManager.getAll().find(
      e => e.x === tileX && e.y === tileY
    );
    if (existing) {
      this.addLog(languageManager.ui.logTileOccupied);
      return;
    }

    const def = (buildingsData as any)[this.buildMode!];
    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;
    const hasAll = Object.entries(def.requires).every(([res, qty]) =>
      settler.hasResource(res, qty as number)
    );
    if (!hasAll) {
      const need = Object.entries(def.requires).map(([r, q]) => `${r}:${q}`).join(', ');
      this.addLog(`${languageManager.ui.logNeed}: ${need}`);
      return;
    }

    const building = new Building(tileX, tileY, this.buildMode!, def.maxHp, def.buildTime,
      Object.entries(def.requires).map(([r, q]) => ({ resourceType: r, quantity: q as number }))
    );
    building.storageCapacity = def.storageCapacity ?? 0;
    building.produceType = def.produceType ?? '';
    building.produceRate = def.produceRate ?? 0;
    building.produceInterval = def.produceInterval ?? 0;
    this.simulation.entityManager.add(building);
    this.simulation.tileGrid.setOccupied(tileX, tileY, true);

    this.workSystem.createBuildTask(building, TaskPriority.High);
    this.addLog(`${languageManager.ui.logBuildingAt} ${def.name} ${tileX},${tileY}`);
    this.checkMilestone('firstBuilding');

    this.buildMode = null;
    this.updateBuildButtonStates();
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
    this.hoverRect.setVisible(false);

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
