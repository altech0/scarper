const TICK = 250

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const roleBanner = document.getElementById('role-banner')
const sidebarPlayers = document.getElementById('sidebar-players')

const socket = io()

const roomCode = window.location.pathname.split('/')[2].toUpperCase()
const myName = sessionStorage.getItem('playerName')

if (!myName) {
  window.location.href = `/${roomCode}`
}

let MAZE = null
let COLS = 0
let ROWS = 0
let TILE = 32

let myId = null
let dots = []
let renderPlayers = {}
let lastTickTime = performance.now()
let WALL_WIDTH = 2

socket.emit('rejoin-game', { roomCode, name: myName })

function initRenderPlayer(p) {
  return { ...p, prevX: p.x, prevY: p.y, targetX: p.x, targetY: p.y }
}

socket.on('game-init', ({ socketId, players, maze, dots: d, wallWidth }) => {
  myId = socketId
  MAZE = maze
  ROWS = maze.length
  COLS = maze[0].length
  WALL_WIDTH = wallWidth || 2
  TILE = Math.max(16, Math.floor(Math.min(window.innerWidth * 0.95, window.innerHeight * 0.85) / Math.max(COLS, ROWS)))
  canvas.width  = COLS * TILE
  canvas.height = ROWS * TILE
  dots = d
  renderPlayers = {}
  for (const [id, p] of Object.entries(players)) {
    renderPlayers[id] = initRenderPlayer(p)
  }
  const me = renderPlayers[myId]
  if (me) {
    roleBanner.textContent = me.role === 'target' ? '// TARGET' : '// CHASER'
    roleBanner.style.color = me.role === 'target' ? '#ffb700' : me.colour
  }
  lastTickTime = performance.now()
  renderSidebar()
})

socket.on('game-update', ({ players }) => {
  const now = performance.now()
  const t = Math.min((now - lastTickTime) / TICK, 1)

  for (const [id, p] of Object.entries(players)) {
    if (renderPlayers[id]) {
      const r = renderPlayers[id]
      const onBorder = p.x === 0 || p.x === COLS - 1 || p.y === 0 || p.y === ROWS - 1
      const warp = onBorder && (Math.abs(p.x - r.targetX) > 1 || Math.abs(p.y - r.targetY) > 1)
      if (warp) {
        r.prevX = p.x
        r.prevY = p.y
      } else {
        r.prevX = r.prevX + (r.targetX - r.prevX) * t
        r.prevY = r.prevY + (r.targetY - r.prevY) * t
      }
      r.targetX = p.x
      r.targetY = p.y
      Object.assign(r, p)
    } else {
      renderPlayers[id] = initRenderPlayer(p)
    }
  }
  for (const id of Object.keys(renderPlayers)) {
    if (!players[id]) delete renderPlayers[id]
  }

  lastTickTime = now
  renderSidebar()
})

document.addEventListener('keydown', (e) => {
  const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  const dir = dirs[e.key]
  if (!dir) return
  e.preventDefault()
  socket.emit('set-direction', { direction: dir })
})

function drawMaze() {
  drawMazeToCtx(ctx, MAZE, TILE, WALL_WIDTH)
}

function drawDots() {
  ctx.fillStyle = '#2a2200'
  for (const { x, y } of dots) {
    const cx = x * TILE + TILE / 2
    const cy = y * TILE + TILE / 2
    const s = Math.max(2, TILE / 10)
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s)
  }
}

function drawPlayers(t) {
  for (const [id, r] of Object.entries(renderPlayers)) {
    const drawX = r.prevX + (r.targetX - r.prevX) * t
    const drawY = r.prevY + (r.targetY - r.prevY) * t
    const px = drawX * TILE
    const py = drawY * TILE
    const pad = Math.max(2, Math.floor(TILE / 7))
    const size = TILE - pad * 2

    ctx.fillStyle = r.role === 'target' ? '#ffb700' : r.colour
    ctx.fillRect(px + pad, py + pad, size, size)

    if (id === myId) {
      ctx.strokeStyle = '#fff8e7'
      ctx.lineWidth = 1.5
      ctx.strokeRect(px + pad, py + pad, size, size)
    }
  }
}

function renderSidebar() {
  sidebarPlayers.innerHTML = ''
  for (const [id, r] of Object.entries(renderPlayers)) {
    const isMe = id === myId
    const el = document.createElement('div')
    el.className = 'sidebar-player' + (isMe ? ' sidebar-player--me' : '')
    el.innerHTML = `
      <span class="sidebar-dot" style="background:${r.role === 'target' ? '#f1c40f' : r.colour}"></span>
      <span class="sidebar-name">${r.name}</span>
      <span class="sidebar-score">${r.score ?? 0}</span>
    `
    sidebarPlayers.appendChild(el)
  }
}

function loop(now) {
  requestAnimationFrame(loop)
  if (!MAZE) return
  const t = Math.min((now - lastTickTime) / TICK, 1)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawMaze()
  drawDots()
  drawPlayers(t)
}

requestAnimationFrame(loop)
