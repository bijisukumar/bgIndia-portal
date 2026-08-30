/**
 * Fails when a SQL statement against a tenant table has no tenant scope.
 *
 * This exists because the central guard in [[route]].js validates villa ids the
 * caller SENDS. A query that never mentions a villa is invisible to it, so the
 * guard could be complete and correct while a report still summed every
 * tenant's rows together. That is not a hypothetical: the "mark commissions
 * paid" UPDATE had no villa filter at all, so one tenant's owner paying their
 * manager would have marked another tenant's commissions paid.
 *
 * A statement passes if it filters on villa_id, is keyed by a specific record
 * id or token, or is explicitly exempted. Exemptions must be declared, never
 * inferred - write the marker on the line above the statement:
 *
 *   // tenant-scope-exempt: <reason>
 *
 * Cron sweeps and public token lookups are the usual honest exemptions.
 *
 *   node scripts/check-tenant-scope.mjs
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'functions/api/[[route]].js'
const src = readFileSync(join(root, FILE), 'utf8')

// Reference data shared by every tenant: the OTA list and its default
// commission rates. Not tenant data, so it needs no scope.
const GLOBAL_TABLES = new Set(['stayvibe_channels'])

const violations = []
const exempted = []
const sqlRe = /`([^`]*?(?:SELECT|INSERT|UPDATE|DELETE)[^`]*?)`/gis

for (const m of src.matchAll(sqlRe)) {
  const flat = m[1].replace(/\s+/g, ' ').trim()
  const tables = [...flat.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-z0-9_]+)/gi)].map(x => x[1])
  const tenantTables = [...new Set(tables)].filter(t => t.startsWith('stayvibe_') && !GLOBAL_TABLES.has(t))
  if (!tenantTables.length) continue

  const line = src.slice(0, m.index).split('\n').length
  // Scoped explicitly, or keyed to one record/token the caller already proved
  // access to. `?` only - a bare `= 'literal'` is not proof of anything.
  // villaScope() emits ` AND villa_id IN (?,?)` at runtime, so a statement
  // interpolating `${someScope.sql}` is scoped even though the literal text
  // never says villa_id.
  const scoped = /villa_id/.test(flat) || /\$\{\w+\.sql\}/.test(flat)
  const keyed  = /\b\w*(?:_id|token)\s*=\s*\?/i.test(flat)

  if (scoped || keyed) continue

  // Look back a few lines for a declared exemption.
  const before = src.slice(0, m.index).split('\n').slice(-4).join('\n')
  const ex = before.match(/\/\/\s*tenant-scope-exempt:\s*(.+)/)
  if (ex) { exempted.push({ line, reason: ex[1].trim() }); continue }

  const verb = (flat.match(/\b(SELECT|INSERT|UPDATE|DELETE)\b/i) || [''])[0].toUpperCase()
  violations.push({ line, verb, tables: tenantTables, sql: flat.slice(0, 100) })
}

// Writes first: an unscoped UPDATE or DELETE corrupts another tenant's data
// rather than merely exposing it.
const weight = v => ({ UPDATE: 0, DELETE: 1, SELECT: 2, INSERT: 3 })[v.verb] ?? 4
violations.sort((a, b) => weight(a) - weight(b) || a.line - b.line)

for (const v of violations) {
  console.log(`  ${FILE}:${v.line}  ${v.verb.padEnd(6)} ${v.tables.join(',')}`)
  console.log(`      ${v.sql}`)
}
console.log(`\n  ${violations.length} unscoped, ${exempted.length} declared exempt`)
if (violations.length) {
  console.error('\n  Add a villa_id filter, or declare "// tenant-scope-exempt: <reason>" above it.')
  process.exitCode = 1
}
