import Phaser from 'phaser';
import { COLORS } from '../config';
import { SaveManager } from '../core/SaveManager';

export class SaveLoadMenu {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  createButtons(x: number, y: number, onSave: () => void, onLoad: () => void): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '12px',
      color: '#ffd700',
      fontFamily: 'monospace',
      backgroundColor: '#16213e',
      padding: { x: 6, y: 3 },
    };

    this.scene.add.text(x, y, '[SAVE]', style)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onSave);

    this.scene.add.text(x + 70, y, '[LOAD]', style)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onLoad);
  }
}
