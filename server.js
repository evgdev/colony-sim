import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 3001;

// Allow passing port via command line
const args = process.argv.slice(2);
const portArg = args.find(a => a.startsWith('--port='));
const PORT_FINAL = portArg ? parseInt(portArg.split('=')[[1]]) : PORT;

// ── HTTP server (serves static files + API) ──
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // API: POST /api/init — host sends game state
  if (req.method === 'POST' && req.url === '/api/init') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        lastInitMsg = JSON.parse(body);
        lastInitMsg.type = 'init';
        console.log(`[Server] Received init via API. Seed: ${lastInitMsg.seed}, Entities: ${(lastInitMsg.entities || []).length}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        // Also send to all connected clients
        for (const p of players.values()) {
          if (!p.isHost) {
            sendTo(p.ws, {
              ...lastInitMsg,
              playerId: p.id,
              playerName: p.name,
              playerColor: p.color,
            });
          }
        }
      } catch (e) {
        res.writeHead(400); res.end('Invalid JSON');
      }
    });
    return;
  }

  // Static files
  let file = req.url === '/' ? '/index.html' : req.url;
  file = file.split('?')[0];
  const filePath = path.join(import.meta.dirname, file);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html', '.htm': 'text/html',
    '.js': 'application/javascript', '.ts': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff',
  };
  const mime = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// ── WebSocket server ──
const wss = new WebSocketServer({ server });

// Keepalive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// ── Game state ──
const COLORS = ['#58a6ff', '#44ff44', '#ff4444', '#ffaa00', '#ff44ff', '#44ffff'];
const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const players = new Map(); // id → { id, name, color, ws, isHost, assignedSettlers }
let nextId = 1;
let hostWs = null; // reference to host's WebSocket
let gameSeed = null;
let gameState = null; // latest state_sync from host
let lastInitMsg = null; // store init for late joiners

const CHAT_COOLDOWN_MS = 500;
const CHAT_MAX_LEN = 200;

function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').trim().slice(0, maxLen);
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg, exclude) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  }
}

function getPlayerList() {
  return [...players.values()].map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isHost: p.isHost,
    assignedSettlers: p.assignedSettlers,
  }));
}

// ── Connection handler ──
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const id = nextId++;
  const color = COLORS[(id - 1) % COLORS.length];
  const isHost = players.size === 0; // first player is host

  const player = {
    id,
    name: NAMES[(id - 1) % NAMES.length],
    color,
    ws,
    isHost,
    assignedSettlers: [],
    lastChatTime: 0,
  };
  players.set(id, player);

  if (isHost) {
    hostWs = ws;
    console.log(`[Server] Player ${id} "${player.name}" connected as HOST`);
  } else {
    console.log(`[Server] Player ${id} "${player.name}" connected as CLIENT`);
  }

  ws.playerId = id;

  // Send current player list to new player
  sendTo(ws, {
    type: 'player_list',
    players: getPlayerList(),
    isHost,
  });

  // If game already started, send init to new client
  if (!isHost && lastInitMsg) {
    sendTo(ws, {
      ...lastInitMsg,
      playerId: id,
      playerName: player.name,
      playerColor: player.color,
    });
    console.log(`[Server] Sent init to late joiner ${id}`);
  }

  // Notify others
  broadcast({
    type: 'player_join',
    player: { id: player.id, name: player.name, color: player.color, isHost },
  }, ws);

  ws.on('error', (err) => {
    console.error(`[Server] Player ${id} error:`, err.message);
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn(`[Server] Player ${id}: invalid JSON`);
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    const player = players.get(id);
    if (!player) return;

    // ── join (set name) ──
    if (msg.type === 'join') {
      if (typeof msg.name === 'string' && msg.name.trim()) {
        player.name = sanitize(msg.name, 20) || player.name;
      }
      console.log(`[Server] Player ${id} "${player.name}" joined`);
      // Send updated player list to all
      broadcast({ type: 'player_list', players: getPlayerList() });
      // Send init to this player if game already started
      if (lastInitMsg && !player.isHost) {
        sendTo(ws, {
          ...lastInitMsg,
          playerId: id,
          playerName: player.name,
          playerColor: player.color,
        });
        console.log(`[Server] Sent init to player ${id} on join`);
      }
      return;
    }

    // ── request_state ──
    if (msg.type === 'request_state') {
      console.log(`[Server] Player ${id} requested state. lastInitMsg: ${lastInitMsg ? 'exists' : 'null'}`);
      if (lastInitMsg && !player.isHost) {
        sendTo(ws, {
          ...lastInitMsg,
          playerId: id,
          playerName: player.name,
          playerColor: player.color,
        });
        console.log(`[Server] Sent init to player ${id} on request`);
      }
      return;
    }

    // ── chat ──
    if (msg.type === 'chat') {
      const now = Date.now();
      if (now - player.lastChatTime < CHAT_COOLDOWN_MS) return;
      player.lastChatTime = now;

      const text = sanitize(msg.text, CHAT_MAX_LEN);
      if (!text) return;

      broadcast({
        type: 'chat',
        playerId: id,
        playerName: player.name,
        playerColor: player.color,
        text,
      });
      console.log(`[chat] ${player.name}: ${text}`);
      return;
    }

    // ── Host-only messages ──
    if (!player.isHost) {
      // Client actions → relay to host
      if (['move_settler', 'build', 'collect', 'attack', 'work_mode', 'request_state'].includes(msg.type)) {
        msg.playerId = id;
        sendTo(hostWs, msg);
        return;
      }
      return;
    }

    // ── Log all messages for debugging ──
    console.log(`[Server] Player ${id} msg: ${msg.type}`);

    // ── Host messages ──
    if (player.isHost) {
      // ── init (host sends initial game state) ──
      if (msg.type === 'init') {
        gameSeed = msg.seed;
        lastInitMsg = { ...msg, type: 'init' };
        console.log(`[Server] Stored init message. Seed: ${msg.seed}, Entities: ${(msg.entities || []).length}`);
        // Assign settlers to clients
        const allSettlers = msg.settlerIds || [];
        const hostSettlers = allSettlers.slice(0, Math.ceil(allSettlers.length / 2));
        const clientSettlers = allSettlers.slice(Math.ceil(allSettlers.length / 2));

        player.assignedSettlers = hostSettlers;

        // Assign client settlers to connected non-host players
        const clients = [...players.values()].filter(p => !p.isHost);
        for (let i = 0; i < clients.length; i++) {
          clients[i].assignedSettlers = clientSettlers.slice(i * 2, (i + 1) * 2);
        }

        // Send init to all clients
        for (const p of players.values()) {
          if (!p.isHost) {
            sendTo(p.ws, {
              type: 'init',
              playerId: p.id,
              playerName: p.name,
              playerColor: p.color,
              seed: msg.seed,
              mapWidth: msg.mapWidth,
              mapHeight: msg.mapHeight,
              tickCount: msg.tickCount,
              players: getPlayerList(),
              entities: msg.entities || [],
              buildings: msg.buildings || [],
              inventory: msg.inventory || [],
              assignedSettlers: p.assignedSettlers,
            });
          }
        }
        console.log(`[Server] Game initialized. Seed: ${msg.seed}, Settlers: ${allSettlers.length}`);
        return;
      }

      // ── state_sync (host broadcasts periodic state) ──
      if (msg.type === 'state_sync') {
        gameState = msg;
        broadcast({
          type: 'state_sync',
          tick: msg.tick,
          entities: msg.entities || [],
          buildings: msg.buildings || [],
          inventory: msg.inventory || [],
        }, hostWs);
        return;
      }

      // ── entity_update (host sends immediate entity change) ──
      if (msg.type === 'entity_update') {
        broadcast(msg, hostWs);
        return;
      }

      // ── entity_add / entity_remove ──
      if (msg.type === 'entity_add' || msg.type === 'entity_remove') {
        broadcast(msg, hostWs);
        return;
      }

      // ── building_update ──
      if (msg.type === 'building_update') {
        broadcast(msg, hostWs);
        return;
      }

      // ── settlers_assign (host reassigns settlers) ──
      if (msg.type === 'settlers_assign') {
        const { assignments } = msg; // { playerId: settlerId[] }
        for (const [pid, settlerIds] of Object.entries(assignments)) {
          const p = players.get(Number(pid));
          if (p) p.assignedSettlers = settlerIds;
        }
        broadcast({ type: 'settlers_assign', assignments });
        return;
      }
    }
  });

  ws.on('close', () => {
    const player = players.get(id);
    if (player) {
      console.log(`[Server] Player ${id} "${player.name}" disconnected`);
      if (player.isHost) {
        hostWs = null;
        // Notify clients that host left
        broadcast({ type: 'error', msg: 'Host disconnected' });
      }
      players.delete(id);
      broadcast({ type: 'player_leave', playerId: id });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Colony Sim Multiplayer`);
  console.log(`[Server] http://0.0.0.0:${PORT}`);
  console.log(`[Server] Waiting for players...`);
});
