import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, COLORS } from '../config';
import { SaveManager } from '../core/SaveManager';
import { Settler } from '../entities/Settler';

export class UIScene extends Phaser.Scene {
  private taskLog: string[] = [];
  private taskLogText!: Phaser.GameObjects.Text;
  private settlerInfoText!: Phaser.GameObjects.Text;
  private saveText!: Phaser.GameObjects.Text;
  private loadText!: Phaser.GameObjects.Text;
  private clearText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const panelY = MAP_HEIGHT * TILE_SIZE;
    const panelHeight = 80;
    const panel = this.add.rectangle(0, panelY, MAP_WIDTH * TILE_SIZE, panelHeight, COLORS.uiPanel, 0.95)
      .setOrigin(0)
      .setDepth(20);

    this.add.rectangle(0, panelY, MAP_WIDTH * TILE_SIZE, 2, COLORS.settler, 0.5)
      .setOrigin(0)
      .setDepth(21);

    this.settlerInfoText = this.add.text(10, panelY + 8, '', {
      fontSize: '11px',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      wordWrap: { width: 250 },
    }).setDepth(22);

    this.taskLogText = this.add.text(10, panelY + 40, 'Tasks: (click tile or resource)', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace',
      wordWrap: { width: MAP_WIDTH * TILE_SIZE - 20 },
    }).setDepth(22);

    const btnY = panelY + 8;
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '12px',
      color: '#ffd700',
      fontFamily: 'monospace',
      backgroundColor: '#16213e',
      padding: { x: 6, y: 3 },
    };

    this.saveText = this.add.text(MAP_WIDTH * TILE_SIZE - 200, btnY, '[SAVE]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .setDepth(22)
      .on('pointerdown', () => {
        const gameScene = this.scene.get('GameScene') as any;
        if (gameScene?.simulation) {
          SaveManager.save(gameScene.simulation);
          this.addLog('Game saved!');
        }
      });

    this.loadText = this.add.text(MAP_WIDTH * TILE_SIZE - 140, btnY, '[LOAD]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .setDepth(22)
      .on('pointerdown', () => {
        const loaded = SaveManager.load();
        if (loaded) {
          const gameScene = this.scene.get('GameScene') as any;
          gameScene.simulation = loaded;
          this.addLog('Game loaded!');
        } else {
          this.addLog('No save found.');
        }
      });

    this.clearText = this.add.text(MAP_WIDTH * TILE_SIZE - 80, btnY, '[CLEAR]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .setDepth(22)
      .on('pointerdown', () => {
        SaveManager.deleteSave();
        this.addLog('Save cleared.');
      });

    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.on('task-added', (msg: string) => {
        this.addLog(msg);
      });
    }
  }

  update(): void {
    const gameScene = this.scene.get('GameScene') as any;
    if (!gameScene?.simulation) return;

    const sim = gameScene.simulation;
    const settlers = sim.entityManager.getByType('settler') as Settler[];

    if (settlers.length > 0) {
      const s = settlers[0];
      const taskStr = s.currentTaskId ? `Task: ${s.currentTaskId.slice(0, 8)}...` : 'Idle';
      const invStr = s.inventory.map(i => `${i.resourceType}:${i.quantity}`).join(', ') || 'empty';
      this.settlerInfoText.setText(
        `${s.name} | Pos: ${s.x},${s.y} | Hunger: ${Math.round(s.hunger)}% | Energy: ${Math.round(s.energy)}%\n` +
        `Inv: [${invStr}] | ${taskStr} | Tick: ${sim.tickCount}`
      );
    }
  }

  private addLog(msg: string): void {
    this.taskLog.push(msg);
    if (this.taskLog.length > 4) this.taskLog.shift();
    this.taskLogText.setText('Tasks:\n' + this.taskLog.join('\n'));
  }
}
