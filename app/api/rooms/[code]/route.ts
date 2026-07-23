import { NextResponse } from "next/server";
import {
  getRoom,
  joinRoom,
  leaveRoom,
  toPublicRoom,
  updateSettings,
} from "@/lib/room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const viewerId = new URL(request.url).searchParams.get("playerId") ?? undefined;
  return NextResponse.json({ room: toPublicRoom(room, viewerId) });
}

export async function POST(request: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;

  if (action === "join") {
    if (!body?.playerId || !body?.playerName) {
      return NextResponse.json(
        { error: "playerId and playerName are required" },
        { status: 400 },
      );
    }
    const result = joinRoom({
      code,
      playerId: String(body.playerId),
      playerName: String(body.playerName),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      room: toPublicRoom(result.room, String(body.playerId)),
    });
  }

  if (action === "leave") {
    if (!body?.playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }
    const result = leaveRoom(code, String(body.playerId));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "settings") {
    if (!body?.playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }
    const result = updateSettings(code, String(body.playerId), body.settings ?? {});
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      room: toPublicRoom(result.room, String(body.playerId)),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
