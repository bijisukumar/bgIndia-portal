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
import { pathToFileURL } from 'node:url'
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
  // shell:true is required on Windows — Node refuses to spawn a .cmd
  // directly (EINVAL) since the 18.20/20.x security change, and npx resolves
  // to npx.cmd here.
  const out = execFileSync('npx', 
    ['wrangler', 'd1', 'execute', 'bgindia-db', '--remote', '--file', file],
    { encoding: 'utf8', cwd: root, shell: true })
  const m = out.match(/"changes":\s*(\d+)/)
  console.log(`\n  Applied. changes: ${m ? m[1] : 'see output above'}`)
} finally {
  try { unlinkSync(file) } catch { /* best effort */ }
}

// Read back what is actually stored and compare it with what we meant to
// store. "Applied." only means wrangler returned; it has twice been printed
// while the row stayed stale — once from a Windows spawn failure, once from a
// run whose error went to stderr and was filtered away. Both times the gap was
// found much later, by a feature quietly missing its data. Verifying here
// makes the script itself the thing that notices.
let stale = 0
for (const host of hosts) {
  const mod = await import(`${pathToFileURL(join(root, 'hosts', host, 'config.js')).href}?v=${Date.now()}`)
  // SQLite length() counts code points; JS .length counts UTF-16 units, so
  // every emoji in a message template would read as a phantom 1-char gap.
  const expected = Array.from(JSON.stringify(mod.CONFIG)).length
  let got = 0
  try {
    const check = execFileSync('npx',
      ['wrangler', 'd1', 'execute', 'bgindia-db', '--remote', '--command',
       `"SELECT length(config_json) AS n FROM platform_tenant_config WHERE tenant_id='${host}'"`],
      { encoding: 'utf8', cwd: root, shell: true })
    got = Number((check.match(/"n":\s*(\d+)/) || [])[1] || 0)
  } catch (e) {
    console.error(`  could not verify ${host}: ${e.message}`)
  }
  const ok = got === expected
  if (!ok) stale++
  console.log(`  ${ok ? 'verified' : 'MISMATCH'}  ${host.padEnd(12)} db=${got} file=${expected}`)
}
if (stale) {
  console.error(`\n  ${stale} tenant(s) did NOT store correctly — the database still holds stale config.`)
  process.exitCode = 1
} else {
  console.log('\n  All tenants verified against the database.')
}
