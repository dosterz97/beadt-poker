"use client";

import { useState } from "react";
import type { PublicRoom } from "@/lib/types";

export function Lobby({
  room,
  playerId,
  onStart,
  onLeave,
  error,
}: {
  room: PublicRoom;
  playerId: string;
  onStart: () => Promise<boolean>;
  onLeave: () => void;
  error: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const isHost = room.hostId === playerId;
  const canStart = room.players.length >= 2;

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div>
          <p className="eyebrow">Table lobby</p>
          <h1>{room.name}</h1>
          <p className="room-code">
            Code <strong>{room.code}</strong>
            <button
              type="button"
              className="copy-btn"
              onClick={() => navigator.clipboard.writeText(room.code)}
            >
              Copy
            </button>
          </p>
        </div>
        <div className="lobby-blinds">
          Blinds {room.settings.smallBlind}/{room.settings.bigBlind}
          <span>· Stack {room.settings.startingChips}</span>
        </div>
      </header>

      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id} className={p.id === playerId ? "is-you" : ""}>
            <span className="dot" />
            <span className="pname">
              {p.name}
              {p.id === playerId ? " (you)" : ""}
            </span>
            <span className="meta">
              {p.isHost ? "Host" : "Player"} · {p.chips} chips
            </span>
          </li>
        ))}
        {Array.from({
          length: Math.max(0, room.settings.maxPlayers - room.players.length),
        }).map((_, i) => (
          <li key={`empty-${i}`} className="empty">
            <span className="dot hollow" />
            <span className="pname">Open seat</span>
          </li>
        ))}
      </ul>

      {error && <p className="error-banner">{error}</p>}

      <div className="lobby-actions">
        {isHost ? (
          <button
            className="btn btn-primary"
            disabled={!canStart || busy}
            onClick={async () => {
              setBusy(true);
              await onStart();
              setBusy(false);
            }}
          >
            {canStart ? "Start game" : "Need 2 players"}
          </button>
        ) : (
          <p className="waiting-host">Waiting for the host to start…</p>
        )}
        <button className="btn btn-ghost" type="button" onClick={onLeave}>
          Leave table
        </button>
      </div>

      <p className="share-hint">
        Share code <strong>{room.code}</strong> or this link with friends.
      </p>
    </div>
  );
}
