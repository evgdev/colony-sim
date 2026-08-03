import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const COLORS = ['#58a6ff', '#44ff44', '#ff4444', '#ffaa00'];
const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const START_X = [1, 8, 1, 8];
const START_Y = [1, 1, 8, 8];

const server = http.createServer((req, res) => {
  let file = req.url === '/' ? '/test-mp.html' : req.url;
  file = file.split('?')[0];
  const filePath = path.join(__dirname, file);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const players = new Map();
let nextId = 1;
let gameGrid = null;

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(msg, exclude) {
  const data = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (p.ws !== exclude && p.ws.readyState === 1) p.ws.send(data);
  }
}

function getPlayerList() {
  return [...players.values()].map(p => ({
    id: p.id, name: p.name, color: p.color, x: p.x, y: p.y
  }));
}

function generateDefaultGrid() {
  const grid = [];
  for (let y = 0; y < 10; y++) {
    grid[y] = [];
    for (let x = 0; x < 10; x++) grid[y][x] = 0;
  }
  grid[3][5] = 1;
  grid[7][2] = 2;
  return grid;
}

// ── Collision Detection ──
function checkProjectileHits(proj) {
  for (const [id, p] of players) {
    // Player hitbox: 0.5 tile radius
    const dx = proj.x - (p.x + 0.5);
    const dy = proj.y - (p.y + 0.35);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.5) {
      return { hit: true, targetId: id, player: p };
    }
  }
  return { hit: false };
}

// ── Active Projectiles (server-side) ──
const activeProjectiles = [];
const TICK_RATE = 50; // ms

function tickProjectiles() {
  const dt = TICK_RATE / 1000;
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const proj = activeProjectiles[i];
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;

    // Remove if expired or out of bounds
    if (proj.life <= 0 || proj.x < 0 || proj.x > 10 || proj.y < 0 || proj.y > 10) {
      activeProjectiles.splice(i, 1);
      continue;
    }

    // Check collision with walls (stone)
    const tileX = Math.floor(proj.x);
    const tileY = Math.floor(proj.y);
    if (tileX >= 0 && tileX < 10 && tileY >= 0 && tileY < 10) {
      if (gameGrid && gameGrid[tileY] && gameGrid[tileY][tileX] === 1) {
        activeProjectiles.splice(i, 1);
        continue;
      }
    }

    // Check hit
    const result = checkProjectileHits(proj);
    if (result.hit) {
      activeProjectiles.splice(i, 1);
      const target = result.player;
      target.hp -= 25;

      // Find spawn point
      const spawnIdx = (target.id - 1) % 4;
      const spawnX = START_X[spawnIdx];
      const spawnY = START_Y[spawnIdx];

      broadcast({
        type: 'hit',
        targetId: result.targetId,
        damage: 25,
        spawnX, spawnY,
      });

      console.log(`[Server] ${target.name} hit! HP: ${target.hp}`);

      // Respawn if dead
      if (target.hp <= 0) {
        target.hp = 100;
        target.x = spawnX;
        target.y = spawnY;
        console.log(`[Server] ${target.name} respawned at (${spawnX}, ${spawnY})`);
      }
    }
  }
}

setInterval(tickProjectiles, TICK_RATE);

// ── Connection Handler ──
wss.on('connection', (ws) => {
  const id = nextId++;
  const isHost = players.size === 0;
  const color = COLORS[(id - 1) % COLORS.length];
  const name = NAMES[(id - 1) % NAMES.length];
  const startX = START_X[(id - 1) % 4];
  const startY = START_Y[(id - 1) % 4];

  const player = { id, ws, name, color, x: startX, y: startY, hp: 100, isHost };
  players.set(id, player);

  console.log(`[Server] Player ${id} "${name}" ${isHost ? 'HOST' : 'CLIENT'} connected`);

  // Send init
  send(ws, {
    type: 'init',
    playerId: id,
    isHost,
    grid: gameGrid || generateDefaultGrid(),
    players: getPlayerList(),
  });

  // Notify others
  broadcast({ type: 'player_joined', player: { id, name, color, x: startX, y: startY } }, ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'grid') {
      gameGrid = msg.grid;
      console.log(`[Server] Grid received from host`);
      return;
    }

    if (msg.type === 'move') {
      const p = players.get(id);
      if (!p) return;
      p.x = msg.x;
      p.y = msg.y;
      broadcast({ type: 'move', playerId: id, x: msg.x, y: msg.y });
      console.log(`[Server] Player ${id} moved to (${msg.x}, ${msg.y})`);
      return;
    }

    if (msg.type === 'shoot') {
      // Add projectile to server-side tracking
      activeProjectiles.push({
        x: msg.fromX,
        y: msg.fromY,
        vx: msg.vx,
        vy: msg.vy,
        ownerId: id,
        life: 2,
      });
      // Broadcast to all for visual effect
      broadcast({ type: 'shoot', playerId: id, fromX: msg.fromX, fromY: msg.fromY, vx: msg.vx, vy: msg.vy });
      console.log(`[Server] Player ${id} shot`);
      return;
    }
  });

  ws.on('close', () => {
    const p = players.get(id);
    if (p) {
      console.log(`[Server] Player ${id} "${p.name}" disconnected`);
      players.delete(id);
      broadcast({ type: 'player_left', playerId: id });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Test Server] Multiplayer Test v2`);
  console.log(`[Test Server] http://0.0.0.0:${PORT}`);
  console.log(`[Test Server] Waiting for players...`);
});
