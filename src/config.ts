export const TILE_SIZE = 50;
export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;
export const VIEWPORT_TILES = 15;
export const FOG_REVEAL_RADIUS = 3;
export const PANEL_WIDTH = 250;
export const LEFT_PANEL_WIDTH = 250;
export const CANVAS_WIDTH = 1500;
export const CANVAS_HEIGHT = 900;
export const HUD_HEIGHT = 90;
export const EVENT_HEIGHT = 50;

export const FIELD_X = LEFT_PANEL_WIDTH;
export const FIELD_Y = EVENT_HEIGHT;
export const FIELD_W = VIEWPORT_TILES * TILE_SIZE;
export const FIELD_H = VIEWPORT_TILES * TILE_SIZE;
export const PANEL_X = CANVAS_WIDTH - PANEL_WIDTH;
export const BOTTOM_HUD_Y = FIELD_Y + FIELD_H;

// Day/Night cycle (measured in simulation ticks)
export const DAY_TICKS = 100;
export const NIGHT_TICKS = 50;
export const CYCLE_TICKS = DAY_TICKS + NIGHT_TICKS;
export const DUSK_TICKS = 10;
// Night color correction: hue + strength applied as a field overlay
export const NIGHT_TINT = 0x10204a;
export const NIGHT_MAX_ALPHA = 0.6;

export function isNight(tickCount: number): boolean {
  const phase = ((tickCount % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS;
  return phase >= DAY_TICKS;
}

export function nightAlpha(tickCount: number): number {
  const phase = ((tickCount % CYCLE_TICKS) + CYCLE_TICKS) % CYCLE_TICKS;
  if (phase < DAY_TICKS) {
    const duskStart = DAY_TICKS - DUSK_TICKS;
    if (phase < duskStart) return 0;
    return ((phase - duskStart) / DUSK_TICKS) * NIGHT_MAX_ALPHA;
  }
  const nightPhase = phase - DAY_TICKS;
  if (nightPhase < DUSK_TICKS) return NIGHT_MAX_ALPHA;
  const dawnStart = NIGHT_TICKS - DUSK_TICKS;
  if (nightPhase < dawnStart) return NIGHT_MAX_ALPHA;
  return ((NIGHT_TICKS - nightPhase) / DUSK_TICKS) * NIGHT_MAX_ALPHA;
}

export const FOOD_EAT_INTERVAL = 20;
export const FOOD_HUNGER_RESTORE = 25;
export const FOOD_START_AMOUNT = 5;
export const STARVATION_DAMAGE = 5;
export const HUNGER_STARVATION_THRESHOLD = 0;
export const HUNGER_STARVATION_MULTIPLIER = 2;

// Временно отключает голод и энергию (true = потребности работают, false = отключены)
export const NEEDS_ENABLED = false;

export const COLORS = {
  grass: 0x3a5a2a,
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
