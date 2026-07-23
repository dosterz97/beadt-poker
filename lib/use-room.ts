"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeLegalActions } from "./legal";
import type { GameAction, PublicRoom } from "./types";

export function useRoom(code: string, playerId: string) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Derive turn buttons from the live room snapshot so every SSE update
  // immediately unlocks the acting player's controls.
  const legal = useMemo(() => {
    if (!room || !playerId) return null;
    return computeLegalActions(room, playerId);
  }, [room, playerId]);

  useEffect(() => {
    if (!code || !playerId) return;

    const es = new EventSource(
      `/api/rooms/${code}/events?playerId=${encodeURIComponent(playerId)}`,
    );
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          type: string;
          room?: PublicRoom;
        };
        if (data.type === "room" && data.room) {
          setRoom(data.room);
          setError(null);
        }
      } catch {
        // ignore bad payloads
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [code, playerId]);

  const sendAction = useCallback(
    async (action: GameAction | { type: "start" }) => {
      const res = await fetch(`/api/rooms/${code}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...action, playerId }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return false;
      }
      setRoom(data.room);
      setError(null);
      return true;
    },
    [code, playerId],
  );

  return { room, error, setError, legal, connected, sendAction };
}
