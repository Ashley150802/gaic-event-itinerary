// Dependency-free QR Code generator (byte mode, versions 1-40, all ECC levels).
//
// This is a compact, faithful port of Project Nayuki's QR Code generator
// (MIT License) reduced to what Surket needs: UTF-8 byte segments, automatic
// version + mask selection, and SVG output. Keeping it in-repo means attendee
// QR codes are generated entirely on-device with no external QR service, no
// network round-trip, and no runtime dependency.

export type Ecc = "low" | "medium" | "quartile" | "high";

const ECC_FORMAT_BITS: Record<Ecc, number> = { low: 1, medium: 0, quartile: 3, high: 2 };
const ECC_ORDINAL: Record<Ecc, number> = { low: 0, medium: 1, quartile: 2, high: 3 };

const MIN_VERSION = 1;
const MAX_VERSION = 40;
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

// Standard QR tables. Row index = ECC ordinal (L,M,Q,H); column = version (1..40).
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

export interface QrMatrix {
  size: number;
  /** Row-major boolean grid; true = dark module. */
  modules: boolean[][];
}

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(ver: number, ecl: Ecc): number {
  const o = ECC_ORDINAL[ecl];
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[o][ver] * NUM_ERROR_CORRECTION_BLOCKS[o][ver]
  );
}

// ---- Galois field (GF(256)) Reed-Solomon ----
function reedSolomonMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function reedSolomonComputeDivisor(degree: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < degree - 1; i++) result.push(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= reedSolomonMultiply(coef, factor)));
  }
  return result;
}

// ---- Bit buffer ----
function appendBits(val: number, len: number, bits: number[]): void {
  for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
}

function toUtf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    let cp = ch.codePointAt(0) as number;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) {
      out.push(0xc0 | (cp >>> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >>> 12), 0x80 | ((cp >>> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >>> 18),
        0x80 | ((cp >>> 12) & 0x3f),
        0x80 | ((cp >>> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return out;
}

function byteModeCharCountBits(ver: number): number {
  if (ver <= 9) return 8;
  return 16; // versions 10..40, byte mode
}

// ---- Matrix drawing ----
class Grid {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];
  constructor(version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  set(x: number, y: number, dark: boolean, fn: boolean): void {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = fn;
  }
}

function getAlignmentPatternPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result: number[] = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFinder(g: Grid, x: number, y: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < g.size && yy >= 0 && yy < g.size) {
        g.set(xx, yy, dist !== 2 && dist !== 4, true);
      }
    }
  }
}

function drawAlignment(g: Grid, x: number, y: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      g.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
    }
  }
}

function drawFormatBits(g: Grid, ecl: Ecc, mask: number): void {
  const data = (ECC_FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = g.size;
  for (let i = 0; i <= 5; i++) g.set(8, i, ((bits >>> i) & 1) !== 0, true);
  g.set(8, 7, ((bits >>> 6) & 1) !== 0, true);
  g.set(8, 8, ((bits >>> 7) & 1) !== 0, true);
  g.set(7, 8, ((bits >>> 8) & 1) !== 0, true);
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, ((bits >>> i) & 1) !== 0, true);
  for (let i = 0; i < 8; i++) g.set(size - 1 - i, 8, ((bits >>> i) & 1) !== 0, true);
  for (let i = 8; i < 15; i++) g.set(8, size - 15 + i, ((bits >>> i) & 1) !== 0, true);
  g.set(8, size - 8, true, true);
}

function drawVersion(g: Grid, ver: number): void {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) !== 0;
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    g.set(a, b, bit, true);
    g.set(b, a, bit, true);
  }
}

function drawFunctionPatterns(g: Grid, ver: number, ecl: Ecc): void {
  const size = g.size;
  // Timing patterns
  for (let i = 0; i < size; i++) {
    g.set(6, i, i % 2 === 0, true);
    g.set(i, 6, i % 2 === 0, true);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, size - 4, 3);
  drawFinder(g, 3, size - 4);
  const align = getAlignmentPatternPositions(ver);
  const n = align.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      drawAlignment(g, align[i], align[j]);
    }
  }
  drawFormatBits(g, ecl, 0);
  drawVersion(g, ver);
}

function drawCodewords(g: Grid, data: number[]): void {
  const size = g.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.isFunction[y][x] && i < data.length * 8) {
          g.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
}

function applyMask(g: Grid, mask: number): void {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (g.isFunction[y][x]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
      }
      if (invert) g.modules[y][x] = !g.modules[y][x];
    }
  }
}

function computePenalty(g: Grid): number {
  const size = g.size;
  const m = g.modules;
  let result = 0;
  // Rows
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runLen = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    let padRun = size;
    for (let x = 0; x < size; x++) {
      if (m[y][x] === runColor) {
        runLen++;
        if (runLen === 5) result += PENALTY_N1;
        else if (runLen > 5) result++;
      } else {
        finderPenaltyAddHistory(runLen, history, padRun); padRun = 0;
        if (!runColor) result += finderPenaltyCountPatterns(history) * PENALTY_N3;
        runColor = m[y][x];
        runLen = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(runColor, runLen, history, size) * PENALTY_N3;
  }
  // Columns
  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runLen = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    let padRun = size;
    for (let y = 0; y < size; y++) {
      if (m[y][x] === runColor) {
        runLen++;
        if (runLen === 5) result += PENALTY_N1;
        else if (runLen > 5) result++;
      } else {
        finderPenaltyAddHistory(runLen, history, padRun); padRun = 0;
        if (!runColor) result += finderPenaltyCountPatterns(history) * PENALTY_N3;
        runColor = m[y][x];
        runLen = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(runColor, runLen, history, size) * PENALTY_N3;
  }
  // 2x2 blocks
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += PENALTY_N2;
    }
  }
  // Balance of dark modules
  let dark = 0;
  for (const row of m) for (const cell of row) if (cell) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * PENALTY_N4;
  return result;
}

function finderPenaltyAddHistory(currentRun: number, history: number[], padRun: number): void {
  if (history[0] === 0) currentRun += padRun;
  history.pop();
  history.unshift(currentRun);
}

function finderPenaltyCountPatterns(history: number[]): number {
  const n = history[1];
  const core =
    n > 0 &&
    history[2] === n &&
    history[3] === n * 3 &&
    history[4] === n &&
    history[5] === n;
  let count = 0;
  if (core && history[0] >= n * 4 && history[6] >= n) count++;
  if (core && history[6] >= n * 4 && history[0] >= n) count++;
  return count;
}

function finderPenaltyTerminateAndCount(
  currentColor: boolean,
  currentRun: number,
  history: number[],
  size: number,
): number {
  if (currentColor) {
    finderPenaltyAddHistory(currentRun, history, size);
    currentRun = 0;
  }
  currentRun += size;
  finderPenaltyAddHistory(currentRun, history, size);
  return finderPenaltyCountPatterns(history);
}

function addEccAndInterleave(dataCodewords: number[], ver: number, ecl: Ecc): number[] {
  const o = ECC_ORDINAL[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[o][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[o][ver];
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = dataCodewords.slice(k, k + datLen);
    k += datLen;
    const ecc = reedSolomonComputeRemainder(dat.slice(), rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

/** Encode arbitrary text into a QR matrix. Picks the smallest fitting version. */
export function encodeQr(text: string, ecl: Ecc = "medium"): QrMatrix {
  const bytes = toUtf8(text);
  // Find smallest version that fits a byte-mode segment of these bytes.
  let version = MIN_VERSION;
  let dataUsedBits = 0;
  for (; ; version++) {
    if (version > MAX_VERSION) throw new Error("Data too long for a QR code");
    const capacityBits = getNumDataCodewords(version, ecl) * 8;
    const ccBits = byteModeCharCountBits(version);
    dataUsedBits = 4 + ccBits + bytes.length * 8;
    if (dataUsedBits <= capacityBits) break;
  }

  const bits: number[] = [];
  appendBits(0x4, 4, bits); // byte mode indicator
  appendBits(bytes.length, byteModeCharCountBits(version), bits);
  for (const b of bytes) appendBits(b, 8, bits);

  const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bits.length), bits); // terminator
  appendBits(0, (8 - (bits.length % 8)) % 8, bits); // byte align
  for (let pad = 0xec; bits.length < dataCapacityBits; pad ^= 0xec ^ 0x11) appendBits(pad, 8, bits);

  const dataCodewords: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((bit, i) => (dataCodewords[i >>> 3] |= bit << (7 - (i & 7))));

  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);

  const g = new Grid(version);
  drawFunctionPatterns(g, version, ecl);
  drawCodewords(g, allCodewords);

  // Choose the mask with the lowest penalty.
  let bestMask = 0;
  let minPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(g, mask);
    drawFormatBits(g, ecl, mask);
    const penalty = computePenalty(g);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
    }
    applyMask(g, mask); // undo (XOR is its own inverse)
  }
  applyMask(g, bestMask);
  drawFormatBits(g, ecl, bestMask);

  return { size: g.size, modules: g.modules };
}

/**
 * Render a QR matrix to a crisp, scalable SVG string. `border` is the quiet
 * zone in modules (4 is the spec-recommended minimum). Colors default to
 * currentColor-friendly hex so it embeds nicely on any surface.
 */
export function qrToSvgPath(matrix: QrMatrix, border = 4): { path: string; dimension: number } {
  const parts: string[] = [];
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.modules[y][x]) parts.push(`M${x + border} ${y + border}h1v1h-1z`);
    }
  }
  return { path: parts.join(""), dimension: matrix.size + border * 2 };
}
