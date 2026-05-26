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

  // Ground / path: sandy dirt
  ctx.fillStyle = '#d4b896'
  ctx.fillRect(0, 0, N * tile, N * tile)

  // Path tile variation — subtle texture
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (maze[row][col] === 0) {
        const x = col * tile, y = row * tile
        // base dirt
        ctx.fillStyle = '#d4b896'
        ctx.fillRect(x, y, tile, tile)
        // slight noise patches
        ctx.fillStyle = 'rgba(180,140,100,0.3)'
        ctx.fillRect(x + tile*0.1, y + tile*0.6, tile*0.4, tile*0.25)
        ctx.fillRect(x + tile*0.55, y + tile*0.15, tile*0.3, tile*0.2)
      }
    }
  }

  // Hedge walls — drawn back-to-front for depth
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (maze[row][col] === 1) {
        const x = col * tile, y = row * tile
        const t = tile

        // Dark soil base (visible at bottom)
        ctx.fillStyle = '#3d2b0e'
        ctx.fillRect(x, y + t * 0.75, t, t * 0.25)

        // Main hedge body — dark green base
        ctx.fillStyle = '#2d6a1f'
        ctx.fillRect(x, y, t, t * 0.85)

        // Mid green layer
        ctx.fillStyle = '#3d8b2a'
        ctx.fillRect(x + t*0.05, y, t*0.9, t*0.72)

        // Leafy bumps along the top
        const bumpCount = Math.max(2, Math.floor(t / 6))
        const bumpW = t / bumpCount
        for (let b = 0; b < bumpCount; b++) {
          const bx = x + b * bumpW
          const by = y + t * 0.05
          const br = bumpW * 0.55
          // dark bump base
          ctx.beginPath()
          ctx.arc(bx + bumpW/2, by + br*0.4, br, Math.PI, 0)
          ctx.fillStyle = '#2d6a1f'
          ctx.fill()
          // bright top
          ctx.beginPath()
          ctx.arc(bx + bumpW/2, by + br*0.4, br * 0.72, Math.PI, 0)
          ctx.fillStyle = '#5cb85c'
          ctx.fill()
          // highlight fleck
          ctx.beginPath()
          ctx.arc(bx + bumpW*0.38, by + br*0.1, br * 0.22, 0, Math.PI*2)
          ctx.fillStyle = 'rgba(180,240,130,0.55)'
          ctx.fill()
        }

        // Left-face lighter green (3D side)
        ctx.fillStyle = 'rgba(100,200,60,0.18)'
        ctx.fillRect(x, y, t*0.12, t*0.82)

        // Right-face shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(x + t*0.88, y, t*0.12, t*0.82)
      }
    }
  }
}

function mazeCarvePortals(maze, N, portalDensity) {
  const pairs = []
  for (let x = 1; x < N-1; x += 2) {
    pairs.push([
      [[x,0],[x,1]],
      [[x,N-1],[x,N-2]],
    ])
  }
  for (let y = 1; y < N-1; y += 2) {
    pairs.push([
      [[0,y],[1,y]],
      [[N-1,y],[N-2,y]],
    ])
  }
  const count = Math.round(pairs.length * portalDensity / 100)
  for (const [sideA, sideB] of mazeShuffle(pairs).slice(0, count)) {
    for (const [bx, by] of sideA) { maze[by][bx] = 0 }
    for (const [bx, by] of sideB) { maze[by][bx] = 0 }
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
