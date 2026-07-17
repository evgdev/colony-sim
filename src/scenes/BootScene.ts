import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { languageManager } from '../data/LanguageManager';

const TUTORIAL_KEY = 'colonySim_tutorialSeen';

export class BootScene extends Phaser.Scene {
  private screens = languageManager.narrative.tutorial.screens;
  private introSounds: Phaser.Sound.BaseSound[] = [];
  private currentScreen: number = 0;
  private screenText!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.image('startMenuBg', 'bg/start_menu_bg.jpg');
    this.load.audio('intro', 'assets/audio/intro.mp3');
    this.load.audio('trex_footstep', 'assets/audio/trex_footstep.wav');
    this.load.audio('music_level1', 'assets/audio/music_level1.wav');

    this.load.image('hero_engineer', 'assets/heroes/engineer_160.png');
    this.load.image('hero_biologist', 'assets/heroes/biologist_160.png');
    this.load.image('hero_pilot', 'assets/heroes/pilot_160.png');

    const species = ['trex', 'raptor', 'brontosaur', 'pterodactyl'];
    for (const s of species) {
      this.load.spritesheet(s, `assets/dinosaurs/${s}.png`, {
        frameWidth: 64,
        frameHeight: 64,
      });
    }
  }

  create(): void {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (seen) {
      this.scene.start('GameScene');
      return;
    }

    const { width, height } = this.cameras.main;



    // Фоновое изображение
    const bg = this.add.image(width / 2, height / 2, 'startMenuBg');

    // Растянуть по размеру камеры (если пропорции не совпадают)
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale);
    bg.setScrollFactor(0); // фон фиксирован относительно камеры

    // Затем — тёмный оверлей, чтобы текст читался
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a2e, 0.6);
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a2e, 1);

    const title = this.add.text(width / 2, 60, languageManager.narrative.tutorial.title, {
      fontSize: '28px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.screenText = this.add.text(width / 2, height / 2 - 30, '', {
      fontSize: '32px', // было 16px
      color: '#c9d1d9',
      fontFamily: 'monospace',
      align: 'left',
      wordWrap: { width: width * 0.7 },
      lineSpacing: 8,
    })
      .setOrigin(0.5)
      .setDepth(1)
      .setScale(0.5); // масштаб вниз

    this.button = this.add.text(width / 2, height - 80, '', {
      fontSize: '18px', color: '#ffd700', fontFamily: 'monospace',
      backgroundColor: '#16213e', padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.advanceScreen())
      .on('pointerover', () => this.button.setColor('#ffffff'))
      .on('pointerout', () => this.button.setColor('#ffd700'));

    // this.introSounds = [
    //   this.sound.add('intro'),
    // ];
    this.showScreen(0);
  }

  private showScreen(index: number): void {
    this.currentScreen = index;
    const screen = this.screens[index];
    this.screenText.setText(screen.text);
    this.button.setText(`[${screen.button}]`);

    this.screenText.setAlpha(0);
    this.button.setAlpha(0);

    this.tweens.add({
      targets: this.screenText,
      alpha: 1,
      duration: 500,
    });
    this.tweens.add({
      targets: this.button,
      alpha: 1,
      duration: 500,
      delay: 200,
    });
    // остановить прошлый звук (если шёл)
    this.introSounds.forEach(s => {
      if (s.isPlaying) s.stop();
    });

    // проиграть текущий звук, если есть
    const sound = this.introSounds[index];
    if (sound) {
      sound.play();
    }
  }

  private advanceScreen(): void {
    if (this.currentScreen < this.screens.length - 1) {
      this.screenText.setAlpha(0);
      this.button.setAlpha(0);
      this.time.delayedCall(250, () => {
        this.showScreen(this.currentScreen + 1);
      });
    } else {
      localStorage.setItem(TUTORIAL_KEY, '1');
      this.scene.start('GameScene');
    }
  }
}
