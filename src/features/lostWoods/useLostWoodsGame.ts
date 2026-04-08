import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BUILDING_DOOR_X,
  BUILDING_DOOR_Y,
  KEY_MIN_SPACING_STEPS,
  MAP_H,
  MAP_W,
  MONSTER_COUNT,
  MONSTER_MIN_SPAWN_DIST_FROM_PLAYER,
  MONSTER_TYPES,
  PLAYER_LIFE_COUNT,
  SPELL_COOLDOWN_MS,
  SPELL_RADIUS,
  SPELL_RESPAWN_MAX_DIST,
  SPELL_RESPAWN_MIN_DIST,
  SPAWN_PROTECTION_DURATION_MS,
  SPAWN_PROTECTION_MIN_MONSTER_DIST,
  TILE,
  TOTAL_KEYS,
} from './constants'
import { createAmbientAudio, type AudioController } from './audio'
import type { GameUiState, KeyItem, Monster, Particle, Player, TileType, TreeData } from './types'

const initialUiState: GameUiState = {
  collectedKeys: 0,
  totalKeys: TOTAL_KEYS,
  lives: PLAYER_LIFE_COUNT,
  totalLives: PLAYER_LIFE_COUNT,
  stamina: 100,
  spellReady: true,
  spellCooldownPercent: 100,
  spellCooldownSeconds: 0,
  firstLoadVisible: true,
  mainMenuVisible: false,
  currentMenuScreen: 'main',
  paused: false,
  jumpscareVisible: false,
  winVisible: false,
  deathVisible: false,
  hintVisible: false,
  introVisible: false,
}

const randomInt = (maxExclusive: number): number => Math.floor(Math.random() * maxExclusive)
const MINIMAP_MARGIN = 16
const MINIMAP_TOP_MARGIN = 28
const MINIMAP_MAX_SIZE = 210
const MINIMAP_RESERVED_CORNER_TILES = Math.ceil((MINIMAP_MAX_SIZE + 30) / TILE)
const MENU_MUSIC_VOLUME = 0.58
const MENU_MUSIC_CROSSFADE_SECONDS = 1.2
const MENU_MUSIC_CROSSFADE_STEP_MS = 50
const MENU_MUSIC_LOOP_CHECK_MS = 140

const shuffle = <T,>(values: T[]): T[] => {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const temp = values[i]
    values[i] = values[j]
    values[j] = temp
  }
  return values
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))
const isInMinimapReservedCorner = (x: number, y: number): boolean =>
  x >= MAP_W - 1 - MINIMAP_RESERVED_CORNER_TILES && y <= MINIMAP_RESERVED_CORNER_TILES

export function useLostWoodsGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ui, setUi] = useState<GameUiState>(initialUiState)
  const [isMuted, setIsMuted] = useState(false)

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
  const winShownRef = useRef(false)
  const deathShownRef = useRef(false)
  const spawnProtectionTimerRef = useRef(0)
  const flashRadiusRef = useRef(140)
  const hintTimerRef = useRef(4000)
  const screenFlashRef = useRef(0)
  const lightningFlashRef = useRef(0)
  const spellCooldownMsRef = useRef(0)
  const playerWalkCycleRef = useRef(0)
  const playerMovingRef = useRef(false)

  const dimensionsRef = useRef({ width: 0, height: 0 })
  const audioControllerRef = useRef<AudioController | null>(null)
  const menuAudioRef = useRef<HTMLAudioElement | null>(null)
  const menuAudioSwapRef = useRef<HTMLAudioElement | null>(null)
  const clickAudioRef = useRef<HTMLAudioElement | null>(null)
  const menuLoopTimerRef = useRef<number | null>(null)
  const menuCrossfadeTimerRef = useRef<number | null>(null)
  const menuCrossfadingRef = useRef(false)
  const mutedRef = useRef(false)
  const pausedRef = useRef(false)

  const updateUi = useCallback((patch: Partial<GameUiState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch }
      uiRef.current = next
      return next
    })
  }, [])

  const resetPlayerToSpawn = useCallback(() => {
    playerRef.current = {
      x: 3 * TILE + TILE / 2,
      y: 3 * TILE + TILE / 2,
      angle: 0,
      stamina: 100,
      speed: 2.3,
    }
  }, [])

  const menuTargetVolume = useCallback((): number => (mutedRef.current ? 0 : MENU_MUSIC_VOLUME), [])

  const clearMenuTimers = useCallback(() => {
    if (menuLoopTimerRef.current !== null) {
      window.clearInterval(menuLoopTimerRef.current)
      menuLoopTimerRef.current = null
    }
    if (menuCrossfadeTimerRef.current !== null) {
      window.clearInterval(menuCrossfadeTimerRef.current)
      menuCrossfadeTimerRef.current = null
    }
  }, [])

  const ensureMenuAudios = useCallback(() => {
    if (!menuAudioRef.current) {
      const menuAudio = new Audio('/creepy_piano.mp3')
      menuAudio.loop = false
      menuAudio.preload = 'auto'
      menuAudioRef.current = menuAudio
    }

    if (!menuAudioSwapRef.current) {
      const swapAudio = new Audio('/creepy_piano.mp3')
      swapAudio.loop = false
      swapAudio.preload = 'auto'
      menuAudioSwapRef.current = swapAudio
    }
  }, [])

  const ensureClickAudio = useCallback(() => {
    if (!clickAudioRef.current) {
      const clickAudio = new Audio('/click.mp3')
      clickAudio.preload = 'auto'
      clickAudio.volume = 0.8
      clickAudioRef.current = clickAudio
    }
  }, [])

  const playUiClick = useCallback(
    (ignoreMute = false) => {
      ensureClickAudio()

      if (!ignoreMute && mutedRef.current) {
        return
      }

      const clickAudio = clickAudioRef.current
      if (!clickAudio) {
        return
      }

      clickAudio.pause()
      clickAudio.currentTime = 0
      void clickAudio.play().catch(() => {
        // Ignore browser playback errors (for example if interaction policy blocks audio).
      })
    },
    [ensureClickAudio],
  )

  const playMenuMusic = useCallback(() => {
    ensureMenuAudios()

    if (!menuAudioRef.current || !menuAudioSwapRef.current) {
      return
    }

    clearMenuTimers()
    menuCrossfadingRef.current = false

    menuAudioRef.current.volume = menuTargetVolume()
    menuAudioSwapRef.current.volume = 0
    menuAudioSwapRef.current.pause()
    menuAudioSwapRef.current.currentTime = 0

    void menuAudioRef.current.play().catch(() => {
      // Ignore autoplay rejections until user interaction occurs.
    })

    menuLoopTimerRef.current = window.setInterval(() => {
      const active = menuAudioRef.current
      const standby = menuAudioSwapRef.current
      if (!active || !standby || menuCrossfadingRef.current) {
        return
      }

      if (!Number.isFinite(active.duration) || active.duration <= 0 || active.paused) {
        return
      }

      const timeLeft = active.duration - active.currentTime
      if (timeLeft > MENU_MUSIC_CROSSFADE_SECONDS) {
        return
      }

      menuCrossfadingRef.current = true
      standby.currentTime = 0
      standby.volume = 0
      void standby.play().catch(() => {
        menuCrossfadingRef.current = false
      })

      const steps = Math.max(1, Math.floor((MENU_MUSIC_CROSSFADE_SECONDS * 1000) / MENU_MUSIC_CROSSFADE_STEP_MS))
      let step = 0

      menuCrossfadeTimerRef.current = window.setInterval(() => {
        step += 1
        const mix = Math.min(1, step / steps)
        const target = menuTargetVolume()
        if (menuAudioRef.current && menuAudioSwapRef.current) {
          menuAudioRef.current.volume = target * (1 - mix)
          menuAudioSwapRef.current.volume = target * mix
        }

        if (mix < 1) {
          return
        }

        if (menuCrossfadeTimerRef.current !== null) {
          window.clearInterval(menuCrossfadeTimerRef.current)
          menuCrossfadeTimerRef.current = null
        }

        const finished = menuAudioRef.current
        menuAudioRef.current = menuAudioSwapRef.current
        menuAudioSwapRef.current = finished

        if (menuAudioSwapRef.current) {
          menuAudioSwapRef.current.pause()
          menuAudioSwapRef.current.currentTime = 0
          menuAudioSwapRef.current.volume = 0
        }

        if (menuAudioRef.current) {
          menuAudioRef.current.volume = menuTargetVolume()
        }

        menuCrossfadingRef.current = false
      }, MENU_MUSIC_CROSSFADE_STEP_MS)
    }, MENU_MUSIC_LOOP_CHECK_MS)
  }, [clearMenuTimers, ensureMenuAudios, menuTargetVolume])

  const stopMenuMusic = useCallback((resetToStart = false) => {
    clearMenuTimers()
    menuCrossfadingRef.current = false

    if (menuAudioRef.current) {
      menuAudioRef.current.pause()
      if (resetToStart) {
        menuAudioRef.current.currentTime = 0
      }
      menuAudioRef.current.volume = menuTargetVolume()
    }

    if (menuAudioSwapRef.current) {
      menuAudioSwapRef.current.pause()
      if (resetToStart) {
        menuAudioSwapRef.current.currentTime = 0
      }
      menuAudioSwapRef.current.volume = 0
    }
  }, [clearMenuTimers, menuTargetVolume])

  const startAmbientAudio = useCallback(() => {
    if (audioControllerRef.current) {
      return
    }

    audioControllerRef.current = createAmbientAudio(
      () => ({
        gameStarted: gameStartedRef.current,
        winShown: winShownRef.current,
        deathShown: deathShownRef.current,
        monsters: monstersRef.current,
        player: playerRef.current,
      }),
      mutedRef.current,
    )
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

    for (let y = 1; y < MAP_H - 1; y += 1) {
      for (let x = 1; x < MAP_W - 1; x += 1) {
        if (isInMinimapReservedCorner(x, y)) {
          map[y][x] = 2
        }
      }
    }

    map[BUILDING_DOOR_Y][BUILDING_DOOR_X] = 3
    for (let dy = 1; dy <= 3; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const px = BUILDING_DOOR_X + dx
        const py = BUILDING_DOOR_Y + dy
        if (px > 0 && px < MAP_W - 1 && py > 0 && py < MAP_H - 1 && !isInMinimapReservedCorner(px, py)) {
          map[py][px] = 0
        }
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
    const allReachable: Array<[number, number]> = []
    for (let y = 1; y < MAP_H - 1; y += 1) {
      for (let x = 1; x < MAP_W - 1; x += 1) {
        if (reachable[y][x]) {
          allReachable.push([x, y])
        }
      }
    }

    const occupied = new Set<string>()
    const canPlaceKey = (x: number, y: number, minSpacingTiles: number): boolean =>
      keyItems.every((key) => Math.hypot(key.x - x, key.y - y) >= minSpacingTiles)

    const placeFromCandidates = (candidates: Array<[number, number]>, minSpacingTiles: number): void => {
      for (const [kx, ky] of candidates) {
        if (keyItems.length >= TOTAL_KEYS) {
          return
        }

        const id = `${kx},${ky}`
        if (occupied.has(id) || !canPlaceKey(kx, ky, minSpacingTiles)) {
          continue
        }

        keyItems.push({ x: kx, y: ky, collected: false, bob: Math.random() * Math.PI * 2 })
        occupied.add(id)
      }
    }

    KEY_MIN_SPACING_STEPS.forEach((minSpacingTiles) => {
      if (keyItems.length >= TOTAL_KEYS) {
        return
      }
      placeFromCandidates(orderedCandidates, minSpacingTiles)
      placeFromCandidates(shuffle([...allReachable]), minSpacingTiles)
    })

    // Safety net: if spacing constraints cannot produce enough keys, fill any free reachable floor tile.
    if (keyItems.length < TOTAL_KEYS) {
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
    const spawnTileX = 3
    const spawnTileY = 3
    const randomReachable = shuffle([...allReachable])
    const monsterCandidates = [...randomReachable]
      .filter(([x, y]) => Math.hypot(x - spawnTileX, y - spawnTileY) >= MONSTER_MIN_SPAWN_DIST_FROM_PLAYER)

    for (let i = 0; i < MONSTER_COUNT; i += 1) {
      const fallback = randomReachable[i % randomReachable.length] ?? [spawnTileX, spawnTileY]
      const [mx, my] = monsterCandidates[i] ?? fallback

      monsters.push({
        x: mx * TILE + TILE / 2,
        y: my * TILE + TILE / 2,
        speed: 0.55 + Math.random() * 0.45,
        alertR: 160 + Math.random() * 80,
        state: 'idle',
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: 0,
        kind: MONSTER_TYPES[i % MONSTER_TYPES.length],
        phase: Math.random() * Math.PI * 2,
      })
    }

    mapRef.current = map
    treeDataRef.current = treeData
    keyItemsRef.current = keyItems
    monstersRef.current = monsters
    particlesRef.current = []

    resetPlayerToSpawn()

    gameStartedRef.current = false
    jumpscareActiveRef.current = false
    jumpscareTimerRef.current = 0
    winShownRef.current = false
    deathShownRef.current = false
    spawnProtectionTimerRef.current = SPAWN_PROTECTION_DURATION_MS
    flashRadiusRef.current = 140
    hintTimerRef.current = 4000
    screenFlashRef.current = 0
    lightningFlashRef.current = 0
    lastTimeRef.current = 0
    spellCooldownMsRef.current = 0
    playerWalkCycleRef.current = 0
    playerMovingRef.current = false

    updateUi({
      collectedKeys: 0,
      lives: PLAYER_LIFE_COUNT,
      totalLives: PLAYER_LIFE_COUNT,
      stamina: 100,
      spellReady: true,
      spellCooldownPercent: 100,
      spellCooldownSeconds: 0,
      paused: false,
      jumpscareVisible: false,
      winVisible: false,
      deathVisible: false,
      hintVisible: true,
    })
  }, [resetPlayerToSpawn, updateUi])

  const solid = useCallback((wx: number, wy: number): boolean => {
    const map = mapRef.current
    const tx = Math.floor(wx / TILE)
    const ty = Math.floor(wy / TILE)

    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) {
      return true
    }

    return map[ty][tx] > 0
  }, [])

  const canOccupy = useCallback(
    (x: number, y: number, margin: number): boolean =>
      !solid(x + margin, y + margin) &&
      !solid(x + margin, y - margin) &&
      !solid(x - margin, y + margin) &&
      !solid(x - margin, y - margin),
    [solid],
  )

  const moveWithCollision = useCallback(
    (entity: { x: number; y: number }, dx: number, dy: number, margin: number) => {
      const nx = entity.x + dx
      const ny = entity.y + dy

      if (canOccupy(nx, entity.y, margin)) {
        entity.x = nx
      }

      if (canOccupy(entity.x, ny, margin)) {
        entity.y = ny
      }
    },
    [canOccupy],
  )

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      const player = playerRef.current
      moveWithCollision(player, dx, dy, 15)
    },
    [moveWithCollision],
  )

  const projectToWalkable = useCallback((wx: number, wy: number): { x: number; y: number } => {
    const map = mapRef.current
    if (!map.length) {
      return { x: 3 * TILE + TILE / 2, y: 3 * TILE + TILE / 2 }
    }

    const tx = clamp(Math.floor(wx / TILE), 1, MAP_W - 2)
    const ty = clamp(Math.floor(wy / TILE), 1, MAP_H - 2)

    if (map[ty][tx] === 0) {
      return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }
    }

    for (let r = 1; r <= 12; r += 1) {
      for (let oy = -r; oy <= r; oy += 1) {
        for (let ox = -r; ox <= r; ox += 1) {
          if (Math.abs(ox) !== r && Math.abs(oy) !== r) {
            continue
          }
          const nx = tx + ox
          const ny = ty + oy
          if (nx < 1 || ny < 1 || nx >= MAP_W - 1 || ny >= MAP_H - 1) {
            continue
          }
          if (map[ny][nx] === 0) {
            return { x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2 }
          }
        }
      }
    }

    return { x: 3 * TILE + TILE / 2, y: 3 * TILE + TILE / 2 }
  }, [])

  const triggerJumpscare = useCallback(() => {
    if (jumpscareActiveRef.current || winShownRef.current || deathShownRef.current || spawnProtectionTimerRef.current > 0) {
      return
    }

    const remainingLives = Math.max(0, uiRef.current.lives - 1)
    jumpscareActiveRef.current = true
    jumpscareTimerRef.current = 0
    screenFlashRef.current = 1
    audioControllerRef.current?.playJumpscare()

    updateUi({ jumpscareVisible: true, lives: remainingLives })
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

  const updateSpellCooldownUi = useCallback(() => {
    const remainingMs = Math.max(0, spellCooldownMsRef.current)
    const ready = remainingMs <= 0
    const cooldownPercent = ready ? 100 : Math.round(((SPELL_COOLDOWN_MS - remainingMs) / SPELL_COOLDOWN_MS) * 100)
    const cooldownSeconds = ready ? 0 : Math.ceil(remainingMs / 1000)

    if (
      uiRef.current.spellReady !== ready ||
      uiRef.current.spellCooldownPercent !== cooldownPercent ||
      uiRef.current.spellCooldownSeconds !== cooldownSeconds
    ) {
      updateUi({
        spellReady: ready,
        spellCooldownPercent: cooldownPercent,
        spellCooldownSeconds: cooldownSeconds,
      })
    }
  }, [updateUi])

  const pushMonstersAwayFromPlayer = useCallback(
    (minDistance: number, maxDistance: number = minDistance * 1.8) => {
      const player = playerRef.current
      const maxRange = Math.max(minDistance + 40, maxDistance)

      monstersRef.current.forEach((monster) => {
        const currentDist = Math.hypot(monster.x - player.x, monster.y - player.y)
        if (currentDist >= minDistance) {
          return
        }

        let bestX = monster.x
        let bestY = monster.y
        let bestDist = currentDist

        for (let attempt = 0; attempt < 12; attempt += 1) {
          const angle = Math.random() * Math.PI * 2
          const distance = minDistance + Math.random() * (maxRange - minDistance)
          const targetX = player.x + Math.cos(angle) * distance
          const targetY = player.y + Math.sin(angle) * distance
          const projected = projectToWalkable(targetX, targetY)
          const projectedDist = Math.hypot(projected.x - player.x, projected.y - player.y)

          if (projectedDist > bestDist) {
            bestX = projected.x
            bestY = projected.y
            bestDist = projectedDist
          }

          if (projectedDist >= minDistance) {
            break
          }
        }

        monster.x = bestX
        monster.y = bestY
        monster.state = 'idle'
        monster.wanderTimer = 0
      })
    },
    [projectToWalkable],
  )

  const castSpell = useCallback(() => {
    if (
      !gameStartedRef.current ||
      spellCooldownMsRef.current > 0 ||
      jumpscareActiveRef.current ||
      winShownRef.current ||
      deathShownRef.current
    ) {
      return
    }

    const player = playerRef.current
    monstersRef.current.forEach((monster) => {
      const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
      if (dist > SPELL_RADIUS) {
        return
      }

      spawnCollectParticles(monster.x, monster.y)

      let nextX = monster.x
      let nextY = monster.y
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const angle = Math.random() * Math.PI * 2
        const distance = SPELL_RESPAWN_MIN_DIST + Math.random() * (SPELL_RESPAWN_MAX_DIST - SPELL_RESPAWN_MIN_DIST)
        const targetX = player.x + Math.cos(angle) * distance
        const targetY = player.y + Math.sin(angle) * distance
        const projected = projectToWalkable(targetX, targetY)

        if (Math.hypot(projected.x - player.x, projected.y - player.y) >= SPELL_RESPAWN_MIN_DIST * 0.9) {
          nextX = projected.x
          nextY = projected.y
          break
        }
      }

      monster.x = nextX
      monster.y = nextY
      monster.state = 'idle'
      monster.wanderTimer = 0
      monster.wanderAngle = Math.random() * Math.PI * 2
    })

    lightningFlashRef.current = 1
    audioControllerRef.current?.playSpellCast()
    spellCooldownMsRef.current = SPELL_COOLDOWN_MS
    updateSpellCooldownUi()
  }, [projectToWalkable, spawnCollectParticles, updateSpellCooldownUi])

  const updateMonsters = useCallback(
    (dt: number) => {
      const monsters = monstersRef.current
      const player = playerRef.current

      monsters.forEach((monster) => {
        const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
        const monsterMargin = 15
        monster.wanderTimer -= dt

        if (dist < monster.alertR) {
          monster.state = 'chase'
          const angle = Math.atan2(player.y - monster.y, player.x - monster.x)
          const speed = monster.speed * (1 + (1 - dist / monster.alertR) * 2)
          moveWithCollision(monster, Math.cos(angle) * speed, Math.sin(angle) * speed, monsterMargin)
        } else {
          monster.state = 'idle'
          if (monster.wanderTimer <= 0) {
            monster.wanderAngle += (Math.random() - 0.5) * 1.8
            monster.wanderTimer = 80 + Math.random() * 140
          }
          const prevX = monster.x
          const prevY = monster.y
          moveWithCollision(monster, Math.cos(monster.wanderAngle) * 0.45, Math.sin(monster.wanderAngle) * 0.45, monsterMargin)
          if (monster.x === prevX && monster.y === prevY) {
            monster.wanderAngle += Math.PI * (0.5 + Math.random())
          }
        }

        // During spawn protection, force a safe radius around the player.
        const postMoveDist = Math.hypot(monster.x - player.x, monster.y - player.y)
        if (spawnProtectionTimerRef.current > 0 && postMoveDist < SPAWN_PROTECTION_MIN_MONSTER_DIST) {
          const angle = Math.atan2(monster.y - player.y, monster.x - player.x) || Math.random() * Math.PI * 2
          const targetX = player.x + Math.cos(angle) * SPAWN_PROTECTION_MIN_MONSTER_DIST
          const targetY = player.y + Math.sin(angle) * SPAWN_PROTECTION_MIN_MONSTER_DIST
          const projected = projectToWalkable(targetX, targetY)

          if (Math.hypot(projected.x - player.x, projected.y - player.y) > postMoveDist) {
            monster.x = projected.x
            monster.y = projected.y
            monster.state = 'idle'
          }
        }

        if (postMoveDist < 20) {
          triggerJumpscare()
        }
      })
    },
    [moveWithCollision, projectToWalkable, triggerJumpscare],
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

  const drawLockedDoor = useCallback((ctx: CanvasRenderingContext2D, sx: number, sy: number) => {
    ctx.save()

    ctx.fillStyle = '#090d07'
    ctx.fillRect(sx, sy, TILE, TILE)

    ctx.fillStyle = '#17120d'
    ctx.fillRect(sx + 4, sy + 2, TILE - 8, TILE - 4)

    ctx.fillStyle = '#2f241b'
    ctx.fillRect(sx + 9, sy + 4, TILE - 18, TILE - 8)

    ctx.fillStyle = '#4b3828'
    for (let i = 0; i < 4; i += 1) {
      const plankX = sx + 11 + i * 8
      ctx.fillRect(plankX, sy + 6, 6, TILE - 12)
    }

    ctx.fillStyle = '#241a13'
    ctx.fillRect(sx + 12, sy + 14, TILE - 24, 5)
    ctx.fillRect(sx + 10, sy + 31, TILE - 20, 5)

    ctx.strokeStyle = '#7d674f'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(sx + 14, sy + 22)
    ctx.lineTo(sx + TILE / 2, sy + 16)
    ctx.lineTo(sx + TILE - 14, sy + 24)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(sx + 14, sy + 26)
    ctx.lineTo(sx + TILE / 2, sy + 32)
    ctx.lineTo(sx + TILE - 14, sy + 24)
    ctx.stroke()

    ctx.fillStyle = '#98733d'
    ctx.fillRect(sx + TILE / 2 - 5, sy + 20, 10, 12)
    ctx.fillStyle = '#3a260d'
    ctx.fillRect(sx + TILE / 2 - 2, sy + 24, 4, 8)

    ctx.fillStyle = '#1d130d'
    ctx.fillRect(sx + 7, sy + TILE - 6, TILE - 14, 4)

    ctx.strokeStyle = 'rgba(12, 18, 8, 0.6)'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i += 1) {
      const grooveX = sx + 17 + i * 8
      ctx.beginPath()
      ctx.moveTo(grooveX, sy + 7)
      ctx.lineTo(grooveX, sy + TILE - 7)
      ctx.stroke()
    }

    ctx.fillStyle = 'rgba(110, 150, 70, 0.16)'
    ctx.fillRect(sx + 9, sy + 5, TILE - 18, 6)

    ctx.restore()
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
        } else if (map[ty][tx] === 3) {
          drawLockedDoor(ctx, sx, sy)
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
        if (map[ty][tx] > 0 && map[ty][tx] !== 3) {
          const sx = tx * TILE - camX
          const sy = ty * TILE - camY
          drawTree(ctx, sx, sy, treeData[ty][tx])
        }
      }
    }
  }, [drawGround, drawLockedDoor, drawTree])

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
      const pulse = 1 + Math.sin(tickRef.current * 0.08 + monster.phase) * 0.06

      ctx.save()
      ctx.globalAlpha = alpha * 0.92
      ctx.translate(sx, sy + bob)
      ctx.scale(pulse, pulse)

      if (monster.state === 'chase') {
        ctx.shadowColor = '#ff2000'
        ctx.shadowBlur = 20
      }

      if (monster.kind === 'stalker') {
        ctx.fillStyle = '#111'
        ctx.beginPath()
        ctx.ellipse(0, 0, 13, 16, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#d6d2c8'
        ctx.beginPath()
        ctx.arc(0, -1, 9.5, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#140b08'
        ctx.beginPath()
        ctx.arc(-3, -2, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(3, -2, 2, 0, Math.PI * 2)
        ctx.fill()
      } else if (monster.kind === 'spider') {
        ctx.strokeStyle = '#120909'
        ctx.lineWidth = 2.3
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath()
          ctx.moveTo(i * 4, -4)
          ctx.lineTo(i * 14, -10)
          ctx.lineTo(i * 20, -6)
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(i * 4, -1)
          ctx.lineTo(i * 16, -2)
          ctx.lineTo(i * 22, 3)
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(i * 4, 2)
          ctx.lineTo(i * 15, 7)
          ctx.lineTo(i * 20, 12)
          ctx.stroke()

          ctx.beginPath()
          ctx.moveTo(i * 2, 5)
          ctx.lineTo(i * 12, 13)
          ctx.lineTo(i * 15, 18)
          ctx.stroke()
        }

        ctx.fillStyle = '#090506'
        ctx.beginPath()
        ctx.ellipse(0, 3, 10, 12, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(0, -6, 7, 7, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#d83d2d'
        ctx.beginPath()
        ctx.arc(-2.5, -8, 1.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(2.5, -8, 1.2, 0, Math.PI * 2)
        ctx.fill()
      } else if (monster.kind === 'skull') {
        ctx.fillStyle = '#d7d2c7'
        ctx.beginPath()
        ctx.arc(0, -3, 10.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(-8, 2, 16, 10)

        ctx.fillStyle = '#19110f'
        ctx.beginPath()
        ctx.ellipse(-3.5, -4.5, 2.6, 3.2, -0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(3.5, -4.5, 2.6, 3.2, 0.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(0, -0.5)
        ctx.lineTo(-2, 2.5)
        ctx.lineTo(2, 2.5)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = '#1a1210'
        ctx.lineWidth = 1.2
        for (let i = -5; i <= 5; i += 2) {
          ctx.beginPath()
          ctx.moveTo(i, 6)
          ctx.lineTo(i, 10)
          ctx.stroke()
        }
      } else if (monster.kind === 'wraith') {
        const cloak = ctx.createLinearGradient(0, -18, 0, 20)
        cloak.addColorStop(0, '#d9e2df')
        cloak.addColorStop(0.5, '#9fb1ad')
        cloak.addColorStop(1, '#475653')
        ctx.fillStyle = cloak

        ctx.beginPath()
        ctx.moveTo(0, -18)
        ctx.quadraticCurveTo(12, -12, 11, 2)
        ctx.quadraticCurveTo(10, 9, 14, 15)
        ctx.quadraticCurveTo(6, 12, 3, 17)
        ctx.quadraticCurveTo(0, 10, -3, 17)
        ctx.quadraticCurveTo(-6, 12, -14, 15)
        ctx.quadraticCurveTo(-10, 9, -11, 2)
        ctx.quadraticCurveTo(-12, -12, 0, -18)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#091112'
        ctx.beginPath()
        ctx.arc(-3, -6, 1.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(3, -6, 1.8, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = '#1a1412'
        ctx.beginPath()
        ctx.ellipse(0, 3, 13, 9, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#2c1d16'
        ctx.beginPath()
        ctx.ellipse(0, -4, 10, 8, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#a18a72'
        ctx.beginPath()
        ctx.moveTo(-8, -8)
        ctx.lineTo(-14, -14)
        ctx.lineTo(-5, -11)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(8, -8)
        ctx.lineTo(14, -14)
        ctx.lineTo(5, -11)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#e0493b'
        ctx.beginPath()
        ctx.arc(-3, -4, 1.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(3, -4, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }

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

    const legBob = playerMovingRef.current ? Math.sin(playerWalkCycleRef.current) * 4 : 0
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
    const panelY = MINIMAP_TOP_MARGIN
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
        ctx.fillStyle = map[y][x] === 0 ? '#153016' : map[y][x] === 3 ? '#5a4224' : '#061006'
        ctx.fillRect(x * TILE * scale, y * TILE * scale, Math.max(1, TILE * scale), Math.max(1, TILE * scale))
      }
    }

    const doorSize = Math.max(4, TILE * scale * 0.55)
    const doorX = BUILDING_DOOR_X * TILE * scale + (TILE * scale - doorSize) / 2
    const doorY = BUILDING_DOOR_Y * TILE * scale + (TILE * scale - doorSize) / 2
    ctx.fillStyle = '#00ff66'
    ctx.fillRect(doorX, doorY, doorSize, doorSize)

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

    if (lightningFlashRef.current > 0) {
      const alpha = Math.min(1, lightningFlashRef.current)
      ctx.fillStyle = `rgba(205,230,255,${alpha * 0.5})`
      ctx.fillRect(0, 0, width, height)

      const skyPulse = ctx.createRadialGradient(width / 2, height * 0.2, 20, width / 2, height * 0.2, Math.max(width, height))
      skyPulse.addColorStop(0, `rgba(235,245,255,${alpha * 0.35})`)
      skyPulse.addColorStop(1, 'rgba(200,220,255,0)')
      ctx.fillStyle = skyPulse
      ctx.fillRect(0, 0, width, height)

      lightningFlashRef.current = Math.max(0, lightningFlashRef.current - 0.16)
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

      if (spellCooldownMsRef.current > 0) {
        spellCooldownMsRef.current = Math.max(0, spellCooldownMsRef.current - dt)
        updateSpellCooldownUi()
      }

      if (spawnProtectionTimerRef.current > 0) {
        spawnProtectionTimerRef.current = Math.max(0, spawnProtectionTimerRef.current - dt)
      }

      if (jumpscareActiveRef.current) {
        jumpscareTimerRef.current += dt
        if (jumpscareTimerRef.current > 900) {
          jumpscareActiveRef.current = false
          if (uiRef.current.lives <= 0) {
            deathShownRef.current = true
            audioControllerRef.current?.stop()
            audioControllerRef.current = null
            playMenuMusic()
            updateUi({ jumpscareVisible: false, deathVisible: true })
          } else {
            resetPlayerToSpawn()
            spawnProtectionTimerRef.current = SPAWN_PROTECTION_DURATION_MS
            pushMonstersAwayFromPlayer(SPAWN_PROTECTION_MIN_MONSTER_DIST * 1.8, SPELL_RESPAWN_MAX_DIST)
            updateUi({ jumpscareVisible: false, stamina: 100 })
          }
        }
        return
      }

      if (winShownRef.current || deathShownRef.current) {
        return
      }

      if (pausedRef.current) {
        renderFrame(ctx)
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
        playerMovingRef.current = true
        playerWalkCycleRef.current += running ? 0.42 : 0.28
        if (running) {
          player.stamina = Math.max(0, player.stamina - dt * 0.09)
        }
      } else {
        playerMovingRef.current = false
        player.stamina = Math.min(100, player.stamina + dt * 0.035)
      }

      const staminaUiValue = Math.round(player.stamina * 10) / 10
      if (staminaUiValue !== uiRef.current.stamina) {
        updateUi({ stamina: staminaUiValue })
      }

      const { width, height } = dimensionsRef.current
      const camX = Math.max(0, Math.min(MAP_W * TILE - width, player.x - width / 2))
      const camY = Math.max(0, Math.min(MAP_H * TILE - height, player.y - height / 2))
      cameraRef.current = { x: camX, y: camY }

      const doorCenterX = BUILDING_DOOR_X * TILE + TILE / 2
      const doorCenterY = BUILDING_DOOR_Y * TILE + TILE / 2
      if (hintTimerRef.current > 0) {
        hintTimerRef.current = Math.max(0, hintTimerRef.current - dt)
      }
      const timedHintVisible = hintTimerRef.current > 0
      const nearLockedDoor =
        uiRef.current.collectedKeys < TOTAL_KEYS && Math.hypot(doorCenterX - player.x, doorCenterY - player.y) < TILE * 2.35
      const hintVisible = timedHintVisible || nearLockedDoor
      if (uiRef.current.hintVisible !== hintVisible) {
        updateUi({ hintVisible })
      }

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

      updateMonsters(dt)
      updateParticles(dt)
      renderFrame(ctx)
    },
    [movePlayer, playMenuMusic, pushMonstersAwayFromPlayer, renderFrame, resetPlayerToSpawn, spawnCollectParticles, updateMonsters, updateParticles, updateSpellCooldownUi, updateUi],
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
      if (!event.repeat && event.key === 'Escape') {
        if (
          gameStartedRef.current &&
          !winShownRef.current &&
          !deathShownRef.current &&
          !jumpscareActiveRef.current &&
          !uiRef.current.mainMenuVisible &&
          !uiRef.current.firstLoadVisible
        ) {
          const nextPaused = !pausedRef.current
          pausedRef.current = nextPaused

          if (nextPaused) {
            heldRef.current = {}
            audioControllerRef.current?.stop()
            audioControllerRef.current = null
            playMenuMusic()
          } else {
            stopMenuMusic()
            audioControllerRef.current = createAmbientAudio(
              () => ({
                gameStarted: gameStartedRef.current,
                winShown: winShownRef.current,
                deathShown: deathShownRef.current,
                monsters: monstersRef.current,
                player: playerRef.current,
              }),
              mutedRef.current,
            )
          }

          lastTimeRef.current = performance.now()
          updateUi({ paused: nextPaused })
        }
        event.preventDefault()
        return
      }

      if (pausedRef.current) {
        return
      }

      heldRef.current[event.key] = true
      if (!event.repeat && (event.key === 'e' || event.key === 'E' || event.key === ' ')) {
        castSpell()
      }
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
      stopMenuMusic()
      clickAudioRef.current?.pause()
      clickAudioRef.current = null
      menuAudioRef.current = null
      menuAudioSwapRef.current = null
    }
  }, [castSpell, generateMap, loop, playMenuMusic, stopMenuMusic, updateUi])

  const startGame = useCallback(() => {
    if (gameStartedRef.current || uiRef.current.firstLoadVisible) {
      return
    }

    playUiClick()
    stopMenuMusic()
    startAmbientAudio()
    updateUi({ mainMenuVisible: false, introVisible: true })
  }, [playUiClick, startAmbientAudio, stopMenuMusic, updateUi])

  const finishIntro = useCallback(() => {
    gameStartedRef.current = true
    pausedRef.current = false
    heldRef.current = {}
    lastTimeRef.current = performance.now()
    hintTimerRef.current = 4000
    updateUi({ introVisible: false, paused: false, hintVisible: true })

    startAmbientAudio()
  }, [startAmbientAudio, updateUi])

  const openMainMenu = useCallback(() => {
    gameStartedRef.current = false
    pausedRef.current = false
    heldRef.current = {}
    lastTimeRef.current = 0
    jumpscareActiveRef.current = false
    jumpscareTimerRef.current = 0
    updateUi({
      firstLoadVisible: false,
      mainMenuVisible: true,
      currentMenuScreen: 'main',
      paused: false,
      lives: PLAYER_LIFE_COUNT,
      totalLives: PLAYER_LIFE_COUNT,
      jumpscareVisible: false,
      winVisible: false,
      deathVisible: false,
      hintVisible: true,
      introVisible: false,
    })

    audioControllerRef.current?.stop()
    audioControllerRef.current = null
    playMenuMusic()
  }, [playMenuMusic, updateUi])

  const enterMainMenu = useCallback(() => {
    if (!uiRef.current.firstLoadVisible) {
      return
    }
    playUiClick()
    openMainMenu()
  }, [openMainMenu, playUiClick])

  const pauseGame = useCallback(() => {
    if (
      pausedRef.current ||
      !gameStartedRef.current ||
      winShownRef.current ||
      deathShownRef.current ||
      jumpscareActiveRef.current ||
      uiRef.current.mainMenuVisible ||
      uiRef.current.firstLoadVisible
    ) {
      return
    }

    playUiClick()

    pausedRef.current = true
    heldRef.current = {}
    audioControllerRef.current?.stop()
    audioControllerRef.current = null
    playMenuMusic()
    lastTimeRef.current = performance.now()
    updateUi({ paused: true })
  }, [playMenuMusic, playUiClick, updateUi])

  const resumeGame = useCallback(() => {
    if (!pausedRef.current || !gameStartedRef.current) {
      return
    }

    playUiClick()

    stopMenuMusic()
    startAmbientAudio()

    pausedRef.current = false
    heldRef.current = {}
    lastTimeRef.current = performance.now()
    updateUi({ paused: false })
  }, [playUiClick, startAmbientAudio, stopMenuMusic, updateUi])

  const backToMainMenu = useCallback(() => {
    playUiClick()
    generateMap()
    openMainMenu()
  }, [generateMap, openMainMenu, playUiClick])

  const restart = useCallback(() => {
    playUiClick()
    generateMap()
    openMainMenu()
  }, [generateMap, openMainMenu, playUiClick])

  const toggleMute = useCallback(() => {
    playUiClick(true)
    setIsMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      audioControllerRef.current?.setMuted(next)
      if (menuAudioRef.current) {
        menuAudioRef.current.volume = next ? 0 : MENU_MUSIC_VOLUME
      }
      if (menuAudioSwapRef.current) {
        menuAudioSwapRef.current.volume = next ? 0 : MENU_MUSIC_VOLUME
      }
      return next
    })
  }, [playUiClick])

  useEffect(() => {
    mutedRef.current = isMuted
    audioControllerRef.current?.setMuted(isMuted)
    if (menuAudioRef.current) {
      menuAudioRef.current.volume = isMuted ? 0 : MENU_MUSIC_VOLUME
    }
    if (menuAudioSwapRef.current) {
      menuAudioSwapRef.current.volume = isMuted ? 0 : MENU_MUSIC_VOLUME
    }
  }, [isMuted])

  const goToControls = useCallback(() => {
    playUiClick()
    updateUi({ currentMenuScreen: 'controls' })
  }, [playUiClick, updateUi])

  const goToInfo = useCallback(() => {
    playUiClick()
    updateUi({ currentMenuScreen: 'info' })
  }, [playUiClick, updateUi])

  const goToMainMenu = useCallback(() => {
    playUiClick()
    updateUi({ currentMenuScreen: 'main' })
  }, [playUiClick, updateUi])

  return {
    canvasRef,
    ui,
    isMuted,
    toggleMute,
    enterMainMenu,
    startGame,
    finishIntro,
    pauseGame,
    resumeGame,
    backToMainMenu,
    restart,
    goToControls,
    goToInfo,
    goToMainMenu,
  }
}
