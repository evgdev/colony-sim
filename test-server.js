import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3001;
const COLORS = ['#58a6ff', '#44ff44', '#ff4444', '#ffaa00'];
const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const START_X = [1, 8, 1, 8];
const START_Y = [1, 1, 8, 8];

const server = http.createServer((req, res) => {
  let file = req.url === '/' ? '/test-mp.html' : req.url;
  file = file.split('?')[0];
  const filePath = path.join(import.meta.dirname, file);
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
let hostId = null;
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

wss.on('connection', (ws) => {
  const id = nextId++;
  const isHost = players.size === 0;
  const color = COLORS[(id - 1) % COLORS.length];
  const name = NAMES[(id - 1) % NAMES.length];
  const x = START_X[(id - 1) % 4];
  const y = START_Y[(id - 1) % 4];

  const player = { id, ws, name, color, x, y, isHost };
  players.set(id, player);

  if (isHost) {
    hostId = id;
    // Host sends grid on connect
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'grid') {
          gameGrid = msg.grid;
          console.log(`[Server] Received grid from host`);
        }
      } catch {}
    });
  }

  console.log(`[Server] Player ${id} "${name}" ${isHost ? 'HOST' : 'CLIENT'} connected`);

  // Send init to this player
  send(ws, {
    type: 'init',
    playerId: id,
    isHost,
    grid: gameGrid || generateDefaultGrid(),
    players: getPlayerList(),
  });

  // Notify others
  broadcast({ type: 'player_joined', player: { id, name, color, x, y } }, ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'move') {
      const p = players.get(id);
      if (!p) return;
      p.x = msg.x;
      p.y = msg.y;
      // Broadcast to ALL (including sender for confirmation)
      broadcast({ type: 'move', playerId: id, x: msg.x, y: msg.y });
      console.log(`[Server] Player ${id} moved to (${msg.x}, ${msg.y})`);
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

function generateDefaultGrid() {
  const grid = [];
  for (let y = 0; y < 10; y++) {
    grid[y] = [];
    for (let x = 0; x < 10; x++) {
      grid[y][x] = 0;
    }
  }
  grid[3][5] = 1; // stone
  grid[7][2] = 2; // tree
  return grid;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Test Server] Multiplayer Test`);
  console.log(`[Test Server] http://0.0.0.0:${PORT}`);
  console.log(`[Test Server] Waiting for players...`);
});
