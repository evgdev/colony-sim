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
  viewportTiles: number;       // backward compat (== viewportTilesX)
  viewportTilesX: number;
  viewportTilesY: number;
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
  // Mobile portrait row
  portraitRowH: number;
}
