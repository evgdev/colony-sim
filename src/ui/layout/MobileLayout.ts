import type { LayoutConfig } from './LayoutTypes';

function detectCapacitor(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
}

function getSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('env(safe-area-inset-top)')) || 0,
    bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
    left: parseInt(style.getPropertyValue('env(safe-area-inset-left)')) || 0,
    right: parseInt(style.getPropertyValue('env(safe-area-inset-right)')) || 0,
  };
}

/**
 * Mobile portrait layout:
 *
 *  +----------------------------------+
 *  | [🪵8][🪨12][🍖5]  Day 5 [≡]   |  <- 36px top bar
 *  +----------------------------------+
 *  | [🧑‍🔧] [🧑‍🔬] [🧑‍✈️]              |  <- 68px settler portraits
 *  +----------------------------------+
 *  |                                  |
 *  |         GAME FIELD               |  <- 8x10 tiles (384x480)
 *  |         384 x 480                |
 *  |                                  |
 *  +----------------------------------+
 *  | ♥♥♥ 🍗80 ⚡60  Worker  [📦inv]  |  <- 28px settler status
 *  +----------------------------------+
 *  | [Auto][Gather][Build][Stop]      |  <- 36px work mode
 *  +----------------------------------+
 *  | [🏠] [🌾] [⚒️] [🏰]            |  <- 72px build strip (scrollable)
 *  +----------------------------------+
 */
export function createMobileLayout(): LayoutConfig {
  const isNative = detectCapacitor();
  const insets = isNative ? getSafeAreaInsets() : { top: 0, bottom: 0, left: 0, right: 0 };

  const tileSize = 48;
  const viewportTilesX = 8;
  const viewportTilesY = 10;
  const fieldW = viewportTilesX * tileSize;
  const fieldH = viewportTilesY * tileSize;

  // Bars
  const topBarH = 36;       // resource counts + day + menu
  const portraitRowH = 68;  // settler portraits (54px + HP bar + gap)
  const settlerBarH = 28;   // selected settler HP/hunger/energy
  const workModeH = 36;     // work mode buttons row
  const buildStripH = 72;   // scrollable build buttons (bigger icons)

  const bottomHudH = settlerBarH + workModeH + buildStripH;
  const canvasW = fieldW + insets.left + insets.right;
  const canvasH = topBarH + portraitRowH + fieldH + bottomHudH + insets.top + insets.bottom;

  return {
    mode: 'mobile',
    canvasW,
    canvasH,
    tileSize,
    mapW: 30,
    mapH: 30,
    viewportTiles: viewportTilesX,
    viewportTilesX,
    viewportTilesY,
    fieldX: insets.left,
    fieldY: topBarH + portraitRowH + insets.top,
    fieldW,
    fieldH,
    leftPanelW: 0,
    rightPanelW: 0,
    eventH: topBarH,
    bottomHudH,
    panelX: canvasW,
    bottomHudY: topBarH + portraitRowH + fieldH + insets.top,
    showLeftPanel: false,
    showRightPanel: false,
    showMinimap: false,
    showActionLog: false,
    showDayNightWidget: false,
    portraitRowH,
  };
}
