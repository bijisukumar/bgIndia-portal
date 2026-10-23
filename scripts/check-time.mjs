/**
 * Fails when code shows or decides on a time the old, wrong way.
 *
 * The bug it exists for. A stored time is a UTC instant ('2026-10-23 17:30:00'). Shown raw, or run
 * through `new Date()` and the device's clock, it is the wrong hour for everyone: "Checked in 6:24 AM"
 * for a guest who arrived at 11 PM in India. It was fixed three times and came back each time, because
 * each fix was a private formatter inside ONE screen and the next screen made its own raw display.
 * Now there is one home for time, src/utils/tz.js (the property's zone comes from `timezone` in
 * hosts/<id>/config.js), and this check keeps everything else out of the business.
 *
 * It parses every file under src/, functions/ and hosts/ and reports:
 *
 *   clock       .toLocaleTimeString() / .getHours() / .getMinutes() / .getSeconds() /
 *               .getTimezoneOffset(), and toLocaleString/toLocaleDateString given a time option
 *               (hour, minute, second, timeZoneName, dateStyle, timeStyle, hour12, hourCycle):
 *               they read the DEVICE's clock. Use fmtClock / fmtStamp (utils/dates.js).
 *   zone        a literal time zone ('Asia/Kolkata', timeZone: 'America/...'), new Intl.DateTimeFormat:
 *               the zone is a setting (`timezone`), named in one place. Only timeZone: 'UTC' is
 *               allowed, for formatting a plain calendar date.
 *   offset      19800000, 19800, 5.5 * ..., 330 * 60: a hard-coded India offset.
 *   today       new Date().toISOString().slice(0, 10) (and split('T')[0], substring), also through a
 *               variable holding new Date(): that is the UTC date, yesterday in India until 05:30.
 *               new Date().setHours(0,0,0,0) and new Date().getFullYear()/getMonth()/getDate()/getDay()
 *               make "today" from the machine's clock likewise. Use localTodayStr() in the app,
 *               todayInZone(zone) in the Worker.
 *   slice-stamp .slice(11, ...) / .substring(11, ...) / .split(/[ T]/)[1] / .split('T')[1]: picking the
 *               clock out of a stored stamp, still in UTC. And .replace(' ', 'T'): the hand-made UTC
 *               marker. Use instantMs / clock12 (utils/tz.js).
 *   sql-today   date('now') inside SQL: the database's UTC date as the business day. Bind the day from
 *               the tenant's zone instead (datetime('now') to STAMP a row is right and is not flagged).
 *
 * A line that is correct on purpose carries   // time-ok: why   (same line or the line above); the
 * reason is reviewable, and the count of these is printed.
 *
 *   node scripts/check-time.mjs              everything
 *   node scripts/check-time.mjs <file> ...   just those files
 *
 * Wired into every Vite build (scripts/vite-check-time.mjs), so a violation stops the deploy instead
 * of shipping a wrong time. Uses @babel/parser and @babel/traverse (installed with @vitejs/plugin-react).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const { parse } = require('@babel/parser')
const t0 = require('@babel/traverse')
const traverse = t0.default || t0

const SCAN = ['src', 'functions', 'hosts']
const HOME = new Set(['src/utils/tz.js'])                  // where time lives: free to do anything
const TIME_OPTS = new Set(['hour', 'minute', 'second', 'timeZoneName', 'dateStyle', 'timeStyle', 'hour12', 'hourCycle', 'fractionalSecondDigits'])
const CLOCK_GETTERS = new Set(['getHours', 'getMinutes', 'getSeconds', 'getMilliseconds', 'getTimezoneOffset'])
const SLICES = new Set(['slice', 'substring', 'substr'])
const NOW_GETTERS = new Set(['getFullYear', 'getMonth', 'getDate', 'getDay'])
const NOW_SETTERS = new Set(['setHours', 'setMinutes', 'setSeconds'])

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') out.push(...walk(p)) }
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p)
  }
  return out
}

const name = n => (n && n.type === 'Identifier' ? n.name : n && n.type === 'StringLiteral' ? n.value : null)
const isMember = (n, prop) => n && n.type === 'MemberExpression' && !n.computed && name(n.property) === prop
const isDateCtor = n => n && n.type === 'NewExpression' && n.callee.type === 'Identifier' && n.callee.name === 'Date'
const isDateNow = n => n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && name(n.callee.object) === 'Date' && name(n.callee.property) === 'now'
const containsDateNow = n => {
  if (!n || typeof n !== 'object') return false
  if (isDateNow(n)) return true
  return Object.keys(n).some(k => k !== 'loc' && k !== 'start' && k !== 'end' && Array.isArray(n[k]) ? n[k].some(containsDateNow) : (n[k] && typeof n[k] === 'object' && n[k].type ? containsDateNow(n[k]) : false))
}

// Does this expression hold "the moment now"? new Date(), new Date(Date.now() +/- ...), or a variable
// declared from one of those (one hop).
function isNowDate(node, scope, depth = 0) {
  if (!node) return false
  if (isDateCtor(node)) {
    if (node.arguments.length === 0) return true
    return node.arguments.length === 1 && containsDateNow(node.arguments[0])
  }
  if (node.type === 'Identifier' && scope && depth < 2) {
    const b = scope.getBinding(node.name)
    const init = b && b.path && b.path.node && b.path.node.type === 'VariableDeclarator' ? b.path.node.init : null
    return isNowDate(init, b && b.scope, depth + 1)
  }
  return false
}

export function findProblems(files) {
  const problems = []
  let allowed = 0
  for (const file of files) {
    const rel = relative(root, file).split(sep).join('/')
    if (HOME.has(rel)) continue
    const code = readFileSync(file, 'utf8')
    const lines = code.split(/\r?\n/)
    let ast
    try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }) }
    catch (e) { problems.push({ rel, line: 1, rule: 'parse', msg: 'cannot be parsed: ' + e.message.split('\n')[0] }); continue }
    const isConfig = /^hosts\/[^/]+\/config\.js$/.test(rel)
    const inWorker = rel.startsWith('functions/')

    const report = (node, rule, msg) => {
      const line = node.loc ? node.loc.start.line : 1
      const here = lines[line - 1] || '', above = lines[line - 2] || ''
      if (/time-ok:/.test(here) || /time-ok:/.test(above)) { allowed++; return }
      problems.push({ rel, line, rule, msg, text: here.trim().slice(0, 150) })
    }

    traverse(ast, {
      CallExpression(path) {
        const { callee, arguments: args } = path.node
        // .toLocaleTimeString() / device clock getters
        if (callee.type === 'MemberExpression' && !callee.computed) {
          const m = name(callee.property)
          if (m === 'toLocaleTimeString') report(path.node, 'clock', 'toLocaleTimeString() shows the DEVICE clock: use fmtClock/fmtStamp (utils/dates.js)')
          if (CLOCK_GETTERS.has(m) && args.length === 0) report(path.node, 'clock', `${m}() reads the DEVICE clock: use utils/tz.js`)
          if (m === 'toLocaleString' || m === 'toLocaleDateString') {
            const opts = args[1]
            if (opts && opts.type === 'ObjectExpression') {
              const keys = opts.properties.map(p => name(p.key))
              const bad = keys.filter(k => TIME_OPTS.has(k))
              if (bad.length) report(path.node, 'clock', `${m}() with ${bad.join('/')} formats the time in the DEVICE zone: use fmtClock/fmtStamp (utils/dates.js)`)
              opts.properties.forEach(p => {
                if (name(p.key) === 'timeZone' && !(p.value.type === 'StringLiteral' && p.value.value === 'UTC')) report(p, 'zone', "timeZone: must be the property's zone from config (utils/tz.js); only 'UTC' is allowed, for a plain calendar date")
              })
            }
          }
          // X.toISOString().slice(0, 10)  /  .substring(0, 10)
          if (SLICES.has(m) && callee.object.type === 'CallExpression' && isMember(callee.object.callee, 'toISOString')) {
            const a0 = args[0], a1 = args[1]
            const dateOnly = a0 && a0.type === 'NumericLiteral' && a0.value === 0 && a1 && a1.type === 'NumericLiteral' && a1.value === 10
            if (dateOnly && isNowDate(callee.object.callee.object, path.scope)) report(path.node, 'today', "the UTC date of 'now' is not the property's today: use localTodayStr() (app) or todayInZone(zone) (Worker)")
            if (a0 && a0.type === 'NumericLiteral' && a0.value === 11) report(path.node, 'slice-stamp', 'cutting the clock out of a stamp leaves it in UTC: use clock24/clock12 (utils/tz.js)')
          }
          if (SLICES.has(m) && args[0] && args[0].type === 'NumericLiteral' && args[0].value === 11 && args[1] && args[1].type === 'NumericLiteral' && args[1].value > 11 && !(callee.object.type === 'CallExpression' && isMember(callee.object.callee, 'toISOString'))) {
            report(path.node, 'slice-stamp', `.${m}(11, ${args[1].value}) picks the clock out of a stamp, still in UTC: use clock24/clock12 (utils/tz.js)`)
          }
          // .replace(' ', 'T'): the hand-made UTC marker
          if (m === 'replace' && args[0] && args[0].type === 'StringLiteral' && args[0].value === ' ' && args[1] && args[1].type === 'StringLiteral' && args[1].value === 'T') {
            report(path.node, 'slice-stamp', ".replace(' ', 'T') is the hand-made way to read a stored stamp: use instantMs (utils/tz.js)")
          }
          // "today" made from the machine's clock
          if (NOW_SETTERS.has(m) && isNowDate(callee.object, path.scope)) report(path.node, 'today', `${m}() on the current time makes a "today" from the machine's clock: use localTodayStr()/todayInZone`)
          if (NOW_GETTERS.has(m) && args.length === 0 && isDateCtor(callee.object) && callee.object.arguments.length === 0) report(path.node, 'today', `new Date().${m}() is the machine's date, not the property's: use localTodayStr()/todayInZone`)
        }
        // new Intl.DateTimeFormat is a call-less NewExpression (handled below); Intl.DateTimeFormat(...) as a call:
        if (callee.type === 'MemberExpression' && name(callee.object) === 'Intl' && name(callee.property) === 'DateTimeFormat') report(path.node, 'zone', 'Intl.DateTimeFormat is for utils/tz.js only')
      },
      NewExpression(path) {
        const c = path.node.callee
        if (c.type === 'MemberExpression' && name(c.object) === 'Intl' && name(c.property) === 'DateTimeFormat') report(path.node, 'zone', 'Intl.DateTimeFormat is for utils/tz.js only')
      },
      // X.toISOString().split('T')[0]
      MemberExpression(path) {
        const n = path.node
        // .split('T')[0] / [1] and .split(/[ T]/)[1]
        if (n.computed && n.object.type === 'CallExpression' && isMember(n.object.callee, 'split') && n.property.type === 'NumericLiteral') {
          const sep0 = n.object.arguments[0]
          const idx = n.property.value
          const isT = sep0 && sep0.type === 'StringLiteral' && sep0.value === 'T'
          const isTSpace = sep0 && sep0.type === 'RegExpLiteral' && /^\[ T\]$|^\[T \]$/.test(sep0.pattern)
          const recv = n.object.callee.object
          if (idx === 0 && isT && recv.type === 'CallExpression' && isMember(recv.callee, 'toISOString') && isNowDate(recv.callee.object, path.scope)) {
            report(n, 'today', "the UTC date of 'now' is not the property's today: use localTodayStr() (app) or todayInZone(zone) (Worker)")
          }
          if (idx === 1 && (isT || isTSpace)) report(n, 'slice-stamp', 'splitting a stamp to get its clock leaves it in UTC: use clock24/clock12 (utils/tz.js)')
        }
      },
      StringLiteral(path) {
        const v = path.node.value
        if (/^(Asia\/Kolkata|Asia\/Calcutta)$/.test(v) && !isConfig) report(path.node, 'zone', "the zone is the `timezone` setting (hosts/<id>/config.js); DEFAULT_TIMEZONE in utils/tz.js is the only fallback")
        if (inWorker && /\bdate\s*\(\s*'now'/i.test(v)) report(path.node, 'sql-today', "date('now') is the database's UTC date, not the property's today: bind the day from the tenant's zone")
      },
      TemplateLiteral(path) {
        if (!inWorker) return
        for (const q of path.node.quasis) if (/\bdate\s*\(\s*'now'/i.test(q.value.cooked || q.value.raw)) report(q, 'sql-today', "date('now') is the database's UTC date, not the property's today: bind the day from the tenant's zone")
      },
      NumericLiteral(path) {
        const v = path.node.value
        if (v === 19800000 || v === 19800) report(path.node, 'offset', 'a hard-coded India offset: use utils/tz.js (offsetMs / wallToMs / the zone setting)')
      },
      BinaryExpression(path) {
        const { operator, left, right } = path.node
        if (operator === '*' && [left, right].some(x => x.type === 'NumericLiteral' && x.value === 5.5)) report(path.node, 'offset', 'a hard-coded 5.5-hour India offset: use utils/tz.js')
        if (operator === '*' && left.type === 'NumericLiteral' && left.value === 330 && right.type === 'NumericLiteral' && right.value === 60) report(path.node, 'offset', 'a hard-coded 330-minute India offset: use utils/tz.js')
      },
    })
  }
  return { problems, allowed }
}

export function projectFiles() {
  return SCAN.flatMap(d => { try { return walk(join(root, d)) } catch { return [] } })
}

// Run directly: print and set the exit code.
const here = fileURLToPath(import.meta.url)
if (process.argv[1] && join(process.argv[1]) === join(here)) {
  const args = process.argv.slice(2)
  const files = args.length ? args.map(a => join(process.cwd(), a)) : projectFiles()
  const { problems, allowed } = findProblems(files)
  const byRule = {}
  for (const p of problems) {
    byRule[p.rule] = (byRule[p.rule] || 0) + 1
    console.log(`${p.rel}:${p.line}  [${p.rule}] ${p.msg}${p.text ? '\n      ' + p.text : ''}`)
  }
  console.log(`\ncheck-time: ${files.length} files, ${problems.length} problem(s)${problems.length ? ' (' + Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''}, ${allowed} marked time-ok`)
  process.exit(problems.length ? 1 : 0)
}
