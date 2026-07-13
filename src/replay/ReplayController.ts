import Phaser from 'phaser';
import { FIELD_X, FIELD_Y, FIELD_W, FIELD_H, BOTTOM_HUD_Y, HUD_HEIGHT, COLORS, PANEL_X, PANEL_WIDTH } from '../config';
import { ReplayPlayer } from './ReplayPlayer';
import { ReplayRecorder } from './ReplayRecorder';
import { ReplayFile } from './ReplayTypes';

export class ReplayController {
  private scene: Phaser.Scene;
  private player: ReplayPlayer;
  private container!: Phaser.GameObjects.Container;
  private playPauseBtn!: Phaser.GameObjects.Text;
  private speedBtn!: Phaser.GameObjects.Text;
  private tickText!: Phaser.GameObjects.Text;
  private timelineFill!: Phaser.GameObjects.Rectangle;
  private timelineHandle!: Phaser.GameObjects.Arc;
  private dragging: boolean = false;
  private onSwitchReplay?: (replay: ReplayFile) => void;

  constructor(scene: Phaser.Scene, player: ReplayPlayer) {
    this.scene = scene;
    this.player = player;
  }

  setOnSwitchReplay(cb: (replay: ReplayFile) => void): void {
    this.onSwitchReplay = cb;
  }

  create(): void {
    const barY = BOTTOM_HUD_Y;
    const barH = HUD_HEIGHT;

    this.container = this.scene.add.container(0, 0).setDepth(20);

    const bg = this.scene.add.rectangle(FIELD_X, barY, FIELD_W, barH, COLORS.uiPanel, 0.95)
      .setOrigin(0);
    this.container.add(bg);

    const accent = this.scene.add.rectangle(FIELD_X, barY, FIELD_W, 2, 0xffd700, 0.5)
      .setOrigin(0);
    this.container.add(accent);

    const timelineX = FIELD_X + 10;
    const timelineY = barY + 40;
    const timelineW = FIELD_W - 20;

    const timelineBg = this.scene.add.rectangle(timelineX, timelineY, timelineW, 24, 0x333333)
      .setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(21);
    this.container.add(timelineBg);

    const seekToPointer = (pointer: Phaser.Input.Pointer) => {
      const progress = Phaser.Math.Clamp((pointer.x - timelineX) / timelineW, 0, 1);
      const targetTick = Math.floor(progress * this.player.getProgress().total);
      this.player.seekToTick(targetTick);
      this.updateUI();
    };

    timelineBg.on('pointerdown', seekToPointer);

    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '16px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 8, y: 4 },
    };

    const resetBtn = this.scene.add.text(FIELD_X + 10, barY + 10, '[<< Reset]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.player.seekToTick(0);
        this.player.setPaused(true);
        this.updateUI();
      });
    this.container.add(resetBtn);

    this.playPauseBtn = this.scene.add.text(FIELD_X + 110, barY + 10, '[Play]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.player.togglePause();
        this.updateUI();
      });
    this.container.add(this.playPauseBtn);

    this.speedBtn = this.scene.add.text(FIELD_X + 190, barY + 10, '[1x]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.player.cycleSpeed();
        this.updateUI();
      });
    this.container.add(this.speedBtn);

    const exitBtn = this.scene.add.text(FIELD_X + FIELD_W - 80, barY + 10, '[Exit]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.scene.start('BootScene');
      });
    this.container.add(exitBtn);

    const exportBtn = this.scene.add.text(FIELD_X + FIELD_W - 160, barY + 10, '[Export]', btnStyle)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.player.exportToFile();
      });
    this.container.add(exportBtn);

    this.timelineFill = this.scene.add.rectangle(timelineX, timelineY, 0, 8, 0xffd700)
      .setOrigin(0);
    this.container.add(this.timelineFill);

    this.timelineHandle = this.scene.add.circle(timelineX, timelineY + 4, 6, 0xffffff)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.container.add(this.timelineHandle);

    this.timelineHandle.on('dragstart', () => { this.dragging = true; });
    this.timelineHandle.on('drag', (pointer: Phaser.Input.Pointer) => {
      const progress = Phaser.Math.Clamp((pointer.x - timelineX) / timelineW, 0, 1);
      const targetTick = Math.floor(progress * this.player.getProgress().total);
      this.player.seekToTick(targetTick);
      this.updateUI();
    });
    this.timelineHandle.on('dragend', () => { this.dragging = false; });

    this.tickText = this.scene.add.text(timelineX, barY + 55, '', {
      fontSize: '12px', color: '#8b949e', fontFamily: 'monospace',
    });
    this.container.add(this.tickText);

    this.player.setOnTick(() => this.updateUI());

    this.createReplayList();
  }

  private createReplayList(): void {
    const listX = PANEL_X + 10;
    const listY = 220;
    const listW = PANEL_WIDTH - 20;

    const bg = this.scene.add.rectangle(listX, listY, listW, 300, COLORS.panelBg, 0.95)
      .setOrigin(0).setStrokeStyle(1, COLORS.panelBorder).setDepth(20);
    this.container.add(bg);

    const title = this.scene.add.text(listX + 8, listY + 8, '\u2500\u2500 Replays \u2500\u2500', {
      fontSize: '14px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(21);
    this.container.add(title);

    const replays = ReplayRecorder.loadAll();
    const itemStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
      backgroundColor: '#21262d', padding: { x: 6, y: 3 },
    };

    const maxItems = 8;
    for (let i = 0; i < Math.min(replays.length, maxItems); i++) {
      const replay = replays[i];
      const item = this.scene.add.text(listX + 8, listY + 30 + i * 24, replay.name, itemStyle)
        .setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(21);
      item.on('pointerover', () => item.setColor('#58a6ff'));
      item.on('pointerout', () => item.setColor('#c9d1d9'));
      item.on('pointerdown', () => {
        const data = ReplayRecorder.loadById(replay.id);
        if (data) this.onSwitchReplay?.(data);
      });
      this.container.add(item);
    }

    if (replays.length === 0) {
      const empty = this.scene.add.text(listX + 8, listY + 30, 'No replays in memory', {
        fontSize: '12px', color: '#8b949e', fontFamily: 'monospace',
      }).setDepth(21);
      this.container.add(empty);
    }
  }

  updateUI(): void {
    this.playPauseBtn.setText(this.player.isPaused() ? '[Play]' : '[Pause]');
    this.speedBtn.setText(`[${this.player.getPlaybackSpeed()}x]`);

    const { current, total } = this.player.getProgress();
    const progress = total > 0 ? current / total : 0;

    if (!this.dragging) {
      const timelineX = FIELD_X + 10;
      const timelineW = FIELD_W - 20;
      this.timelineFill.width = progress * timelineW;
      this.timelineHandle.x = timelineX + progress * timelineW;
    }

    const days = Math.floor(current / 100);
    const hours = Math.floor((current % 100) / (100 / 24));
    this.tickText.setText(`Tick: ${current} / ${total}  |  Day ${days} ${hours}h`);
  }

  destroy(): void {
    this.container?.destroy();
  }
}
