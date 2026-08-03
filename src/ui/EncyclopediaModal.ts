import Phaser from 'phaser';
import { getLayout } from './LayoutConfig';
import { Encyclopedia } from '../data/Encyclopedia';

const PANEL_W = 640;
const PANEL_H = 520;
const LIST_W = 210;
const LIST_H = PANEL_H - 52;
const ITEM_H = 28;
const SCROLLBAR_W = 22;

const RARITY_COLORS: Record<string, string> = {
  common: '#66cc66', uncommon: '#44aaff', rare: '#cc66ff', legendary: '#ffcc00',
};
const RARITY_LABELS: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary',
};
const HEIGHT_LABELS: Record<string, string> = {
  short: '0.5–3 m', medium: '3–15 m', tall: '15–80 m',
};
const ENCY_TEXTURE_MAP: Record<string, string> = {
  cycas: 'ency_cycas', treefern: 'ency_treefern', ginkgo: 'ency_ginkgo',
  palm: 'ency_palm', palm_tall: 'ency_sequoia', round: 'ency_sequoia',
  bush: 'ency_bush', fern: 'ency_fern', grass_tall: 'ency_horsetail',
  mushroom: 'ency_mushroom', nest: 'ency_nest', rock_l: 'ency_rock', rock_s: 'ency_rock',
};

export class EncyclopediaModal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private encyclopedia: Encyclopedia;
  private listContainer!: Phaser.GameObjects.Container;
  private detailContainer!: Phaser.GameObjects.Container;
  private selectedPlantId: string | null = null;
  private scrollY = 0;
  private allIds: string[] = [];
  private scrollbar!: Phaser.GameObjects.Rectangle;
  private inputHandler: any;
  private listX = 0;
  private listY = 0;
  private panelX = 0;
  private panelY = 0;
  private currentPanelW = PANEL_W;
  private currentPanelH = PANEL_H;
  private currentListW = LIST_W;
  private currentListH = LIST_H;

  // Drag state
  private isDragging = false;
  private isDraggingScrollbar = false;
  private dragStartPointerY = 0;
  private dragStartScrollY = 0;

  // Bound handlers for cleanup
  private boundOnPointerDown: (p: Phaser.Input.Pointer) => void;
  private boundOnPointerMove: (p: Phaser.Input.Pointer) => void;
  private boundOnPointerUp: (p: Phaser.Input.Pointer) => void;
  private boundOnWheel: (p: Phaser.Input.Pointer, _go: any, _dx: number, dy: number) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, encyclopedia: Encyclopedia) {
    this.scene = scene;
    this.encyclopedia = encyclopedia;

    // Pre-bind handlers
    this.boundOnPointerDown = (p: Phaser.Input.Pointer) => this.onPointerDown(p);
    this.boundOnPointerMove = (p: Phaser.Input.Pointer) => this.onPointerMove(p);
    this.boundOnPointerUp = (p: Phaser.Input.Pointer) => this.onPointerUp(p);
    this.boundOnWheel = (_p: any, _go: any, _dx: number, dy: number) => this.scroll(-dy * 24);
    this.boundOnKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  }

  show(): void {
    this.hide();
    this.visible = true;
    this.scrollY = 0;
    this.allIds = this.encyclopedia.getAllPlantIds();

    this.inputHandler = (this.scene as any).inputHandler;
    if (this.inputHandler) this.inputHandler.encyclopediaOpen = true;

    const L = getLayout();
    const CANVAS_WIDTH = L.canvasW;
    const CANVAS_HEIGHT = L.canvasH;

    // Use fullscreen on mobile, fixed size on desktop
    const isMobile = L.mode === 'mobile';
    this.currentPanelW = isMobile ? CANVAS_WIDTH - 16 : PANEL_W;
    this.currentPanelH = isMobile ? CANVAS_HEIGHT - 16 : PANEL_H;
    this.currentListW = isMobile ? Math.floor(this.currentPanelW * 0.45) : LIST_W;
    this.currentListH = this.currentPanelH - 52;

    this.panelX = (CANVAS_WIDTH - this.currentPanelW) / 2;
    this.panelY = (CANVAS_HEIGHT - this.currentPanelH) / 2;
    this.listX = this.panelX + 10;
    this.listY = this.panelY + 40;

    this.container = this.scene.add.container(0, 0).setDepth(200);

    // Dark backdrop
    this.container.add(
      this.scene.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.85)
    );

    // Panel bg
    this.container.add(
      this.scene.add.rectangle(this.panelX, this.panelY, this.currentPanelW, this.currentPanelH, 0x1a2233, 1)
        .setOrigin(0).setStrokeStyle(2, 0x4488cc)
    );

    // Title
    this.container.add(this.scene.add.text(this.panelX + this.currentPanelW / 2, this.panelY + 16,
      `── Encyclopedia (${this.encyclopedia.getDiscoveryCount()}/${this.encyclopedia.getTotalPlants()}) ──`, {
      fontSize: '16px', color: '#66bbff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Close button
    const closeBtn = this.scene.add.text(this.panelX + this.currentPanelW - 28, this.panelY + 8, '✕', {
      fontSize: '20px', color: '#ff5555', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', () => closeBtn.setColor('#ff9999'))
      .on('pointerout', () => closeBtn.setColor('#ff5555'));
    this.container.add(closeBtn);

    // Scroll up button
    const upBtn = this.scene.add.text(this.listX + this.currentListW - SCROLLBAR_W - 4, this.listY + 2, '▲', {
      fontSize: '12px', color: '#5599cc', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scroll(-ITEM_H * 3))
      .on('pointerover', () => upBtn.setColor('#88ccff'))
      .on('pointerout', () => upBtn.setColor('#5599cc'));
    this.container.add(upBtn);

    // Scroll down button
    const downBtn = this.scene.add.text(this.listX + this.currentListW - SCROLLBAR_W - 4, this.listY + this.currentListH - 16, '▼', {
      fontSize: '12px', color: '#5599cc', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scroll(ITEM_H * 3))
      .on('pointerover', () => downBtn.setColor('#88ccff'))
      .on('pointerout', () => downBtn.setColor('#5599cc'));
    this.container.add(downBtn);

    // List panel bg
    this.container.add(
      this.scene.add.rectangle(this.listX, this.listY, this.currentListW, this.currentListH, 0x1e2a3a, 1)
        .setOrigin(0).setStrokeStyle(1, 0x335577)
    );

    // List mask
    const maskGfx = this.scene.add.graphics().setVisible(false);
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(this.listX + 2, this.listY + 2, this.currentListW - SCROLLBAR_W - 6, this.currentListH - 4);
    const mask = new Phaser.Display.Masks.GeometryMask(this.scene, maskGfx);

    // Scrollbar
    this.scrollbar = this.scene.add.rectangle(
      this.listX + this.currentListW - SCROLLBAR_W / 2 - 2, this.listY + 4,
      SCROLLBAR_W, 30, 0x5599cc, 0.9
    ).setOrigin(0.5, 0).setDepth(201).setInteractive({ useHandCursor: true });
    this.scrollbar.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDraggingScrollbar = true;
      this.dragStartPointerY = p.y;
      this.dragStartScrollY = this.scrollY;
      p.event.stopPropagation();
    });
    this.container.add(this.scrollbar);

    // List container
    this.listContainer = this.scene.add.container(this.listX + 4, this.listY + 4);
    this.listContainer.setMask(mask);
    this.container.add(this.listContainer);

    // Detail panel bg
    const detailX = this.panelX + this.currentListW + 14;
    const detailW = this.currentPanelW - this.currentListW - 26;
    this.container.add(
      this.scene.add.rectangle(detailX, this.listY, detailW, this.currentListH, 0x1e2a3a, 1)
        .setOrigin(0).setStrokeStyle(1, 0x335577)
    );

    this.detailContainer = this.scene.add.container(detailX + 4, this.listY + 8);
    this.container.add(this.detailContainer);

    this.renderList();
    this.renderDetail(null);
    this.updateScrollbar();

    // Register input handlers
    this.scene.input.on('pointerdown', this.boundOnPointerDown);
    this.scene.input.on('pointermove', this.boundOnPointerMove);
    this.scene.input.on('pointerup', this.boundOnPointerUp);
    this.scene.input.on('wheel', this.boundOnWheel);

    // Keyboard — use DOM events to avoid Phaser capture issues
    window.addEventListener('keydown', this.boundOnKeyDown);
  }

  hide(): void {
    this.scene.input.off('pointerdown', this.boundOnPointerDown);
    this.scene.input.off('pointermove', this.boundOnPointerMove);
    this.scene.input.off('pointerup', this.boundOnPointerUp);
    this.scene.input.off('wheel', this.boundOnWheel);
    window.removeEventListener('keydown', this.boundOnKeyDown);

    if (this.inputHandler) {
      this.inputHandler.encyclopediaOpen = false;
      this.inputHandler = undefined;
    }
    this.container?.destroy();
    this.visible = false;
    this.selectedPlantId = null;
    this.isDragging = false;
    this.isDraggingScrollbar = false;
  }

  isVisible(): boolean { return this.visible; }

  private isInsideList(x: number, y: number): boolean {
    return x >= this.listX && x <= this.listX + this.currentListW && y >= this.listY && y <= this.listY + this.currentListH;
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (!this.visible) return;
    // Start drag from anywhere inside the list area
    if (this.isInsideList(p.x, p.y)) {
      this.isDragging = true;
      this.dragStartPointerY = p.y;
      this.dragStartScrollY = this.scrollY;
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (!this.visible) return;

    if (this.isDraggingScrollbar) {
      const totalH = this.allIds.length * ITEM_H;
      const visH = this.currentListH - 8;
      const maxScroll = Math.max(0, totalH - visH);
      if (maxScroll <= 0) return;

      const barH = Math.max(30, (visH / totalH) * visH);
      const trackH = visH - barH;
      const dy = p.y - this.dragStartPointerY;
      const scrollDelta = (dy / trackH) * maxScroll;
      this.scrollY = Math.max(0, Math.min(maxScroll, this.dragStartScrollY + scrollDelta));
      this.renderList();
      this.updateScrollbar();
      return;
    }

    if (this.isDragging) {
      const dy = p.y - this.dragStartPointerY;
      // Only scroll if moved enough (prevents accidental scroll on tap)
      if (Math.abs(dy) > 4) {
        this.scroll(this.dragStartScrollY - dy);
      }
    }
  }

  private onPointerUp(_p: Phaser.Input.Pointer) {
    this.isDragging = false;
    this.isDraggingScrollbar = false;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.visible) return;
    if (e.key === 'Escape') { this.hide(); return; }
    if (e.key === 'PageUp') { this.scroll(-100); return; }
    if (e.key === 'PageDown') { this.scroll(100); return; }
    if (e.key === 'ArrowUp') { this.scroll(-ITEM_H * 2); return; }
    if (e.key === 'ArrowDown') { this.scroll(ITEM_H * 2); return; }
    if (e.key === 'Home') { this.scrollY = 0; this.renderList(); this.updateScrollbar(); return; }
    if (e.key === 'End') {
      const max = Math.max(0, this.allIds.length * ITEM_H - (this.currentListH - 8));
      this.scrollY = max; this.renderList(); this.updateScrollbar(); return;
    }
  }

  private scroll(delta: number) {
    const totalH = this.allIds.length * ITEM_H;
    const max = Math.max(0, totalH - (this.currentListH - 8));
    this.scrollY = Math.max(0, Math.min(max, this.scrollY + delta));
    this.renderList();
    this.updateScrollbar();
  }

  private updateScrollbar() {
    const totalH = this.allIds.length * ITEM_H;
    const visH = this.currentListH - 8;
    if (totalH <= visH) { this.scrollbar.setVisible(false); return; }
    this.scrollbar.setVisible(true);
    const barH = Math.max(30, (visH / totalH) * visH);
    const maxScroll = totalH - visH;
    const barY = this.listY + 4 + (this.scrollY / maxScroll) * (visH - barH);
    this.scrollbar.setSize(SCROLLBAR_W, barH);
    this.scrollbar.setPosition(this.listX + this.currentListW - SCROLLBAR_W / 2 - 2, barY);
  }

  private renderList() {
    this.listContainer.removeAll(true);
    const startY = -this.scrollY;

    for (let i = 0; i < this.allIds.length; i++) {
      const plantId = this.allIds[i];
      const itemY = startY + i * ITEM_H;
      if (itemY + ITEM_H < -10 || itemY > this.currentListH) continue;

      const discovered = this.encyclopedia.isDiscovered(plantId);
      const info = this.encyclopedia.getPlantInfo(plantId);
      if (!info) continue;

      const isSelected = this.selectedPlantId === plantId;
      const w = this.currentListW - SCROLLBAR_W - 12;

      const itemBg = this.scene.add.rectangle(0, itemY, w, ITEM_H - 2,
        isSelected ? 0x2a4a6a : 0x141e2a, 1)
        .setOrigin(0).setStrokeStyle(1, isSelected ? 0x66aaff : 0x2a3a4a)
        .setInteractive({ useHandCursor: discovered });

      if (discovered) {
        itemBg.on('pointerdown', (p: Phaser.Input.Pointer) => {
          this.selectedPlantId = plantId;
          this.renderList();
          this.renderDetail(plantId);
          // Start drag from item tap too (for drag-to-scroll)
          this.isDragging = true;
          this.dragStartPointerY = p.y;
          this.dragStartScrollY = this.scrollY;
        });
        itemBg.on('pointerover', () => {
          if (this.selectedPlantId !== plantId) itemBg.setFillStyle(0x1a3050);
        });
        itemBg.on('pointerout', () => {
          if (this.selectedPlantId !== plantId) itemBg.setFillStyle(0x141e2a);
        });
      }

      const name = discovered ? info.name : '???';
      const color = discovered ? (RARITY_COLORS[info.rarity] ?? '#aabbcc') : '#556677';
      const nameText = this.scene.add.text(8, itemY + ITEM_H / 2 - 1, name, {
        fontSize: '13px', color, fontFamily: 'monospace',
      }).setOrigin(0, 0.5);

      this.listContainer.add([itemBg, nameText]);
    }
  }

  private renderDetail(plantId: string | null) {
    this.detailContainer.removeAll(true);
    if (!plantId) {
      this.detailContainer.add(this.scene.add.text(0, 100, 'Select a plant\nfrom the list', {
        fontSize: '14px', color: '#556677', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5, 0).setPosition((this.currentPanelW - 236) / 2, 100));
      return;
    }

    const info = this.encyclopedia.getPlantInfo(plantId);
    if (!info) return;

    let y = 8;
    this.detailContainer.add(this.scene.add.text(0, y, info.name, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }));
    y += 30;

    const rc = RARITY_COLORS[info.rarity] ?? '#aabbcc';
    const rl = RARITY_LABELS[info.rarity] ?? info.rarity;
    const rbg = this.scene.add.rectangle(0, y, 100, 22,
      Phaser.Display.Color.HexStringToColor(rc).color, 0.4)
      .setOrigin(0).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(rc).color);
    this.detailContainer.add([rbg, this.scene.add.text(50, y + 11, rl, {
      fontSize: '12px', color: rc, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)]);
    y += 30;

    const prefix = ENCY_TEXTURE_MAP[info.textureType] ?? `ency_${info.textureType}`;
    let tex = `${prefix}_0`;
    if (!this.scene.textures.exists(tex)) tex = `${prefix}_1`;
    if (!this.scene.textures.exists(tex)) tex = `${prefix}_0`;
    if (this.scene.textures.exists(tex)) {
      this.detailContainer.add(this.scene.add.image(100, y + 55, tex)
        .setDisplaySize(200, 200).setOrigin(0.5));
    }
    y += 210;

    const lines = [
      { l: 'Height', v: HEIGHT_LABELS[info.height] ?? info.height },
      { l: 'Biome', v: info.biomes.join(', ') },
      { l: 'Near water', v: info.nearWater ? 'Yes' : 'No' },
    ];
    if (info.harvestable && info.harvestDrop)
      lines.push({ l: 'Resource', v: `${info.harvestDrop.resource} x${info.harvestDrop.amount}` });

    for (const line of lines) {
      this.detailContainer.add(this.scene.add.text(0, y, `${line.l}:`, {
        fontSize: '13px', color: '#8899aa', fontFamily: 'monospace',
      }));
      this.detailContainer.add(this.scene.add.text(110, y, line.v, {
        fontSize: '13px', color: '#ddeeff', fontFamily: 'monospace',
      }));
      y += 20;
    }

    y += 10;
    this.detailContainer.add(this.scene.add.text(0, y, 'Description:', {
      fontSize: '13px', color: '#8899aa', fontFamily: 'monospace',
    }));
    y += 18;
    this.detailContainer.add(this.scene.add.text(0, y, info.description, {
      fontSize: '13px', color: '#ddeeff', fontFamily: 'monospace',
      wordWrap: { width: this.currentPanelW - 250 }, lineSpacing: 4,
    }));
  }
}
