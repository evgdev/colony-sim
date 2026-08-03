// Multiplayer message protocol for Colony Sim

// ── Host → Client messages ──

export interface InitMessage {
  type: 'init';
  playerId: number;
  playerName: string;
  playerColor: string;
  seed: number;
  mapWidth: number;
  mapHeight: number;
  tickCount: number;
  players: PlayerInfo[];
  entities: any[];
  buildings: any[];
  inventory: { resourceType: string; quantity: number; name: string }[];
  assignedSettlers: number[]; // settler IDs this player controls
}

export interface StateSyncMessage {
  type: 'state_sync';
  tick: number;
  entities: any[];
  buildings: any[];
  inventory: { resourceType: string; quantity: number; name: string }[];
}

export interface EntityUpdateMessage {
  type: 'entity_update';
  id: number;
  x: number;
  y: number;
  hp?: number;
  state?: string;
}

export interface PlayerJoinMessage {
  type: 'player_join';
  player: PlayerInfo;
}

export interface PlayerLeaveMessage {
  type: 'player_leave';
  playerId: number;
}

export interface ChatMessage {
  type: 'chat';
  playerId: number;
  playerName: string;
  playerColor: string;
  text: string;
}

export interface ErrorMessage {
  type: 'error';
  msg: string;
}

// ── Client → Host messages ──

export interface JoinMessage {
  type: 'join';
  name: string;
}

export interface MoveSettlerMessage {
  type: 'move_settler';
  settlerId: number;
  x: number;
  y: number;
}

export interface BuildMessage {
  type: 'build';
  buildingType: string;
  x: number;
  y: number;
}

export interface CollectMessage {
  type: 'collect';
  entityId: number;
  settlerId: number;
}

export interface AttackMessage {
  type: 'attack';
  settlerId: number;
  targetId: number;
}

export interface WorkModeMessage {
  type: 'work_mode';
  settlerId: number;
  mode: 'auto' | 'gather' | 'build' | 'idle';
}

export interface ClientChatMessage {
  type: 'chat';
  text: string;
}

export interface RequestStateMessage {
  type: 'request_state';
}

// ── Types ──

export interface PlayerInfo {
  id: number;
  name: string;
  color: string;
  assignedSettlers: number[];
}

// ── Union types ──

export type HostMessage =
  | InitMessage
  | StateSyncMessage
  | EntityUpdateMessage
  | PlayerJoinMessage
  | PlayerLeaveMessage
  | ChatMessage
  | ErrorMessage
  | { type: 'entity_add'; entity: any }
  | { type: 'entity_remove'; id: number }
  | MoveSettlerMessage
  | BuildMessage
  | CollectMessage;

export type ClientMessage =
  | JoinMessage
  | MoveSettlerMessage
  | BuildMessage
  | CollectMessage
  | AttackMessage
  | WorkModeMessage
  | ClientChatMessage
  | RequestStateMessage;
