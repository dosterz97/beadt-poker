"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { HandResult } from "@/lib/types";

type Flight = {
  id: string;
  tx: number;
  ty: number;
  delay: number;
};

type Burst = {
  key: string;
  flights: Flight[];
  winners: HandResult[];
  originLeft: number;
  originTop: number;
  glows: { id: string; left: number; top: number }[];
};

export type WinnerLayout = {
  pot: HTMLElement | null;
  stage: HTMLElement | null;
  seats: Map<string, HTMLElement>;
};

function measureBurst(
  winners: HandResult[],
  handNumber: number,
  layout: WinnerLayout,
): Burst | null {
  const { pot, stage, seats } = layout;
  if (!pot || !stage) return null;

  const stageBox = stage.getBoundingClientRect();
  const potBox = pot.getBoundingClientRect();
  const originLeft = potBox.left + potBox.width / 2 - stageBox.left;
  const originTop = potBox.top + potBox.height / 2 - stageBox.top;

  const flights: Flight[] = [];
  const glows: Burst["glows"] = [];

  winners.forEach((winner, wi) => {
    const seat = seats.get(winner.playerId);
    if (!seat) return;

    const seatBox = seat.getBoundingClientRect();
    const targetX = seatBox.left + seatBox.width / 2 - stageBox.left;
    const targetY = seatBox.top + seatBox.height / 2 - stageBox.top;

    glows.push({ id: winner.playerId, left: targetX, top: targetY });

    const chipCount = Math.min(12, Math.max(6, Math.round(winner.amount / 35)));
    for (let i = 0; i < chipCount; i++) {
      const spread = (i - (chipCount - 1) / 2) * 9;
      flights.push({
        id: `${winner.playerId}-${i}`,
        tx: targetX - originLeft + spread,
        ty: targetY - originTop + (i % 3) * 5,
        delay: wi * 140 + i * 50,
      });
    }
  });

  if (flights.length === 0) return null;

  return {
    key: `${handNumber}:${winners.map((w) => `${w.playerId}:${w.amount}`).join("|")}`,
    flights,
    winners,
    originLeft,
    originTop,
    glows,
  };
}

export function WinnerCelebration({
  handNumber,
  winners,
  getLayout,
}: {
  handNumber: number;
  winners: HandResult[] | null;
  getLayout: () => WinnerLayout;
}) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  const winnerKey = useMemo(() => {
    if (!winners?.length) return "";
    return `${handNumber}:${winners.map((w) => `${w.playerId}:${w.amount}`).join("|")}`;
  }, [handNumber, winners]);

  useEffect(() => {
    if (!winnerKey || !winners?.length) {
      setBurst(null);
      setBannerVisible(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tryMeasure = () => {
      if (cancelled) return;
      const next = measureBurst(winners, handNumber, getLayout());
      if (!next && attempts < 8) {
        attempts += 1;
        requestAnimationFrame(tryMeasure);
        return;
      }
      if (!next) return;
      setBurst(next);
      setBannerVisible(true);
    };

    const start = requestAnimationFrame(tryMeasure);
    const hide = window.setTimeout(() => setBannerVisible(false), 4500);

    return () => {
      cancelled = true;
      cancelAnimationFrame(start);
      window.clearTimeout(hide);
    };
  }, [winnerKey, winners, handNumber, getLayout]);

  if (!burst) return null;

  return (
    <div className="winner-layer" aria-live="polite">
      <div
        className="winner-pot-burst"
        style={{ left: burst.originLeft, top: burst.originTop }}
      />

      {burst.flights.map((f) => {
        const style = {
          left: burst.originLeft,
          top: burst.originTop,
          "--tx": `${f.tx}px`,
          "--ty": `${f.ty}px`,
          "--delay": `${f.delay}ms`,
        } as CSSProperties;

        return (
          <span
            key={`${burst.key}-${f.id}`}
            className="flying-chip"
            style={style}
          />
        );
      })}

      {burst.glows.map((g) => (
        <div
          key={`${burst.key}-glow-${g.id}`}
          className="winner-seat-glow"
          style={{ left: g.left, top: g.top }}
        />
      ))}

      {bannerVisible && (
        <div className="winner-banner">
          {burst.winners.map((w) => (
            <div key={w.playerId} className="winner-banner-row">
              <span className="winner-crown">Winner</span>
              <strong>{w.name}</strong>
              <span className="winner-amount">+{w.amount}</span>
              {w.handName !== "Last player standing" && (
                <span className="winner-hand">{w.handName}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
