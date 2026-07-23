"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, PublicRoom } from "./types";

export function useRoom(code: string, playerId: string) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legal, setLegal] = useState<Record<string, unknown> | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refreshLegal = useCallback(async () => {
    if (!playerId || !code) return;
    try {
      const res = await fetch(
        `/api/rooms/${code}/actions?playerId=${encodeURIComponent(playerId)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setLegal(data.legal);
      }
    } catch {
      // ignore
    }
  }, [code, playerId]);

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
        const data = JSON.parse(ev.data);
        if (data.type === "room") {
          setRoom(data.room);
          setError(null);
          void refreshLegal();
        }
      } catch {
        // ignore bad payloads
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [code, playerId, refreshLegal]);

  const sendAction = useCallback(
    async (action: GameAction | { type: "start" }) => {
      const res = await fetch(`/api/rooms/${code}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...action, playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return false;
      }
      setRoom(data.room);
      setLegal(data.legal);
      setError(null);
      return true;
    },
    [code, playerId],
  );

  return { room, error, setError, legal, connected, sendAction, refreshLegal };
}
