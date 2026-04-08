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
import { createBuildingSceneData, type BuildingDecor, type BuildingLight } from './buildingSceneData'
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
  deathVisible: false,
  doorUnlocked: false,
  enteringBuilding: false,
  buildingVisible: false,
  hintVisible: false,
  hintText: 'find the keys to open the door',
  introVisible: false,
  savedBabyTransitionVisible: false,
  savedBabyVisible: false,
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
const INDOOR_AMBIENT_VOLUME = 0.34
const INDOOR_AMBIENT_CROSSFADE_SECONDS = 1.35
const INDOOR_AMBIENT_CROSSFADE_STEP_MS = 50
const INDOOR_AMBIENT_LOOP_CHECK_MS = 140
const BABY_CRYING_VOLUME = 0.42
const BABY_CRYING_CROSSFADE_SECONDS = 1.5
const BABY_CRYING_CROSSFADE_STEP_MS = 50
const BABY_CRYING_LOOP_CHECK_MS = 140
const DEBUG_FORCE_BUILDING_KEY = 'b'
const BABY_CRIB_TILE = { x: 21, y: 4 }
const BABY_RESCUE_DISTANCE = TILE * 1.05
const SAVED_BABY_TRANSITION_MS = 1700

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
const normalizeHeldKey = (event: KeyboardEvent): string => {
  if (event.key === ' ') {
    return 'Space'
  }

  if (event.key.length === 1) {
    return event.key.toLowerCase()
  }

  return event.key
}

export function useLostWoodsGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ui, setUi] = useState<GameUiState>(initialUiState)
  const [isMuted, setIsMuted] = useState(false)

  const uiRef = useRef(initialUiState)
  const gameStartedRef = useRef(false)
  const mapRef = useRef<TileType[][]>([])
  const treeDataRef = useRef<TreeData[][]>([])
  const buildingDecorRef = useRef<BuildingDecor[]>([])
  const buildingLightsRef = useRef<BuildingLight[]>([])
  const buildingEntranceRef = useRef<{ x: number; y: number } | null>(null)
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
  const deathShownRef = useRef(false)
  const savedBabyRef = useRef(false)
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
  const doorUnlockAudioRef = useRef<HTMLAudioElement | null>(null)
  const indoorAmbientAudioRef = useRef<HTMLAudioElement | null>(null)
  const indoorAmbientSwapRef = useRef<HTMLAudioElement | null>(null)
  const babyCryingAudioRef = useRef<HTMLAudioElement | null>(null)
  const babyCryingSwapRef = useRef<HTMLAudioElement | null>(null)
  const menuLoopTimerRef = useRef<number | null>(null)
  const menuCrossfadeTimerRef = useRef<number | null>(null)
  const indoorAmbientLoopTimerRef = useRef<number | null>(null)
  const indoorAmbientCrossfadeTimerRef = useRef<number | null>(null)
  const babyCryingLoopTimerRef = useRef<number | null>(null)
  const babyCryingCrossfadeTimerRef = useRef<number | null>(null)
  const menuCrossfadingRef = useRef(false)
  const indoorAmbientCrossfadingRef = useRef(false)
  const babyCryingCrossfadingRef = useRef(false)
  const mutedRef = useRef(false)
  const pausedRef = useRef(false)
  const doorEntryTimerRef = useRef<number | null>(null)
  const savedBabyTransitionTimerRef = useRef<number | null>(null)
  const witchRoomAudioActiveRef = useRef(false)

  const updateUi = useCallback((patch: Partial<GameUiState>) => {
    setUi((prev) => {
      const next = { ...prev, ...patch }
      uiRef.current = next
      return next
    })
  }, [])

  const clearSavedBabyTransitionTimer = useCallback(() => {
    if (savedBabyTransitionTimerRef.current !== null) {
      window.clearTimeout(savedBabyTransitionTimerRef.current)
      savedBabyTransitionTimerRef.current = null
    }
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
  const indoorAmbientTargetVolume = useCallback((): number => (mutedRef.current ? 0 : INDOOR_AMBIENT_VOLUME), [])
  const babyCryingTargetVolume = useCallback((): number => (mutedRef.current ? 0 : BABY_CRYING_VOLUME), [])

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

  const ensureDoorUnlockAudio = useCallback(() => {
    if (!doorUnlockAudioRef.current) {
      const doorUnlockAudio = new Audio('/door_unlock.mp3')
      doorUnlockAudio.preload = 'auto'
      doorUnlockAudio.volume = 0.82
      doorUnlockAudioRef.current = doorUnlockAudio
    }
  }, [])

  const ensureIndoorAmbientAudios = useCallback(() => {
    if (!indoorAmbientAudioRef.current) {
      const ambientAudio = new Audio('/ambient_indoor.mp3')
      ambientAudio.preload = 'auto'
      indoorAmbientAudioRef.current = ambientAudio
    }

    if (!indoorAmbientSwapRef.current) {
      const ambientSwap = new Audio('/ambient_indoor.mp3')
      ambientSwap.preload = 'auto'
      indoorAmbientSwapRef.current = ambientSwap
    }
  }, [])

  const ensureBabyCryingAudios = useCallback(() => {
    if (!babyCryingAudioRef.current) {
      const babyCryingAudio = new Audio('/baby_crying.mp3')
      babyCryingAudio.preload = 'auto'
      babyCryingAudioRef.current = babyCryingAudio
    }

    if (!babyCryingSwapRef.current) {
      const babyCryingSwap = new Audio('/baby_crying.mp3')
      babyCryingSwap.preload = 'auto'
      babyCryingSwapRef.current = babyCryingSwap
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

  const playDoorUnlock = useCallback(() => {
    ensureDoorUnlockAudio()

    if (mutedRef.current) {
      return
    }

    const doorUnlockAudio = doorUnlockAudioRef.current
    if (!doorUnlockAudio) {
      return
    }

    doorUnlockAudio.pause()
    doorUnlockAudio.currentTime = 0
    void doorUnlockAudio.play().catch(() => {
      // Ignore browser playback errors (for example if interaction policy blocks audio).
    })
  }, [ensureDoorUnlockAudio])

  const clearIndoorAmbientTimers = useCallback(() => {
    if (indoorAmbientLoopTimerRef.current !== null) {
      window.clearInterval(indoorAmbientLoopTimerRef.current)
      indoorAmbientLoopTimerRef.current = null
    }
    if (indoorAmbientCrossfadeTimerRef.current !== null) {
      window.clearInterval(indoorAmbientCrossfadeTimerRef.current)
      indoorAmbientCrossfadeTimerRef.current = null
    }
  }, [])

  const clearBabyCryingTimers = useCallback(() => {
    if (babyCryingLoopTimerRef.current !== null) {
      window.clearInterval(babyCryingLoopTimerRef.current)
      babyCryingLoopTimerRef.current = null
    }
    if (babyCryingCrossfadeTimerRef.current !== null) {
      window.clearInterval(babyCryingCrossfadeTimerRef.current)
      babyCryingCrossfadeTimerRef.current = null
    }
  }, [])

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

  const startIndoorAmbient = useCallback(() => {
    ensureIndoorAmbientAudios()

    if (!indoorAmbientAudioRef.current || !indoorAmbientSwapRef.current) {
      return
    }

    clearIndoorAmbientTimers()
    indoorAmbientCrossfadingRef.current = false

    indoorAmbientAudioRef.current.volume = 0
    indoorAmbientAudioRef.current.currentTime = 0
    indoorAmbientSwapRef.current.pause()
    indoorAmbientSwapRef.current.currentTime = 0
    indoorAmbientSwapRef.current.volume = 0

    void indoorAmbientAudioRef.current.play().then(() => {
      const target = indoorAmbientTargetVolume()
      const startedAt = performance.now()
      const fadeMs = 1200

      const fadeIn = (): void => {
        const active = indoorAmbientAudioRef.current
        if (!active) {
          return
        }

        const mix = Math.min(1, (performance.now() - startedAt) / fadeMs)
        active.volume = target * mix
        if (mix < 1) {
          requestAnimationFrame(fadeIn)
        }
      }

      requestAnimationFrame(fadeIn)
    }).catch(() => {
      // Ignore autoplay rejections until user interaction occurs.
    })

    indoorAmbientLoopTimerRef.current = window.setInterval(() => {
      const active = indoorAmbientAudioRef.current
      const standby = indoorAmbientSwapRef.current
      if (!active || !standby || indoorAmbientCrossfadingRef.current) {
        return
      }

      if (!Number.isFinite(active.duration) || active.duration <= 0 || active.paused) {
        return
      }

      const timeLeft = active.duration - active.currentTime
      if (timeLeft > INDOOR_AMBIENT_CROSSFADE_SECONDS) {
        return
      }

      indoorAmbientCrossfadingRef.current = true
      standby.currentTime = 0
      standby.volume = 0
      void standby.play().catch(() => {
        indoorAmbientCrossfadingRef.current = false
      })

      const steps = Math.max(1, Math.floor((INDOOR_AMBIENT_CROSSFADE_SECONDS * 1000) / INDOOR_AMBIENT_CROSSFADE_STEP_MS))
      let step = 0

      indoorAmbientCrossfadeTimerRef.current = window.setInterval(() => {
        step += 1
        const mix = Math.min(1, step / steps)
        const target = indoorAmbientTargetVolume()
        if (indoorAmbientAudioRef.current && indoorAmbientSwapRef.current) {
          indoorAmbientAudioRef.current.volume = target * (1 - mix)
          indoorAmbientSwapRef.current.volume = target * mix
        }

        if (mix < 1) {
          return
        }

        if (indoorAmbientCrossfadeTimerRef.current !== null) {
          window.clearInterval(indoorAmbientCrossfadeTimerRef.current)
          indoorAmbientCrossfadeTimerRef.current = null
        }

        const finished = indoorAmbientAudioRef.current
        indoorAmbientAudioRef.current = indoorAmbientSwapRef.current
        indoorAmbientSwapRef.current = finished

        if (indoorAmbientSwapRef.current) {
          indoorAmbientSwapRef.current.pause()
          indoorAmbientSwapRef.current.currentTime = 0
          indoorAmbientSwapRef.current.volume = 0
        }

        if (indoorAmbientAudioRef.current) {
          indoorAmbientAudioRef.current.volume = indoorAmbientTargetVolume()
        }

        indoorAmbientCrossfadingRef.current = false
      }, INDOOR_AMBIENT_CROSSFADE_STEP_MS)
    }, INDOOR_AMBIENT_LOOP_CHECK_MS)
  }, [clearIndoorAmbientTimers, ensureIndoorAmbientAudios, indoorAmbientTargetVolume])

  const stopIndoorAmbient = useCallback((resetToStart = false) => {
    clearIndoorAmbientTimers()
    indoorAmbientCrossfadingRef.current = false

    if (indoorAmbientAudioRef.current) {
      indoorAmbientAudioRef.current.pause()
      if (resetToStart) {
        indoorAmbientAudioRef.current.currentTime = 0
      }
      indoorAmbientAudioRef.current.volume = 0
    }

    if (indoorAmbientSwapRef.current) {
      indoorAmbientSwapRef.current.pause()
      if (resetToStart) {
        indoorAmbientSwapRef.current.currentTime = 0
      }
      indoorAmbientSwapRef.current.volume = 0
    }
  }, [clearIndoorAmbientTimers])

  const beginBabyCryingCrossfade = useCallback(() => {
    const active = babyCryingAudioRef.current
    const standby = babyCryingSwapRef.current
    if (!active || !standby || babyCryingCrossfadingRef.current || !witchRoomAudioActiveRef.current) {
      return
    }

    babyCryingCrossfadingRef.current = true
    standby.currentTime = 0
    standby.volume = 0

    void standby.play().catch(() => {
      // Fallback: if the swap instance can't start, keep the active one looping.
      active.currentTime = 0
      active.volume = babyCryingTargetVolume()
      babyCryingCrossfadingRef.current = false
    })

    const steps = Math.max(1, Math.floor((BABY_CRYING_CROSSFADE_SECONDS * 1000) / BABY_CRYING_CROSSFADE_STEP_MS))
    let step = 0

    babyCryingCrossfadeTimerRef.current = window.setInterval(() => {
      step += 1
      const mix = Math.min(1, step / steps)
      const target = babyCryingTargetVolume()
      if (babyCryingAudioRef.current && babyCryingSwapRef.current) {
        babyCryingAudioRef.current.volume = target * (1 - mix)
        babyCryingSwapRef.current.volume = target * mix
      }

      if (mix < 1) {
        return
      }

      if (babyCryingCrossfadeTimerRef.current !== null) {
        window.clearInterval(babyCryingCrossfadeTimerRef.current)
        babyCryingCrossfadeTimerRef.current = null
      }

      const finished = babyCryingAudioRef.current
      babyCryingAudioRef.current = babyCryingSwapRef.current
      babyCryingSwapRef.current = finished

      if (babyCryingSwapRef.current) {
        babyCryingSwapRef.current.pause()
        babyCryingSwapRef.current.currentTime = 0
        babyCryingSwapRef.current.volume = 0
      }

      if (babyCryingAudioRef.current) {
        babyCryingAudioRef.current.volume = babyCryingTargetVolume()
      }

      babyCryingCrossfadingRef.current = false
    }, BABY_CRYING_CROSSFADE_STEP_MS)
  }, [babyCryingTargetVolume])

  const startBabyCrying = useCallback(() => {
    ensureBabyCryingAudios()

    if (!babyCryingAudioRef.current || !babyCryingSwapRef.current || witchRoomAudioActiveRef.current) {
      return
    }

    witchRoomAudioActiveRef.current = true
    clearBabyCryingTimers()
    babyCryingCrossfadingRef.current = false

    babyCryingAudioRef.current.volume = 0
    babyCryingAudioRef.current.currentTime = 0
    babyCryingSwapRef.current.pause()
    babyCryingSwapRef.current.currentTime = 0
    babyCryingSwapRef.current.volume = 0

    void babyCryingAudioRef.current.play().then(() => {
      const target = babyCryingTargetVolume()
      const startedAt = performance.now()
      const fadeMs = 1800

      const fadeIn = (): void => {
        const active = babyCryingAudioRef.current
        if (!active || !witchRoomAudioActiveRef.current) {
          return
        }

        const mix = Math.min(1, (performance.now() - startedAt) / fadeMs)
        active.volume = target * mix
        if (mix < 1) {
          requestAnimationFrame(fadeIn)
        }
      }

      requestAnimationFrame(fadeIn)
    }).catch(() => {
      witchRoomAudioActiveRef.current = false
    })

    babyCryingLoopTimerRef.current = window.setInterval(() => {
      const active = babyCryingAudioRef.current
      if (!active || babyCryingCrossfadingRef.current || !witchRoomAudioActiveRef.current) {
        return
      }

      if (active.paused) {
        if (active.currentTime > 0.05) {
          beginBabyCryingCrossfade()
        }
        return
      }

      if (!Number.isFinite(active.duration) || active.duration <= 0) {
        return
      }

      const timeLeft = active.duration - active.currentTime
      if (timeLeft > BABY_CRYING_CROSSFADE_SECONDS) {
        return
      }

      beginBabyCryingCrossfade()
    }, BABY_CRYING_LOOP_CHECK_MS)
  }, [beginBabyCryingCrossfade, babyCryingTargetVolume, clearBabyCryingTimers, ensureBabyCryingAudios])

  const stopBabyCrying = useCallback((resetToStart = false) => {
    witchRoomAudioActiveRef.current = false
    clearBabyCryingTimers()
    babyCryingCrossfadingRef.current = false

    if (babyCryingAudioRef.current) {
      babyCryingAudioRef.current.pause()
      if (resetToStart) {
        babyCryingAudioRef.current.currentTime = 0
      }
      babyCryingAudioRef.current.volume = 0
    }

    if (babyCryingSwapRef.current) {
      babyCryingSwapRef.current.pause()
      if (resetToStart) {
        babyCryingSwapRef.current.currentTime = 0
      }
      babyCryingSwapRef.current.volume = 0
    }
  }, [clearBabyCryingTimers])

  const fadeOutBabyCrying = useCallback(() => {
    const active = babyCryingAudioRef.current
    const swap = babyCryingSwapRef.current
    if (!active && !swap) {
      witchRoomAudioActiveRef.current = false
      clearBabyCryingTimers()
      babyCryingCrossfadingRef.current = false
      return
    }

    witchRoomAudioActiveRef.current = false
    clearBabyCryingTimers()
    babyCryingCrossfadingRef.current = false
    const startActiveVolume = active?.volume ?? 0
    const startSwapVolume = swap?.volume ?? 0
    const startedAt = performance.now()
    const fadeMs = 900

    const fadeOut = (): void => {
      const mix = Math.min(1, (performance.now() - startedAt) / fadeMs)
      const nextScale = 1 - mix

      if (babyCryingAudioRef.current) {
        babyCryingAudioRef.current.volume = startActiveVolume * nextScale
      }
      if (babyCryingSwapRef.current) {
        babyCryingSwapRef.current.volume = startSwapVolume * nextScale
      }

      if (mix < 1) {
        requestAnimationFrame(fadeOut)
        return
      }

      stopBabyCrying(true)
    }

    requestAnimationFrame(fadeOut)
  }, [clearBabyCryingTimers, stopBabyCrying])

  const startAmbientAudio = useCallback(() => {
    if (audioControllerRef.current) {
      return
    }

    audioControllerRef.current = createAmbientAudio(
      () => ({
        gameStarted: gameStartedRef.current,
        winShown: uiRef.current.enteringBuilding || uiRef.current.buildingVisible,
        deathShown: deathShownRef.current,
        monsters: monstersRef.current,
        player: playerRef.current,
      }),
      mutedRef.current,
    )
  }, [])

  const clearDoorEntryTimer = useCallback(() => {
    if (doorEntryTimerRef.current !== null) {
      window.clearTimeout(doorEntryTimerRef.current)
      doorEntryTimerRef.current = null
    }
  }, [])

  const loadBuildingScene = useCallback(() => {
    const building = createBuildingSceneData()
    mapRef.current = building.map as TileType[][]
    treeDataRef.current = Array.from({ length: MAP_H }, () =>
      Array.from({ length: MAP_W }, () => ({
        trunkW: 0,
        lean: 0,
        size: 0,
        layers: 0,
        dark: false,
      })),
    )
    buildingDecorRef.current = building.decor
    buildingLightsRef.current = building.lights
    buildingEntranceRef.current = building.entrance
    keyItemsRef.current = []
    monstersRef.current = []
    particlesRef.current = []
    playerRef.current = {
      x: building.entrance.x * TILE + TILE / 2,
      y: building.entrance.y * TILE + TILE / 2,
      angle: -Math.PI / 2,
      stamina: playerRef.current.stamina,
      speed: 2.3,
    }
    playerWalkCycleRef.current = 0
    playerMovingRef.current = false
    flashRadiusRef.current = 160
    savedBabyRef.current = false

    const { width, height } = dimensionsRef.current
    cameraRef.current = {
      x: Math.max(0, Math.min(MAP_W * TILE - width, playerRef.current.x - width / 2)),
      y: Math.max(0, Math.min(MAP_H * TILE - height, playerRef.current.y - height / 2)),
    }
  }, [])

  const enterBuilding = useCallback(() => {
    heldRef.current = {}
    pausedRef.current = false
    clearDoorEntryTimer()
    audioControllerRef.current?.stop(1100)
    audioControllerRef.current = null
    stopIndoorAmbient(true)
    updateUi({
      enteringBuilding: true,
      hintVisible: false,
    })

    window.setTimeout(() => {
      if (uiRef.current.enteringBuilding) {
        startIndoorAmbient()
      }
    }, 700)

    window.setTimeout(() => {
      if (!uiRef.current.enteringBuilding) {
        return
      }
      loadBuildingScene()
      gameStartedRef.current = true
      lastTimeRef.current = performance.now()
      updateUi({
        buildingVisible: true,
        hintVisible: false,
      })
    }, 925)

    doorEntryTimerRef.current = window.setTimeout(() => {
      doorEntryTimerRef.current = null
      updateUi({
        enteringBuilding: false,
        hintVisible: false,
      })
    }, 1850)
  }, [clearDoorEntryTimer, loadBuildingScene, startIndoorAmbient, stopIndoorAmbient, updateUi])

  const generateMap = useCallback(() => {
    const map: TileType[][] = []
    const treeData: TreeData[][] = []
    const carveFloor = (x: number, y: number): void => {
      if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1) {
        return
      }
      if (!isInMinimapReservedCorner(x, y)) {
        map[y][x] = 0
      }
    }

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
        carveFloor(dx, dy)
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
        carveFloor(px, py)
      }
    }

    // Guarantee a connected route from spawn to the door approach so the exit is never isolated.
    const doorApproachY = 3
    const pathMinX = Math.min(3, BUILDING_DOOR_X)
    const pathMaxX = Math.max(3, BUILDING_DOOR_X)
    for (let x = pathMinX; x <= pathMaxX; x += 1) {
      carveFloor(x, doorApproachY)
      carveFloor(x, doorApproachY - 1)
      carveFloor(x, doorApproachY + 1)
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
    buildingDecorRef.current = []
    buildingLightsRef.current = []
    buildingEntranceRef.current = null
    keyItemsRef.current = keyItems
    monstersRef.current = monsters
    particlesRef.current = []

    resetPlayerToSpawn()

    gameStartedRef.current = false
    jumpscareActiveRef.current = false
    jumpscareTimerRef.current = 0
    deathShownRef.current = false
    savedBabyRef.current = false
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
      deathVisible: false,
      doorUnlocked: false,
      enteringBuilding: false,
      buildingVisible: false,
      hintVisible: true,
      hintText: 'find the keys to open the door',
      savedBabyTransitionVisible: false,
      savedBabyVisible: false,
    })
    clearDoorEntryTimer()
    clearSavedBabyTransitionTimer()
  }, [clearDoorEntryTimer, resetPlayerToSpawn, updateUi])

  const solid = useCallback((wx: number, wy: number): boolean => {
    const map = mapRef.current
    const tx = Math.floor(wx / TILE)
    const ty = Math.floor(wy / TILE)

    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) {
      return true
    }

    if (map[ty][tx] === 3) {
      if (uiRef.current.buildingVisible) {
        return true
      }
      return !uiRef.current.doorUnlocked
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
    if (
      jumpscareActiveRef.current ||
      uiRef.current.enteringBuilding ||
      uiRef.current.buildingVisible ||
      deathShownRef.current ||
      spawnProtectionTimerRef.current > 0
    ) {
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
      uiRef.current.enteringBuilding ||
      uiRef.current.buildingVisible ||
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

  const saveBaby = useCallback(() => {
    if (
      !uiRef.current.buildingVisible ||
      uiRef.current.enteringBuilding ||
      deathShownRef.current ||
      savedBabyRef.current
    ) {
      return
    }

    const player = playerRef.current
    const cribCenterX = BABY_CRIB_TILE.x * TILE + TILE / 2
    const cribCenterY = BABY_CRIB_TILE.y * TILE + TILE / 2
    if (Math.hypot(cribCenterX - player.x, cribCenterY - player.y) > BABY_RESCUE_DISTANCE) {
      return
    }

    savedBabyRef.current = true
    gameStartedRef.current = false
    pausedRef.current = false
    heldRef.current = {}
    stopIndoorAmbient(true)
    stopBabyCrying(true)
    audioControllerRef.current?.stop()
    audioControllerRef.current = null
    playMenuMusic()
    clearSavedBabyTransitionTimer()
    updateUi({
      paused: false,
      hintVisible: false,
      deathVisible: false,
      savedBabyTransitionVisible: true,
      savedBabyVisible: false,
    })

    savedBabyTransitionTimerRef.current = window.setTimeout(() => {
      savedBabyTransitionTimerRef.current = null
      updateUi({
        savedBabyTransitionVisible: false,
        savedBabyVisible: true,
      })
    }, SAVED_BABY_TRANSITION_MS)
  }, [clearSavedBabyTransitionTimer, playMenuMusic, stopBabyCrying, stopIndoorAmbient, updateUi])

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

  const drawOpenDoor = useCallback((ctx: CanvasRenderingContext2D, sx: number, sy: number) => {
    ctx.save()

    ctx.fillStyle = '#090d07'
    ctx.fillRect(sx, sy, TILE, TILE)

    ctx.fillStyle = '#17120d'
    ctx.fillRect(sx + 4, sy + 2, TILE - 8, TILE - 4)

    ctx.fillStyle = '#2a2018'
    ctx.fillRect(sx + 8, sy + 4, TILE - 16, TILE - 8)

    ctx.fillStyle = '#010101'
    ctx.fillRect(sx + 13, sy + 7, TILE - 26, TILE - 14)

    ctx.fillStyle = '#4b3828'
    ctx.fillRect(sx + 8, sy + 4, 6, TILE - 8)
    ctx.fillRect(sx + TILE - 14, sy + 4, 6, TILE - 8)
    ctx.fillRect(sx + 10, sy + TILE - 10, TILE - 20, 6)

    ctx.fillStyle = '#70553c'
    ctx.fillRect(sx + 13, sy + 7, 4, TILE - 18)
    ctx.fillRect(sx + TILE - 17, sy + 7, 4, TILE - 18)

    ctx.fillStyle = '#6b4d2a'
    ctx.beginPath()
    ctx.arc(sx + TILE - 10, sy + TILE / 2, 2.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(210, 236, 180, 0.14)'
    ctx.beginPath()
    ctx.ellipse(sx + TILE / 2, sy + 11, 11, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }, [])

  const drawBuildingDecor = useCallback((
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    kind: BuildingDecor['kind'],
    tick: number,
  ) => {
    const pulse = (Math.sin(tick * 0.08 + sx * 0.03 + sy * 0.05) + 1) * 0.5

    switch (kind) {
      case 'lantern': {
        const lanternGlow = 0.18 + pulse * 0.16
        const lanternLight = ctx.createRadialGradient(sx + 26, sy + 21, 0, sx + 26, sy + 21, 34)
        lanternLight.addColorStop(0, `rgba(255, 212, 138, ${0.16 + pulse * 0.08})`)
        lanternLight.addColorStop(0.55, `rgba(232, 164, 84, ${0.1 + pulse * 0.05})`)
        lanternLight.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = lanternLight
        ctx.beginPath()
        ctx.arc(sx + 26, sy + 21, 34, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#2e2a28'
        ctx.fillRect(sx + 20, sy + 4, 12, 5)
        ctx.fillStyle = '#4b423c'
        ctx.fillRect(sx + 18, sy + 8, 16, 26)
        ctx.fillStyle = '#d0a15a'
        ctx.fillRect(sx + 21, sy + 12, 10, 12)
        ctx.fillStyle = `rgba(252, 220, 160, ${lanternGlow})`
        ctx.fillRect(sx + 19, sy + 26, 14, 8)
        break
      }
      case 'rug':
        ctx.fillStyle = '#4f201b'
        ctx.fillRect(sx + 6, sy + 10, TILE - 12, TILE - 20)
        ctx.strokeStyle = '#bc8d4f'
        ctx.lineWidth = 2
        ctx.strokeRect(sx + 9, sy + 13, TILE - 18, TILE - 26)
        ctx.strokeStyle = 'rgba(180, 134, 72, 0.45)'
        ctx.beginPath()
        ctx.moveTo(sx + TILE / 2, sy + 13)
        ctx.lineTo(sx + TILE / 2, sy + TILE - 13)
        ctx.moveTo(sx + 13, sy + TILE / 2)
        ctx.lineTo(sx + TILE - 13, sy + TILE / 2)
        ctx.stroke()
        break
      case 'screen':
        ctx.fillStyle = '#34302d'
        ctx.fillRect(sx + 10, sy + 6, TILE - 20, TILE - 12)
        ctx.strokeStyle = '#8f6c47'
        ctx.lineWidth = 1.5
        ctx.strokeRect(sx + 13, sy + 9, TILE - 26, TILE - 18)
        ctx.strokeStyle = 'rgba(212, 198, 166, 0.18)'
        ctx.beginPath()
        ctx.moveTo(sx + TILE / 2, sy + 10)
        ctx.lineTo(sx + TILE / 2, sy + TILE - 10)
        ctx.stroke()
        break
      case 'shelf':
        ctx.fillStyle = '#403634'
        ctx.fillRect(sx + 8, sy + 8, TILE - 16, TILE - 16)
        ctx.fillStyle = '#6f5238'
        ctx.fillRect(sx + 10, sy + 18, TILE - 20, 2)
        ctx.fillRect(sx + 10, sy + 30, TILE - 20, 2)
        ctx.fillStyle = '#9a7b4f'
        ctx.fillRect(sx + 14, sy + 12, 7, 5)
        ctx.fillRect(sx + 25, sy + 24, 6, 5)
        break
      case 'desk':
        ctx.fillStyle = '#4a3d37'
        ctx.fillRect(sx + 10, sy + 18, TILE - 20, 12)
        ctx.fillRect(sx + 13, sy + 30, 5, 10)
        ctx.fillRect(sx + TILE - 18, sy + 30, 5, 10)
        ctx.fillStyle = '#cab38d'
        ctx.fillRect(sx + 16, sy + 20, 12, 8)
        break
      case 'chest':
        ctx.fillStyle = '#49372c'
        ctx.fillRect(sx + 10, sy + 20, TILE - 20, 14)
        ctx.fillStyle = '#8b6c3a'
        ctx.fillRect(sx + 10, sy + 16, TILE - 20, 6)
        ctx.fillStyle = '#c9a558'
        ctx.fillRect(sx + 24, sy + 22, 4, 6)
        break
      case 'basin': {
        const ripple = Math.sin(tick * 0.16 + sx * 0.04) * 1.5
        const drip = (Math.sin(tick * 0.22) + 1) * 0.5
        ctx.fillStyle = '#5b5e61'
        ctx.fillRect(sx + 18, sy + 12, 16, 8)
        ctx.fillRect(sx + 22, sy + 20, 8, 18)
        ctx.fillStyle = 'rgba(88, 122, 136, 0.28)'
        ctx.beginPath()
        ctx.ellipse(sx + 26, sy + 16, 10, 4 + ripple * 0.35, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(164, 198, 212, 0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(sx + 26, sy + 16, 4 + drip * 3, 1 + drip, 0, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'incense': {
        const sway = Math.sin(tick * 0.07 + sy * 0.05) * 3
        ctx.fillStyle = '#6f6456'
        ctx.fillRect(sx + 22, sy + 24, 8, 5)
        ctx.strokeStyle = 'rgba(192, 192, 192, 0.18)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(sx + 26, sy + 24)
        ctx.bezierCurveTo(sx + 22 - sway, sy + 20, sx + 30 + sway, sy + 16, sx + 25, sy + 9)
        ctx.moveTo(sx + 27, sy + 23)
        ctx.bezierCurveTo(sx + 25 + sway, sy + 18, sx + 33 - sway, sy + 13, sx + 29, sy + 7)
        ctx.stroke()
        break
      }
      case 'symbol': {
        const symbolGlow = 0.28 + pulse * 0.22
        ctx.strokeStyle = `rgba(176, 144, 82, ${symbolGlow})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(sx + TILE / 2, sy + TILE / 2, 14, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(sx + TILE / 2, sy + 12)
        ctx.lineTo(sx + TILE / 2, sy + TILE - 12)
        ctx.moveTo(sx + 12, sy + TILE / 2)
        ctx.lineTo(sx + TILE - 12, sy + TILE / 2)
        ctx.stroke()
        ctx.fillStyle = `rgba(208, 170, 92, ${0.06 + pulse * 0.06})`
        ctx.beginPath()
        ctx.arc(sx + TILE / 2, sy + TILE / 2, 10 + pulse * 2, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'chair':
        ctx.fillStyle = '#554035'
        ctx.fillRect(sx + 14, sy + 14, TILE - 28, 10)
        ctx.fillRect(sx + 14, sy + 10, 6, 14)
        ctx.fillRect(sx + TILE - 20, sy + 10, 6, 14)
        ctx.fillRect(sx + 16, sy + 24, 4, 12)
        ctx.fillRect(sx + TILE - 20, sy + 24, 4, 12)
        break
      case 'table':
        ctx.fillStyle = '#463329'
        ctx.beginPath()
        ctx.ellipse(sx + TILE / 2, sy + 22, 15, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(sx + 24, sy + 22, 4, 13)
        ctx.fillRect(sx + 18, sy + 31, 16, 4)
        break
      case 'statue':
        ctx.fillStyle = '#6d6f73'
        ctx.fillRect(sx + 19, sy + 14, 14, 16)
        ctx.beginPath()
        ctx.arc(sx + TILE / 2, sy + 11, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#4e5055'
        ctx.fillRect(sx + 15, sy + 31, 22, 7)
        ctx.fillStyle = 'rgba(188, 190, 196, 0.12)'
        ctx.fillRect(sx + 22, sy + 17, 3, 11)
        break
      case 'candles': {
        const flicker = 0.8 + Math.sin(tick * 0.22 + sx * 0.05 + sy * 0.08) * 0.2
        const flameHeight = 8 + flicker * 4
        const candleLight = ctx.createRadialGradient(sx + 25.5, sy + 21, 0, sx + 25.5, sy + 21, 38)
        candleLight.addColorStop(0, `rgba(255, 204, 132, ${0.18 + flicker * 0.12})`)
        candleLight.addColorStop(0.5, `rgba(232, 146, 68, ${0.1 + flicker * 0.06})`)
        candleLight.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = candleLight
        ctx.beginPath()
        ctx.arc(sx + 25.5, sy + 21, 38, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#d8d0bf'
        ctx.fillRect(sx + 15, sy + 24, 5, 10)
        ctx.fillRect(sx + 23, sy + 19, 5, 15)
        ctx.fillRect(sx + 31, sy + 23, 5, 11)
        ctx.fillStyle = `rgba(255, 197, 102, ${0.18 + flicker * 0.18})`
        ctx.beginPath()
        ctx.arc(sx + 17.5, sy + 22, 8 + flicker * 2, 0, Math.PI * 2)
        ctx.arc(sx + 25.5, sy + 17, 10 + flicker * 2, 0, Math.PI * 2)
        ctx.arc(sx + 33.5, sy + 21, 8 + flicker * 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffb45a'
        ctx.beginPath()
        ctx.moveTo(sx + 17.5, sy + 24 - flameHeight)
        ctx.lineTo(sx + 14.5, sy + 22)
        ctx.lineTo(sx + 20.5, sy + 22)
        ctx.closePath()
        ctx.moveTo(sx + 25.5, sy + 19 - flameHeight)
        ctx.lineTo(sx + 22.5, sy + 17)
        ctx.lineTo(sx + 28.5, sy + 17)
        ctx.closePath()
        ctx.moveTo(sx + 33.5, sy + 23 - flameHeight * 0.85)
        ctx.lineTo(sx + 30.5, sy + 21)
        ctx.lineTo(sx + 36.5, sy + 21)
        ctx.closePath()
        ctx.fill()
        break
      }
      case 'witch': {
        const stir = Math.sin(tick * 0.12) * 4
        const bubble = (Math.sin(tick * 0.18) + 1) * 0.5
        ctx.fillStyle = '#2b2430'
        ctx.beginPath()
        ctx.ellipse(sx + 26, sy + 35, 14, 6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0f0d12'
        ctx.beginPath()
        ctx.moveTo(sx + 16, sy + 29)
        ctx.lineTo(sx + 19, sy + 13)
        ctx.lineTo(sx + 30, sy + 9)
        ctx.lineTo(sx + 37, sy + 18)
        ctx.lineTo(sx + 34, sy + 30)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#17141b'
        ctx.beginPath()
        ctx.arc(sx + 28, sy + 14, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#4d3b28'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(sx + 25, sy + 24)
        ctx.lineTo(sx + 36, sy + 19 + stir)
        ctx.stroke()
        ctx.fillStyle = '#2c2f2a'
        ctx.fillRect(sx + 11, sy + 28, 18, 6)
        ctx.beginPath()
        ctx.arc(sx + 20, sy + 28, 9, Math.PI, 0)
        ctx.fill()
        ctx.fillStyle = 'rgba(98, 176, 94, 0.45)'
        ctx.beginPath()
        ctx.ellipse(sx + 20, sy + 27, 7, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(152, 228, 138, 0.55)'
        ctx.beginPath()
        ctx.arc(sx + 17 + bubble * 4, sy + 23 - bubble * 3, 1.8 + bubble, 0, Math.PI * 2)
        ctx.arc(sx + 21 - bubble * 3, sy + 21 - bubble * 4, 1.2 + bubble * 0.8, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'clock': {
        const pendulum = Math.sin(tick * 0.09) * 5
        ctx.fillStyle = '#433126'
        ctx.fillRect(sx + 17, sy + 8, 18, 28)
        ctx.fillStyle = '#241710'
        ctx.fillRect(sx + 20, sy + 11, 12, 22)
        ctx.strokeStyle = '#99724a'
        ctx.lineWidth = 1.2
        ctx.strokeRect(sx + 20, sy + 11, 12, 22)
        ctx.fillStyle = '#d6c7a0'
        ctx.beginPath()
        ctx.arc(sx + 26, sy + 16, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#6f5238'
        ctx.beginPath()
        ctx.moveTo(sx + 26, sy + 23)
        ctx.lineTo(sx + 26 + pendulum, sy + 31)
        ctx.stroke()
        ctx.fillStyle = '#c7a15a'
        ctx.beginPath()
        ctx.arc(sx + 26 + pendulum, sy + 32, 2.4, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'portrait': {
        const blink = Math.sin(tick * 0.05 + sx * 0.03) > 0.94
        const eyeAlpha = blink ? 0.04 : 0.62
        ctx.fillStyle = '#3d2d24'
        ctx.fillRect(sx + 13, sy + 8, 26, 30)
        ctx.strokeStyle = '#8f6c47'
        ctx.lineWidth = 2
        ctx.strokeRect(sx + 15, sy + 10, 22, 26)
        ctx.fillStyle = '#1a1718'
        ctx.beginPath()
        ctx.ellipse(sx + 26, sy + 23, 8, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(214, 58, 42, ${eyeAlpha})`
        ctx.fillRect(sx + 22, sy + 20, 2, 2)
        ctx.fillRect(sx + 28, sy + 20, 2, 2)
        break
      }
      case 'mirror': {
        const ghost = (Math.sin(tick * 0.07) + 1) * 0.5
        const shimmerY = 10 + ghost * 10
        ctx.fillStyle = '#362b35'
        ctx.fillRect(sx + 14, sy + 8, 24, 30)
        ctx.fillStyle = '#73808a'
        ctx.fillRect(sx + 17, sy + 11, 18, 24)
        ctx.fillStyle = 'rgba(190, 210, 220, 0.14)'
        ctx.fillRect(sx + 20, sy + 13, 4, 18)
        ctx.fillStyle = `rgba(28, 28, 34, ${0.1 + ghost * 0.22})`
        ctx.beginPath()
        ctx.ellipse(sx + 26, sy + shimmerY + 3, 5, 8, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(214, 226, 232, ${0.08 + ghost * 0.08})`
        ctx.fillRect(sx + 19, sy + 14 + ghost * 6, 12, 2)
        break
      }
      case 'crib': {
        const sway = Math.sin(tick * 0.2) * 1.7
        const kick = Math.sin(tick * 0.42) * 3.6
        const thrash = Math.sin(tick * 0.58) * 1.9
        const tremble = Math.sin(tick * 1.15) * 0.45
        const breath = (Math.sin(tick * 0.24) + 1) * 0.5
        const babyHeadX = sx + 18.1 + thrash * 0.35
        const babyHeadY = sy + 21.8 + sway * 0.34 + tremble
        const babyTorsoX = sx + 27.2 + thrash * 0.28
        const babyTorsoY = sy + 24 + sway * 0.46 + tremble * 0.55
        const blanketTopY = sy + 24.2 + sway * 0.34 + thrash * 0.18

        ctx.fillStyle = '#6f5138'
        ctx.fillRect(sx + 8, sy + 14, TILE - 16, 3)
        ctx.fillRect(sx + 8, sy + 31, TILE - 16, 3)
        ctx.fillRect(sx + 8, sy + 14, 4, 20)
        ctx.fillRect(sx + TILE - 12, sy + 14, 4, 20)
        ctx.fillRect(sx + 10, sy + 34, 3, 5)
        ctx.fillRect(sx + TILE - 13, sy + 34, 3, 5)

        ctx.strokeStyle = '#9e7a56'
        ctx.lineWidth = 1.2
        for (let railX = 15; railX <= 33; railX += 4) {
          ctx.beginPath()
          ctx.moveTo(sx + railX, sy + 17)
          ctx.lineTo(sx + railX, sy + 30)
          ctx.stroke()
        }

        ctx.fillStyle = '#d7cfbf'
        ctx.fillRect(sx + 13, sy + 18, TILE - 26, 11)
        ctx.fillStyle = '#ece4d6'
        ctx.fillRect(sx + 14, sy + 19, 7, 9)

        ctx.fillStyle = '#d5b8a4'
        ctx.beginPath()
        ctx.ellipse(babyHeadX, babyHeadY, 4.7, 5.4, -0.08, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#6f4a33'
        ctx.beginPath()
        ctx.arc(babyHeadX - 0.8, babyHeadY - 3.8, 2.7, Math.PI * 1.02, Math.PI * 1.98)
        ctx.fill()

        ctx.fillStyle = '#3c2a22'
        ctx.beginPath()
        ctx.arc(babyHeadX - 1.4, babyHeadY - 0.4, 0.42, 0, Math.PI * 2)
        ctx.arc(babyHeadX + 1.3, babyHeadY - 0.6, 0.42, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = '#a66d68'
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.arc(babyHeadX + 0.1, babyHeadY + 1.1, 1.35, 0.1, Math.PI - 0.2)
        ctx.stroke()

        ctx.fillStyle = '#f5f1e8'
        ctx.beginPath()
        ctx.ellipse(babyTorsoX, babyTorsoY, 7.9, 4.5 + breath * 0.95, -0.08 + thrash * 0.02, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#f0ece3'
        ctx.beginPath()
        ctx.ellipse(sx + 32.4 + thrash * 0.18, sy + 26.5 + sway * 0.55 + tremble * 0.35, 5.8, 3.3, kick * 0.09, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#e0d8cc'
        ctx.beginPath()
        ctx.moveTo(sx + 20.8, blanketTopY)
        ctx.quadraticCurveTo(sx + 26.7 + thrash * 0.4, sy + 21.9 + sway * 0.24, sx + 34.1, blanketTopY - 0.8)
        ctx.quadraticCurveTo(sx + 39.7 + kick * 0.22, sy + 26 + sway * 0.48, sx + 34.8, sy + 29.6)
        ctx.lineTo(sx + 22.2, sy + 29.5)
        ctx.quadraticCurveTo(sx + 17.8 + thrash * 0.28, sy + 27.1 + tremble * 0.4, sx + 20.8, blanketTopY)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = '#d5c4b6'
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(sx + 30.8 + thrash * 0.18, sy + 25.6 + tremble * 0.2)
        ctx.lineTo(sx + 37.8 + kick * 0.55, sy + 21.8 + sway * 0.25)
        ctx.moveTo(sx + 30.9 + thrash * 0.22, sy + 27.7 + tremble * 0.3)
        ctx.lineTo(sx + 38.4 + kick * 0.85, sy + 30.3 + sway * 0.12)
        ctx.stroke()

        ctx.fillStyle = `rgba(246, 238, 222, ${0.08 + breath * 0.06})`
        ctx.beginPath()
        ctx.moveTo(sx + 21.4, blanketTopY + 0.5)
        ctx.quadraticCurveTo(sx + 27.3 + thrash * 0.25, sy + 23 + sway * 0.2, sx + 33.6, blanketTopY)
        ctx.lineTo(sx + 34.5, sy + 28.6)
        ctx.lineTo(sx + 23.4, sy + 28.7)
        ctx.closePath()
        ctx.fill()
        break
      }
    }
  }, [])

  const drawBuildingMap = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = dimensionsRef.current
    const { x: camX, y: camY } = cameraRef.current
    const map = mapRef.current

    const startTX = Math.max(0, Math.floor(camX / TILE) - 1)
    const startTY = Math.max(0, Math.floor(camY / TILE) - 1)
    const endTX = Math.min(MAP_W, startTX + Math.ceil(width / TILE) + 3)
    const endTY = Math.min(MAP_H, startTY + Math.ceil(height / TILE) + 3)

    ctx.fillStyle = '#070809'
    ctx.fillRect(0, 0, width, height)

    for (let ty = startTY; ty < endTY; ty += 1) {
      for (let tx = startTX; tx < endTX; tx += 1) {
        const sx = tx * TILE - camX
        const sy = ty * TILE - camY

        if (map[ty][tx] === 0 || map[ty][tx] === 2) {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? '#5f5f61' : '#555557'
          ctx.fillRect(sx, sy, TILE, TILE)
          ctx.strokeStyle = 'rgba(32, 34, 38, 0.45)'
          ctx.lineWidth = 1
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1)

          ctx.fillStyle = 'rgba(138, 142, 148, 0.12)'
          ctx.fillRect(sx + 5, sy + 6, 16, 12)
          ctx.fillRect(sx + 24, sy + 23, 14, 10)

          ctx.strokeStyle = 'rgba(28, 28, 30, 0.22)'
          ctx.beginPath()
          ctx.moveTo(sx + 8, sy + 18)
          ctx.lineTo(sx + 20, sy + 26)
          ctx.lineTo(sx + 14, sy + 38)
          ctx.moveTo(sx + 26, sy + 11)
          ctx.lineTo(sx + 36, sy + 18)
          ctx.lineTo(sx + 31, sy + 31)
          ctx.stroke()

          if (map[ty][tx] === 2) {
            ctx.fillStyle = 'rgba(22, 20, 18, 0.16)'
            ctx.fillRect(sx + 6, sy + 8, TILE - 12, TILE - 10)
          }
        } else if (map[ty][tx] === 3) {
          drawLockedDoor(ctx, sx, sy)
        } else {
          const grad = ctx.createLinearGradient(sx, sy, sx, sy + TILE)
          grad.addColorStop(0, '#111214')
          grad.addColorStop(1, '#050607')
          ctx.fillStyle = grad
          ctx.fillRect(sx, sy, TILE, TILE)
          ctx.strokeStyle = 'rgba(70, 74, 80, 0.08)'
          ctx.lineWidth = 1
          ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1)
          ctx.fillStyle = 'rgba(92, 96, 104, 0.05)'
          ctx.fillRect(sx + 1, sy + 1, TILE - 2, 4)
        }
      }
    }

    buildingDecorRef.current.forEach((decor) => {
      const sx = decor.x * TILE - camX
      const sy = decor.y * TILE - camY
      drawBuildingDecor(ctx, sx, sy, decor.kind, tickRef.current)
    })

    buildingLightsRef.current.forEach((light, index) => {
      const lx = light.x * TILE + TILE / 2 - camX
      const ly = light.y * TILE + TILE / 2 - camY
      const radius = light.radius + Math.sin(tickRef.current * 0.04 + index) * 8
      const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius)
      gradient.addColorStop(0, light.color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(lx, ly, radius, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.fillRect(0, 0, width, height)
  }, [drawBuildingDecor, drawLockedDoor])

  const drawMap = useCallback((ctx: CanvasRenderingContext2D) => {
    if (uiRef.current.buildingVisible) {
      drawBuildingMap(ctx)
      return
    }

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
          if (uiRef.current.doorUnlocked) {
            drawOpenDoor(ctx, sx, sy)
          } else {
            drawLockedDoor(ctx, sx, sy)
          }
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
  }, [drawBuildingMap, drawGround, drawLockedDoor, drawOpenDoor, drawTree])

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

  const lightBlockedAt = useCallback((worldX: number, worldY: number): boolean => {
    const tx = Math.floor(worldX / TILE)
    const ty = Math.floor(worldY / TILE)
    const map = mapRef.current

    if (tx < 0 || ty < 0 || ty >= map.length || tx >= (map[ty]?.length ?? 0)) {
      return true
    }

    const tile = map[ty][tx]
    if (tile === 3) {
      return !uiRef.current.doorUnlocked
    }

    return tile > 0
  }, [])

  const castLightRay = useCallback((originX: number, originY: number, angle: number, maxDistance: number) => {
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)

    let mapX = Math.floor(originX / TILE)
    let mapY = Math.floor(originY / TILE)

    const deltaDistX = dirX === 0 ? Number.POSITIVE_INFINITY : Math.abs(TILE / dirX)
    const deltaDistY = dirY === 0 ? Number.POSITIVE_INFINITY : Math.abs(TILE / dirY)

    let stepX = 0
    let stepY = 0
    let sideDistX = 0
    let sideDistY = 0

    if (dirX < 0) {
      stepX = -1
      sideDistX = (originX - mapX * TILE) / Math.abs(dirX)
    } else {
      stepX = 1
      sideDistX = ((mapX + 1) * TILE - originX) / Math.abs(dirX || 1)
    }

    if (dirY < 0) {
      stepY = -1
      sideDistY = (originY - mapY * TILE) / Math.abs(dirY)
    } else {
      stepY = 1
      sideDistY = ((mapY + 1) * TILE - originY) / Math.abs(dirY || 1)
    }

    let traveled = 0

    while (traveled < maxDistance) {
      let hitVertical = false
      if (sideDistX < sideDistY) {
        traveled = sideDistX
        sideDistX += deltaDistX
        mapX += stepX
        hitVertical = true
      } else {
        traveled = sideDistY
        sideDistY += deltaDistY
        mapY += stepY
      }

      const sampleX = originX + dirX * Math.min(traveled, maxDistance)
      const sampleY = originY + dirY * Math.min(traveled, maxDistance)
      if (lightBlockedAt(sampleX, sampleY)) {
        const offset = 0.8
        return {
          x: originX + dirX * Math.max(0, Math.min(maxDistance, traveled - offset)),
          y: originY + dirY * Math.max(0, Math.min(maxDistance, traveled - offset)),
          hitVertical,
        }
      }
    }

    return {
      x: originX + dirX * maxDistance,
      y: originY + dirY * maxDistance,
      hitVertical: false,
    }
  }, [lightBlockedAt])

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

    const indoor = uiRef.current.buildingVisible
    maskCtx.fillStyle = indoor ? 'rgba(0,0,0,0.56)' : 'rgba(0,0,0,0.97)'
    maskCtx.fillRect(0, 0, width, height)
    maskCtx.globalCompositeOperation = 'destination-out'

    const coneAngle = Math.PI / 4.2
    const gradient = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, flashRadius)
    gradient.addColorStop(0, indoor ? 'rgba(255,244,214,0.82)' : 'rgba(255,248,220,1)')
    gradient.addColorStop(0.4, indoor ? 'rgba(255,226,168,0.54)' : 'rgba(255,240,180,0.9)')
    gradient.addColorStop(0.75, indoor ? 'rgba(255,196,112,0.2)' : 'rgba(255,220,140,0.45)')
    gradient.addColorStop(0.9, indoor ? 'rgba(255,174,92,0.06)' : 'rgba(255,200,100,0.15)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')

    maskCtx.fillStyle = gradient
    maskCtx.beginPath()
    maskCtx.moveTo(cx, cy)
    if (indoor) {
      const rayCount = 80
      for (let index = 0; index <= rayCount; index += 1) {
        const angle = player.angle - coneAngle + (index / rayCount) * coneAngle * 2
        const hit = castLightRay(player.x, player.y, angle, flashRadius)
        maskCtx.lineTo(hit.x - camX, hit.y - camY)
      }
    } else {
      maskCtx.arc(cx, cy, flashRadius, player.angle - coneAngle, player.angle + coneAngle)
    }
    maskCtx.closePath()
    maskCtx.fill()

    const ambient = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, indoor ? 24 : 32)
    ambient.addColorStop(0, indoor ? 'rgba(255,228,188,0.28)' : 'rgba(255,240,200,0.55)')
    ambient.addColorStop(1, 'rgba(0,0,0,0)')

    maskCtx.fillStyle = ambient
    maskCtx.beginPath()
    maskCtx.arc(cx, cy, indoor ? 24 : 32, 0, Math.PI * 2)
    maskCtx.fill()

    ctx.drawImage(mask, 0, 0)

    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.fillStyle = '#fff8c0'
    ctx.beginPath()
    ctx.arc(cx + Math.cos(player.angle) * 8, cy + Math.sin(player.angle) * 8, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [castLightRay])

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

    const doorMarker = uiRef.current.buildingVisible && buildingEntranceRef.current
      ? buildingEntranceRef.current
      : { x: BUILDING_DOOR_X, y: BUILDING_DOOR_Y }
    const doorSize = Math.max(4, TILE * scale * 0.55)
    const doorX = doorMarker.x * TILE * scale + (TILE * scale - doorSize) / 2
    const doorY = doorMarker.y * TILE * scale + (TILE * scale - doorSize) / 2
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

      if (deathShownRef.current || savedBabyRef.current) {
        return
      }

      if (uiRef.current.enteringBuilding) {
        renderFrame(ctx)
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

      if (held.ArrowUp || held.w) {
        dy -= speed
      }
      if (held.ArrowDown || held.s) {
        dy += speed
      }
      if (held.ArrowLeft || held.a) {
        dx -= speed
      }
      if (held.ArrowRight || held.d) {
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

      if (uiRef.current.buildingVisible) {
        const playerTileX = Math.floor(player.x / TILE)
        const playerTileY = Math.floor(player.y / TILE)
        const inWitchAudioZone =
          (playerTileX >= 9 && playerTileX <= 32 && playerTileY >= 8 && playerTileY <= 15) ||
          (playerTileX >= 18 && playerTileX <= 23 && playerTileY >= 3 && playerTileY <= 15)

        if (inWitchAudioZone) {
          startBabyCrying()
        } else if (witchRoomAudioActiveRef.current) {
          fadeOutBabyCrying()
        }

        const cribCenterX = BABY_CRIB_TILE.x * TILE + TILE / 2
        const cribCenterY = BABY_CRIB_TILE.y * TILE + TILE / 2
        const nearBaby = Math.hypot(cribCenterX - player.x, cribCenterY - player.y) <= BABY_RESCUE_DISTANCE
        if (uiRef.current.hintVisible !== nearBaby || (nearBaby && uiRef.current.hintText !== 'press E to save the baby')) {
          updateUi({
            hintVisible: nearBaby,
            hintText: nearBaby ? 'press E to save the baby' : uiRef.current.hintText,
          })
        }
      } else if (witchRoomAudioActiveRef.current) {
        stopBabyCrying(true)
      }

      const staminaUiValue = Math.round(player.stamina * 10) / 10
      if (staminaUiValue !== uiRef.current.stamina) {
        updateUi({ stamina: staminaUiValue })
      }

      const { width, height } = dimensionsRef.current
      const camX = Math.max(0, Math.min(MAP_W * TILE - width, player.x - width / 2))
      const camY = Math.max(0, Math.min(MAP_H * TILE - height, player.y - height / 2))
      cameraRef.current = { x: camX, y: camY }

      if (!uiRef.current.buildingVisible) {
        const doorCenterX = BUILDING_DOOR_X * TILE + TILE / 2
        const doorCenterY = BUILDING_DOOR_Y * TILE + TILE / 2
        if (hintTimerRef.current > 0) {
          hintTimerRef.current = Math.max(0, hintTimerRef.current - dt)
        }
        const timedHintVisible = hintTimerRef.current > 0
        const nearLockedDoor =
          uiRef.current.collectedKeys < TOTAL_KEYS && Math.hypot(doorCenterX - player.x, doorCenterY - player.y) < TILE * 2.35
        const nearUnlockedDoor =
          uiRef.current.doorUnlocked && Math.hypot(doorCenterX - player.x, doorCenterY - player.y) < TILE * 1.45

        let hintVisible = false
        let hintText = uiRef.current.hintText

        if (timedHintVisible) {
          hintVisible = true
        } else if (nearLockedDoor) {
          hintVisible = true
          hintText = 'find the keys to open the door'
        } else if (nearUnlockedDoor) {
          hintVisible = true
          hintText = 'the door is unlocked'
        }

        if (uiRef.current.hintVisible !== hintVisible || uiRef.current.hintText !== hintText) {
          updateUi({ hintVisible, hintText })
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

            if (collected >= TOTAL_KEYS && !uiRef.current.doorUnlocked) {
              hintTimerRef.current = 4500
              playDoorUnlock()
              updateUi({
                collectedKeys: collected,
                doorUnlocked: true,
                hintVisible: true,
                hintText: 'the door is unlocked',
              })
              return
            }
          }
        })

        if (
          uiRef.current.doorUnlocked &&
          !uiRef.current.enteringBuilding &&
          !uiRef.current.buildingVisible &&
          Math.hypot(doorCenterX - player.x, doorCenterY - player.y) < TILE * 0.9
        ) {
          enterBuilding()
        }

        updateMonsters(dt)
      }

      updateParticles(dt)
      renderFrame(ctx)
    },
    [enterBuilding, fadeOutBabyCrying, loadBuildingScene, movePlayer, playDoorUnlock, playMenuMusic, pushMonstersAwayFromPlayer, renderFrame, resetPlayerToSpawn, spawnCollectParticles, startBabyCrying, stopBabyCrying, updateMonsters, updateParticles, updateSpellCooldownUi, updateUi],
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
          !uiRef.current.enteringBuilding &&
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
                winShown: uiRef.current.enteringBuilding || uiRef.current.buildingVisible,
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

      const normalizedKey = normalizeHeldKey(event)
      heldRef.current[normalizedKey] = true
      if (
        !event.repeat &&
        normalizedKey === DEBUG_FORCE_BUILDING_KEY &&
        !uiRef.current.buildingVisible &&
        !uiRef.current.enteringBuilding &&
        !uiRef.current.mainMenuVisible &&
        !uiRef.current.firstLoadVisible
      ) {
        enterBuilding()
        return
      }

      if (!event.repeat && normalizedKey === 'e') {
        saveBaby()
        castSpell()
      }

      if (!event.repeat && normalizedKey === 'Space') {
        castSpell()
      }
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      heldRef.current[normalizeHeldKey(event)] = false
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
      stopBabyCrying()
      stopIndoorAmbient()
      stopMenuMusic()
      clickAudioRef.current?.pause()
      doorUnlockAudioRef.current?.pause()
      babyCryingAudioRef.current?.pause()
      babyCryingSwapRef.current?.pause()
      indoorAmbientAudioRef.current?.pause()
      indoorAmbientSwapRef.current?.pause()
      clickAudioRef.current = null
      doorUnlockAudioRef.current = null
      babyCryingAudioRef.current = null
      babyCryingSwapRef.current = null
      indoorAmbientAudioRef.current = null
      indoorAmbientSwapRef.current = null
      menuAudioRef.current = null
      menuAudioSwapRef.current = null
      clearDoorEntryTimer()
      clearSavedBabyTransitionTimer()
    }
  }, [castSpell, clearDoorEntryTimer, clearSavedBabyTransitionTimer, enterBuilding, generateMap, loop, playMenuMusic, saveBaby, stopBabyCrying, stopIndoorAmbient, stopMenuMusic, updateUi])

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
    deathShownRef.current = false
    savedBabyRef.current = false
    updateUi({
      firstLoadVisible: false,
      mainMenuVisible: true,
      currentMenuScreen: 'main',
      paused: false,
      lives: PLAYER_LIFE_COUNT,
      totalLives: PLAYER_LIFE_COUNT,
      jumpscareVisible: false,
      deathVisible: false,
      doorUnlocked: false,
      enteringBuilding: false,
      buildingVisible: false,
      hintVisible: true,
      hintText: 'find the keys to open the door',
      introVisible: false,
      savedBabyTransitionVisible: false,
      savedBabyVisible: false,
    })

    clearDoorEntryTimer()
    clearSavedBabyTransitionTimer()
    audioControllerRef.current?.stop()
    audioControllerRef.current = null
    stopBabyCrying(true)
    stopIndoorAmbient(true)
    playMenuMusic()
  }, [clearDoorEntryTimer, clearSavedBabyTransitionTimer, playMenuMusic, stopBabyCrying, stopIndoorAmbient, updateUi])

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
      uiRef.current.enteringBuilding ||
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
    stopBabyCrying()
    stopIndoorAmbient()
    playMenuMusic()
    lastTimeRef.current = performance.now()
    updateUi({ paused: true })
  }, [playMenuMusic, playUiClick, stopBabyCrying, stopIndoorAmbient, updateUi])

  const resumeGame = useCallback(() => {
    if (!pausedRef.current || !gameStartedRef.current) {
      return
    }

    playUiClick()

    stopMenuMusic()
    if (uiRef.current.buildingVisible) {
      startIndoorAmbient()
    } else {
      startAmbientAudio()
    }

    pausedRef.current = false
    heldRef.current = {}
    lastTimeRef.current = performance.now()
    updateUi({ paused: false })
  }, [playUiClick, startAmbientAudio, startIndoorAmbient, stopMenuMusic, updateUi])

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
      if (doorUnlockAudioRef.current) {
        doorUnlockAudioRef.current.volume = next ? 0 : 0.82
      }
      if (babyCryingAudioRef.current) {
        babyCryingAudioRef.current.volume = next ? 0 : BABY_CRYING_VOLUME
      }
      if (babyCryingSwapRef.current) {
        babyCryingSwapRef.current.volume = next ? 0 : BABY_CRYING_VOLUME
      }
      if (indoorAmbientAudioRef.current) {
        indoorAmbientAudioRef.current.volume = next ? 0 : INDOOR_AMBIENT_VOLUME
      }
      if (indoorAmbientSwapRef.current) {
        indoorAmbientSwapRef.current.volume = next ? 0 : INDOOR_AMBIENT_VOLUME
      }
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
    if (doorUnlockAudioRef.current) {
      doorUnlockAudioRef.current.volume = isMuted ? 0 : 0.82
    }
    if (babyCryingAudioRef.current) {
      babyCryingAudioRef.current.volume = isMuted ? 0 : BABY_CRYING_VOLUME
    }
    if (babyCryingSwapRef.current) {
      babyCryingSwapRef.current.volume = isMuted ? 0 : BABY_CRYING_VOLUME
    }
    if (indoorAmbientAudioRef.current) {
      indoorAmbientAudioRef.current.volume = isMuted ? 0 : INDOOR_AMBIENT_VOLUME
    }
    if (indoorAmbientSwapRef.current) {
      indoorAmbientSwapRef.current.volume = isMuted ? 0 : INDOOR_AMBIENT_VOLUME
    }
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
