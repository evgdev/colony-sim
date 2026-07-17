import Phaser from 'phaser';
import { FIELD_X, FIELD_Y, FIELD_W, FIELD_H } from '../config';
import artifactsData from '../data/artifacts.json';

export class LabJournal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private isShowing = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const panelW = 460;
    const panelH = 400;
    const panelX = FIELD_X + (FIELD_W - panelW) / 2;
    const panelY = FIELD_Y + (FIELD_H - panelH) / 2;

    this.container = this.scene.add.container(0, 0).setDepth(90).setVisible(false);

    // Overlay
    const overlay = this.scene.add.rectangle(
      FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 0x000000, 0.6
    ).setOrigin(0).setInteractive();
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);

    // Panel background
    const bg = this.scene.add.rectangle(panelX, panelY, panelW, panelH, 0x0d1117, 0.98)
      .setOrigin(0).setStrokeStyle(2, 0x30363d);
    this.container.add(bg);

    // Accent line
    const accent = this.scene.add.rectangle(panelX, panelY, panelW, 3, 0x58a6ff).setOrigin(0);
    this.container.add(accent);

    // Title
    const title = this.scene.add.text(panelX + panelW / 2, panelY + 16, 'ЖУРНАЛ ИССЛЕДОВАНИЙ', {
      fontSize: '16px', color: '#58a6ff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Subtitle
    const subtitle = this.scene.add.text(panelX + panelW / 2, panelY + 38, 'Лаборатория — образцы для анализа', {
      fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
    }).setOrigin(0.5, 0);
    this.container.add(subtitle);

    // Scrollable content area (clipped by mask)
    const contentY = panelY + 58;
    const contentH = panelH - 100;
    const contentMask = this.scene.add.graphics();
    contentMask.fillStyle(0xffffff);
    contentMask.fillRect(panelX, contentY, panelW, contentH);
    contentMask.setVisible(false);

    const contentContainer = this.scene.add.container(0, 0);
    contentContainer.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, contentMask));
    this.container.add(contentContainer);

    // "No artifacts" placeholder
    const emptyText = this.scene.add.text(panelX + panelW / 2, contentY + 40, 'Пока нет образцов.\nПринесите артефакты из поля.', {
      fontSize: '13px', color: '#6e7681', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5, 0);
    this.container.add(emptyText);

    // Store references for update
    (this as any)._contentContainer = contentContainer;
    (this as any)._contentY = contentY;
    (this as any)._panelX = panelX;
    (this as any)._panelW = panelW;
    (this as any)._emptyText = emptyText;

    // Close button
    const closeBtn = this.scene.add.text(panelX + panelW - 16, panelY + panelH - 12, 'ЗАКРЫТЬ ✕', {
      fontSize: '13px', color: '#c9d1d9', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#c9d1d9'));
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);
  }

  show(lab: any): void {
    if (this.isShowing) return;
    this.isShowing = true;

    const analyzed: Map<string, number> = lab.analyzedArtifacts || new Map();
    const contentContainer = (this as any)._contentContainer;
    const contentY = (this as any)._contentY;
    const panelX = (this as any)._panelX;
    const panelW = (this as any)._panelW;
    const emptyText = (this as any)._emptyText;

    // Clear previous entries
    contentContainer.removeAll(true);

    if (analyzed.size === 0) {
      emptyText.setVisible(true);
      contentContainer.add(emptyText);
    } else {
      emptyText.setVisible(false);

      let yPos = contentY + 8;
      for (const [name, count] of analyzed) {
        const artDef = (artifactsData as any)[name];
        const icon = artDef?.icon || '?';
        const color = artDef?.color || '#cccccc';
        const desc = artDef?.description || 'Неизвестный образец';
        const effect = artDef?.effect || '';
        const value = artDef?.value || 0;

        // Card background
        const card = this.scene.add.rectangle(panelX + 12, yPos, panelW - 24, 64, 0x161b22, 0.9)
          .setOrigin(0).setStrokeStyle(1, 0x30363d);
        contentContainer.add(card);

        // Icon circle
        const iconCircle = this.scene.add.circle(panelX + 32, yPos + 22, 14,
          Phaser.Display.Color.HexStringToColor(color).color, 0.3);
        contentContainer.add(iconCircle);
        const iconText = this.scene.add.text(panelX + 32, yPos + 22, icon, {
          fontSize: '14px', color, fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5);
        contentContainer.add(iconText);

        // Name + count
        const nameText = this.scene.add.text(panelX + 56, yPos + 6, `${name} ×${count}`, {
          fontSize: '13px', color: '#e6edf3', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0, 0);
        contentContainer.add(nameText);

        // Description
        const descText = this.scene.add.text(panelX + 56, yPos + 24, desc, {
          fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
          wordWrap: { width: panelW - 80 },
        }).setOrigin(0, 0);
        contentContainer.add(descText);

        // Effect badge
        if (effect) {
          const effectLabels: Record<string, string> = {
            fogRadius: 'Обзор',
            maxHp: 'Здоровье',
            attackSpeed: 'Атака',
            storage: 'Хранилище',
          };
          const effectText = this.scene.add.text(panelX + panelW - 24, yPos + 10,
            `+${value} ${effectLabels[effect] || effect}`, {
              fontSize: '10px', color: '#3fb950', fontFamily: 'monospace',
            }).setOrigin(1, 0);
          contentContainer.add(effectText);
        }

        yPos += 72;
      }
    }

    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
  }

  hide(): void {
    if (!this.isShowing) return;
    this.isShowing = false;
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150,
      onComplete: () => this.container.setVisible(false),
    });
  }

  get isVisible(): boolean { return this.isShowing; }
}
