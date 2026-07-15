/**
 * TextureGenerator v3 — Stardew Valley style trees
 * Большие, детальные деревья с толстыми стволами и пышными кронами
 *
 * Размеры:
 *   Palm:       100×140  (2×3 тайла)
 *   Coconut:    90×130
 *   Tall palm:  80×170
 *   Round tree: 110×130  (новый тип!)
 *   Fern:       44×38
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

// ─── Helpers ────────────────────────────────────────────────
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

// ─── Building icons (unchanged) ─────────────────────────────
export function createBuildingIcons(scene: Phaser.Scene): void {
  const s = 40;
  const icons: [string, (g: Phaser.GameObjects.Graphics) => void][] = [
    ['icon_house', g => { g.fillStyle(0x8b4513); g.fillRect(6, 18, 28, 18); g.fillStyle(0xcc4444); g.fillTriangle(20, 4, 4, 20, 36, 20); g.fillStyle(0x654321); g.fillRect(16, 26, 8, 10); }],
    ['icon_warehouse', g => { g.fillStyle(0x778899); g.fillRect(4, 14, 32, 22); g.fillStyle(0x556677); g.fillRect(4, 12, 32, 4); g.lineStyle(1, 0x445566); g.strokeRect(4, 14, 32, 22); g.fillStyle(0x99aabb); g.fillRect(14, 22, 12, 14); }],
    ['icon_farm', g => { g.fillStyle(0x8b7355); g.fillRect(2, 28, 36, 8); g.fillStyle(0x44aa44); g.fillCircle(12, 18, 6); g.fillCircle(28, 18, 6); g.fillStyle(0x338833); g.fillRect(11, 18, 2, 12); g.fillRect(27, 18, 2, 12); g.fillStyle(0xffcc00); g.fillCircle(12, 14, 3); g.fillCircle(28, 14, 3); }],
    ['icon_workshop', g => { g.fillStyle(0x808080); g.fillRect(8, 8, 24, 24); g.fillStyle(0x606060); g.fillRect(8, 8, 24, 6); g.fillStyle(0xaaaaaa); g.fillRect(12, 20, 16, 8); g.lineStyle(2, 0xffd700); g.strokeCircle(20, 24, 4); }],
    ['icon_wall', g => { g.fillStyle(0x808080); g.fillRect(4, 6, 32, 28); g.fillStyle(0x999999); g.fillRect(4, 6, 32, 6); g.lineStyle(1, 0x555555); g.strokeRect(4, 6, 32, 28); g.lineBetween(20, 6, 20, 34); g.lineBetween(4, 20, 36, 20); }],
    ['icon_turret', g => { g.fillStyle(0x884400); g.fillRect(14, 22, 12, 14); g.fillStyle(0x555555); g.fillCircle(20, 18, 8); g.fillStyle(0x333333); g.fillRect(18, 4, 4, 14); }],
    ['icon_gate', g => { g.fillStyle(0x9b7653); g.fillRect(6, 8, 28, 26); g.fillStyle(0x7a5c3c); g.fillRect(6, 8, 28, 6); g.lineStyle(1, 0x4a3826); g.strokeRect(6, 8, 28, 26); g.lineBetween(20, 8, 20, 34); }],
    ['icon_radio', g => { g.fillStyle(0x888888); g.fillRect(10, 28, 20, 8); g.lineStyle(2, 0xffffff); g.strokeCircle(20, 18, 8); g.lineBetween(20, 10, 20, 2); g.lineBetween(20, 2, 26, 2); }],
  ];
  for (const [key, draw] of icons) {
    const g = scene.add.graphics().setVisible(false);
    draw(g);
    g.generateTexture(key, s, s);
    g.destroy();
  }
}

// ─── Tile textures (unchanged) ──────────────────────────────
export function createTileTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;
  const grassBase = [0x336b25, 0x458a35, 0x2d4f1f, 0x3e6830, 0x2a5020];
  const grassFlowers = [0xffee44, 0xffffff, 0xff8844, 0xee66aa];

  for (let v = 0; v < 8; v++) {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(adjustBrightness(0x3a5a2a, 0.9 + v * 0.03));
    g.fillRect(0, 0, s, s);
    const seed = 42 + v * 137;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (seededRandom(x, y, seed) < 0.4) {
        g.fillStyle(grassBase[Math.floor(seededRandom(x + 100, y + 100, seed) * grassBase.length)]);
        g.fillRect(x, y, 1, 1);
      }
    }
    const fc = 2 + Math.floor(seededRandom(v, 0, seed + 999) * 3);
    for (let f = 0; f < fc; f++) {
      g.fillStyle(grassFlowers[Math.floor(seededRandom(v, f, seed + 700) * grassFlowers.length)], 0.9);
      g.fillCircle(Math.floor(seededRandom(v, f * 7, seed + 500) * (s - 4)) + 2, Math.floor(seededRandom(v, f * 13, seed + 600) * (s - 4)) + 2, 1.5);
    }
    g.generateTexture(`tile_grass_${v}`, s, s); g.destroy();
  }

  const fb = scene.add.graphics().setVisible(false);
  fb.fillStyle(0x3a5a2a); fb.fillRect(0, 0, s, s);
  fb.generateTexture('tile_grass', s, s); fb.destroy();

  // === 8 stone variants ===
  const stoneBaseColors = [0x555555, 0x4a4a4a, 0x5a5a5a, 0x484848, 0x525252, 0x464646, 0x5e5e5e, 0x505050];
  const stoneCrackColor = 0x333333;
  const stoneMossColor = 0x4a6a3a;
  const stoneSeed = 89;

  for (let v = 0; v < 8; v++) {
    const baseColor = adjustBrightness(0x4a4a4a, 0.9 + v * 0.03);
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(baseColor);
    g.fillRect(0, 0, s, s);

    const seed = stoneSeed + v * 137;
    // Rock grain noise
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const r = seededRandom(x, y, seed);
        if (r < 0.45) {
          const ci = Math.floor(seededRandom(x + 100, y + 100, seed) * stoneBaseColors.length);
          g.fillStyle(stoneBaseColors[ci]);
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // Cracks (1-2 per tile)
    const crackCount = 1 + Math.floor(seededRandom(v, 0, seed + 500) * 2);
    g.lineStyle(1, stoneCrackColor, 0.4);
    for (let c = 0; c < crackCount; c++) {
      const cx = 8 + Math.floor(seededRandom(v, c, seed + 600) * (s - 16));
      const cy = 8 + Math.floor(seededRandom(v, c, seed + 700) * (s - 16));
      const len = 6 + Math.floor(seededRandom(v, c, seed + 800) * 8);
      const angle = seededRandom(v, c, seed + 900) * Math.PI;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      g.strokePath();
    }

    // Moss patches (20% chance)
    if (seededRandom(v, 0, seed + 950) < 0.2) {
      const mx = Math.floor(seededRandom(v, 1, seed + 960) * (s - 8)) + 4;
      const my = Math.floor(seededRandom(v, 2, seed + 970) * (s - 8)) + 4;
      g.fillStyle(stoneMossColor, 0.35);
      g.fillCircle(mx, my, 3 + seededRandom(v, 3, seed + 980) * 2);
    }

    g.generateTexture(`tile_stone_${v}`, s, s);
    g.destroy();
  }

  // Stone fallback
  const stoneFb = scene.add.graphics().setVisible(false);
  stoneFb.fillStyle(0x4a4a4a);
  stoneFb.fillRect(0, 0, s, s);
  stoneFb.generateTexture('tile_stone', s, s);
  stoneFb.destroy();

  // === 8 sand variants ===
  const sandBaseColors = [0xd4c490, 0xc9b878, 0xbfac68, 0xd8c898, 0xc4b470, 0xb8a860, 0xccc088, 0xd0c480];
  const sandPebleColors = [0x999080, 0x8a8578, 0xa09888, 0x7a7568, 0x888070];
  const sandSeed = 200;

  for (let v = 0; v < 8; v++) {
    const baseColor = adjustBrightness(0xc2b280, 0.92 + v * 0.025);
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(baseColor);
    g.fillRect(0, 0, s, s);

    const seed = sandSeed + v * 151;
    // Sand grain noise
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const r = seededRandom(x, y, seed);
        if (r < 0.45) {
          const ci = Math.floor(seededRandom(x + 100, y + 100, seed) * sandBaseColors.length);
          g.fillStyle(sandBaseColors[ci]);
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // Wind dune lines (subtle horizontal streaks)
    g.lineStyle(1, adjustBrightness(baseColor, 0.85), 0.3);
    for (let i = 0; i < 3; i++) {
      const y0 = 8 + Math.floor(seededRandom(v, i, seed + 500) * (s - 16));
      const xOff = seededRandom(v, i, seed + 600) * 4;
      g.beginPath();
      g.moveTo(xOff, y0);
      g.lineTo(s * 0.3 + xOff, y0 - 1);
      g.lineTo(s * 0.6 + xOff, y0 + 1);
      g.lineTo(s + xOff, y0);
      g.strokePath();
    }

    // Small pebbles (2-4 per tile)
    const pebbleCount = 2 + Math.floor(seededRandom(v, 0, seed + 888) * 3);
    for (let p = 0; p < pebbleCount; p++) {
      const px = Math.floor(seededRandom(v, p * 5, seed + 300) * (s - 4)) + 2;
      const py = Math.floor(seededRandom(v, p * 9, seed + 400) * (s - 4)) + 2;
      const pc = sandPebleColors[Math.floor(seededRandom(v, p, seed + 500) * sandPebleColors.length)];
      const size = 0.8 + seededRandom(v, p, seed + 600) * 1.2;
      g.fillStyle(pc, 0.7);
      g.fillCircle(px, py, size);
      // Tiny shadow
      g.fillStyle(0x000000, 0.12);
      g.fillCircle(px + 0.5, py + 0.5, size);
    }

    // Occasional shell (1 per tile, 30% chance)
    if (seededRandom(v, 0, seed + 999) < 0.3) {
      const sx = Math.floor(seededRandom(v, 1, seed + 700) * (s - 8)) + 4;
      const sy = Math.floor(seededRandom(v, 2, seed + 800) * (s - 8)) + 4;
      g.fillStyle(0xf0e8d8, 0.8);
      g.fillCircle(sx, sy, 2);
      g.fillStyle(0xe0d8c0, 0.5);
      g.fillCircle(sx - 0.5, sy - 0.5, 1);
    }

    g.generateTexture(`tile_sand_${v}`, s, s);
    g.destroy();
  }

  // Sand fallback
  const sandFb = scene.add.graphics().setVisible(false);
  sandFb.fillStyle(0xc2b280);
  sandFb.fillRect(0, 0, s, s);
  sandFb.generateTexture('tile_sand', s, s);
  sandFb.destroy();

  // Water
  for (let ph = 0; ph < 3; ph++) {
    const wg = scene.add.graphics().setVisible(false);
    wg.fillStyle(0x3b7dd8); wg.fillRect(0, 0, s, s);
    const off = ph * 8;
    wg.lineStyle(2, 0x5599ee, 0.5);
    wg.beginPath(); wg.moveTo(0, 10 + off % 6); wg.lineTo(12, 8 + off % 6); wg.lineTo(25, 12 + off % 6); wg.lineTo(38, 9 + off % 6); wg.lineTo(50, 11 + off % 6); wg.strokePath();
    wg.beginPath(); wg.moveTo(0, 26 + off % 8); wg.lineTo(10, 24 + off % 8); wg.lineTo(22, 28 + off % 8); wg.lineTo(35, 25 + off % 8); wg.lineTo(50, 27 + off % 8); wg.strokePath();
    wg.generateTexture(`tile_water_${ph}`, s, s); wg.destroy();
  }
  const wf = scene.add.graphics().setVisible(false);
  wf.fillStyle(0x3b7dd8); wf.fillRect(0, 0, s, s);
  wf.lineStyle(2, 0x5599ee, 0.5); wf.beginPath(); wf.moveTo(0, 12); wf.lineTo(12, 10); wf.lineTo(25, 14); wf.lineTo(38, 11); wf.lineTo(50, 13); wf.strokePath();
  wf.generateTexture('tile_water', s, s); wf.destroy();

  // === 8 dirt variants ===
  const dirtBaseColors = [0x8b7355, 0x7a6548, 0x9c8562, 0x6e5a40, 0x8a7050, 0x786245, 0x907858, 0x846c4c];
  const dirtPebbleColors = [0x6a5a40, 0x7a6a50, 0x5a4a30, 0x8a7a60];
  const dirtSeed = 256;

  for (let v = 0; v < 8; v++) {
    const baseColor = adjustBrightness(0x8b7355, 0.9 + v * 0.03);
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(baseColor);
    g.fillRect(0, 0, s, s);

    const seed = dirtSeed + v * 163;
    // Soil grain noise
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const r = seededRandom(x, y, seed);
        if (r < 0.45) {
          const ci = Math.floor(seededRandom(x + 100, y + 100, seed) * dirtBaseColors.length);
          g.fillStyle(dirtBaseColors[ci]);
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // Small pebbles (1-3 per tile)
    const pebbleCount = 1 + Math.floor(seededRandom(v, 0, seed + 500) * 3);
    for (let p = 0; p < pebbleCount; p++) {
      const px = Math.floor(seededRandom(v, p * 7, seed + 600) * (s - 4)) + 2;
      const py = Math.floor(seededRandom(v, p * 11, seed + 700) * (s - 4)) + 2;
      const pc = dirtPebbleColors[Math.floor(seededRandom(v, p, seed + 800) * dirtPebbleColors.length)];
      const size = 1 + seededRandom(v, p, seed + 900) * 1.5;
      g.fillStyle(pc, 0.6);
      g.fillCircle(px, py, size);
    }

    // Root/plant traces (15% chance)
    if (seededRandom(v, 0, seed + 950) < 0.15) {
      g.lineStyle(1, 0x5a4a30, 0.3);
      const rx = Math.floor(seededRandom(v, 1, seed + 960) * s);
      const ry = Math.floor(seededRandom(v, 2, seed + 970) * s);
      g.lineBetween(rx, ry, rx + 4 + seededRandom(v, 3, seed + 980) * 6, ry + (seededRandom(v, 4, seed + 990) - 0.5) * 4);
    }

    g.generateTexture(`tile_dirt_${v}`, s, s);
    g.destroy();
  }

  // Dirt fallback
  const dirtFb = scene.add.graphics().setVisible(false);
  dirtFb.fillStyle(0x8b7355);
  dirtFb.fillRect(0, 0, s, s);
  dirtFb.generateTexture('tile_dirt', s, s);
  dirtFb.destroy();
}

// ─── Helper: draw a leaf cluster ────────────────────────────
function drawLeafCluster(g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, colors: number[], seed: number, v: number, idx: number): void {
  const mainColor = colors[Math.floor(seededRandom(v, idx, seed) * colors.length)];

  // Shadow under cluster
  g.fillStyle(0x1a1a0a, 0.2);
  g.fillCircle(cx + 2, cy + 3, radius * 0.9);

  // Outline
  g.lineStyle(1.5, 0x1a1a0a, 0.45);
  g.strokeCircle(cx, cy, radius);

  // Main mass
  g.fillStyle(mainColor, 0.92);
  g.fillCircle(cx, cy, radius);

  // Sub-clusters for volume
  for (let i = 0; i < 4; i++) {
    const angle = seededRandom(v, idx + i * 10, seed + 100) * Math.PI * 2;
    const dist = radius * 0.4 + seededRandom(v, idx + i * 20, seed + 200) * radius * 0.4;
    const r2 = radius * (0.5 + seededRandom(v, idx + i * 30, seed + 300) * 0.3);
    const c2 = colors[Math.floor(seededRandom(v, idx + i * 40, seed + 400) * colors.length)];
    g.fillStyle(c2, 0.8);
    g.fillCircle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r2);
  }

  // Highlight on top-left
  const hlColor = adjustBrightness(mainColor, 1.35);
  g.fillStyle(hlColor, 0.4);
  g.fillCircle(cx - radius * 0.25, cy - radius * 0.35, radius * 0.45);

  // Darker tips on bottom-right
  const darkColor = adjustBrightness(mainColor, 0.65);
  g.fillStyle(darkColor, 0.3);
  g.fillCircle(cx + radius * 0.2, cy + radius * 0.25, radius * 0.4);
}

// ─── Helper: draw trunk with bark texture ───────────────────
function drawTrunk(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, height: number, width: number, seed: number, v: number, curve: number = 0): void {
  const trunkColor = 0x4a3525;
  const trunkLight = 0x6a5545;
  const trunkDark = 0x2a1a0a;
  const barkColor = 0x3a2a18;

  // Main trunk body
  for (let y = 0; y < height; y++) {
    const t = y / height;
    const curveX = Math.sin(t * curve) * 4;
    const w = width * (1 - t * 0.15); // slight taper
    const x = cx + curveX - w / 2;

    // Base color
    g.fillStyle(trunkColor);
    g.fillRect(x, baseY - y, w, 2);

    // Light edge
    g.fillStyle(trunkLight, 0.3);
    g.fillRect(x, baseY - y, w * 0.25, 2);

    // Dark edge
    g.fillStyle(trunkDark, 0.25);
    g.fillRect(x + w * 0.8, baseY - y, w * 0.2, 2);
  }

  // Bark texture lines (horizontal rings)
  g.lineStyle(1, barkColor, 0.35);
  for (let i = 0; i < height; i += 4 + Math.floor(seededRandom(v, i, seed + 500) * 3)) {
    const t = i / height;
    const curveX = Math.sin(t * curve) * 4;
    const w = width * (1 - t * 0.15);
    g.lineBetween(cx + curveX - w / 2, baseY - i, cx + curveX + w / 2, baseY - i);
  }

  // Knots
  if (seededRandom(v, 0, seed + 700) > 0.5) {
    const knotY = baseY - height * (0.3 + seededRandom(v, 1, seed + 800) * 0.3);
    const knotX = cx + (seededRandom(v, 2, seed + 900) - 0.5) * width * 0.4;
    g.fillStyle(trunkDark, 0.4);
    g.fillEllipse(knotX, knotY, 4, 6);
  }
}

// ─── Helper: draw roots ─────────────────────────────────────
function drawRoots(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, width: number, seed: number, v: number): void {
  // Shadow at base
  g.fillStyle(0x1a1a0a, 0.25);
  g.fillEllipse(cx, baseY + 4, width * 2.5, 6);

  const rootColor = 0x3a2a18;
  g.lineStyle(2.5, rootColor);
  const rootCount = 3 + Math.floor(seededRandom(v, 0, seed + 600) * 3);
  for (let i = 0; i < rootCount; i++) {
    const angle = -0.6 + (i / (rootCount - 1)) * 1.2;
    const len = 8 + seededRandom(v, i, seed + 650) * 8;
    g.lineBetween(cx, baseY, cx + Math.sin(angle) * len, baseY + Math.abs(Math.cos(angle)) * len * 0.4 + 3);
  }
}

// ─── T-Rex sprite (split bottom/top like trees) ───────────
export function createTrexSprite(scene: Phaser.Scene): void {
  if (scene.textures.exists('trex')) {
    scene.textures.remove('trex');
  }

  const fw = 64;
  const fh = 64;
  const idleFrames = 9;
  const walkFrames = 9;
  const attackFrames = 9;
  const totalFrames = idleFrames + walkFrames + attackFrames;

  const htmlCanvas = document.createElement('canvas');
  htmlCanvas.width = fw * totalFrames;
  htmlCanvas.height = fh;
  const ctx = htmlCanvas.getContext('2d')!;

  const BODY = '#c8a060';
  const BODY_DARK = '#a07840';
  const BODY_SHADOW = '#8a6830';
  const BELLY = '#d8b878';
  const OUTLINE = '#3a2a18';
  const EYE_W = '#ffffff';
  const EYE_B = '#1a1a1a';
  const MOUTH_IN = '#c04030';
  const TOOTH = '#ffffff';
  const TONGUE = '#d04838';

  function drawTrexAt(ox: number, jawOpen: number, legShift: number, bob: number) {
    const cx = ox + 32;
    const cy = 36 + bob;

    // TAIL
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 2);
    ctx.quadraticCurveTo(cx - 26, cy - 2, cx - 30, cy + 1);
    ctx.quadraticCurveTo(cx - 26, cy + 6, cx - 14, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BODY_SHADOW;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 5);
    ctx.quadraticCurveTo(cx - 24, cy + 4, cx - 28, cy + 2);
    ctx.quadraticCurveTo(cx - 24, cy + 6, cx - 14, cy + 6);
    ctx.closePath();
    ctx.fill();

    // BODY
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 3, 10, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BODY_SHADOW;
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 4, 12, 4, -0.2, 0, Math.PI);
    ctx.fill();

    // LEGS
    const legAngle = legShift * 0.15;
    ctx.save();
    ctx.translate(cx - 6, cy + 8);
    ctx.fillStyle = BODY_DARK;
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(3, 10); ctx.lineTo(-3, 10);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(0, 10); ctx.rotate(legAngle);
    ctx.fillStyle = BODY_DARK;
    ctx.fillRect(-2, 0, 4, 8);
    ctx.beginPath();
    ctx.moveTo(-4, 8); ctx.lineTo(6, 8); ctx.lineTo(6, 10); ctx.lineTo(-4, 10);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-5, 9, 3, 2);
    ctx.fillRect(0, 9, 3, 2);
    ctx.fillRect(5, 9, 2, 2);
    ctx.restore(); ctx.restore();

    ctx.save();
    ctx.translate(cx + 4, cy + 7);
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(3, 10); ctx.lineTo(-3, 10);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(0, 10); ctx.rotate(-legAngle);
    ctx.fillStyle = BODY;
    ctx.fillRect(-2, 0, 4, 8);
    ctx.beginPath();
    ctx.moveTo(-4, 8); ctx.lineTo(6, 8); ctx.lineTo(6, 10); ctx.lineTo(-4, 10);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-5, 9, 3, 2);
    ctx.fillRect(0, 9, 3, 2);
    ctx.fillRect(5, 9, 2, 2);
    ctx.restore(); ctx.restore();

    // NECK
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - 6); ctx.lineTo(cx + 16, cy - 14); ctx.lineTo(cx + 12, cy - 2);
    ctx.closePath(); ctx.fill();

    // HEAD
    const headX = cx + 18, headY = cy - 16;
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(headX - 8, headY); ctx.lineTo(headX + 8, headY - 2);
    ctx.lineTo(headX + 10, headY + 4); ctx.lineTo(headX - 8, headY + 6);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX + 4, headY + 3); ctx.lineTo(headX + 14, headY + 2);
    ctx.lineTo(headX + 14, headY + 6); ctx.lineTo(headX + 4, headY + 6);
    ctx.closePath(); ctx.fill();

    // JAW
    ctx.fillStyle = BODY_DARK;
    ctx.beginPath();
    ctx.moveTo(headX - 4, headY + 7); ctx.lineTo(headX + 12, headY + 6);
    ctx.lineTo(headX + 10, headY + 6 + jawOpen * 8); ctx.lineTo(headX - 4, headY + 8 + jawOpen * 5);
    ctx.closePath(); ctx.fill();

    if (jawOpen > 0.15) {
      ctx.fillStyle = MOUTH_IN;
      ctx.beginPath();
      ctx.moveTo(headX + 2, headY + 6); ctx.lineTo(headX + 12, headY + 6);
      ctx.lineTo(headX + 10, headY + 6 + jawOpen * 6); ctx.lineTo(headX + 2, headY + 7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = TONGUE;
      ctx.beginPath();
      ctx.ellipse(headX + 6, headY + 7 + jawOpen * 3, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = TOOTH;
      for (let i = 0; i < 4; i++) {
        const tx = headX + 4 + i * 2.5;
        ctx.beginPath();
        ctx.moveTo(tx, headY + 5.5); ctx.lineTo(tx + 1.5, headY + 5.5); ctx.lineTo(tx + 0.75, headY + 7.5);
        ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 3; i++) {
        const tx = headX + 5 + i * 2.5;
        ctx.beginPath();
        ctx.moveTo(tx, headY + 6 + jawOpen * 6); ctx.lineTo(tx + 1.5, headY + 6 + jawOpen * 6);
        ctx.lineTo(tx + 0.75, headY + 4.5 + jawOpen * 6);
        ctx.closePath(); ctx.fill();
      }
    }

    // EYE
    ctx.fillStyle = EYE_W;
    ctx.beginPath(); ctx.arc(headX + 2, headY + 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = EYE_B;
    ctx.beginPath(); ctx.arc(headX + 3, headY + 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = BODY_DARK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(headX - 4, headY - 1); ctx.lineTo(headX + 6, headY - 3); ctx.stroke();
    ctx.fillStyle = BODY_SHADOW;
    ctx.beginPath(); ctx.arc(headX + 12, headY + 3, 1, 0, Math.PI * 2); ctx.fill();

    // ARMS
    ctx.fillStyle = BODY_DARK;
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - 2); ctx.lineTo(cx + 14, cy + 1);
    ctx.lineTo(cx + 13, cy + 3); ctx.lineTo(cx + 10, cy);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = BODY_SHADOW; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx + 13, cy + 2); ctx.lineTo(cx + 16, cy + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 13, cy + 3); ctx.lineTo(cx + 15, cy + 6); ctx.stroke();

    // OUTLINE
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, 16, 11, 0, 0, Math.PI * 2); ctx.stroke();
  }

  for (let f = 0; f < idleFrames; f++) {
    const ox = f * fw; ctx.save();
    const t = (f / idleFrames) * Math.PI * 2;
    drawTrexAt(ox, 0.03 + Math.sin(t * 0.5) * 0.05, Math.sin(t * 0.3) * 0.5, Math.sin(t) * 1.5);
    ctx.restore();
  }
  for (let f = 0; f < walkFrames; f++) {
    const ox = (idleFrames + f) * fw; ctx.save();
    const t = (f / walkFrames) * Math.PI * 2;
    drawTrexAt(ox, 0.05 + Math.sin(t * 2) * 0.04, Math.sin(t) * 4, Math.abs(Math.sin(t)) * -2);
    ctx.restore();
  }
  for (let f = 0; f < attackFrames; f++) {
    const ox = (idleFrames + walkFrames + f) * fw; ctx.save();
    const t = f / attackFrames;
    const jawOpen = t < 0.5 ? t * 1.6 : (1 - t) * 1.6;
    const bob = t < 0.4 ? -t * 3 : -(0.4 * 3) + (t - 0.4) * 5;
    const legShift = t < 0.4 ? -t * 4 : -1.6 + (t - 0.4) * 4;
    drawTrexAt(ox, jawOpen, legShift, bob);
    ctx.restore();
  }

  scene.textures.addSpriteSheet('trex', htmlCanvas as any, { frameWidth: fw, frameHeight: fh });
}

// ─── Decoration textures ────────────────────────────────────
export function createDecorationTextures(scene: Phaser.Scene): void {

  // ══════════════════════════════════════════════════════════
  // === PALM TREE (3 variants) — large, Stardew-style ===
  // ══════════════════════════════════════════════════════════
  const palmW = 100;
  const palmH = 140;
  const palmLeafColors = [0x164010, 0x1e5518, 0x256a1e, 0x1a4a14, 0x2a5a20];
  const palmHLColors = [0x3a7a30, 0x4a8a40, 0x307028];

  for (let v = 0; v < 3; v++) {
    const seed = 1000 + v * 37;
    const cx = palmW / 2;
    const baseY = palmH - 10;
    const trunkH = 65 + v * 5;
    const trunkW = 10 + v * 2;
    const crownY = baseY - trunkH;

    // ── BOTTOM: trunk + roots + lower canopy ──
    const gBot = scene.add.graphics().setVisible(false);

    drawTrunk(gBot, cx, baseY, trunkH, trunkW, seed, v, 0.5 + v * 0.3);
    drawRoots(gBot, cx, baseY, trunkW, seed, v);

    // Branches from crown
    const branchAngles = [-1.0, -0.5, 0, 0.5, 1.0];
    const branchLens = [32, 26, 22, 26, 32];

    gBot.lineStyle(3, 0x5a4a3a);
    for (let i = 0; i < branchAngles.length; i++) {
      const a = branchAngles[i] + seededRandom(v, i, seed + 10) * 0.2;
      const len = branchLens[i] + seededRandom(v, i, seed + 20) * 5;
      const ex = cx + Math.sin(a) * len;
      const ey = crownY + 5 - Math.cos(a) * len * 0.4 + len * 0.1;
      gBot.lineBetween(cx, crownY + 5, ex, ey);

      // Lower leaf clusters (below midline)
      if (ey > crownY - 5) {
        drawLeafCluster(gBot, ex, ey, 14 + seededRandom(v, i, seed + 30) * 6, palmLeafColors, seed + 100, v, i);
      }
    }

    // Central lower mass
    drawLeafCluster(gBot, cx, crownY, 18, palmLeafColors, seed + 200, v, 0);

    gBot.generateTexture(`dec_palm_${v}_bottom`, palmW, palmH);
    gBot.destroy();

    // ── TOP: upper canopy only ──
    const gTop = scene.add.graphics().setVisible(false);

    for (let i = 0; i < branchAngles.length; i++) {
      const a = branchAngles[i] + seededRandom(v, i, seed + 10) * 0.2;
      const len = branchLens[i] + seededRandom(v, i, seed + 20) * 5;
      const ex = cx + Math.sin(a) * len;
      const ey = crownY + 5 - Math.cos(a) * len * 0.4 + len * 0.1;

      if (ey < crownY - 5) {
        drawLeafCluster(gTop, ex, ey, 14 + seededRandom(v, i, seed + 30) * 6, palmLeafColors, seed + 100, v, i);
      }
    }

    // Central upper mass
    drawLeafCluster(gTop, cx, crownY - 12, 20, palmLeafColors, seed + 300, v, 0);
    drawLeafCluster(gTop, cx - 8, crownY - 18, 14, palmHLColors, seed + 400, v, 0);

    gTop.generateTexture(`dec_palm_${v}_top`, palmW, palmH);
    gTop.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === COCONUT PALM (2 variants) ===
  // ══════════════════════════════════════════════════════════
  const cocoW = 90;
  const cocoH = 130;
  const cocoLeafColors = [0x2a7a1e, 0x3a9a2a, 0x48aa38, 0x348a24];

  for (let v = 0; v < 2; v++) {
    const seed = 1500 + v * 37;
    const cx = cocoW / 2;
    const baseY = cocoH - 8;
    const trunkH = 60 + v * 5;
    const crownY = baseY - trunkH;

    const gBot = scene.add.graphics().setVisible(false);

    // Curved trunk
    drawTrunk(gBot, cx, baseY, trunkH, 8, seed, v, 1.0 + v * 0.5);
    drawRoots(gBot, cx, baseY, 8, seed, v);

    // Coconuts at crown base
    gBot.fillStyle(0x5a3a1a);
    gBot.fillCircle(cx - 5, crownY + 8, 4);
    gBot.fillCircle(cx + 4, crownY + 9, 4);
    gBot.fillCircle(cx, crownY + 11, 4);
    // Coconut highlight
    gBot.fillStyle(0x8a6a3a, 0.4);
    gBot.fillCircle(cx - 4, crownY + 7, 2);

    // Droopy fronds (longer, curvier)
    const frondCount = 7;
    for (let i = 0; i < frondCount; i++) {
      const angle = -Math.PI * 0.85 + (i / (frondCount - 1)) * Math.PI * 1.7;
      const frondLen = 26 + seededRandom(v, i, seed + 100) * 10;
      const droop = 0.65 + seededRandom(v, i, seed + 200) * 0.3;
      const color = cocoLeafColors[Math.floor(seededRandom(v, i, seed + 300) * cocoLeafColors.length)];

      const segs = 10;
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        pts.push({
          x: cx + Math.sin(angle) * frondLen * t,
          y: crownY + 5 - Math.cos(angle) * frondLen * t * droop + t * t * 18,
        });
      }

      // Stem outline (black)
      gBot.lineStyle(4, 0x000000, 0.4);
      for (let s = 0; s < pts.length - 1; s++) gBot.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);
      // Stem fill
      gBot.lineStyle(2, color, 0.9);
      for (let s = 0; s < pts.length - 1; s++) gBot.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);

      // Leaflets (wider)
      gBot.lineStyle(1, 0x000000, 0.3);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 4 + (1 - Math.abs(s / segs - 0.5) * 2) * 7;
        gBot.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(angle + 0.6), p.y + leafLen * Math.sin(angle + 0.6));
        gBot.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(angle - 0.6), p.y - leafLen * Math.sin(angle - 0.6));
      }
      gBot.lineStyle(1.5, color, 0.7);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 4 + (1 - Math.abs(s / segs - 0.5) * 2) * 7;
        gBot.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(angle + 0.6), p.y + leafLen * Math.sin(angle + 0.6));
        gBot.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(angle - 0.6), p.y - leafLen * Math.sin(angle - 0.6));
      }
    }

    gBot.generateTexture(`dec_coconut_${v}_bottom`, cocoW, cocoH);
    gBot.destroy();

    // TOP
    const gTop = scene.add.graphics().setVisible(false);
    for (let i = 0; i < frondCount; i++) {
      const angle = -Math.PI * 0.85 + (i / (frondCount - 1)) * Math.PI * 1.7;
      const frondLen = 26 + seededRandom(v, i, seed + 100) * 10;
      const droop = 0.65 + seededRandom(v, i, seed + 200) * 0.3;
      const color = cocoLeafColors[Math.floor(seededRandom(v, i, seed + 300) * cocoLeafColors.length)];

      const segs = 10;
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        pts.push({
          x: cx + Math.sin(angle) * frondLen * t,
          y: crownY + 5 - Math.cos(angle) * frondLen * t * droop + t * t * 18,
        });
      }

      // Stem outline
      gTop.lineStyle(4, 0x000000, 0.4);
      for (let s = 0; s < pts.length - 1; s++) gTop.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);
      // Stem fill
      gTop.lineStyle(2, color, 0.9);
      for (let s = 0; s < pts.length - 1; s++) gTop.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);

      // Leaflets (wider, with outline)
      gTop.lineStyle(1, 0x000000, 0.3);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 4 + (1 - Math.abs(s / segs - 0.5) * 2) * 7;
        gTop.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(angle + 0.6), p.y + leafLen * Math.sin(angle + 0.6));
        gTop.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(angle - 0.6), p.y - leafLen * Math.sin(angle - 0.6));
      }
      gTop.lineStyle(1.5, color, 0.7);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 4 + (1 - Math.abs(s / segs - 0.5) * 2) * 7;
        gTop.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(angle + 0.6), p.y + leafLen * Math.sin(angle + 0.6));
        gTop.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(angle - 0.6), p.y - leafLen * Math.sin(angle - 0.6));
      }
    }
    gTop.generateTexture(`dec_coconut_${v}_top`, cocoW, cocoH);
    gTop.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === TALL PALM (2 variants) — very tall, slim ===
  // ══════════════════════════════════════════════════════════
  const tallW = 80;
  const tallH = 170;
  const tallLeafColors = [0x2a7a1e, 0x3a9a2a, 0x48aa38, 0x348a24];

  for (let v = 0; v < 2; v++) {
    const seed = 1700 + v * 37;
    const cx = tallW / 2;
    const baseY = tallH - 8;
    const trunkH = 100 + v * 10;
    const crownY = baseY - trunkH;

    const gBot = scene.add.graphics().setVisible(false);
    drawTrunk(gBot, cx, baseY, trunkH, 7, seed, v, 0.3);
    drawRoots(gBot, cx, baseY, 7, seed, v);

    // Small fronds at crown base
    for (let i = 0; i < 5; i++) {
      const a = -0.8 + (i / 4) * 1.6;
      const len = 14 + seededRandom(v, i, seed + 50) * 5;
      const color = tallLeafColors[i % tallLeafColors.length];
      // Outline
      gBot.lineStyle(3, 0x000000, 0.35);
      const ex = cx + Math.sin(a) * len;
      const ey = crownY + 10 - Math.cos(a) * len * 0.3 + len * 0.1;
      gBot.lineBetween(cx, crownY + 10, ex, ey);
      // Fill
      gBot.lineStyle(1.5, color, 0.8);
      gBot.lineBetween(cx, crownY + 10, ex, ey);
    }

    gBot.generateTexture(`dec_palm_tall_${v}_bottom`, tallW, tallH);
    gBot.destroy();

    // TOP
    const gTop = scene.add.graphics().setVisible(false);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.9 + (i / 8) * Math.PI * 1.8;
      const len = 20 + seededRandom(v, i, seed + 150) * 8;
      const droop = 0.5 + seededRandom(v, i, seed + 250) * 0.4;
      const color = tallLeafColors[Math.floor(seededRandom(v, i, seed + 350) * tallLeafColors.length)];

      const segs = 8;
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        pts.push({
          x: cx + Math.sin(a) * len * t,
          y: crownY - Math.cos(a) * len * t * droop + t * t * 12,
        });
      }

      // Stem outline
      gTop.lineStyle(4, 0x000000, 0.35);
      for (let s = 0; s < pts.length - 1; s++) gTop.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);
      // Stem fill
      gTop.lineStyle(2, color, 0.85);
      for (let s = 0; s < pts.length - 1; s++) gTop.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);

      // Leaflets (wider, with outline)
      gTop.lineStyle(1, 0x000000, 0.3);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 3 + (1 - Math.abs(s / segs - 0.5) * 2) * 6;
        gTop.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(a + 0.6), p.y + leafLen * Math.sin(a + 0.6));
        gTop.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(a - 0.6), p.y - leafLen * Math.sin(a - 0.6));
      }
      gTop.lineStyle(1.5, color, 0.7);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 3 + (1 - Math.abs(s / segs - 0.5) * 2) * 6;
        gTop.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(a + 0.6), p.y + leafLen * Math.sin(a + 0.6));
        gTop.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(a - 0.6), p.y - leafLen * Math.sin(a - 0.6));
      }
    }
    gTop.generateTexture(`dec_palm_tall_${v}_top`, tallW, tallH);
    gTop.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === ROUND TROPICAL TREE (2 variants) — like Stardew oak ===
  // ══════════════════════════════════════════════════════════
  const roundW = 110;
  const roundH = 130;
  const roundLeafColors = [0x1a5014, 0x226a1a, 0x144010, 0x2a5a20, 0x1e5518];
  const roundHLColors = [0x3a7a30, 0x4a9040, 0x307028];

  for (let v = 0; v < 2; v++) {
    const seed = 3000 + v * 37;
    const cx = roundW / 2;
    const baseY = roundH - 8;
    const trunkH = 45 + v * 5;
    const trunkW = 14 + v * 2;
    const crownY = baseY - trunkH;

    const gBot = scene.add.graphics().setVisible(false);

    // Thick trunk
    drawTrunk(gBot, cx, baseY, trunkH, trunkW, seed, v, 0.2);
    drawRoots(gBot, cx, baseY, trunkW, seed, v);

    // Main branches
    const branches = [
      { angle: -0.7, len: 22 },
      { angle: -0.3, len: 18 },
      { angle: 0.2, len: 20 },
      { angle: 0.6, len: 24 },
    ];
    gBot.lineStyle(3, 0x5a4a3a);
    for (const b of branches) {
      const ex = cx + Math.sin(b.angle) * b.len;
      const ey = crownY + 5 - Math.cos(b.angle) * b.len * 0.5;
      gBot.lineBetween(cx, crownY + 5, ex, ey);
    }

    // Lower canopy masses
    drawLeafCluster(gBot, cx - 15, crownY + 8, 18, roundLeafColors, seed + 100, v, 0);
    drawLeafCluster(gBot, cx + 12, crownY + 5, 16, roundLeafColors, seed + 200, v, 1);
    drawLeafCluster(gBot, cx, crownY + 12, 14, roundLeafColors, seed + 300, v, 2);

    gBot.generateTexture(`dec_round_${v}_bottom`, roundW, roundH);
    gBot.destroy();

    // TOP — big round canopy
    const gTop = scene.add.graphics().setVisible(false);

    // Main canopy dome
    drawLeafCluster(gTop, cx, crownY - 8, 28, roundLeafColors, seed + 400, v, 0);
    drawLeafCluster(gTop, cx - 18, crownY - 2, 20, roundLeafColors, seed + 500, v, 1);
    drawLeafCluster(gTop, cx + 16, crownY - 4, 22, roundLeafColors, seed + 600, v, 2);
    drawLeafCluster(gTop, cx - 8, crownY - 18, 18, roundHLColors, seed + 700, v, 3);
    drawLeafCluster(gTop, cx + 10, crownY - 15, 16, roundLeafColors, seed + 800, v, 4);

    // Top highlight
    gTop.fillStyle(0x6abb5a, 0.2);
    gTop.fillCircle(cx - 5, crownY - 22, 12);

    gTop.generateTexture(`dec_round_${v}_top`, roundW, roundH);
    gTop.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === FERN (3 variants) — larger, with outline ===
  // ══════════════════════════════════════════════════════════
  const fernW = 52;
  const fernH = 46;

  for (let v = 0; v < 3; v++) {
    const seed = 2500 + v * 31;
    const g = scene.add.graphics().setVisible(false);
    const centerX = fernW / 2;
    const baseY = fernH - 4;
    const frondColors = [0x2d7a22, 0x3a9a2e, 0x1e6514, 0x4a8a3a];
    const frondCount = 6 + Math.floor(seededRandom(v, 0, seed) * 3);

    for (let f = 0; f < frondCount; f++) {
      const angle = -Math.PI * 0.85 + (f / (frondCount - 1)) * Math.PI * 1.7;
      const frondLen = 16 + seededRandom(v, f, seed + 100) * 10;
      const droop = 0.6 + seededRandom(v, f, seed + 200) * 0.4;
      const curl = 0.3 + seededRandom(v, f, seed + 300) * 0.4;
      const color = frondColors[Math.floor(seededRandom(v, f, seed + 400) * frondColors.length)];

      const segs = 10;
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const curve = Math.sin(t * Math.PI * curl) * 3;
        pts.push({
          x: centerX + Math.sin(angle) * frondLen * t + curve * Math.cos(angle),
          y: baseY - Math.cos(angle) * frondLen * t * droop + t * t * 10,
        });
      }

      // Stem outline (black)
      g.lineStyle(3, 0x000000, 0.35);
      for (let s = 0; s < pts.length - 1; s++) g.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);
      // Stem fill
      g.lineStyle(1.5, color, 0.85);
      for (let s = 0; s < pts.length - 1; s++) g.lineBetween(pts[s].x, pts[s].y, pts[s + 1].x, pts[s + 1].y);

      // Leaflets (wider, with outline)
      g.lineStyle(1, 0x000000, 0.25);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 3 + (1 - Math.abs(s / segs - 0.5) * 2) * 5;
        g.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(angle + 0.7), p.y + leafLen * Math.sin(angle + 0.7));
        g.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(angle - 0.7), p.y - leafLen * Math.sin(angle - 0.7));
      }
      g.lineStyle(1.5, color, 0.7);
      for (let s = 2; s < pts.length - 1; s++) {
        const p = pts[s];
        const leafLen = 3 + (1 - Math.abs(s / segs - 0.5) * 2) * 5;
        g.lineBetween(p.x, p.y, p.x + leafLen * Math.cos(angle + 0.7), p.y + leafLen * Math.sin(angle + 0.7));
        g.lineBetween(p.x, p.y, p.x - leafLen * Math.cos(angle - 0.7), p.y - leafLen * Math.sin(angle - 0.7));
      }

      // Curled tip
      const tip = pts[pts.length - 1];
      g.lineStyle(1.5, color, 0.9);
      g.beginPath();
      g.arc(tip.x, tip.y, 3.5, angle - Math.PI * 0.5, angle + Math.PI * 0.3, false);
      g.strokePath();
    }

    g.fillStyle(0x3a6a2a, 0.5);
    g.fillCircle(centerX, baseY, 5);
    g.generateTexture(`dec_fern_${v}`, fernW, fernH);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === Bush (3 variants) ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 3; v++) {
    const g = scene.add.graphics().setVisible(false);
    const bw = 34, bh = 28;
    const shades = [0x2d6b1e, 0x3a7a2a, 0x256018];
    g.fillStyle(shades[0]); g.fillCircle(bw / 2, bh / 2 + 3, 12);
    g.fillStyle(shades[1]); g.fillCircle(bw / 2 - 5, bh / 2, 9);
    g.fillStyle(shades[2]); g.fillCircle(bw / 2 + 6, bh / 2 + 2, 8);
    g.fillStyle(0x4a9a3a, 0.5); g.fillCircle(bw / 2 - 2, bh / 2 - 3, 5);
    if (seededRandom(v, 0, 2000 + v * 31) > 0.5) {
      g.fillStyle(0xcc3333); g.fillCircle(bw / 2 + 7, bh / 2 - 2, 2.5); g.fillCircle(bw / 2 - 6, bh / 2 + 4, 2.5);
    }
    g.generateTexture(`dec_bush_${v}`, bw, bh); g.destroy();
  }

  // === Flower ===
  const flowerPalette = [[0xffee44, 0xff6644], [0xff88cc, 0xee44aa], [0x44aaff, 0x2266ee]];
  for (let v = 0; v < 3; v++) {
    const g = scene.add.graphics().setVisible(false);
    const fw = 22, fh = 22, seed = 3000 + v * 31;
    g.fillStyle(0x3a7a2a, 0.6); g.fillCircle(fw / 2, fh / 2 + 4, 7);
    const cnt = 3 + Math.floor(seededRandom(v, 0, seed) * 3);
    for (let f = 0; f < cnt; f++) {
      g.fillStyle(flowerPalette[v % 3][f % 2]); g.fillCircle(fw / 2 + (seededRandom(v, f, seed + 10) - 0.5) * 16, fh / 2 + (seededRandom(v, f, seed + 20) - 0.5) * 12, 3);
      g.fillStyle(0xffff88); g.fillCircle(fw / 2 + (seededRandom(v, f, seed + 10) - 0.5) * 16, fh / 2 + (seededRandom(v, f, seed + 20) - 0.5) * 12, 1.2);
    }
    g.generateTexture(`dec_flower_${v}`, fw, fh); g.destroy();
  }

  // === Rocks ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(0x777777 + v * 0x111111); g.fillCircle(8, 7, 6);
    g.fillStyle(0x999999, 0.4); g.fillCircle(6, 5, 3);
    g.lineStyle(1, 0x555555, 0.6); g.strokeCircle(8, 7, 6);
    g.generateTexture(`dec_rock_s_${v}`, 16, 12); g.destroy();
  }
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    g.fillStyle(0x666666 + v * 0x111111); g.fillCircle(14, 14, 10); g.fillCircle(8, 12, 7);
    g.fillStyle(0x888888, 0.4); g.fillCircle(11, 9, 5);
    g.lineStyle(1, 0x444444, 0.5); g.strokeCircle(14, 14, 10);
    g.generateTexture(`dec_rock_l_${v}`, 28, 24); g.destroy();
  }

  // === Shore ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const seed = 6000 + v * 31;
    g.lineStyle(2, 0x5a8a3a);
    for (let r = 0; r < 3; r++) g.lineBetween(12 - 4 + r * 4, 20, 12 - 4 + r * 4 + (seededRandom(v, r, seed) - 0.5) * 4, 4);
    g.fillStyle(0x4a7a2a, 0.8); g.fillCircle(12, 10, 5);
    g.generateTexture(`dec_shore_${v}`, 24, 20); g.destroy();
  }

  // === Tall grass ===
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const seed = 7000 + v * 31;
    g.lineStyle(2, 0x4a8a3a); g.lineBetween(5, 28, 3 + seededRandom(v, 0, seed) * 3, 3);
    g.lineStyle(2, 0x3a7a2a); g.lineBetween(7, 28, 7 + seededRandom(v, 1, seed) * 3, 5);
    g.lineStyle(2, 0x5a9a4a); g.lineBetween(9, 28, 8 + seededRandom(v, 2, seed) * 3, 2);
    g.fillStyle(0x6aaa5a); g.fillCircle(4, 3, 2); g.fillCircle(9, 5, 2);
    g.generateTexture(`dec_grass_tall_${v}`, 14, 28); g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === CACTUS (3 variants) — desert decoration ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 3; v++) {
    const g = scene.add.graphics().setVisible(false);
    const cw = 28, ch = 36;
    const cx = cw / 2, baseY = ch - 3;
    const seed = 8000 + v * 37;
    const cactusColor = 0x4a8a3a;
    const cactusDark = 0x3a6a2a;
    const cactusLight = 0x6aaa5a;

    // Main trunk
    const trunkH = 20 + seededRandom(v, 0, seed) * 8;
    g.fillStyle(cactusColor);
    g.fillRect(cx - 4, baseY - trunkH, 8, trunkH);
    g.fillStyle(cactusDark, 0.4);
    g.fillRect(cx - 2, baseY - trunkH, 2, trunkH);
    g.fillStyle(cactusLight, 0.3);
    g.fillRect(cx + 2, baseY - trunkH, 1, trunkH);

    // Arms (1-2)
    const armCount = 1 + Math.floor(seededRandom(v, 0, seed + 100) * 2);
    for (let a = 0; a < armCount; a++) {
      const armY = baseY - trunkH * 0.4 - a * 8;
      const armDir = seededRandom(v, a, seed + 200) > 0.5 ? 1 : -1;
      const armLen = 6 + seededRandom(v, a, seed + 300) * 5;
      g.fillStyle(cactusColor);
      g.fillRect(cx + armDir * 4, armY - 4, armDir * armLen, 4);
      g.fillRect(cx + armDir * (4 + armLen) - 2, armY - 10, 4, 10);
    }

    // Spines (small dots)
    g.fillStyle(0xccccaa, 0.6);
    for (let i = 0; i < 5; i++) {
      const sy = baseY - 5 - i * 4;
      g.fillCircle(cx - 4, sy, 0.8);
      g.fillCircle(cx + 4, sy, 0.8);
    }

    // Outline
    g.lineStyle(1, 0x2a4a1a, 0.5);
    g.strokeRect(cx - 4, baseY - trunkH, 8, trunkH);

    g.generateTexture(`dec_cactus_${v}`, cw, ch);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === DRY BUSH (2 variants) — withered desert bush ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const bw = 26, bh = 22;
    const seed = 8500 + v * 31;
    const dryColor = 0x9a8a60;
    const dryDark = 0x7a6a40;

    // Main mass
    g.fillStyle(dryColor, 0.8);
    g.fillCircle(bw / 2, bh / 2 + 2, 9);
    g.fillStyle(dryDark, 0.6);
    g.fillCircle(bw / 2 - 3, bh / 2, 6);
    g.fillCircle(bw / 2 + 4, bh / 2 + 1, 5);

    // Twigs
    g.lineStyle(1, 0x6a5a3a, 0.7);
    g.lineBetween(bw / 2, bh / 2 + 2, bw / 2 - 6, bh / 2 - 5);
    g.lineBetween(bw / 2, bh / 2 + 2, bw / 2 + 5, bh / 2 - 4);
    g.lineBetween(bw / 2, bh / 2 + 2, bw / 2 + 1, bh / 2 - 7);

    g.generateTexture(`dec_dry_bush_${v}`, bw, bh);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === SHELL (2 variants) — beach shell ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const sw = 14, sh = 12;
    const seed = 9000 + v * 31;
    const shellColor = v === 0 ? 0xf0e0c8 : 0xe8d0b8;

    g.fillStyle(shellColor, 0.9);
    g.fillCircle(sw / 2, sh / 2 + 1, 5);
    g.lineStyle(1, 0xd0c0a0, 0.6);
    g.beginPath();
    g.arc(sw / 2, sh / 2 + 1, 3, 0, Math.PI * 1.5, false);
    g.strokePath();
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(sw / 2 - 1, sh / 2 - 1, 2);

    g.generateTexture(`dec_shell_${v}`, sw, sh);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === STALAGMITE (3 variants) — stone biome ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 3; v++) {
    const g = scene.add.graphics().setVisible(false);
    const sw = 20, sh = 28;
    const cx = sw / 2, baseY = sh - 2;
    const seed = 10000 + v * 37;
    const stoneColor = 0x666666 + v * 0x0a0a0a;
    const stoneDark = 0x444444;

    // Main stalagmite
    const h = 16 + seededRandom(v, 0, seed) * 8;
    const w = 5 + seededRandom(v, 0, seed + 100) * 3;
    g.fillStyle(stoneColor);
    g.beginPath();
    g.moveTo(cx - w, baseY);
    g.lineTo(cx, baseY - h);
    g.lineTo(cx + w, baseY);
    g.closePath();
    g.fill();

    // Dark side
    g.fillStyle(stoneDark, 0.4);
    g.beginPath();
    g.moveTo(cx, baseY - h);
    g.lineTo(cx + w, baseY);
    g.lineTo(cx + w * 0.3, baseY);
    g.closePath();
    g.fill();

    // Outline
    g.lineStyle(1, 0x333333, 0.5);
    g.beginPath();
    g.moveTo(cx - w, baseY);
    g.lineTo(cx, baseY - h);
    g.lineTo(cx + w, baseY);
    g.strokePath();

    g.generateTexture(`dec_stalagmite_${v}`, sw, sh);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === CRYSTAL (2 variants) — glowing stone biome ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const cw = 18, ch = 24;
    const cx = cw / 2, baseY = ch - 2;
    const seed = 11000 + v * 31;
    const colors = v === 0 ? [0x6688cc, 0x88aaee, 0x4466aa] : [0xaa66cc, 0xcc88ee, 0x8844aa];

    // Crystal shards
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 4 + seededRandom(v, i, seed) * 2;
      const h = 10 + seededRandom(v, i, seed + 100) * 8;
      const w = 2 + seededRandom(v, i, seed + 200) * 2;
      const color = colors[i % colors.length];

      g.fillStyle(color, 0.85);
      g.beginPath();
      g.moveTo(cx + ox - w, baseY);
      g.lineTo(cx + ox, baseY - h);
      g.lineTo(cx + ox + w, baseY);
      g.closePath();
      g.fill();

      // Highlight
      g.fillStyle(0xffffff, 0.3);
      g.beginPath();
      g.moveTo(cx + ox - w * 0.3, baseY - 2);
      g.lineTo(cx + ox, baseY - h + 2);
      g.lineTo(cx + ox + w * 0.3, baseY - 2);
      g.closePath();
      g.fill();
    }

    // Outline
    g.lineStyle(1, 0x222244, 0.5);
    g.strokeCircle(cx, baseY - 8, 6);

    g.generateTexture(`dec_crystal_${v}`, cw, ch);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === MUSHROOM (2 variants) — stone/dirt biome ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const mw = 18, mh = 20;
    const cx = mw / 2, baseY = mh - 2;
    const seed = 12000 + v * 31;

    // Stem
    g.fillStyle(0xd8d0c0);
    g.fillRect(cx - 2, baseY - 10, 4, 10);

    // Cap
    const capColor = v === 0 ? 0xcc4444 : 0xddaa44;
    g.fillStyle(capColor);
    g.fillCircle(cx, baseY - 12, 7);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(cx - 2, baseY - 14, 3);

    // Spots
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(cx - 3, baseY - 13, 1.5);
    g.fillCircle(cx + 2, baseY - 14, 1);
    g.fillCircle(cx, baseY - 10, 1.2);

    g.generateTexture(`dec_mushroom_${v}`, mw, mh);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === DEAD TREE (2 variants) — dirt biome ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const tw = 30, th = 40;
    const cx = tw / 2, baseY = th - 3;
    const seed = 13000 + v * 37;
    const trunkColor = 0x5a4a3a;

    // Trunk
    const trunkH = 25 + seededRandom(v, 0, seed) * 8;
    g.fillStyle(trunkColor);
    g.fillRect(cx - 3, baseY - trunkH, 6, trunkH);

    // Bark texture
    g.lineStyle(1, 0x4a3a2a, 0.4);
    for (let i = 0; i < 5; i++) {
      const y = baseY - 5 - i * 5;
      g.lineBetween(cx - 3, y, cx + 3, y);
    }

    // Branches (bare, angular)
    g.lineStyle(2, trunkColor);
    const branchCount = 2 + Math.floor(seededRandom(v, 0, seed + 100) * 2);
    for (let b = 0; b < branchCount; b++) {
      const by = baseY - trunkH * 0.5 - b * 6;
      const dir = seededRandom(v, b, seed + 200) > 0.5 ? 1 : -1;
      const len = 6 + seededRandom(v, b, seed + 300) * 6;
      g.lineBetween(cx, by, cx + dir * len, by - 4 - seededRandom(v, b, seed + 400) * 4);
    }

    // Outline
    g.lineStyle(1, 0x3a2a1a, 0.4);
    g.strokeRect(cx - 3, baseY - trunkH, 6, trunkH);

    g.generateTexture(`dec_dead_tree_${v}`, tw, th);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === SKULL (2 variants) — dirt biome ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const sw = 16, sh = 14;
    const cx = sw / 2, cy = sh / 2;
    const seed = 14000 + v * 31;

    // Skull
    g.fillStyle(0xe8e0d0);
    g.fillCircle(cx, cy, 6);

    // Eye sockets
    g.fillStyle(0x2a2a2a);
    g.fillCircle(cx - 2, cy - 1, 1.5);
    g.fillCircle(cx + 2, cy - 1, 1.5);

    // Jaw
    g.fillStyle(0xd8d0c0);
    g.fillRect(cx - 3, cy + 4, 6, 3);

    // Nose
    g.fillStyle(0x3a3a3a);
    g.fillTriangle(cx, cy + 1, cx - 1, cy + 3, cx + 1, cy + 3);

    // Outline
    g.lineStyle(1, 0x8a8070, 0.5);
    g.strokeCircle(cx, cy, 6);

    g.generateTexture(`dec_skull_${v}`, sw, sh);
    g.destroy();
  }

  // ══════════════════════════════════════════════════════════
  // === TUMBLEWEED (2 variants) — dirt biome ===
  // ══════════════════════════════════════════════════════════
  for (let v = 0; v < 2; v++) {
    const g = scene.add.graphics().setVisible(false);
    const tw = 22, th = 22;
    const cx = tw / 2, cy = th / 2 + 2;
    const seed = 15000 + v * 31;

    // Tangled ball
    g.lineStyle(1, 0x8a7a50, 0.7);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 5 + seededRandom(v, i, seed) * 3;
      g.beginPath();
      g.arc(cx + Math.cos(angle) * 2, cy + Math.sin(angle) * 2, r, angle, angle + Math.PI * 0.8, false);
      g.strokePath();
    }

    // Inner mass
    g.fillStyle(0x9a8a60, 0.4);
    g.fillCircle(cx, cy, 6);

    // Outline
    g.lineStyle(1, 0x6a5a3a, 0.4);
    g.strokeCircle(cx, cy, 7);

    g.generateTexture(`dec_tumbleweed_${v}`, tw, th);
    g.destroy();
  }


}
