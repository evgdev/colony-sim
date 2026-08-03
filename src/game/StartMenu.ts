import Phaser from 'phaser';
import { getLayout } from '../ui/LayoutConfig';
import { ReplayRecorder } from '../replay/ReplayRecorder';

export type GameMode = 'story' | 'defense' | 'multiplayer_host' | 'multiplayer_join';

export interface StartMenuCallbacks {
  onStart: (mode: GameMode, difficulty: 'easy' | 'hard') => void;
  onLoadReplay: () => void;
  onShowTutorial?: () => void;
  onHostGame?: () => void;
  onJoinGame?: (serverUrl: string) => void;
}

export class StartMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(callbacks: StartMenuCallbacks): void {
    this.destroy();
    const L = getLayout();
    const cx = L.canvasW / 2;
    const cy = L.canvasH / 2;
    const isMobile = L.mode === 'mobile';
    const menu = this.scene.add.container(0, 0).setDepth(100);

    // Background
    const img = this.scene.add.image(cx, cy, 'startMenuBg').setDisplaySize(L.canvasW, L.canvasH);
    menu.add(img);

    const bg = this.scene.add.rectangle(cx, cy, L.canvasW, L.canvasH, 0x0d1117, 0.6);
    menu.add(bg);

    // Responsive sizes
    const titleSize = isMobile ? '18px' : '36px';
    const subtitleSize = isMobile ? '12px' : '16px';
    const modeLabelSize = isMobile ? '14px' : '18px';
    const btnW = isMobile ? 150 : 210;
    const btnH = isMobile ? 60 : 80;
    const dividerW = isMobile ? L.canvasW - 40 : 400;

    // Title
    const title = this.scene.add.text(cx, cy - (isMobile ? 80 : 130), 'Туманность Андромеды', {
      fontSize: titleSize, color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    menu.add(title);

    const title2 = this.scene.add.text(cx, cy - (isMobile ? 62 : 105), 'Новая Земля', {
      fontSize: titleSize, color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    menu.add(title2);

    const subtitle = this.scene.add.text(cx, cy - (isMobile ? 46 : 80), 'Выживание на планете динозавров', {
      fontSize: subtitleSize, color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1);
    menu.add(subtitle);

    // Divider
    const divider = this.scene.add.rectangle(cx, cy - (isMobile ? 32 : 60), dividerW, 1, 0x30363d);
    menu.add(divider);

    // Mode section title
    const modeLabel = this.scene.add.text(cx, cy - (isMobile ? 20 : 46), 'ВЫБЕРИ РЕЖИМ', {
      fontSize: modeLabelSize, color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    menu.add(modeLabel);

    // Buttons — vertical on mobile, horizontal on desktop
    const btnOffsetY = isMobile ? 20 : 0;
    const storyX = isMobile ? cx : cx - 120;
    const storyY = cy + btnOffsetY;
    const defenseX = isMobile ? cx : cx + 120;
    const defenseY = isMobile ? storyY + btnH + 12 : cy + btnOffsetY;

    // Story mode button
    const storyBtn = this.scene.add.container(storyX, storyY);
    const storyBg = this.scene.add.rectangle(0, 0, btnW, btnH, 0x16213e, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4488ff)
      .setInteractive({ useHandCursor: true });
    const storyIcon = this.scene.add.text(0, isMobile ? -14 : -20, '📖', {
      fontSize: isMobile ? '20px' : '24px',
    }).setOrigin(0.5).setDepth(1);
    const storyTitle = this.scene.add.text(0, isMobile ? 4 : 6, 'ИСТОРИЯ', {
      fontSize: isMobile ? '14px' : '16px', color: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    const storyDesc = this.scene.add.text(0, isMobile ? 18 : 26, 'Квесты и сюжет', {
      fontSize: isMobile ? '11px' : '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1);
    storyBtn.add([storyBg, storyIcon, storyTitle, storyDesc]);
    storyBtn.setSize(btnW, btnH);

    storyBg.on('pointerover', () => storyBg.setStrokeStyle(2, 0x88bbff));
    storyBg.on('pointerout', () => storyBg.setStrokeStyle(2, 0x4488ff));
    storyBg.on('pointerdown', () => {
      this.scene.time.delayedCall(0, () => callbacks.onStart('story', 'easy'));
    });
    menu.add(storyBtn);

    // Defense mode button
    const defenseBtn = this.scene.add.container(defenseX, defenseY);
    const defenseBg = this.scene.add.rectangle(0, 0, btnW, btnH, 0x16213e, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xff4444)
      .setInteractive({ useHandCursor: true });
    const defenseIcon = this.scene.add.text(0, isMobile ? -14 : -20, '⚔', {
      fontSize: isMobile ? '16px' : '20px',
    }).setOrigin(0.5);
    const defenseTitle = this.scene.add.text(0, isMobile ? 4 : 6, 'ОБОРОНА', {
      fontSize: isMobile ? '14px' : '16px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    const defenseDesc = this.scene.add.text(0, isMobile ? 18 : 26, 'Волны динозавров', {
      fontSize: isMobile ? '11px' : '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1);
    defenseBtn.add([defenseBg, defenseIcon, defenseTitle, defenseDesc]);
    defenseBtn.setSize(btnW, btnH);

    defenseBg.on('pointerover', () => defenseBg.setStrokeStyle(2, 0xff8888));
    defenseBg.on('pointerout', () => defenseBg.setStrokeStyle(2, 0xff4444));
    defenseBg.on('pointerdown', () => {
      this.showDifficulty(callbacks, 'defense');
    });
    menu.add(defenseBtn);

    // ── Multiplayer section ──
    const mpStartY = isMobile ? defenseY + btnH / 2 + 24 : cy + 60;
    const mpDivider = this.scene.add.rectangle(cx, mpStartY, dividerW, 1, 0x30363d);
    menu.add(mpDivider);

    const mpLabel = this.scene.add.text(cx, mpStartY + 14, 'МУЛЬТИПЛЕЕР', {
      fontSize: isMobile ? '12px' : '14px', color: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.add(mpLabel);

    const mpBtnY = mpStartY + 40;
    const mpBtnW = isMobile ? 130 : 180;
    const mpBtnH = isMobile ? 44 : 56;

    // Host button
    const hostBtn = this.scene.add.container(isMobile ? cx : cx - 100, mpBtnY);
    const hostBg = this.scene.add.rectangle(0, 0, mpBtnW, mpBtnH, 0x1a3a1a, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x44ff44)
      .setInteractive({ useHandCursor: true });
    const hostIcon = this.scene.add.text(0, isMobile ? -8 : -10, '🎮', {
      fontSize: isMobile ? '14px' : '18px',
    }).setOrigin(0.5);
    const hostTitle = this.scene.add.text(0, isMobile ? 8 : 10, 'Создать игру', {
      fontSize: isMobile ? '11px' : '13px', color: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    hostBtn.add([hostBg, hostIcon, hostTitle]);
    hostBtn.setSize(mpBtnW, mpBtnH);
    hostBg.on('pointerover', () => hostBg.setStrokeStyle(2, 0x88ff88));
    hostBg.on('pointerout', () => hostBg.setStrokeStyle(2, 0x44ff44));
    hostBg.on('pointerdown', () => {
      if (callbacks.onHostGame) callbacks.onHostGame();
    });
    menu.add(hostBtn);

    // Join button
    const joinBtn = this.scene.add.container(isMobile ? cx : cx + 100, mpBtnY);
    const joinBg = this.scene.add.rectangle(0, 0, mpBtnW, mpBtnH, 0x1a1a3a, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4488ff)
      .setInteractive({ useHandCursor: true });
    const joinIcon = this.scene.add.text(0, isMobile ? -8 : -10, '🔗', {
      fontSize: isMobile ? '14px' : '18px',
    }).setOrigin(0.5);
    const joinTitle = this.scene.add.text(0, isMobile ? 8 : 10, 'Присоединиться', {
      fontSize: isMobile ? '11px' : '13px', color: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    joinBtn.add([joinBg, joinIcon, joinTitle]);
    joinBtn.setSize(mpBtnW, mpBtnH);
    joinBg.on('pointerover', () => joinBg.setStrokeStyle(2, 0x88bbff));
    joinBg.on('pointerout', () => joinBg.setStrokeStyle(2, 0x4488ff));
    joinBg.on('pointerdown', () => {
      this.showJoinDialog(callbacks);
    });
    menu.add(joinBtn);

    // Replay section
    const replayStartY = isMobile ? defenseY + btnH / 2 + 16 : cy + 60;
    const replayDivider = this.scene.add.rectangle(cx, replayStartY, dividerW, 1, 0x30363d);
    menu.add(replayDivider);

    const replayLabel = this.scene.add.text(cx, replayStartY + 16, 'Replay', {
      fontSize: isMobile ? '11px' : '13px', color: '#58a6ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    menu.add(replayLabel);

    const savedReplays = ReplayRecorder.loadAll();
    let replayY = replayStartY + 32;

    if (savedReplays.length > 0) {
      const maxShow = isMobile ? 2 : 3;
      for (let i = 0; i < Math.min(savedReplays.length, maxShow); i++) {
        const r = savedReplays[i];
        const days = Math.floor(r.totalTicks / 100);
        const hours = Math.floor((r.totalTicks % 100) / (100 / 24));
        const label = `${r.name} (${days}d ${hours}h)`;

        const item = this.scene.add.text(cx, replayY, label, {
          fontSize: isMobile ? '10px' : '11px', color: '#c9d1d9', fontFamily: 'monospace',
          backgroundColor: '#21262d', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        item.on('pointerover', () => item.setColor('#58a6ff'));
        item.on('pointerout', () => item.setColor('#c9d1d9'));
        item.on('pointerdown', () => {
          const data = ReplayRecorder.loadById(r.id);
          if (data) this.scene.scene.start('ReplayScene', { replay: data });
        });
        menu.add(item);
        replayY += isMobile ? 16 : 18;
      }
    }

    const loadFileBtn = this.scene.add.text(cx, replayY + 4, '[Загрузить из файла]', {
      fontSize: isMobile ? '10px' : '11px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    loadFileBtn.on('pointerover', () => loadFileBtn.setColor('#58a6ff'));
    loadFileBtn.on('pointerout', () => loadFileBtn.setColor('#8b949e'));
    loadFileBtn.on('pointerdown', () => callbacks.onLoadReplay());
    menu.add(loadFileBtn);

    // Tutorial button
    const tutorialBtn = this.scene.add.text(cx, replayY + 22, '[Показать туториал]', {
      fontSize: isMobile ? '10px' : '11px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    tutorialBtn.on('pointerover', () => tutorialBtn.setColor('#58a6ff'));
    tutorialBtn.on('pointerout', () => tutorialBtn.setColor('#8b949e'));
    tutorialBtn.on('pointerdown', () => {
      localStorage.removeItem('colonySim_tutorialSeen');
      this.scene.scene.start('BootScene');
    });
    menu.add(tutorialBtn);

    this.container = menu;
  }

  private showDifficulty(callbacks: StartMenuCallbacks, mode: GameMode): void {
    if (!this.container) return;

    // Remove mode buttons, keep background
    this.container.removeAll(true);

    const L = getLayout();
    const cx = L.canvasW / 2;
    const cy = L.canvasH / 2;
    const isMobile = L.mode === 'mobile';

    // Re-add background
    const bg = this.scene.add.rectangle(cx, cy, L.canvasW, L.canvasH, 0x0d1117, 0.6);
    this.container.add(bg);

    const modeName = mode === 'story' ? 'ИСТОРИЯ' : 'ОБОРОНА';
    const modeColor = mode === 'story' ? '#4488ff' : '#ff4444';

    const title = this.scene.add.text(cx, cy - (isMobile ? 60 : 80), modeName, {
      fontSize: isMobile ? '18px' : '24px', color: modeColor, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    const diffLabel = this.scene.add.text(cx, cy - (isMobile ? 38 : 48), 'ВЫБЕРИ СЛОЖНОСТЬ', {
      fontSize: isMobile ? '12px' : '14px', color: '#58a6ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(diffLabel);

    const makeDiffButton = (label: string, desc: string, y: number, diff: 'easy' | 'hard') => {
      const btn = this.scene.add.text(cx, y, `${label}\n${desc}`, {
        fontSize: isMobile ? '13px' : '15px', color: '#c9d1d9', fontFamily: 'monospace',
        backgroundColor: '#21262d', padding: { x: isMobile ? 12 : 16, y: isMobile ? 8 : 10 }, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor(modeColor));
      btn.on('pointerout', () => btn.setColor('#c9d1d9'));
      btn.on('pointerdown', () => this.scene.time.delayedCall(0, () => callbacks.onStart(mode, diff)));
      this.container!.add(btn);
    };

    if (mode === 'defense') {
      makeDiffButton('Лёгкий', '10 волн. Ресурсы на старте.', cy - (isMobile ? 8 : 8), 'easy');
      makeDiffButton('Сложный', '15 волн. Меньше ресурсов.', cy + (isMobile ? 40 : 52), 'hard');
    }

    // Back button
    const backBtn = this.scene.add.text(cx, cy + (isMobile ? 90 : 120), '← Назад', {
      fontSize: isMobile ? '12px' : '13px', color: '#8b949e', fontFamily: 'monospace',
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

  private showJoinDialog(callbacks: StartMenuCallbacks): void {
    if (!this.container) return;
    this.container.removeAll(true);

    const L = getLayout();
    const cx = L.canvasW / 2;
    const cy = L.canvasH / 2;
    const isMobile = L.mode === 'mobile';

    const bg = this.scene.add.rectangle(cx, cy, L.canvasW, L.canvasH, 0x0d1117, 0.8);
    this.container.add(bg);

    const title = this.scene.add.text(cx, cy - 60, 'ПРИСОЕДИНИТЬСЯ К ИГРЕ', {
      fontSize: isMobile ? '16px' : '20px', color: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    const label = this.scene.add.text(cx, cy - 20, 'Адрес сервера:', {
      fontSize: isMobile ? '12px' : '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(label);

    // Input field
    const inputBg = this.scene.add.rectangle(cx, cy + 20, 280, 36, 0x21262d)
      .setStrokeStyle(1, 0x30363d);
    this.container.add(inputBg);

    const defaultUrl = `http://${window.location.hostname || '192.168.43.1'}:3000`;
    const inputText = this.scene.add.text(cx, cy + 20, defaultUrl, {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(inputText);

    // Use Phaser DOM element for actual input
    const input = this.scene.add.dom(cx, cy + 20).createElement('input')
      .setOrigin(0.5)
      .node as HTMLInputElement;
    input.value = defaultUrl;
    input.style.cssText = `
      width: 260px; padding: 6px 10px; font: 14px monospace;
      background: #0d1117; color: #c9d1d9; border: 1px solid #30363d;
      border-radius: 4px; outline: none; text-align: center;
    `;
    this.container.add(input as any);

    // Connect button
    const connectBtn = this.scene.add.text(cx, cy + 70, '[ ПОДКЛЮЧИТЬСЯ ]', {
      fontSize: isMobile ? '14px' : '16px', color: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    connectBtn.on('pointerover', () => connectBtn.setColor('#88ff88'));
    connectBtn.on('pointerout', () => connectBtn.setColor('#44ff44'));
    connectBtn.on('pointerdown', () => {
      const url = input.value.trim();
      if (url && callbacks.onJoinGame) {
        callbacks.onJoinGame(url);
      }
    });
    this.container.add(connectBtn);

    // Back button
    const backBtn = this.scene.add.text(cx, cy + 110, '← Назад', {
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
