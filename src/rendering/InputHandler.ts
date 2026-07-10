import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

export class InputHandler {
  private scene: Phaser.Scene;
  private onTileClick: (x: number, y: number) => void;
  private onTileHover: (x: number, y: number) => void;

  constructor(
    scene: Phaser.Scene,
    onTileClick: (x: number, y: number) => void,
    onTileHover: (x: number, y: number) => void
  ) {
    this.scene = scene;
    this.onTileClick = onTileClick;
    this.onTileHover = onTileHover;

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tx = Math.floor(pointer.x / TILE_SIZE);
      const ty = Math.floor(pointer.y / TILE_SIZE);
      this.onTileHover(tx, ty);
    });

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tx = Math.floor(pointer.x / TILE_SIZE);
      const ty = Math.floor(pointer.y / TILE_SIZE);
      this.onTileClick(tx, ty);
    });
  }
}
