import { cardSvgSrc, CARD_BACK_SRC } from "@/lib/card-assets";
import { formatRank } from "@/lib/deck";
import type { Card } from "@/lib/types";

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
  const animClass =
    animate === "deal"
      ? "card-animate-deal"
      : animate === "reveal"
        ? "card-animate-reveal"
        : "";

  const delayStyle = delayMs ? { animationDelay: `${delayMs}ms` } : undefined;
  const sizeClass = `card-size-${size}`;
  const showBack = faceDown || !card;
  const src = showBack ? CARD_BACK_SRC : cardSvgSrc(card);
  const label = showBack
    ? "Face-down card"
    : `${formatRank(card.rank)} of ${card.suit}`;

  return (
    <div
      className={`playing-card svg-card ${sizeClass} ${animClass} ${className}`}
      style={delayStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        draggable={false}
        className="svg-card-img"
      />
    </div>
  );
}
