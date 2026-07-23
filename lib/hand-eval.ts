import { RANK_VALUES } from "./deck";
import type { Card, Rank } from "./types";

export type HandRank =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush"
  | "royal-flush";

export interface EvaluatedHand {
  rank: HandRank;
  rankValue: number;
  kickers: number[];
  name: string;
  cards: Card[];
}

const HAND_RANK_VALUE: Record<HandRank, number> = {
  "high-card": 1,
  pair: 2,
  "two-pair": 3,
  "three-of-a-kind": 4,
  straight: 5,
  flush: 6,
  "full-house": 7,
  "four-of-a-kind": 8,
  "straight-flush": 9,
  "royal-flush": 10,
};

const HAND_NAMES: Record<HandRank, string> = {
  "high-card": "High Card",
  pair: "Pair",
  "two-pair": "Two Pair",
  "three-of-a-kind": "Three of a Kind",
  straight: "Straight",
  flush: "Flush",
  "full-house": "Full House",
  "four-of-a-kind": "Four of a Kind",
  "straight-flush": "Straight Flush",
  "royal-flush": "Royal Flush",
};

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function rankName(value: number): string {
  const entry = Object.entries(RANK_VALUES).find(([, v]) => v === value);
  const rank = (entry?.[0] ?? "?") as Rank | "?";
  if (rank === "T") return "10";
  if (rank === "A") return "Ace";
  if (rank === "K") return "King";
  if (rank === "Q") return "Queen";
  if (rank === "J") return "Jack";
  return String(rank);
}

function evaluateFive(cards: Card[]): EvaluatedHand {
  const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const unique = [...new Set(values)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      straightHigh = unique[0];
    } else if (
      unique[0] === 14 &&
      unique[1] === 5 &&
      unique[2] === 4 &&
      unique[3] === 3 &&
      unique[4] === 2
    ) {
      straightHigh = 5; // wheel
    }
  }

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  let rank: HandRank = "high-card";
  let kickers: number[] = values;
  let name = "";

  if (straightHigh && isFlush) {
    rank = straightHigh === 14 ? "royal-flush" : "straight-flush";
    kickers = [straightHigh];
    name =
      rank === "royal-flush"
        ? "Royal Flush"
        : `Straight Flush, ${rankName(straightHigh)} high`;
  } else if (byCount[0][1] === 4) {
    rank = "four-of-a-kind";
    kickers = [byCount[0][0], byCount[1][0]];
    name = `Four of a Kind, ${rankName(byCount[0][0])}s`;
  } else if (byCount[0][1] === 3 && byCount[1]?.[1] === 2) {
    rank = "full-house";
    kickers = [byCount[0][0], byCount[1][0]];
    name = `Full House, ${rankName(byCount[0][0])}s full of ${rankName(byCount[1][0])}s`;
  } else if (isFlush) {
    rank = "flush";
    kickers = values;
    name = `Flush, ${rankName(values[0])} high`;
  } else if (straightHigh) {
    rank = "straight";
    kickers = [straightHigh];
    name = `Straight, ${rankName(straightHigh)} high`;
  } else if (byCount[0][1] === 3) {
    rank = "three-of-a-kind";
    kickers = [byCount[0][0], ...byCount.slice(1).map(([v]) => v)];
    name = `Three of a Kind, ${rankName(byCount[0][0])}s`;
  } else if (byCount[0][1] === 2 && byCount[1]?.[1] === 2) {
    rank = "two-pair";
    const pairs = [byCount[0][0], byCount[1][0]].sort((a, b) => b - a);
    kickers = [...pairs, byCount[2][0]];
    name = `Two Pair, ${rankName(pairs[0])}s and ${rankName(pairs[1])}s`;
  } else if (byCount[0][1] === 2) {
    rank = "pair";
    kickers = [byCount[0][0], ...byCount.slice(1).map(([v]) => v)];
    name = `Pair of ${rankName(byCount[0][0])}s`;
  } else {
    rank = "high-card";
    kickers = values;
    name = `${rankName(values[0])} High`;
  }

  return {
    rank,
    rankValue: HAND_RANK_VALUE[rank],
    kickers,
    name: name || HAND_NAMES[rank],
    cards,
  };
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const diff = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Best 5-card hand from 5–7 cards. */
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards to evaluate");
  }
  if (cards.length === 5) return evaluateFive(cards);

  let best: EvaluatedHand | null = null;
  for (const five of combinations(cards, 5)) {
    const evaluated = evaluateFive(five);
    if (!best || compareHands(evaluated, best) > 0) {
      best = evaluated;
    }
  }
  return best!;
}
