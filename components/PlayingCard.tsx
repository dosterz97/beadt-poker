import { formatRank } from "@/lib/deck";
import type { Card } from "@/lib/types";

const SUIT_SYMBOL: Record<Card["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  animate = "none",
  delayMs = 0,
  className = "",
}: {
  card?: Card | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  /** deal = slide in face-down; reveal = flip face-up; none = static */
  animate?: "deal" | "reveal" | "none";
  delayMs?: number;
  className?: string;
}) {
  const dims =
    size === "sm"
      ? "w-9 h-[3.25rem] text-[0.65rem]"
      : size === "lg"
        ? "w-14 h-20 text-sm"
        : "w-11 h-16 text-xs";

  const animClass =
    animate === "deal"
      ? "card-animate-deal"
      : animate === "reveal"
        ? "card-animate-reveal"
        : "";

  const delayStyle = delayMs ? { animationDelay: `${delayMs}ms` } : undefined;

  if (faceDown || !card) {
    return (
      <div
        className={`playing-card ${dims} card-back rounded-md shadow-md border border-black/20 ${animClass} ${className}`}
        style={delayStyle}
        aria-label="Face-down card"
      />
    );
  }

  const red = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      className={`playing-card playing-card-face ${dims} relative rounded-md bg-[var(--card-face)] shadow-md border border-black/10 flex flex-col justify-between p-1 select-none ${animClass} ${className}`}
      style={{
        ...delayStyle,
        color: red ? "var(--suit-red)" : "var(--suit-black)",
      }}
      aria-label={`${formatRank(card.rank)} of ${card.suit}`}
    >
      <div className="leading-none font-semibold">
        <div>{formatRank(card.rank)}</div>
        <div className="-mt-0.5">{SUIT_SYMBOL[card.suit]}</div>
      </div>
      <div className="self-center text-lg leading-none opacity-90">
        {SUIT_SYMBOL[card.suit]}
      </div>
      <div className="leading-none font-semibold rotate-180 self-end">
        <div>{formatRank(card.rank)}</div>
        <div className="-mt-0.5">{SUIT_SYMBOL[card.suit]}</div>
      </div>
    </div>
  );
}
