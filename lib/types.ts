export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type RoomStatus = "lobby" | "playing" | "finished";
export type PlayerStatus =
  | "waiting"
  | "active"
  | "folded"
  | "all-in"
  | "sitting-out";

export interface Player {
  id: string;
  name: string;
  chips: number;
  seat: number;
  holeCards: Card[] | null;
  bet: number;
  totalBet: number;
  status: PlayerStatus;
  isHost: boolean;
  connected: boolean;
  lastAction: string | null;
  /** Cleared when facing a new bet/raise; set after voluntary action this street. */
  hasActed: boolean;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface HandResult {
  playerId: string;
  name: string;
  handName: string;
  amount: number;
  holeCards: Card[];
}

export interface GameState {
  street: Street;
  communityCards: Card[];
  pot: number;
  sidePots: Pot[];
  currentBet: number;
  minRaise: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  actingSeat: number | null;
  handNumber: number;
  winners: HandResult[] | null;
  lastActionSummary: string | null;
}

export interface RoomSettings {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  maxPlayers: number;
  isPublic: boolean;
}

export interface Room {
  code: string;
  name: string;
  status: RoomStatus;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  game: GameState | null;
  deck: Card[];
  createdAt: number;
  updatedAt: number;
}

/** Public view of a room for lobby listings. */
export interface RoomSummary {
  code: string;
  name: string;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  isPublic: boolean;
}

/** Client-safe room payload (hides other players' hole cards). */
export interface PublicRoom {
  code: string;
  name: string;
  status: RoomStatus;
  hostId: string;
  players: PublicPlayer[];
  settings: RoomSettings;
  game: GameState | null;
  createdAt: number;
  updatedAt: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  chips: number;
  seat: number;
  holeCards: Card[] | null;
  bet: number;
  totalBet: number;
  status: PlayerStatus;
  isHost: boolean;
  connected: boolean;
  lastAction: string | null;
  cardCount: number;
}

export type GameActionType =
  | "fold"
  | "check"
  | "call"
  | "raise"
  | "all-in"
  | "ready-next";

export interface GameAction {
  type: GameActionType;
  amount?: number;
}
