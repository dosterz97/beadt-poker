"use client";

import { useEffect, useState } from "react";
import type { GameAction } from "@/lib/types";

type Legal = {
  canFold?: boolean;
  canCheck?: boolean;
  canCall?: boolean;
  callAmount?: number;
  canRaise?: boolean;
  minRaiseTo?: number;
  maxRaiseTo?: number;
  canAllIn?: boolean;
  canDealNext?: boolean;
};

export function ActionBar({
  legal,
  onAction,
  disabled,
}: {
  legal: Legal | null;
  onAction: (action: GameAction | { type: "start" }) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [raiseTo, setRaiseTo] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;

  useEffect(() => {
    if (legal?.canRaise) {
      setRaiseTo(legal.minRaiseTo ?? 0);
    }
  }, [legal?.canRaise, legal?.minRaiseTo, legal?.maxRaiseTo]);

  const raiseValue =
    typeof raiseTo === "number" ? raiseTo : min || Math.ceil((min + max) / 2);

  const act = async (action: GameAction) => {
    setBusy(true);
    await onAction(action);
    setBusy(false);
  };

  const hasTurn = Boolean(
    legal &&
      (legal.canFold ||
        legal.canCheck ||
        legal.canCall ||
        legal.canRaise ||
        legal.canAllIn),
  );

  const canDealNext = Boolean(legal?.canDealNext);
  const showBet = Boolean(legal && (legal.canRaise || legal.canAllIn));

  return (
    <div className="action-dock" aria-live="polite">
      <div
        className={`action-bar ${!legal || (!hasTurn && !canDealNext) ? "waiting" : ""}`}
      >
        <div className="action-bar-main">
          {!legal && <span className="action-waiting-msg" />}
          {legal && canDealNext && (
            <button
              className="btn btn-primary btn-action-main"
              disabled={disabled || busy}
              onClick={async () => {
                setBusy(true);
                await onAction({ type: "ready-next" });
                setBusy(false);
              }}
            >
              Deal next hand
            </button>
          )}
          {legal && !canDealNext && hasTurn && (
            <>
              {legal.canFold && (
                <button
                  className="btn btn-fold"
                  disabled={disabled || busy}
                  onClick={() => act({ type: "fold" })}
                >
                  Fold
                </button>
              )}
              {legal.canCheck && (
                <button
                  className="btn btn-check"
                  disabled={disabled || busy}
                  onClick={() => act({ type: "check" })}
                >
                  Check
                </button>
              )}
              {legal.canCall && (
                <button
                  className="btn btn-call"
                  disabled={disabled || busy}
                  onClick={() => act({ type: "call" })}
                >
                  Call {legal.callAmount}
                </button>
              )}
            </>
          )}
          {legal && !canDealNext && !hasTurn && (
            <span className="action-waiting-msg">
              Waiting for other players…
            </span>
          )}
        </div>

        <div className={`action-bar-bet ${showBet ? "" : "is-idle"}`}>
          {showBet && legal?.canRaise && (
            <div className="raise-group">
              <input
                type="range"
                min={min}
                max={max}
                value={Math.min(Math.max(raiseValue, min), max)}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                disabled={disabled || busy}
                aria-label="Raise amount"
              />
              <input
                type="number"
                className="raise-input"
                min={min}
                max={max}
                value={raiseTo === "" ? raiseValue : raiseTo}
                onChange={(e) =>
                  setRaiseTo(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={disabled || busy}
                aria-label="Raise to"
              />
              <button
                className="btn btn-raise"
                disabled={disabled || busy}
                onClick={() => act({ type: "raise", amount: raiseValue })}
              >
                Raise
              </button>
            </div>
          )}
          {showBet && legal?.canAllIn && (
            <button
              className="btn btn-danger btn-allin"
              disabled={disabled || busy}
              onClick={() => act({ type: "all-in" })}
            >
              All-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
