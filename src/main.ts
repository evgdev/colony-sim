import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ReplayScene } from './replay/ReplayScene';
import { initLayout } from './ui/LayoutConfig';

const layout = initLayout();
const DPR = window.devicePixelRatio || 1;

const config = {
  type: Phaser.AUTO,
  width: layout.canvasW,
  height: layout.canvasH,
  backgroundColor: '#1a1a2e',
  parent: document.body,
  scene: [BootScene, GameScene, ReplayScene],
  resolution: DPR,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
  },
} as Phaser.Types.Core.GameConfig;

new Phaser.Game(config);
