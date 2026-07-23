"use client";

import { useCallback, useRef } from "react";
import type { GameAction, PublicPlayer, PublicRoom } from "@/lib/types";
import { PlayingCard } from "./PlayingCard";
import { ActionBar } from "./ActionBar";
import { WinnerCelebration } from "./WinnerCelebration";

/** Opponent seats sit on a tighter ellipse so cards stay inside the rail. */
function seatPosition(
  index: number,
  total: number,
): { left: string; top: string } {
  if (index === 0) {
    return { left: "50%", top: "88%" };
  }

  const others = total - 1;
  const slot = index - 1;
  const start = Math.PI * 0.95;
  const end = Math.PI * 0.05;
  const t = others === 1 ? 0.5 : slot / (others - 1);
  const angle = start + (end - start) * t;
  const x = 50 + 34 * Math.cos(angle);
  const y = 48 + 30 * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

function PlayerSeat({
  player,
  isHero,
  isActing,
  isDealer,
  isSB,
  isBB,
  compact,
  handNumber = 0,
  dealOffset = 0,
  isWinner,
  seatRef,
}: {
  player: PublicPlayer;
  isHero: boolean;
  isActing: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  compact?: boolean;
  handNumber?: number;
  dealOffset?: number;
  isWinner?: boolean;
  seatRef?: (el: HTMLDivElement | null) => void;
}) {
  const showCards = player.holeCards;
  const faceDownCount =
    !showCards && player.cardCount > 0 ? player.cardCount : 0;

  return (
    <div
      ref={seatRef}
      className={`seat ${isHero ? "seat-hero" : ""} ${isActing ? "seat-acting" : ""} ${player.status === "folded" ? "seat-folded" : ""} ${compact ? "seat-compact" : ""} ${isWinner ? "seat-winner" : ""}`}
    >
      {!isHero && (
        <div className="seat-cards">
          {showCards?.map((c, i) => (
            <PlayingCard
              key={`h${handNumber}-${player.id}-${c.rank}${c.suit}`}
              card={c}
              size="sm"
              animate="reveal"
              delayMs={dealOffset + i * 90}
            />
          ))}
          {faceDownCount > 0 &&
            Array.from({ length: faceDownCount }).map((_, i) => (
              <PlayingCard
                key={`d${handNumber}-${player.id}-${i}`}
                faceDown
                size="sm"
                animate="deal"
                delayMs={dealOffset + i * 70}
              />
            ))}
        </div>
      )}
      <div className="seat-info">
        <div className="seat-name">
          {player.name}
          {isHero ? " (you)" : ""}
          {player.isHost ? " ★" : ""}
        </div>
        <div className="seat-chips">{player.chips}</div>
        {player.bet > 0 && (
          <div className="seat-bet">
            <span className="chip-dot" />
            {player.bet}
          </div>
        )}
        {player.lastAction && (
          <div className="seat-action">{player.lastAction}</div>
        )}
        <div className="seat-badges">
          {isDealer && <span className="badge dealer">D</span>}
          {isSB && <span className="badge blind">SB</span>}
          {isBB && <span className="badge blind">BB</span>}
          {player.status === "all-in" && (
            <span className="badge allin">ALL-IN</span>
          )}
          {isWinner && <span className="badge win">WIN</span>}
        </div>
      </div>
    </div>
  );
}

export function PokerTable({
  room,
  playerId,
  legal,
  onAction,
  error,
}: {
  room: PublicRoom;
  playerId: string;
  legal: Record<string, unknown> | null;
  onAction: (action: GameAction | { type: "start" }) => Promise<boolean>;
  error: string | null;
}) {
  const game = room.game;
  const players = [...room.players].sort((a, b) => a.seat - b.seat);
  const heroIdx = Math.max(
    0,
    players.findIndex((p) => p.id === playerId),
  );

  const ordered = [
    ...players.slice(heroIdx),
    ...players.slice(0, heroIdx),
  ];
  const hero = ordered[0];
  const opponents = ordered.slice(1);
  const isHeroTurn = game?.actingSeat === hero?.seat;

  const winnerIds = new Set(game?.winners?.map((w) => w.playerId) ?? []);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const potRef = useRef<HTMLDivElement | null>(null);
  const seatMapRef = useRef(new Map<string, HTMLElement>());

  const bindSeat = useCallback((id: string, el: HTMLDivElement | null) => {
    const map = seatMapRef.current;
    if (el) map.set(id, el);
    else map.delete(id);
  }, []);

  const getWinnerLayout = useCallback(
    () => ({
      pot: potRef.current,
      stage: stageRef.current,
      seats: seatMapRef.current,
    }),
    [],
  );

  return (
    <div className="table-wrap">
      <div className="table-stage" ref={stageRef}>
        <div className="felt">
          <div className="felt-center">
            <div className="pot-label" ref={potRef}>
              {game ? (
                <>
                  <span className="pot-meta">
                    {game.street === "showdown" && game.winners?.length
                      ? "SHOWDOWN"
                      : game.street.toUpperCase()}
                    {game.handNumber ? ` · HAND #${game.handNumber}` : ""}
                  </span>
                  <span className="pot-amount">
                    {game.street === "showdown" && game.winners?.length
                      ? "Pot awarded"
                      : `Pot ${game.pot}`}
                  </span>
                </>
              ) : (
                <span className="pot-meta">Waiting…</span>
              )}
            </div>
            <div className="board">
              {(game?.communityCards ?? []).map((c, i) => (
                <PlayingCard
                  key={`b${game?.handNumber}-${c.rank}${c.suit}`}
                  card={c}
                  size="md"
                  animate="reveal"
                  delayMs={
                    (game?.communityCards.length ?? 0) <= 3 ? i * 100 : 40
                  }
                />
              ))}
              {game &&
                game.communityCards.length < 5 &&
                Array.from({ length: 5 - game.communityCards.length }).map(
                  (_, i) => (
                    <div key={`slot-${i}`} className="board-slot" />
                  ),
                )}
            </div>
            {game?.lastActionSummary &&
              !(game.street === "showdown" && game.winners?.length) && (
                <p className="action-summary">{game.lastActionSummary}</p>
              )}
          </div>

          {opponents.map((player, i) => {
            const pos = seatPosition(i + 1, ordered.length);
            return (
              <div
                key={player.id}
                className="seat-anchor"
                style={{ left: pos.left, top: pos.top }}
              >
                <PlayerSeat
                  player={player}
                  isHero={false}
                  isActing={game?.actingSeat === player.seat}
                  isDealer={game?.dealerSeat === player.seat}
                  isSB={game?.smallBlindSeat === player.seat}
                  isBB={game?.bigBlindSeat === player.seat}
                  compact
                  handNumber={game?.handNumber ?? 0}
                  dealOffset={(i + 1) * 50}
                  isWinner={winnerIds.has(player.id)}
                  seatRef={(el) => bindSeat(player.id, el)}
                />
              </div>
            );
          })}
        </div>

        {hero && (
          <div
            className={`hero-tray ${isHeroTurn ? "hero-turn" : ""} ${winnerIds.has(hero.id) ? "hero-winner" : ""}`}
          >
            <div className="hero-hand">
              {(hero.holeCards ?? []).map((c, i) => (
                <PlayingCard
                  key={`hero${game?.handNumber}-${c.rank}${c.suit}`}
                  card={c}
                  size="lg"
                  animate="reveal"
                  delayMs={80 + i * 120}
                  className="hero-card"
                />
              ))}
              {!hero.holeCards &&
                hero.cardCount > 0 &&
                Array.from({ length: hero.cardCount }).map((_, i) => (
                  <PlayingCard
                    key={`hd${game?.handNumber}-${i}`}
                    faceDown
                    size="lg"
                    animate="deal"
                    delayMs={80 + i * 100}
                  />
                ))}
            </div>
            <PlayerSeat
              player={hero}
              isHero
              isActing={isHeroTurn}
              isDealer={game?.dealerSeat === hero.seat}
              isSB={game?.smallBlindSeat === hero.seat}
              isBB={game?.bigBlindSeat === hero.seat}
              handNumber={game?.handNumber ?? 0}
              isWinner={winnerIds.has(hero.id)}
              seatRef={(el) => bindSeat(hero.id, el)}
            />
          </div>
        )}

        <WinnerCelebration
          handNumber={game?.handNumber ?? 0}
          winners={game?.street === "showdown" ? game.winners : null}
          getLayout={getWinnerLayout}
        />
      </div>

      {error && <p className="error-banner">{error}</p>}

      <ActionBar
        legal={
          legal as {
            canFold?: boolean;
            canCheck?: boolean;
            canCall?: boolean;
            callAmount?: number;
            canRaise?: boolean;
            minRaiseTo?: number;
            maxRaiseTo?: number;
            canAllIn?: boolean;
            canDealNext?: boolean;
          } | null
        }
        onAction={onAction}
      />
    </div>
  );
}
