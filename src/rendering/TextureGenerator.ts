import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

export function createBuildingIcons(scene: Phaser.Scene): void {
  const s = 40;

  const houseG = scene.add.graphics().setVisible(false);
  houseG.fillStyle(0x8b4513);
  houseG.fillRect(6, 18, 28, 18);
  houseG.fillStyle(0xcc4444);
  houseG.fillTriangle(20, 4, 4, 20, 36, 20);
  houseG.fillStyle(0x654321);
  houseG.fillRect(16, 26, 8, 10);
  houseG.generateTexture('icon_house', s, s);
  houseG.destroy();

  const whG = scene.add.graphics().setVisible(false);
  whG.fillStyle(0x778899);
  whG.fillRect(4, 14, 32, 22);
  whG.fillStyle(0x556677);
  whG.fillRect(4, 12, 32, 4);
  whG.lineStyle(1, 0x445566);
  whG.strokeRect(4, 14, 32, 22);
  whG.fillStyle(0x99aabb);
  whG.fillRect(14, 22, 12, 14);
  whG.generateTexture('icon_warehouse', s, s);
  whG.destroy();

  const fG = scene.add.graphics().setVisible(false);
  fG.fillStyle(0x8b7355);
  fG.fillRect(2, 28, 36, 8);
  fG.fillStyle(0x44aa44);
  fG.fillCircle(12, 18, 6);
  fG.fillCircle(28, 18, 6);
  fG.fillStyle(0x338833);
  fG.fillRect(11, 18, 2, 12);
  fG.fillRect(27, 18, 2, 12);
  fG.fillStyle(0xffcc00);
  fG.fillCircle(12, 14, 3);
  fG.fillCircle(28, 14, 3);
  fG.generateTexture('icon_farm', s, s);
  fG.destroy();

  const wG = scene.add.graphics().setVisible(false);
  wG.fillStyle(0x808080);
  wG.fillRect(8, 8, 24, 24);
  wG.fillStyle(0x606060);
  wG.fillRect(8, 8, 24, 6);
  wG.fillStyle(0xaaaaaa);
  wG.fillRect(12, 20, 16, 8);
  wG.lineStyle(2, 0xffd700);
  wG.strokeCircle(20, 24, 4);
  wG.generateTexture('icon_workshop', s, s);
  wG.destroy();
}

function seededRandom(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

export function createTileTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  const grassG = scene.add.graphics().setVisible(false);
  grassG.fillStyle(0x3a5a2a);
  grassG.fillRect(0, 0, s, s);
  const grassColors = [0x336b25, 0x458a35, 0x2d4f1f, 0x3e6830, 0x2a5020];
  const grassSeed = 42;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = seededRandom(x, y, grassSeed);
      if (r < 0.4) {
        const ci = Math.floor(seededRandom(x + 100, y + 100, grassSeed) * grassColors.length);
        grassG.fillStyle(grassColors[ci]);
        grassG.fillRect(x, y, 1, 1);
      }
    }
  }
  grassG.generateTexture('tile_grass', s, s);
  grassG.destroy();

  const stoneG = scene.add.graphics().setVisible(false);
  stoneG.fillStyle(0x808080);
  stoneG.fillRect(0, 0, s, s);
  stoneG.fillStyle(0x909090);
  stoneG.fillRect(2, 2, 10, 8);
  stoneG.fillRect(14, 4, 12, 6);
  stoneG.fillRect(28, 2, 8, 10);
  stoneG.fillRect(6, 14, 14, 8);
  stoneG.fillRect(22, 12, 10, 8);
  stoneG.fillRect(2, 26, 12, 10);
  stoneG.fillRect(16, 24, 16, 12);
  stoneG.fillRect(34, 28, 8, 8);
  stoneG.lineStyle(1, 0x606060);
  stoneG.strokeRect(2, 2, 10, 8);
  stoneG.strokeRect(14, 4, 12, 6);
  stoneG.strokeRect(28, 2, 8, 10);
  stoneG.strokeRect(6, 14, 14, 8);
  stoneG.strokeRect(22, 12, 10, 8);
  stoneG.strokeRect(2, 26, 12, 10);
  stoneG.strokeRect(16, 24, 16, 12);
  stoneG.strokeRect(34, 28, 8, 8);
  stoneG.generateTexture('tile_stone', s, s);
  stoneG.destroy();

  const sandG = scene.add.graphics().setVisible(false);
  sandG.fillStyle(0xc2b280);
  sandG.fillRect(0, 0, s, s);
  const sandColors = [0xd4c490, 0xb8a870, 0xc9ba88, 0xa89860, 0xd0c080];
  const sandSeed = 137;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = seededRandom(x, y, sandSeed);
      if (r < 0.4) {
        const ci = Math.floor(seededRandom(x + 100, y + 100, sandSeed) * sandColors.length);
        sandG.fillStyle(sandColors[ci]);
        sandG.fillRect(x, y, 1, 1);
      }
    }
  }
  sandG.generateTexture('tile_sand', s, s);
  sandG.destroy();

  const waterG = scene.add.graphics().setVisible(false);
  waterG.fillStyle(0x3b7dd8);
  waterG.fillRect(0, 0, s, s);
  waterG.lineStyle(2, 0x5599ee, 0.5);
  waterG.beginPath();
  waterG.moveTo(0, 12);
  waterG.lineTo(12, 10);
  waterG.lineTo(25, 14);
  waterG.lineTo(38, 11);
  waterG.lineTo(50, 13);
  waterG.strokePath();
  waterG.beginPath();
  waterG.moveTo(0, 28);
  waterG.lineTo(10, 26);
  waterG.lineTo(22, 30);
  waterG.lineTo(35, 27);
  waterG.lineTo(50, 29);
  waterG.strokePath();
  waterG.lineStyle(1, 0x77bbee, 0.3);
  waterG.beginPath();
  waterG.moveTo(0, 40);
  waterG.lineTo(15, 38);
  waterG.lineTo(30, 42);
  waterG.lineTo(45, 39);
  waterG.lineTo(50, 41);
  waterG.strokePath();
  waterG.generateTexture('tile_water', s, s);
  waterG.destroy();

  const dirtG = scene.add.graphics().setVisible(false);
  dirtG.fillStyle(0x8b7355);
  dirtG.fillRect(0, 0, s, s);
  const dirtColors = [0x7a6548, 0x9c8562, 0x6e5a40, 0x8a7050, 0x786245];
  const dirtSeed = 256;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = seededRandom(x, y, dirtSeed);
      if (r < 0.4) {
        const ci = Math.floor(seededRandom(x + 100, y + 100, dirtSeed) * dirtColors.length);
        dirtG.fillStyle(dirtColors[ci]);
        dirtG.fillRect(x, y, 1, 1);
      }
    }
  }
  dirtG.generateTexture('tile_dirt', s, s);
  dirtG.destroy();
}
