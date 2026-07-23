"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOrCreatePlayerId,
  getStoredName,
  setStoredName,
} from "@/lib/player-id";
import { useRoom } from "@/lib/use-room";
import type { GameAction } from "@/lib/types";
import { Lobby } from "./Lobby";
import { PokerTable } from "./PokerTable";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const { room, error, setError, legal, connected, sendAction } = useRoom(
    joined ? code : "",
    playerId,
  );

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
  }, []);

  // Auto-rejoin if we already have a name and were in this room
  useEffect(() => {
    if (!playerId || joined) return;
    const stored = getStoredName();
    if (!stored) return;

    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          playerId,
          playerName: stored,
        }),
      });
      if (cancelled) return;
      if (res.ok) {
        setName(stored);
        setJoined(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId, code, joined]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId || !name.trim()) return;
    setJoining(true);
    setJoinError(null);
    setStoredName(name);

    const res = await fetch(`/api/rooms/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        playerId,
        playerName: name.trim(),
      }),
    });
    const data = await res.json();
    setJoining(false);
    if (!res.ok) {
      setJoinError(data.error ?? "Could not join");
      return;
    }
    setJoined(true);
  };

  const handleLeave = async () => {
    await fetch(`/api/rooms/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave", playerId }),
    });
    router.push("/");
  };

  const onAction = async (action: GameAction | { type: "start" }) => {
    return sendAction(action);
  };

  if (!playerId) {
    return <div className="page-center">Loading…</div>;
  }

  if (!joined) {
    return (
      <div className="page-center">
        <form className="join-panel" onSubmit={handleJoin}>
          <p className="eyebrow">Join table</p>
          <h1>{code}</h1>
          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="Nickname"
              required
              autoFocus
            />
          </label>
          {joinError && <p className="error-banner">{joinError}</p>}
          <button className="btn btn-primary" disabled={joining || !name.trim()}>
            {joining ? "Joining…" : "Take a seat"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push("/")}
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="page-center">
        <p>Connecting to table…</p>
        <p className="muted">{connected ? "Synced" : "Reconnecting…"}</p>
      </div>
    );
  }

  return (
    <div className="room-shell">
      <div className="room-topbar">
        <a href="/" className="brand-mini">
          Beadt
        </a>
        <div className="room-meta">
          <span className="code-pill">{room.code}</span>
          <span className={`live-dot ${connected ? "on" : ""}`} />
          <span className="muted">
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleLeave}>
          Leave
        </button>
      </div>

      {room.status === "lobby" || !room.game ? (
        <Lobby
          room={room}
          playerId={playerId}
          error={error}
          onStart={async () => {
            const ok = await sendAction({ type: "start" });
            if (!ok) setError(error);
            return ok;
          }}
          onLeave={handleLeave}
        />
      ) : (
        <PokerTable
          room={room}
          playerId={playerId}
          legal={legal}
          onAction={onAction}
          error={error}
        />
      )}
    </div>
  );
}
