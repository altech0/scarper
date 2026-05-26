const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,1,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,1,1,1,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,1,0,1],
  [1,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,1],
  [1,0,1,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1],
  [1,0,0,0,0,1,0,0,0,1,1,1,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

const TILE = 32
const COLS = MAZE[0].length
const ROWS = MAZE.length

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
canvas.width = COLS * TILE
canvas.height = ROWS * TILE

const socket = io()

let myId = null
let players = {}

socket.on('init', ({ id, players: initial }) => {
  myId = id
  players = initial
  draw()
})

socket.on('update', ({ players: updated }) => {
  players = updated
  draw()
})

function isWall(x, y) {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return true
  return MAZE[y][x] === 1
}

document.addEventListener('keydown', (e) => {
  if (!myId || !players[myId]) return

  const { x, y } = players[myId]
  let nx = x
  let ny = y

  switch (e.key) {
    case 'ArrowUp':    ny = y - 1; break
    case 'ArrowDown':  ny = y + 1; break
    case 'ArrowLeft':  nx = x - 1; break
    case 'ArrowRight': nx = x + 1; break
    default: return
  }

  e.preventDefault()

  if (isWall(nx, ny)) return

  players[myId].x = nx
  players[myId].y = ny
  socket.emit('move', { x: nx, y: ny })
  draw()
})

function drawMaze() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = MAZE[row][col] === 1 ? '#2c2c3e' : '#f0ede8'
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE)
    }
  }
}

function drawPlayers() {
  for (const [id, player] of Object.entries(players)) {
    const px = player.x * TILE + TILE / 2
    const py = player.y * TILE + TILE / 2
    const radius = TILE / 2 - 4

    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fillStyle = player.colour
    ctx.fill()

    if (id === myId) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawMaze()
  drawPlayers()
}

draw()
