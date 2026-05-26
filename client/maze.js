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
      ctx.fillStyle = maze[row][col] === 1 ? '#111111' : '#ffffff'
      ctx.fillRect(col * tile, row * tile, tile, tile)
    }
  }

  // grid lines on path tiles
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 0.5
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (maze[row][col] === 0) {
        ctx.strokeRect(col * tile + 0.5, row * tile + 0.5, tile - 1, tile - 1)
      }
    }
  }
}

function mazeCarvePortals(maze, N, portalDensity) {
  const candidates = []
  for (let x = 1; x < N-1; x += 2) {
    if (x+1 < N-1) candidates.push([[x,0],[x,1],[x,2]])
    if (N-2-1 > 0) candidates.push([[x,N-1],[x,N-2],[x,N-3]])
  }
  for (let y = 1; y < N-1; y += 2) {
    if (y+1 < N-1) candidates.push([[0,y],[1,y],[2,y]])
    if (N-2-1 > 0) candidates.push([[N-1,y],[N-2,y],[N-3,y]])
  }
  const count = Math.round(candidates.length * portalDensity / 100)
  for (const [[bx,by],[wx,wy],[px,py]] of mazeShuffle(candidates).slice(0, count)) {
    maze[by][bx] = 0
    maze[wy][wx] = 0
    maze[py][px] = 0
  }
}

function mazeGenerate(size, density, portalDensity) {
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

  if (portalDensity > 0) mazeCarvePortals(maze, N, portalDensity)

  return maze
}
