# Scarper — Phase 1 Spec

## Overview
Build the foundational multiplayer maze game. Goal: two players moving around a shared maze in real time in a browser. No scoring, no roles, no game logic yet — just prove the stack works.

---

## Repo Setup

Create a new GitHub repo called `scarper`.

### Folder structure
```
scarper/
├── context/         # MD spec files (this file lives here)
├── client/
│   ├── index.html
│   ├── game.js
│   └── style.css
├── server/
│   └── index.js
├── package.json
└── README.md
```

---

## Stack
- **Node.js** — runtime
- **Express** — serves static client files
- **Socket.io** — real time multiplayer sync

No build tools, no bundler, no framework. Keep it plain JS for now.

---

## Server (`server/index.js`)

- Express serves the `client/` directory as static files
- Socket.io attached to the same HTTP server
- Listens on port 3000
- On player connect: assign a unique player ID, log it
- On player disconnect: remove from game state, log it
- Maintain a simple game state object in memory:
```js
const players = {}
// { socketId: { x, y, colour } }
```
- On receiving a `move` event from a client, update that player's position and broadcast updated state to all connected clients

---

## Client

### `index.html`
- Loads `style.css` and `game.js`
- Single `<canvas>` element, full viewport
- Loads Socket.io from CDN:
```html
<script src="/socket.io/socket.io.js"></script>
```

### `game.js`

**Maze**
- Define a static maze as a 2D array (0 = path, 1 = wall)
- Start with a simple 21x21 grid
- Render on canvas — walls dark, paths light

**Player**
- Each player is a circle rendered at their grid position
- Assign a random colour on connect
- Grid-based movement — players snap between tiles, no fluid animation yet

**Controls**
- Arrow keys move the local player one tile at a time
- Check wall collision before moving
- On valid move, emit a `move` event to the server with new `{ x, y }`

**Rendering**
- On each state update from server, redraw all players on canvas
- Local player gets a slightly different visual indicator (e.g. white border)

---

## Maze Definition

Use a hardcoded 21x21 maze array to start. Example pattern — outer walls, inner corridors. Can be replaced with generated mazes in a later phase.

```js
const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  // ... fill out full 21x21
]
```

---

## Testing Locally

```bash
npm install
node server/index.js
```

Open `http://localhost:3000` in two windows (e.g. Chrome + Firefox or Chrome + Incognito). Each window should show both players. Moving in one window should update the other.

---

## Definition of Done — Phase 1

- [ ] Repo created with correct folder structure
- [ ] `npm install && node server/index.js` starts the server
- [ ] Browser loads the canvas and renders the maze
- [ ] Player appears in the maze on load
- [ ] Arrow keys move the player, wall collision works
- [ ] Two browser windows connect simultaneously
- [ ] Moving in one window updates the other in real time
- [ ] Disconnect removes the player from the other window

---

## Out of Scope for Phase 1
- Rooms / lobbies
- Scoring
- Roles (target vs chaser)
- Power pellets
- Dots
- Game start/end logic
- Mobile controls
- Any visual polish