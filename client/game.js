const TICK = 250

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const roleBanner = document.getElementById('role-banner')
const sidebarPlayers = document.getElementById('sidebar-players')
const sidebarEnd = document.getElementById('sidebar-end')
const endBtn = document.getElementById('end-btn')

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

socket.emit('rejoin-game', { roomCode, name: myName })

function initRenderPlayer(p) {
  return { ...p, prevX: p.x, prevY: p.y, targetX: p.x, targetY: p.y }
}

socket.on('game-init', ({ socketId, players, maze, dots: d }) => {
  myId = socketId
  MAZE = maze
  ROWS = maze.length
  COLS = maze[0].length
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
    roleBanner.style.background = me.role === 'target' ? '#e8380d' : '#2d6a1f'
    if (me.isHost) sidebarEnd.classList.remove('hidden')
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
  drawMazeToCtx(ctx, MAZE, TILE, 2)
}

function drawDots() {
  for (const { x, y } of dots) {
    const cx = x * TILE + TILE / 2
    const cy = y * TILE + TILE / 2
    const r = Math.max(2, TILE / 8)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(232,56,13,0.5)'
    ctx.fill()
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawPlayers(t) {
  for (const [id, r] of Object.entries(renderPlayers)) {
    const drawX = r.prevX + (r.targetX - r.prevX) * t
    const drawY = r.prevY + (r.targetY - r.prevY) * t
    const px = drawX * TILE
    const py = drawY * TILE
    const pad = Math.max(2, Math.floor(TILE / 6))
    const size = TILE - pad * 2
    const radius = Math.max(3, size * 0.3)
    const colour = r.role === 'target' ? '#e8380d' : r.colour

    // Drop shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = Math.max(2, TILE * 0.1)
    roundRect(ctx, px + pad, py + pad + 2, size, size, radius)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fill()
    ctx.restore()

    // Body
    roundRect(ctx, px + pad, py + pad, size, size, radius)
    ctx.fillStyle = colour
    ctx.fill()

    // Top shine
    roundRect(ctx, px + pad + 2, py + pad + 2, size - 4, size * 0.4, radius * 0.6)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fill()

    // "Me" ring
    if (id === myId) {
      roundRect(ctx, px + pad - 3, py + pad - 3, size + 6, size + 6, radius + 2)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2.5
      ctx.stroke()
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
      <span class="sidebar-dot" style="background:${r.role === 'target' ? '#e8380d' : r.colour}"></span>
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

endBtn.addEventListener('click', () => {
  socket.emit('end-game')
})

socket.on('game-ended', () => {
  window.location.href = '/'
})
