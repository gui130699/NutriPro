import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

type Color = readonly [number, number, number]
type Point = { x: number; y: number }

const sourceSize = 192
const teal: Color = [15, 118, 110]
const leaf: Color = [216, 245, 223]
const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public')

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer: Buffer) {
  let value = 0xffffffff
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function cubic(from: Point, controlA: Point, controlB: Point, to: Point, amount: number): Point {
  const inverse = 1 - amount
  return {
    x: inverse ** 3 * from.x + 3 * inverse ** 2 * amount * controlA.x + 3 * inverse * amount ** 2 * controlB.x + amount ** 3 * to.x,
    y: inverse ** 3 * from.y + 3 * inverse ** 2 * amount * controlA.y + 3 * inverse * amount ** 2 * controlB.y + amount ** 3 * to.y,
  }
}

function curvePoints(from: Point, controlA: Point, controlB: Point, to: Point) {
  return Array.from({ length: 25 }, (_, index) => cubic(from, controlA, controlB, to, index / 24))
}

const leafPath = [
  ...curvePoints({ x: 98, y: 148 }, { x: 60, y: 123 }, { x: 44, y: 97 }, { x: 55, y: 66 }),
  ...curvePoints({ x: 55, y: 66 }, { x: 63, y: 43 }, { x: 86, y: 39 }, { x: 96, y: 58 }),
  ...curvePoints({ x: 96, y: 58 }, { x: 106, y: 39 }, { x: 129, y: 43 }, { x: 137, y: 66 }),
  ...curvePoints({ x: 137, y: 66 }, { x: 148, y: 97 }, { x: 132, y: 123 }, { x: 98, y: 148 }),
]

const veinPath = Array.from({ length: 49 }, (_, index) => cubic(
  { x: 97, y: 127 },
  { x: 95, y: 97 },
  { x: 107, y: 73 },
  { x: 132, y: 58 },
  index / 48,
))

function isInsidePolygon(point: Point, polygon: Point[]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x
    if (crosses) inside = !inside
  }
  return inside
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX ** 2 + deltaY ** 2
  const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared))
  const closestX = start.x + projection * deltaX
  const closestY = start.y + projection * deltaY
  return Math.hypot(point.x - closestX, point.y - closestY)
}

function isOnVein(point: Point) {
  for (let index = 1; index < veinPath.length; index += 1) {
    if (distanceToSegment(point, veinPath[index - 1], veinPath[index]) <= 4) return true
  }
  return false
}

function isInsideRoundedSquare(point: Point, radius: number) {
  const closestX = Math.max(radius, Math.min(sourceSize - radius, point.x))
  const closestY = Math.max(radius, Math.min(sourceSize - radius, point.y))
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2 <= radius ** 2
}

function pixelColor(point: Point, rounded: boolean): Color | undefined {
  if (rounded && !isInsideRoundedSquare(point, 40)) return undefined
  if (isInsidePolygon(point, leafPath)) return isOnVein(point) ? teal : leaf
  return teal
}

function makePng(size: number, rounded: boolean) {
  const sampleOffsets = [0.25, 0.75]
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const scale = sourceSize / size

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1)
    raw[rowOffset] = 0

    for (let x = 0; x < size; x += 1) {
      const colors: Color[] = []
      for (const offsetY of sampleOffsets) {
        for (const offsetX of sampleOffsets) {
          const color = pixelColor({ x: (x + offsetX) * scale, y: (y + offsetY) * scale }, rounded)
          if (color) colors.push(color)
        }
      }

      const pixelOffset = rowOffset + 1 + x * 4
      if (colors.length === 0) continue

      raw[pixelOffset] = Math.round(colors.reduce((total, color) => total + color[0], 0) / colors.length)
      raw[pixelOffset + 1] = Math.round(colors.reduce((total, color) => total + color[1], 0) / colors.length)
      raw[pixelOffset + 2] = Math.round(colors.reduce((total, color) => total + color[2], 0) / colors.length)
      raw[pixelOffset + 3] = Math.round((colors.length / 4) * 255)
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const icons = [
  { filename: 'pwa-192.png', size: 192, rounded: true },
  { filename: 'pwa-512.png', size: 512, rounded: true },
  { filename: 'pwa-512-maskable.png', size: 512, rounded: false },
  { filename: 'apple-touch-icon.png', size: 180, rounded: false },
]

mkdirSync(publicDirectory, { recursive: true })
for (const icon of icons) {
  writeFileSync(resolve(publicDirectory, icon.filename), makePng(icon.size, icon.rounded))
  console.log(`Generated public/${icon.filename}`)
}
