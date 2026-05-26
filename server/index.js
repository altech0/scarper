const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static(path.join(__dirname, '../client')))

const players = {}
// { socketId: { x, y, colour } }

const COLOURS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']

function randomColour() {
  return COLOURS[Math.floor(Math.random() * COLOURS.length)]
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`)

  players[socket.id] = { x: 1, y: 1, colour: randomColour() }

  socket.emit('init', { id: socket.id, players })

  socket.broadcast.emit('update', { players })

  socket.on('move', ({ x, y }) => {
    if (players[socket.id]) {
      players[socket.id].x = x
      players[socket.id].y = y
      io.emit('update', { players })
    }
  })

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`)
    delete players[socket.id]
    io.emit('update', { players })
  })
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(`Scarper running at http://localhost:${PORT}`)
})
