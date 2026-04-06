import { useCallback, useEffect, useRef, useState } from 'react'
import { MAP_H, MAP_W, JUMPSCARE_FACES, MONSTER_FACES, TILE, TOTAL_KEYS } from './constants'
import { createAmbientAudio, type AudioController } from './audio'
import type { GameUiState, KeyItem, Monster, Particle, Player, TileType, TreeData } from './types'

const initialUiState: GameUiState = {
  collectedKeys: 0,
  totalKeys: TOTAL_KEYS,
  stamina: 100,
  overlayVisible: true,
  jumpscareVisible: false,
  jumpscareText: JUMPSCARE_FACES[0],
  winVisible: false,
  deathVisible: false,
  hintVisible: true,
}

const randomInt = (maxExclusive: number): number => Math.floor(Math.random() * maxExclusive)
const MINIMAP_MARGIN = 16
const MINIMAP_MAX_SIZE = 210

const shuffle = <T,>(values: T[]): T[] => {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const temp = values[i]
    values[i] = values[j]
    values[j] = temp
  }
  return values
}

export function useLostWoodsGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ui, setUi] = useState<GameUiState>(initialUiState)

  const uiRef = useRef(initialUiState)
  const gameStartedRef = useRef(false)
  const mapRef = useRef<TileType[][]>([])
  const treeDataRef = useRef<TreeData[][]>([])
  const keyItemsRef = useRef<KeyItem[]>([])
  const monstersRef = useRef<Monster[]>([])
  const particlesRef = useRef<Particle[]>([])
  const playerRef = useRef<Player>({ x: 0, y: 0, angle: 0, stamina: 100, speed: 2.3 })
  const heldRef = useRef<Record<string, boolean>>({})

  const frameRef = useRef<number | null>(null)
  const resizeRef = useRef<(() => void) | null>(null)
  const lastTimeRef = useRef(0)
  const tickRef = useRef(0)
  const cameraRef = useRef({ x: 0, y: 0 })

  const jumpscareActiveRef = useRef(false)
  const jumpscareTimerRef = useRef(0)
  const jumpscareCountRef = useRef(0)
  const winShownRef = useRef(false)
  const deathShownRef = useRef(false)
  const flashRadiusRef = useRef(140)
  const hintTimerRef = useRef(4000)
  const screenFlashRef = useRef(0)

  const dimensionsRef = useRef({ width: 0, height: 0 })
  const audioControllerRef = useRef<AudioController | null>(null)

  const updateUi = useCallback((patch: Partial<GameUiState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch }
      uiRef.current = next
      return next
    })
  }, [])

  const generateMap = useCallback(() => {
    const map: TileType[][] = []
    const treeData: TreeData[][] = []

    for (let y = 0; y < MAP_H; y += 1) {
      map[y] = []
      treeData[y] = []
      for (let x = 0; x < MAP_W; x += 1) {
        const isBorder = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1
        const tile: TileType = isBorder ? 2 : Math.random() < 0.42 ? (Math.random() < 0.4 ? 2 : 1) : 0
        map[y][x] = tile
        treeData[y][x] = {
          trunkW: 5 + Math.random() * 4,
          lean: (Math.random() - 0.5) * 0.18,
          size: 0.45 + Math.random() * 0.18,
          layers: 2 + Math.floor(Math.random() * 2),
          dark: Math.random() < 0.3,
        }
      }
    }

    for (let i = 0; i < 16; i += 1) {
      let cx = 2 + randomInt(MAP_W - 4)
      let cy = 2 + randomInt(MAP_H - 4)
      const len = 10 + randomInt(16)
      let angle = Math.random() * Math.PI * 2

      for (let j = 0; j < len; j += 1) {
        angle += (Math.random() - 0.5) * 0.8
        cx = Math.max(1, Math.min(MAP_W - 2, cx + Math.round(Math.cos(angle))))
        cy = Math.max(1, Math.min(MAP_H - 2, cy + Math.round(Math.sin(angle))))
        map[cy][cx] = 0
        if (Math.random() < 0.4) {
          const ox = cx + (Math.random() < 0.5 ? -1 : 1)
          if (ox > 0 && ox < MAP_W - 1) {
            map[cy][ox] = 0
          }
        }
      }
    }

    for (let dy = 1; dy <= 6; dy += 1) {
      for (let dx = 1; dx <= 6; dx += 1) {
        map[dy][dx] = 0
      }
    }

    const reachable = Array.from({ length: MAP_H }, () => Array<boolean>(MAP_W).fill(false))
    const queue: Array<[number, number]> = [[3, 3]]

    while (queue.length > 0) {
      const [cx, cy] = queue.shift() as [number, number]

      if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) {
        continue
      }
      if (reachable[cy][cx] || map[cy][cx] !== 0) {
        continue
      }

      reachable[cy][cx] = true
      queue.push([cx + 1, cy])
      queue.push([cx - 1, cy])
      queue.push([cx, cy + 1])
      queue.push([cx, cy - 1])
    }

    const farCandidates: Array<[number, number]> = []
    const mediumCandidates: Array<[number, number]> = []
    const nearCandidates: Array<[number, number]> = []

    for (let y = 1; y < MAP_H - 1; y += 1) {
      for (let x = 1; x < MAP_W - 1; x += 1) {
        if (!reachable[y][x]) {
          continue
        }

        const distFromSpawn = Math.hypot(x - 3, y - 3)
        if (distFromSpawn > 10) {
          farCandidates.push([x, y])
        } else if (distFromSpawn > 4) {
          mediumCandidates.push([x, y])
        } else if (distFromSpawn > 1.5) {
          nearCandidates.push([x, y])
        }
      }
    }

    const keyItems: KeyItem[] = []
    const orderedCandidates = [...shuffle(farCandidates), ...shuffle(mediumCandidates), ...shuffle(nearCandidates)]
    const occupied = new Set<string>()

    for (const [kx, ky] of orderedCandidates) {
      const id = `${kx},${ky}`
      if (occupied.has(id)) {
        continue
      }

      keyItems.push({ x: kx, y: ky, collected: false, bob: Math.random() * Math.PI * 2 })
      occupied.add(id)

      if (keyItems.length >= TOTAL_KEYS) {
        break
      }
    }

    // Safety net: if a map produced too few reachable tiles, fill from any reachable floor tile.
    if (keyItems.length < TOTAL_KEYS) {
      const allReachable: Array<[number, number]> = []
      for (let y = 1; y < MAP_H - 1; y += 1) {
        for (let x = 1; x < MAP_W - 1; x += 1) {
          if (reachable[y][x]) {
            allReachable.push([x, y])
          }
        }
      }

      for (const [kx, ky] of shuffle(allReachable)) {
        const id = `${kx},${ky}`
        if (occupied.has(id)) {
          continue
        }

        keyItems.push({ x: kx, y: ky, collected: false, bob: Math.random() * Math.PI * 2 })
        occupied.add(id)

        if (keyItems.length >= TOTAL_KEYS) {
          break
        }
      }
    }

    const monsters: Monster[] = []
    for (let i = 0; i < 5; i += 1) {
      let mx = 10 + randomInt(MAP_W - 20)
      let my = 10 + randomInt(MAP_H - 20)
      let guard = 0

      while (map[my][mx] !== 0 && guard < 1000) {
        mx = 10 + randomInt(MAP_W - 20)
        my = 10 + randomInt(MAP_H - 20)
        guard += 1
      }

      monsters.push({
        x: mx * TILE + TILE / 2,
        y: my * TILE + TILE / 2,
        speed: 0.55 + Math.random() * 0.45,
        alertR: 160 + Math.random() * 80,
        state: 'idle',
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: 0,
        face: MONSTER_FACES[i % MONSTER_FACES.length],
        phase: Math.random() * Math.PI * 2,
      })
    }

    mapRef.current = map
    treeDataRef.current = treeData
    keyItemsRef.current = keyItems
    monstersRef.current = monsters
    particlesRef.current = []

    playerRef.current = {
      x: 3 * TILE + TILE / 2,
      y: 3 * TILE + TILE / 2,
      angle: 0,
      stamina: 100,
      speed: 2.3,
    }

    gameStartedRef.current = false
    jumpscareActiveRef.current = false
    jumpscareTimerRef.current = 0
    jumpscareCountRef.current = 0
    winShownRef.current = false
    deathShownRef.current = false
    flashRadiusRef.current = 140
    hintTimerRef.current = 4000
    screenFlashRef.current = 0
    lastTimeRef.current = 0

    updateUi({
      collectedKeys: 0,
      stamina: 100,
      overlayVisible: true,
      jumpscareVisible: false,
      jumpscareText: JUMPSCARE_FACES[0],
      winVisible: false,
      deathVisible: false,
      hintVisible: true,
    })
  }, [updateUi])

  const solid = useCallback((wx: number, wy: number): boolean => {
    const map = mapRef.current
    const tx = Math.floor(wx / TILE)
    const ty = Math.floor(wy / TILE)

    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) {
      return true
    }

    return map[ty][tx] > 0
  }, [])

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      const player = playerRef.current
      const margin = 15
      const nx = player.x + dx
      const ny = player.y + dy

      if (
        !solid(nx + margin, player.y + margin) &&
        !solid(nx + margin, player.y - margin) &&
        !solid(nx - margin, player.y + margin) &&
        !solid(nx - margin, player.y - margin)
      ) {
        player.x = nx
      }

      if (
        !solid(player.x + margin, ny + margin) &&
        !solid(player.x + margin, ny - margin) &&
        !solid(player.x - margin, ny + margin) &&
        !solid(player.x - margin, ny - margin)
      ) {
        player.y = ny
      }
    },
    [solid],
  )

  const triggerJumpscare = useCallback(() => {
    if (jumpscareActiveRef.current || winShownRef.current || deathShownRef.current) {
      return
    }

    jumpscareActiveRef.current = true
    jumpscareTimerRef.current = 0
    jumpscareCountRef.current += 1
    screenFlashRef.current = 1

    const face = JUMPSCARE_FACES[randomInt(JUMPSCARE_FACES.length)]
    updateUi({ jumpscareVisible: true, jumpscareText: face })

    if (jumpscareCountRef.current >= 3) {
      window.setTimeout(() => {
        jumpscareActiveRef.current = false
        updateUi({ jumpscareVisible: false })
        if (!winShownRef.current) {
          deathShownRef.current = true
          updateUi({ deathVisible: true })
        }
      }, 1200)
    }
  }, [updateUi])

  const spawnCollectParticles = useCallback((x: number, y: number) => {
    for (let i = 0; i < 10; i += 1) {
      const angle = Math.random() * Math.PI * 2
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2 - 1,
        life: 1,
      })
    }
  }, [])

  const updateMonsters = useCallback(
    (dt: number) => {
      const monsters = monstersRef.current
      const player = playerRef.current

      monsters.forEach((monster) => {
        const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
        monster.wanderTimer -= dt

        if (dist < monster.alertR) {
          monster.state = 'chase'
          const angle = Math.atan2(player.y - monster.y, player.x - monster.x)
          const speed = monster.speed * (1 + (1 - dist / monster.alertR) * 2)
          const nx = monster.x + Math.cos(angle) * speed
          const ny = monster.y + Math.sin(angle) * speed

          if (!solid(nx, ny)) {
            monster.x = nx
            monster.y = ny
          } else {
            const nx2 = monster.x + Math.cos(angle) * speed
            if (!solid(nx2, monster.y)) {
              monster.x = nx2
            } else {
              const ny2 = monster.y + Math.sin(angle) * speed
              if (!solid(monster.x, ny2)) {
                monster.y = ny2
              }
            }
          }
        } else {
          monster.state = 'idle'
          if (monster.wanderTimer <= 0) {
            monster.wanderAngle += (Math.random() - 0.5) * 1.8
            monster.wanderTimer = 80 + Math.random() * 140
          }
          const nx = monster.x + Math.cos(monster.wanderAngle) * 0.45
          const ny = monster.y + Math.sin(monster.wanderAngle) * 0.45
          if (!solid(nx, ny)) {
            monster.x = nx
            monster.y = ny
          } else {
            monster.wanderAngle += Math.PI * (0.5 + Math.random())
          }
        }

        if (dist < 20) {
          triggerJumpscare()
        }
      })
    },
    [solid, triggerJumpscare],
  )

  const updateParticles = useCallback((dt: number) => {
    particlesRef.current = particlesRef.current.filter((particle) => {
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vy += 0.08
      particle.life -= dt * 0.003
      return particle.life > 0
    })
  }, [])

  const drawTree = useCallback((ctx: CanvasRenderingContext2D, sx: number, sy: number, tree: TreeData) => {
    ctx.save()
    ctx.translate(sx + TILE / 2, sy + TILE * 0.62)
    ctx.rotate(tree.lean)

    const scale = TILE * tree.size

    ctx.fillStyle = '#1e1008'
    ctx.fillRect(-tree.trunkW / 2, scale * 0.1, tree.trunkW, scale * 0.55)

    ctx.fillStyle = '#170c06'
    ctx.beginPath()
    ctx.ellipse(0, scale * 0.6, tree.trunkW * 1.4, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    const base = tree.dark ? '#071508' : '#0b1f07'
    const mid = tree.dark ? '#091a06' : '#0e2609'
    const top = tree.dark ? '#0b1e08' : '#112e0b'

    for (let layer = 0; layer < tree.layers; layer += 1) {
      const y = -(layer * scale * 0.28)
      const radius = scale * (0.5 - layer * 0.08)
      ctx.fillStyle = layer === 0 ? base : layer === 1 ? mid : top
      ctx.beginPath()
      ctx.arc(0, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(100,180,60,0.04)'
    ctx.beginPath()
    ctx.arc(-scale * 0.12, -scale * 0.05, scale * 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const drawGround = useCallback((ctx: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number) => {
    ctx.fillStyle = (tx + ty) % 2 === 0 ? '#0e1a09' : '#0d1808'
    ctx.fillRect(sx, sy, TILE, TILE)

    if ((tx * 7 + ty * 3) % 9 === 0) {
      ctx.fillStyle = '#0b1506'
      ctx.fillRect(sx + 6, sy + 10, 3, 3)
    }
    if ((tx * 5 + ty * 11) % 7 === 0) {
      ctx.fillStyle = '#131f0d'
      ctx.fillRect(sx + 30, sy + 36, 2, 2)
    }
    if ((tx * 2 + ty * 13) % 11 === 0) {
      ctx.fillStyle = '#0c1707'
      ctx.fillRect(sx + 20, sy + 20, 4, 2)
    }
  }, [])

  const drawMap = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current
    const { x: camX, y: camY } = cameraRef.current
    const map = mapRef.current
    const treeData = treeDataRef.current

    const startTX = Math.max(0, Math.floor(camX / TILE) - 1)
    const startTY = Math.max(0, Math.floor(camY / TILE) - 1)
    const endTX = Math.min(MAP_W, startTX + Math.ceil(width / TILE) + 3)
    const endTY = Math.min(MAP_H, startTY + Math.ceil(height / TILE) + 3)

    ctx.fillStyle = '#050c03'
    ctx.fillRect(0, 0, width, height)

    for (let ty = startTY; ty < endTY; ty += 1) {
      for (let tx = startTX; tx < endTX; tx += 1) {
        const sx = tx * TILE - camX
        const sy = ty * TILE - camY

        if (map[ty][tx] === 0) {
          drawGround(ctx, tx, ty, sx, sy)
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? '#0a1407' : '#091206'
          ctx.fillRect(sx, sy, TILE, TILE)
          if ((tx * 5 + ty * 7) % 8 === 0) {
            ctx.fillStyle = '#0c1a08'
            ctx.fillRect(sx + 8, sy + 14, 5, 4)
          }
          if ((tx * 11 + ty * 3) % 9 === 0) {
            ctx.fillStyle = '#0b1807'
            ctx.fillRect(sx + 28, sy + 30, 4, 3)
          }
        }
      }
    }

    for (let ty = startTY; ty < endTY; ty += 1) {
      for (let tx = startTX; tx < endTX; tx += 1) {
        if (map[ty][tx] > 0) {
          const sx = tx * TILE - camX
          const sy = ty * TILE - camY
          drawTree(ctx, sx, sy, treeData[ty][tx])
        }
      }
    }
  }, [drawGround, drawTree])

  const drawKeys = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x: camX, y: camY } = cameraRef.current

    keyItemsRef.current.forEach((key) => {
      if (key.collected) {
        return
      }

      const sx = key.x * TILE + TILE / 2 - camX
      const sy = key.y * TILE + TILE / 2 - camY + Math.sin(tickRef.current * 0.04 + key.bob) * 5

      ctx.save()
      ctx.shadowColor = '#d09020'
      ctx.shadowBlur = 18
      ctx.strokeStyle = '#d8a84c'
      ctx.lineWidth = 3

      ctx.beginPath()
      ctx.arc(sx - 7, sy - 2, 4, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(sx - 3, sy)
      ctx.lineTo(sx + 8, sy)
      ctx.lineTo(sx + 8, sy + 3)
      ctx.lineTo(sx + 5, sy + 3)
      ctx.lineTo(sx + 5, sy + 6)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(sx, sy, 16 + Math.sin(tickRef.current * 0.04 + key.bob) * 3, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(200,140,20,0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.restore()
    })
  }, [])

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x: camX, y: camY } = cameraRef.current

    particlesRef.current.forEach((particle) => {
      const sx = particle.x - camX
      const sy = particle.y - camY
      ctx.globalAlpha = particle.life
      ctx.fillStyle = '#d09020'
      ctx.beginPath()
      ctx.arc(sx, sy, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })
  }, [])

  const drawMonsters = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x: camX, y: camY } = cameraRef.current
    const player = playerRef.current
    const flashRadius = flashRadiusRef.current

    monstersRef.current.forEach((monster) => {
      const sx = monster.x - camX
      const sy = monster.y - camY
      const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
      const visibleRadius = flashRadius * 1.2

      if (dist > visibleRadius * 1.8) {
        return
      }

      const alpha = Math.max(0, Math.min(1, 1 - dist / (visibleRadius * 1.4)))
      const bob = Math.sin(tickRef.current * 0.05 + monster.phase) * 4

      ctx.save()
      ctx.globalAlpha = alpha * 0.92
      ctx.font = `${Math.floor(24 + Math.sin(tickRef.current * 0.07) * 2)}px Georgia, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (monster.state === 'chase') {
        ctx.shadowColor = '#ff2000'
        ctx.shadowBlur = 20
      }
      ctx.fillStyle = '#e6dfcf'
      ctx.fillText(monster.face, sx, sy + bob)
      ctx.restore()
    })
  }, [])

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D) => {
    const { x: camX, y: camY } = cameraRef.current
    const player = playerRef.current
    const cx = player.x - camX
    const cy = player.y - camY

    ctx.save()
    ctx.translate(cx, cy)

    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.ellipse(1, 12, 10, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    const legBob = Math.sin(tickRef.current * 0.25) * 4
    ctx.fillStyle = '#1e1208'
    ctx.fillRect(-5, 4, 4, 12 + legBob)
    ctx.fillRect(1, 4, 4, 12 - legBob)

    ctx.fillStyle = '#2e2015'
    ctx.fillRect(-6, -10, 12, 16)

    ctx.fillStyle = '#261a10'
    ctx.fillRect(-6, -2, 3, 8)
    ctx.fillRect(3, -2, 3, 8)

    ctx.fillStyle = '#c8a882'
    ctx.beginPath()
    ctx.arc(0, -16, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#100a04'
    ctx.beginPath()
    ctx.arc(0, -19, 6.5, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(-6.5, -20, 13, 4)

    const eyeX = Math.cos(player.angle) * 2
    const eyeY = Math.sin(player.angle) * 2
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(eyeX - 4, -16 + eyeY, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(eyeX + 1, -16 + eyeY, 1.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }, [])

  const drawFlashlight = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current
    const { x: camX, y: camY } = cameraRef.current
    const player = playerRef.current
    const flashRadius = flashRadiusRef.current

    const cx = player.x - camX
    const cy = player.y - camY

    const mask = document.createElement('canvas')
    mask.width = width
    mask.height = height
    const maskCtx = mask.getContext('2d')
    if (!maskCtx) {
      return
    }

    maskCtx.fillStyle = 'rgba(0,0,0,0.97)'
    maskCtx.fillRect(0, 0, width, height)
    maskCtx.globalCompositeOperation = 'destination-out'

    const coneAngle = Math.PI / 4.2
    const gradient = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, flashRadius)
    gradient.addColorStop(0, 'rgba(255,248,220,1)')
    gradient.addColorStop(0.4, 'rgba(255,240,180,0.9)')
    gradient.addColorStop(0.75, 'rgba(255,220,140,0.45)')
    gradient.addColorStop(0.9, 'rgba(255,200,100,0.15)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')

    maskCtx.fillStyle = gradient
    maskCtx.beginPath()
    maskCtx.moveTo(cx, cy)
    maskCtx.arc(cx, cy, flashRadius, player.angle - coneAngle, player.angle + coneAngle)
    maskCtx.closePath()
    maskCtx.fill()

    const ambient = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, 32)
    ambient.addColorStop(0, 'rgba(255,240,200,0.55)')
    ambient.addColorStop(1, 'rgba(0,0,0,0)')

    maskCtx.fillStyle = ambient
    maskCtx.beginPath()
    maskCtx.arc(cx, cy, 32, 0, Math.PI * 2)
    maskCtx.fill()

    ctx.drawImage(mask, 0, 0)

    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.fillStyle = '#fff8c0'
    ctx.beginPath()
    ctx.arc(cx + Math.cos(player.angle) * 8, cy + Math.sin(player.angle) * 8, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const drawMinimap = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current
    const map = mapRef.current
    if (!map.length) {
      return
    }

    const worldWidth = MAP_W * TILE
    const worldHeight = MAP_H * TILE
    const panelSize = Math.min(MINIMAP_MAX_SIZE, Math.floor(Math.min(width, height) * 0.26))
    const scale = Math.min(panelSize / worldWidth, panelSize / worldHeight)
    const mapDrawWidth = worldWidth * scale
    const mapDrawHeight = worldHeight * scale
    const panelX = width - mapDrawWidth - MINIMAP_MARGIN
    const panelY = MINIMAP_MARGIN
    const player = playerRef.current
    const { x: camX, y: camY } = cameraRef.current
    const viewWidth = dimensionsRef.current.width
    const viewHeight = dimensionsRef.current.height

    ctx.save()
    ctx.translate(panelX, panelY)

    ctx.fillStyle = 'rgba(5, 10, 4, 0.86)'
    ctx.fillRect(-8, -22, mapDrawWidth + 16, mapDrawHeight + 30)
    ctx.strokeStyle = 'rgba(180, 220, 120, 0.38)'
    ctx.lineWidth = 1
    ctx.strokeRect(-8, -22, mapDrawWidth + 16, mapDrawHeight + 30)

    ctx.fillStyle = 'rgba(210, 230, 180, 0.7)'
    ctx.font = '11px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('MAP', 0, -18)

    ctx.fillStyle = '#081108'
    ctx.fillRect(0, 0, mapDrawWidth, mapDrawHeight)

    for (let y = 0; y < MAP_H; y += 1) {
      for (let x = 0; x < MAP_W; x += 1) {
        ctx.fillStyle = map[y][x] === 0 ? '#153016' : '#061006'
        ctx.fillRect(x * TILE * scale, y * TILE * scale, Math.max(1, TILE * scale), Math.max(1, TILE * scale))
      }
    }

    keyItemsRef.current.forEach((key) => {
      if (key.collected) {
        return
      }
      ctx.fillStyle = '#d8a84c'
      ctx.fillRect(key.x * TILE * scale + 1, key.y * TILE * scale + 1, Math.max(2, TILE * scale * 0.2), Math.max(2, TILE * scale * 0.2))
    })

    monstersRef.current.forEach((monster) => {
      ctx.fillStyle = monster.state === 'chase' ? '#ff5244' : '#a83b2a'
      ctx.beginPath()
      ctx.arc(monster.x * scale, monster.y * scale, Math.max(2, TILE * scale * 0.12), 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.fillStyle = '#7df0ff'
    ctx.beginPath()
    ctx.arc(player.x * scale, player.y * scale, Math.max(2.5, TILE * scale * 0.14), 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(125, 240, 255, 0.9)'
    ctx.lineWidth = 1.2
    ctx.strokeRect(camX * scale, camY * scale, viewWidth * scale, viewHeight * scale)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.fillRect(0, 0, mapDrawWidth, mapDrawHeight)

    ctx.restore()
  }, [])

  const renderFrame = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current

    ctx.clearRect(0, 0, width, height)
    drawMap(ctx)
    drawKeys(ctx)
    drawParticles(ctx)
    drawMonsters(ctx)
    drawPlayer(ctx)
    drawFlashlight(ctx)
    drawMinimap(ctx)

    if (Math.random() < 0.006) {
      ctx.fillStyle = 'rgba(255,200,80,0.025)'
      ctx.fillRect(0, 0, width, height)
    }
    if (Math.random() < 0.003) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, width, height)
    }

    if (screenFlashRef.current > 0) {
      ctx.fillStyle = `rgba(200,30,10,${screenFlashRef.current * 0.4})`
      ctx.fillRect(0, 0, width, height)
      screenFlashRef.current = Math.max(0, screenFlashRef.current - 0.2)
    }
  }, [drawFlashlight, drawKeys, drawMap, drawMinimap, drawMonsters, drawParticles, drawPlayer])

  const loop = useCallback(
    (timestamp: number) => {
      frameRef.current = requestAnimationFrame(loop)

      const canvas = canvasRef.current
      if (!canvas || !gameStartedRef.current) {
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      const dt = Math.min(timestamp - lastTimeRef.current, 50)
      lastTimeRef.current = timestamp
      tickRef.current += 1

      if (jumpscareActiveRef.current) {
        jumpscareTimerRef.current += dt
        if (jumpscareTimerRef.current > 900 && jumpscareCountRef.current < 3) {
          jumpscareActiveRef.current = false
          updateUi({ jumpscareVisible: false })
          monstersRef.current.forEach((monster) => {
            const angle = Math.random() * Math.PI * 2
            const distance = 300 + Math.random() * 200
            monster.x = playerRef.current.x + Math.cos(angle) * distance
            monster.y = playerRef.current.y + Math.sin(angle) * distance
          })
        }
        return
      }

      if (winShownRef.current || deathShownRef.current) {
        return
      }

      const player = playerRef.current
      const held = heldRef.current
      const running = held.Shift && player.stamina > 2
      const speed = player.speed * (running ? 1.75 : 1)

      let dx = 0
      let dy = 0

      if (held.ArrowUp || held.w || held.W) {
        dy -= speed
      }
      if (held.ArrowDown || held.s || held.S) {
        dy += speed
      }
      if (held.ArrowLeft || held.a || held.A) {
        dx -= speed
      }
      if (held.ArrowRight || held.d || held.D) {
        dx += speed
      }

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy)
        movePlayer((dx / len) * speed, (dy / len) * speed)
        player.angle = Math.atan2(dy, dx)
        if (running) {
          player.stamina = Math.max(0, player.stamina - dt * 0.09)
        }
      } else {
        player.stamina = Math.min(100, player.stamina + dt * 0.035)
      }

      const staminaInt = Math.round(player.stamina)
      if (staminaInt !== uiRef.current.stamina) {
        updateUi({ stamina: staminaInt })
      }

      const { width, height } = dimensionsRef.current
      const camX = Math.max(0, Math.min(MAP_W * TILE - width, player.x - width / 2))
      const camY = Math.max(0, Math.min(MAP_H * TILE - height, player.y - height / 2))
      cameraRef.current = { x: camX, y: camY }

      keyItemsRef.current.forEach((key) => {
        if (key.collected) {
          return
        }

        const worldX = key.x * TILE + TILE / 2
        const worldY = key.y * TILE + TILE / 2
        if (Math.hypot(worldX - player.x, worldY - player.y) < 28) {
          key.collected = true
          const collected = uiRef.current.collectedKeys + 1
          flashRadiusRef.current = Math.min(220, flashRadiusRef.current + 15)
          spawnCollectParticles(worldX, worldY)
          audioControllerRef.current?.playKeyCollect()
          updateUi({ collectedKeys: collected })

          if (collected >= TOTAL_KEYS && !winShownRef.current) {
            winShownRef.current = true
            window.setTimeout(() => updateUi({ winVisible: true }), 700)
          }
        }
      })

      if (hintTimerRef.current > 0) {
        hintTimerRef.current -= dt
        if (hintTimerRef.current <= 0 && uiRef.current.hintVisible) {
          updateUi({ hintVisible: false })
        }
      }

      updateMonsters(dt)
      updateParticles(dt)
      renderFrame(ctx)
    },
    [movePlayer, renderFrame, spawnCollectParticles, updateMonsters, updateParticles, updateUi],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const resize = (): void => {
      dimensionsRef.current.width = window.innerWidth
      dimensionsRef.current.height = window.innerHeight
      canvas.width = dimensionsRef.current.width
      canvas.height = dimensionsRef.current.height
    }

    resizeRef.current = resize
    resize()

    const onKeyDown = (event: KeyboardEvent): void => {
      heldRef.current[event.key] = true
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      heldRef.current[event.key] = false
    }

    window.addEventListener('resize', resize)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    generateMap()
    frameRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
      audioControllerRef.current?.stop()
      audioControllerRef.current = null
    }
  }, [generateMap, loop])

  const startGame = useCallback(() => {
    if (gameStartedRef.current) {
      return
    }

    gameStartedRef.current = true
    lastTimeRef.current = performance.now()
    updateUi({ overlayVisible: false })

    audioControllerRef.current = createAmbientAudio(() => ({
      gameStarted: gameStartedRef.current,
      winShown: winShownRef.current,
      deathShown: deathShownRef.current,
      monsters: monstersRef.current,
      player: playerRef.current,
    }))
  }, [updateUi])

  const restart = useCallback(() => {
    generateMap()
  }, [generateMap])

  return {
    canvasRef,
    ui,
    startGame,
    restart,
  }
}
