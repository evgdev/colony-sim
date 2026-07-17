import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '../../config';
import { MenuItem } from './MenuItem';

const ITEM_HEIGHT = 28;
const MENU_PADDING = 4;
const MIN_WIDTH = 140;
const MAX_WIDTH = 220;

export class ContextMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private items: MenuItem[] = [];
  private bg!: Phaser.GameObjects.Rectangle;
  private itemObjects: Phaser.GameObjects.Container[] = [];
  private hoverHighlight!: Phaser.GameObjects.Rectangle;
  private depth: number;

  constructor(scene: Phaser.Scene, depth: number = 50) {
    this.scene = scene;
    this.depth = depth;
    this.container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
  }

  show(items: MenuItem[], x: number, y: number): void {
    this.hide();
    this.items = items;
    this.itemObjects = [];

    if (items.length === 0) return;

    const menuItems = items.filter(i => !i.separator);
    if (menuItems.length === 0) return;

    const contentItems = items.filter(i => !i.separator);
    const totalHeight = items.length * ITEM_HEIGHT + MENU_PADDING * 2;

    const labelWidths = menuItems.map(item => {
      const txt = this.scene.add.text(0, 0, item.label ?? '', {
        fontSize: '13px', fontFamily: 'monospace',
      });
      const w = txt.width;
      txt.destroy();
      return w;
    });
    const maxLabelWidth = Math.max(...labelWidths, MIN_WIDTH);
    const menuWidth = Math.min(maxLabelWidth + 32, MAX_WIDTH);

    let px = x;
    let py = y;
    if (px + menuWidth > CANVAS_WIDTH) px = CANVAS_WIDTH - menuWidth - 4;
    if (py + totalHeight > CANVAS_HEIGHT) py = CANVAS_HEIGHT - totalHeight - 4;
    if (px < 0) px = 4;
    if (py < 0) py = 4;

    this.container.setPosition(px, py);

    this.bg = this.scene.add.rectangle(0, 0, menuWidth, totalHeight, 0x0d1117, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.panelBorder);
    this.container.add(this.bg);

    this.hoverHighlight = this.scene.add.rectangle(0, 0, menuWidth - 4, ITEM_HEIGHT, 0x58a6ff, 0.15)
      .setOrigin(0)
      .setVisible(false);
    this.container.add(this.hoverHighlight);

    let curY = MENU_PADDING;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.separator) {
        const sepLine = this.scene.add.rectangle(
          MENU_PADDING, curY + ITEM_HEIGHT / 2,
          menuWidth - MENU_PADDING * 2, 1, COLORS.panelBorder, 0.5
        ).setOrigin(0);
        this.container.add(sepLine);
        curY += ITEM_HEIGHT;
        continue;
      }

      const itemContainer = this.scene.add.container(0, curY);

      const hitArea = this.scene.add.rectangle(0, 0, menuWidth, ITEM_HEIGHT, 0x000000, 0)
        .setOrigin(0)
        .setInteractive({ useHandCursor: !item.disabled });

      const textColor = item.disabled ? '#484f58' : (item.danger ? '#f85149' : '#c9d1d9');
      const iconStr = item.icon ? `${item.icon}  ` : '';
      const labelText = this.scene.add.text(12, ITEM_HEIGHT / 2, `${iconStr}${item.label ?? ''}`, {
        fontSize: '13px', color: textColor, fontFamily: 'monospace',
      }).setOrigin(0, 0.5);

      itemContainer.add([hitArea, labelText]);

      if (!item.disabled && item.action) {
        const idx = i;
        hitArea.on('pointerover', () => {
          const itemY = itemContainer.y;
          this.hoverHighlight.setPosition(2, itemY);
          this.hoverHighlight.setVisible(true);
          labelText.setColor(item.danger ? '#ff7b72' : '#ffffff');
        });
        hitArea.on('pointerout', () => {
          this.hoverHighlight.setVisible(false);
          labelText.setColor(textColor);
        });
        hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event.stopPropagation();
          this.hide();
          item.action?.();
        });
      }

      this.container.add(itemContainer);
      this.itemObjects.push(itemContainer);
      curY += ITEM_HEIGHT;
    }

    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
    for (const obj of this.container.list) {
      if (obj !== this.bg && obj !== this.hoverHighlight) {
        obj.destroy();
      }
    }
    this.container.removeAll(false);
    this.itemObjects = [];
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.hide();
    this.container.destroy();
  }
}
