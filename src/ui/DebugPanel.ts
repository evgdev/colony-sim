import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PANEL_WIDTH, COLORS,
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, PANEL_X, BOTTOM_HUD_Y,
  NEEDS_ENABLED,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Dinosaur } from '../entities/Dinosaur';
import { Resource } from '../entities/Resource';
import { TileGrid } from '../core/TileGrid';
import { languageManager } from '../data/LanguageManager';

const PAD = 14;
const LINE_H = 26;

export class DebugPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.Text[] = [];
  private pauseBtn!: Phaser.GameObjects.Text;
  private speedBtns: Phaser.GameObjects.Text[] = [];

  paused: boolean = false;
  speed: number = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(30);
    this.createBackground();
    this.createButtons();
  }

  private createBackground(): void {
    const bg = this.scene.add.rectangle(PANEL_X, 0, PANEL_WIDTH, CANVAS_HEIGHT, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.container.add(bg);

    const title = this.scene.add.text(PANEL_X + PAD, PAD, languageManager.ui.debug, {
      fontSize: '20px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(31);
    this.container.add(title);
  }

  private createButtons(): void {
    const btnY = BOTTOM_HUD_Y + 12;
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '18px', color: '#c9d1d9', fontFamily: 'monospace',
      backgroundColor: '#21262d', padding: { x: 10, y: 5 },
    };

    this.pauseBtn = this.scene.add.text(PANEL_X + PAD, btnY, `[${languageManager.ui.pause}]`, btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(31)
      .on('pointerdown', () => {
        this.paused = !this.paused;
        this.pauseBtn.setText(this.paused ? `[${languageManager.ui.resume}]` : `[${languageManager.ui.pause}]`);
        this.pauseBtn.setColor(this.paused ? '#ff6666' : '#c9d1d9');
      });
    this.container.add(this.pauseBtn);

    const speeds = [0.5, 1, 2, 4];
    for (let i = 0; i < speeds.length; i++) {
      const sb = this.scene.add.text(PANEL_X + PAD + 90 + i * 46, btnY, `×${speeds[i]}`, btnStyle)
        .setInteractive({ useHandCursor: true }).setDepth(31)
        .on('pointerdown', () => {
          this.speed = speeds[i];
          this.updateSpeedButtons();
        });
      this.speedBtns.push(sb);
      this.container.add(sb);
    }
    this.updateSpeedButtons();
  }

  private updateSpeedButtons(): void {
    const speeds = [0.5, 1, 2, 4];
    for (let i = 0; i < this.speedBtns.length; i++) {
      this.speedBtns[i].setColor(speeds[i] === this.speed ? '#58a6ff' : '#8b949e');
    }
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.pauseBtn.setInteractive({ useHandCursor: true });
    else this.pauseBtn.disableInteractive();
    this.pauseBtn.setAlpha(enabled ? 1 : 0.3);
    for (const sb of this.speedBtns) {
      if (enabled) sb.setInteractive({ useHandCursor: true });
      else sb.disableInteractive();
      sb.setAlpha(enabled ? 1 : 0.3);
    }
  }

  update(sim: Simulation): void {
    this.lines.forEach(l => l.destroy());
    this.lines = [];
    const u = languageManager.ui;

    let y = PAD + 36;

    const tileCounts = this.countTiles(sim.tileGrid);
    y = this.addSection(u.mapSection, y);
    y = this.addLine(`${tileCounts.grass} ${u.grass}  ${tileCounts.water} ${u.water}  ${tileCounts.stone} ${u.stone}`, y);
    y = this.addLine(`${tileCounts.sand} ${u.sand}  ${tileCounts.dirt} ${u.dirt}`, y);
    y = this.addLine(`${u.size}: ${sim.tileGrid.width}x${sim.tileGrid.height}`, y);

    y = this.addSection(u.simulationSection, y);
    y = this.addLine(`${u.tick}: ${sim.tickCount}`, y);
    y = this.addLine(`Rate: ${sim.tickRate}ms`, y);
    y = this.addLine(`${u.speed}: \u00d7${this.speed}`, y);
    y = this.addLine(`${u.paused}: ${this.paused ? u.yes : u.no}`, y);

    const settlers = sim.entityManager.getByType('settler') as Settler[];
    y = this.addSection(`${u.settlersSection} (${settlers.length})`, y);
    for (const s of settlers) {
      const inv = s.inventory.map(i => `${i.resourceType}:${i.quantity}`).join(' ') || u.empty;
      const task = s.currentTaskId ? s.currentTaskId.slice(0, 8) : u.idle;
      y = this.addLine(`${s.name} [${s.x},${s.y}]`, y);
      if (NEEDS_ENABLED) {
        y = this.addLine(`  ${u.hunger}:${Math.round(s.hunger)} ${u.energy}:${Math.round(s.energy)}`, y);
      }
      y = this.addLine(`  inv: [${inv}]`, y);
      y = this.addLine(`  task: ${task}  path:${s.path.length}`, y);
    }

    const dinos = sim.entityManager.getByType('dinosaur') as Dinosaur[];
    y = this.addSection(`${u.dinosSection} (${dinos.length})`, y);
    for (const d of dinos) {
      y = this.addLine(`${d.species} [${d.x},${d.y}] ${d.state}`, y);
      y = this.addLine(`  ${u.hp}:${d.hp}/${d.maxHp} speed:${d.speed}`, y);
    }

    const resources = sim.entityManager.getByType('resource') as Resource[];
    y = this.addSection(`${u.resourcesSection} (${resources.length})`, y);
    for (const r of resources) {
      y = this.addLine(`${r.resourceType}:${r.quantity} [${r.x},${r.y}]`, y);
    }

    const tasks = sim.taskQueue.length;
    y = this.addSection(u.taskQueueSection, y);
    y = this.addLine(`${u.pending}: ${tasks}`, y);
  }

  private addSection(title: string, y: number): number {
    const t = this.scene.add.text(PANEL_X + PAD, y, `\u2500\u2500 ${title} \u2500\u2500`, {
      fontSize: '16px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(31);
    this.container.add(t);
    this.lines.push(t);
    return y + LINE_H;
  }

  private addLine(text: string, y: number): number {
    const t = this.scene.add.text(PANEL_X + PAD + 6, y, text, {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
    }).setDepth(31);
    this.container.add(t);
    this.lines.push(t);
    return y + 22;
  }

  private countTiles(grid: TileGrid): Record<string, number> {
    const counts: Record<string, number> = { grass: 0, dirt: 0, water: 0, stone: 0, sand: 0 };
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.get(x, y);
        if (tile && counts[tile.type] !== undefined) {
          counts[tile.type]++;
        }
      }
    }
    return counts;
  }
}
