/**
 * Rasteriserer public/favicon.svg til PNG-ikona appen treng.
 *
 *   npm i --no-save @resvg/resvg-js
 *   node scripts/build-icons.mjs
 *
 * Køyrast sjeldan — resultatet er sjekka inn. Køyr på nytt berre når
 * favicon.svg blir bytt ut.
 *
 * MERK — SVG-en frå Spillarena skriv kvar farge to gonger:
 * `fill:#863bff;fill:color(display-p3 …)`. Den siste vinn i CSS, og ein
 * rasteriserar som ikkje kjenner `color(display-p3 …)` fell tilbake til svart
 * i staden for til hex-verdien rett før. Difor blir dei moderne
 * fargedeklarasjonane stripte bort før rendring; nettlesarane les framleis
 * originalfila og får den vide fargeromsversjonen.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const SRC = resolve(root, 'public/favicon.svg')

/** Bakgrunnen bak merket. Same tone som `--bg-deep` i det mørke temaet. */
const BG = [0x05, 0x07, 0x0f]

/**
 * Kor mykje av ruta merket får fylle.
 *
 * `maskable` i webmanifestet lèt operativsystemet klippe ikonet til si eiga
 * form — sirkel, avrunda firkant, dropar. Alt utanfor den innskrivne sirkelen
 * på 80 % kan forsvinne, så merket held seg innanfor 60 %.
 */
const SAFE = 0.6

const TARGETS = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
]

const svg = readFileSync(SRC, 'utf8').replace(/;?fill:color\(display-p3[^;"]*\)/g, '')

/** Legg merket midt på ei einsfarga rute og skriv resultatet som PNG. */
function compose(size) {
  const inner = Math.round(size * SAFE)
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: inner } }).render()
  const mark = rendered.asPng()
  const { width: mw, height: mh } = rendered

  // resvg gjev berre PNG ut, så merket blir dekoda att for å komponerast.
  const px = decodePng(mark)
  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = BG[0]
    out[i * 4 + 1] = BG[1]
    out[i * 4 + 2] = BG[2]
    out[i * 4 + 3] = 255
  }

  const ox = Math.round((size - mw) / 2)
  const oy = Math.round((size - mh) / 2)
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const s = (y * mw + x) * 4
      const a = px[s + 3] / 255
      if (a === 0) continue
      const d = ((y + oy) * size + (x + ox)) * 4
      for (let c = 0; c < 3; c++) {
        out[d + c] = Math.round(px[s + c] * a + out[d + c] * (1 - a))
      }
    }
  }
  return encodePng(out, size, size)
}

/* --- minimal PNG-kodek: berre 8-bits RGBA, som er alt resvg skriv --- */

import { deflateSync, inflateSync } from 'node:zlib'

function decodePng(buffer) {
  let offset = 8
  const idat = []
  let width = 0
  let height = 0
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6) throw new Error('ventar 8-bits RGBA')
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    offset += length + 12
  }

  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(width * height * 4)
  const stride = width * 4
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + x] = value & 0xff
    }
  }
  return out
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0)
  return Buffer.concat([head, data, crc])
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return c ^ 0xffffffff
}

function encodePng(rgba, width, height) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const { file, size } of TARGETS) {
  const png = compose(size)
  writeFileSync(resolve(root, file), png)
  console.log(`  ${file} — ${size}×${size}, ${Math.round(png.length / 1024)} kB`)
}
