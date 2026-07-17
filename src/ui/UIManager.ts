import Phaser from 'phaser';
import {
  TILE_SIZE, COLORS, VIEWPORT_TILES,
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  LEFT_PANEL_WIDTH, FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  PANEL_X, BOTTOM_HUD_Y, PANEL_WIDTH, EVENT_HEIGHT,
  NEEDS_ENABLED,
  DAY_TICKS, NIGHT_TICKS, CYCLE_TICKS, NIGHT_MAX_ALPHA, nightAlpha,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Artifact } from '../entities/Artifact';
import { Entity } from '../core/Entity';
import { WorkSystem } from '../systems/WorkSystem';
import { SaveManager } from '../core/SaveManager';
import { MovementSystem } from '../systems/MovementSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { DinosaurSystem } from '../systems/DinosaurSystem';
import { TaskPriority } from '../core/Task';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { QuestModal } from './QuestModal';

type BuildingType = keyof typeof buildingsData;

export class UIManager {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  workSystem!: WorkSystem;
  replayRecorder: ReplayRecorder | null = null;
  private scrollX: number = 0;
  private scrollY: number = 0;

  taskLog: string[] = [];
  taskLogText!: Phaser.GameObjects.Text;

  leftPanelContainer!: Phaser.GameObjects.Container;
  colonistStatusText!: Phaser.GameObjects.Text;
  colonistTaskText!: Phaser.GameObjects.Text;
  colonistInvText!: Phaser.GameObjects.Text;
  questText!: Phaser.GameObjects.Text;
  private scrollUpBtn!: Phaser.GameObjects.Text;
  private scrollDownBtn!: Phaser.GameObjects.Text;
  private scrollLeftBtn!: Phaser.GameObjects.Text;
  private scrollRightBtn!: Phaser.GameObjects.Text;

  thoughtText!: Phaser.GameObjects.Text;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Rectangle;
  private minimapSize: number = 210;
  private minimapTileSize: number = 7;

  buildMode: BuildingType | null = null;
  buildButtons: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];
  buildTypeMap: Map<Phaser.GameObjects.Text | Phaser.GameObjects.Container, BuildingType> = new Map();
  private bottomHudBg!: Phaser.GameObjects.Rectangle;
  private bottomHudAccent!: Phaser.GameObjects.Rectangle;

  private dnSky!: Phaser.GameObjects.Rectangle;
  private dnSun!: Phaser.GameObjects.Arc;
  private dnMoon!: Phaser.GameObjects.Arc;
  private dnStars: Phaser.GameObjects.Arc[] = [];
  private dnLabel!: Phaser.GameObjects.Text;
  private dnDim!: Phaser.GameObjects.Rectangle;
  private dnBand = { x: 14, y: 44, w: LEFT_PANEL_WIDTH - 28, h: 44 };

  private settlerIcons: Phaser.GameObjects.Container[] = [];
  private settlerIconsBg: Phaser.GameObjects.Rectangle[] = [];
  private onSettlerIconClick?: (index: number) => void;
  private buildButtonsEnabled: boolean = true;
  startMenuOpen: boolean = false;
  private hudButtons: Phaser.GameObjects.Text[] = [];
  private scrollButtons: Phaser.GameObjects.Text[] = [];

  selectedBuilding: Building | null = null;
  selectedEntity: Entity | null = null;
  selectionRect!: Phaser.GameObjects.Rectangle;
  infoPanel!: Phaser.GameObjects.Container;
  infoText!: Phaser.GameObjects.Text;
  collectBtn!: Phaser.GameObjects.Text;
  demolishBtn!: Phaser.GameObjects.Text;
  continueBtn!: Phaser.GameObjects.Text;
  repairBtn!: Phaser.GameObjects.Text;
  journalBtn!: Phaser.GameObjects.Text;
  onDemolishCallback: ((entity: Entity) => void) | null = null;
  onContinueCallback: ((entity: Entity) => void) | null = null;
  onRepairCallback: ((entity: Entity) => void) | null = null;
  onJournalCallback: ((building: Building) => void) | null = null;

  eventText!: Phaser.GameObjects.Text;

  thoughtIndex: number = 0;
  thoughtTimer: number = 0;
  milestonesShown: Set<string> = new Set();

  private inventoryIcons: Phaser.GameObjects.GameObject[] = [];
  private inventoryIconContainer!: Phaser.GameObjects.Container;

  private globalInventoryContainer!: Phaser.GameObjects.Container;
  private globalInventoryIcons: Phaser.GameObjects.GameObject[] = [];
  private lastGlobalInventoryHash: string = '';

  private artifactTooltip!: Phaser.GameObjects.Container;
  private artifactSystem: import('../systems/ArtifactSystem').ArtifactSystem | null = null;
  private questModal!: QuestModal;
  private questBtn!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
  }

  setArtifactSystem(artifactSystem: import('../systems/ArtifactSystem').ArtifactSystem): void {
    this.artifactSystem = artifactSystem;
  }

  setSimulation(simulation: Simulation): void {
    this.simulation = simulation;
  }

  updateScroll(sx: number, sy: number): void {
    this.scrollX = sx;
    this.scrollY = sy;
  }

  private tileToScreen(tileX: number, tileY: number): { sx: number; sy: number } {
    return {
      sx: FIELD_X + (tileX - this.scrollX) * TILE_SIZE + TILE_SIZE / 2,
      sy: FIELD_Y + (tileY - this.scrollY) * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  createEventArea(): void {
    const evBg = this.scene.add.rectangle(FIELD_X, 0, FIELD_W, EVENT_HEIGHT, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);

    this.globalInventoryContainer = this.scene.add.container(FIELD_X + 4, 1);
    this.globalInventoryContainer.setDepth(21);
    this.updateGlobalInventory();

    this.eventText = this.scene.add.text(FIELD_X + 220, 8, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: FIELD_W - 230 },
      lineSpacing: 4,
    }).setDepth(21);
  }

  addEvent(msg: string): void {
    this.eventText.setText(msg);
  }

  createLeftPanel(): void {
    this.leftPanelContainer = this.scene.add.container(0, 0).setDepth(20);

    const bg = this.scene.add.rectangle(0, 0, LEFT_PANEL_WIDTH, CANVAS_HEIGHT, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.leftPanelContainer.add(bg);

    const title = this.scene.add.text(14, 12, languageManager.ui.colonyStatus, {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(title);

    const line1 = this.scene.add.rectangle(14, 38, LEFT_PANEL_WIDTH - 28, 1, COLORS.panelBorder, 0.5)
      .setOrigin(0);
    this.leftPanelContainer.add(line1);

    this.createDayNightWidget();

    this.colonistStatusText = this.scene.add.text(14, 146, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistStatusText);

    this.colonistTaskText = this.scene.add.text(14, 250, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistTaskText);

    this.colonistInvText = this.scene.add.text(14, 380, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistInvText);

    this.questModal = new QuestModal(this.scene);

    this.questBtn = this.scene.add.text(14, 448, '📋 КВЕСТЫ', {
      fontSize: '13px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#16213e', padding: { x: 6, y: 3 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.questBtn.setColor('#ffffff'))
      .on('pointerout', () => this.questBtn.setColor('#58a6ff'))
      .on('pointerdown', () => {
        const qm = (this.scene as any).questManager;
        if (qm) this.questModal.show(qm);
      });
    this.leftPanelContainer.add(this.questBtn);

    this.questText = this.scene.add.text(14, 474, '', {
      fontSize: '12px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 3,
    });
    this.leftPanelContainer.add(this.questText);

    this.inventoryIconContainer = this.scene.add.container(0, 0);
    this.leftPanelContainer.add(this.inventoryIconContainer);

    const thoughtTitle = this.scene.add.text(14, 530, `\u2500\u2500 ${languageManager.ui.thoughts} \u2500\u2500`, {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(thoughtTitle);

    this.thoughtText = this.scene.add.text(14, 555, '', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 3,
      fontStyle: 'italic',
    });
    this.thoughtText.setCrop(0, 0, LEFT_PANEL_WIDTH - 28, 48);
    this.leftPanelContainer.add(this.thoughtText);

    const minimapY = 620;
    const minimapTitle = this.scene.add.text(14, minimapY, `\u2500\u2500 Map \u2500\u2500`, {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(minimapTitle);

    this.minimapBg = this.scene.add.rectangle(14, minimapY + 24, this.minimapSize, this.minimapSize, 0x000000, 0.9)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.leftPanelContainer.add(this.minimapBg);

    this.minimapGraphics = this.scene.add.graphics();
    this.leftPanelContainer.add(this.minimapGraphics);

    const btnY = minimapY + 24 + this.minimapSize + 8;
    const btnSize = 30;
    const btnColor = '#58a6ff';
    const btnStyle = { fontSize: '18px', color: btnColor, fontFamily: 'monospace', fontStyle: 'bold' as const };

    this.scrollUpBtn = this.scene.add.text(14 + 90, btnY, '\u25B2', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-up'));
    this.leftPanelContainer.add(this.scrollUpBtn);
    this.scrollButtons.push(this.scrollUpBtn);

    this.scrollDownBtn = this.scene.add.text(14 + 90, btnY + btnSize + 4, '\u25BC', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-down'));
    this.leftPanelContainer.add(this.scrollDownBtn);
    this.scrollButtons.push(this.scrollDownBtn);

    this.scrollLeftBtn = this.scene.add.text(14 + 90 - btnSize - 4, btnY + btnSize / 2 + 2, '\u25C0', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-left'));
    this.leftPanelContainer.add(this.scrollLeftBtn);
    this.scrollButtons.push(this.scrollLeftBtn);

    this.scrollRightBtn = this.scene.add.text(14 + 90 + btnSize + 4, btnY + btnSize / 2 + 2, '\u25B6', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-right'));
    this.leftPanelContainer.add(this.scrollRightBtn);
    this.scrollButtons.push(this.scrollRightBtn);

    this.artifactTooltip = this.scene.add.container(0, 0).setDepth(25).setVisible(false);
    const tooltipBg = this.scene.add.rectangle(0, 0, 220, 60, 0x0d1117, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    const tooltipText = this.scene.add.text(8, 8, '', {
      fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: 204 },
    });
    this.artifactTooltip.add([tooltipBg, tooltipText]);
    (this.artifactTooltip as any).tooltipText = tooltipText;
  }

  createSettlerIcons(onClick: (index: number) => void): void {
    this.onSettlerIconClick = onClick;
    const iconSize = 40;
    const startX = 14;
    const startY = this.dnBand.y + this.dnBand.h + 4;

    for (let i = 0; i < 3; i++) {
      const container = this.scene.add.container(startX + i * (iconSize + 8), startY).setDepth(21);

      const bg = this.scene.add.rectangle(0, 0, iconSize, iconSize, 0x21262d, 0.9)
        .setOrigin(0).setStrokeStyle(2, COLORS.panelBorder)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bg.setStrokeStyle(2, 0x58a6ff);
        })
        .on('pointerout', () => {
          const alive = this.simulation?.entityManager?.getByType('settler') as any[];
          if (!alive) { bg.setStrokeStyle(2, COLORS.panelBorder); return; }
          const selSettler = (this.scene as any).getSelectedSettler?.();
          const selIdx = selSettler ? alive.indexOf(selSettler) : -1;
          if (i === selIdx) {
            bg.setStrokeStyle(2, 0xffd700);
          } else {
            bg.setStrokeStyle(2, COLORS.panelBorder);
          }
        })
        .on('pointerdown', () => this.onSettlerIconClick?.(i));
      container.add(bg);

      // Portrait will be added in updateSettlerIcons on first update
      container.setSize(iconSize, iconSize);

      this.leftPanelContainer.add(container);
      this.settlerIcons.push(container);
      this.settlerIconsBg.push(bg);
    }
  }

  updateSettlerIcons(selectedIndex: number): void {
    const allSettlers = this.simulation?.entityManager?.getByType('settler') as any[] ?? [];
    const heroKeys = ['hero_engineer', 'hero_biologist', 'hero_pilot'];
    for (let i = 0; i < this.settlerIcons.length; i++) {
      const container = this.settlerIcons[i];
      const bg = this.settlerIconsBg[i];

      if (i >= allSettlers.length || (allSettlers[i] && !allSettlers[i].isAlive)) {
        container.setVisible(false);
        continue;
      }
      container.setVisible(true);

      // Remove old children (avatar + hp bar)
      while (container.list.length > 1) {
        container.list[container.list.length - 1].destroy();
      }

      // Add hero image
      const texKey = heroKeys[i] || heroKeys[0];
      const avatar = this.scene.add.image(20, 18, texKey).setDisplaySize(36, 36);

      // Tint portrait red when HP < 50%
      const settler = allSettlers[i];
      if (settler && settler.hp < settler.maxHp * 0.5) {
        avatar.setTint(0xff6666);
      }

      container.add(avatar);

      // HP bar below portrait
      if (settler) {
        const hpRatio = settler.hp / settler.maxHp;
        const barW = 36;
        const barH = 4;
        const barX = 20 - barW / 2;
        const barY = 38;
        const hpBarBg = this.scene.add.rectangle(barX, barY, barW, barH, 0x333333, 0.8).setOrigin(0);
        const hpColor = hpRatio > 0.5 ? 0x44cc44 : hpRatio > 0.25 ? 0xcccc44 : 0xcc4444;
        const hpBar = this.scene.add.rectangle(barX, barY, barW * hpRatio, barH, hpColor, 1).setOrigin(0);
        container.add(hpBarBg);
        container.add(hpBar);
      }

      if (i === selectedIndex) {
        bg.setStrokeStyle(2, 0xffd700);
        bg.setFillStyle(0x3a3a4a, 0.9);
      } else {
        bg.setStrokeStyle(2, COLORS.panelBorder);
        bg.setFillStyle(0x21262d, 0.9);
      }
    }
  }

  createActionLog(): void {
    const logX = FIELD_X + FIELD_W + 10;
    const logY = 220;

    const logBg = this.scene.add.rectangle(logX, logY, 230, 500, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);

    const logTitle = this.scene.add.text(logX + 8, logY + 8, `\u2500\u2500 ${languageManager.ui.actionLog} \u2500\u2500`, {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(21);

    this.taskLogText = this.scene.add.text(logX + 8, logY + 32, '', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: 214 },
      lineSpacing: 3,
    }).setDepth(21);
  }

  createInfoPanel(): void {
    const px = PANEL_X - 240;
    const py = 10;

    this.infoPanel = this.scene.add.container(px, py).setDepth(25).setVisible(false);

    const bg = this.scene.add.rectangle(0, 0, 230, 250, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, 0x44cc44);
    this.infoPanel.add(bg);

    this.infoText = this.scene.add.text(10, 8, '', {
      fontSize: '14px', color: '#e0e0e0', fontFamily: 'monospace',
      wordWrap: { width: 210 },
    });
    this.infoPanel.add(this.infoText);

    this.collectBtn = this.scene.add.text(10, 160, `[${languageManager.ui.collect}]`, {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onCollect());
    this.infoPanel.add(this.collectBtn);

    this.demolishBtn = this.scene.add.text(120, 160, '[Demolish]', {
      fontSize: '14px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onDemolish());
    this.infoPanel.add(this.demolishBtn);

    this.continueBtn = this.scene.add.text(10, 190, '[Continue]', {
      fontSize: '14px', color: '#44ff44', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onContinue());
    this.infoPanel.add(this.continueBtn);

    this.repairBtn = this.scene.add.text(110, 190, `[${languageManager.ui.repair ?? 'REPAIR'}]`, {
      fontSize: '14px', color: '#ffaa00', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onRepair());
    this.infoPanel.add(this.repairBtn);

    this.journalBtn = this.scene.add.text(10, 220, '[📋 Журнал]', {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onJournal());
    this.infoPanel.add(this.journalBtn);
  }

  private onDemolish(): void {
    if (!this.selectedBuilding) return;
    if (this.onDemolishCallback) {
      this.onDemolishCallback(this.selectedBuilding);
    }
  }

  private onContinue(): void {
    if (!this.selectedBuilding) return;
    if (this.onContinueCallback) {
      this.onContinueCallback(this.selectedBuilding);
    }
  }

  private onRepair(): void {
    if (!this.selectedBuilding) return;
    if (this.onRepairCallback) {
      this.onRepairCallback(this.selectedBuilding);
    }
  }

  private onJournal(): void {
    if (!this.selectedBuilding) return;
    if (this.onJournalCallback) {
      this.onJournalCallback(this.selectedBuilding);
    }
  }

  private onCollect(): void {
    if (!this.selectedEntity) return;
    if (this.onCollectCallback) {
      this.onCollectCallback(this.selectedEntity, false);
    }
  }

  onCollectCallback: ((entity: Entity, queue: boolean) => void) | null = null;

  createBottomHUD(
    onSave: () => void,
    onLoad: () => void,
    onClear: () => void,
    onBuildIconCreated: () => void,
    debugPanel?: import('./DebugPanel').DebugPanel,
    onExit?: () => void
  ): void {
    this.bottomHudBg = this.scene.add.rectangle(FIELD_X, BOTTOM_HUD_Y, FIELD_W, HUD_HEIGHT, COLORS.uiPanel, 0.95)
      .setOrigin(0).setDepth(20);
    this.bottomHudAccent = this.scene.add.rectangle(FIELD_X, BOTTOM_HUD_Y, FIELD_W, 2, COLORS.settler, 0.5)
      .setOrigin(0).setDepth(21);

    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 6, y: 3 },
    };

    const topBtnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '13px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 5, y: 2 },
    };

    const logX = FIELD_X + FIELD_W + 10;
    const btnsY = 730;
    let btnX = logX;
    const btnDepth = 35;

    const exitBtn = this.scene.add.text(btnX, btnsY, `[Exit]`, topBtnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(btnDepth)
      .on('pointerdown', () => onExit?.());
    this.hudButtons.push(exitBtn);
    btnX += exitBtn.width + 4;

    const saveBtn = this.scene.add.text(btnX, btnsY, `[${languageManager.ui.save}]`, topBtnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(btnDepth)
      .on('pointerdown', onSave);
    this.hudButtons.push(saveBtn);
    btnX += saveBtn.width + 4;

    const loadBtn = this.scene.add.text(btnX, btnsY, `[${languageManager.ui.load}]`, topBtnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(btnDepth)
      .on('pointerdown', onLoad);
    this.hudButtons.push(loadBtn);
    btnX += loadBtn.width + 4;

    const clearBtn = this.scene.add.text(btnX, btnsY, `[${languageManager.ui.clear}]`, topBtnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(btnDepth)
      .on('pointerdown', onClear);
    this.hudButtons.push(clearBtn);

    const replayBtn = this.scene.add.text(logX, btnsY + 20, `[Replay]`, topBtnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(btnDepth)
      .on('pointerdown', () => {
        if (this.replayRecorder && this.replayRecorder.hasRecordedData()) {
          this.replayRecorder.autoSave();
          this.addLog('Replay saved!');
        } else {
          this.addLog('No replay data recorded yet');
        }
      });
    this.hudButtons.push(replayBtn);

    if (debugPanel) {
      const controlX = logX;
      const controlY = btnsY + 42;

      const langBtn = this.scene.add.text(controlX, controlY, `[${languageManager.lang.toUpperCase()}]`, {
        ...btnStyle,
        color: '#ffd700',
      }).setInteractive({ useHandCursor: true }).setDepth(btnDepth)
        .on('pointerdown', () => {
          languageManager.toggle();
          langBtn.setText(`[${languageManager.lang.toUpperCase()}]`);
        });
      this.hudButtons.push(langBtn);

      const speeds = [1, 2, 4];
      let xOff = controlX + langBtn.width + 8;
      const speedBtns: Phaser.GameObjects.Text[] = [];
      for (const spd of speeds) {
        const btn = this.scene.add.text(xOff, controlY, `\u00d7${spd}`, {
          ...btnStyle,
          color: spd === 1 ? '#58a6ff' : '#8b949e',
        }).setInteractive({ useHandCursor: true }).setDepth(btnDepth)
          .on('pointerdown', () => {
            debugPanel.speed = spd;
            for (let i = 0; i < speedBtns.length; i++) {
              speedBtns[i].setColor(speeds[i] === spd ? '#58a6ff' : '#8b949e');
            }
          });
        speedBtns.push(btn);
        this.hudButtons.push(btn);
        xOff += btn.width + 4;
      }
    }

    onBuildIconCreated();
    this.createBuildButtons();
  }

  createBuildButtons(): void {
    const types = Object.keys(buildingsData) as BuildingType[];
    const btnY = BOTTOM_HUD_Y + 15;
    const ICON_SIZE = 50;
    const ICON_GAP = 10;

    const cancelBtn = this.scene.add.text(FIELD_X + 10, btnY + 5, '[X]', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 6 },
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        if (!this.buildButtonsEnabled) return;
        this.buildMode = null;
        this.updateBuildButtonStates();
      });
    this.buildButtons.push(cancelBtn);

    let xOff = FIELD_X + 50;
    for (const type of types) {
      const def = (buildingsData as any)[type];
      const reqEntries = Object.entries(def.requires);
      const reqStr = reqEntries.map(([k, v]) => `${k}:${v}`).join(' ');

      const container = this.scene.add.container(xOff, btnY).setDepth(22);

      const bg = this.scene.add.rectangle(0, 0, ICON_SIZE + 8, ICON_SIZE + 8, 0x21262d, 0.9)
        .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (!this.buildButtonsEnabled) return;
          bg.setStrokeStyle(2, 0x58a6ff);
        })
        .on('pointerout', () => {
          if (!this.buildButtonsEnabled) return;
          bg.setStrokeStyle(1, COLORS.panelBorder);
        })
        .on('pointerdown', () => {
          if (!this.buildButtonsEnabled) return;
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
      container.add(bg);

      const icon = this.scene.add.image(ICON_SIZE / 2, ICON_SIZE / 2, `icon_${type}`)
        .setDisplaySize(ICON_SIZE - 8, ICON_SIZE - 8);
      container.add(icon);

      const costTooltip = this.scene.add.text(ICON_SIZE / 2, ICON_SIZE + 6, reqStr, {
        fontSize: '10px', color: '#8b949e', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      container.add(costTooltip);

      const affordable = this.canAfford(type);
      if (!affordable) {
        icon.setAlpha(0.35);
        bg.setFillStyle(0x161b22, 0.9);
      } else {
        bg.setFillStyle(0x21262d, 0.9);
      }

      container.setSize(ICON_SIZE + 8, ICON_SIZE + 20);


      this.buildTypeMap.set(container, type);
      this.buildButtons.push(container);

      xOff += ICON_SIZE + 16 + ICON_GAP;
    }
  }

  private createDayNightWidget(): void {
    const { x, y, w, h } = this.dnBand;

    this.dnSky = this.scene.add.rectangle(x, y, w, h, 0x0a1430, 1)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.leftPanelContainer.add(this.dnSky);

    for (let i = 0; i < 10; i++) {
      const sx = x + 8 + Math.random() * (w - 16);
      const sy = y + 6 + Math.random() * (h - 12);
      const star = this.scene.add.circle(sx, sy, 1, 0xffffff, 1).setAlpha(0);
      this.leftPanelContainer.add(star);
      this.dnStars.push(star);
    }

    const cx = x + w / 2;
    const cy = y + h / 2;
    this.dnSun = this.scene.add.circle(cx, cy, 8, 0xffd24a, 1)
      .setStrokeStyle(2, 0xffe9a0);
    this.leftPanelContainer.add(this.dnSun);

    this.dnMoon = this.scene.add.circle(cx, cy, 7, 0xcdd6f4, 1)
      .setStrokeStyle(1, 0x9aa6d4);
    this.leftPanelContainer.add(this.dnMoon);

    this.dnLabel = this.scene.add.text(x + w - 4, y + 3, '', {
      fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(1, 0);
    this.leftPanelContainer.add(this.dnLabel);

    this.dnDim = this.scene.add.rectangle(x, y, w, h, 0x000000, 0)
      .setOrigin(0);
    this.leftPanelContainer.add(this.dnDim);

    this.updateDayNight(0);
  }

  setDayNightDimmed(dimmed: boolean): void {
    this.dnDim.setAlpha(dimmed ? 0.8 : 0);
  }

  setBuildButtonsEnabled(enabled: boolean): void {
    this.buildButtonsEnabled = enabled;
    for (const btn of this.buildButtons) {
      if (enabled) btn.setInteractive({ useHandCursor: true });
      else btn.disableInteractive();
    }
    this.updateBuildButtonStates();
  }

  setHudButtonsEnabled(enabled: boolean): void {
    for (const btn of this.hudButtons) {
      if (enabled) btn.setInteractive({ useHandCursor: true });
      else btn.disableInteractive();
      btn.setAlpha(enabled ? 1 : 0.3);
    }
  }

  setScrollButtonsEnabled(enabled: boolean): void {
    for (const btn of this.scrollButtons) {
      if (enabled) btn.setInteractive({ useHandCursor: true });
      else btn.disableInteractive();
      btn.setAlpha(enabled ? 1 : 0.3);
    }
  }

  private updateDayNight(tickCount: number): void {
    const { x, y, w, h } = this.dnBand;
    const innerLeft = x + 12;
    const innerRight = x + w - 12;
    const centerY = y + h / 2;
    const arc = h / 2 - 8;

    const phase = ((tickCount % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS;
    const night = phase >= DAY_TICKS;

    const nightA = nightAlpha(tickCount);
    const b = Math.max(0, Math.min(1, 1 - nightA / NIGHT_MAX_ALPHA));
    this.dnSky.setFillStyle(this.lerpColor(0x0a1430, 0x7ec0ee, b));

    const starA = Math.max(0, 1 - b * 2.2);
    for (const st of this.dnStars) st.setAlpha(starA);

    const f = night ? (phase - DAY_TICKS) / NIGHT_TICKS : phase / DAY_TICKS;
    const clamped = Math.max(0, Math.min(1, f));
    const bx = innerLeft + (innerRight - innerLeft) * f;
    const by = centerY + arc * (1 - Math.sin(Math.PI * clamped));

    this.dnSun.setVisible(!night).setPosition(bx, by);
    this.dnMoon.setVisible(night).setPosition(bx, by);

    this.dnLabel.setText(night ? 'Night' : 'Day');
    this.dnLabel.setColor(night ? '#9fb3ff' : '#173a5e');
  }

  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }

  canAfford(type: BuildingType): boolean {
    const def = (buildingsData as any)[type];
    return Object.entries(def.requires).every(([res, qty]) =>
      this.simulation.hasResource(res, qty as number)
    );
  }

  getAllowedBuildTypes(): string[] | null {
    const qm = (this.scene as any).questManager;
    if (!qm) return null;
    const active = qm.getActiveQuests();
    if (active.length === 0) return null;
    const questId = active[0].quest.id;
    // q1_2: only walls and gates
    if (questId === 'q1_2') return ['wall', 'gate'];
    return null;
  }

  updateBuildButtonStates(): void {
    const types = Object.keys(buildingsData) as BuildingType[];
    const settler = (this.scene as any).getSelectedSettler() as Settler;
    const allowedTypes = this.getAllowedBuildTypes();

    if (this.buildMode) {
      this.bottomHudBg.setFillStyle(0x3a2a0a, 0.98);
      this.bottomHudBg.setStrokeStyle(3, 0xffae00);
      this.bottomHudAccent.setFillStyle(0xffae00, 1);
    } else {
      this.bottomHudBg.setFillStyle(COLORS.uiPanel, 0.95);
      this.bottomHudBg.setStrokeStyle();
      this.bottomHudAccent.setFillStyle(COLORS.settler, 0.5);
    }

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const def = (buildingsData as any)[type];
      const btn = this.buildButtons[i + 1];

      if (!btn || !(btn instanceof Phaser.GameObjects.Container)) continue;

      const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
      const icon = btn.list[1] as Phaser.GameObjects.Image;

      const isAllowed = allowedTypes === null || allowedTypes.includes(type);
      const affordable = Object.entries(def.requires).every(([res, qty]) =>
        this.simulation.hasResource(res, qty as number)
      );

      if (!settler || !isAllowed) {
        icon.setAlpha(0.15);
        bg.setFillStyle(0x161b22, 0.5);
        btn.disableInteractive();
        continue;
      } else {
        btn.setInteractive({ useHandCursor: true });
      }

      if (affordable) {
        icon.setAlpha(1);
        bg.setFillStyle(0x21262d, 0.9);
      } else {
        icon.setAlpha(0.35);
        bg.setFillStyle(0x161b22, 0.9);
      }
    }

    for (let i = 0; i < this.buildButtons.length; i++) {
      const btn = this.buildButtons[i];
      if (!this.buildButtonsEnabled) {
        btn.setAlpha(0.3);
        continue;
      }
      if (i === 0) {
        btn.setAlpha(this.buildMode ? 1.0 : 0.4);
      } else {
        const type = this.buildTypeMap.get(btn)!;
        btn.setAlpha(this.buildMode === type ? 1.0 : 0.8);
      }
    }
  }

  updateInfoPanel(): void {
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
      this.demolishBtn.setVisible(true);
      this.continueBtn.setVisible(!bld.built);
      this.repairBtn.setVisible(bld.built && bld.hp < bld.maxHp);
      this.journalBtn.setVisible(bld.built && bld.buildingType === 'lab');
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
      } else if (e.entityType === 'artifact') {
        const artifact = e as Artifact;
        lines = [
          `${artifact.name}`,
          `${languageManager.ui.infoType}: ${artifact.artifactType}`,
        ];
        this.collectBtn.setVisible(true);
      }
      this.infoText.setText(lines.join('\n'));
      this.demolishBtn.setVisible(false);
      this.continueBtn.setVisible(false);
      this.repairBtn.setVisible(false);
      this.journalBtn.setVisible(false);
    }
  }

  updateSelection(): void {
    if (this.selectedBuilding) {
      const bldSize = this.selectedBuilding.size ?? 1;
      const { sx, sy } = this.tileToScreen(this.selectedBuilding.x, this.selectedBuilding.y);
      const footprintPx = TILE_SIZE * bldSize;
      this.selectionRect.setPosition(sx + footprintPx / 2 - TILE_SIZE / 2, sy + footprintPx / 2 - TILE_SIZE / 2);
      this.selectionRect.setSize(footprintPx + 4, footprintPx + 4);
      this.selectionRect.setVisible(true);
    } else if (this.selectedEntity) {
      const { sx, sy } = this.tileToScreen(this.selectedEntity.x, this.selectedEntity.y);
      this.selectionRect.setPosition(sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
      this.selectionRect.setSize(TILE_SIZE + 4, TILE_SIZE + 4);
      this.selectionRect.setVisible(true);
    } else {
      this.selectionRect.setVisible(false);
    }
  }

  updateLeftPanel(gameOver: boolean, tickCount: number): void {
    if (gameOver) return;
    this.updateDayNight(tickCount);
    const s = (this.scene as any).getSelectedSettler() as Settler;
    if (!s) return;

    const taskStr = s.currentTaskId ? languageManager.ui.working : languageManager.ui.idle;
    const buildStr = this.buildMode ? `\n${languageManager.ui.buildMode}: ${(buildingsData as any)[this.buildMode].name}` : '';

    const colorHex = '#' + s.color.toString(16).padStart(6, '0');
    const foodWarning = s.food <= 2 ? ' ⚠' : '';
    const hungerWarning = s.hunger <= 20 ? ' ⚠' : '';
    this.colonistStatusText.setText(
      `${s.name} (${s.settlerClass})\n` +
      `${languageManager.ui.position}: ${s.x},${s.y}\n` +
      `${languageManager.ui.hp}: ${Math.round(s.hp)}/${s.maxHp}\n` +
      (NEEDS_ENABLED
        ? `${languageManager.ui.hunger}: ${Math.round(s.hunger)}%${hungerWarning}\n` +
        `${languageManager.ui.energy}: ${Math.round(s.energy)}%\n`
        : '') +
      `${languageManager.ui.food}: ${s.food}${foodWarning}\n` +
      `${languageManager.ui.tick}: ${tickCount}` +
      buildStr
    );
    this.colonistStatusText.setColor(colorHex);

    // Update settler icons (hide dead, show alive, update portraits)
    const allSettlers = this.simulation?.entityManager?.getByType('settler') as any[] ?? [];
    const selIdx = allSettlers.indexOf(s);
    this.updateSettlerIcons(selIdx);

    this.colonistTaskText.setText(
      `\u2500\u2500 ${languageManager.ui.taskSection} \u2500\u2500\n` +
      `${languageManager.ui.status}: ${taskStr}\n` +
      `${languageManager.ui.taskId}: ${s.currentTaskId ?? languageManager.ui.none}\n` +
      `${languageManager.ui.pathLen}: ${s.path.length}`
    );

    this.colonistInvText.setText(
      `\u2500\u2500 ${languageManager.ui.inventorySection} \u2500\u2500`
    );

    if (s) {
      this.updateInventoryIcons(s);
    }

    this.updateGlobalInventory();

    const questSystem = (this.scene as any).questSystem;
    const questManager = (this.scene as any).questManager;
    if (questManager) {
      const activeQuests = questManager.getActiveQuests();
      if (activeQuests.length > 0) {
        const lines: string[] = ['\u2500\u2500 Квесты \u2500\u2500'];
        for (const { quest, state } of activeQuests) {
          lines.push(`▸ ${quest.title}`);
          const progress = questManager.getProgressText(quest.id);
          if (progress) lines.push(`  ${progress}`);
        }
        const available = questManager.getAvailableQuests();
        for (const { quest } of available) {
          lines.push(`○ ${quest.title} (доступен)`);
        }
        this.questText.setText(lines.join('\n'));
      } else {
        const available = questManager.getAvailableQuests();
        if (available.length > 0) {
          const lines = ['\u2500\u2500 Квесты \u2500\u2500'];
          for (const { quest } of available) {
            lines.push(`○ ${quest.title}`);
          }
          this.questText.setText(lines.join('\n'));
        } else {
          // Check if all quests completed
          this.questText.setText('\u2500\u2500 Квесты \u2500\u2500\nВсе квесты выполнены!');
        }
      }
    } else if (questSystem) {
      const questState = questSystem.getState();
      if (questState.completed) {
        this.questText.setText('\u2500\u2500 Quest \u2500\u2500\nComplete!');
      } else {
        this.questText.setText(
          `\u2500\u2500 Quest \u2500\u2500\n` +
          `${questSystem.getStageDescription()}\n` +
          `${questSystem.getProgressText()}`
        );
      }
    }
  }

  updateThoughts(ticked: boolean): void {
    if (!ticked) return;
    this.thoughtTimer++;
    if (this.thoughtTimer >= 10) {
      this.thoughtTimer = 0;
      const thoughts = languageManager.narrative.settlerThoughts;
      this.thoughtText.setText(thoughts[this.thoughtIndex % thoughts.length]);
      this.thoughtIndex++;
    }
  }

  updateMinimap(): void {
    this.minimapGraphics.clear();
    const grid = this.simulation.tileGrid;
    const ts = this.minimapTileSize;
    const ox = 14;
    const oy = 644;

    const tileColors: Record<string, number> = {
      grass: 0x3a5a2a,
      dirt: 0x8b7355,
      water: 0x3b7dd8,
      stone: 0x808080,
      sand: 0xc2b280,
    };

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (!grid.isRevealed(x, y)) continue;
        const tile = grid.get(x, y);
        if (!tile) continue;
        const color = tileColors[tile.type] ?? 0x333333;
        this.minimapGraphics.fillStyle(color, 1);
        this.minimapGraphics.fillRect(ox + x * ts, oy + y * ts, ts, ts);
      }
    }

    const entities = this.simulation.entityManager.getAll();
    for (const e of entities) {
      if (!grid.isRevealed(e.x, e.y)) continue;
      let color = 0xffffff;
      if (e.entityType === 'settler') color = COLORS.settler;
      else if (e.entityType === 'dinosaur') color = COLORS.dinosaur;
      else if (e.entityType === 'resource') color = COLORS.resource;
      else if (e.entityType === 'building') color = COLORS.building;
      else if (e.entityType === 'artifact') color = 0xffd700;
      this.minimapGraphics.fillStyle(color, 1);
      this.minimapGraphics.fillRect(ox + e.x * ts, oy + e.y * ts, ts, ts);
    }

    const vx = ox + this.scrollX * ts;
    const vy = oy + this.scrollY * ts;
    const vw = VIEWPORT_TILES * ts;
    const vh = VIEWPORT_TILES * ts;
    this.minimapGraphics.lineStyle(1, 0xffffff, 0.8);
    this.minimapGraphics.strokeRect(vx, vy, vw, vh);
  }

  private showArtifactTooltip(name: string, description: string, x: number, y: number): void {
    const tooltipText = (this.artifactTooltip as any).tooltipText as Phaser.GameObjects.Text;
    tooltipText.setText(`${name}\n${description}`);
    this.artifactTooltip.setPosition(x, y);
    this.artifactTooltip.setVisible(true);
  }

  private lastInventoryHash: string = '';

  updateInventoryIcons(settler: Settler): void {
    const hash = `${settler.id}|` + settler.inventory.map(i => `${i.resourceType}:${i.quantity}:${i.name}`).join(',');
    const artifactHash = Array.from(settler.collectedArtifacts.entries()).map(([n, c]) => `${n}:${c}`).join(',');
    const fullHash = hash + '|' + artifactHash;

    if (fullHash === this.lastInventoryHash) return;
    this.lastInventoryHash = fullHash;

    for (const icon of this.inventoryIcons) {
      icon.destroy();
    }
    this.inventoryIcons = [];

    const resourceColors: Record<string, number> = {
      wood: 0x8B4513,
      stone: 0x808080,
      food: 0x228B22,
    };

    const resourceIcons: Record<string, string> = {
      wood: 'W',
      stone: 'S',
      food: 'F',
    };

    const startX = 14;
    const startY = 398;
    const iconSize = 24;
    const gap = 4;

    let x = startX;
    for (const item of settler.inventory) {
      if (item.quantity <= 0) continue;
      if (item.resourceType === 'artifact') continue;

      const color = resourceColors[item.resourceType] ?? 0x666666;
      const icon = resourceIcons[item.resourceType] ?? '?';

      const bg = this.scene.add.rectangle(0, 0, iconSize, iconSize, color, 0.8)
        .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);

      const iconText = this.scene.add.text(iconSize / 2, iconSize / 2, icon, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      const countText = this.scene.add.text(iconSize - 2, 2, `${item.quantity}`, {
        fontSize: '9px', color: '#ffff00', fontFamily: 'monospace',
      }).setOrigin(1, 0);

      const iconContainer = this.scene.add.container(x, startY, [bg, iconText, countText]);
      iconContainer.setSize(iconSize, iconSize);

      this.inventoryIconContainer.add(iconContainer);
      this.inventoryIcons.push(iconContainer);

      x += iconSize + gap;
    }

    if (this.artifactSystem) {
      settler.collectedArtifacts.forEach((count, name) => {
        if (count <= 0) return;
        const effect = this.artifactSystem!.getArtifactEffect(name);
        if (!effect) return;

        const color = Phaser.Display.Color.HexStringToColor(effect.color).color;

        const bg = this.scene.add.rectangle(0, 0, iconSize, iconSize, color, 0.8)
          .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder)
          .setInteractive({ useHandCursor: true });

        const iconText = this.scene.add.text(iconSize / 2, iconSize / 2, effect.icon, {
          fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);

        const artifactContainer = this.scene.add.container(x, startY, [bg, iconText]);
        artifactContainer.setSize(iconSize, iconSize);

        bg.on('pointerover', () => {
          bg.setStrokeStyle(2, 0xffffff);
          bg.setFillStyle(color, 1);
          this.showArtifactTooltip(name, effect.description, x, startY - 60);
        });
        bg.on('pointerout', () => {
          bg.setStrokeStyle(1, COLORS.panelBorder);
          bg.setFillStyle(color, 0.8);
          this.artifactTooltip.setVisible(false);
        });

        this.inventoryIconContainer.add(artifactContainer);
        this.inventoryIcons.push(artifactContainer);

        x += iconSize + gap;
      });
    }
  }

  updateGlobalInventory(): void {
    const sim = this.simulation as any;
    if (!sim) return;

    const inventory = sim.inventory || [];
    const hash = inventory.map((i: any) => `${i.resourceType}:${i.quantity}:${i.name || ''}`).join(',');

    if (hash === this.lastGlobalInventoryHash) return;
    this.lastGlobalInventoryHash = hash;

    for (const icon of this.globalInventoryIcons) {
      icon.destroy();
    }
    this.globalInventoryIcons = [];

    const resourceColors: Record<string, number> = {
      wood: 0x8B4513,
      stone: 0x808080,
      food: 0x228B22,
    };

    const resourceIcons: Record<string, string> = {
      wood: 'W',
      stone: 'S',
      food: 'F',
    };

    const startX = 0;
    const startY = 0;
    const iconSize = 48;
    const gap = 8;

    let x = startX;
    for (const item of inventory) {
      if (item.quantity <= 0) continue;

      const color = resourceColors[item.resourceType] ?? 0x666666;
      const icon = resourceIcons[item.resourceType] ?? '?';

      const bg = this.scene.add.rectangle(0, 0, iconSize, iconSize, color, 0.8)
        .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);

      const iconText = this.scene.add.text(iconSize / 2, iconSize / 2, icon, {
        fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      const countText = this.scene.add.text(iconSize - 2, 2, `${item.quantity}`, {
        fontSize: '18px', color: '#ffff00', fontFamily: 'monospace',
      }).setOrigin(1, 0);

      const iconContainer = this.scene.add.container(x, startY, [bg, iconText, countText]);
      iconContainer.setSize(iconSize, iconSize);

      this.globalInventoryContainer.add(iconContainer);
      this.globalInventoryIcons.push(iconContainer);

      x += iconSize + gap;
    }
  }

  checkMilestone(key: string): void {
    if (this.milestonesShown.has(key)) return;
    const lines = (languageManager.narrative.milestones as any)[key];
    if (lines && lines.length > 0) {
      this.milestonesShown.add(key);
      const msg = lines[Math.floor(Math.random() * lines.length)];
      this.addLog(msg);
    }
  }

  addLog(msg: string): void {
    this.taskLog.push(msg);
    if (this.taskLog.length > 8) this.taskLog.shift();
    this.taskLogText.setText(this.taskLog.join('\n'));
  }

  deselectAll(): void {
    this.selectedBuilding = null;
    this.selectedEntity = null;
    this.selectionRect.setVisible(false);
    this.infoPanel.setVisible(false);
  }

  reset(): void {
    this.taskLog = [];
    this.thoughtIndex = 0;
    this.thoughtTimer = 0;
    this.milestonesShown.clear();
    this.buildMode = null;
    this.selectedBuilding = null;
    this.selectedEntity = null;
    this.buildButtons = [];
    this.buildTypeMap.clear();
  }
}
