import type { GameState, PlayerStatus } from "./types";

/** Minimal room shape needed to compute available actions (server or client). */
export type LegalRoomView = {
  game: GameState | null;
  players: Array<{
    id: string;
    seat: number;
    chips: number;
    bet: number;
    status: PlayerStatus;
  }>;
};

export type LegalActions = {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canAllIn: boolean;
  canDealNext: boolean;
};

const EMPTY: LegalActions = {
  canFold: false,
  canCheck: false,
  canCall: false,
  callAmount: 0,
  canRaise: false,
  minRaiseTo: 0,
  maxRaiseTo: 0,
  canAllIn: false,
  canDealNext: false,
};

function canAct(status: PlayerStatus, chips: number): boolean {
  return status === "active" && chips > 0;
}

/** Compute legal actions for a player from public/server room state. */
export function computeLegalActions(
  room: LegalRoomView,
  playerId: string,
): LegalActions {
  const game = room.game;
  if (!game) return EMPTY;

  if (game.street === "showdown") {
    return { ...EMPTY, canDealNext: true };
  }

  const player = room.players.find((p) => p.id === playerId);
  if (
    !player ||
    game.actingSeat !== player.seat ||
    !canAct(player.status, player.chips)
  ) {
    return EMPTY;
  }

  const toCall = game.currentBet - player.bet;
  const minRaiseTo = game.currentBet + game.minRaise;
  const maxRaiseTo = player.bet + player.chips;

  return {
    canFold: true,
    canCheck: toCall === 0,
    canCall: toCall > 0 && player.chips > 0,
    callAmount: Math.min(toCall, player.chips),
    canRaise: maxRaiseTo > game.currentBet && player.chips > toCall,
    minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
    maxRaiseTo,
    canAllIn: player.chips > 0,
    canDealNext: false,
  };
}
