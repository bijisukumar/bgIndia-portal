/**
 * Fails when the Worker (or any file named) uses a name that is declared nowhere.
 *
 * functions/api/[[route]].js is one very large file in which module-level helpers and the
 * variables inside onRequest look alike. A helper that uses a handler-local name (now(),
 * body, stayId) parses, builds and deploys fine and throws ReferenceError only when a
 * request reaches it. That is exactly what happened: reconcileStayStamps called now(), so
 * from 2026-08-10 every check-in and check-out crashed AFTER saving the status, and for two
 * months no commission row or owner alert was made. cancelStay used a stayId it never read,
 * and updateFlexRequest read `body` from a section that has none.
 *
 * This walks the syntax tree with real scope analysis and lists every identifier that is
 * referenced but bound in no enclosing scope and is not a known runtime global.
 *
 *   node scripts/check-undeclared.mjs [file ...]       default: functions/api/[[route]].js
 *
 * Uses @babel/parser and @babel/traverse, which come in with @vitejs/plugin-react.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname, basename } from 'node:path'
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
const RUNTIME = new Set((
  'Response Request Headers URL URLSearchParams fetch crypto console Date JSON Math Object Array String Number Boolean ' +
  'Promise Map Set WeakMap WeakSet Error TypeError RangeError SyntaxError parseInt parseFloat isNaN isFinite ' +
  'encodeURIComponent decodeURIComponent encodeURI decodeURI btoa atob TextEncoder TextDecoder Uint8Array Uint16Array ' +
  'Uint32Array Int32Array Float64Array ArrayBuffer DataView Intl RegExp Symbol setTimeout clearTimeout setInterval ' +
  'clearInterval AbortController AbortSignal Blob File FormData ReadableStream WritableStream TransformStream ' +
  'structuredClone globalThis undefined NaN Infinity Reflect Proxy BigInt queueMicrotask escape unescape caches ' +
  'WebSocket Event EventTarget CompressionStream DecompressionStream performance'
).split(' '))

const files = process.argv.slice(2)
if (!files.length) files.push(join(root, 'functions', 'api', '[[route]].js'))

let problems = 0
for (const file of files) {
  const ast = parser.parse(readFileSync(file, 'utf8'), { sourceType: 'module', errorRecovery: true, plugins: ['jsx'] })
  const uses = {}
  traverse(ast, {
    Program(p) {
      for (const name of Object.keys(p.scope.globals)) if (!RUNTIME.has(name)) uses[name] = []
    },
    ReferencedIdentifier(p) {
      const n = p.node.name
      if (uses[n] && !p.scope.hasBinding(n, true)) uses[n].push(p.node.loc.start.line)
    },
  })
  const names = Object.keys(uses).filter(n => uses[n].length)
  if (!names.length) { console.log(`ok  ${basename(file)}: every name used is declared`); continue }
  problems += names.length
  console.log(`FAIL  ${basename(file)}: ${names.length} name(s) used but declared nowhere`)
  for (const n of names) {
    const lines = [...new Set(uses[n])]
    console.log(`        ${n}  (line${lines.length > 1 ? 's' : ''} ${lines.slice(0, 8).join(', ')}${lines.length > 8 ? ', ...' : ''})`)
  }
}
process.exit(problems ? 1 : 0)
