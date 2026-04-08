export type TileType = 0 | 1 | 2 | 3

export interface TreeData {
  trunkW: number
  lean: number
  size: number
  layers: number
  dark: boolean
}

export interface KeyItem {
  x: number
  y: number
  collected: boolean
  bob: number
}

export interface Monster {
  x: number
  y: number
  speed: number
  alertR: number
  state: 'idle' | 'chase'
  wanderAngle: number
  wanderTimer: number
  kind: 'stalker' | 'spider' | 'skull' | 'wraith' | 'wolf'
  phase: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export interface Player {
  x: number
  y: number
  angle: number
  stamina: number
  speed: number
}

export interface GameUiState {
  collectedKeys: number
  totalKeys: number
  lives: number
  totalLives: number
  stamina: number
  spellReady: boolean
  spellCooldownPercent: number
  spellCooldownSeconds: number
  firstLoadVisible: boolean
  mainMenuVisible: boolean
  currentMenuScreen: 'main' | 'controls' | 'info'
  paused: boolean
  jumpscareVisible: boolean
  deathVisible: boolean
  doorUnlocked: boolean
  enteringBuilding: boolean
  buildingVisible: boolean
  hintVisible: boolean
  hintText: string
  introVisible: boolean
  savedBabyTransitionVisible: boolean
  savedBabyVisible: boolean
}
