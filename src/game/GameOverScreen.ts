import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { languageManager } from '../data/LanguageManager';

const TICKS_PER_DAY = 24;

export class GameOverScreen {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(tickCount: number, onRestart: () => void): void {
    this.destroy();
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    this.container = this.scene.add.container(0, 0).setDepth(100);

    const bg = this.scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.9)
      .setOrigin(0);
    this.container.add(bg);

    const title = this.scene.add.text(cx, cy - 80, languageManager.ui.gameOver, {
      fontSize: '32px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    const lines = languageManager.narrative.combat.settlerDeath;
    const epitaph = lines[Math.floor(Math.random() * lines.length)].replace('{name}', 'Worker');
    const sub = this.scene.add.text(cx, cy - 20, epitaph, {
      fontSize: '16px', color: '#c9d1d9', fontFamily: 'monospace',
      align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5);
    this.container.add(sub);

    const days = Math.floor(tickCount / TICKS_PER_DAY);
    const hours = Math.floor(tickCount % TICKS_PER_DAY);
    const timeStr = days === 0 ? `${hours}h` : `${days}d ${hours}h`;
    const ticks = this.scene.add.text(cx, cy + 30, `${languageManager.ui.survived} ${timeStr}`, {
      fontSize: '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(ticks);

    const restartBtn = this.scene.add.text(cx, cy + 90, `[${languageManager.ui.restart}]`, {
      fontSize: '20px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', onRestart)
      .on('pointerover', () => restartBtn.setColor('#ffffff'))
      .on('pointerout', () => restartBtn.setColor('#ffd700'));
    this.container.add(restartBtn);
  }

  destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}
