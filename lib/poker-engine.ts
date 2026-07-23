import { createDeck, draw } from "./deck";
import { compareHands, evaluateHand } from "./hand-eval";
import type {
  Card,
  GameAction,
  GameState,
  HandResult,
  Player,
  Room,
  Street,
} from "./types";

function seatedPlayers(room: Room): Player[] {
  return [...room.players].sort((a, b) => a.seat - b.seat);
}

function notFolded(players: Player[]): Player[] {
  return players.filter((p) => p.status !== "folded" && p.status !== "sitting-out");
}

function canAct(p: Player): boolean {
  return p.status === "active" && p.chips > 0;
}

function nextSeat(
  players: Player[],
  fromSeat: number,
  predicate: (p: Player) => boolean,
): number | null {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  if (sorted.length === 0) return null;
  const startIdx = sorted.findIndex((p) => p.seat === fromSeat);
  const n = sorted.length;
  for (let i = 1; i <= n; i++) {
    const p = sorted[(startIdx + i) % n];
    if (predicate(p)) return p.seat;
  }
  return null;
}

function playerAtSeat(players: Player[], seat: number): Player | undefined {
  return players.find((p) => p.seat === seat);
}

function postBlind(player: Player, amount: number): number {
  const posted = Math.min(amount, player.chips);
  player.chips -= posted;
  player.bet += posted;
  player.totalBet += posted;
  if (player.chips === 0) player.status = "all-in";
  return posted;
}

export function startHand(room: Room): void {
  const players = seatedPlayers(room).filter((p) => p.chips > 0);
  if (players.length < 2) {
    room.status = "lobby";
    room.game = null;
    return;
  }

  // Reset for new hand
  for (const p of room.players) {
    p.holeCards = null;
    p.bet = 0;
    p.totalBet = 0;
    p.lastAction = null;
    p.hasActed = false;
    if (p.chips > 0) {
      p.status = "active";
    } else {
      p.status = "sitting-out";
    }
  }

  let deck = createDeck();
  const inHand = seatedPlayers(room).filter((p) => p.status === "active");

  const prevDealer = room.game?.dealerSeat ?? inHand[inHand.length - 1].seat;
  const dealerSeat =
    nextSeat(inHand, prevDealer, (p) => p.status === "active") ?? inHand[0].seat;

  const smallBlindSeat =
    inHand.length === 2
      ? dealerSeat
      : (nextSeat(inHand, dealerSeat, (p) => p.status === "active") ?? dealerSeat);

  const bigBlindSeat =
    nextSeat(inHand, smallBlindSeat, (p) => p.status === "active") ?? smallBlindSeat;

  const { smallBlind, bigBlind } = room.settings;

  const sb = playerAtSeat(room.players, smallBlindSeat)!;
  const bb = playerAtSeat(room.players, bigBlindSeat)!;
  const sbPosted = postBlind(sb, smallBlind);
  const bbPosted = postBlind(bb, bigBlind);
  sb.lastAction = `SB ${sbPosted}`;
  bb.lastAction = `BB ${bbPosted}`;

  // Deal hole cards
  for (const p of inHand) {
    const dealt = draw(deck, 2);
    deck = dealt.deck;
    p.holeCards = dealt.cards;
  }

  const actingSeat =
    nextSeat(inHand, bigBlindSeat, (p) => canAct(p)) ?? bigBlindSeat;

  room.deck = deck;
  room.status = "playing";
  room.game = {
    street: "preflop",
    communityCards: [],
    pot: sbPosted + bbPosted,
    sidePots: [],
    currentBet: Math.max(sbPosted, bbPosted),
    minRaise: bigBlind,
    dealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    actingSeat,
    handNumber: (room.game?.handNumber ?? 0) + 1,
    winners: null,
    lastActionSummary: `Hand #${(room.game?.handNumber ?? 0) + 1} dealt`,
  };

  // If only one player can act (everyone else all-in on blinds), advance
  maybeAutoAdvance(room);
}

function contribToPot(room: Room, player: Player, amount: number): void {
  const paid = Math.min(amount, player.chips);
  player.chips -= paid;
  player.bet += paid;
  player.totalBet += paid;
  room.game!.pot += paid;
  if (player.chips === 0) player.status = "all-in";
}

function bettingComplete(room: Room): boolean {
  const game = room.game!;
  const contenders = notFolded(room.players).filter(
    (p) => p.status === "active" || p.status === "all-in",
  );
  const actors = contenders.filter((p) => canAct(p));

  if (contenders.length <= 1) return true;
  if (actors.length === 0) return true;

  // Everyone who can act must have acted this round and matched the bet
  return actors.every((p) => p.hasActed && p.bet === game.currentBet);
}

function markActed(player: Player): void {
  player.hasActed = true;
}

function clearActsExcept(room: Room, exceptId: string): void {
  for (const p of room.players) {
    if (p.id !== exceptId && canAct(p)) {
      p.hasActed = false;
    }
  }
}

function dealCommunity(room: Room, count: number): void {
  const burned = draw(room.deck, 1);
  room.deck = burned.deck;
  const dealt = draw(room.deck, count);
  room.deck = dealt.deck;
  room.game!.communityCards.push(...dealt.cards);
}

function resetBets(room: Room): void {
  for (const p of room.players) {
    p.bet = 0;
    p.hasActed = false;
    if (p.status === "active") p.lastAction = null;
  }
  room.game!.currentBet = 0;
  room.game!.minRaise = room.settings.bigBlind;
}

function nextStreet(room: Room): void {
  const game = room.game!;
  const order: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
  const idx = order.indexOf(game.street);

  if (notFolded(room.players).length <= 1) {
    awardPotToLastStanding(room);
    return;
  }

  const actorsLeft = notFolded(room.players).filter((p) => canAct(p));
  if (actorsLeft.length <= 1 && game.street !== "river") {
    // Run out the board
    while (game.communityCards.length < 5) {
      dealCommunity(room, game.communityCards.length === 0 ? 3 : 1);
    }
    game.street = "showdown";
    resolveShowdown(room);
    return;
  }

  if (game.street === "river") {
    game.street = "showdown";
    resolveShowdown(room);
    return;
  }

  const next = order[idx + 1];
  game.street = next;
  resetBets(room);

  if (next === "flop") dealCommunity(room, 3);
  else if (next === "turn" || next === "river") dealCommunity(room, 1);

  if (next === "showdown") {
    resolveShowdown(room);
    return;
  }

  // First to act: left of dealer
  const contenders = notFolded(room.players);
  game.actingSeat = nextSeat(
    contenders,
    game.dealerSeat,
    (p) => canAct(p),
  );
  game.lastActionSummary = `${next.charAt(0).toUpperCase() + next.slice(1)} dealt`;

  if (game.actingSeat === null || bettingComplete(room)) {
    nextStreet(room);
  }
}

function awardPotToLastStanding(room: Room): void {
  const game = room.game!;
  const winner = notFolded(room.players)[0];
  if (!winner) return;

  winner.chips += game.pot;
  const result: HandResult = {
    playerId: winner.id,
    name: winner.name,
    handName: "Last player standing",
    amount: game.pot,
    holeCards: winner.holeCards ?? [],
  };
  game.winners = [result];
  game.actingSeat = null;
  game.street = "showdown";
  game.lastActionSummary = `${winner.name} wins ${game.pot}`;
  game.pot = 0;
}

function resolveShowdown(room: Room): void {
  const game = room.game!;
  const contenders = notFolded(room.players).filter((p) => p.holeCards);

  if (contenders.length === 1) {
    awardPotToLastStanding(room);
    return;
  }

  // Simple pot: award entire pot to best hand(s); side pots approximated by totalBet layers
  const contributions = contenders
    .map((p) => p.totalBet)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const levels = [...new Set(contributions)];

  const winners: HandResult[] = [];
  let remainingPot = game.pot;
  let prevLevel = 0;

  // Include folded players' chips already in pot via remainingPot tracking
  // Build side pots from all players' totalBets
  const allContributors = room.players.filter((p) => p.totalBet > 0);
  const allLevels = [...new Set(allContributors.map((p) => p.totalBet))].sort(
    (a, b) => a - b,
  );

  for (const level of allLevels.length ? allLevels : levels) {
    const potSize = allContributors
      .filter((p) => p.totalBet >= level)
      .reduce((sum) => sum + (level - prevLevel), 0);

    const eligible = contenders.filter((p) => p.totalBet >= level);
    if (eligible.length === 0 || potSize <= 0) {
      prevLevel = level;
      continue;
    }

    const evaluated = eligible.map((p) => ({
      player: p,
      hand: evaluateHand([...p.holeCards!, ...game.communityCards]),
    }));

    evaluated.sort((a, b) => compareHands(b.hand, a.hand));
    const best = evaluated[0].hand;
    const tied = evaluated.filter((e) => compareHands(e.hand, best) === 0);
    const share = Math.floor(potSize / tied.length);
    let leftover = potSize - share * tied.length;

    for (const t of tied) {
      const amount = share + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
      t.player.chips += amount;
      remainingPot -= amount;
      const existing = winners.find((w) => w.playerId === t.player.id);
      if (existing) {
        existing.amount += amount;
      } else {
        winners.push({
          playerId: t.player.id,
          name: t.player.name,
          handName: t.hand.name,
          amount,
          holeCards: t.player.holeCards!,
        });
      }
    }

    prevLevel = level;
  }

  // Safety: any rounding remainder
  if (remainingPot > 0 && winners.length > 0) {
    const p = room.players.find((pl) => pl.id === winners[0].playerId)!;
    p.chips += remainingPot;
    winners[0].amount += remainingPot;
  }

  game.winners = winners;
  game.pot = 0;
  game.actingSeat = null;
  game.street = "showdown";
  game.lastActionSummary =
    winners.length === 1
      ? `${winners[0].name} wins ${winners[0].amount} with ${winners[0].handName}`
      : `Split pot: ${winners.map((w) => w.name).join(", ")}`;
}

function maybeAutoAdvance(room: Room): void {
  if (!room.game || room.game.street === "showdown") return;

  const contenders = notFolded(room.players);
  if (contenders.length <= 1) {
    awardPotToLastStanding(room);
    return;
  }

  const actors = contenders.filter((p) => canAct(p));
  if (actors.length === 0) {
    // Everyone all-in — run out board
    while (room.game.communityCards.length < 5) {
      dealCommunity(room, room.game.communityCards.length === 0 ? 3 : 1);
    }
    room.game.street = "showdown";
    resolveShowdown(room);
  }
}

export function applyAction(
  room: Room,
  playerId: string,
  action: GameAction,
): { ok: true } | { ok: false; error: string } {
  const game = room.game;
  if (!game || room.status !== "playing") {
    return { ok: false, error: "No hand in progress" };
  }

  if (action.type === "ready-next") {
    if (game.street !== "showdown") {
      return { ok: false, error: "Hand is still in progress" };
    }
    const withChips = room.players.filter((p) => p.chips > 0);
    if (withChips.length < 2) {
      room.status = "lobby";
      room.game = null;
      return { ok: true };
    }
    startHand(room);
    return { ok: true };
  }

  if (game.street === "showdown") {
    return { ok: false, error: "Hand is over — deal the next hand" };
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "Player not found" };
  if (game.actingSeat !== player.seat) {
    return { ok: false, error: "Not your turn" };
  }
  if (!canAct(player)) return { ok: false, error: "You cannot act" };

  const toCall = game.currentBet - player.bet;

  switch (action.type) {
    case "fold": {
      player.status = "folded";
      player.lastAction = "Fold";
      game.lastActionSummary = `${player.name} folds`;
      markActed(player);
      break;
    }
    case "check": {
      if (toCall > 0) return { ok: false, error: "Cannot check — must call or fold" };
      player.lastAction = "Check";
      game.lastActionSummary = `${player.name} checks`;
      markActed(player);
      break;
    }
    case "call": {
      if (toCall <= 0) return { ok: false, error: "Nothing to call" };
      contribToPot(room, player, toCall);
      player.lastAction =
        player.status === "all-in" ? "All-in" : `Call ${toCall}`;
      game.lastActionSummary = `${player.name} ${player.lastAction.toLowerCase()}`;
      markActed(player);
      break;
    }
    case "raise": {
      const raiseTo = action.amount ?? 0;
      const minRaiseTo = game.currentBet + game.minRaise;
      if (raiseTo < minRaiseTo && raiseTo < player.bet + player.chips) {
        return {
          ok: false,
          error: `Minimum raise is to ${minRaiseTo}`,
        };
      }
      const needed = raiseTo - player.bet;
      if (needed <= 0) return { ok: false, error: "Invalid raise" };
      if (needed > player.chips) {
        return { ok: false, error: "Not enough chips" };
      }

      const prevBet = game.currentBet;
      contribToPot(room, player, needed);
      const newBet = player.bet;
      if (newBet > prevBet) {
        game.minRaise = Math.max(game.minRaise, newBet - prevBet);
        game.currentBet = newBet;
        clearActsExcept(room, player.id);
      }
      player.lastAction =
        player.status === "all-in" ? "All-in" : `Raise to ${newBet}`;
      game.lastActionSummary = `${player.name} ${player.lastAction.toLowerCase()}`;
      markActed(player);
      break;
    }
    case "all-in": {
      const prevBet = game.currentBet;
      const allInAmount = player.chips;
      contribToPot(room, player, allInAmount);
      if (player.bet > prevBet) {
        game.minRaise = Math.max(game.minRaise, player.bet - prevBet);
        game.currentBet = player.bet;
        clearActsExcept(room, player.id);
      }
      player.lastAction = "All-in";
      game.lastActionSummary = `${player.name} is all-in`;
      markActed(player);
      break;
    }
    default:
      return { ok: false, error: "Unknown action" };
  }

  // Advance turn or street
  if (notFolded(room.players).length <= 1) {
    awardPotToLastStanding(room);
    return { ok: true };
  }

  if (bettingComplete(room)) {
    nextStreet(room);
  } else {
    const next = nextSeat(
      notFolded(room.players),
      player.seat,
      (p) =>
        canAct(p) && (!p.hasActed || p.bet < game.currentBet),
    );
    game.actingSeat = next;
    if (next === null) nextStreet(room);
  }

  return { ok: true };
}

export { computeLegalActions as legalActions } from "./legal";

export function revealCardsForShowdown(cards: Card[] | null, reveal: boolean): Card[] | null {
  if (!cards) return null;
  return reveal ? cards : null;
}
