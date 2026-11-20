// ============================================================
//  qrcode.js: a small QR code encoder, written for the check-out payment QR (a UPI link) and nothing else.
//
//  Byte mode, error correction level M, versions 1 to 10 (up to 122 bytes of text: a UPI link is about 100). Pure: no imports, no DOM,
//  so a test can run it in Node and the screen can draw it as SVG. The method is the one in the QR standard (ISO/IEC 18004):
//  data bits -> Reed-Solomon error correction per block -> interleave -> place in the matrix -> choose the mask with the lowest penalty ->
//  write the format information (and the version information from version 7).
//
//  qrEncode(text) -> { version, size, modules }   modules[y][x] is true for a dark module; null when the text does not fit
//  qrPath(qr, quiet = 4) -> an SVG path for the dark modules, with a quiet zone of `quiet` modules around the code
// ============================================================

// Index = version. Level M: error correction codewords per block, and number of blocks.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const MAX_VERSION = 10

function rawModules(ver) {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function dataCodewords(ver) {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]
}

// ---- Reed-Solomon over GF(2^8), polynomial 0x11D ----
function gfMul(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = ((z << 1) ^ ((z >>> 7) * 0x11D)) & 0xFF
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ result.shift()
    result.push(0)
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor) })
  }
  return result
}

// Split the data codewords into blocks, add each block's error correction, and interleave them the way the standard says.
function withEcc(data, ver) {
  const numBlocks = NUM_BLOCKS[ver]
  const eccLen = ECC_PER_BLOCK[ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const div = rsDivisor(eccLen)
  const blocks = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, div)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const out = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => { if (i !== shortLen - eccLen || j >= numShort) out.push(block[i]) })
  }
  return out
}

function alignPositions(ver, size) {
  if (ver === 1) return []
  const n = Math.floor(ver / 7) + 2
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
  const result = [6]
  for (let pos = size - 7; result.length < n; pos -= step) result.splice(1, 0, pos)
  return result
}

function buildMatrix(ver, codewords) {
  const size = ver * 4 + 17
  const modules = Array.from({ length: size }, () => new Array(size).fill(false))
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false))
  const setFn = (x, y, dark) => { modules[y][x] = !!dark; isFn[y][x] = true }

  // timing patterns
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0) }
  // the three finder patterns with their light separators
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy
        if (x < 0 || x >= size || y < 0 || y >= size) continue
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        setFn(x, y, dist !== 2 && dist !== 4)
      }
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  // alignment patterns
  const pos = alignPositions(ver, size)
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }

  // format information (error correction level M = 0, then the mask), twice, plus the always-dark module
  const drawFormat = mask => {
    const data = (0 << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = i => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i))
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i))
    setFn(8, size - 8, true)
  }
  drawFormat(0)
  // version information from version 7
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25)
    const bits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = size - 11 + (i % 3), b = Math.floor(i / 3)
      setFn(a, b, dark); setFn(b, a, dark)
    }
  }

  // the data, in the standard's zigzag: two columns at a time from the right, up then down, skipping the vertical timing column
  let n = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFn[y][x] && n < codewords.length * 8) {
          modules[y][x] = ((codewords[n >>> 3] >>> (7 - (n & 7))) & 1) !== 0
          n++
        }
      }
    }
  }

  const applyMask = mask => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let invert
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
        }
        if (!isFn[y][x] && invert) modules[y][x] = !modules[y][x]
      }
    }
  }

  // the standard's four penalty rules: runs of five or more, 2x2 blocks, finder-like patterns, and the dark/light balance
  const penalty = () => {
    let score = 0
    for (let a = 0; a < size; a++) {
      for (const rowwise of [true, false]) {
        let run = 1
        for (let b = 1; b <= size; b++) {
          const prev = rowwise ? modules[a][b - 1] : modules[b - 1][a]
          const cur = b < size ? (rowwise ? modules[a][b] : modules[b][a]) : null
          if (cur === prev) run++
          else { if (run >= 5) score += 3 + (run - 5); run = 1 }
        }
      }
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x]
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3
      }
    }
    const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
    for (let a = 0; a < size; a++) {
      for (const rowwise of [true, false]) {
        for (let b = 0; b + 11 <= size; b++) {
          let m1 = true, m2 = true
          for (let k = 0; k < 11; k++) {
            const v = (rowwise ? modules[a][b + k] : modules[b + k][a]) ? 1 : 0
            if (v !== P1[k]) m1 = false
            if (v !== P2[k]) m2 = false
          }
          if (m1) score += 40
          if (m2) score += 40
        }
      }
    }
    let dark = 0
    for (const row of modules) for (const m of row) if (m) dark++
    const total = size * size
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
    return score
  }

  let best = 0, bestScore = Infinity
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m)
    const s = penalty()
    if (s < bestScore) { best = m; bestScore = s }
    applyMask(m)
  }
  applyMask(best); drawFormat(best)
  return { size, modules, mask: best }
}

export function qrEncode(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text == null ? '' : text)))
  let ver = 0
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v <= 9 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(v) * 8) { ver = v; break }
  }
  if (!ver) return null
  const capacity = dataCodewords(ver) * 8
  const bits = []
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  push(0b0100, 4)                                   // byte mode
  push(bytes.length, ver <= 9 ? 8 : 16)             // how many bytes
  for (const b of bytes) push(b, 8)
  push(0, Math.min(4, capacity - bits.length))      // terminator
  push(0, (8 - (bits.length % 8)) % 8)              // to a whole byte
  for (let pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) push(pad, 8)
  const data = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k]
    data.push(b)
  }
  const m = buildMatrix(ver, withEcc(data, ver))
  return { version: ver, size: m.size, modules: m.modules, mask: m.mask }
}

// The dark modules as one SVG path (runs along a row are one rectangle), shifted by the quiet zone.
export function qrPath(qr, quiet = 4) {
  if (!qr) return ''
  const parts = []
  for (let y = 0; y < qr.size; y++) {
    let x = 0
    while (x < qr.size) {
      if (!qr.modules[y][x]) { x++; continue }
      let end = x
      while (end < qr.size && qr.modules[y][end]) end++
      parts.push(`M${x + quiet} ${y + quiet}h${end - x}v1h-${end - x}z`)
      x = end
    }
  }
  return parts.join('')
}
