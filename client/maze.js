function mazeShuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawMazeToCtx(ctx, maze, tile, wallWidth) {
  const N = maze.length
  const w = wallWidth || 2

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      ctx.fillStyle = maze[row][col] === 1 ? '#0d1a2e' : '#0d0b00'
      ctx.fillRect(col * tile, row * tile, tile, tile)
    }
  }

  // inner wall borders: draw thick edges on path cells adjacent to walls
  ctx.fillStyle = '#0d1a2e'
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (maze[row][col] !== 0) continue
      const x = col * tile
      const y = row * tile
      if (row > 0     && maze[row-1][col] === 1) ctx.fillRect(x, y, tile, w)
      if (row < N-1   && maze[row+1][col] === 1) ctx.fillRect(x, y + tile - w, tile, w)
      if (col > 0     && maze[row][col-1] === 1) ctx.fillRect(x, y, w, tile)
      if (col < N-1   && maze[row][col+1] === 1) ctx.fillRect(x + tile - w, y, w, tile)
    }
  }

  // grid lines on path tiles
  ctx.strokeStyle = '#161400'
  ctx.lineWidth = 0.5
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (maze[row][col] === 0) {
        ctx.strokeRect(col * tile + 0.5, row * tile + 0.5, tile - 1, tile - 1)
      }
    }
  }
}

function mazeGenerate(size, density, portals) {
  const N = size % 2 === 0 ? size + 1 : size
  const maze = Array.from({ length: N }, () => Array(N).fill(1))

  function carve(x, y) {
    maze[y][x] = 0
    for (const [dx, dy] of mazeShuffle([[0,-2],[0,2],[-2,0],[2,0]])) {
      const nx = x + dx, ny = y + dy
      if (nx > 0 && nx < N-1 && ny > 0 && ny < N-1 && maze[ny][nx] === 1) {
        maze[y + dy/2][x + dx/2] = 0
        carve(nx, ny)
      }
    }
  }
  carve(1, 1)

  const walls = []
  for (let y = 1; y < N-1; y++)
    for (let x = 1; x < N-1; x++)
      if (maze[y][x] === 1) walls.push([x, y])

  const removeCount = Math.floor(walls.length * (10 - density) / 10)
  for (const [x, y] of mazeShuffle(walls).slice(0, removeCount)) maze[y][x] = 0

  if (portals) {
    const mid = Math.floor(N / 2)
    maze[0][mid] = 0;   maze[1][mid] = 0
    maze[N-1][mid] = 0; maze[N-2][mid] = 0
    maze[mid][0] = 0;   maze[mid][1] = 0
    maze[mid][N-1] = 0; maze[mid][N-2] = 0
  }

  return maze
}
