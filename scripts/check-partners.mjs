// Fails when a booking platform's NAME or RATE is written in the code. What a platform is called, what it keeps, how its bookings and
// calendar reach us: all of that lives in the partner files (/partners) and a host's own `partners` block, and the code only reads it
// (src/utils/partners.js). So a new platform, or a platform changing its rules, never needs a code change.
//
//   node scripts/check-partners.mjs        (run at the start of every Vite build by scripts/vite-check-partners.mjs, and by `npm run check:partners`)
//
// It looks at CODE only (comments are ignored) in src/ and functions/ for: a platform's name as a whole string literal ('airbnb',
// "Booking.com"), a platform-to-number map (Airbnb: 3), and a bare commission constant (* 0.03, commissionPct: 3). Free text
// that merely MENTIONS a platform (a placeholder, a help sentence, a column name like airbnb_conf) is not flagged. Integration code
// that is Airbnb-specific by nature (the Apps Script that reads Airbnb's emails) lives outside src/ and functions/; anything in them
// that must name a platform is listed in ALLOWED below, with its reason.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.cwd()
const NAMES = 'airbnb|booking\\.com|booking_com|bookingcom|makemytrip|mmt|goibibo|agoda|expedia|vrbo|cleartrip'
const RULES = [
  { id: 'platform name as a literal', re: new RegExp(`(['"\`])(${NAMES})\\1`, 'i') },
  { id: 'platform-to-number map', re: new RegExp(`['"]?\\b(airbnb|booking\\.com|bookingcom|makemytrip|goibibo|agoda|expedia|vrbo)\\b['"]?\\s*:\\s*\\d`, 'i') },
  { id: 'commission constant', re: /\*\s*0\.03\b|\bcommission(Pct|_pct)\s*[:=]\s*\d/ },
]

// Where a platform's name MAY be written, and why: a file path and the reason. Keep it empty if you can; every entry is a place the next
// platform will need code for. (Today none: even the Airbnb email integration reads its platform from the partner files.)
const ALLOWED = []

// Files not scanned: words rather than logic, or tests and tools that build sample data.
const SKIP = [/^src\/content\//, /^src\/screens\/infra\//, /\.test\./, /^src\/utils\/__tests__\//]

const files = []
const walk = dir => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(js|jsx|mjs)$/.test(name)) files.push(p)
  }
}
for (const d of ['src', 'functions']) { try { walk(join(root, d)) } catch { /* a folder this checkout does not have */ } }

// Code without comments (good enough for a guard: a // inside a string only hides the rest of that one line).
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')

let problems = 0, scanned = 0
for (const p of files) {
  const rel = relative(root, p).split(sep).join('/')
  if (SKIP.some(re => re.test(rel))) continue
  scanned++
  if (ALLOWED.some(a => a.file === rel)) continue
  const lines = code(readFileSync(p, 'utf8')).split('\n')
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.re.test(line)) {
        problems++
        console.log(`${rel}:${i + 1}  ${r.id}:  ${line.trim().slice(0, 150)}`)
      }
    }
  })
}
console.log(`\ncheck-partners: ${scanned} files, ${problems} problem(s)`)
process.exit(problems ? 1 : 0)
