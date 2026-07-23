import { NextResponse } from "next/server";
import { createRoom, listPublicRooms, toPublicRoom } from "@/lib/room-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rooms: listPublicRooms() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.playerId || !body?.playerName) {
    return NextResponse.json(
      { error: "playerId and playerName are required" },
      { status: 400 },
    );
  }

  const { room } = createRoom({
    playerId: String(body.playerId),
    playerName: String(body.playerName),
    roomName: body.roomName ? String(body.roomName) : undefined,
    settings: body.settings,
  });

  return NextResponse.json({
    room: toPublicRoom(room, String(body.playerId)),
  });
}
