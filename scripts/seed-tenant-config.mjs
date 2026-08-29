/**
 * Push hosts/<id>/config.js into platform_tenant_config.
 *
 * Since config moved into the database, editing a host config file on its own
 * changes nothing — the running app reads the database, and the file is only
 * the offline fallback. Anyone who edits a config and does not run this will
 * watch their change do nothing and have no idea why.
 *
 *   node scripts/seed-tenant-config.mjs            # all hosts, dry run
 *   node scripts/seed-tenant-config.mjs --apply    # write to the database
 *   node scripts/seed-tenant-config.mjs dwarka --apply
 *
 * Writes to bgindia-db. The demo tenant lives in demovilla-db but keeps a
 * config row in both, so it is seeded to bgindia-db here as well — that is
 * where getAppConfig reads from for every hostname on the shared worker.
 */
import { readdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const only = args.filter(a => !a.startsWith('--'))

const hosts = (only.length ? only : readdirSync(join(root, 'hosts')))
  .filter(h => !h.startsWith('.'))

if (!hosts.length) {
  console.error('No hosts found under hosts/')
  process.exit(1)
}

const statements = []
for (const host of hosts) {
  // Cache-bust the import so repeated runs in one process see edits.
  const mod = await import(`file:///${join(root, 'hosts', host, 'config.js').replace(/\\/g, '/')}?v=${Date.now()}`)
  const json = JSON.stringify(mod.CONFIG)
  console.log(`  ${host.padEnd(12)} ${json.length} chars, ${Object.keys(mod.CONFIG).length} keys`)
  // SQLite escapes a single quote by doubling it.
  statements.push(
    `INSERT INTO platform_tenant_config (tenant_id, config_json) VALUES ('${host}', '${json.replace(/'/g, "''")}')\n` +
    `  ON CONFLICT(tenant_id) DO UPDATE SET config_json = excluded.config_json, updated_at = datetime('now');`
  )
}

if (!apply) {
  console.log('\n  Dry run. Re-run with --apply to write to the database.')
  process.exit(0)
}

const file = join(tmpdir(), `seed-tenant-config-${Date.now()}.sql`)
writeFileSync(file, statements.join('\n') + '\n', 'utf8')
try {
  const out = execFileSync('npx.cmd',
    ['wrangler', 'd1', 'execute', 'bgindia-db', '--remote', '--file', file],
    { encoding: 'utf8', cwd: root })
  const m = out.match(/"changes":\s*(\d+)/)
  console.log(`\n  Applied. changes: ${m ? m[1] : 'see output above'}`)
} finally {
  try { unlinkSync(file) } catch { /* best effort */ }
}
