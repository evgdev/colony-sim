import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, COLORS } from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Resource } from '../entities/Resource';
import { Building } from '../entities/Building';
import { MovementSystem } from '../systems/MovementSystem';
import { WorkSystem } from '../systems/WorkSystem';
import { NeedsSystem } from '../systems/NeedsSystem';
import { BuildingSystem } from '../systems/BuildingSystem';
import { TaskPriority } from '../core/Task';
import { SaveManager } from '../core/SaveManager';
import buildingsData from '../data/buildings.json';

type BuildingType = keyof typeof buildingsData;

export class GameScene extends Phaser.Scene {
  simulation!: Simulation;
  movementSystem!: MovementSystem;
  workSystem!: WorkSystem;
  needsSystem!: NeedsSystem;
  buildingSystem!: BuildingSystem;

  private entityGraphics: Phaser.GameObjects.Graphics[] = [];
  private entityTexts: Phaser.GameObjects.Text[] = [];
  private hoverRect!: Phaser.GameObjects.Rectangle;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private tileSprites: Phaser.GameObjects.Rectangle[][] = [];

  private taskLog: string[] = [];
  private taskLogText!: Phaser.GameObjects.Text;
  private settlerInfoText!: Phaser.GameObjects.Text;

  private buildMode: BuildingType | null = null;
  private buildButtons: Phaser.GameObjects.Text[] = [];

  private selectedBuilding: Building | null = null;
  private selectionRect!: Phaser.GameObjects.Rectangle;
  private infoPanel!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private infoButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
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

    const settler = new Settler(10, 7, 'Worker');
    this.simulation.entityManager.add(settler);
    this.simulation.tileGrid.setOccupied(10, 7, true);

    const resources = [
      { x: 3, y: 2, type: 'wood', qty: 20 },
      { x: 15, y: 4, type: 'stone', qty: 15 },
      { x: 7, y: 10, type: 'wood', qty: 10 },
      { x: 12, y: 8, type: 'stone', qty: 8 },
    ];

    for (const r of resources) {
      const res = new Resource(r.x, r.y, r.type, r.qty);
      this.simulation.entityManager.add(res);
      this.simulation.tileGrid.setOccupied(r.x, r.y, true);
    }

    this.drawMap();
    this.drawEntities();
    this.createHUD();
    this.createButtons();
    this.createBuildButtons();
    this.createInfoPanel();

    this.hoverRect = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(2, COLORS.hoverTile)
      .setFillStyle(0xffffff, 0.15)
      .setOrigin(0)
      .setDepth(5)
      .setVisible(false);

    this.selectionRect = this.add.rectangle(0, 0, TILE_SIZE + 4, TILE_SIZE + 4)
      .setStrokeStyle(3, 0x00ff00)
      .setFillStyle(0x00ff00, 0.1)
      .setOrigin(0.5)
      .setDepth(6)
      .setVisible(false);

    this.pathGraphics = this.add.graphics().setDepth(4);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor(pointer.x / TILE_SIZE);
      const tileY = Math.floor(pointer.y / TILE_SIZE);
      const tile = this.simulation.tileGrid.get(tileX, tileY);
      if (tile) {
        this.hoverRect.setPosition(tileX * TILE_SIZE, tileY * TILE_SIZE);
        this.hoverRect.setVisible(true);
      } else {
        this.hoverRect.setVisible(false);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y >= MAP_HEIGHT * TILE_SIZE) return;
      const tileX = Math.floor(pointer.x / TILE_SIZE);
      const tileY = Math.floor(pointer.y / TILE_SIZE);
      this.handleTileClick(tileX, tileY);
    });
  }

  update(time: number, delta: number): void {
    const ticked = this.simulation.update(delta);
    if (ticked) {
      this.needsSystem.update(
        this.simulation.entityManager.getByType('settler') as Settler[],
        this.simulation.tickRate / 1000
      );
      this.workSystem.update(this.simulation.tickRate / 1000);
      this.buildingSystem.update(this.simulation.tickRate / 1000);
    }
    this.drawEntities();
    this.drawPath();
    this.updateHUD();
    this.updateSelection();
    this.updateInfoPanel();
  }

  private createHUD(): void {
    const panelY = MAP_HEIGHT * TILE_SIZE;
    this.add.rectangle(0, panelY, MAP_WIDTH * TILE_SIZE, 80, COLORS.uiPanel, 0.95)
      .setOrigin(0).setDepth(20);
    this.add.rectangle(0, panelY, MAP_WIDTH * TILE_SIZE, 2, COLORS.settler, 0.5)
      .setOrigin(0).setDepth(21);

    this.settlerInfoText = this.add.text(10, panelY + 8, '', {
      fontSize: '11px', color: '#e0e0e0', fontFamily: 'monospace',
      wordWrap: { width: MAP_WIDTH * TILE_SIZE - 20 },
    }).setDepth(22);

    this.taskLogText = this.add.text(10, panelY + 40, 'Click tile = move, click resource = collect, click building = select', {
      fontSize: '10px', color: '#888888', fontFamily: 'monospace',
      wordWrap: { width: MAP_WIDTH * TILE_SIZE - 20 },
    }).setDepth(22);
  }

  private createButtons(): void {
    const panelY = MAP_HEIGHT * TILE_SIZE;
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '12px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 6, y: 3 },
    };

    this.add.text(MAP_WIDTH * TILE_SIZE - 200, panelY + 8, '[SAVE]', btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        SaveManager.save(this.simulation);
        this.addLog('Game saved!');
      });

    this.add.text(MAP_WIDTH * TILE_SIZE - 140, panelY + 8, '[LOAD]', btnStyle)
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
          this.addLog('Game loaded!');
        } else {
          this.addLog('No save found.');
        }
      });

    this.add.text(MAP_WIDTH * TILE_SIZE - 80, panelY + 8, '[CLEAR]', btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        SaveManager.deleteSave();
        this.addLog('Save cleared.');
      });
  }

  private createBuildButtons(): void {
    const panelY = MAP_HEIGHT * TILE_SIZE;
    const types = Object.keys(buildingsData) as BuildingType[];
    const startX = 10;
    const btnY = panelY + 55;

    const cancelBtn = this.add.text(startX, btnY, '[X]', {
      fontSize: '10px', color: '#ff4444', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 4, y: 2 },
    }).setInteractive({ useHandCursor: true }).setDepth(22)
      .on('pointerdown', () => {
        this.buildMode = null;
        this.updateBuildButtons();
      });
    this.buildButtons.push(cancelBtn);

    let xOff = 35;
    for (const type of types) {
      const def = (buildingsData as any)[type];
      const reqStr = Object.entries(def.requires).map(([k, v]) => `${k}:${v}`).join(' ');
      const btn = this.add.text(startX + xOff, btnY, `[${def.name}] ${reqStr}`, {
        fontSize: '10px', color: '#44cc44', fontFamily: 'monospace',
        backgroundColor: '#16213e', padding: { x: 4, y: 2 },
      }).setInteractive({ useHandCursor: true }).setDepth(22)
        .on('pointerdown', () => {
          this.selectedBuilding = null;
          this.selectionRect.setVisible(false);
          this.infoPanel.setVisible(false);
          this.buildMode = type;
          this.updateBuildButtons();
          this.addLog(`Build: ${def.name} — click a tile`);
        });
      this.buildButtons.push(btn);
      xOff += btn.width + 6;
    }
  }

  private updateBuildButtons(): void {
    for (let i = 0; i < this.buildButtons.length; i++) {
      const btn = this.buildButtons[i];
      if (i === 0) {
        btn.setAlpha(this.buildMode ? 1.0 : 0.4);
      } else {
        const typeIdx = i - 1;
        const types = Object.keys(buildingsData) as BuildingType[];
        btn.setAlpha(this.buildMode === types[typeIdx] ? 1.0 : 0.5);
      }
    }
  }

  private createInfoPanel(): void {
    const panelX = MAP_WIDTH * TILE_SIZE - 220;
    const panelY = MAP_HEIGHT * TILE_SIZE - 120;

    this.infoPanel = this.add.container(panelX, panelY).setDepth(25).setVisible(false);

    const bg = this.add.rectangle(0, 0, 215, 115, 0x0a0a2e, 0.95)
      .setOrigin(0).setStrokeStyle(1, 0x44cc44);
    this.infoPanel.add(bg);

    this.infoText = this.add.text(8, 6, '', {
      fontSize: '10px', color: '#e0e0e0', fontFamily: 'monospace',
      wordWrap: { width: 200 },
    });
    this.infoPanel.add(this.infoText);
  }

  private updateInfoPanel(): void {
    if (!this.selectedBuilding) {
      this.infoPanel.setVisible(false);
      return;
    }
    const bld = this.selectedBuilding;
    if (!this.simulation.entityManager.get(bld.id)) {
      this.selectedBuilding = null;
      this.infoPanel.setVisible(false);
      return;
    }

    this.infoPanel.setVisible(true);
    const def = (buildingsData as any)[bld.buildingType];
    const name = def?.name ?? bld.buildingType;
    const desc = def?.description ?? '';

    let lines = [
      `${name}  (${bld.x},${bld.y})`,
      `HP: ${bld.hp}/${bld.maxHp}`,
      desc,
    ];

    if (!bld.built) {
      lines.push(`Building: ${Math.round(bld.progressPercent * 100)}%`);
    }

    if (bld.storageCapacity > 0) {
      const storStr = bld.storage.map(s => `${s.resourceType}:${s.quantity}`).join(', ') || 'empty';
      lines.push(`Storage: ${bld.storageUsed}/${bld.storageCapacity} [${storStr}]`);
    }

    if (bld.produceType) {
      lines.push(`Produces: ${bld.produceType} x${bld.produceRate} every ${bld.produceInterval}t`);
      const storAmount = bld.getStorageAmount(bld.produceType);
      lines.push(`In storage: ${storAmount}`);
    }

    this.infoText.setText(lines.join('\n'));
  }

  private updateSelection(): void {
    if (!this.selectedBuilding) {
      this.selectionRect.setVisible(false);
      return;
    }
    this.selectionRect.setPosition(
      this.selectedBuilding.x * TILE_SIZE + TILE_SIZE / 2,
      this.selectedBuilding.y * TILE_SIZE + TILE_SIZE / 2
    );
    this.selectionRect.setVisible(true);
  }

  private updateHUD(): void {
    const settlers = this.simulation.entityManager.getByType('settler') as Settler[];
    if (settlers.length > 0) {
      const s = settlers[0];
      const taskStr = s.currentTaskId ? 'Working...' : 'Idle';
      const invStr = s.inventory.map(i => `${i.resourceType}:${i.quantity}`).join(', ') || 'empty';
      const buildStr = this.buildMode ? `  BUILD: ${(buildingsData as any)[this.buildMode].name}` : '';
      this.settlerInfoText.setText(
        `${s.name}  Pos: ${s.x},${s.y}  Hunger: ${Math.round(s.hunger)}%  Energy: ${Math.round(s.energy)}%${buildStr}\n` +
        `Inv: [${invStr}]  ${taskStr}  Tick: ${this.simulation.tickCount}`
      );
    }
  }

  private addLog(msg: string): void {
    this.taskLog.push(msg);
    if (this.taskLog.length > 4) this.taskLog.shift();
    this.taskLogText.setText('Tasks:\n' + this.taskLog.join('\n'));
  }

  private drawMap(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = this.simulation.tileGrid.get(x, y)!;
        const color = COLORS[tile.type as keyof typeof COLORS] || 0x333333;
        const rect = this.add.rectangle(
          x * TILE_SIZE, y * TILE_SIZE,
          TILE_SIZE, TILE_SIZE, color
        ).setOrigin(0).setStrokeStyle(1, 0x222222);
        this.tileSprites[y][x] = rect;
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
      const g = this.add.graphics();
      const cx = entity.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = entity.y * TILE_SIZE + TILE_SIZE / 2;

      if (entity.entityType === 'settler') {
        const settler = entity as Settler;
        g.fillStyle(COLORS.settler, 1);
        g.fillCircle(cx, cy, TILE_SIZE / 3);
        g.lineStyle(2, 0x000000);
        g.strokeCircle(cx, cy, TILE_SIZE / 3);

        this.entityTexts.push(
          this.add.text(cx, cy - TILE_SIZE / 2 - 8, settler.name, {
            fontSize: '10px', color: '#ffd700', fontFamily: 'monospace',
          }).setOrigin(0.5).setDepth(10)
        );

        const barWidth = TILE_SIZE - 4;
        const barHeight = 4;
        const barX = entity.x * TILE_SIZE + 2;
        const barY = entity.y * TILE_SIZE - 6;

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY, barWidth, barHeight);
        g.fillStyle(0x22cc22, 1);
        g.fillRect(barX, barY, barWidth * (settler.hunger / 100), barHeight);

        g.fillStyle(0x333333, 0.8);
        g.fillRect(barX, barY + barHeight + 1, barWidth, barHeight);
        g.fillStyle(0x2299ff, 1);
        g.fillRect(barX, barY + barHeight + 1, barWidth * (settler.energy / 100), barHeight);

        if (settler.inventory.length > 0) {
          g.fillStyle(0xffaa00, 0.9);
          g.fillRect(cx + TILE_SIZE / 4, cy - TILE_SIZE / 4, 6, 6);
        }
      } else if (entity.entityType === 'resource') {
        const res = entity as Resource;
        g.fillStyle(COLORS.resource, 0.9);
        g.fillRect(cx - TILE_SIZE / 4, cy - TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);
        g.lineStyle(2, 0x000000);
        g.strokeRect(cx - TILE_SIZE / 4, cy - TILE_SIZE / 4, TILE_SIZE / 2, TILE_SIZE / 2);

        this.entityTexts.push(
          this.add.text(cx, cy + TILE_SIZE / 4 + 4, `${res.resourceType} ${res.quantity}`, {
            fontSize: '8px', color: '#ff6347', fontFamily: 'monospace',
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
          this.add.text(cx, cy + TILE_SIZE / 3 + 2, name, {
            fontSize: '7px', color: '#ffffff', fontFamily: 'monospace',
          }).setOrigin(0.5, 0).setDepth(10)
        );

        if (!bld.built) {
          const barX = cx - TILE_SIZE / 3;
          const barY = cy - TILE_SIZE / 3 - 5;
          const barW = (TILE_SIZE / 1.5);
          g.fillStyle(0x333333, 0.8);
          g.fillRect(barX, barY, barW, 3);
          g.fillStyle(0xffcc00, 1);
          g.fillRect(barX, barY, barW * bld.progressPercent, 3);
        } else if (bld.storageCapacity > 0 && bld.storageUsed > 0) {
          const barX = cx - TILE_SIZE / 3;
          const barY = cy - TILE_SIZE / 3 - 5;
          const barW = (TILE_SIZE / 1.5);
          g.fillStyle(0x333333, 0.8);
          g.fillRect(barX, barY, barW, 3);
          g.fillStyle(0x44aaff, 1);
          g.fillRect(barX, barY, barW * (bld.storageUsed / bld.storageCapacity), 3);
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
          settler.x * TILE_SIZE + TILE_SIZE / 2,
          settler.y * TILE_SIZE + TILE_SIZE / 2
        );
        for (let i = settler.pathIndex; i < settler.path.length; i++) {
          const p = settler.path[i];
          this.pathGraphics.lineTo(
            p.x * TILE_SIZE + TILE_SIZE / 2,
            p.y * TILE_SIZE + TILE_SIZE / 2
          );
        }
        this.pathGraphics.strokePath();
      }
    }
  }

  private handleTileClick(tileX: number, tileY: number): void {
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
      this.selectBuilding(buildingAtTile);
      return;
    }

    this.selectedBuilding = null;
    this.selectionRect.setVisible(false);
    this.infoPanel.setVisible(false);

    const entityAtTile = this.simulation.entityManager.getAll().find(
      e => e.entityType === 'resource' && e.x === tileX && e.y === tileY
    );

    if (entityAtTile && entityAtTile.entityType === 'resource') {
      this.workSystem.createPickUpTask(entityAtTile as Resource, TaskPriority.High);
      this.addLog(`Collect resource at ${tileX},${tileY}`);
    } else if (tile.walkable) {
      this.workSystem.createMoveTask(tileX, tileY);
      this.addLog(`Move to ${tileX},${tileY}`);
    }
  }

  private selectBuilding(building: Building): void {
    this.selectedBuilding = building;
    this.buildMode = null;
    this.updateBuildButtons();
    const def = (buildingsData as any)[building.buildingType];
    this.addLog(`Selected: ${def?.name ?? building.buildingType}`);
  }

  private handleBuildClick(tileX: number, tileY: number, tile: any): void {
    if (!tile.walkable) {
      this.addLog('Cannot build here');
      return;
    }

    const existing = this.simulation.entityManager.getAll().find(
      e => e.x === tileX && e.y === tileY
    );
    if (existing) {
      this.addLog('Tile is occupied');
      return;
    }

    const def = (buildingsData as any)[this.buildMode!];
    const settler = this.simulation.entityManager.getByType('settler')[0] as Settler;
    const hasAll = Object.entries(def.requires).every(([res, qty]) =>
      settler.hasResource(res, qty as number)
    );
    if (!hasAll) {
      const need = Object.entries(def.requires).map(([r, q]) => `${r}:${q}`).join(', ');
      this.addLog(`Need: ${need}`);
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
    this.addLog(`Building ${def.name} at ${tileX},${tileY}`);

    this.buildMode = null;
    this.updateBuildButtons();
  }
}
