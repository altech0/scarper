const socket = io()

const roomCode = window.location.pathname.slice(1).toUpperCase()
let isHost = false
let myColour = null

document.getElementById('room-code-display').textContent = roomCode
document.getElementById('share-url').textContent = window.location.href

const nameInput       = document.getElementById('name-input')
const joinBtn         = document.getElementById('join-btn')
const nameScreen      = document.getElementById('name-screen')
const lobbyScreen     = document.getElementById('lobby-screen')
const playerListEl    = document.getElementById('player-list')
const hostControls    = document.getElementById('host-controls')
const waitingMsg      = document.getElementById('waiting-msg')
const startBtn        = document.getElementById('start-btn')
const copyBtn         = document.getElementById('copy-btn')
const myColourLabel   = document.getElementById('my-colour-label')
const settingsPanel   = document.getElementById('settings-panel')
const settingsDisplay = document.getElementById('settings-display')
const portalsToggle       = document.getElementById('portals-toggle')
const randomPortalsToggle = document.getElementById('random-portals-toggle')
const sizeSlider      = document.getElementById('size-slider')
const sizeValue       = document.getElementById('size-value')
const sizeValue2      = document.getElementById('size-value2')
const densitySlider   = document.getElementById('density-slider')
const densityValue    = document.getElementById('density-value')

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copyBtn.textContent = 'Copied!'
    setTimeout(() => { copyBtn.textContent = 'Copy link' }, 2000)
  })
})

function join() {
  const name = nameInput.value.trim()
  if (!name) return
  socket.emit('join-room', { roomCode, name })
}

joinBtn.addEventListener('click', join)
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join() })

function emitSettings() {
  socket.emit('update-settings', {
    portals: portalsToggle.checked,
    randomPortals: randomPortalsToggle.checked,
    size: parseInt(sizeSlider.value),
    density: parseInt(densitySlider.value),
  })
}

portalsToggle.addEventListener('change', emitSettings)
randomPortalsToggle.addEventListener('change', emitSettings)
sizeSlider.addEventListener('input', emitSettings)
densitySlider.addEventListener('input', emitSettings)

socket.on('joined', ({ isHost: host, colour, roomCode: code }) => {
  isHost = host
  myColour = colour

  sessionStorage.setItem('playerName', nameInput.value.trim())
  sessionStorage.setItem('roomCode', code)

  myColourLabel.innerHTML = `Your colour: <span style="color:${colour}">&#9679;</span>`

  nameScreen.classList.add('hidden')
  lobbyScreen.classList.remove('hidden')

  if (isHost) {
    settingsPanel.classList.remove('hidden')
    hostControls.classList.remove('hidden')
    waitingMsg.classList.add('hidden')
  } else {
    settingsDisplay.classList.remove('hidden')
    waitingMsg.classList.remove('hidden')
  }
})

socket.on('settings-updated', ({ portals, randomPortals, size, density }) => {
  if (isHost) {
    portalsToggle.checked = portals
    randomPortalsToggle.checked = randomPortals
    sizeSlider.value = size
    sizeValue.textContent = size
    sizeValue2.textContent = size
    densitySlider.value = density
    densityValue.textContent = density
  } else {
    const portalDesc = !portals ? 'off' : randomPortals ? 'random' : 'on'
    settingsDisplay.textContent = `${size}×${size} grid · Walls: ${density}/10 · Portals: ${portalDesc}`
  }
})

sizeSlider.addEventListener('input', () => {
  sizeValue.textContent = sizeSlider.value
  sizeValue2.textContent = sizeSlider.value
})

densitySlider.addEventListener('input', () => {
  densityValue.textContent = densitySlider.value
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
