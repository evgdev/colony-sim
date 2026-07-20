export type LayoutMode = 'desktop' | 'mobile';

export interface LayoutConfig {
  mode: LayoutMode;
  // Canvas
  canvasW: number;
  canvasH: number;
  // Tile / map
  tileSize: number;
  mapW: number;
  mapH: number;
  viewportTiles: number;
  // Field (game viewport)
  fieldX: number;
  fieldY: number;
  fieldW: number;
  fieldH: number;
  // Panels
  leftPanelW: number;
  rightPanelW: number;
  eventH: number;
  bottomHudH: number;
  // Derived
  panelX: number;
  bottomHudY: number;
  // Feature visibility
  showLeftPanel: boolean;
  showRightPanel: boolean;
  showMinimap: boolean;
  showActionLog: boolean;
  showDayNightWidget: boolean;
}

function detectMobile(): boolean {
  if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  if (typeof window !== 'undefined' && window.innerWidth < 800) return true;
  return false;
}

export function createDesktopLayout(): LayoutConfig {
  const tileSize = 50;
  const viewportTiles = 15;
  const leftPanelW = 250;
  const rightPanelW = 250;
  const eventH = 50;
  const bottomHudH = 160;
  const fieldW = viewportTiles * tileSize;
  const fieldH = viewportTiles * tileSize;
  const canvasW = leftPanelW + fieldW + rightPanelW;
  const canvasH = eventH + fieldH + bottomHudH;

  return {
    mode: 'desktop',
    canvasW,
    canvasH,
    tileSize,
    mapW: 30,
    mapH: 30,
    viewportTiles,
    fieldX: leftPanelW,
    fieldY: eventH,
    fieldW,
    fieldH,
    leftPanelW,
    rightPanelW,
    eventH,
    bottomHudH,
    panelX: leftPanelW + fieldW,
    bottomHudY: eventH + fieldH,
    showLeftPanel: true,
    showRightPanel: true,
    showMinimap: true,
    showActionLog: true,
    showDayNightWidget: true,
  };
}

export function createMobileLayout(): LayoutConfig {
  const tileSize = 50;
  const viewportTiles = 15;
  const fieldW = viewportTiles * tileSize;
  const fieldH = viewportTiles * tileSize;
  const eventH = 40;
  const bottomHudH = 70;
  const canvasW = fieldW;
  const canvasH = eventH + fieldH + bottomHudH;

  return {
    mode: 'mobile',
    canvasW,
    canvasH,
    tileSize,
    mapW: 30,
    mapH: 30,
    viewportTiles,
    fieldX: 0,
    fieldY: eventH,
    fieldW,
    fieldH,
    leftPanelW: 0,
    rightPanelW: 0,
    eventH,
    bottomHudH,
    panelX: canvasW,
    bottomHudY: eventH + fieldH,
    showLeftPanel: false,
    showRightPanel: false,
    showMinimap: false,
    showActionLog: false,
    showDayNightWidget: false,
  };
}

let _layout: LayoutConfig = createDesktopLayout();

export function getLayout(): LayoutConfig {
  return _layout;
}

export function initLayout(): LayoutConfig {
  _layout = detectMobile() ? createMobileLayout() : createDesktopLayout();
  return _layout;
}
