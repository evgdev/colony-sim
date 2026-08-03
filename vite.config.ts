import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';

// ── Multiplayer WebSocket plugin ──
function multiplayerPlugin() {
  const COLORS = ['#58a6ff', '#44ff44', '#ff4444', '#ffaa00', '#ff44ff', '#44ffff'];
  const NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
  const players = new Map();
  let nextId = 1;
  let hostWs: any = null;
  let gameSeed: number | null = null;
  const CHAT_COOLDOWN_MS = 500;
  const CHAT_MAX_LEN = 200;

  function sanitize(str: string, maxLen: number) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"']/g, '').trim().slice(0, maxLen);
  }

  function sendTo(ws: any, msg: any) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function broadcast(msg: any, exclude?: any) {
    const data = JSON.stringify(msg);
    for (const [id, p] of players) {
      if (p.ws !== exclude && p.ws.readyState === 1) p.ws.send(data);
    }
  }

  function getPlayerList() {
    return [...players.values()].map((p: any) => ({
      id: p.id, name: p.name, color: p.color, isHost: p.isHost, assignedSettlers: p.assignedSettlers,
    }));
  }

  return {
    name: 'multiplayer-ws',
    configureServer(server: any) {
      const wss = new WebSocketServer({ noServer: true });

      // Upgrade HTTP to WebSocket
      server.httpServer?.on('upgrade', (req: any, socket: any, head: any) => {
        if (req.url === '/ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        } else {
          socket.destroy();
        }
      });

      // Keepalive
      setInterval(() => {
        wss.clients.forEach((ws: any) => {
          if (ws.isAlive === false) return ws.terminate();
          ws.isAlive = false;
          ws.ping();
        });
      }, 30000);

      wss.on('connection', (ws: any) => {
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        const id = nextId++;
        const isHost = players.size === 0;
        const player = {
          id, ws, isHost,
          name: NAMES[(id - 1) % NAMES.length],
          color: COLORS[(id - 1) % COLORS.length],
          assignedSettlers: [] as number[],
          lastChatTime: 0,
        };
        players.set(id, player);

        if (isHost) hostWs = ws;
        console.log(`[WS] Player ${id} "${player.name}" ${isHost ? 'HOST' : 'CLIENT'} (${players.size} total)`);

        sendTo(ws, { type: 'player_list', players: getPlayerList(), isHost });
        broadcast({ type: 'player_join', player: { id: player.id, name: player.name, color: player.color, isHost } }, ws);

        ws.on('error', (err: any) => console.error(`[WS] Player ${id} error:`, err.message));

        ws.on('message', (raw: any) => {
          let msg;
          try { msg = JSON.parse(raw); } catch { return; }
          if (!msg || typeof msg.type !== 'string') return;
          const player = players.get(id);
          if (!player) return;

          if (msg.type === 'join') {
            if (typeof msg.name === 'string' && msg.name.trim()) player.name = sanitize(msg.name, 20) || player.name;
            broadcast({ type: 'player_list', players: getPlayerList() });
            return;
          }

          if (msg.type === 'chat') {
            const now = Date.now();
            if (now - player.lastChatTime < CHAT_COOLDOWN_MS) return;
            player.lastChatTime = now;
            const text = sanitize(msg.text, CHAT_MAX_LEN);
            if (!text) return;
            broadcast({ type: 'chat', playerId: id, playerName: player.name, playerColor: player.color, text });
            return;
          }

          // Client actions → relay to host
          if (!player.isHost && ['move_settler', 'build', 'collect', 'attack', 'work_mode', 'request_state'].includes(msg.type)) {
            msg.playerId = id;
            sendTo(hostWs, msg);
            return;
          }

          // Host messages
          if (player.isHost) {
            if (msg.type === 'init') {
              gameSeed = msg.seed;
              const allSettlers = msg.settlerIds || [];
              const hostSettlers = allSettlers.slice(0, Math.ceil(allSettlers.length / 2));
              const clientSettlers = allSettlers.slice(Math.ceil(allSettlers.length / 2));
              player.assignedSettlers = hostSettlers;
              const clients = [...players.values()].filter((p: any) => !p.isHost);
              for (let i = 0; i < clients.length; i++) {
                (clients[i] as any).assignedSettlers = clientSettlers.slice(i * 2, (i + 1) * 2);
              }
              for (const p of players.values()) {
                if (!(p as any).isHost) {
                  sendTo((p as any).ws, {
                    type: 'init', playerId: (p as any).id, playerName: (p as any).name, playerColor: (p as any).color,
                    seed: msg.seed, mapWidth: msg.mapWidth, mapHeight: msg.mapHeight, tickCount: msg.tickCount,
                    players: getPlayerList(), entities: msg.entities || [], buildings: msg.buildings || [],
                    inventory: msg.inventory || [], assignedSettlers: (p as any).assignedSettlers,
                  });
                }
              }
              console.log(`[WS] Game init. Seed: ${msg.seed}`);
              return;
            }

            if (msg.type === 'state_sync') {
              broadcast({ type: 'state_sync', tick: msg.tick, entities: msg.entities || [], buildings: msg.buildings || [], inventory: msg.inventory || [] }, hostWs);
              return;
            }

            if (msg.type === 'entity_update' || msg.type === 'entity_add' || msg.type === 'entity_remove' || msg.type === 'building_update') {
              broadcast(msg, hostWs);
              return;
            }
          }
        });

        ws.on('close', () => {
          const player = players.get(id);
          if (player) {
            console.log(`[WS] Player ${id} "${(player as any).name}" disconnected`);
            if ((player as any).isHost) { hostWs = null; broadcast({ type: 'error', msg: 'Host disconnected' }); }
            players.delete(id);
            broadcast({ type: 'player_leave', playerId: id });
          }
        });
      });

      console.log('[WS] Multiplayer WebSocket ready on /ws');
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    host: true,
    port: 3000,
    open: true,
  },
  plugins: [multiplayerPlugin()],
});
