import Phaser from 'phaser';
import {
  TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, VIEWPORT_TILES,
  FIELD_X, FIELD_Y, FIELD_W, FIELD_H,
} from '../config';
import { Simulation } from '../core/Simulation';
import { Settler } from '../entities/Settler';
import { MapRenderer } from '../rendering/MapRenderer';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { createTileTextures, createBuildingIcons } from '../rendering/TextureGenerator';
import { ReplayPlayer } from './ReplayPlayer';
import { ReplayController } from './ReplayController';
import { ReplayFile } from './ReplayTypes';

export class ReplayScene extends Phaser.Scene {
  private simulation!: Simulation;
  private mapRenderer!: MapRenderer;
  private entityRenderer!: EntityRenderer;
  private player!: ReplayPlayer;
  private controller!: ReplayController;
  private scrollX: number = 0;
  private scrollY: number = 0;
  private keys!: any;
  private ended: boolean = false;

  constructor() {
    super('ReplayScene');
  }

  init(data: { replay: ReplayFile }): void {
    (this as any).replayData = data.replay;
  }

  create(): void {
    this.children.removeAll(true);
    this.ended = false;

    const replayData = (this as any).replayData as ReplayFile;
    this.player = new ReplayPlayer(replayData);

    this.simulation = this.player.getSimulation();

    createTileTextures(this);
    createBuildingIcons(this);

    this.mapRenderer = new MapRenderer(this, this.simulation);
    this.mapRenderer.drawMap();

    this.entityRenderer = new EntityRenderer(this, this.simulation);

    this.scrollX = Math.max(0, Math.floor(MAP_WIDTH / 2) - Math.floor(VIEWPORT_TILES / 2));
    this.scrollY = Math.max(0, Math.floor(MAP_HEIGHT / 2) - Math.floor(VIEWPORT_TILES / 2));
    this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
    this.entityRenderer.drawEntities();

    this.controller = new ReplayController(this, this.player);
    this.controller.setOnSwitchReplay((replay) => {
      this.scene.restart({ replay });
    });
    this.controller.create();

    this.keys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
      RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as any;

    this.input.keyboard!.on('keydown-SPACE', () => {
      this.player.togglePause();
      this.controller.updateUI();
    });
  }

  update(time: number, delta: number): void {
    if (this.ended) return;

    this.handleScrollInput();

    const { current, total } = this.player.getProgress();
    if (current >= total && total > 0) {
      this.ended = true;
      this.player.setPaused(true);
      this.controller.updateUI();
      return;
    }

    const ticked = this.player.update(delta);

    const tilesPerMs = this.player.getPlaybackSpeed() / this.simulation.tickRate;
    this.entityRenderer.selectedSettler = this.player.getSelectedSettler();
    this.entityRenderer.updateVisuals(delta, tilesPerMs);
    this.mapRenderer.redrawFog();
    this.simulation.tileGrid.updateFog(delta);
    this.mapRenderer.updateNight(this.simulation.tickCount);
    this.entityRenderer.drawEntities();
    this.entityRenderer.drawPath();
    this.controller.updateUI();
  }

  private handleScrollInput(): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy = -1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy = 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx = -1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx = 1;

    if (dx !== 0 || dy !== 0) {
      const newScrollX = Math.max(0, Math.min(this.scrollX + dx, MAP_WIDTH - VIEWPORT_TILES));
      const newScrollY = Math.max(0, Math.min(this.scrollY + dy, MAP_HEIGHT - VIEWPORT_TILES));
      if (newScrollX !== this.scrollX || newScrollY !== this.scrollY) {
        this.scrollX = newScrollX;
        this.scrollY = newScrollY;
        this.mapRenderer.updateScroll(this.scrollX, this.scrollY);
        this.entityRenderer.updateScroll(this.scrollX, this.scrollY);
      }
    }
  }
}
