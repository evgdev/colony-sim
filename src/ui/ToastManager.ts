import Phaser from 'phaser';
import { FIELD_X, FIELD_Y, FIELD_W, FIELD_H, COLORS } from '../config';

const TOAST_DURATION = 3500;
const FADE_DURATION = 400;

export class ToastManager {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private text!: Phaser.GameObjects.Text;
  private queue: string[] = [];
  private showing: boolean = false;
  private timer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const cx = FIELD_X + FIELD_W / 2;
    const cy = FIELD_Y + FIELD_H - 50;

    this.container = this.scene.add.container(cx, cy).setDepth(50).setAlpha(0);

    this.bg = this.scene.add.rectangle(0, 0, 400, 40, 0x0a0a2e, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(1, COLORS.panelBorder);
    this.container.add(this.bg);

    this.text = this.scene.add.text(0, 0, '', {
      fontSize: '14px',
      color: '#c9d1d9',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.text);
  }

  show(message: string): void {
    this.queue.push(message);
    if (!this.showing) {
      this.showNext();
    }
  }

  private showNext(): void {
    if (this.queue.length === 0) {
      this.showing = false;
      return;
    }

    this.showing = true;
    const msg = this.queue.shift()!;
    this.text.setText(msg);

    const textW = this.text.width + 40;
    this.bg.setSize(Math.max(400, textW), 40);

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: FADE_DURATION,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.timer = this.scene.time.delayedCall(TOAST_DURATION, () => {
          this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: FADE_DURATION,
            ease: 'Sine.easeOut',
            onComplete: () => {
              this.showNext();
            },
          });
        });
      },
    });
  }

  clear(): void {
    this.queue = [];
    if (this.timer) this.timer.destroy();
    this.showing = false;
    this.container.setAlpha(0);
  }
}
