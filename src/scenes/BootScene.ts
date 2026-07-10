import Phaser from 'phaser';
import { GameScene } from './GameScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    const title = this.add.text(width / 2, height / 2 - 40, 'COLONY SIM', {
      fontSize: '32px',
      color: '#ffd700',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const loadText = this.add.text(width / 2, height / 2 + 10, 'Loading...', {
      fontSize: '16px',
      color: '#e0e0e0',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.time.delayedCall(500, () => {
      this.scene.start('GameScene');
    });
  }
}
