export const TILE = 52
export const MAP_W = 42
export const MAP_H = 42
export const BUILDING_DOOR_X = Math.floor(MAP_W / 2)
export const BUILDING_DOOR_Y = 0
export const TOTAL_KEYS = 5
export const MONSTER_COUNT = 5
export const MONSTER_MIN_SPAWN_DIST_FROM_PLAYER = 14
export const KEY_MIN_SPACING_STEPS = [7, 6, 5, 4, 3]
export const SPELL_COOLDOWN_MS = 30_000
export const SPELL_RADIUS = 175
export const SPELL_RESPAWN_MIN_DIST = 11 * TILE
export const SPELL_RESPAWN_MAX_DIST = 18 * TILE

export const SPAWN_PROTECTION_DURATION_MS = 4000
export const SPAWN_PROTECTION_MIN_MONSTER_DIST = 280

export const MONSTER_TYPES = ['stalker', 'spider', 'skull', 'wraith', 'wolf'] as const
