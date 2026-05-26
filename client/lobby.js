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
const playerListEl        = document.getElementById('player-list')
const hostControls        = document.getElementById('host-controls')
const waitingMsg          = document.getElementById('waiting-msg')
const startBtn            = document.getElementById('start-btn')
const copyBtn             = document.getElementById('copy-btn')
const myColourLabel       = document.getElementById('my-colour-label')
const settingsPanel       = document.getElementById('settings-panel')
const settingsDisplay       = document.getElementById('settings-display')
const portalDensitySlider   = document.getElementById('portal-density-slider')
const portalDensityValue    = document.getElementById('portal-density-value')
const randomPortalsToggle   = document.getElementById('random-portals-toggle')
const sizeSlider            = document.getElementById('size-slider')
const sizeValue           = document.getElementById('size-value')
const sizeValue2          = document.getElementById('size-value2')
const densitySlider       = document.getElementById('density-slider')
const densityValue        = document.getElementById('density-value')
const previewCanvas       = document.getElementById('preview-canvas')
const previewCtx          = previewCanvas.getContext('2d')

// ── Maze preview ──

function drawPreview(size, density, portalDensity) {
  const maze = mazeGenerate(size, density, portalDensity)
  const N = maze.length
  const container = previewCanvas.parentElement
  const maxPx = Math.min(container.clientWidth, container.clientHeight) * 0.85
  const tile = Math.floor(maxPx / N)
  const totalPx = tile * N
  previewCanvas.width  = totalPx
  previewCanvas.height = totalPx

  drawMazeToCtx(previewCtx, maze, tile, 2)
}

function currentSettings() {
  return {
    size:          parseInt(sizeSlider.value),
    density:       parseInt(densitySlider.value),
    portalDensity: parseInt(portalDensitySlider.value),
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

function emitSettings(redraw = false) {
  const s = currentSettings()
  if (redraw) drawPreview(s.size, s.density, s.portalDensity)
  socket.emit('update-settings', {
    portalDensity: s.portalDensity,
    randomPortals: randomPortalsToggle.checked,
    size: s.size,
    density: s.density,
  })
}

portalDensitySlider.addEventListener('input', () => {
  portalDensityValue.textContent = portalDensitySlider.value
  emitSettings(true)
})
sizeSlider.addEventListener('input', () => {
  sizeValue.textContent = sizeSlider.value
  sizeValue2.textContent = sizeSlider.value
  emitSettings(true)
})
densitySlider.addEventListener('input', () => {
  densityValue.textContent = densitySlider.value
  emitSettings(true)
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
    drawPreview(s.size, s.density, s.portalDensity)
  } else {
    settingsDisplay.classList.remove('hidden')
    waitingMsg.classList.remove('hidden')
  }
})

randomPortalsToggle.addEventListener('change', () => emitSettings(false))

socket.on('settings-updated', ({ portalDensity, randomPortals, size, density }) => {
  if (isHost) {
    portalDensitySlider.value = portalDensity
    portalDensityValue.textContent = portalDensity
    randomPortalsToggle.checked = randomPortals
    sizeSlider.value = size
    sizeValue.textContent = size
    sizeValue2.textContent = size
    densitySlider.value = density
    densityValue.textContent = density
  } else {
    const exitDesc = randomPortals ? 'random exit' : 'opposite exit'
    settingsDisplay.textContent = `${size}×${size} · walls ${density} · portals ${portalDensity}% · ${exitDesc}`
    drawPreview(size, density, portalDensity)
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
