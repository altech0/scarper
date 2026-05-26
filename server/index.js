const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const crypto = require('crypto')
const { generate, getStartPositions } = require('./maze')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())
app.use(express.static(path.join(__dirname, '../client')))

const COLOURS = ['#00b4d8', '#ffd166', '#06d6a0', '#f77f00', '#ff6b9d', '#a3e635']

function assignColour(room) {
  const used = new Set(Object.values(room.players).map(p => p.colour))
  return COLOURS.find(c => !used.has(c)) || COLOURS[0]
}

const DIR_DELTA = {
  up:    { dx: 0, dy: -1 },
  down:  { dx: 0, dy:  1 },
  left:  { dx: -1, dy: 0 },
  right: { dx:  1, dy: 0 },
}

function exitDirection(x, y, rows, cols) {
  if (y === 0)        return 'down'
  if (y === rows - 1) return 'up'
  if (x === 0)        return 'right'
  if (x === cols - 1) return 'left'
  return null
}

function getRandomPortal(maze, excludeX, excludeY) {
  const rows = maze.length
  const cols = maze[0].length
  const portals = []
  for (let x = 0; x < cols; x++) {
    if (maze[0][x] === 0)        portals.push({ x, y: 0 })
    if (maze[rows-1][x] === 0)   portals.push({ x, y: rows - 1 })
  }
  for (let y = 1; y < rows - 1; y++) {
    if (maze[y][0] === 0)        portals.push({ x: 0, y })
    if (maze[y][cols-1] === 0)   portals.push({ x: cols - 1, y })
  }
  const others = portals.filter(p => !(p.x === excludeX && p.y === excludeY))
  return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : null
}

function applyMove(player, dx, dy, maze, randomPortals) {
  const rows = maze.length
  const cols = maze[0].length
  const nx = player.x + dx
  const ny = player.y + dy
  const offGrid = nx < 0 || nx >= cols || ny < 0 || ny >= rows
  if (offGrid) {
    if (randomPortals) {
      const exit = getRandomPortal(maze, player.x, player.y)
      if (exit) {
        player.x = exit.x
        player.y = exit.y
        player.direction = exitDirection(exit.x, exit.y, rows, cols)
      }
    } else {
      // teleport to paired opposite border cell (always open, carved in pairs)
      let ex = player.x, ey = player.y
      if (nx < 0)     ex = cols - 1
      if (nx >= cols) ex = 0
      if (ny < 0)     ey = rows - 1
      if (ny >= rows) ey = 0
      if (maze[ey][ex] === 0) {
        player.x = ex
        player.y = ey
        player.direction = exitDirection(ex, ey, rows, cols)
      }
    }
    return
  }
  if (maze[ny][nx] === 0) { player.x = nx; player.y = ny }
}

// Resolve portal destination for a step that goes off-grid (opposite-wall mode only)
function portalExit(maze, fromX, fromY, nx, ny) {
  const rows = maze.length
  const cols = maze[0].length
  let ex = fromX, ey = fromY
  if (nx < 0)     ex = cols - 1
  if (nx >= cols) ex = 0
  if (ny < 0)     ey = rows - 1
  if (ny >= rows) ey = 0
  return (maze[ey][ex] === 0) ? { x: ex, y: ey } : null
}

// BFS shortest path through maze including portal edges, returns first direction or null
function bfsDirection(maze, fromX, fromY, toX, toY) {
  const rows = maze.length
  const cols = maze[0].length
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
  const queue = [{ x: fromX, y: fromY, dir: null }]
  visited[fromY][fromX] = true
  while (queue.length) {
    const { x, y, dir } = queue.shift()
    if (x === toX && y === toY) return dir
    for (const [d, dx, dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
        // off-grid — check for portal
        const exit = portalExit(maze, x, y, nx, ny)
        if (exit && !visited[exit.y][exit.x]) {
          visited[exit.y][exit.x] = true
          queue.push({ x: exit.x, y: exit.y, dir: dir ?? d })
        }
        continue
      }
      if (maze[ny][nx] !== 0 || visited[ny][nx]) continue
      visited[ny][nx] = true
      queue.push({ x: nx, y: ny, dir: dir ?? d })
    }
  }
  return null
}

// Pick a direction that maximises distance from target (flee)
function fleeDirection(maze, fromX, fromY, targetX, targetY) {
  const rows = maze.length
  const cols = maze[0].length
  let bestDir = null
  let bestDist = -1
  for (const [d, dx, dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]) {
    const nx = fromX + dx, ny = fromY + dy
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
    if (maze[ny][nx] !== 0) continue
    const dist = (nx - targetX) ** 2 + (ny - targetY) ** 2
    if (dist > bestDist) { bestDist = dist; bestDir = d }
  }
  return bestDir
}

function tickCpuPlayers(room) {
  const target = Object.values(room.players).find(p => p.role === 'target')
  for (const player of Object.values(room.players)) {
    if (!player.cpu) continue
    if (player.role === 'chaser') {
      if (target) {
        const dir = bfsDirection(room.maze, player.x, player.y, target.x, target.y)
        if (dir) player.direction = dir
      }
    } else {
      // target role — flee from nearest chaser
      const chasers = Object.values(room.players).filter(p => p.role === 'chaser')
      if (chasers.length) {
        const nearest = chasers.reduce((a, b) =>
          (a.x - player.x)**2 + (a.y - player.y)**2 <= (b.x - player.x)**2 + (b.y - player.y)**2 ? a : b
        )
        const dir = fleeDirection(room.maze, player.x, player.y, nearest.x, nearest.y)
        if (dir) player.direction = dir
      }
    }
  }
}

function buildDots(maze, startPositions) {
  const startSet = new Set(startPositions.map(p => `${p.x},${p.y}`))
  const dots = []
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[y].length; x++) {
      if (maze[y][x] === 0 && !startSet.has(`${x},${y}`)) dots.push({ x, y })
    }
  }
  return dots
}

function startRound(room, roomCode) {
  room.roundNumber++
  const targetId = room.targetQueue.shift()

  const startPositions = getStartPositions(room.settings.size)
  const shuffled = startPositions.slice().sort(() => Math.random() - 0.5)
  const playerIds = Object.keys(room.players)
  playerIds.forEach((id, i) => {
    const pos = shuffled[i % shuffled.length]
    room.players[id].x = pos.x
    room.players[id].y = pos.y
    room.players[id].role = id === targetId ? 'target' : 'chaser'
    room.players[id].direction = null
  })

  room.dots = buildDots(room.maze, shuffled.slice(0, playerIds.length))
  room.dotSet = new Set(room.dots.map(d => `${d.x},${d.y}`))
  room.tick = 0

  io.to(roomCode).emit('round-started', {
    roundNumber: room.roundNumber,
    players: serializePlayers(room.players),
    dots: room.dots,
  })
}

const rooms = {}

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

function serveApp(req, res) {
  res.sendFile(path.join(__dirname, '../client/index.html'))
}

app.get('/', serveApp)
app.get('/game/:roomCode', serveApp)
app.get('/:roomCode', serveApp)

app.post('/create-room', (req, res) => {
  let code
  do { code = generateCode() } while (rooms[code])
  rooms[code] = {
    code, host: null, players: {}, phase: 'lobby',
    settings: { portalDensity: 25, randomPortals: false, size: 21, density: 5 },
  }
  console.log(`Room created: ${code}`)
  res.json({ code })
})

app.get('/check-room/:roomCode', (req, res) => {
  const code = req.params.roomCode.toUpperCase()
  res.json({ exists: !!rooms[code] })
})


function serializePlayers(players) {
  const out = {}
  for (const [id, p] of Object.entries(players)) {
    const { disconnectTimer, ...rest } = p
    out[id] = rest
  }
  return out
}

function broadcastPlayerList(code) {
  const room = rooms[code]
  if (!room) return
  io.to(code).emit('player-list', { players: serializePlayers(room.players) })
}

io.on('connection', (socket) => {
  let currentRoom = null

  socket.on('join-room', ({ roomCode, name }) => {
    const code = roomCode.toUpperCase()
    const room = rooms[code]
    if (!room) { socket.emit('error', { message: 'Room not found' }); return }

    socket.join(code)
    currentRoom = code

    const isHost = room.host === null
    if (isHost) room.host = socket.id

    const colour = assignColour(room)
    room.players[socket.id] = { name, isHost, colour }
    console.log(`${name} joined room ${code}${isHost ? ' (host)' : ''}`)

    socket.emit('joined', { socketId: socket.id, isHost, roomCode: code, colour })

    if (room.phase === 'playing') {
      const startPositions = getStartPositions(room.settings.size)
      const occupied = new Set(Object.values(room.players).map(p => `${p.x},${p.y}`))
      const pos = startPositions.find(p => !occupied.has(`${p.x},${p.y}`)) || startPositions[0]
      room.players[socket.id].x = pos.x
      room.players[socket.id].y = pos.y
      room.players[socket.id].role = 'chaser'
      socket.emit('game-started', { roomCode: code })
      return
    }

    socket.emit('settings-updated', room.settings)
    broadcastPlayerList(code)
  })

  socket.on('update-settings', ({ portalDensity, randomPortals, size, density }) => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    if (room.host !== socket.id) return
    let s = Math.max(11, Math.min(31, Number(size)))
    if (s % 2 === 0) s++
    room.settings = {
      portalDensity: Math.max(0, Math.min(100, Number(portalDensity))),
      randomPortals: Boolean(randomPortals),
      size: s,
      density: Math.max(0, Math.min(10, Number(density))),
    }
    io.to(currentRoom).emit('settings-updated', room.settings)
  })

  socket.on('start-game', () => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    if (room.host !== socket.id) return

    const { portalDensity, size, density } = room.settings
    room.maze = generate(size, density, portalDensity)
    room.phase = 'playing'

    // Scores persist across rounds — initialise once
    for (const player of Object.values(room.players)) {
      player.score = 0
    }

    // Queue of player ids who haven't been the target yet, shuffled
    const allIds = Object.keys(room.players)
    room.targetQueue = allIds.slice().sort(() => Math.random() - 0.5)
    room.roundNumber = 0

    startRound(room, currentRoom)

    room.gameLoop = setInterval(() => {
      const r = rooms[currentRoom]
      if (!r || r.roundPaused) return
      r.tick++

      tickCpuPlayers(r)
      for (const player of Object.values(r.players)) {
        if (!player.direction) continue
        const { dx, dy } = DIR_DELTA[player.direction]
        applyMove(player, dx, dy, r.maze, r.settings.randomPortals)
      }

      // Dot collection — everyone picks up dots
      for (const player of Object.values(r.players)) {
        const key = `${player.x},${player.y}`
        if (r.dotSet.has(key)) {
          r.dotSet.delete(key)
          r.dots = r.dots.filter(d => !(d.x === player.x && d.y === player.y))
          player.score = (player.score || 0) + 1
        }
      }

      // Survival bonus — target earns 1pt every 4 ticks (~1s)
      if (r.tick % 4 === 0) {
        for (const player of Object.values(r.players)) {
          if (player.role === 'target') player.score = (player.score || 0) + 1
        }
      }

      // Catch detection — chaser on same cell as target
      const target = Object.values(r.players).find(p => p.role === 'target')
      if (target) {
        for (const [, player] of Object.entries(r.players)) {
          if (player.role !== 'chaser') continue
          if (player.x === target.x && player.y === target.y) {
            player.score = (player.score || 0) + 10

            if (r.targetQueue.length === 0) {
              // All players have been target — game over
              clearInterval(r.gameLoop)
              io.to(currentRoom).emit('game-update', { players: serializePlayers(r.players), dots: r.dots })
              io.to(currentRoom).emit('game-over', { players: serializePlayers(r.players) })
              delete rooms[currentRoom]
            } else {
              // Pause loop while waiting for next round
              r.roundPaused = true
              io.to(currentRoom).emit('round-over', {
                catcher: player.name,
                players: serializePlayers(r.players),
              })
              setTimeout(() => {
                if (!rooms[currentRoom]) return
                r.roundPaused = false
                startRound(r, currentRoom)
              }, 3000)
            }
            break
          }
        }
      }

      io.to(currentRoom).emit('game-update', { players: serializePlayers(r.players), dots: r.dots })
    }, 250)

    io.to(currentRoom).emit('game-started', { roomCode: currentRoom })
  })

  socket.on('add-cpu', () => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    if (room.host !== socket.id || room.phase !== 'lobby') return
    const cpuCount = Object.values(room.players).filter(p => p.cpu).length
    if (cpuCount >= 4) return
    const id = `cpu-${Date.now()}-${cpuCount}`
    room.players[id] = { name: `CPU ${cpuCount + 1}`, isHost: false, colour: assignColour(room), cpu: true }
    broadcastPlayerList(currentRoom)
  })

  socket.on('remove-cpu', (id) => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    if (room.host !== socket.id || room.phase !== 'lobby') return
    if (!room.players[id] || !room.players[id].cpu) return
    delete room.players[id]
    broadcastPlayerList(currentRoom)
  })

  socket.on('end-game', () => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    if (room.host !== socket.id) return
    if (room.gameLoop) clearInterval(room.gameLoop)
    delete rooms[currentRoom]
    io.to(currentRoom).emit('game-ended')
    console.log(`Game ended in room ${currentRoom}`)
  })

  socket.on('rejoin-game', ({ roomCode, name }) => {
    const code = roomCode.toUpperCase()
    const room = rooms[code]
    if (!room) return

    const existingEntry = Object.entries(room.players).find(([, p]) => p.name === name)

    if (existingEntry) {
      const [oldSocketId, playerData] = existingEntry

      if (playerData.disconnectTimer) {
        clearTimeout(playerData.disconnectTimer)
        delete playerData.disconnectTimer
      }

      delete room.players[oldSocketId]
      room.players[socket.id] = playerData
      if (room.host === oldSocketId) room.host = socket.id
    } else if (!room.players[socket.id]) {
      return
    }

    socket.join(code)
    currentRoom = code

    socket.emit('game-init', {
      socketId: socket.id,
      players: serializePlayers(room.players),
      maze: room.maze,
      dots: room.dots || [],
    })
  })

  socket.on('set-direction', ({ direction }) => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    if (!room.players[socket.id]) return
    room.players[socket.id].direction = direction
  })

  socket.on('disconnect', () => {
    if (!currentRoom || !rooms[currentRoom]) return
    const room = rooms[currentRoom]
    const player = room.players[socket.id]
    if (!player) return

    if (room.phase === 'playing') {
      player.disconnectTimer = setTimeout(() => {
        if (!rooms[currentRoom]) return
        const wasHost = room.host === socket.id
        delete room.players[socket.id]
        console.log(`Player removed from room ${currentRoom} after disconnect`)

        const remaining = Object.keys(room.players)
        if (remaining.length === 0) {
          if (room.gameLoop) clearInterval(room.gameLoop)
          delete rooms[currentRoom]
          return
        }
        if (wasHost) {
          room.host = remaining[0]
          room.players[remaining[0]].isHost = true
        }
        io.to(currentRoom).emit('game-update', { players: serializePlayers(room.players) })
      }, 3000)
      return
    }

    const wasHost = room.host === socket.id
    delete room.players[socket.id]
    console.log(`Player disconnected from room ${currentRoom}`)

    const remaining = Object.keys(room.players)
    if (remaining.length === 0) {
      delete rooms[currentRoom]
      return
    }
    if (wasHost) {
      room.host = remaining[0]
      room.players[remaining[0]].isHost = true
    }
    broadcastPlayerList(currentRoom)
  })
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(`Scarper running at http://localhost:${PORT}`)
})
