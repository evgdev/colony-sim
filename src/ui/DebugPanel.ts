import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PANEL_WIDTH, COLORS,
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Resource } from '../entities/Resource';
import { TileGrid } from '../core/TileGrid';

const PX = MAP_WIDTH * TILE_SIZE;
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
    const bg = this.scene.add.rectangle(PX, 0, PANEL_WIDTH, CANVAS_HEIGHT, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    this.container.add(bg);

    const title = this.scene.add.text(PX + PAD, PAD, 'DEBUG', {
      fontSize: '20px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(31);
    this.container.add(title);
  }

  private createButtons(): void {
    const btnY = CANVAS_HEIGHT - HUD_HEIGHT + 12;
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '18px', color: '#c9d1d9', fontFamily: 'monospace',
      backgroundColor: '#21262d', padding: { x: 10, y: 5 },
    };

    this.pauseBtn = this.scene.add.text(PX + PAD, btnY, '[PAUSE]', btnStyle)
      .setInteractive({ useHandCursor: true }).setDepth(31)
      .on('pointerdown', () => {
        this.paused = !this.paused;
        this.pauseBtn.setText(this.paused ? '[RESUME]' : '[PAUSE]');
        this.pauseBtn.setColor(this.paused ? '#ff6666' : '#c9d1d9');
      });
    this.container.add(this.pauseBtn);

    const speeds = [1, 2, 4];
    let xOff = PX + PAD + 120;
    for (const spd of speeds) {
      const btn = this.scene.add.text(xOff, btnY, `×${spd}`, {
        ...btnStyle,
        color: spd === 1 ? '#58a6ff' : '#8b949e',
      }).setInteractive({ useHandCursor: true }).setDepth(31)
        .on('pointerdown', () => {
          this.speed = spd;
          this.updateSpeedButtons();
        });
      this.speedBtns.push(btn);
      this.container.add(btn);
      xOff += btn.width + 10;
    }
  }

  private updateSpeedButtons(): void {
    const speeds = [1, 2, 4];
    for (let i = 0; i < this.speedBtns.length; i++) {
      this.speedBtns[i].setColor(speeds[i] === this.speed ? '#58a6ff' : '#8b949e');
    }
  }

  update(sim: Simulation): void {
    this.lines.forEach(l => l.destroy());
    this.lines = [];

    let y = PAD + 36;

    const tileCounts = this.countTiles(sim.tileGrid);
    y = this.addSection('MAP', y);
    y = this.addLine(`${tileCounts.grass} grass  ${tileCounts.water} water  ${tileCounts.stone} stone`, y);
    y = this.addLine(`${tileCounts.sand} sand  ${tileCounts.dirt} dirt`, y);
    y = this.addLine(`Size: ${sim.tileGrid.width}x${sim.tileGrid.height}`, y);

    y = this.addSection('SIMULATION', y);
    y = this.addLine(`Tick: ${sim.tickCount}  Rate: ${sim.tickRate}ms  Speed: ×${this.speed}`, y);
    y = this.addLine(`Paused: ${this.paused ? 'YES' : 'no'}`, y);

    const settlers = sim.entityManager.getByType('settler') as Settler[];
    y = this.addSection(`SETTLERS (${settlers.length})`, y);
    for (const s of settlers) {
      const inv = s.inventory.map(i => `${i.resourceType}:${i.quantity}`).join(' ') || 'empty';
      const task = s.currentTaskId ? s.currentTaskId.slice(0, 8) : 'idle';
      y = this.addLine(`${s.name} [${s.x},${s.y}]`, y);
      y = this.addLine(`  hunger:${Math.round(s.hunger)} energy:${Math.round(s.energy)}`, y);
      y = this.addLine(`  inv: [${inv}]`, y);
      y = this.addLine(`  task: ${task}  path:${s.path.length}`, y);
    }

    const buildings = sim.entityManager.getByType('building') as Building[];
    y = this.addSection(`BUILDINGS (${buildings.length})`, y);
    for (const b of buildings) {
      const status = b.built ? 'DONE' : `${Math.round(b.progressPercent * 100)}%`;
      const stor = b.storage.length > 0
        ? b.storage.map(s => `${s.resourceType}:${s.quantity}`).join(' ')
        : '';
      y = this.addLine(`${b.buildingType} [${b.x},${b.y}] ${status}`, y);
      y = this.addLine(`  hp:${b.hp}/${b.maxHp}`, y);
      if (stor) y = this.addLine(`  store: ${stor}`, y);
    }

    const dinos = sim.entityManager.getByType('dinosaur') as Dinosaur[];
    y = this.addSection(`DINOSAURS (${dinos.length})`, y);
    for (const d of dinos) {
      y = this.addLine(`${d.species} [${d.x},${d.y}] ${d.state}`, y);
      y = this.addLine(`  hp:${d.hp}/${d.maxHp} speed:${d.speed}`, y);
    }

    const resources = sim.entityManager.getByType('resource') as Resource[];
    y = this.addSection(`RESOURCES (${resources.length})`, y);
    for (const r of resources) {
      y = this.addLine(`${r.resourceType}:${r.quantity} [${r.x},${r.y}]`, y);
    }

    const tasks = sim.taskQueue.length;
    y = this.addSection('TASK QUEUE', y);
    y = this.addLine(`Pending: ${tasks}`, y);
  }

  private addSection(title: string, y: number): number {
    const t = this.scene.add.text(PX + PAD, y, `── ${title} ──`, {
      fontSize: '16px', color: '#58a6ff', fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(31);
    this.container.add(t);
    this.lines.push(t);
    return y + LINE_H;
  }

  private addLine(text: string, y: number): number {
    const t = this.scene.add.text(PX + PAD + 6, y, text, {
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
