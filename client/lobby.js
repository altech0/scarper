const socket = io()

const roomCode = window.location.pathname.slice(1).toUpperCase()
let isHost = false
let myColour = null

document.getElementById('room-code-display').textContent = roomCode
document.getElementById('share-url').textContent = window.location.href
document.getElementById('share-url').title = window.location.href

const nameInput           = document.getElementById('name-input')
const joinBtn             = document.getElementById('join-btn')
const nameScreen          = document.getElementById('name-screen')
const lobbyScreen         = document.getElementById('lobby-screen')
const lobbyTitle          = document.getElementById('lobby-title')
const playerListEl        = document.getElementById('player-list')
const hostControls        = document.getElementById('host-controls')
const waitingMsg          = document.getElementById('waiting-msg')
const startBtn            = document.getElementById('start-btn')
const copyBtn             = document.getElementById('copy-btn')
const myColourLabel       = document.getElementById('my-colour-label')
const settingsPanel       = document.getElementById('settings-panel')
const settingsDisplay     = document.getElementById('settings-display')
const portalsToggle       = document.getElementById('portals-toggle')
const randomPortalsToggle = document.getElementById('random-portals-toggle')
const sizeSlider          = document.getElementById('size-slider')
const sizeValue           = document.getElementById('size-value')
const sizeValue2          = document.getElementById('size-value2')
const densitySlider       = document.getElementById('density-slider')
const densityValue        = document.getElementById('density-value')
const wallWidthSlider     = document.getElementById('wall-width-slider')
const wallWidthValue      = document.getElementById('wall-width-value')
const previewCanvas       = document.getElementById('preview-canvas')
const previewCtx          = previewCanvas.getContext('2d')

// ── Maze preview ──

function drawPreview(size, density, portals, wallWidth) {
  const maze = mazeGenerate(size, density, portals)
  const N = maze.length
  const container = previewCanvas.parentElement
  const maxPx = Math.min(container.clientWidth, container.clientHeight) * 0.85
  const tile = Math.floor(maxPx / N)
  const totalPx = tile * N
  previewCanvas.width  = totalPx
  previewCanvas.height = totalPx

  drawMazeToCtx(previewCtx, maze, tile, wallWidth)
}

function currentSettings() {
  return {
    size:      parseInt(sizeSlider.value),
    density:   parseInt(densitySlider.value),
    portals:   portalsToggle.checked,
    wallWidth: parseInt(wallWidthSlider.value),
  }
}

// ── Copy link ──

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copyBtn.textContent = 'Copied!'
    setTimeout(() => { copyBtn.textContent = 'Copy' }, 2000)
  })
})

// ── Join ──

function join() {
  const name = nameInput.value.trim()
  if (!name) return
  socket.emit('join-room', { roomCode, name })
}

joinBtn.addEventListener('click', join)
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join() })

// ── Settings (host) ──

function emitSettings() {
  const s = currentSettings()
  drawPreview(s.size, s.density, s.portals, s.wallWidth)
  socket.emit('update-settings', {
    portals: s.portals,
    randomPortals: randomPortalsToggle.checked,
    size: s.size,
    density: s.density,
    wallWidth: s.wallWidth,
  })
}

portalsToggle.addEventListener('change', emitSettings)
randomPortalsToggle.addEventListener('change', emitSettings)
sizeSlider.addEventListener('input', () => {
  sizeValue.textContent = sizeSlider.value
  sizeValue2.textContent = sizeSlider.value
  emitSettings()
})
densitySlider.addEventListener('input', () => {
  densityValue.textContent = densitySlider.value
  emitSettings()
})
wallWidthSlider.addEventListener('input', () => {
  wallWidthValue.textContent = wallWidthSlider.value
  emitSettings()
})

// ── Socket events ──

socket.on('joined', ({ isHost: host, colour, roomCode: code }) => {
  isHost = host
  myColour = colour

  sessionStorage.setItem('playerName', nameInput.value.trim())
  sessionStorage.setItem('roomCode', code)

  myColourLabel.innerHTML = `<span class="colour-dot" style="background:${colour}"></span> ${nameInput.value.trim()}`
  myColourLabel.style.color = 'var(--text-dim)'

  nameScreen.classList.add('hidden')
  lobbyScreen.classList.remove('hidden')

  if (isHost) {
    settingsPanel.classList.remove('hidden')
    hostControls.classList.remove('hidden')
    const s = currentSettings()
    drawPreview(s.size, s.density, s.portals, s.wallWidth)
  } else {
    settingsDisplay.classList.remove('hidden')
    waitingMsg.classList.remove('hidden')
  }
})

socket.on('settings-updated', ({ portals, randomPortals, size, density, wallWidth = 2 }) => {
  if (isHost) {
    portalsToggle.checked = portals
    randomPortalsToggle.checked = randomPortals
    sizeSlider.value = size
    sizeValue.textContent = size
    sizeValue2.textContent = size
    densitySlider.value = density
    densityValue.textContent = density
    wallWidthSlider.value = wallWidth
    wallWidthValue.textContent = wallWidth
  } else {
    const portalDesc = !portals ? 'off' : randomPortals ? 'random' : 'on'
    settingsDisplay.textContent = `${size}×${size} · wall density ${density} · portals ${portalDesc}`
    drawPreview(size, density, portals, wallWidth)
  }
})

socket.on('player-list', ({ players }) => {
  playerListEl.innerHTML = ''
  for (const [id, player] of Object.entries(players)) {
    const el = document.createElement('div')
    el.className = 'player-entry'
    el.innerHTML = `<span class="colour-dot" style="background:${player.colour}"></span>${player.name}${player.isHost ? ' <span class="host-tag">host</span>' : ''}`
    playerListEl.appendChild(el)
  }
})

startBtn.addEventListener('click', () => {
  socket.emit('start-game')
})

socket.on('game-started', ({ roomCode }) => {
  window.location.href = `/game/${roomCode}`
})

socket.on('error', ({ message }) => {
  alert(message)
})
