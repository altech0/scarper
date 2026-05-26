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

const COLOURS = ['#0040ff', '#ff2060', '#00bb55', '#ff8800', '#9000ff', '#00aacc']

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
      // teleport to opposite wall at same coordinate
      let ex = player.x, ey = player.y
      if (nx < 0)     { if (maze[player.y][cols-1] === 0) ex = cols - 1 }
      if (nx >= cols) { if (maze[player.y][0]       === 0) ex = 0 }
      if (ny < 0)     { if (maze[rows-1][player.x]  === 0) ey = rows - 1 }
      if (ny >= rows) { if (maze[0][player.x]        === 0) ey = 0 }
      player.x = ex
      player.y = ey
      player.direction = exitDirection(ex, ey, rows, cols)
    }
    return
  }
  if (maze[ny][nx] === 0) { player.x = nx; player.y = ny }
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

const rooms = {}

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'))
})

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

app.get('/game/:roomCode', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/game.html'))
})

app.get('/:roomCode', (req, res) => {
  const code = req.params.roomCode.toUpperCase()
  if (!rooms[code]) {
    return res.status(404).sendFile(path.join(__dirname, '../client/not-found.html'))
  }
  res.sendFile(path.join(__dirname, '../client/room.html'))
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

    const startPositions = getStartPositions(size)
    const playerIds = Object.keys(room.players)
    const targetIndex = Math.floor(Math.random() * playerIds.length)

    playerIds.forEach((id, i) => {
      const pos = startPositions[i % startPositions.length]
      room.players[id].x = pos.x
      room.players[id].y = pos.y
      room.players[id].role = i === targetIndex ? 'target' : 'chaser'
    })

    room.dots = buildDots(room.maze, startPositions)
    room.phase = 'playing'

    room.gameLoop = setInterval(() => {
      const r = rooms[currentRoom]
      if (!r) return
      for (const player of Object.values(r.players)) {
        if (!player.direction) continue
        const { dx, dy } = DIR_DELTA[player.direction]
        applyMove(player, dx, dy, r.maze, r.settings.randomPortals)
      }
      io.to(currentRoom).emit('game-update', { players: serializePlayers(r.players) })
    }, 250)

    io.to(currentRoom).emit('game-started', { roomCode: currentRoom })
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
