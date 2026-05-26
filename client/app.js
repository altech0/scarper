// ── View switching ──────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'))
  document.getElementById('view-' + name).classList.remove('hidden')
}

function showMainCanvas(id) {
  document.querySelectorAll('.main-canvas').forEach(c => c.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

// ── Home ────────────────────────────────────────────────────────────────────

const homeCanvas = document.getElementById('home-canvas')
const homeCtx    = homeCanvas.getContext('2d')
let homeMaze     = null

function resizeHomeCanvas() {
  const main = document.getElementById('main-area')
  const size = Math.min(main.clientWidth, main.clientHeight) * 0.78
  const N    = 21
  const tile = Math.floor(size / N)
  const px   = tile * N
  homeCanvas.width  = px
  homeCanvas.height = px
  if (homeMaze) drawMazeToCtx(homeCtx, homeMaze, tile, 2)
}

function refreshHomeMaze() {
  homeMaze = mazeGenerate(21, 5, 20)
  resizeHomeCanvas()
}

document.getElementById('create-btn').addEventListener('click', async () => {
  const res       = await fetch('/create-room', { method: 'POST' })
  const { code }  = await res.json()
  history.pushState({}, '', '/' + code)
  enterLobby(code)
})

document.getElementById('join-btn').addEventListener('click', tryJoin)
document.getElementById('join-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryJoin() })
document.getElementById('join-input').addEventListener('input',   () => document.getElementById('join-error').classList.add('hidden'))

async function tryJoin() {
  const code = document.getElementById('join-input').value.trim().toUpperCase()
  if (!code) return
  const res      = await fetch('/check-room/' + code)
  const { exists } = await res.json()
  if (exists) {
    history.pushState({}, '', '/' + code)
    enterLobby(code)
  } else {
    document.getElementById('join-error').classList.remove('hidden')
  }
}

// ── Lobby ───────────────────────────────────────────────────────────────────

const socket      = io()
let currentRoom   = null
let isHost        = false
let myColour      = null

const previewCanvas = document.getElementById('preview-canvas')
const previewCtx    = previewCanvas.getContext('2d')

function drawPreview(size, density, portalDensity) {
  const maze      = mazeGenerate(size, density, portalDensity)
  const container = document.getElementById('main-area')
  const maxPx     = Math.min(container.clientWidth, container.clientHeight) * 0.82
  const tile      = Math.floor(maxPx / maze.length)
  const px        = tile * maze.length
  previewCanvas.width  = px
  previewCanvas.height = px
  drawMazeToCtx(previewCtx, maze, tile, 2)
}

function currentSettings() {
  return {
    size:          parseInt(document.getElementById('size-slider').value),
    density:       parseInt(document.getElementById('density-slider').value),
    portalDensity: parseInt(document.getElementById('portal-density-slider').value),
  }
}

function emitSettings(redraw = false) {
  const s = currentSettings()
  if (redraw) drawPreview(s.size, s.density, s.portalDensity)
  socket.emit('update-settings', {
    portalDensity:  s.portalDensity,
    randomPortals:  document.getElementById('random-portals-toggle').checked,
    size:           s.size,
    density:        s.density,
  })
}

document.getElementById('portal-density-slider').addEventListener('input', () => {
  document.getElementById('portal-density-value').textContent = document.getElementById('portal-density-slider').value
  emitSettings(true)
})
document.getElementById('size-slider').addEventListener('input', () => {
  const v = document.getElementById('size-slider').value
  document.getElementById('size-value').textContent  = v
  document.getElementById('size-value2').textContent = v
  emitSettings(true)
})
document.getElementById('density-slider').addEventListener('input', () => {
  document.getElementById('density-value').textContent = document.getElementById('density-slider').value
  emitSettings(true)
})
document.getElementById('random-portals-toggle').addEventListener('change', () => emitSettings(false))

document.getElementById('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.getElementById('copy-btn')
    btn.textContent = 'Copied!'
    setTimeout(() => { btn.textContent = 'Copy' }, 2000)
  })
})

document.getElementById('start-btn').addEventListener('click', () => socket.emit('start-game'))

document.getElementById('name-join-btn').addEventListener('click', joinWithName)
document.getElementById('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinWithName() })

function joinWithName() {
  const name = document.getElementById('name-input').value.trim()
  if (!name) return
  sessionStorage.setItem('playerName', name)
  document.getElementById('name-screen').classList.add('hidden')
  document.getElementById('view-lobby').classList.remove('hidden')
  socket.emit('join-room', { roomCode: currentRoom, name })
}

function enterLobby(code) {
  currentRoom = code
  document.getElementById('room-code-display').textContent = code
  document.getElementById('share-url').textContent = window.location.href

  const savedName = sessionStorage.getItem('playerName')
  if (savedName) {
    // Rejoin directly
    showView('lobby')
    showMainCanvas('preview-canvas')
    socket.emit('join-room', { roomCode: code, name: savedName })
  } else {
    // Need a name first
    showView('lobby')
    document.getElementById('view-lobby').classList.add('hidden')
    document.getElementById('name-screen').classList.remove('hidden')
    showMainCanvas('preview-canvas')
    const s = currentSettings()
    drawPreview(s.size, s.density, s.portalDensity)
  }
}

socket.on('joined', ({ isHost: host, colour, roomCode: code }) => {
  isHost   = host
  myColour = colour

  const name = sessionStorage.getItem('playerName')
  document.getElementById('my-colour-label').innerHTML =
    `<span class="colour-dot" style="background:${colour}"></span> ${name}`

  if (isHost) {
    document.getElementById('settings-panel').classList.remove('hidden')
    document.getElementById('host-controls').classList.remove('hidden')
    const s = currentSettings()
    drawPreview(s.size, s.density, s.portalDensity)
  } else {
    document.getElementById('settings-display').classList.remove('hidden')
    document.getElementById('waiting-msg').classList.remove('hidden')
  }
})

socket.on('settings-updated', ({ portalDensity, randomPortals, size, density }) => {
  if (isHost) {
    document.getElementById('portal-density-slider').value    = portalDensity
    document.getElementById('portal-density-value').textContent = portalDensity
    document.getElementById('random-portals-toggle').checked  = randomPortals
    document.getElementById('size-slider').value              = size
    document.getElementById('size-value').textContent         = size
    document.getElementById('size-value2').textContent        = size
    document.getElementById('density-slider').value           = density
    document.getElementById('density-value').textContent      = density
  } else {
    const exitDesc = randomPortals ? 'random exit' : 'opposite exit'
    document.getElementById('settings-display').textContent =
      `${size}×${size} · walls ${density} · portals ${portalDensity}% · ${exitDesc}`
    drawPreview(size, density, portalDensity)
  }
})

socket.on('player-list', ({ players }) => {
  const list = document.getElementById('player-list')
  list.innerHTML = ''
  for (const [, player] of Object.entries(players)) {
    const el = document.createElement('div')
    el.className = 'player-entry'
    el.innerHTML = `<span class="colour-dot" style="background:${player.colour}"></span>${player.name}${player.isHost ? ' <span class="host-tag">host</span>' : ''}`
    list.appendChild(el)
  }
})

socket.on('game-started', ({ roomCode }) => {
  history.pushState({}, '', '/game/' + roomCode)
  enterGame(roomCode)
})

socket.on('error', ({ message }) => alert(message))

// ── Game ─────────────────────────────────────────────────────────────────────

const TICK   = 250
const canvas = document.getElementById('game')
const ctx    = canvas.getContext('2d')

let MAZE         = null
let COLS         = 0
let ROWS         = 0
let TILE         = 32
let myId         = null
let dots         = []
let renderPlayers = {}
let lastTickTime  = performance.now()

function enterGame(roomCode) {
  showView('game')
  showMainCanvas('game')
  const name = sessionStorage.getItem('playerName')
  socket.emit('rejoin-game', { roomCode, name })
}

socket.on('game-init', ({ socketId, players, maze, dots: d }) => {
  myId  = socketId
  MAZE  = maze
  ROWS  = maze.length
  COLS  = maze[0].length
  const sidebarW = document.getElementById('sidebar').offsetWidth
  TILE  = Math.max(16, Math.floor(Math.min(
    window.innerWidth - sidebarW,
    window.innerHeight - document.getElementById('top-bar').offsetHeight
  ) * 0.95 / Math.max(COLS, ROWS)))
  canvas.width  = COLS * TILE
  canvas.height = ROWS * TILE
  dots = d
  renderPlayers = {}
  for (const [id, p] of Object.entries(players)) {
    renderPlayers[id] = initRenderPlayer(p)
  }
  const me = renderPlayers[myId]
  if (me) {
    const banner = document.getElementById('role-banner')
    banner.textContent       = me.role === 'target' ? '// TARGET' : '// CHASER'
    banner.style.background  = me.role === 'target' ? '#e8380d' : '#2d6a1f'
    if (me.isHost) document.getElementById('sidebar-end').classList.remove('hidden')
  }
  lastTickTime = performance.now()
  renderSidebar()
})

socket.on('game-update', ({ players }) => {
  const now = performance.now()
  const t   = Math.min((now - lastTickTime) / TICK, 1)

  for (const [id, p] of Object.entries(players)) {
    if (renderPlayers[id]) {
      const r       = renderPlayers[id]
      const onBorder = p.x === 0 || p.x === COLS - 1 || p.y === 0 || p.y === ROWS - 1
      const warp    = onBorder && (Math.abs(p.x - r.targetX) > 1 || Math.abs(p.y - r.targetY) > 1)
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

document.addEventListener('keydown', e => {
  const dirs = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  const dir  = dirs[e.key]
  if (!dir) return
  e.preventDefault()
  socket.emit('set-direction', { direction: dir })
})

document.getElementById('end-btn').addEventListener('click', () => socket.emit('end-game'))

socket.on('game-ended', () => {
  sessionStorage.removeItem('playerName')
  history.pushState({}, '', '/')
  resetToHome()
})

function initRenderPlayer(p) {
  return { ...p, prevX: p.x, prevY: p.y, targetX: p.x, targetY: p.y }
}

function renderSidebar() {
  const el = document.getElementById('sidebar-players')
  el.innerHTML = ''
  for (const [id, r] of Object.entries(renderPlayers)) {
    const isMe  = id === myId
    const div   = document.createElement('div')
    div.className = 'sidebar-player' + (isMe ? ' sidebar-player--me' : '')
    div.innerHTML = `
      <span class="sidebar-dot" style="background:${r.role === 'target' ? '#e8380d' : r.colour}"></span>
      <span class="sidebar-name">${r.name}</span>
      <span class="sidebar-score">${r.score ?? 0}</span>
    `
    el.appendChild(div)
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
    const drawX  = r.prevX + (r.targetX - r.prevX) * t
    const drawY  = r.prevY + (r.targetY - r.prevY) * t
    const px     = drawX * TILE
    const py     = drawY * TILE
    const pad    = Math.max(2, Math.floor(TILE / 6))
    const size   = TILE - pad * 2
    const radius = Math.max(3, size * 0.3)
    const colour = r.role === 'target' ? '#e8380d' : r.colour

    ctx.save()
    ctx.shadowOffsetY = Math.max(2, TILE * 0.1)
    roundRect(ctx, px + pad, py + pad + 2, size, size, radius)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fill()
    ctx.restore()

    roundRect(ctx, px + pad, py + pad, size, size, radius)
    ctx.fillStyle = colour
    ctx.fill()

    roundRect(ctx, px + pad + 2, py + pad + 2, size - 4, size * 0.4, radius * 0.6)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.fill()

    if (id === myId) {
      roundRect(ctx, px + pad - 3, py + pad - 3, size + 6, size + 6, radius + 2)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 2.5
      ctx.stroke()
    }
  }
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop)
  if (!MAZE || document.getElementById('game').classList.contains('hidden')) return
  const t = Math.min((now - lastTickTime) / TICK, 1)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawMazeToCtx(ctx, MAZE, TILE, 2)
  // dots
  for (const { x, y } of dots) {
    const cx = x * TILE + TILE / 2
    const cy = y * TILE + TILE / 2
    const r  = Math.max(2, TILE / 8)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(232,56,13,0.5)'
    ctx.fill()
  }
  drawPlayers(t)
}

requestAnimationFrame(gameLoop)

// ── Router ───────────────────────────────────────────────────────────────────

function resetToHome() {
  isHost        = false
  myColour      = null
  currentRoom   = null
  MAZE          = null
  renderPlayers = {}
  // reset lobby UI state
  document.getElementById('settings-panel').classList.add('hidden')
  document.getElementById('host-controls').classList.add('hidden')
  document.getElementById('settings-display').classList.add('hidden')
  document.getElementById('waiting-msg').classList.add('hidden')
  document.getElementById('sidebar-end').classList.add('hidden')
  document.getElementById('player-list').innerHTML = ''
  document.getElementById('name-input').value = ''

  showView('home')
  showMainCanvas('home-canvas')
  refreshHomeMaze()
  window.addEventListener('resize', resizeHomeCanvas)
}

function route() {
  const path = window.location.pathname
  if (path === '/' || path === '') {
    resetToHome()
  } else if (path.startsWith('/game/')) {
    const code = path.split('/')[2].toUpperCase()
    currentRoom = code
    const name  = sessionStorage.getItem('playerName')
    if (!name) {
      history.replaceState({}, '', '/' + code)
      enterLobby(code)
    } else {
      enterGame(code)
    }
  } else {
    const code = path.slice(1).toUpperCase()
    currentRoom = code
    enterLobby(code)
  }
}

window.addEventListener('popstate', route)

// ── Boot ─────────────────────────────────────────────────────────────────────

refreshHomeMaze()
window.addEventListener('resize', resizeHomeCanvas)
route()
