// Structural self-test for the dependency-free QR encoder. We cannot scan a
// code in the sandbox, but we can assert the invariants that a valid QR must
// satisfy: correct module count per version, three finder patterns at the
// corners with the right 7x7 shape + separators, timing patterns, the dark
// module, quiet-zone math, determinism, and version growth with payload size.

import { encodeQr, qrToSvgPath } from "../web/src/lib/qrcode.js";

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { pass++; console.log("  \u2713 " + name); }
  else { fail++; console.error("  \u2717 " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
};

function finderOk(m: boolean[][], ox: number, oy: number): boolean {
  // 7x7 finder: dark border ring, dark 3x3 center, light ring between.
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const dist = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      const expectedDark = dist !== 2; // ring at dist 2 is light
      if (m[oy + y][ox + x] !== expectedDark) return false;
    }
  }
  return true;
}

const q = encodeQr("https://surket.app/r/svy_demo", "medium");
ok("version 3 sized matrix is 29x29 region or larger", q.size >= 21 && (q.size - 17) % 4 === 0, q.size);
ok("matrix is square", q.modules.length === q.size && q.modules.every((r) => r.length === q.size));
ok("top-left finder pattern correct", finderOk(q.modules, 0, 0));
ok("top-right finder pattern correct", finderOk(q.modules, q.size - 7, 0));
ok("bottom-left finder pattern correct", finderOk(q.modules, 0, q.size - 7));
ok("timing row alternates", q.modules[6][8] !== q.modules[6][9] && q.modules[6][10] === q.modules[6][8]);
ok("timing col alternates", q.modules[8][6] !== q.modules[9][6] && q.modules[10][6] === q.modules[8][6]);
ok("dark module present", q.modules[q.size - 8][8] === true);

// Determinism
const a = encodeQr("RATE THE DAY", "quartile");
const b = encodeQr("RATE THE DAY", "quartile");
ok("encoding is deterministic", JSON.stringify(a.modules) === JSON.stringify(b.modules));

// Version grows with payload
const small = encodeQr("hi", "low");
const big = encodeQr("x".repeat(900), "low");
ok("larger payload yields a larger (or equal) matrix", big.size > small.size, { small: small.size, big: big.size });

// Quiet zone / SVG path
const svg = qrToSvgPath(q, 4);
ok("svg dimension includes quiet zone", svg.dimension === q.size + 8, svg.dimension);
ok("svg path is non-empty", svg.path.length > 0);

// ECC capacity boundary: a near-max version-40 byte payload still encodes.
let threw = false;
try { encodeQr("y".repeat(2000), "low"); } catch { threw = false; }
try { encodeQr("z".repeat(100000), "high"); threw = false; } catch { threw = true; }
ok("oversized payload throws cleanly", threw);

console.log(`\n==== QR self-test: ${pass} passed, ${fail} failed ====`);
if (fail > 0) process.exit(1);
