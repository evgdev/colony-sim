import Phaser from 'phaser';
import { FIELD_X, FIELD_Y, FIELD_W, FIELD_H, COLORS } from '../config';
import { DialogueLine, Dialogue } from '../systems/QuestManager';

const SPEAKER_CONFIG: Record<string, { name: string; color: number; title: string; texKey: string }> = {
  engineer:  { name: 'Алексей', color: 0x4488ff, title: 'Инженер',  texKey: 'hero_engineer' },
  biologist: { name: 'Марина',  color: 0x44ff44, title: 'Биолог',   texKey: 'hero_biologist' },
  pilot:     { name: 'Дмитрий', color: 0xffaa00, title: 'Пилот',    texKey: 'hero_pilot' },
  narrator:  { name: '',        color: 0xd4a017, title: '',          texKey: '' },
};

export class DialogueBox {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private portraitImage!: Phaser.GameObjects.Image;
  private speakerName!: Phaser.GameObjects.Text;
  private speakerTitle!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private continueBtn!: Phaser.GameObjects.Text;
  private skipBtn!: Phaser.GameObjects.Text;
  private hintLine!: Phaser.GameObjects.Text;
  private lines: DialogueLine[] = [];
  private currentLine: number = 0;
  private isShowing: boolean = false;
  private onFinished?: () => void;
  private onShow?: () => void;
  private fullText: string = '';
  private displayedChars: number = 0;
  private charRevealTimer: number = 0;
  private charRevealDelay: number = 30; // ms per character

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const boxW = Math.min(720, FIELD_W - 20);
    const boxH = 180;
    const boxX = FIELD_X + (FIELD_W - boxW) / 2;
    const boxY = FIELD_Y + FIELD_H - boxH - 16;

    this.container = this.scene.add.container(0, 0).setDepth(80).setVisible(false);

    // Transparent blocker on game field only — blocks map clicks, preserves UI buttons
    const fieldBlocker = this.scene.add.rectangle(
      FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
      0x000000, 0
    ).setOrigin(0).setInteractive();
    this.container.add(fieldBlocker);

    // Dialogue box background
    this.bg = this.scene.add.rectangle(boxX, boxY, boxW, boxH, 0x0d1117, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0x30363d);
    this.container.add(this.bg);

    // Top accent line
    const accent = this.scene.add.rectangle(boxX, boxY, boxW, 3, 0x58a6ff)
      .setOrigin(0);
    this.container.add(accent);

    // Portrait area
    const portraitSize = 80;
    const portraitX = boxX + 52;
    const portraitY = boxY + boxH / 2;

    // Portrait image (loaded from public/assets/heroes/)
    this.portraitImage = this.scene.add.image(portraitX, portraitY, 'hero_engineer')
      .setDisplaySize(portraitSize - 4, portraitSize - 4);
    this.container.add(this.portraitImage);

    // Speaker name
    const textX = boxX + portraitSize + 28;
    this.speakerName = this.scene.add.text(textX, boxY + 14, '', {
      fontSize: '17px',
      color: '#58a6ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.container.add(this.speakerName);

    // Speaker title
    this.speakerTitle = this.scene.add.text(textX, boxY + 36, '', {
      fontSize: '11px',
      color: '#8b949e',
      fontFamily: 'monospace',
      fontStyle: 'italic',
    });
    this.container.add(this.speakerTitle);

    // Dialogue text
    this.dialogueText = this.scene.add.text(textX, boxY + 56, '', {
      fontSize: '14px',
      color: '#c9d1d9',
      fontFamily: 'monospace',
      wordWrap: { width: boxW - portraitSize - 52 },
      lineSpacing: 5,
    });
    this.container.add(this.dialogueText);

    // Hint
    this.hintLine = this.scene.add.text(boxX + boxW / 2, boxY + 12, '', {
      fontSize: '10px',
      color: '#484f58',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(this.hintLine);

    // Continue button (big)
    const btnY = boxY + boxH - 8;
    this.continueBtn = this.scene.add.text(boxX + boxW - 16, btnY, 'ДАЛЕЕ ▶', {
      fontSize: '15px',
      color: '#c9d1d9',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: '#21262d',
      padding: { x: 16, y: 6 },
    }).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.continueBtn.setColor('#ffffff'))
      .on('pointerout', () => this.continueBtn.setColor('#c9d1d9'))
      .on('pointerdown', () => this.nextLine());
    this.container.add(this.continueBtn);

    // Skip button (big)
    this.skipBtn = this.scene.add.text(boxX + boxW - 180, btnY, 'ПРОПУСТИТЬ ⏭', {
      fontSize: '15px',
      color: '#8b949e',
      fontFamily: 'monospace',
      backgroundColor: '#21262d',
      padding: { x: 16, y: 6 },
    }).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.skipBtn.setColor('#ffffff'))
      .on('pointerout', () => this.skipBtn.setColor('#8b949e'))
      .on('pointerdown', () => this.skipAll());
    this.container.add(this.skipBtn);
  }

  show(dialogue: Dialogue, onFinished?: () => void, onShow?: () => void): void {
    if (!dialogue || !dialogue.lines || dialogue.lines.length === 0) return;
    if (!this.container || !this.container.scene) return;

    this.lines = dialogue.lines;
    this.currentLine = 0;
    this.onFinished = onFinished;
    this.onShow = onShow;
    this.isShowing = true;

    this.onShow?.();
    this.showLine(0);
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
    });
  }

  private showLine(index: number): void {
    if (index >= this.lines.length) {
      this.hide();
      return;
    }
    if (!this.dialogueText || !this.dialogueText.scene) return;

    const line = this.lines[index];
    const config = SPEAKER_CONFIG[line.speaker] || { name: line.speaker, color: 0xc9d1d9, title: '', texKey: '' };
    const isNarrator = line.speaker === 'narrator';
    const colorHex = '#' + config.color.toString(16).padStart(6, '0');

    if (isNarrator) {
      this.speakerName.setText('');
      this.speakerTitle.setText('');
      this.portraitImage.setVisible(false);
      this.dialogueText.setFontStyle('italic');
      this.dialogueText.setColor(colorHex);
    } else {
      this.speakerName.setText(config.name).setColor(colorHex);
      this.speakerTitle.setText(config.title);
      this.portraitImage.setVisible(true);
      this.dialogueText.setFontStyle('');
      this.dialogueText.setColor('#c9d1d9');
      // Swap portrait texture
      if (config.texKey && this.scene.textures.exists(config.texKey)) {
        this.portraitImage.setTexture(config.texKey);
      }
    }

    // Typing effect
    this.fullText = line.text;
    this.displayedChars = 0;
    this.dialogueText.setText('');
    this.charRevealTimer = 0;

    this.continueBtn.setText(index < this.lines.length - 1 ? 'ДАЛЕЕ ▶' : 'ГОТОВО ✓');
  }

  nextLine(): void {
    if (this.displayedChars < this.fullText.length) {
      this.displayedChars = this.fullText.length;
      this.dialogueText.setText(this.fullText);
      return;
    }

    this.currentLine++;
    if (this.currentLine >= this.lines.length) {
      this.hide();
    } else {
      this.showLine(this.currentLine);
    }
  }

  skipAll(): void {
    this.hide();
  }

  update(delta: number): void {
    if (!this.isShowing) return;
    if (this.displayedChars >= this.fullText.length) return;

    this.charRevealTimer += delta;
    while (this.charRevealTimer >= this.charRevealDelay && this.displayedChars < this.fullText.length) {
      this.charRevealTimer -= this.charRevealDelay;
      this.displayedChars++;
      this.dialogueText.setText(this.fullText.substring(0, this.displayedChars));
    }
  }

  hide(): void {
    this.isShowing = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.container.setVisible(false);
        this.onFinished?.();
      },
    });
  }

  get isVisible(): boolean {
    return this.isShowing;
  }

  destroy(): void {
    this.container?.destroy();
  }
}
