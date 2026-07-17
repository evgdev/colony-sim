import Phaser from 'phaser';
import { ContextMenu } from './menu/ContextMenu';
import { Tooltip, TooltipLine } from './menu/Tooltip';
import { MenuItem } from './menu/MenuItem';

export class MenuSystem {
  private scene: Phaser.Scene;
  private contextMenu: ContextMenu;
  private tooltip: Tooltip;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.contextMenu = new ContextMenu(scene, 50);
    this.tooltip = new Tooltip(scene, 45);
  }

  showContextMenu(items: MenuItem[], x: number, y: number): void {
    this.hideTooltip();
    this.contextMenu.show(items, x, y);
  }

  hideContextMenu(): void {
    this.contextMenu.hide();
  }

  isContextMenuVisible(): boolean {
    return this.contextMenu.isVisible();
  }

  showTooltip(lines: TooltipLine[], x: number, y: number): void {
    this.tooltip.show(lines, x, y);
  }

  hideTooltip(): void {
    this.tooltip.hide();
  }

  isTooltipVisible(): boolean {
    return this.tooltip.isVisible();
  }

  hideAll(): void {
    this.hideContextMenu();
    this.hideTooltip();
  }

  destroy(): void {
    this.contextMenu.destroy();
    this.tooltip.destroy();
  }
}
