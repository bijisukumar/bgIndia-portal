/**
 * Fails when a file uses a name that is declared nowhere.
 *
 * A name nobody declared parses, builds and deploys without a complaint and throws a
 * ReferenceError only when that line runs. It has already bitten twice, in two places.
 *
 * The Worker. functions/api/[[route]].js is one very large file in which module-level helpers
 * and the variables inside onRequest look alike. reconcileStayStamps called now(), so from
 * 2026-08-10 every check-in and check-out crashed AFTER saving the status, and for two months
 * no commission row or owner alert was made. cancelStay used a stayId it never read, and
 * updateFlexRequest read `body` from a section that has none.
 *
 * The app. A React screen that uses CONFIG without importing it renders blank when it is
 * opened and takes the whole app down with it, because the error unmounts the root: the
 * Claims report did that from 2026-06-03, and the Guest repository's Marketing tab did it as
 * soon as a booking existed (a colour `m` left behind when the channel colours were unified).
 *
 * This walks the syntax tree with real scope analysis and lists every identifier that is
 * referenced but bound in no enclosing scope and is not a known runtime global.
 *
 *   node scripts/check-undeclared.mjs              the Worker, every file in src/ and hosts/
 *   node scripts/check-undeclared.mjs <file> ...   just those files
 *
 * A file under src/ or hosts/ may use browser globals (window, document, localStorage...);
 * any other file (the Worker) may use only what a Cloudflare Worker provides.
 *
 * Uses @babel/parser and @babel/traverse, which come in with @vitejs/plugin-react.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname, basename, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))

let parser, traverse
try {
  parser = require('@babel/parser')
  const t = require('@babel/traverse')
  traverse = t.default || t
} catch (e) {
  console.error('check-undeclared needs @babel/parser and @babel/traverse (installed with @vitejs/plugin-react): run npm install.')
  process.exit(2)
}

// What a Cloudflare Worker / the web platform provides. Anything else must be declared.
const WORKER = new Set((
  'Response Request Headers URL URLSearchParams fetch crypto console Date JSON Math Object Array String Number Boolean ' +
  'Promise Map Set WeakMap WeakSet Error TypeError RangeError SyntaxError parseInt parseFloat isNaN isFinite ' +
  'encodeURIComponent decodeURIComponent encodeURI decodeURI btoa atob TextEncoder TextDecoder Uint8Array Uint16Array ' +
  'Uint32Array Int32Array Float64Array ArrayBuffer DataView Intl RegExp Symbol setTimeout clearTimeout setInterval ' +
  'clearInterval AbortController AbortSignal Blob File FormData ReadableStream WritableStream TransformStream ' +
  'structuredClone globalThis undefined NaN Infinity Reflect Proxy BigInt queueMicrotask escape unescape caches ' +
  'WebSocket Event EventTarget CompressionStream DecompressionStream performance'
).split(' '))

// ...and the browser adds these for the React app. Node's process/require/module are NOT here:
// a file that reaches for them in the browser would throw.
const BROWSER = new Set([...WORKER, ...(
  'window document navigator location history localStorage sessionStorage screen alert confirm prompt open close print ' +
  'requestAnimationFrame cancelAnimationFrame FileReader Float32Array Image Audio CustomEvent MouseEvent KeyboardEvent ' +
  'PopStateEvent Element HTMLElement HTMLInputElement Node MutationObserver IntersectionObserver ResizeObserver ' +
  'getComputedStyle matchMedia XMLHttpRequest Notification indexedDB createImageBitmap OffscreenCanvas CSS DOMParser ' +
  'XMLSerializer Worker postMessage innerWidth innerHeight scrollTo scrollX scrollY'
).split(' ')])

// Every .js/.jsx/.mjs under a folder, without node_modules or build output.
function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') out.push(...walk(p)) }
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

const args = process.argv.slice(2)
const explicit = args.length > 0
const files = explicit
  ? args
  : [join(root, 'functions', 'api', '[[route]].js'), ...walk(join(root, 'src')), ...walk(join(root, 'hosts'))]

const isBrowserFile = file => {
  const rel = relative(root, file).split(sep)[0]
  return rel === 'src' || rel === 'hosts'
}

let problems = 0
for (const file of files) {
  const label = explicit ? basename(file) : relative(root, file).split(sep).join('/')
  const allowed = isBrowserFile(file) ? BROWSER : WORKER
  let ast
  try {
    ast = parser.parse(readFileSync(file, 'utf8'), { sourceType: 'module', errorRecovery: true, plugins: ['jsx'] })
  } catch (e) {
    problems++
    console.log(`FAIL  ${label}: does not parse (${e.message})`)
    continue
  }
  const uses = {}
  traverse(ast, {
    Program(p) {
      for (const name of Object.keys(p.scope.globals)) if (!allowed.has(name)) uses[name] = []
    },
    ReferencedIdentifier(p) {
      const n = p.node.name
      if (uses[n] && !p.scope.hasBinding(n, true)) uses[n].push(p.node.loc.start.line)
    },
  })
  const names = Object.keys(uses).filter(n => uses[n].length)
  if (!names.length) {
    if (explicit) console.log(`ok  ${label}: every name used is declared`)
    continue
  }
  problems += names.length
  console.log(`FAIL  ${label}: ${names.length} name(s) used but declared nowhere`)
  for (const n of names) {
    const lines = [...new Set(uses[n])]
    console.log(`        ${n}  (line${lines.length > 1 ? 's' : ''} ${lines.slice(0, 8).join(', ')}${lines.length > 8 ? ', ...' : ''})`)
  }
}
if (!explicit && !problems) console.log(`ok  ${files.length} files (the Worker, src/, hosts/): every name used is declared`)
process.exit(problems ? 1 : 0)
