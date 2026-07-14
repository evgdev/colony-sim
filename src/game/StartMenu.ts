import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { languageManager } from '../data/LanguageManager';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ReplayFile } from '../replay/ReplayTypes';

export interface StartMenuCallbacks {
  onStart: (difficulty: 'easy' | 'hard') => void;
  onLoadReplay: () => void;
}

export class StartMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(callbacks: StartMenuCallbacks): void {
    this.destroy();
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const menu = this.scene.add.container(0, 0).setDepth(100);

    const img = this.scene.add.image(cx, cy, 'startMenuBg').setDisplaySize(CANVAS_WIDTH, CANVAS_HEIGHT);
    menu.add(img);

    const bg = this.scene.add.rectangle(cx, cy, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0d1117, 0.5);
    menu.add(bg);

    const title = this.scene.add.text(cx, cy - 78, languageManager.ui.difficulty, {
      fontSize: '18px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.add(title);

    const makeButton = (label: string, desc: string, y: number, cb: () => void) => {
      const btn = this.scene.add.text(cx, y, `${label}\n${desc}`, {
        fontSize: '16px', color: '#c9d1d9', fontFamily: 'monospace',
        backgroundColor: '#21262d', padding: { x: 12, y: 8 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#58a6ff'));
      btn.on('pointerout', () => btn.setColor('#c9d1d9'));
      btn.on('pointerdown', cb);
      menu.add(btn);
    };

    makeButton(languageManager.ui.easy, languageManager.ui.easyDesc, cy - 12,
      () => this.scene.time.delayedCall(0, () => callbacks.onStart('easy')));
    makeButton(languageManager.ui.hard, languageManager.ui.hardDesc, cy + 52,
      () => this.scene.time.delayedCall(0, () => callbacks.onStart('hard')));

    const replayLabel = this.scene.add.text(cx, cy + 116, '--- Replay ---', {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    menu.add(replayLabel);

    const savedReplays = ReplayRecorder.loadAll();
    let replayY = cy + 136;

    if (savedReplays.length > 0) {
      const maxShow = 4;
      for (let i = 0; i < Math.min(savedReplays.length, maxShow); i++) {
        const r = savedReplays[i];
        const days = Math.floor(r.totalTicks / 100);
        const hours = Math.floor((r.totalTicks % 100) / (100 / 24));
        const label = `${r.name} (${days}d ${hours}h)`;

        const item = this.scene.add.text(cx, replayY, label, {
          fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
          backgroundColor: '#21262d', padding: { x: 8, y: 3 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        item.on('pointerover', () => item.setColor('#58a6ff'));
        item.on('pointerout', () => item.setColor('#c9d1d9'));
        item.on('pointerdown', () => {
          const data = ReplayRecorder.loadById(r.id);
          if (data) this.scene.scene.start('ReplayScene', { replay: data });
        });
        menu.add(item);
        replayY += 20;
      }
      replayY += 4;
    }

    const loadFileBtn = this.scene.add.text(cx, replayY, '[Load from file]', {
      fontSize: '12px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    loadFileBtn.on('pointerover', () => loadFileBtn.setColor('#58a6ff'));
    loadFileBtn.on('pointerout', () => loadFileBtn.setColor('#8b949e'));
    loadFileBtn.on('pointerdown', () => callbacks.onLoadReplay());
    menu.add(loadFileBtn);

    this.container = menu;
  }

  destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }

  get isVisible(): boolean {
    return this.container !== null;
  }
}
