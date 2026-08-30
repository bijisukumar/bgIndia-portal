/**
 * Copies one tenant's rows from a per-tenant D1 database into the shared one.
 *
 * Written for the demovilla merge: demovilla started life in its own database,
 * back when the plan was a database per tenant. That plan was dropped - keeping
 * schemas in sync across databases is the painful part, and a shared database
 * with villa_id scoping is now enforced by scripts/check-tenant-scope.mjs. This
 * brings the demo in as the platform's second real tenant, which also makes it
 * the first live test that the scoping actually isolates anything.
 *
 * Rows are written with INSERT OR IGNORE so a partial run can be repeated.
 * villa_id is forced on every table that has the column, so a source row that
 * predates the column still lands correctly scoped.
 *
 * platform_auth_tokens is deliberately NOT copied - see the notes at the end.
 *
 *   node scripts/copy-tenant-data.mjs <source-db> <target-db> <villa-id> [--apply]
 */
import { execFileSync } from 'node:child_process'

const [srcDb, dstDb, villaId, ...flags] = process.argv.slice(2)
const apply = flags.includes('--apply')
if (!srcDb || !dstDb || !villaId) {
  console.error('usage: node scripts/copy-tenant-data.mjs <source-db> <target-db> <villa-id> [--apply]')
  process.exit(1)
}

const TABLES = [
  'stayvibe_stays', 'stayvibe_guests', 'stayvibe_inventory',
  'stayvibe_villa_rate_cards', 'stayvibe_manager_commissions', 'stayvibe_incidentals',
]

function q(db, sql) {
  // The statement travels as one shell argument, so any double quote inside it
  // has to be escaped. Built by code point to keep this readable when the file
  // itself is generated.
  const escaped = sql.split('"').join(String.fromCharCode(92) + '"')
  let out
  try {
    out = execFileSync('npx',
      ['wrangler', 'd1', 'execute', db, '--remote', '--json', '--command', '"' + escaped + '"'],
      { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024, stdio: 'pipe' })
  } catch (e) {
    // Deliberately does not echo the statement: a failed batch is thousands of
    // rows of guest data, and dumping it helps nobody.
    const raw = String(e.stderr || e.stdout || e.message)
    const line = raw.split(String.fromCharCode(10)).find(l => /error|too long/i.test(l)) || raw
    throw new Error(db + ': ' + line.trim().slice(0, 200))
  }
  const json = JSON.parse(out.slice(out.indexOf('[')))
  return json[0].results
}

// SQLite literal. Numbers stay bare so numeric columns keep their type.
const lit = v =>
  v === null || v === undefined ? 'NULL'
  : typeof v === 'number' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`

let grandTotal = 0
for (const table of TABLES) {
  const rows = q(srcDb, `SELECT * FROM ${table}`)
  if (!rows.length) { console.log(`  ${table.padEnd(30)} empty, skipped`); continue }

  const dstCols = new Set(q(dstDb, `SELECT name FROM pragma_table_info('${table}')`).map(r => r.name))
  const cols = Object.keys(rows[0]).filter(c => dstCols.has(c))
  const hasVilla = dstCols.has('villa_id')
  const outCols = hasVilla && !cols.includes('villa_id') ? [...cols, 'villa_id'] : cols

  // Batch by character budget: the statement crosses a Windows command line,
  // which truncates well before a few hundred rows of 81 columns would fit.
  const values = rows.map(r => {
    const vals = cols.map(c => lit(r[c]))
    if (hasVilla) {
      const i = outCols.indexOf('villa_id')
      if (i < cols.length) vals[i] = lit(villaId)     // force, never trust the source
      else vals.push(lit(villaId))
    }
    return `(${vals.join(',')})`
  })

  // Windows caps a command line at ~8191 characters, and the whole statement
  // travels as one argument. Budget against that, not against D1's limits.
  const prefix = `INSERT OR IGNORE INTO ${table} (${outCols.join(',')}) VALUES `
  const BUDGET = 7000 - prefix.length

  let batch = [], size = 0, written = 0
  const flush = () => {
    if (!batch.length) return
    if (apply) q(dstDb, prefix + batch.join(','))
    written += batch.length
    batch = []; size = 0
  }
  for (const v of values) {
    if (batch.length && size + v.length > BUDGET) flush()
    batch.push(v); size += v.length + 1
  }
  flush()

  grandTotal += written
  console.log(`  ${table.padEnd(30)} ${String(written).padStart(4)} rows${apply ? '' : ' (dry run)'}`)
}

console.log(`\n  ${grandTotal} rows ${apply ? 'copied' : 'would be copied'}.`)
if (!apply) console.log('  Re-run with --apply to write.')
