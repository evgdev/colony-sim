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

export function createTileTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  const grassG = scene.add.graphics().setVisible(false);
  grassG.fillStyle(0x4a7c3f);
  grassG.fillRect(0, 0, s, s);
  grassG.fillStyle(0x5a8c4f);
  grassG.fillCircle(6, 8, 2);
  grassG.fillCircle(18, 5, 1);
  grassG.fillCircle(32, 10, 2);
  grassG.fillCircle(42, 6, 1);
  grassG.fillCircle(10, 22, 1);
  grassG.fillCircle(25, 18, 2);
  grassG.fillCircle(38, 24, 1);
  grassG.fillCircle(5, 36, 2);
  grassG.fillCircle(20, 32, 1);
  grassG.fillCircle(35, 38, 2);
  grassG.fillCircle(45, 34, 1);
  grassG.lineStyle(1, 0x3a6c2f, 0.4);
  grassG.beginPath();
  grassG.moveTo(8, 4);
  grassG.lineTo(8, 12);
  grassG.strokePath();
  grassG.beginPath();
  grassG.moveTo(22, 16);
  grassG.lineTo(22, 24);
  grassG.strokePath();
  grassG.beginPath();
  grassG.moveTo(38, 30);
  grassG.lineTo(38, 38);
  grassG.strokePath();
  grassG.beginPath();
  grassG.moveTo(14, 34);
  grassG.lineTo(14, 42);
  grassG.strokePath();
  grassG.lineStyle(1, 0x6a9c5f, 0.3);
  grassG.beginPath();
  grassG.moveTo(30, 6);
  grassG.lineTo(30, 14);
  grassG.strokePath();
  grassG.beginPath();
  grassG.moveTo(44, 22);
  grassG.lineTo(44, 30);
  grassG.strokePath();
  grassG.beginPath();
  grassG.moveTo(4, 20);
  grassG.lineTo(4, 28);
  grassG.strokePath();
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
  sandG.fillStyle(0xd4c490);
  for (let i = 0; i < 12; i++) {
    const dx = (i * 7 + 3) % s;
    const dy = (i * 11 + 5) % s;
    sandG.fillCircle(dx, dy, 1);
  }
  sandG.fillStyle(0xb8a870);
  for (let i = 0; i < 8; i++) {
    const dx = (i * 13 + 8) % s;
    const dy = (i * 9 + 2) % s;
    sandG.fillCircle(dx, dy, 1);
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
  dirtG.fillStyle(0x7a6548);
  dirtG.fillCircle(8, 10, 2);
  dirtG.fillCircle(22, 6, 1);
  dirtG.fillCircle(35, 14, 2);
  dirtG.fillCircle(12, 28, 1);
  dirtG.fillCircle(28, 32, 2);
  dirtG.fillCircle(40, 38, 1);
  dirtG.fillStyle(0x9c8562);
  dirtG.fillCircle(5, 40, 1);
  dirtG.fillCircle(18, 20, 1);
  dirtG.fillCircle(32, 26, 1);
  dirtG.fillCircle(42, 8, 1);
  dirtG.generateTexture('tile_dirt', s, s);
  dirtG.destroy();
}
