import type { Card, Rank, Suit } from "./types";

const RANK_FILE: Record<Rank, string> = {
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  T: "10",
  J: "jack",
  Q: "queen",
  K: "king",
  A: "ace",
};

const SUIT_FILE: Record<Suit, string> = {
  hearts: "hearts",
  diamonds: "diamonds",
  clubs: "clubs",
  spades: "spades",
};

/** Path to SVG-cards-1.3 asset in /public/cards */
export function cardSvgSrc(card: Card): string {
  return `/cards/${RANK_FILE[card.rank]}_of_${SUIT_FILE[card.suit]}.svg`;
}

export const CARD_BACK_SRC = "/cards/card_back.svg";
