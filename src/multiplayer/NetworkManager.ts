import { HostMessage, ClientMessage } from './Protocol';

export type MessageHandler = (msg: HostMessage) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (err: Event) => void;

export class NetworkManager {
  private ws: WebSocket | null = null;
  private url: string = '';
  private messageHandlers: MessageHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: ConnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = false;
  private playerName: string = '';

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get playerId(): number {
    return this._playerId;
  }
  private _playerId: number = 0;

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnect(handler: ConnectionHandler): void {
    this.connectHandlers.push(handler);
  }

  onDisconnect(handler: ConnectionHandler): void {
    this.disconnectHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  clearHandlers(): void {
    this.messageHandlers = [];
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
  }

  connect(url: string, name: string): void {
    this.url = url;
    this.playerName = name;
    this.shouldReconnect = true;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    // Build WebSocket URL: http://host:port → ws://host:port
    let wsUrl = this.url.replace(/^http/, 'ws');
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Net] Connected to', this.url);
      // Send join message
      this.send({ type: 'join', name: this.playerName });
      for (const h of this.connectHandlers) h();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as HostMessage;
        if (msg.type === 'init' || msg.type === 'player_list') {
          if (msg.playerId) this._playerId = msg.playerId;
        }
        for (const h of this.messageHandlers) h(msg);
      } catch (err) {
        console.error('[Net] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[Net] Disconnected');
      for (const h of this.disconnectHandlers) h();
      // No auto-reconnect — user must manually join again
    };

    this.ws.onerror = (e) => {
      console.error('[Net] Error:', e);
      for (const h of this.errorHandlers) h(e);
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

// Singleton for the connecting player
export const networkManager = new NetworkManager();
