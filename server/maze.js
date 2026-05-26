function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generate(size, density, portals) {
  const N = size % 2 === 0 ? size + 1 : size
  const maze = Array.from({ length: N }, () => Array(N).fill(1))

  function carve(x, y) {
    maze[y][x] = 0
    for (const [dx, dy] of shuffle([[0,-2],[0,2],[-2,0],[2,0]])) {
      const nx = x + dx, ny = y + dy
      if (nx > 0 && nx < N-1 && ny > 0 && ny < N-1 && maze[ny][nx] === 1) {
        maze[y + dy/2][x + dx/2] = 0
        carve(nx, ny)
      }
    }
  }
  carve(1, 1)

  // collect interior wall cells (excluding outer border)
  const walls = []
  for (let y = 1; y < N-1; y++)
    for (let x = 1; x < N-1; x++)
      if (maze[y][x] === 1) walls.push([x, y])

  // density 10 = full maze, density 0 = no interior walls
  const removeCount = Math.floor(walls.length * (10 - density) / 10)
  for (const [x, y] of shuffle(walls).slice(0, removeCount)) maze[y][x] = 0

  if (portals) {
    const mid = Math.floor(N / 2)
    maze[0][mid] = 0;   maze[1][mid] = 0
    maze[N-1][mid] = 0; maze[N-2][mid] = 0
    maze[mid][0] = 0;   maze[mid][1] = 0
    maze[mid][N-1] = 0; maze[mid][N-2] = 0
  }

  return maze
}

function getStartPositions(N) {
  const mid = Math.floor(N / 2)
  const midOdd = mid % 2 === 0 ? mid - 1 : mid
  return [
    { x: 1,   y: 1 },
    { x: N-2, y: 1 },
    { x: 1,   y: N-2 },
    { x: N-2, y: N-2 },
    { x: 1,   y: midOdd },
    { x: N-2, y: midOdd },
  ]
}

module.exports = { generate, getStartPositions }
