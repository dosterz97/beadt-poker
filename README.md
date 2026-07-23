# Beadt — Texas Hold'em Rooms

Colonist-style multiplayer Texas Hold'em. Create a table, share a code, and deal — no accounts.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- **Home** — pick a nickname, create a room or join with a 5-character code. Public lobbies appear in the open tables list.
- **Lobby** — host starts when 2+ players are seated.
- **Table** — full Texas Hold'em streets, blinds, fold/check/call/raise/all-in, showdown, and next hand.

Real-time sync uses Server-Sent Events against an in-memory room store (single Node process). Fine for local play and demos; use a shared store (Redis, etc.) if you need multi-instance production.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
