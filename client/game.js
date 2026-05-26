const TICK = 250

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const roleBanner = document.getElementById('role-banner')
const sidebarPlayers = document.getElementById('sidebar-players')

const socket = io()

const roomCode = window.location.pathname.split('/')[2].toUpperCase()
const myName = sessionStorage.getItem('playerName')

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
    roleBanner.textContent = me.role === 'target' ? 'You are the TARGET' : 'You are a CHASER'
    roleBanner.style.color = me.role === 'target' ? '#f1c40f' : me.colour
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
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = MAZE[row][col] === 1 ? '#2c2c3e' : '#f0ede8'
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE)
    }
  }
}

function drawDots() {
  ctx.fillStyle = '#888'
  for (const { x, y } of dots) {
    ctx.beginPath()
    ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPlayers(t) {
  for (const [id, r] of Object.entries(renderPlayers)) {
    const drawX = r.prevX + (r.targetX - r.prevX) * t
    const drawY = r.prevY + (r.targetY - r.prevY) * t
    const px = drawX * TILE + TILE / 2
    const py = drawY * TILE + TILE / 2
    const radius = TILE / 2 - Math.max(2, Math.floor(TILE / 10))

    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fillStyle = r.role === 'target' ? '#f1c40f' : r.colour
    ctx.fill()

    if (id === myId) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
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
