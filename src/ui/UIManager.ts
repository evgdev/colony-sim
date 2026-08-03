import Phaser from 'phaser';
import {
  COLORS,
  NEEDS_ENABLED,
  DAY_TICKS, NIGHT_TICKS, CYCLE_TICKS, NIGHT_MAX_ALPHA, nightAlpha,
} from '../config';
import { getLayout } from './LayoutConfig';
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
import { TaskPriority, AutoTaskIcon } from '../core/Task';
import { WorkMode } from '../entities/Settler';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { QuestModal } from './QuestModal';
import { CraftPanel, CraftRecipe } from './CraftPanel';
import { Tooltip } from './menu/Tooltip';

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
  workModeBtns: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  workModeLabels: string[] = ['[A]', '[G]', '[B]', '[-]'];
  workModeModes: WorkMode[] = ['auto', 'gather', 'build', 'idle'];
  workModeContainer!: Phaser.GameObjects.Container;
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
  buildModeJustSet: boolean = false;
  buildButtons: (Phaser.GameObjects.Text | Phaser.GameObjects.Container | Phaser.GameObjects.Rectangle)[] = [];
  buildTypeMap: Map<Phaser.GameObjects.Text | Phaser.GameObjects.Container | Phaser.GameObjects.Rectangle, BuildingType> = new Map();
  private bottomHudBg!: Phaser.GameObjects.Rectangle;
  private bottomHudAccent!: Phaser.GameObjects.Rectangle;

  private dnSky!: Phaser.GameObjects.Rectangle;
  private dnSun!: Phaser.GameObjects.Arc;
  private dnMoon!: Phaser.GameObjects.Arc;
  private dnStars: Phaser.GameObjects.Arc[] = [];
  private dnLabel!: Phaser.GameObjects.Text;
  private dnDim!: Phaser.GameObjects.Rectangle;
  private dnBand = { x: 14, y: 44, w: 222, h: 44 };

  private settlerIcons: Phaser.GameObjects.Container[] = [];
  private settlerIconsBg: Phaser.GameObjects.Rectangle[] = [];
  private onSettlerIconClick?: (index: number) => void;
  private buildButtonsEnabled: boolean = true;
  startMenuOpen: boolean = false;
  uiClickConsumed: boolean = false;
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
  questModal!: QuestModal;
  private questBtn!: Phaser.GameObjects.Text;
  craftPanel!: CraftPanel;
  private craftBtn!: Phaser.GameObjects.Text;
  private useCraftedBtn!: Phaser.GameObjects.Text;
  onCraftCallback: ((recipeId: string, workshop: import('../entities/Building').Building) => void) | null = null;
  onUseCraftedCallback: ((recipeId: string, workshop: import('../entities/Building').Building) => void) | null = null;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.craftPanel = new CraftPanel(scene);
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
    const L = getLayout();
    return {
      sx: L.fieldX + (tileX - this.scrollX) * L.tileSize + L.tileSize / 2,
      sy: L.fieldY + (tileY - this.scrollY) * L.tileSize + L.tileSize / 2,
    };
  }

  createEventArea(): void {
    const L = getLayout();
    const evBg = this.scene.add.rectangle(L.fieldX, 0, L.fieldW, L.eventH, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);

    this.globalInventoryContainer = this.scene.add.container(L.fieldX + 4, 1);
    this.globalInventoryContainer.setDepth(21);
    this.updateGlobalInventory();

    this.eventText = this.scene.add.text(L.fieldX + 220, 8, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: L.fieldW - 230 },
      lineSpacing: 4,
    }).setDepth(21);
  }

  addEvent(msg: string): void {
    this.eventText.setText(msg);
  }

  createLeftPanel(): void {
    const L = getLayout();
    this.leftPanelContainer = this.scene.add.container(0, 0).setDepth(20);

    const bg = this.scene.add.rectangle(0, 0, L.leftPanelW, L.canvasH, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.leftPanelContainer.add(bg);

    const title = this.scene.add.text(14, 12, languageManager.ui.colonyStatus, {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(title);

    const line1 = this.scene.add.rectangle(14, 38, L.leftPanelW - 28, 1, COLORS.panelBorder, 0.5)
      .setOrigin(0);
    this.leftPanelContainer.add(line1);

    this.createDayNightWidget();

    this.colonistStatusText = this.scene.add.text(14, 146, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: L.leftPanelW - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistStatusText);

    this.colonistTaskText = this.scene.add.text(14, 250, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: L.leftPanelW - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistTaskText);

    // Work mode buttons
    const wmY = 320;
    const wmTitle = this.scene.add.text(14, wmY, `\u2500\u2500 Режим работы \u2500\u2500`, {
      fontSize: '12px', color: '#58a6ff', fontFamily: 'monospace',
    });
    this.leftPanelContainer.add(wmTitle);

    this.workModeContainer = this.scene.add.container(14, wmY + 18);
    this.leftPanelContainer.add(this.workModeContainer);

    const modeLabels = ['Авто', 'Сбор', 'Стройка', 'Стоп'];
    const modeColors = ['#44ff44', '#ffaa00', '#4488ff', '#888888'];
    for (let i = 0; i < 4; i++) {
      const mode = this.workModeModes[i];
      const color = Phaser.Display.Color.HexStringToColor(modeColors[i]).color;
      const bg = this.scene.add.rectangle(i * 56, 0, 50, 18, 0x0d1117, 1)
        .setOrigin(0);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        const s = (this.scene as any).getSelectedSettler() as Settler;
        if (s) {
          s.workMode = mode;
          this.updateWorkModeButtons(s);
        }
      });
      const txt = this.scene.add.text(i * 56 + 2, 1, `[${modeLabels[i]}]`, {
        fontSize: '11px', color: modeColors[i], fontFamily: 'monospace',
        padding: { x: 2, y: 2 },
      }).setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => {
        const s = (this.scene as any).getSelectedSettler() as Settler;
        if (s) {
          s.workMode = mode;
          this.updateWorkModeButtons(s);
        }
      });
      this.workModeContainer.add(bg);
      this.workModeContainer.add(txt);
      this.workModeBtns.push({ bg, text: txt });
    }

    this.colonistInvText = this.scene.add.text(14, 380, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: L.leftPanelW - 28 },
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
      wordWrap: { width: L.leftPanelW - 28 },
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
      wordWrap: { width: L.leftPanelW - 28 },
      lineSpacing: 3,
      fontStyle: 'italic',
    });
    this.thoughtText.setCrop(0, 0, L.leftPanelW - 28, 48);
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
    const L = getLayout();
    const logX = L.fieldX + L.fieldW + 10;
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
    const L = getLayout();
    const px = L.panelX - 240;
    const py = 10;

    this.infoPanel = this.scene.add.container(px, py).setDepth(25).setVisible(false);

    const bg = this.scene.add.rectangle(0, 0, 230, 250, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, 0x44cc44);
    this.infoPanel.add(bg);

    // Close button (X)
    const closeBtn = this.scene.add.text(212, 4, '[X]', {
      fontSize: '14px', color: '#ff4444', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.uiClickConsumed = true;
        this.deselectAll();
        this.infoPanel.setVisible(false);
      });
    this.infoPanel.add(closeBtn);

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

    this.craftBtn = this.scene.add.text(120, 220, '[🔧 Craft]', {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onCraft());
    this.infoPanel.add(this.craftBtn);

    this.useCraftedBtn = this.scene.add.text(10, 250, '[✓ Use]', {
      fontSize: '14px', color: '#44ff44', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onUseCrafted());
    this.infoPanel.add(this.useCraftedBtn);
  }

  private onDemolish(): void {
    if (!this.selectedBuilding) return;
    this.uiClickConsumed = true;
    if (this.onDemolishCallback) {
      this.onDemolishCallback(this.selectedBuilding);
    }
  }

  private onContinue(): void {
    if (!this.selectedBuilding) return;
    this.uiClickConsumed = true;
    if (this.onContinueCallback) {
      this.onContinueCallback(this.selectedBuilding);
    }
  }

  private onRepair(): void {
    if (!this.selectedBuilding) return;
    this.uiClickConsumed = true;
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

  private onCraft(): void {
    if (!this.selectedBuilding) return;
    this.uiClickConsumed = true;
    if (this.onCraftCallback) {
      const bld = this.selectedBuilding;
      const def = (buildingsData as any)[bld.buildingType];
      const recipes: CraftRecipe[] = def?.craftRecipes ?? [];
      this.craftPanel.show(bld, recipes, this.simulation, this.onCraftCallback, this.onUseCraftedCallback ?? undefined);
    }
  }

  private onUseCrafted(): void {
    if (!this.selectedBuilding) return;
    const bld = this.selectedBuilding;
    if (bld.buildingType !== 'workshop' || bld.craftedItems.length === 0) return;
    // Use the first available crafted item
    const item = bld.craftedItems.find(i => i.quantity > 0);
    if (item && this.onUseCraftedCallback) {
      this.onUseCraftedCallback(item.resourceType, bld);
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
    const L = getLayout();
    const isMobile = L.mode === 'mobile';
    const btnDepth = 35;

    this.bottomHudBg = this.scene.add.rectangle(L.fieldX, L.bottomHudY, L.fieldW, L.bottomHudH, COLORS.uiPanel, 0.95)
      .setOrigin(0).setDepth(20);
    this.bottomHudAccent = this.scene.add.rectangle(L.fieldX, L.bottomHudY, L.fieldW, 2, COLORS.settler, 0.5)
      .setOrigin(0).setDepth(21);

    // Button styles — bigger on mobile for touch targets
    const btnFontSize = isMobile ? '16px' : '14px';
    const btnPadX = isMobile ? 10 : 6;
    const btnPadY = isMobile ? 6 : 3;
    const smallBtnFontSize = isMobile ? '14px' : '13px';
    const smallBtnPadX = isMobile ? 8 : 5;
    const smallBtnPadY = isMobile ? 5 : 2;

    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: btnFontSize, color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: btnPadX, y: btnPadY },
    };

    const topBtnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: smallBtnFontSize, color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: smallBtnPadX, y: smallBtnPadY },
    };

    // Position buttons: on desktop in right panel, on mobile inside bottom HUD
    const logX = isMobile ? L.fieldX + 8 : L.fieldX + L.fieldW + 10;
    const btnsY = isMobile ? L.bottomHudY + 4 : 730;
    let btnX = logX;

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
    btnX += clearBtn.width + 4;

    const encycBtn = this.scene.add.text(
      isMobile ? L.fieldX + L.fieldW - 10 : L.fieldX + L.fieldW - 130,
      isMobile ? btnsY : L.bottomHudY + L.bottomHudH - 28,
      `[Encyclopedia]`, {
      fontSize: smallBtnFontSize, color: '#44ddaa', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: smallBtnPadX, y: smallBtnPadY },
    }).setInteractive({ useHandCursor: true }).setDepth(btnDepth)
      .on('pointerdown', () => {
        (this.scene as any).encyclopediaModal?.show();
      });
    if (!isMobile) encycBtn.setOrigin(1, 0);
    this.hudButtons.push(encycBtn);

    const replayBtn = this.scene.add.text(logX, btnsY + (isMobile ? 30 : 20), `[Replay]`, topBtnStyle)
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
      const controlY = btnsY + (isMobile ? 56 : 42);

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
    const L = getLayout();
    const isMobile = L.mode === 'mobile';
    const types = Object.keys(buildingsData) as BuildingType[];
    const ICON_SIZE = isMobile ? 64 : 50;
    const ICON_GAP = isMobile ? 12 : 10;
    const btnW = ICON_SIZE + 16 + ICON_GAP;

    // Calculate how many buttons fit in one row
    const cancelBtnW = 50; // approximate [X] button width
    const availableW = L.fieldW - cancelBtnW - 20; // margin
    const maxPerRow = Math.max(1, Math.floor(availableW / btnW));

    // Calculate row height: icon + cost text + gap
    const rowH = ICON_SIZE + 24;
    const totalRows = Math.ceil(types.length / maxPerRow);

    const cancelFontSize = isMobile ? '20px' : '16px';
    const cancelPad = isMobile ? { x: 12, y: 10 } : { x: 8, y: 6 };
    const cancelBtn = this.scene.add.text(L.fieldX + 10, L.bottomHudY + 15, '[X]', {
      fontSize: cancelFontSize, color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: cancelPad,
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        if (!this.buildButtonsEnabled) return;
        this.buildMode = null;
        this.hideBuildTooltip();
        this.updateBuildButtonStates();
      });
    this.buildButtons.push(cancelBtn);

    const questManager = (this.scene as any).questManager;

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      const xOff = L.fieldX + cancelBtnW + 10 + col * btnW;
      const btnY = L.bottomHudY + 15 + row * rowH;

      const def = (buildingsData as any)[type];
      const reqEntries = Object.entries(def.requires);
      const reqStr = reqEntries.map(([k, v]) => `${k}:${v}`).join(' ');

      const isUnlocked = questManager ? questManager.isQuestUnlocked(type) : true;
      const affordable = this.canAfford(type);

      const container = this.scene.add.container(xOff, btnY).setDepth(22);

      const bg = this.scene.add.rectangle(0, 0, ICON_SIZE + 8, ICON_SIZE + 8, 0x21262d, 0.9)
        .setOrigin(0).setStrokeStyle(1, isUnlocked ? COLORS.panelBorder : 0x333333);

      if (isUnlocked) {
        bg.setInteractive({ useHandCursor: true })
          .on('pointerover', () => {
            if (!this.buildButtonsEnabled) return;
            bg.setStrokeStyle(2, 0x58a6ff);
            this.showBuildTooltip(type, bg.x + xOff, bg.y + btnY);
          })
          .on('pointerout', () => {
            if (!this.buildButtonsEnabled) return;
            bg.setStrokeStyle(1, COLORS.panelBorder);
            this.hideBuildTooltip();
          })
          .on('pointerdown', () => {
            if (!this.buildButtonsEnabled) return;
            this.hideBuildTooltip();
            this.selectedBuilding = null;
            this.selectionRect.setVisible(false);
            this.infoPanel.setVisible(false);
            if (!this.canAfford(type)) {
              this.addLog(`${languageManager.ui.logBuild} ${def.name} — ${languageManager.ui.logNeed}...`);
              return;
            }
            this.buildMode = type;
            this.buildModeJustSet = true;
            this.updateBuildButtonStates();
            this.addLog(`${languageManager.ui.logBuild}: ${def.name} — ${languageManager.ui.logClickTile}`);
          });
      }
      container.add(bg);

      const icon = this.scene.add.image(ICON_SIZE / 2, ICON_SIZE / 2, `icon_${type}`)
        .setDisplaySize(ICON_SIZE - 8, ICON_SIZE - 8);
      if (!isUnlocked) icon.setAlpha(0.25);
      container.add(icon);

      // Lock icon for locked buildings
      if (!isUnlocked) {
        const lockText = this.scene.add.text(ICON_SIZE / 2, ICON_SIZE / 2, '🔒', {
          fontSize: '18px',
        }).setOrigin(0.5);
        container.add(lockText);
      }

      const costFontSize = isMobile ? '12px' : '10px';
      const costText = this.scene.add.text(ICON_SIZE / 2, ICON_SIZE + 6, reqStr, {
        fontSize: costFontSize, color: isUnlocked ? '#8b949e' : '#555555', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      container.add(costText);

      if (isUnlocked && !affordable) {
        icon.setAlpha(0.35);
        bg.setFillStyle(0x161b22, 0.9);
      } else if (isUnlocked) {
        bg.setFillStyle(0x21262d, 0.9);
      } else {
        bg.setFillStyle(0x111111, 0.9);
      }

      container.setSize(ICON_SIZE + 8, ICON_SIZE + 20);

      this.buildTypeMap.set(container, type);
      this.buildButtons.push(container);
    }
  }

  private buildTooltip: import('./menu/Tooltip').Tooltip | null = null;

  private showBuildTooltip(type: string, x: number, y: number): void {
    if (!this.buildTooltip) {
      this.buildTooltip = new Tooltip(this.scene, 50);
    }
    const def = (buildingsData as any)[type];
    const lines: import('./menu/Tooltip').TooltipLine[] = [
      { text: def.name, color: '#58a6ff', bold: true },
      { text: def.description, color: '#c9d1d9' },
      { text: '', color: '#c9d1d9' },
      { text: `Стоимость:`, color: '#8b949e', bold: true },
    ];
    for (const [res, amt] of Object.entries(def.requires)) {
      const has = this.simulation?.hasResource(res, amt as number);
      lines.push({ text: `  ${res}: ${amt}`, color: has ? '#44ff44' : '#ff4444' });
    }
    if (def.size && def.size > 1) {
      lines.push({ text: '', color: '#c9d1d9' });
      lines.push({ text: `Размер: ${def.size}x${def.size}`, color: '#8b949e' });
    }
    this.buildTooltip.show(lines, x, y);
  }

  private hideBuildTooltip(): void {
    this.buildTooltip?.hide();
  }

  private createDayNightWidget(): void {
    const L = getLayout();
    this.dnBand = { x: 14, y: 44, w: L.leftPanelW - 28, h: 44 };
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
    if (!this.dnDim) return;
    this.dnDim.setAlpha(dimmed ? 0.8 : 0);
  }

  setBuildButtonsEnabled(enabled: boolean): void {
    this.buildButtonsEnabled = enabled;
    // Only toggle interactivity for desktop Container buttons;
    // mobile Rectangle buttons handle enabled state via buildButtonsEnabled flag in their handlers
    for (const btn of this.buildButtons) {
      if (btn instanceof Phaser.GameObjects.Container) {
        if (enabled) btn.setInteractive({ useHandCursor: true });
        else btn.disableInteractive();
      }
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
    // q1_2: walls, gates, farms, warehouses
    if (questId === 'q1_2') return ['wall', 'gate', 'farm', 'warehouse'];
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

    // Mobile build buttons — update alpha based on affordability
    const L = getLayout();
    if (L.mode === 'mobile') {
      for (const btn of this.mobileBuildBtns) {
        if (!this.buildButtonsEnabled) {
          btn.bg.setAlpha(0.3);
          btn.icon.setAlpha(0.15);
          continue;
        }
        const def = (buildingsData as any)[btn.type];
        const affordable = this.canAfford(btn.type);
        if (affordable) {
          btn.icon.setAlpha(1);
          btn.bg.setAlpha(1);
        } else {
          btn.icon.setAlpha(0.35);
          btn.bg.setAlpha(1);
        }
      }
    }

    // Update mobile build status indicator
    this.updateMobileBuildStatus();
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

      if (bld.crafting) {
        const pct = Math.round((bld.craftingProgress / bld.craftingTime) * 100);
        lines.push(`Crafting: ${bld.craftingRecipe} (${pct}%)`);
      }

      if (bld.craftedItems.length > 0) {
        const items = bld.craftedItems.filter(i => i.quantity > 0)
          .map(i => `${i.resourceType} x${i.quantity}`).join(', ');
        if (items) lines.push(`Crafted: ${items}`);
      }

      this.infoText.setText(lines.join('\n'));
      this.collectBtn.setVisible(false);
      this.demolishBtn.setVisible(true);
      this.continueBtn.setVisible(!bld.built);
      this.repairBtn.setVisible(bld.built && bld.hp < bld.maxHp);
      this.journalBtn.setVisible(bld.built && bld.buildingType === 'lab');
      this.craftBtn.setVisible(bld.built && bld.buildingType === 'workshop');
      this.useCraftedBtn.setVisible(bld.built && bld.buildingType === 'workshop' && bld.craftedItems.some(i => i.quantity > 0));
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
      this.craftBtn.setVisible(false);
      this.useCraftedBtn.setVisible(false);
    }
  }

  updateSelection(): void {
    const L = getLayout();
    if (this.selectedBuilding) {
      const bldSize = this.selectedBuilding.size ?? 1;
      const { sx, sy } = this.tileToScreen(this.selectedBuilding.x, this.selectedBuilding.y);
      const footprintPx = L.tileSize * bldSize;
      this.selectionRect.setPosition(sx + footprintPx / 2 - L.tileSize / 2, sy + footprintPx / 2 - L.tileSize / 2);
      this.selectionRect.setSize(footprintPx + 4, footprintPx + 4);
      this.selectionRect.setVisible(true);
    } else if (this.selectedEntity) {
      const { sx, sy } = this.tileToScreen(this.selectedEntity.x, this.selectedEntity.y);
      this.selectionRect.setPosition(sx, sy);
      this.selectionRect.setSize(L.tileSize + 4, L.tileSize + 4);
      this.selectionRect.setVisible(true);
    } else {
      this.selectionRect.setVisible(false);
    }
  }

  updateLeftPanel(gameOver: boolean, tickCount: number): void {
    if (gameOver) return;
    const L = getLayout();
    if (L.mode === 'mobile') return;  // mobile uses separate UI
    this.updateDayNight(tickCount);
    const s = (this.scene as any).getSelectedSettler() as Settler;
    if (!s) return;

    const taskStr = s.currentTaskId ? languageManager.ui.working : languageManager.ui.idle;
    const modeLabels: Record<string, string> = { auto: 'Авто', gather: 'Сбор', build: 'Стройка', idle: 'Стоп' };
    const modeLabel = modeLabels[s.workMode] ?? 'Авто';

    // Show auto-task icon
    let autoIcon = '';
    if (s.currentTaskId) {
      const taskQueue = (this.scene as any).simulation?.taskQueue;
      if (taskQueue) {
        const task = taskQueue.getAll().find((t: any) => t.id === s.currentTaskId);
        if (task?.autoIcon) {
          const icons: Record<string, string> = {
            chop: '\uD83E\uDEB5', gather: '\uD83D\uDCE6', build: '\uD83D\uDD28',
            repair: '\uD83D\uDD27', research: '\uD83D\uDD2C', scout: '\uD83D\uDDFA\uFE0F', food: '\uD83C\uDF56',
          };
          autoIcon = ' ' + (icons[task.autoIcon] ?? '');
        }
      }
    }
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
      `Режим: ${modeLabel}\n` +
      `${languageManager.ui.status}: ${taskStr}${autoIcon}\n` +
      `${languageManager.ui.taskId}: ${s.currentTaskId ?? languageManager.ui.none}\n` +
      `${languageManager.ui.pathLen}: ${s.path.length}`
    );

    this.updateWorkModeButtons(s);

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

  private updateWorkModeButtons(s: Settler): void {
    const activeColors = ['#44ff44', '#ffaa00', '#4488ff', '#888888'];
    for (let i = 0; i < 4; i++) {
      const btn = this.workModeBtns[i];
      if (!btn) continue;
      const isActive = s.workMode === this.workModeModes[i];
      if (isActive) {
        const color = Phaser.Display.Color.HexStringToColor(activeColors[i]).color;
        btn.bg.setStrokeStyle(3, color);
      } else {
        btn.bg.setStrokeStyle(0);
      }
    }
  }

  updateThoughts(ticked: boolean): void {
    if (!ticked) return;
    if (!this.thoughtText) return;
    this.thoughtTimer++;
    if (this.thoughtTimer >= 10) {
      this.thoughtTimer = 0;
      const thoughts = languageManager.narrative.settlerThoughts;
      this.thoughtText.setText(thoughts[this.thoughtIndex % thoughts.length]);
      this.thoughtIndex++;
    }
  }

  updateMinimap(): void {
    if (!this.minimapGraphics) return;
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
    const L3 = getLayout();
    const vw = L3.viewportTilesX * ts;
    const vh = L3.viewportTilesY * ts;
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
    if (!this.inventoryIconContainer) return;
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
      fiber: 0x9ACD32,
      resin: 0xDAA520,
      herb: 0x3CB371,
    };

    const resourceIcons: Record<string, string> = {
      wood: '\uD83E\uDEB5',
      stone: '\uD83E\uDEA8',
      food: '\uD83C\uDF56',
      fiber: '\uD83E\uDDF5',
      resin: '\uD83D\uDCA7',
      herb: '\uD83C\uDF3F',
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
    if (!this.globalInventoryContainer) return;
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
      fiber: 0x9ACD32,
      resin: 0xDAA520,
      herb: 0x3CB371,
    };

    const resourceIcons: Record<string, string> = {
      wood: '\uD83E\uDEB5',
      stone: '\uD83E\uDEA8',
      food: '\uD83C\uDF56',
      fiber: '\uD83E\uDDF5',
      resin: '\uD83D\uDCA7',
      herb: '\uD83C\uDF3F',
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

  mobileLogCallback: ((msg: string) => void) | null = null;

  addLog(msg: string): void {
    this.taskLog.push(msg);
    if (this.taskLog.length > 8) this.taskLog.shift();
    if (this.taskLogText) {
      this.taskLogText.setText(this.taskLog.join('\n'));
    }
    // On mobile, route to toast
    if (this.mobileLogCallback && getLayout().mode === 'mobile') {
      this.mobileLogCallback(msg);
    }
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

  // ── Mobile UI ──

  private mobileTopBarBg!: Phaser.GameObjects.Rectangle;
  private mobileResourceContainer!: Phaser.GameObjects.Container;
  private mobileDayText!: Phaser.GameObjects.Text;
  private mobileSettlerBarBg!: Phaser.GameObjects.Rectangle;
  private mobileSettlerText!: Phaser.GameObjects.Text;
  private mobileHpBar!: Phaser.GameObjects.Rectangle;
  private mobileFoodBar!: Phaser.GameObjects.Rectangle;
  private mobileEnergyBar!: Phaser.GameObjects.Rectangle;
  private mobileInventoryContainer!: Phaser.GameObjects.Container;

  // Mobile settler selector
  private mobileSettlerIcons: Phaser.GameObjects.Container[] = [];
  private mobileSettlerBgs: Phaser.GameObjects.Rectangle[] = [];
  private mobileSettlerCallback?: (index: number) => void;

  // Mobile quest display
  private mobileQuestText!: Phaser.GameObjects.Text;

  // Mobile work mode buttons
  private mobileWorkModeBtns: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];

  /**
   * Creates the full mobile UI:
   *  - Top bar (36px): compact resource counts + day + menu button
   *  - Settler status overlay (28px): HP/food/energy bars when settler selected
   *  - Build strip (52px): horizontal scrollable build buttons + action buttons
   */
  createMobileUI(
    onSave: () => void,
    onLoad: () => void,
    onClear: () => void,
    onBuildIconCreated: () => void,
    debugPanel?: import('./DebugPanel').DebugPanel,
    onExit?: () => void,
    onSelectSettler?: (index: number) => void
  ): void {
    const L = getLayout();
    const btnDepth = 35;
    this.mobileSettlerCallback = onSelectSettler;

    // ── Top bar: resources + day + menu ──
    this.mobileTopBarBg = this.scene.add.rectangle(L.fieldX, 0, L.fieldW, L.eventH, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);

    this.mobileResourceContainer = this.scene.add.container(L.fieldX + 4, 4);
    this.mobileResourceContainer.setDepth(21);
    this.updateMobileResources();

    // ── Settler portraits in top bar (after resources) ──
    this.createMobileSettlerIcons();

    this.mobileDayText = this.scene.add.text(L.fieldX + L.fieldW - 4, L.eventH / 2, '', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(21);

    this.eventText = this.scene.add.text(L.fieldX + 4, L.eventH + 2, '', {
      fontSize: '0px', // hidden on mobile — events go via toast
    }).setDepth(21);

    // ── Settler status bar (bottom of game field, overlay) ──
    const statusY = L.fieldY + L.fieldH - 28;
    this.mobileSettlerBarBg = this.scene.add.rectangle(L.fieldX, statusY, L.fieldW, 28, 0x0a0a2e, 0.85)
      .setOrigin(0).setDepth(25).setVisible(false);

    this.mobileSettlerText = this.scene.add.text(L.fieldX + 4, statusY + 4, '', {
      fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
    }).setDepth(26).setVisible(false);

    // HP / Food / Energy bars
    const barY = statusY + 18;
    const barH = 6;
    const barW = 60;
    this.mobileHpBar = this.scene.add.rectangle(L.fieldX + 4, barY, barW, barH, 0x44ff44, 1)
      .setOrigin(0).setDepth(26).setVisible(false);
    this.mobileFoodBar = this.scene.add.rectangle(L.fieldX + 70, barY, barW, barH, 0xffaa00, 1)
      .setOrigin(0).setDepth(26).setVisible(false);
    this.mobileEnergyBar = this.scene.add.rectangle(L.fieldX + 136, barY, barW, barH, 0x44aaff, 1)
      .setOrigin(0).setDepth(26).setVisible(false);

    // Inventory icons (to the right of bars)
    this.mobileInventoryContainer = this.scene.add.container(L.fieldX + 204, statusY + 2);
    this.mobileInventoryContainer.setDepth(26).setVisible(false);

    // ── Bottom build strip ──
    this.bottomHudBg = this.scene.add.rectangle(L.fieldX, L.bottomHudY, L.fieldW, L.bottomHudH, COLORS.uiPanel, 0.95)
      .setOrigin(0).setDepth(20);
    this.bottomHudAccent = this.scene.add.rectangle(L.fieldX, L.bottomHudY, L.fieldW, 2, COLORS.settler, 0.5)
      .setOrigin(0).setDepth(21);

    // Encyclopedia button in portrait row (right side)
    const encycBtn = this.scene.add.text(
      L.fieldX + L.fieldW - 8, L.eventH + L.portraitRowH / 2,
      '[📖]', {
      fontSize: '22px', color: '#44ddaa', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        (this.scene as any).encyclopediaModal?.show();
      });
    this.hudButtons.push(encycBtn);

    // Quest text (top of bottom area)
    const actY = L.bottomHudY + 4;
    this.mobileQuestText = this.scene.add.text(L.fieldX + 4, actY, '', {
      fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: L.fieldW - 8 },
    }).setDepth(btnDepth);

    // ── Work mode buttons row ──
    const wmY = L.bottomHudY + 26;
    const modeLabels = ['Auto', 'Gather', 'Build', 'Stop'];
    const modeColors = ['#44ff44', '#ffaa00', '#4488ff', '#888888'];
    const modeKeys: WorkMode[] = ['auto', 'gather', 'build', 'idle'];
    let wmX = L.fieldX + 4;
    this.mobileWorkModeBtns = [];
    for (let i = 0; i < 4; i++) {
      const color = Phaser.Display.Color.HexStringToColor(modeColors[i]).color;
      const tmpTxt = this.scene.add.text(0, 0, `[${modeLabels[i]}]`, {
        fontSize: '14px', fontFamily: 'monospace',
        padding: { x: 8, y: 5 },
      });
      const bw = tmpTxt.width + 2;
      const bh = tmpTxt.height + 2;
      tmpTxt.destroy();
      const bg = this.scene.add.rectangle(wmX, wmY, bw, bh, 0x16213e, 1)
        .setOrigin(0).setDepth(btnDepth);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        const s = (this.scene as any).getSelectedSettler() as Settler;
        if (s && s.isAlive) {
          s.workMode = modeKeys[i];
          this.updateMobileWorkModeButtons(s);
        }
      });
      const txt = this.scene.add.text(wmX + 1, wmY + 1, `[${modeLabels[i]}]`, {
        fontSize: '14px', color: modeColors[i], fontFamily: 'monospace',
        padding: { x: 8, y: 5 },
      }).setDepth(btnDepth + 1);
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => {
        const s = (this.scene as any).getSelectedSettler() as Settler;
        if (s && s.isAlive) {
          s.workMode = modeKeys[i];
          this.updateMobileWorkModeButtons(s);
        }
      });
      this.mobileWorkModeBtns.push({ bg, text: txt });
      wmX += bw + 6;
    }

    // Build strip area
    onBuildIconCreated();
    this.createMobileBuildStrip();
  }

  private mobileMenuVisible = false;
  private mobileMenuContainer: Phaser.GameObjects.Container | null = null;

  private toggleMobileMenu(
    x: number, y: number,
    onSave: () => void, onLoad: () => void, onClear: () => void,
    onExit?: () => void, debugPanel?: import('./DebugPanel').DebugPanel
  ): void {
    if (this.mobileMenuContainer) {
      this.mobileMenuContainer.destroy();
      this.mobileMenuContainer = null;
      this.mobileMenuVisible = false;
      return;
    }

    const L = getLayout();
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '14px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 6 },
    };

    this.mobileMenuContainer = this.scene.add.container(x, y).setDepth(50);
    const bg = this.scene.add.rectangle(0, 0, 180, 180, 0x16213e, 0.98)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.mobileMenuContainer.add(bg);

    const items = [
      { label: `[${languageManager.ui.save}]`, action: onSave },
      { label: `[${languageManager.ui.load}]`, action: onLoad },
      { label: `[${languageManager.ui.clear}]`, action: onClear },
      { label: '[Encyclopedia]', action: () => (this.scene as any).encyclopediaModal?.show() },
      { label: `[Exit]`, action: () => onExit?.() },
    ];

    let iy = 6;
    for (const item of items) {
      const btn = this.scene.add.text(8, iy, item.label, style)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          item.action();
          this.toggleMobileMenu(x, y, onSave, onLoad, onClear, onExit, debugPanel);
        });
      this.mobileMenuContainer.add(btn);
      iy += 30;
    }

    // Speed buttons
    if (debugPanel) {
      const speeds = [1, 2, 4];
      let sx = 8;
      for (const spd of speeds) {
        const btn = this.scene.add.text(sx, iy, `×${spd}`, {
          ...style, color: spd === 1 ? '#58a6ff' : '#8b949e',
        }).setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            debugPanel.speed = spd;
          });
        this.mobileMenuContainer.add(btn);
        sx += btn.width + 6;
      }
    }

    this.mobileMenuVisible = true;
  }

  private mobileBuildBtns: { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; cost: Phaser.GameObjects.Text; type: BuildingType }[] = [];

  // Mobile build modal
  private mobileBuildModal: Phaser.GameObjects.Container | null = null;
  private mobileBuildStatusText: Phaser.GameObjects.Text | null = null;

  private createMobileBuildStrip(): void {
    const L = getLayout();
    const btnY = L.bottomHudY + 62;
    const btnX = L.fieldX + 4;

    // Single "Build" button that opens the modal
    const buildBtn = this.scene.add.text(btnX, btnY, '[🔨 Build]', {
      fontSize: '18px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 12, y: 8 },
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        if (!this.buildButtonsEnabled) return;
        this.showMobileBuildModal();
      });
    this.buildButtons.push(buildBtn);

    // Cancel button (next to build)
    const cancelBtn = this.scene.add.text(btnX + buildBtn.width + 8, btnY + 2, '[X]', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 6, y: 4 },
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        if (!this.buildButtonsEnabled) return;
        this.buildMode = null;
        this.updateBuildButtonStates();
        this.updateMobileBuildStatus();
      });
    this.buildButtons.push(cancelBtn);

    // Build status text (shows what's being built)
    this.mobileBuildStatusText = this.scene.add.text(btnX + cancelBtn.width + cancelBtn.width + 24, btnY + 4, '', {
      fontSize: '13px', color: '#ffae00', fontFamily: 'monospace',
    }).setDepth(22);
  }

  private showMobileBuildModal(): void {
    this.hideMobileBuildModal();

    const L = getLayout();
    const container = this.scene.add.container(0, 0).setDepth(200);

    // Fullscreen backdrop
    const backdrop = this.scene.add.rectangle(
      L.canvasW / 2, L.canvasH / 2, L.canvasW, L.canvasH, 0x000000, 0.7
    ).setInteractive().on('pointerdown', () => this.hideMobileBuildModal());
    container.add(backdrop);

    // Panel
    const panelW = L.canvasW - 24;
    const panelH = L.canvasH - 80;
    const px = L.canvasW / 2;
    const py = L.canvasH / 2;
    const panel = this.scene.add.rectangle(px, py, panelW, panelH, 0x0d1117, 0.98)
      .setOrigin(0.5).setStrokeStyle(2, COLORS.panelHeader);
    container.add(panel);

    // Title
    const title = this.scene.add.text(px, py - panelH / 2 + 16, '── Choose Building ──', {
      fontSize: '16px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    container.add(title);

    // Close button
    const closeBtn = this.scene.add.text(px + panelW / 2 - 24, py - panelH / 2 + 8, '[X]', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideMobileBuildModal());
    container.add(closeBtn);

    // Building grid
    const types = Object.keys(buildingsData) as BuildingType[];
    const ICON_SIZE = 64;
    const GAP = 12;
    const cols = Math.floor((panelW - 24) / (ICON_SIZE + GAP));
    const startX = px - panelW / 2 + 16;
    const startY = py - panelH / 2 + 48;

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const def = (buildingsData as any)[type];
      const affordable = this.canAfford(type);

      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (ICON_SIZE + GAP);
      const y = startY + row * (ICON_SIZE + 36);

      // Check bounds
      if (y + ICON_SIZE + 36 > py + panelH / 2 - 10) continue;

      const bg = this.scene.add.rectangle(x + ICON_SIZE / 2, y + ICON_SIZE / 2, ICON_SIZE, ICON_SIZE,
        affordable ? 0x21262d : 0x161b22, 0.9)
        .setStrokeStyle(1, affordable ? COLORS.panelBorder : 0x333333)
        .setInteractive({ useHandCursor: affordable });

      if (affordable) {
        bg.on('pointerdown', () => {
          this.hideMobileBuildModal();
          this.buildMode = type;
          this.buildModeJustSet = true;
          this.updateBuildButtonStates();
          this.updateMobileBuildStatus();
        });
      }

      const icon = this.scene.add.image(x + ICON_SIZE / 2, y + ICON_SIZE / 2, `icon_${type}`)
        .setDisplaySize(ICON_SIZE - 12, ICON_SIZE - 12);
      if (!affordable) icon.setAlpha(0.3);

      const reqStr = Object.entries(def.requires).map(([k, v]) => `${k}:${v}`).join(' ');
      const costText = this.scene.add.text(x + ICON_SIZE / 2, y + ICON_SIZE + 2, reqStr, {
        fontSize: '10px', color: affordable ? '#8b949e' : '#555555', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);

      const nameText = this.scene.add.text(x + ICON_SIZE / 2, y + ICON_SIZE + 14, def.name, {
        fontSize: '11px', color: affordable ? '#c9d1d9' : '#444444', fontFamily: 'monospace',
      }).setOrigin(0.5, 0);

      container.add([bg, icon, costText, nameText]);
    }

    this.mobileBuildModal = container;
  }

  private hideMobileBuildModal(): void {
    if (this.mobileBuildModal) {
      this.mobileBuildModal.destroy();
      this.mobileBuildModal = null;
    }
  }

  private updateMobileBuildStatus(): void {
    if (!this.mobileBuildStatusText) return;
    if (this.buildMode) {
      const def = (buildingsData as any)[this.buildMode];
      this.mobileBuildStatusText.setText(`→ ${def?.name ?? this.buildMode} — tap tile`);
      this.mobileBuildStatusText.setVisible(true);
    } else {
      this.mobileBuildStatusText.setVisible(false);
    }
  }

  private mobileBuildingInfoContainer: Phaser.GameObjects.Container | null = null;

  private showMobileBuildingInfo(type: string): void {
    this.hideMobileBuildingInfo();

    const L = getLayout();
    const def = (buildingsData as any)[type];
    if (!def) return;

    const container = this.scene.add.container(0, 0).setDepth(200);

    // Fullscreen backdrop
    const backdrop = this.scene.add.rectangle(
      L.canvasW / 2, L.canvasH / 2, L.canvasW, L.canvasH, 0x000000, 0.7
    ).setInteractive().on('pointerdown', () => this.hideMobileBuildingInfo());
    container.add(backdrop);

    // Info panel
    const panelW = Math.min(320, L.canvasW - 32);
    const panelH = 300;
    const cx = L.canvasW / 2;
    const cy = L.canvasH / 2;

    const panelBg = this.scene.add.rectangle(cx, cy, panelW, panelH, 0x0d1117, 0.98)
      .setOrigin(0.5).setStrokeStyle(2, COLORS.panelHeader);
    container.add(panelBg);

    // Building icon (large)
    const iconSize = 80;
    const icon = this.scene.add.image(cx, cy - panelH / 2 + 50, `icon_${type}`)
      .setDisplaySize(iconSize, iconSize);
    container.add(icon);

    // Name
    const name = this.scene.add.text(cx, cy - panelH / 2 + 100, def.name, {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(name);

    // Description
    const desc = this.scene.add.text(cx, cy - panelH / 2 + 124, def.description || '', {
      fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: panelW - 32 }, align: 'center',
    }).setOrigin(0.5, 0);
    container.add(desc);

    // Cost
    const costY = cy - panelH / 2 + 180;
    const costTitle = this.scene.add.text(cx, costY, 'Cost:', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(costTitle);

    const costStr = Object.entries(def.requires).map(([r, q]) => `${r}: ${q}`).join('  ');
    const costText = this.scene.add.text(cx, costY + 18, costStr, {
      fontSize: '13px', color: '#ffd700', fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(costText);

    // Size
    if (def.size && def.size > 1) {
      const sizeText = this.scene.add.text(cx, costY + 40, `Size: ${def.size}x${def.size}`, {
        fontSize: '12px', color: '#8b949e', fontFamily: 'monospace',
      }).setOrigin(0.5);
      container.add(sizeText);
    }

    // Close button
    const closeBtn = this.scene.add.text(cx + panelW / 2 - 24, cy - panelH / 2 + 8, '[X]', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideMobileBuildingInfo());
    container.add(closeBtn);

    this.mobileBuildingInfoContainer = container;
  }

  private hideMobileBuildingInfo(): void {
    if (this.mobileBuildingInfoContainer) {
      this.mobileBuildingInfoContainer.destroy();
      this.mobileBuildingInfoContainer = null;
    }
  }

  updateMobileResources(): void {
    const L = getLayout();
    if (L.mode !== 'mobile') return;

    this.mobileResourceContainer.removeAll(true);

    const sim = this.simulation as any;
    const inventory: { resourceType: string; quantity: number }[] = sim.inventory || [];
    const resMap = new Map(inventory.map(i => [i.resourceType, i.quantity]));

    const resources = ['wood', 'stone', 'food', 'fiber', 'resin', 'herb'] as const;
    const icons: Record<string, string> = {
      wood: '\uD83E\uDEB5', stone: '\uD83E\uDEA8', food: '\uD83C\uDF56',
      fiber: '\uD83E\uDDF5', resin: '\uD83D\uDCA7', herb: '\uD83C\uDF3F',
    };

    let x = 0;
    for (const res of resources) {
      const count = resMap.get(res) || 0;
      const icon = this.scene.add.text(x, 1, icons[res], { fontSize: '14px' }).setOrigin(0, 0);
      const num = this.scene.add.text(x + 16, 4, String(count), {
        fontSize: '11px', color: '#c9d1d9', fontFamily: 'monospace',
      });
      this.mobileResourceContainer.add([icon, num]);
      x += 36;
    }
  }

  updateMobileDay(tickCount: number): void {
    const L = getLayout();
    if (L.mode !== 'mobile') return;
    const day = Math.floor(tickCount / (DAY_TICKS + NIGHT_TICKS)) + 1;
    const isNight = (tickCount % (DAY_TICKS + NIGHT_TICKS)) >= DAY_TICKS;
    this.mobileDayText?.setText(`Day ${day} ${isNight ? '🌙' : '☀'}`);
  }

  updateMobileSettlerStatus(settler: Settler | null): void {
    const L = getLayout();
    if (L.mode !== 'mobile') return;

    if (!settler || !settler.isAlive) {
      this.mobileSettlerBarBg.setVisible(false);
      this.mobileSettlerText.setVisible(false);
      this.mobileHpBar.setVisible(false);
      this.mobileFoodBar.setVisible(false);
      this.mobileEnergyBar.setVisible(false);
      this.mobileInventoryContainer.setVisible(false);
      return;
    }

    this.mobileSettlerBarBg.setVisible(true);
    this.mobileSettlerText.setVisible(true);
    this.mobileHpBar.setVisible(true);
    this.mobileFoodBar.setVisible(true);
    this.mobileEnergyBar.setVisible(true);
    this.mobileInventoryContainer.setVisible(true);

    const taskStr = settler.currentTaskId ? 'working' : 'idle';
    this.mobileSettlerText.setText(`${settler.name} [${settler.settlerClass}] ${taskStr}`);

    const hpPct = Math.max(0, Math.min(1, settler.hp / settler.maxHp));
    const foodPct = Math.max(0, Math.min(1, settler.hunger / 100));
    const energyPct = Math.max(0, Math.min(1, settler.energy / 100));

    this.mobileHpBar.setScale(hpPct, 1);
    this.mobileFoodBar.setScale(foodPct, 1);
    this.mobileEnergyBar.setScale(energyPct, 1);

    this.updateMobileInventory(settler);
  }

  private lastMobileInvHash = '';

  private updateMobileInventory(settler: Settler): void {
    const hash = settler.inventory.map(i => `${i.resourceType}:${i.quantity}`).join(',');
    if (hash === this.lastMobileInvHash) return;
    this.lastMobileInvHash = hash;

    this.mobileInventoryContainer.removeAll(true);

    const resColors: Record<string, number> = {
      wood: 0x8B6914, stone: 0x888888, food: 0xcc6644,
      fiber: 0x88aa44, resin: 0xcc8844, herb: 0x44cc88,
      artifact: 0xaa44ff,
    };

    let x = 0;
    for (const item of settler.inventory) {
      if (item.quantity <= 0) continue;
      const color = resColors[item.resourceType] ?? 0x888888;
      const bg = this.scene.add.rectangle(x, 0, 16, 16, color, 0.8).setOrigin(0);
      const num = this.scene.add.text(x + 8, 8, String(item.quantity), {
        fontSize: '9px', color: '#fff', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.mobileInventoryContainer.add([bg, num]);
      x += 20;
    }
  }

  updateMobileQuests(): void {
    const L = getLayout();
    if (L.mode !== 'mobile') return;
    if (!this.mobileQuestText) return;

    const questManager = (this.scene as any).questManager;
    if (!questManager) {
      this.mobileQuestText.setText('');
      return;
    }

    const activeQuests = questManager.getActiveQuests();
    if (activeQuests.length > 0) {
      const { quest, state } = activeQuests[0];
      const progress = questManager.getProgressText(quest.id);
      this.mobileQuestText.setText(`${quest.title}${progress ? ' · ' + progress : ''}`);
      this.mobileQuestText.setColor('#58a6ff');
    } else {
      const available = questManager.getAvailableQuests();
      if (available.length > 0) {
        this.mobileQuestText.setText(`${available[0].quest.title} (available)`);
        this.mobileQuestText.setColor('#8b949e');
      } else {
        this.mobileQuestText.setText('');
      }
    }
  }

  updateMobileWorkModeButtons(settler: Settler | null): void {
    const L = getLayout();
    if (L.mode !== 'mobile') return;
    if (!this.mobileWorkModeBtns || this.mobileWorkModeBtns.length === 0) return;

    const activeColors = ['#44ff44', '#ffaa00', '#4488ff', '#888888'];
    const modes: WorkMode[] = ['auto', 'gather', 'build', 'idle'];

    for (let i = 0; i < 4; i++) {
      const btn = this.mobileWorkModeBtns[i];
      if (!btn) continue;
      const isActive = settler?.workMode === modes[i];
      if (isActive) {
        const color = Phaser.Display.Color.HexStringToColor(activeColors[i]).color;
        btn.bg.setStrokeStyle(3, color);
      } else {
        btn.bg.setStrokeStyle(0);
      }
    }
  }

  private createMobileSettlerIcons(): void {
    const L = getLayout();
    const iconSize = 54;
    const gap = 16;
    const totalW = 3 * iconSize + 2 * gap;
    const startX = L.fieldX + (L.fieldW - totalW) / 2;
    const startY = L.eventH + (L.portraitRowH - iconSize - 8) / 2;
    const heroKeys = ['hero_engineer', 'hero_biologist', 'hero_pilot'];

    // Background for portrait row
    const rowBg = this.scene.add.rectangle(L.fieldX, L.eventH, L.fieldW, L.portraitRowH, 0x0a0a2e, 0.9)
      .setOrigin(0).setDepth(20).setStrokeStyle(1, COLORS.panelBorder);

    for (let i = 0; i < 3; i++) {
      const container = this.scene.add.container(startX + i * (iconSize + gap), startY).setDepth(22);

      const bg = this.scene.add.rectangle(0, 0, iconSize, iconSize, 0x21262d, 0.9)
        .setOrigin(0).setStrokeStyle(2, COLORS.panelBorder)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.mobileSettlerCallback?.(i);
        });
      container.add(bg);

      const avatar = this.scene.add.image(iconSize / 2, iconSize / 2, heroKeys[i] || heroKeys[0])
        .setDisplaySize(iconSize - 8, iconSize - 8);
      container.add(avatar);

      // HP bar below portrait
      const hpBarBg = this.scene.add.rectangle(0, iconSize + 2, iconSize, 6, 0x333333, 0.8).setOrigin(0);
      const hpBar = this.scene.add.rectangle(0, iconSize + 2, iconSize, 6, 0x44cc44, 1).setOrigin(0);
      container.add(hpBarBg);
      container.add(hpBar);

      this.mobileSettlerIcons.push(container);
      this.mobileSettlerBgs.push(bg);
    }
  }

  updateMobileSettlerIcons(selectedIndex: number): void {
    const L = getLayout();
    if (L.mode !== 'mobile') return;

    const allSettlers = this.simulation?.entityManager?.getByType('settler') as Settler[] ?? [];

    for (let i = 0; i < this.mobileSettlerIcons.length; i++) {
      const container = this.mobileSettlerIcons[i];
      const bg = this.mobileSettlerBgs[i];

      if (i >= allSettlers.length || (allSettlers[i] && !allSettlers[i].isAlive)) {
        container.setVisible(false);
        continue;
      }
      container.setVisible(true);

      const settler = allSettlers[i];

      // Update avatar tint if low HP
      const avatar = container.list[1] as Phaser.GameObjects.Image;
      if (settler.hp < settler.maxHp * 0.5) {
        avatar.setTint(0xff6666);
      } else {
        avatar.clearTint();
      }

      // Update HP bar
      const hpPct = Math.max(0, Math.min(1, settler.hp / settler.maxHp));
      const hpBar = container.list[3] as Phaser.GameObjects.Rectangle;
      const hpColor = hpPct > 0.5 ? 0x44cc44 : hpPct > 0.25 ? 0xcccc44 : 0xcc4444;
      hpBar.setFillStyle(hpColor, 1);
      hpBar.setScale(hpPct, 1);

      // Highlight selected
      if (i === selectedIndex) {
        bg.setStrokeStyle(2, 0xffd700);
        bg.setFillStyle(0x3a3a4a, 0.9);
      } else {
        bg.setStrokeStyle(1, COLORS.panelBorder);
        bg.setFillStyle(0x21262d, 0.9);
      }
    }
  }

  // ── Multiplayer Chat UI ──
  private chatContainer: Phaser.GameObjects.Container | null = null;
  private chatMessages: Phaser.GameObjects.Text | null = null;
  private chatInput: HTMLInputElement | null = null;
  private chatHistory: { name: string; color: string; text: string }[] = [];
  private chatMaxMessages = 50;

  createChatUI(): void {
    const L = getLayout();
    const isMobile = L.mode === 'mobile';

    // Chat container (bottom-left of game field)
    const chatX = L.fieldX + 4;
    const chatY = L.fieldY + L.fieldH - 120;
    const chatW = isMobile ? 200 : 280;
    const chatH = 100;

    this.chatContainer = this.scene.add.container(chatX, chatY).setDepth(30);

    // Background
    const bg = this.scene.add.rectangle(0, 0, chatW, chatH, 0x0a0a2e, 0.85)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.panelBorder);
    this.chatContainer.add(bg);

    // Messages display
    this.chatMessages = this.scene.add.text(4, 4, '', {
      fontSize: '11px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: chatW - 8 },
      lineSpacing: 2,
    }).setOrigin(0);
    this.chatContainer.add(this.chatMessages);

    // Input field (HTML element)
    const input = this.scene.add.dom(chatX + chatW / 2, chatY + chatH + 14).createElement('input')
      .setOrigin(0.5)
      .node as HTMLInputElement;
    input.placeholder = 'Чат...';
    input.maxLength = 200;
    input.style.cssText = `
      width: ${chatW - 8}px; padding: 4px 6px; font: 11px monospace;
      background: #0d1117; color: #c9d1d9; border: 1px solid #30363d;
      border-radius: 3px; outline: none;
    `;
    this.chatInput = input;

    // Enter key sends message
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        this.sendChatMessage(input.value.trim());
        input.value = '';
      }
      e.stopPropagation();
    });
    input.addEventListener('focus', (ev) => ev.stopPropagation());
    input.addEventListener('blur', (ev) => ev.stopPropagation());
  }

  sendChatMessage(text: string): void {
    if (!text.trim()) return;
    // This will be called from GameScene which has access to networkManager
    (this.scene as any).sendChatMessage?.(text);
  }

  addChatMessage(name: string, color: string, text: string): void {
    this.chatHistory.push({ name, color, text });
    if (this.chatHistory.length > this.chatMaxMessages) {
      this.chatHistory.shift();
    }
    this.updateChatDisplay();
  }

  private updateChatDisplay(): void {
    if (!this.chatMessages) return;
    const lines = this.chatHistory.slice(-10).map(m =>
      `<span style="color:${m.color}">${m.name}:</span> ${m.text}`
    );
    // Use Phaser text (no rich text), so just show name: text
    const plainLines = this.chatHistory.slice(-10).map(m =>
      `${m.name}: ${m.text}`
    );
    this.chatMessages.setText(plainLines.join('\n'));
  }
}
