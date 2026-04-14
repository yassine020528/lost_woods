import { MAP_H, MAP_W } from './constants'

export type BuildingDecorKind =
  | 'lantern'
  | 'rug'
  | 'screen'
  | 'shelf'
  | 'desk'
  | 'chest'
  | 'basin'
  | 'incense'
  | 'symbol'
  | 'chair'
  | 'table'
  | 'statue'
  | 'candles'
  | 'witch'
  | 'clock'
  | 'portrait'
  | 'mirror'
  | 'crib'

export interface BuildingDecor {
  x: number
  y: number
  kind: BuildingDecorKind
}

export interface BuildingLight {
  x: number
  y: number
  radius: number
  color: string
}

export interface BuildingSceneData {
  map: number[][]
  decor: BuildingDecor[]
  lights: BuildingLight[]
  entrance: { x: number; y: number }
}

const carveRoom = (map: number[][], x1: number, y1: number, x2: number, y2: number): void => {
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) {
        map[y][x] = 0
      }
    }
  }
}

const placeDecor = (
  map: number[][],
  decor: BuildingDecor[],
  x: number,
  y: number,
  kind: BuildingDecorKind,
  solid = false,
): void => {
  if (solid) {
    if (map[y]?.[x] !== 0) {
      throw new Error(`Cannot place solid decor ${kind} at ${x},${y}`)
    }
    map[y][x] = 2
  }

  decor.push({ x, y, kind })
}

const validateReachability = (map: number[][], entrance: { x: number; y: number }): void => {
  const seen = Array.from({ length: MAP_H }, () => Array<boolean>(MAP_W).fill(false))
  const queue: Array<[number, number]> = [[entrance.x, entrance.y]]

  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number]
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H || seen[y][x] || map[y][x] !== 0) {
      continue
    }

    seen[y][x] = true
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (map[y][x] === 0 && !seen[y][x]) {
        throw new Error(`Building floor unreachable at ${x},${y}`)
      }
    }
  }
}

export const createBuildingSceneData = (): BuildingSceneData => {
  const map = Array.from({ length: MAP_H }, () => Array<number>(MAP_W).fill(1))
  const entrance = { x: Math.floor(MAP_W / 2), y: MAP_H - 6 }

  carveRoom(map, entrance.x - 1, MAP_H - 10, entrance.x + 1, MAP_H - 4)
  carveRoom(map, 17, 29, 25, 33)
  carveRoom(map, 9, 28, 14, 32)
  carveRoom(map, 28, 28, 33, 32)
  carveRoom(map, 20, 33, 21, 34)
  carveRoom(map, 14, 30, 17, 31)
  carveRoom(map, 25, 30, 28, 31)
  carveRoom(map, 19, 17, 22, 29)
  carveRoom(map, 20, 15, 21, 17)
  carveRoom(map, 9, 18, 15, 25)
  carveRoom(map, 26, 18, 32, 25)
  carveRoom(map, 14, 21, 18, 22)
  carveRoom(map, 23, 21, 27, 22)
  carveRoom(map, 16, 8, 25, 15)
  carveRoom(map, 12, 12, 15, 14)
  carveRoom(map, 26, 12, 29, 14)
  carveRoom(map, 9, 8, 14, 13)
  carveRoom(map, 27, 8, 32, 13)
  carveRoom(map, 20, 6, 21, 8)
  carveRoom(map, 18, 3, 23, 6)
  map[entrance.y + 3][entrance.x] = 3

  const decor: BuildingDecor[] = []

  placeDecor(map, decor, 21, 31, 'rug')
  placeDecor(map, decor, 20, 34, 'lantern', true)
  placeDecor(map, decor, 17, 32, 'screen', true)
  placeDecor(map, decor, 25, 32, 'screen', true)
  placeDecor(map, decor, 17, 29, 'chair', true)
  placeDecor(map, decor, 25, 29, 'chair', true)

  placeDecor(map, decor, 10, 28, 'shelf', true)
  placeDecor(map, decor, 11, 31, 'desk', true)
  placeDecor(map, decor, 11, 32, 'chair', true)
  placeDecor(map, decor, 13, 32, 'table', true)
  placeDecor(map, decor, 12, 28, 'portrait', true)

  placeDecor(map, decor, 31, 28, 'shelf', true)
  placeDecor(map, decor, 29, 28, 'chest', true)
  placeDecor(map, decor, 33, 31, 'table', true)
  placeDecor(map, decor, 31, 32, 'statue', true)
  placeDecor(map, decor, 33, 29, 'clock', true)

  placeDecor(map, decor, 10, 19, 'shelf', true)
  placeDecor(map, decor, 10, 23, 'desk', true)
  placeDecor(map, decor, 12, 22, 'table', true)
  placeDecor(map, decor, 13, 19, 'chair', true)
  placeDecor(map, decor, 14, 24, 'basin')

  placeDecor(map, decor, 28, 20, 'screen', true)
  placeDecor(map, decor, 30, 21, 'screen', true)
  placeDecor(map, decor, 29, 24, 'statue', true)
  placeDecor(map, decor, 31, 24, 'incense')
  placeDecor(map, decor, 27, 24, 'candles', true)
  placeDecor(map, decor, 31, 19, 'mirror', true)

  placeDecor(map, decor, 20, 19, 'symbol')
  placeDecor(map, decor, 21, 23, 'lantern', true)
  placeDecor(map, decor, 19, 26, 'statue', true)
  placeDecor(map, decor, 22, 26, 'statue', true)

  placeDecor(map, decor, 17, 13, 'shelf', true)
  placeDecor(map, decor, 18, 13, 'table', true)
  placeDecor(map, decor, 21, 11, 'witch', true)
  placeDecor(map, decor, 19, 10, 'candles', true)
  placeDecor(map, decor, 23, 10, 'candles', true)
  placeDecor(map, decor, 19, 13, 'candles', true)
  placeDecor(map, decor, 23, 13, 'candles', true)
  placeDecor(map, decor, 24, 13, 'lantern', true)

  placeDecor(map, decor, 10, 10, 'shelf', true)
  placeDecor(map, decor, 10, 12, 'chest', true)
  placeDecor(map, decor, 12, 9, 'table', true)
  placeDecor(map, decor, 13, 10, 'chair', true)
  placeDecor(map, decor, 12, 12, 'portrait', true)

  placeDecor(map, decor, 31, 10, 'shelf', true)
  placeDecor(map, decor, 30, 12, 'desk', true)
  placeDecor(map, decor, 28, 9, 'statue', true)
  placeDecor(map, decor, 28, 12, 'chair', true)

  placeDecor(map, decor, 19, 5, 'incense')
  placeDecor(map, decor, 20, 4, 'statue', true)
  placeDecor(map, decor, 21, 4, 'crib', true)
  placeDecor(map, decor, 21, 5, 'symbol')
  placeDecor(map, decor, 22, 4, 'lantern', true)
  placeDecor(map, decor, 22, 5, 'candles', true)

  const lights: BuildingLight[] = [
    { x: 20, y: 34, radius: 185, color: 'rgba(216, 198, 142, 0.16)' },
    { x: 21, y: 23, radius: 145, color: 'rgba(224, 172, 108, 0.12)' },
    { x: 19, y: 10, radius: 118, color: 'rgba(255, 176, 92, 0.11)' },
    { x: 23, y: 10, radius: 118, color: 'rgba(255, 176, 92, 0.11)' },
    { x: 24, y: 13, radius: 170, color: 'rgba(214, 182, 116, 0.11)' },
    { x: 22, y: 4, radius: 138, color: 'rgba(240, 188, 120, 0.12)' },
  ]

  validateReachability(map, entrance)

  return { map, decor, lights, entrance }
}
