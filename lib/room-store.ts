import { applyAction, legalActions, startHand } from "./poker-engine";
import type {
  GameAction,
  Player,
  PublicPlayer,
  PublicRoom,
  Room,
  RoomSettings,
  RoomSummary,
} from "./types";

type Listener = (room: PublicRoom) => void;

const globalStore = globalThis as typeof globalThis & {
  __beadtRooms?: Map<string, Room>;
  __beadtListeners?: Map<string, Set<Listener>>;
};

function rooms(): Map<string, Room> {
  if (!globalStore.__beadtRooms) {
    globalStore.__beadtRooms = new Map();
  }
  return globalStore.__beadtRooms;
}

function listeners(): Map<string, Set<Listener>> {
  if (!globalStore.__beadtListeners) {
    globalStore.__beadtListeners = new Map();
  }
  return globalStore.__beadtListeners;
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  if (rooms().has(code)) return generateCode();
  return code;
}

function nextSeat(room: Room): number {
  const used = new Set(room.players.map((p) => p.seat));
  for (let i = 0; i < room.settings.maxPlayers; i++) {
    if (!used.has(i)) return i;
  }
  return -1;
}

export function toPublicRoom(room: Room, viewerId?: string): PublicRoom {
  const showdown = room.game?.street === "showdown";

  const players: PublicPlayer[] = room.players.map((p) => {
    const showCards =
      p.id === viewerId ||
      (showdown && p.status !== "folded" && p.holeCards !== null);

    return {
      id: p.id,
      name: p.name,
      chips: p.chips,
      seat: p.seat,
      holeCards: showCards ? p.holeCards : null,
      bet: p.bet,
      totalBet: p.totalBet,
      status: p.status,
      isHost: p.isHost,
      connected: p.connected,
      lastAction: p.lastAction,
      cardCount: p.holeCards?.length ?? 0,
    };
  });

  return {
    code: room.code,
    name: room.name,
    status: room.status,
    hostId: room.hostId,
    players,
    settings: room.settings,
    game: room.game
      ? {
          ...room.game,
          // winners already include hole cards at showdown — fine to send
        }
      : null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function touch(room: Room): void {
  room.updatedAt = Date.now();
  emit(room);
}

function emit(room: Room): void {
  const set = listeners().get(room.code);
  if (!set) return;
  // Each listener may have a different viewer — send full public with no viewer
  // and let clients merge; for privacy we re-emit per-subscriber with viewer id.
  // Listeners store their viewerId in a wrapper.
  for (const listener of set) {
    listener(toPublicRoom(room));
  }
}

export type RoomListener = {
  viewerId?: string;
  onEvent: (room: PublicRoom) => void;
};

export function subscribe(
  code: string,
  viewerId: string | undefined,
  onEvent: (room: PublicRoom) => void,
): () => void {
  const roomMap = listeners();
  if (!roomMap.has(code)) roomMap.set(code, new Set());

  const wrapped: Listener = () => {
    const room = rooms().get(code);
    if (!room) return;
    onEvent(toPublicRoom(room, viewerId));
  };

  roomMap.get(code)!.add(wrapped);

  // Immediate snapshot
  const room = rooms().get(code);
  if (room) onEvent(toPublicRoom(room, viewerId));

  return () => {
    roomMap.get(code)?.delete(wrapped);
  };
}

export function listPublicRooms(): RoomSummary[] {
  return [...rooms().values()]
    .filter((r) => r.settings.isPublic && r.status === "lobby")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({
      code: r.code,
      name: r.name,
      status: r.status,
      playerCount: r.players.length,
      maxPlayers: r.settings.maxPlayers,
      smallBlind: r.settings.smallBlind,
      bigBlind: r.settings.bigBlind,
      isPublic: r.settings.isPublic,
    }));
}

export function getRoom(code: string): Room | undefined {
  return rooms().get(code.toUpperCase());
}

export function createRoom(input: {
  playerId: string;
  playerName: string;
  roomName?: string;
  settings?: Partial<RoomSettings>;
}): { room: Room; player: Player } {
  const code = generateCode();
  const settings: RoomSettings = {
    smallBlind: input.settings?.smallBlind ?? 5,
    bigBlind: input.settings?.bigBlind ?? 10,
    startingChips: input.settings?.startingChips ?? 1000,
    maxPlayers: input.settings?.maxPlayers ?? 8,
    isPublic: input.settings?.isPublic ?? true,
  };

  const player: Player = {
    id: input.playerId,
    name: input.playerName.trim().slice(0, 16) || "Player",
    chips: settings.startingChips,
    seat: 0,
    holeCards: null,
    bet: 0,
    totalBet: 0,
    status: "waiting",
    isHost: true,
    connected: true,
    lastAction: null,
    hasActed: false,
  };

  const room: Room = {
    code,
    name: (input.roomName?.trim() || `${player.name}'s Table`).slice(0, 40),
    status: "lobby",
    hostId: player.id,
    players: [player],
    settings,
    game: null,
    deck: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  rooms().set(code, room);
  return { room, player };
}

export function joinRoom(input: {
  code: string;
  playerId: string;
  playerName: string;
}): { ok: true; room: Room } | { ok: false; error: string } {
  const room = getRoom(input.code);
  if (!room) return { ok: false, error: "Room not found" };

  const existing = room.players.find((p) => p.id === input.playerId);
  if (existing) {
    existing.connected = true;
    existing.name = input.playerName.trim().slice(0, 16) || existing.name;
    touch(room);
    return { ok: true, room };
  }

  if (room.players.length >= room.settings.maxPlayers) {
    return { ok: false, error: "Room is full" };
  }

  const seat = nextSeat(room);
  if (seat < 0) return { ok: false, error: "Room is full" };

  room.players.push({
    id: input.playerId,
    name: input.playerName.trim().slice(0, 16) || "Player",
    chips: room.settings.startingChips,
    seat,
    holeCards: null,
    bet: 0,
    totalBet: 0,
    status: room.status === "playing" ? "sitting-out" : "waiting",
    isHost: false,
    connected: true,
    lastAction: null,
    hasActed: false,
  });

  touch(room);
  return { ok: true, room };
}

export function leaveRoom(
  code: string,
  playerId: string,
): { ok: true } | { ok: false; error: string } {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };

  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return { ok: false, error: "Not in room" };

  if (room.status === "playing") {
    room.players[idx].connected = false;
    // Auto-fold if it was their turn
    if (room.game?.actingSeat === room.players[idx].seat) {
      applyAction(room, playerId, { type: "fold" });
    }
    touch(room);
    return { ok: true };
  }

  room.players.splice(idx, 1);

  if (room.players.length === 0) {
    rooms().delete(room.code);
    return { ok: true };
  }

  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  touch(room);
  return { ok: true };
}

export function startGame(
  code: string,
  playerId: string,
): { ok: true; room: Room } | { ok: false; error: string } {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.hostId !== playerId) return { ok: false, error: "Only the host can start" };
  if (room.players.filter((p) => p.chips > 0).length < 2) {
    return { ok: false, error: "Need at least 2 players with chips" };
  }

  startHand(room);
  touch(room);
  return { ok: true, room };
}

export function performAction(
  code: string,
  playerId: string,
  action: GameAction,
): { ok: true; room: Room } | { ok: false; error: string } {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };

  const result = applyAction(room, playerId, action);
  if (!result.ok) return result;

  touch(room);
  return { ok: true, room };
}

export function getLegalActions(code: string, playerId: string) {
  const room = getRoom(code);
  if (!room) return null;
  return legalActions(room, playerId);
}

export function updateSettings(
  code: string,
  playerId: string,
  settings: Partial<RoomSettings>,
): { ok: true; room: Room } | { ok: false; error: string } {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };
  if (room.hostId !== playerId) return { ok: false, error: "Only the host can change settings" };
  if (room.status !== "lobby") {
    return { ok: false, error: "Can only change settings in the lobby" };
  }

  room.settings = { ...room.settings, ...settings };
  // Reseat chips if starting stack changed
  if (settings.startingChips) {
    for (const p of room.players) {
      p.chips = settings.startingChips;
    }
  }
  touch(room);
  return { ok: true, room };
}

// Cleanup stale empty rooms periodically
const CLEANUP_MS = 1000 * 60 * 60;
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms()) {
    if (room.players.length === 0 || now - room.updatedAt > CLEANUP_MS) {
      rooms().delete(code);
    }
  }
}, 60_000).unref?.();
