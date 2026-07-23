"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOrCreatePlayerId,
  getStoredName,
  setStoredName,
} from "@/lib/player-id";
import type { RoomSummary } from "@/lib/types";

export function HomeClient() {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [mode, setMode] = useState<"create" | "join">("create");

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/rooms");
        const data = await res.json();
        if (!cancelled) setRooms(data.rooms ?? []);
      } catch {
        // ignore
      }
    };
    void load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId || !name.trim()) {
      setError("Enter a nickname first");
      return;
    }
    setBusy("create");
    setError(null);
    setStoredName(name);

    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        playerName: name.trim(),
        roomName: roomName.trim() || undefined,
        settings: { isPublic: true },
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not create room");
      return;
    }
    router.push(`/room/${data.room.code}`);
  };

  const joinRoom = async (code: string) => {
    if (!playerId || !name.trim()) {
      setError("Enter a nickname first");
      return;
    }
    setBusy("join");
    setError(null);
    setStoredName(name);

    const normalized = code.trim().toUpperCase();
    const res = await fetch(`/api/rooms/${normalized}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        playerId,
        playerName: name.trim(),
      }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Could not join room");
      return;
    }
    router.push(`/room/${normalized}`);
  };

  return (
    <div className="home">
      <div className="home-atmosphere" aria-hidden />
      <main className="home-main">
        <header className="home-hero">
          <p className="brand">Beadt</p>
          <h1>Texas Hold&apos;em tables, open to anyone.</h1>
          <p className="lede">
            Create a room, share the code, and deal — no accounts, just a seat
            at the felt.
          </p>
        </header>

        <section className="home-panel" aria-label="Play">
          <label className="field">
            Nickname
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="What should we call you?"
            />
          </label>

          <div className="mode-switch" role="tablist" aria-label="Room action">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              className={mode === "create" ? "active" : ""}
              onClick={() => {
                setMode("create");
                setError(null);
              }}
            >
              Create room
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "join"}
              className={mode === "join" ? "active" : ""}
              onClick={() => {
                setMode("join");
                setError(null);
              }}
            >
              Join room
            </button>
          </div>

          {mode === "create" ? (
            <form className="mode-panel mode-create" onSubmit={createRoom}>
              <div className="mode-copy">
                <h2>Host a new table</h2>
                <p>You get a shareable code. Friends join, you deal.</p>
              </div>
              <label className="field">
                Table name <span className="optional">(optional)</span>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={40}
                  placeholder="Friday night"
                />
              </label>
              <button
                className="btn btn-primary btn-block"
                disabled={busy !== null || !name.trim()}
              >
                {busy === "create" ? "Opening…" : "Create table"}
              </button>
            </form>
          ) : (
            <form
              className="mode-panel mode-join"
              onSubmit={(e) => {
                e.preventDefault();
                void joinRoom(joinCode);
              }}
            >
              <div className="mode-copy">
                <h2>Enter a room code</h2>
                <p>Got a 5-character code from a host? Drop it in.</p>
              </div>
              <label className="field">
                Room code
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="ABCD2"
                  className="code-input"
                  autoFocus
                />
              </label>
              <button
                className="btn btn-join btn-block"
                disabled={busy !== null || !joinCode.trim() || !name.trim()}
              >
                {busy === "join" ? "Joining…" : "Join table"}
              </button>
            </form>
          )}

          {error && <p className="error-banner">{error}</p>}
        </section>

        <section className="open-rooms" aria-label="Open rooms">
          <div className="section-head">
            <h2>Open tables</h2>
            <p>Public lobbies waiting for players</p>
          </div>
          {rooms.length === 0 ? (
            <p className="empty-rooms">No open tables — create one and deal in.</p>
          ) : (
            <ul className="room-list">
              {rooms.map((r) => (
                <li key={r.code}>
                  <button
                    type="button"
                    onClick={() => void joinRoom(r.code)}
                    disabled={busy !== null || !name.trim()}
                  >
                    <span className="r-name">{r.name}</span>
                    <span className="r-meta">
                      {r.playerCount}/{r.maxPlayers} · {r.smallBlind}/
                      {r.bigBlind}
                    </span>
                    <span className="r-code">{r.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
