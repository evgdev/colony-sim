import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

export function createBuildingIcons(scene: Phaser.Scene): void {
  const s = 40;

  const houseG = scene.add.graphics().setVisible(false);
  houseG.fillStyle(0x8b4513);
  houseG.fillRect(6, 18, 28, 18);
  houseG.fillStyle(0xcc4444);
  houseG.fillTriangle(20, 4, 4, 20, 36, 20);
  houseG.fillStyle(0x654321);
  houseG.fillRect(16, 26, 8, 10);
  houseG.generateTexture('icon_house', s, s);
  houseG.destroy();

  const whG = scene.add.graphics().setVisible(false);
  whG.fillStyle(0x778899);
  whG.fillRect(4, 14, 32, 22);
  whG.fillStyle(0x556677);
  whG.fillRect(4, 12, 32, 4);
  whG.lineStyle(1, 0x445566);
  whG.strokeRect(4, 14, 32, 22);
  whG.fillStyle(0x99aabb);
  whG.fillRect(14, 22, 12, 14);
  whG.generateTexture('icon_warehouse', s, s);
  whG.destroy();

  const fG = scene.add.graphics().setVisible(false);
  fG.fillStyle(0x8b7355);
  fG.fillRect(2, 28, 36, 8);
  fG.fillStyle(0x44aa44);
  fG.fillCircle(12, 18, 6);
  fG.fillCircle(28, 18, 6);
  fG.fillStyle(0x338833);
  fG.fillRect(11, 18, 2, 12);
  fG.fillRect(27, 18, 2, 12);
  fG.fillStyle(0xffcc00);
  fG.fillCircle(12, 14, 3);
  fG.fillCircle(28, 14, 3);
  fG.generateTexture('icon_farm', s, s);
  fG.destroy();

  const wG = scene.add.graphics().setVisible(false);
  wG.fillStyle(0x808080);
  wG.fillRect(8, 8, 24, 24);
  wG.fillStyle(0x606060);
  wG.fillRect(8, 8, 24, 6);
  wG.fillStyle(0xaaaaaa);
  wG.fillRect(12, 20, 16, 8);
  wG.lineStyle(2, 0xffd700);
  wG.strokeCircle(20, 24, 4);
  wG.generateTexture('icon_workshop', s, s);
  wG.destroy();

  const wallG = scene.add.graphics().setVisible(false);
  wallG.fillStyle(0x808080);
  wallG.fillRect(4, 6, 32, 28);
  wallG.fillStyle(0x999999);
  wallG.fillRect(4, 6, 32, 6);
  wallG.lineStyle(1, 0x555555);
  wallG.strokeRect(4, 6, 32, 28);
  wallG.lineBetween(20, 6, 20, 34);
  wallG.lineBetween(4, 20, 36, 20);
  wallG.generateTexture('icon_wall', s, s);
  wallG.destroy();

  const turretG = scene.add.graphics().setVisible(false);
  turretG.fillStyle(0x884400);
  turretG.fillRect(14, 22, 12, 14);
  turretG.fillStyle(0x555555);
  turretG.fillCircle(20, 18, 8);
  turretG.fillStyle(0x333333);
  turretG.fillRect(18, 4, 4, 14);
  turretG.generateTexture('icon_turret', s, s);
  turretG.destroy();

  const gateG = scene.add.graphics().setVisible(false);
  gateG.fillStyle(0x9b7653);
  gateG.fillRect(6, 8, 28, 26);
  gateG.fillStyle(0x7a5c3c);
  gateG.fillRect(6, 8, 28, 6);
  gateG.lineStyle(1, 0x4a3826);
  gateG.strokeRect(6, 8, 28, 26);
  gateG.lineBetween(20, 8, 20, 34);
  gateG.generateTexture('icon_gate', s, s);
  gateG.destroy();

  const radioG = scene.add.graphics().setVisible(false);
  radioG.fillStyle(0x888888);
  radioG.fillRect(10, 28, 20, 8);
  radioG.lineStyle(2, 0xffffff);
  radioG.strokeCircle(20, 18, 8);
  radioG.lineBetween(20, 10, 20, 2);
  radioG.lineBetween(20, 2, 26, 2);
  radioG.generateTexture('icon_radio', s, s);
  radioG.destroy();
}

function seededRandom(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1234) * 43758.5453;
  return n - Math.floor(n);
}

function adjustBrightness(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

export function createTileTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  // === 8 grass variants ===
  const grassBaseColors = [0x336b25, 0x458a35, 0x2d4f1f, 0x3e6830, 0x2a5020];
  const grassFlowerColors = [0xffee44, 0xffffff, 0xff8844, 0xee66aa];
  const grassBaseSeed = 42;

  for (let v = 0; v < 8; v++) {
    const baseGreen = adjustBrightness(0x3a5a2a, 0.9 + v * 0.03);
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(baseGreen);
    g.fillRect(0, 0, s, s);

    const seed = grassBaseSeed + v * 137;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const r = seededRandom(x, y, seed);
        if (r < 0.4) {
          const ci = Math.floor(seededRandom(x + 100, y + 100, seed) * grassBaseColors.length);
          g.fillStyle(grassBaseColors[ci]);
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // Occasional flowers (2-4 per tile)
    const flowerCount = 2 + Math.floor(seededRandom(v, 0, seed + 999) * 3);
    for (let f = 0; f < flowerCount; f++) {
      const fx = Math.floor(seededRandom(v, f * 7, seed + 500) * (s - 4)) + 2;
      const fy = Math.floor(seededRandom(v, f * 13, seed + 600) * (s - 4)) + 2;
      const fc = grassFlowerColors[Math.floor(seededRandom(v, f, seed + 700) * grassFlowerColors.length)];
      g.fillStyle(fc, 0.9);
      g.fillCircle(fx, fy, 1.5);
    }

    g.generateTexture(`tile_grass_${v}`, s, s);
    g.destroy();
  }

  // Keep original grass key as fallback
  const fallbackG = scene.add.graphics().setVisible(false);
  fallbackG.fillStyle(0x3a5a2a);
  fallbackG.fillRect(0, 0, s, s);
  fallbackG.generateTexture('tile_grass', s, s);
  fallbackG.destroy();

  // === Stone ===
  const stoneG = scene.add.graphics().setVisible(false);
  stoneG.fillStyle(0x4a4a4a);
  stoneG.fillRect(0, 0, s, s);
  const stoneColors = [0x555555, 0x606060, 0x404040, 0x505050, 0x3a3a3a, 0x6a6a6a, 0x454545];
  const stoneSeed = 89;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = seededRandom(x, y, stoneSeed);
      if (r < 0.4) {
        const ci = Math.floor(seededRandom(x + 100, y + 100, stoneSeed) * stoneColors.length);
        stoneG.fillStyle(stoneColors[ci]);
        stoneG.fillRect(x, y, 1, 1);
      }
    }
  }
  stoneG.generateTexture('tile_stone', s, s);
  stoneG.destroy();

  // === Sand ===
  const sandG = scene.add.graphics().setVisible(false);
  sandG.fillStyle(0xc2b280);
  sandG.fillRect(0, 0, s, s);
  const sandColors = [0xd4c490, 0xb8a870, 0xc9ba88, 0xa89860, 0xd0c080];
  const sandSeed = 137;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = seededRandom(x, y, sandSeed);
      if (r < 0.4) {
        const ci = Math.floor(seededRandom(x + 100, y + 100, sandSeed) * sandColors.length);
        sandG.fillStyle(sandColors[ci]);
        sandG.fillRect(x, y, 1, 1);
      }
    }
  }
  sandG.generateTexture('tile_sand', s, s);
  sandG.destroy();

  // === Water (3 phases for animation) ===
  for (let phase = 0; phase < 3; phase++) {
    const wG = scene.add.graphics().setVisible(false);
    wG.fillStyle(0x3b7dd8);
    wG.fillRect(0, 0, s, s);

    const offset = phase * 8;
    wG.lineStyle(2, 0x5599ee, 0.5);
    wG.beginPath();
    wG.moveTo(0, 10 + offset % 6);
    wG.lineTo(12, 8 + offset % 6);
    wG.lineTo(25, 12 + offset % 6);
    wG.lineTo(38, 9 + offset % 6);
    wG.lineTo(50, 11 + offset % 6);
    wG.strokePath();

    wG.beginPath();
    wG.moveTo(0, 26 + offset % 8);
    wG.lineTo(10, 24 + offset % 8);
    wG.lineTo(22, 28 + offset % 8);
    wG.lineTo(35, 25 + offset % 8);
    wG.lineTo(50, 27 + offset % 8);
    wG.strokePath();

    wG.lineStyle(1, 0x77bbee, 0.3);
    wG.beginPath();
    wG.moveTo(0, 40 + offset % 5);
    wG.lineTo(15, 38 + offset % 5);
    wG.lineTo(30, 42 + offset % 5);
    wG.lineTo(45, 39 + offset % 5);
    wG.lineTo(50, 41 + offset % 5);
    wG.strokePath();

    wG.generateTexture(`tile_water_${phase}`, s, s);
    wG.destroy();
  }

  // Original water key as fallback
  const waterFallback = scene.add.graphics().setVisible(false);
  waterFallback.fillStyle(0x3b7dd8);
  waterFallback.fillRect(0, 0, s, s);
  waterFallback.lineStyle(2, 0x5599ee, 0.5);
  waterFallback.beginPath();
  waterFallback.moveTo(0, 12);
  waterFallback.lineTo(12, 10);
  waterFallback.lineTo(25, 14);
  waterFallback.lineTo(38, 11);
  waterFallback.lineTo(50, 13);
  waterFallback.strokePath();
  waterFallback.generateTexture('tile_water', s, s);
  waterFallback.destroy();

  // === Dirt ===
  const dirtG = scene.add.graphics().setVisible(false);
  dirtG.fillStyle(0x8b7355);
  dirtG.fillRect(0, 0, s, s);
  const dirtColors = [0x7a6548, 0x9c8562, 0x6e5a40, 0x8a7050, 0x786245];
  const dirtSeed = 256;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const r = seededRandom(x, y, dirtSeed);
      if (r < 0.4) {
        const ci = Math.floor(seededRandom(x + 100, y + 100, dirtSeed) * dirtColors.length);
        dirtG.fillStyle(dirtColors[ci]);
        dirtG.fillRect(x, y, 1, 1);
      }
    }
  }
  dirtG.generateTexture('tile_dirt', s, s);
  dirtG.destroy();
}

export function createDecorationTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;

  // === Tropical tree — split into bottom (trunk) and top (canopy) ===
  const treeW = 70;
  const treeH = 90;
  for (let v = 0; v < 3; v++) {
    const seed = 1000 + v * 31;
    const cx = treeW / 2;
    const baseY = treeH - 8;

    const trunkColor = 0x5a4a3a;
    const trunkDark = 0x3a2a1a;
    const trunkLight = 0x6a5a4a;

    const forkY = baseY - 35;

    const branchAngles = [
      { angle: -0.9, len: 28 + v * 2 },
      { angle: -0.4, len: 24 + v },
      { angle: 0.0, len: 20 },
      { angle: 0.4, len: 24 + v },
      { angle: 0.9, len: 28 + v * 2 },
    ];

    const leafColors = [0x2a5a1a, 0x3a7a2a, 0x2d6b1e, 0x1e5010, 0x4a8a3a];
    const highlightColors = [0x5a9a4a, 0x6aaa5a, 0x4a8a3a];

    // === BOTTOM: trunk + branches + lower leaf clusters ===
    const gBot = scene.add.graphics().setVisible(false);

    // Trunk
    gBot.fillStyle(trunkColor);
    gBot.fillRect(cx - 4, baseY - 35, 8, 35);
    gBot.fillStyle(trunkLight, 0.4);
    gBot.fillRect(cx - 2, baseY - 30, 3, 25);
    gBot.fillStyle(trunkDark, 0.3);
    gBot.fillRect(cx + 2, baseY - 28, 2, 22);

    // Roots
    gBot.lineStyle(3, trunkColor);
    gBot.lineBetween(cx - 4, baseY, cx - 10, baseY + 4);
    gBot.lineBetween(cx + 4, baseY, cx + 10, baseY + 4);
    gBot.lineBetween(cx - 3, baseY + 1, cx - 7, baseY + 6);
    gBot.lineBetween(cx + 3, baseY + 1, cx + 8, baseY + 5);

    // Branches
    gBot.lineStyle(3, trunkColor);
    for (const b of branchAngles) {
      const ex = cx + Math.sin(b.angle) * b.len;
      const ey = forkY - Math.cos(b.angle) * b.len * 0.6;
      gBot.lineBetween(cx, forkY, ex, ey);
    }

    // Lower leaf clusters (bottom half of canopy)
    for (let i = 0; i < branchAngles.length; i++) {
      const b = branchAngles[i];
      const bx = cx + Math.sin(b.angle) * b.len;
      const by = forkY - Math.cos(b.angle) * b.len * 0.6;

      // Only draw clusters below the midline
      if (by < forkY - 10) continue;

      const clusterSize = 12 + seededRandom(v, i, seed + 50) * 6;
      const leafColor = leafColors[Math.floor(seededRandom(v, i, seed + 60) * leafColors.length)];
      gBot.fillStyle(leafColor, 0.85);
      gBot.fillCircle(bx, by, clusterSize);
      gBot.fillCircle(bx - 5, by + 3, clusterSize * 0.7);
      gBot.fillCircle(bx + 4, by + 2, clusterSize * 0.6);
    }

    // Central lower mass
    gBot.fillStyle(0x2a5a1a, 0.6);
    gBot.fillCircle(cx, forkY, 16);

    gBot.generateTexture(`dec_palm_${v}_bottom`, treeW, treeH);
    gBot.destroy();

    // === TOP: upper canopy only (covers settlers) ===
    const gTop = scene.add.graphics().setVisible(false);

    for (let i = 0; i < branchAngles.length; i++) {
      const b = branchAngles[i];
      const bx = cx + Math.sin(b.angle) * b.len;
      const by = forkY - Math.cos(b.angle) * b.len * 0.6;

      // Only draw clusters above the midline
      if (by >= forkY - 10) continue;

      const clusterSize = 12 + seededRandom(v, i, seed + 50) * 6;
      const leafColor = leafColors[Math.floor(seededRandom(v, i, seed + 60) * leafColors.length)];
      gTop.fillStyle(leafColor, 0.85);
      gTop.fillCircle(bx, by, clusterSize);
      gTop.fillCircle(bx - 5, by + 3, clusterSize * 0.7);
      gTop.fillCircle(bx + 4, by + 2, clusterSize * 0.6);

      // Highlight
      const hlColor = highlightColors[Math.floor(seededRandom(v, i, seed + 70) * highlightColors.length)];
      gTop.fillStyle(hlColor, 0.5);
      gTop.fillCircle(bx - 4, by - 4, clusterSize * 0.5);
    }

    // Central upper mass
    gTop.fillStyle(0x2a5a1a, 0.6);
    gTop.fillCircle(cx, forkY - 15, 18);
    gTop.fillStyle(0x3a7a2a, 0.5);
    gTop.fillCircle(cx - 6, forkY - 20, 12);
    gTop.fillCircle(cx + 7, forkY - 18, 10);
    gTop.fillStyle(0x5a9a4a, 0.3);
    gTop.fillCircle(cx - 3, forkY - 25, 14);

    gTop.generateTexture(`dec_palm_${v}_top`, treeW, treeH);
    gTop.destroy();
  }

  // === Bush (30×25) ===
  for (let v = 0; v < 3; v++) {
    const g = scene.add.graphics().setVisible(false);
    const bw = 30;
    const bh = 25;
    const seed = 2000 + v * 31;
    const shades = [0x2d6b1e, 0x3a7a2a, 0x256018];
    // Main bush body
    g.fillStyle(shades[0]);
    g.fillCircle(bw / 2, bh / 2 + 3, 11);
    g.fillStyle(shades[1]);
    g.fillCircle(bw / 2 - 4, bh / 2, 8);
    g.fillStyle(shades[2]);
    g.fillCircle(bw / 2 + 5, bh / 2 + 2, 7);
    // Highlight
    g.fillStyle(0x4a9a3a, 0.5);
    g.fillCircle(bw / 2 - 2, bh / 2 - 3, 5);
    // Small berries
    if (seededRandom(v, 0, seed) > 0.5) {
      g.fillStyle(0xcc3333);
      g.fillCircle(bw / 2 + 6, bh / 2 - 2, 2);
      g.fillCircle(bw / 2 - 5, bh / 2 + 4, 2);
    }
    g.generateTexture(`dec_bush_${v}`, bw, bh);
    g.destroy();
  }

  // === Flower patch (20×20) ===
  const flowerPalette = [
    [0xffee44, 0xff6644],
    [0xff88cc, 0xee44aa],
    [0x44aaff, 0x2266ee],
  ];
  for (let v = 0; v < 3; v++) {
    const g = scene.add.graphics().setVisible(false);
    const fw = 20;
    const fh = 20;
    const seed = 3000 + v * 31;
    const colors = flowerPalette[v % flowerPalette.length];

    // Leaves
    g.fillStyle(0x3a7a2a, 0.6);
    g.fillCircle(fw / 2, fh / 2 + 4, 6);

    // Flowers (3-5)
    const count = 3 + Math.floor(seededRandom(v, 0, seed) * 3);
    for (let f = 0; f < count; f++) {
      const fx = fw / 2 + (seededRandom(v, f, seed + 10) - 0.5) * 14;
      const fy = fh / 2 + (seededRandom(v, f, seed + 20) - 0.5) * 10;
      const fc = colors[f % 2];
      g.fillStyle(fc);
      g.fillCircle(fx, fy, 2.5);
      g.fillStyle(0xffff88);
      g.fillCircle(fx, fy, 1);
    }
    g.generateTexture(`dec_flower_${v}`, fw, fh);
    g.destroy();
  }

  // === Small rock (16×12) ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const rw = 16;
    const rh = 12;
    const seed = 4000 + v * 31;
    const baseGray = 0x777777 + v * 0x111111;
    g.fillStyle(baseGray);
    g.fillCircle(rw / 2, rh / 2 + 1, 6);
    g.fillStyle(0x999999, 0.4);
    g.fillCircle(rw / 2 - 2, rh / 2 - 1, 3);
    g.lineStyle(1, 0x555555, 0.6);
    g.strokeCircle(rw / 2, rh / 2 + 1, 6);
    g.generateTexture(`dec_rock_s_${v}`, rw, rh);
    g.destroy();
  }

  // === Large rock (28×24) ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const rw = 28;
    const rh = 24;
    const seed = 5000 + v * 31;
    const baseGray = 0x666666 + v * 0x111111;
    g.fillStyle(baseGray);
    g.fillCircle(rw / 2, rh / 2 + 2, 10);
    g.fillCircle(rw / 2 - 6, rh / 2, 7);
    g.fillStyle(0x888888, 0.4);
    g.fillCircle(rw / 2 - 3, rh / 2 - 3, 5);
    g.lineStyle(1, 0x444444, 0.5);
    g.strokeCircle(rw / 2, rh / 2 + 2, 10);
    g.generateTexture(`dec_rock_l_${v}`, rw, rh);
    g.destroy();
  }

  // === Shore plant (24×20) ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const sw = 24;
    const sh = 20;
    const seed = 6000 + v * 31;
    // Reeds
    g.lineStyle(2, 0x5a8a3a);
    for (let r = 0; r < 3; r++) {
      const rx = sw / 2 - 4 + r * 4;
      g.lineBetween(rx, sh, rx + (seededRandom(v, r, seed) - 0.5) * 4, 4);
    }
    // Leaves
    g.fillStyle(0x4a7a2a, 0.8);
    g.fillCircle(sw / 2, sh / 2, 5);
    g.generateTexture(`dec_shore_${v}`, sw, sh);
    g.destroy();
  }

  // === Tall grass (14×28) ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const gw = 14;
    const gh = 28;
    const seed = 7000 + v * 31;
    const greens = [0x4a8a3a, 0x3a7a2a, 0x5a9a4a];
    g.lineStyle(2, greens[0]);
    g.lineBetween(gw / 2 - 2, gh, gw / 2 - 4 + seededRandom(v, 0, seed) * 3, 3);
    g.lineStyle(2, greens[1]);
    g.lineBetween(gw / 2, gh, gw / 2 + seededRandom(v, 1, seed) * 3, 5);
    g.lineStyle(2, greens[2]);
    g.lineBetween(gw / 2 + 2, gh, gw / 2 + 1 + seededRandom(v, 2, seed) * 3, 2);
    // Tips
    g.fillStyle(0x6aaa5a);
    g.fillCircle(gw / 2 - 3, 3, 2);
    g.fillCircle(gw / 2 + 2, 5, 2);
    g.generateTexture(`dec_grass_tall_${v}`, gw, gh);
    g.destroy();
  }
}
