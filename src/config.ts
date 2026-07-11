export const TILE_SIZE = 50;
export const MAP_WIDTH = 15;
export const MAP_HEIGHT = 15;
export const PANEL_WIDTH = 250;
export const LEFT_PANEL_WIDTH = 250;
export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 900;
export const HUD_HEIGHT = 90;
export const EVENT_HEIGHT = 60;

export const FIELD_X = LEFT_PANEL_WIDTH;
export const FIELD_Y = EVENT_HEIGHT;
export const FIELD_W = MAP_WIDTH * TILE_SIZE;
export const FIELD_H = (MAP_HEIGHT - 1) * TILE_SIZE;
export const PANEL_X = CANVAS_WIDTH - PANEL_WIDTH;
export const BOTTOM_HUD_Y = FIELD_Y + FIELD_H;

export const COLORS = {
  grass: 0x4a7c3f,
  dirt: 0x8b7355,
  water: 0x3b7dd8,
  stone: 0x808080,
  sand: 0xc2b280,
  settler: 0xffd700,
  resource: 0xff6347,
  building: 0x8b4513,
  dinosaur: 0xcc3333,
  pathHighlight: 0xffff00,
  hoverTile: 0xffffff,
  uiBg: 0x1a1a2e,
  uiPanel: 0x16213e,
  uiText: 0xe0e0e0,
  panelBg: 0x0d1117,
  panelBorder: 0x30363d,
  panelHeader: 0x58a6ff,
  panelValue: 0xc9d1d9,
  panelDim: 0x8b949e,
};
