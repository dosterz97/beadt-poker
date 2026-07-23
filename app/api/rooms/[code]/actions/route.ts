import { NextResponse } from "next/server";
import {
  getLegalActions,
  performAction,
  startGame,
  toPublicRoom,
} from "@/lib/room-store";
import type { GameAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => null);

  if (!body?.playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const playerId = String(body.playerId);

  if (body.type === "start") {
    const result = startGame(code, playerId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      room: toPublicRoom(result.room, playerId),
      legal: getLegalActions(code, playerId),
    });
  }

  const action = body as GameAction & { playerId: string; type: string };
  if (!action.type) {
    return NextResponse.json({ error: "Action type is required" }, { status: 400 });
  }

  const result = performAction(code, playerId, {
    type: action.type as GameAction["type"],
    amount: action.amount,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    room: toPublicRoom(result.room, playerId),
    legal: getLegalActions(code, playerId),
  });
}

export async function GET(request: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const playerId = new URL(request.url).searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }
  return NextResponse.json({ legal: getLegalActions(code, playerId) });
}
