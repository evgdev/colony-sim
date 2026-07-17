import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '../../config';

const PADDING = 8;
const MAX_WIDTH = 240;

export interface TooltipLine {
  text: string;
  color?: string;
  bold?: boolean;
}

export class Tooltip {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private textObjects: Phaser.GameObjects.Text[] = [];
  private depth: number;

  constructor(scene: Phaser.Scene, depth: number = 45) {
    this.scene = scene;
    this.depth = depth;
    this.container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
  }

  show(lines: TooltipLine[], x: number, y: number): void {
    this.hide();

    if (lines.length === 0) return;

    const textObjs: Phaser.GameObjects.Text[] = [];
    let totalHeight = PADDING;
    let maxWidth = 0;

    for (const line of lines) {
      const txt = this.scene.add.text(PADDING, totalHeight, line.text, {
        fontSize: '12px',
        color: line.color ?? '#c9d1d9',
        fontFamily: 'monospace',
        fontStyle: line.bold ? 'bold' : 'normal',
        wordWrap: { width: MAX_WIDTH - PADDING * 2 },
      });
      textObjs.push(txt);
      totalHeight += txt.height + 2;
      if (txt.width > maxWidth) maxWidth = txt.width;
    }

    totalHeight += PADDING - 2;
    const tooltipWidth = Math.min(maxWidth + PADDING * 2, MAX_WIDTH);

    let px = x + 12;
    let py = y - totalHeight - 4;
    if (px + tooltipWidth > CANVAS_WIDTH) px = CANVAS_WIDTH - tooltipWidth - 4;
    if (py < 0) py = y + 20;
    if (px < 0) px = 4;

    this.container.setPosition(px, py);

    this.bg = this.scene.add.rectangle(0, 0, tooltipWidth, totalHeight, 0x0d1117, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.panelBorder);
    this.container.add(this.bg);

    for (const txt of textObjs) {
      this.container.add(txt);
      this.textObjects.push(txt);
    }

    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
    this.container.removeAll(true);
    this.textObjects = [];
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.hide();
    this.container.destroy();
  }
}
