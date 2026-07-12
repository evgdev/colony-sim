import Phaser from 'phaser';
import {
  TILE_SIZE, COLORS, VIEWPORT_TILES,
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  LEFT_PANEL_WIDTH, FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
  PANEL_X, BOTTOM_HUD_Y, PANEL_WIDTH, EVENT_HEIGHT,
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

type BuildingType = keyof typeof buildingsData;

export class UIManager {
  private scene: Phaser.Scene;
  private simulation: Simulation;
  workSystem!: WorkSystem;
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

  selectedBuilding: Building | null = null;
  selectedEntity: Entity | null = null;
  selectionRect!: Phaser.GameObjects.Rectangle;
  infoPanel!: Phaser.GameObjects.Container;
  infoText!: Phaser.GameObjects.Text;
  collectBtn!: Phaser.GameObjects.Text;

  eventText!: Phaser.GameObjects.Text;

  thoughtIndex: number = 0;
  thoughtTimer: number = 0;
  milestonesShown: Set<string> = new Set();

  private inventoryIcons: Phaser.GameObjects.GameObject[] = [];
  private inventoryIconContainer!: Phaser.GameObjects.Container;

  private globalInventoryContainer!: Phaser.GameObjects.Container;
  private globalInventoryIcons: Phaser.GameObjects.GameObject[] = [];
  private lastGlobalInventoryHash: string = '';

  private artifactIcons: Phaser.GameObjects.Container[] = [];
  private artifactTooltip!: Phaser.GameObjects.Container;
  private artifactSystem: import('../systems/ArtifactSystem').ArtifactSystem | null = null;

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

    this.globalInventoryContainer = this.scene.add.container(FIELD_X + 8, 4);
    this.scene.add.existing(this.globalInventoryContainer).setDepth(21);
    this.updateGlobalInventory();

    this.eventText = this.scene.add.text(FIELD_X + 8, 8, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: FIELD_W - 16 },
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

    this.colonistStatusText = this.scene.add.text(14, 48, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistStatusText);

    this.colonistTaskText = this.scene.add.text(14, 200, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistTaskText);

    this.colonistInvText = this.scene.add.text(14, 350, '', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.colonistInvText);

    this.questText = this.scene.add.text(14, 400, '', {
      fontSize: '14px', color: '#ffaa00', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 4,
    });
    this.leftPanelContainer.add(this.questText);

    this.inventoryIconContainer = this.scene.add.container(0, 0);
    this.leftPanelContainer.add(this.inventoryIconContainer);

    const thoughtTitle = this.scene.add.text(14, 480, `\u2500\u2500 ${languageManager.ui.thoughts} \u2500\u2500`, {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.leftPanelContainer.add(thoughtTitle);

    this.thoughtText = this.scene.add.text(14, 505, '', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
      wordWrap: { width: LEFT_PANEL_WIDTH - 28 },
      lineSpacing: 3,
      fontStyle: 'italic',
    });
    this.leftPanelContainer.add(this.thoughtText);

    const minimapY = 560;
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

    this.scrollDownBtn = this.scene.add.text(14 + 90, btnY + btnSize + 4, '\u25BC', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-down'));
    this.leftPanelContainer.add(this.scrollDownBtn);

    this.scrollLeftBtn = this.scene.add.text(14 + 90 - btnSize - 4, btnY + btnSize / 2 + 2, '\u25C0', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-left'));
    this.leftPanelContainer.add(this.scrollLeftBtn);

    this.scrollRightBtn = this.scene.add.text(14 + 90 + btnSize + 4, btnY + btnSize / 2 + 2, '\u25B6', btnStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.input.keyboard?.emit('scroll-right'));
    this.leftPanelContainer.add(this.scrollRightBtn);

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

    const bg = this.scene.add.rectangle(0, 0, 230, 200, 0x0a0a2e, 0.95)
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
  }

  private onCollect(): void {
    if (!this.selectedEntity) return;
    if (this.onCollectCallback) {
      this.onCollectCallback(this.selectedEntity);
    }
  }

  onCollectCallback: ((entity: Entity) => void) | null = null;

  createBottomHUD(
    onSave: () => void,
    onLoad: () => void,
    onClear: () => void,
    onBuildIconCreated: () => void,
    debugPanel?: import('./DebugPanel').DebugPanel
  ): void {
    this.scene.add.rectangle(FIELD_X, BOTTOM_HUD_Y, FIELD_W, HUD_HEIGHT, COLORS.uiPanel, 0.95)
      .setOrigin(0).setDepth(20);
    this.scene.add.rectangle(FIELD_X, BOTTOM_HUD_Y, FIELD_W, 2, COLORS.settler, 0.5)
      .setOrigin(0).setDepth(21);

    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '16px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 4 },
    };

    this.scene.add.text(FIELD_X + 10, BOTTOM_HUD_Y + 10, `[${languageManager.ui.save}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', onSave);

    this.scene.add.text(FIELD_X + 80, BOTTOM_HUD_Y + 10, `[${languageManager.ui.load}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', onLoad);

    this.scene.add.text(FIELD_X + 150, BOTTOM_HUD_Y + 10, `[${languageManager.ui.clear}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', onClear);

    if (debugPanel) {
      const controlX = FIELD_X + FIELD_W - 200;

      const langBtn = this.scene.add.text(controlX, BOTTOM_HUD_Y + 10, `[${languageManager.lang.toUpperCase()}]`, {
        ...btnStyle,
        color: '#ffd700',
      }).setInteractive({ useHandCursor: true }).setDepth(22)
        .on('pointerdown', () => {
          languageManager.toggle();
          langBtn.setText(`[${languageManager.lang.toUpperCase()}]`);
        });

      const speeds = [1, 2, 4];
      let xOff = controlX + 50;
      const speedBtns: Phaser.GameObjects.Text[] = [];
      for (const spd of speeds) {
        const btn = this.scene.add.text(xOff, BOTTOM_HUD_Y + 10, `\u00d7${spd}`, {
          ...btnStyle,
          color: spd === 1 ? '#58a6ff' : '#8b949e',
        }).setInteractive({ useHandCursor: true }).setDepth(22)
          .on('pointerdown', () => {
            debugPanel.speed = spd;
            for (let i = 0; i < speedBtns.length; i++) {
              speedBtns[i].setColor(speeds[i] === spd ? '#58a6ff' : '#8b949e');
            }
          });
        speedBtns.push(btn);
        xOff += btn.width + 8;
      }
    }

    onBuildIconCreated();
    this.createBuildButtons();
  }

  createBuildButtons(): void {
    const types = Object.keys(buildingsData) as BuildingType[];
    const btnY = BOTTOM_HUD_Y + 45;
    const ICON_SIZE = 50;
    const ICON_GAP = 10;

    const cancelBtn = this.scene.add.text(FIELD_X + 10, btnY + 5, '[X]', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 6 },
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
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

      const bg = this.scene.add.rectangle(ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE + 8, ICON_SIZE + 8, 0x21262d, 0.9)
        .setStrokeStyle(1, COLORS.panelBorder);
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
      container.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bg.setStrokeStyle(2, 0x58a6ff);
        })
        .on('pointerout', () => {
          bg.setStrokeStyle(1, COLORS.panelBorder);
        })
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

      xOff += ICON_SIZE + 16 + ICON_GAP;
    }
  }

  canAfford(type: BuildingType): boolean {
    const def = (buildingsData as any)[type];
    const settler = (this.scene as any).getSelectedSettler() as Settler;
    if (!settler) return false;
    return Object.entries(def.requires).every(([res, qty]) =>
      settler.hasResource(res, qty as number)
    );
  }

  updateBuildButtonStates(): void {
    const types = Object.keys(buildingsData) as BuildingType[];
    const settler = (this.scene as any).getSelectedSettler() as Settler;

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const def = (buildingsData as any)[type];
      const btn = this.buildButtons[i + 1];

      if (!btn || !(btn instanceof Phaser.GameObjects.Container)) continue;

      const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
      const icon = btn.list[1] as Phaser.GameObjects.Image;

      const affordable = settler && Object.entries(def.requires).every(([res, qty]) =>
        (settler.inventory.find(item => item.resourceType === res)?.quantity ?? 0) >= (qty as number)
      );

      if (!settler) {
        icon.setAlpha(0.35);
        bg.setFillStyle(0x161b22, 0.9);
        continue;
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
    }
  }

  updateSelection(): void {
    if (this.selectedBuilding) {
      const { sx, sy } = this.tileToScreen(this.selectedBuilding.x, this.selectedBuilding.y);
      this.selectionRect.setPosition(sx, sy);
      this.selectionRect.setVisible(true);
    } else if (this.selectedEntity) {
      const { sx, sy } = this.tileToScreen(this.selectedEntity.x, this.selectedEntity.y);
      this.selectionRect.setPosition(sx, sy);
      this.selectionRect.setVisible(true);
    } else {
      this.selectionRect.setVisible(false);
    }
  }

  updateLeftPanel(gameOver: boolean, tickCount: number): void {
    if (gameOver) return;
    const s = (this.scene as any).getSelectedSettler() as Settler;
    if (!s) return;

    const taskStr = s.currentTaskId ? languageManager.ui.working : languageManager.ui.idle;
    const buildStr = this.buildMode ? `\n${languageManager.ui.buildMode}: ${(buildingsData as any)[this.buildMode].name}` : '';

    const colorHex = '#' + s.color.toString(16).padStart(6, '0');
    this.colonistStatusText.setText(
      `${s.name} (${s.settlerClass})\n` +
      `${languageManager.ui.position}: ${s.x},${s.y}\n` +
      `${languageManager.ui.hp}: ${Math.round(s.hp)}/${s.maxHp}\n` +
      `${languageManager.ui.hunger}: ${Math.round(s.hunger)}%\n` +
      `${languageManager.ui.energy}: ${Math.round(s.energy)}%\n` +
      `${languageManager.ui.food}: ${s.food}\n` +
      `${languageManager.ui.tick}: ${tickCount}` +
      buildStr
    );
    this.colonistStatusText.setColor(colorHex);

    this.colonistTaskText.setText(
      `\u2500\u2500 ${languageManager.ui.taskSection} \u2500\u2500\n` +
      `${languageManager.ui.status}: ${taskStr}\n` +
      `${languageManager.ui.taskId}: ${s.currentTaskId ?? languageManager.ui.none}\n` +
      `${languageManager.ui.pathLen}: ${s.path.length}`
    );

    this.colonistInvText.setText(
      `\u2500\u2500 ${languageManager.ui.inventorySection} \u2500\u2500`
    );

    const questSystem = (this.scene as any).questSystem;
    if (questSystem) {
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
    const oy = 584;

    const tileColors: Record<string, number> = {
      grass: 0x3a5a2a,
      dirt: 0x3a5a2a,
      water: 0x3b7dd8,
      stone: 0x3a5a2a,
      sand: 0x3a5a2a,
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

  updateArtifacts(): void {
    if (!this.artifactSystem) return;

    for (const icon of this.artifactIcons) {
      icon.destroy();
    }
    this.artifactIcons = [];

    const collected = this.artifactSystem.getCollectedArtifacts();
    if (collected.size === 0) return;

    const startX = 14;
    const startY = 830;
    const iconSize = 28;
    const gap = 4;

    let x = startX;
    collected.forEach((count, name) => {
      const effect = this.artifactSystem!.getArtifactEffect(name);
      if (!effect) return;

      const bg = this.scene.add.rectangle(x, startY, iconSize, iconSize, Phaser.Display.Color.HexStringToColor(effect.color).color, 0.8)
        .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);

      const icon = this.scene.add.text(x + iconSize / 2, startY + iconSize / 2, effect.icon, {
        fontSize: '16px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);

      const countText = this.scene.add.text(x + iconSize - 4, startY + 2, `${count}`, {
        fontSize: '10px', color: '#ffff00', fontFamily: 'monospace',
      }).setOrigin(1, 0);

      const container = this.scene.add.container(0, 0, [bg, icon, countText]);
      container.setSize(iconSize, iconSize);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => {
        this.showArtifactTooltip(name, effect.description, x, startY - 60);
      });

      this.leftPanelContainer.add(container);
      this.artifactIcons.push(container);

      x += iconSize + gap;
    });
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
    const artifactHash = this.artifactSystem ? Array.from(this.artifactSystem.getCollectedArtifacts().entries()).map(([n,c]) => `${n}:${c}`).join(',') : '';
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
    const startY = 380;
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
      const collected = this.artifactSystem.getCollectedArtifacts();
      collected.forEach((count, name) => {
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

    const startX = 14;
    const startY = 0;
    const iconSize = 24;
    const gap = 4;

    let x = startX;
    for (const item of inventory) {
      if (item.quantity <= 0) continue;

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

      this.globalInventoryContainer.add(iconContainer);
      this.globalInventoryIcons.push(iconContainer);

      x += iconSize + gap;
    }

    if (this.artifactSystem) {
      const collected = this.artifactSystem.getCollectedArtifacts();
      collected.forEach((count, name) => {
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

        this.globalInventoryContainer.add(artifactContainer);
        this.globalInventoryIcons.push(artifactContainer);

        x += iconSize + gap;
      });
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
