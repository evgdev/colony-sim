import Phaser from 'phaser';
import { COLORS } from '../config';

export class TaskPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private logText: Phaser.GameObjects.Text;
  private logs: string[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.logText = scene.add.text(x, y, 'Tasks:', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace',
      wordWrap: { width: 300 },
    });

    this.container = scene.add.container(0, 0, [this.logText]);
  }

  addLog(msg: string): void {
    this.logs.push(msg);
    if (this.logs.length > 5) this.logs.shift();
    this.logText.setText('Tasks:\n' + this.logs.join('\n'));
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
