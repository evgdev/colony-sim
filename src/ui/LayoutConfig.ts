export type { LayoutMode, LayoutConfig } from './layout/LayoutTypes';
import type { LayoutConfig } from './layout/LayoutTypes';
import { createDesktopLayout } from './layout/DesktopLayout';
import { createMobileLayout } from './layout/MobileLayout';

function detectMobile(): boolean {
  if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  if (typeof window !== 'undefined' && window.innerWidth < 800) return true;
  return false;
}

let _layout: LayoutConfig = createDesktopLayout();

export function getLayout(): LayoutConfig {
  return _layout;
}

export function initLayout(): LayoutConfig {
  _layout = detectMobile() ? createMobileLayout() : createDesktopLayout();
  return _layout;
}
