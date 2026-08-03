import type { LayoutConfig } from './LayoutTypes';

export function createDesktopLayout(): LayoutConfig {
  const tileSize = 50;
  const viewportTilesX = 15;
  const viewportTilesY = 15;
  const leftPanelW = 250;
  const rightPanelW = 250;
  const eventH = 50;
  const bottomHudH = 160;
  const fieldW = viewportTilesX * tileSize;
  const fieldH = viewportTilesY * tileSize;
  const canvasW = leftPanelW + fieldW + rightPanelW;
  const canvasH = eventH + fieldH + bottomHudH;

  return {
    mode: 'desktop',
    canvasW,
    canvasH,
    tileSize,
    mapW: 30,
    mapH: 30,
    viewportTiles: viewportTilesX,
    viewportTilesX,
    viewportTilesY,
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
    portraitRowH: 0,
  };
}
