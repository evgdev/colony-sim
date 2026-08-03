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
    const dividerW = isMobile ? L.canvasW - 40 : 400;

    // Title
    const titleY = isMobile ? 60 : cy - 130;
    const title = this.scene.add.text(cx, titleY, 'Туманность Андромеды', {
      fontSize: titleSize, color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    menu.add(title);

    const title2 = this.scene.add.text(cx, titleY + (isMobile ? 22 : 25), 'Новая Земля', {
      fontSize: titleSize, color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);
    menu.add(title2);

    const subtitle = this.scene.add.text(cx, titleY + (isMobile ? 44 : 50), 'Выживание на планете динозавров', {
      fontSize: subtitleSize, color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1);
    menu.add(subtitle);

    // Divider
    const dividerY = titleY + (isMobile ? 62 : 70);
    const divider = this.scene.add.rectangle(cx, dividerY, dividerW, 1, 0x30363d);
    menu.add(divider);

    // ── Multiplayer buttons ──
    const mpLabel = this.scene.add.text(cx, dividerY + 20, 'МУЛЬТИПЛЕЕР', {
      fontSize: isMobile ? '14px' : '18px', color: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    menu.add(mpLabel);

    const btnW = isMobile ? 200 : 210;
    const btnH = isMobile ? 50 : 60;
    const btnGap = 12;
    const startY = dividerY + 60;

    // Host button
    const hostBtn = this.scene.add.container(cx, startY);
    const hostBg = this.scene.add.rectangle(0, 0, btnW, btnH, 0x1a3a1a, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x44ff44)
      .setInteractive({ useHandCursor: true });
    const hostIcon = this.scene.add.text(0, -10, '🎮', {
      fontSize: '18px',
    }).setOrigin(0.5);
    const hostTitle = this.scene.add.text(0, 10, 'Создать игру', {
      fontSize: isMobile ? '14px' : '16px', color: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    hostBtn.add([hostBg, hostIcon, hostTitle]);
    hostBtn.setSize(btnW, btnH);
    hostBg.on('pointerover', () => hostBg.setStrokeStyle(2, 0x88ff88));
    hostBg.on('pointerout', () => hostBg.setStrokeStyle(2, 0x44ff44));
    hostBg.on('pointerdown', () => {
      if (callbacks.onHostGame) callbacks.onHostGame();
    });
    menu.add(hostBtn);

    // Join button
    const joinBtn = this.scene.add.container(cx, startY + btnH + btnGap);
    const joinBg = this.scene.add.rectangle(0, 0, btnW, btnH, 0x1a1a3a, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4488ff)
      .setInteractive({ useHandCursor: true });
    const joinIcon = this.scene.add.text(0, -10, '🔗', {
      fontSize: '18px',
    }).setOrigin(0.5);
    const joinTitle = this.scene.add.text(0, 10, 'Присоединиться', {
      fontSize: isMobile ? '14px' : '16px', color: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    joinBtn.add([joinBg, joinIcon, joinTitle]);
    joinBtn.setSize(btnW, btnH);
    joinBg.on('pointerover', () => joinBg.setStrokeStyle(2, 0x88bbff));
    joinBg.on('pointerout', () => joinBg.setStrokeStyle(2, 0x4488ff));
    joinBg.on('pointerdown', () => {
      this.showJoinDialog(callbacks);
    });
    menu.add(joinBtn);

    // Single player section (below multiplayer)
    const spY = startY + (btnH + btnGap) * 2 + 20;
    const spDivider = this.scene.add.rectangle(cx, spY, dividerW, 1, 0x30363d);
    menu.add(spDivider);

    const spLabel = this.scene.add.text(cx, spY + 16, 'ОДИНОЧНАЯ ИГРА', {
      fontSize: isMobile ? '12px' : '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5);
    menu.add(spLabel);

    // Story button
    const storyBtn = this.scene.add.container(cx, spY + 50);
    const storyBg = this.scene.add.rectangle(0, 0, btnW, btnH - 10, 0x16213e, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x4488ff)
      .setInteractive({ useHandCursor: true });
    const storyTitle = this.scene.add.text(0, 0, '📖 История', {
      fontSize: isMobile ? '13px' : '15px', color: '#4488ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    storyBtn.add([storyBg, storyTitle]);
    storyBtn.setSize(btnW, btnH - 10);
    storyBg.on('pointerover', () => storyBg.setStrokeStyle(2, 0x88bbff));
    storyBg.on('pointerout', () => storyBg.setStrokeStyle(2, 0x4488ff));
    storyBg.on('pointerdown', () => {
      this.scene.time.delayedCall(0, () => callbacks.onStart('story', 'easy'));
    });
    menu.add(storyBtn);

    // Defense button
    const defBtn = this.scene.add.container(cx, spY + 50 + btnH - 10 + 8);
    const defBg = this.scene.add.rectangle(0, 0, btnW, btnH - 10, 0x16213e, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xff4444)
      .setInteractive({ useHandCursor: true });
    const defTitle = this.scene.add.text(0, 0, '⚔ Оборона', {
      fontSize: isMobile ? '13px' : '15px', color: '#ff4444', fontFamily: 'monospace',
    }).setOrigin(0.5);
    defBtn.add([defBg, defTitle]);
    defBtn.setSize(btnW, btnH - 10);
    defBg.on('pointerover', () => defBg.setStrokeStyle(2, 0xff8888));
    defBg.on('pointerout', () => defBg.setStrokeStyle(2, 0xff4444));
    defBg.on('pointerdown', () => {
      this.scene.time.delayedCall(0, () => callbacks.onStart('defense', 'easy'));
    });
    menu.add(defBtn);

    this.container = menu;
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

    const title = this.scene.add.text(cx, cy - 50, 'ПРИСОЕДИНИТЬСЯ К ИГРЕ', {
      fontSize: isMobile ? '16px' : '20px', color: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    const defaultUrl = `http://${window.location.hostname || '192.168.43.1'}:3001`;

    const addrLabel = this.scene.add.text(cx, cy - 10, 'Сервер:', {
      fontSize: isMobile ? '12px' : '14px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(addrLabel);

    const addrText = this.scene.add.text(cx, cy + 12, defaultUrl, {
      fontSize: isMobile ? '13px' : '15px', color: '#c9d1d9', fontFamily: 'monospace',
      backgroundColor: '#21262d', padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    this.container.add(addrText);

    // Connect button
    const connectBtn = this.scene.add.text(cx, cy + 60, '[ ПОДКЛЮЧИТЬСЯ ]', {
      fontSize: isMobile ? '16px' : '18px', color: '#44ff44', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#1a3a1a', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    connectBtn.on('pointerover', () => connectBtn.setColor('#88ff88'));
    connectBtn.on('pointerout', () => connectBtn.setColor('#44ff44'));
    connectBtn.on('pointerdown', () => {
      if (callbacks.onJoinGame) {
        callbacks.onJoinGame(defaultUrl);
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
