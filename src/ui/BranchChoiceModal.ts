import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { StoryBranch } from '../data/storyBranch';

const PANEL_W = 600;
const PANEL_H = 350;
const PANEL_X = (CANVAS_WIDTH - PANEL_W) / 2;
const PANEL_Y = (CANVAS_HEIGHT - PANEL_H) / 2;

export class BranchChoiceModal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private onChoice: (branch: StoryBranch) => void = () => {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(onChoice: (branch: StoryBranch) => void): void {
    this.hide();
    this.visible = true;
    this.onChoice = onChoice;

    this.container = this.scene.add.container(0, 0).setDepth(200);

    // Dark backdrop
    this.container.add(
      this.scene.add.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.85)
    );

    // Panel bg
    this.container.add(
      this.scene.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x1a2233, 1)
        .setOrigin(0).setStrokeStyle(2, 0x4488cc)
    );

    // Title
    this.container.add(this.scene.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 20,
      '── Choice of Path ──', {
      fontSize: '18px', color: '#66bbff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Description
    this.container.add(this.scene.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 50,
      'Two sets of instructions found on the antenna debris.\nWhich path will you choose?', {
      fontSize: '14px', color: '#c9d1d9', fontFamily: 'monospace',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0));

    // Warrior option
    const warriorBg = this.scene.add.rectangle(PANEL_X + 20, PANEL_Y + 110, 260, 180, 0x2a1a1a, 1)
      .setOrigin(0).setStrokeStyle(2, 0xcc4444)
      .setInteractive({ useHandCursor: true });
    warriorBg.on('pointerover', () => warriorBg.setFillStyle(0x3a2222));
    warriorBg.on('pointerout', () => warriorBg.setFillStyle(0x2a1a1a));
    warriorBg.on('pointerdown', () => this.selectBranch('warrior'));
    this.container.add(warriorBg);

    this.container.add(this.scene.add.text(PANEL_X + 150, PANEL_Y + 130, '⚔️  WARRIOR', {
      fontSize: '16px', color: '#ff6644', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    this.container.add(this.scene.add.text(PANEL_X + 150, PANEL_Y + 160,
      '"Take the weapons.\nWe must defend ourselves."', {
      fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    this.container.add(this.scene.add.text(PANEL_X + 150, PANEL_Y + 210,
      'Build turrets and walls.\nFight dinosaurs in waves.\nDevelop military power.', {
      fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    // Scientist option
    const scientistBg = this.scene.add.rectangle(PANEL_X + 320, PANEL_Y + 110, 260, 180, 0x1a2a1a, 1)
      .setOrigin(0).setStrokeStyle(2, 0x44cc44)
      .setInteractive({ useHandCursor: true });
    scientistBg.on('pointerover', () => scientistBg.setFillStyle(0x223a22));
    scientistBg.on('pointerout', () => scientistBg.setFillStyle(0x1a2a1a));
    scientistBg.on('pointerdown', () => this.selectBranch('scientist'));
    this.container.add(scientistBg);

    this.container.add(this.scene.add.text(PANEL_X + 450, PANEL_Y + 130, '🔬  SCIENTIST', {
      fontSize: '16px', color: '#44cc44', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    this.container.add(this.scene.add.text(PANEL_X + 450, PANEL_Y + 160,
      '"Take the equipment.\nWe must understand."', {
      fontSize: '12px', color: '#c9d1d9', fontFamily: 'monospace',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    this.container.add(this.scene.add.text(PANEL_X + 450, PANEL_Y + 210,
      'Study dinosaur behavior.\nMap territories.\nDiscover the island\'s secret.', {
      fontSize: '11px', color: '#8b949e', fontFamily: 'monospace',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    // Hint
    this.container.add(this.scene.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H - 20,
      'Choose wisely — this will shape your journey.', {
      fontSize: '11px', color: '#667788', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5));
  }

  hide(): void {
    this.container?.destroy();
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  private selectBranch(branch: StoryBranch): void {
    this.onChoice(branch);
    this.hide();
  }
}
