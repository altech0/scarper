# Scarper

Multiplayer maze game. Phase 1: two players moving around a shared maze in real time.

## Stack

- Node.js + Express (static file serving)
- Socket.io (real-time sync)
- Plain JS canvas client — no bundler

## Running locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two windows. Each window shows both players. Moving in one updates the other.

## Controls

Arrow keys to move. Wall collision is enforced client-side before emitting.
