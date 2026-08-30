/**
 * Runs a .sql file against D1 one statement at a time, via `--command`.
 *
 * `wrangler d1 execute --file` uploads through D1's import API, which rejects
 * OAuth logins with a bare "Authentication error [code: 10000]" that looks
 * like a token problem but is not - the same account runs `--command` fine.
 * This walks the file instead, so a migration written as a normal .sql file
 * still applies.
 *
 * Stops at the first real error. "duplicate column name" is treated as already
 * applied, so a half-finished run can simply be repeated.
 *
 *   node scripts/run-sql-file.mjs <db-name> <path-to-sql>
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const [db, file] = process.argv.slice(2)
if (!db || !file) {
  console.error('usage: node scripts/run-sql-file.mjs <db-name> <path-to-sql>')
  process.exit(1)
}

const statements = readFileSync(file, 'utf8')
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))       // strip comment-only lines
  .join('\n')
  .split(';')
  // Collapse to one line: the statement crosses a shell boundary, and embedded
  // newlines arrive at D1 as a truncated statement ("incomplete input").
  .map(s => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

console.log(`  ${statements.length} statements against ${db}\n`)
let applied = 0, skipped = 0

for (const [i, sql] of statements.entries()) {
  const label = sql.replace(/\s+/g, ' ').slice(0, 66)
  try {
    // shell:true because Node cannot spawn npx.cmd directly on Windows.
    execFileSync('npx', ['wrangler', 'd1', 'execute', db, '--remote', '--command', `"${sql.replace(/"/g, '\\"')}"`],
      { encoding: 'utf8', shell: true, stdio: 'pipe' })
    applied++
    console.log(`  ${String(i + 1).padStart(2)}/${statements.length}  ok       ${label}`)
  } catch (e) {
    const msg = `${e.stdout || ''}${e.stderr || ''}`
    if (/duplicate column name/i.test(msg)) {
      skipped++
      console.log(`  ${String(i + 1).padStart(2)}/${statements.length}  already  ${label}`)
      continue
    }
    console.error(`\n  FAILED at statement ${i + 1}:\n  ${sql}\n`)
    console.error(msg.split('\n').filter(l => /error|ERROR/i.test(l)).join('\n'))
    process.exit(1)
  }
}
console.log(`\n  ${applied} applied, ${skipped} already present.`)
