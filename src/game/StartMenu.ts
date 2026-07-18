import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { ReplayRecorder } from '../replay/ReplayRecorder';

export type GameMode = 'story' | 'defense';

export interface StartMenuCallbacks {
  onStart: (mode: GameMode, difficulty: 'easy' | 'hard') => void;
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

    // Background
    const img = this.scene.add.image(cx, cy, 'startMenuBg').setDisplaySize(CANVAS_WIDTH, CANVAS_HEIGHT);
    menu.add(img);

    const bg = this.scene.add.rectangle(cx, cy, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0d1117, 0.6);
    menu.add(bg);

    // Title
    const title = this.scene.add.text(cx, cy - 130, 'Туманность Андромеды — Новая Земля', {
      fontSize: '72px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    menu.add(title);

    const subtitle = this.scene.add.text(cx, cy - 98, 'Выживание на планете динозавров', {
      fontSize: '32px', color: '#8b949e', fontFamily: 'monospace',
      lineSpacing: 8,
    }).setOrigin(0.5)
      .setDepth(1)
      .setScale(0.5); // масштаб вниз
    menu.add(subtitle);

    // Divider
    const divider = this.scene.add.rectangle(cx, cy - 74, 400, 1, 0x30363d);
    menu.add(divider);

    // Mode section title
    const modeLabel = this.scene.add.text(cx, cy - 60, 'ВЫБЕРИ РЕЖИМ', {
      fontSize: '36px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    menu.add(modeLabel);

    // Story mode button
    const storyBtn = this.scene.add.container(cx - 120, cy);
    const storyBg = this.scene.add.rectangle(0, 0, 210, 80, 0x16213e, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4488ff)
      .setInteractive({ useHandCursor: true });
    const storyIcon = this.scene.add.text(0, -20, '📖', {
      fontSize: '48px',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    const storyTitle = this.scene.add.text(0, 6, 'ИСТОРИЯ', {
      fontSize: '32px', color: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    const storyDesc = this.scene.add.text(0, 26, 'Квесты и сюжет', {
      fontSize: '32px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    storyBtn.add([storyBg, storyIcon, storyTitle, storyDesc]);
    storyBtn.setSize(210, 80);

    storyBg.on('pointerover', () => storyBg.setStrokeStyle(2, 0x88bbff));
    storyBg.on('pointerout', () => storyBg.setStrokeStyle(2, 0x4488ff));
    storyBg.on('pointerdown', () => {
      this.scene.time.delayedCall(0, () => callbacks.onStart('story', 'easy'));
    });
    menu.add(storyBtn);

    // Defense mode button
    const defenseBtn = this.scene.add.container(cx + 120, cy);
    const defenseBg = this.scene.add.rectangle(0, 0, 210, 80, 0x16213e, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xff4444)
      .setInteractive({ useHandCursor: true });
    const defenseIcon = this.scene.add.text(0, -20, '⚔', {
      fontSize: '24px',
    }).setOrigin(0.5);
    const defenseTitle = this.scene.add.text(0, 6, 'ОБОРОНА', {
      fontSize: '32px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    const defenseDesc = this.scene.add.text(0, 26, 'Волны динозавров', {
      fontSize: '32px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1)
      .setScale(0.5);
    defenseBtn.add([defenseBg, defenseIcon, defenseTitle, defenseDesc]);
    defenseBtn.setSize(210, 80);

    defenseBg.on('pointerover', () => defenseBg.setStrokeStyle(2, 0xff8888));
    defenseBg.on('pointerout', () => defenseBg.setStrokeStyle(2, 0xff4444));
    defenseBg.on('pointerdown', () => {
      this.showDifficulty(callbacks, 'defense');
    });
    menu.add(defenseBtn);

    // Replay section
    const replayDivider = this.scene.add.rectangle(cx, cy + 60, 400, 1, 0x30363d);
    menu.add(replayDivider);

    const replayLabel = this.scene.add.text(cx, cy + 76, 'Replay', {
      fontSize: '13px', color: '#58a6ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    menu.add(replayLabel);

    const savedReplays = ReplayRecorder.loadAll();
    let replayY = cy + 96;

    if (savedReplays.length > 0) {
      const maxShow = 3;
      for (let i = 0; i < Math.min(savedReplays.length, maxShow); i++) {
        const r = savedReplays[i];
        const days = Math.floor(r.totalTicks / 100);
        const hours = Math.floor((r.totalTicks % 100) / (100 / 24));
        const label = `${r.name} (${days}d ${hours}h)`;

        const item = this.scene.add.text(cx, replayY, label, {
          fontSize: '11px', color: '#c9d1d9', fontFamily: 'monospace',
          backgroundColor: '#21262d', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        item.on('pointerover', () => item.setColor('#58a6ff'));
        item.on('pointerout', () => item.setColor('#c9d1d9'));
        item.on('pointerdown', () => {
          const data = ReplayRecorder.loadById(r.id);
          if (data) this.scene.scene.start('ReplayScene', { replay: data });
        });
        menu.add(item);
        replayY += 18;
      }
    }

    const loadFileBtn = this.scene.add.text(cx, replayY + 4, '[Загрузить из файла]', {
      fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    loadFileBtn.on('pointerover', () => loadFileBtn.setColor('#58a6ff'));
    loadFileBtn.on('pointerout', () => loadFileBtn.setColor('#8b949e'));
    loadFileBtn.on('pointerdown', () => callbacks.onLoadReplay());
    menu.add(loadFileBtn);

    this.container = menu;
  }

  private showDifficulty(callbacks: StartMenuCallbacks, mode: GameMode): void {
    if (!this.container) return;

    // Remove mode buttons, keep background
    this.container.removeAll(true);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Re-add background
    const bg = this.scene.add.rectangle(cx, cy, CANVAS_WIDTH, CANVAS_HEIGHT, 0x0d1117, 0.6);
    this.container.add(bg);

    const modeName = mode === 'story' ? 'ИСТОРИЯ' : 'ОБОРОНА';
    const modeColor = mode === 'story' ? '#4488ff' : '#ff4444';

    const title = this.scene.add.text(cx, cy - 80, modeName, {
      fontSize: '24px', color: modeColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    const diffLabel = this.scene.add.text(cx, cy - 48, 'ВЫБЕРИ СЛОЖНОСТЬ', {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(diffLabel);

    const makeDiffButton = (label: string, desc: string, y: number, diff: 'easy' | 'hard') => {
      const btn = this.scene.add.text(cx, y, `${label}\n${desc}`, {
        fontSize: '15px', color: '#c9d1d9', fontFamily: 'monospace',
        backgroundColor: '#21262d', padding: { x: 16, y: 10 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor(modeColor));
      btn.on('pointerout', () => btn.setColor('#c9d1d9'));
      btn.on('pointerdown', () => this.scene.time.delayedCall(0, () => callbacks.onStart(mode, diff)));
      this.container!.add(btn);
    };

    if (mode === 'defense') {
      makeDiffButton('Лёгкий', '10 волн. Ресурсы на старте.', cy - 8, 'easy');
      makeDiffButton('Сложный', '15 волн. Меньше ресурсов.', cy + 52, 'hard');
    }

    // Back button
    const backBtn = this.scene.add.text(cx, cy + 120, '← Назад', {
      fontSize: '13px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#c9d1d9'));
    backBtn.on('pointerout', () => backBtn.setColor('#8b949e'));
    backBtn.on('pointerdown', () => {
      this.container?.destroy();
      this.container = null;
      this.show(callbacks);
    });
    this.container.add(backBtn);
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
