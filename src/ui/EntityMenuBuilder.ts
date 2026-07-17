import { MenuItem } from './menu/MenuItem';
import { Settler } from '../entities/Settler';
import { Building } from '../entities/Building';
import { Dinosaur } from '../entities/Dinosaur';
import { Resource } from '../entities/Resource';
import { Artifact } from '../entities/Artifact';
import { Entity } from '../core/Entity';
import { languageManager } from '../data/LanguageManager';
import buildingsData from '../data/buildings.json';

export interface EntityMenuContext {
  selectedSettler: Settler | null;
  onMoveHere: (x: number, y: number, queue: boolean) => void;
  onCollect: (entity: Entity, queue: boolean) => void;
  onAttack: (entity: Entity, queue: boolean) => void;
  onDemolish: (entity: Entity) => void;
  onContinue: (entity: Entity) => void;
  onRepair: (entity: Entity) => void;
  onSelectSettler: (settler: Settler) => void;
}

export function getSettlerMenu(settler: Settler, ctx: EntityMenuContext): MenuItem[] {
  const items: MenuItem[] = [];
  const ui = languageManager.ui;

  items.push({
    label: ui.menuSelect,
    icon: '\u25CB',
    action: () => ctx.onSelectSettler(settler),
  });

  if (ctx.selectedSettler && ctx.selectedSettler !== settler) {
    items.push({ separator: true });
    items.push({
      label: ui.menuAttack,
      icon: '\u2694',
      danger: true,
      action: () => ctx.onAttack(settler, false),
    });
    items.push({
      label: ui.menuQueueAttack,
      icon: '\u2694',
      disabled: true,
    });
  }

  return items;
}

export function getBuildingMenu(building: Building, ctx: EntityMenuContext): MenuItem[] {
  const items: MenuItem[] = [];
  const ui = languageManager.ui;

  if (!building.built) {
    items.push({
      label: ui.menuContinue,
      icon: '\u25B6',
      action: () => ctx.onContinue(building),
    });
  }

  if (building.built && building.hp < building.maxHp) {
    items.push({
      label: ui.menuRepair,
      icon: '\u2692',
      action: () => ctx.onRepair(building),
    });
  }

  if (building.buildingType !== 'lab') {
    items.push({ separator: true });
    items.push({
      label: ui.menuDemolish,
      icon: '\u2716',
      danger: true,
      action: () => ctx.onDemolish(building),
    });
  }

  return items;
}

export function getDinoMenu(dino: Dinosaur, ctx: EntityMenuContext): MenuItem[] {
  const items: MenuItem[] = [];
  const ui = languageManager.ui;

  if (ctx.selectedSettler) {
    items.push({
      label: ui.menuAttack,
      icon: '\u2694',
      danger: true,
      action: () => ctx.onAttack(dino, false),
    });
    items.push({
      label: ui.menuQueueAttack,
      icon: '\u2694',
      action: () => ctx.onAttack(dino, true),
    });
  }

  return items;
}

export function getResourceMenu(resource: Resource, ctx: EntityMenuContext): MenuItem[] {
  const items: MenuItem[] = [];
  const ui = languageManager.ui;

  if (ctx.selectedSettler && !resource.depleted) {
    items.push({
      label: ui.menuCollect,
      icon: '\u2913',
      action: () => ctx.onCollect(resource, false),
    });
    items.push({
      label: ui.menuQueueCollect,
      icon: '\u2913',
      action: () => ctx.onCollect(resource, true),
    });
  }

  return items;
}

export function getArtifactMenu(artifact: Artifact, ctx: EntityMenuContext): MenuItem[] {
  const items: MenuItem[] = [];
  const ui = languageManager.ui;

  if (ctx.selectedSettler) {
    items.push({
      label: ui.menuCollect,
      icon: '\u2B50',
      action: () => ctx.onCollect(artifact, false),
    });
  }

  return items;
}

export function getContextMenuForEntity(
  entity: Entity,
  ctx: EntityMenuContext
): MenuItem[] {
  switch (entity.entityType) {
    case 'settler':
      return getSettlerMenu(entity as Settler, ctx);
    case 'building':
      return getBuildingMenu(entity as Building, ctx);
    case 'dinosaur':
      return getDinoMenu(entity as Dinosaur, ctx);
    case 'resource':
      return getResourceMenu(entity as Resource, ctx);
    case 'artifact':
      return getArtifactMenu(entity as Artifact, ctx);
    default:
      return [];
  }
}

export function getTooltipForEntity(entity: Entity): { text: string; color?: string; bold?: boolean }[] {
  const lines: { text: string; color?: string; bold?: boolean }[] = [];
  const ui = languageManager.ui;

  switch (entity.entityType) {
    case 'settler': {
      const s = entity as Settler;
      lines.push({ text: `${s.name} (${s.settlerClass})`, color: '#ffd700', bold: true });
      lines.push({ text: `${ui.hp}: ${Math.round(s.hp)}/${s.maxHp}`, color: '#58a6ff' });
      if (s.currentTaskId) {
        lines.push({ text: `${ui.status}: ${ui.working}`, color: '#8b949e' });
      } else {
        lines.push({ text: `${ui.status}: ${ui.idle}`, color: '#8b949e' });
      }
      break;
    }
    case 'building': {
      const b = entity as Building;
      const name = (buildingsData as any)[b.buildingType]?.name ?? b.buildingType;
      lines.push({ text: name, color: '#88aaff', bold: true });
      lines.push({ text: `${ui.hp}: ${b.hp}/${b.maxHp}`, color: '#58a6ff' });
      if (!b.built) {
        lines.push({ text: `${ui.building}: ${Math.round(b.progressPercent * 100)}%`, color: '#ffd700' });
      }
      break;
    }
    case 'dinosaur': {
      const d = entity as Dinosaur;
      lines.push({ text: d.species, color: '#ff4444', bold: true });
      lines.push({ text: `${ui.hp}: ${d.hp}/${d.maxHp}`, color: '#58a6ff' });
      lines.push({ text: `${ui.infoState}: ${d.state}`, color: '#8b949e' });
      break;
    }
    case 'resource': {
      const r = entity as Resource;
      lines.push({ text: `${r.resourceType}`, color: '#ffaa00', bold: true });
      lines.push({ text: `${ui.infoQuantity}: ${r.quantity}`, color: '#c9d1d9' });
      break;
    }
    case 'artifact': {
      const a = entity as Artifact;
      lines.push({ text: a.name, color: '#ffd700', bold: true });
      lines.push({ text: `${ui.infoType}: ${a.artifactType}`, color: '#8b949e' });
      break;
    }
  }

  return lines;
}
