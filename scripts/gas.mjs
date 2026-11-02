/**
 * Runs clasp across every Apps Script project in apps-script/.
 *
 *   node scripts/gas.mjs pull     bring the live scripts down
 *   node scripts/gas.mjs status   show what a push would send
 *   node scripts/gas.mjs push     overwrite the live scripts
 *
 * Why this exists rather than running clasp by hand: there are three projects,
 * and the dangerous one is push. Doing it per-directory invites pushing the
 * wrong project, or pushing one and forgetting the others.
 *
 * PUSH REFUSES TO RUN ON A DIRTY TREE. The repo is only the source of truth if
 * what is in it has been reviewed and committed; pushing uncommitted edits
 * means the live script holds something no commit records, which is the exact
 * drift clasp was adopted to end.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = join(root, 'apps-script')
const cmd = (process.argv[2] || '').toLowerCase()

if (!['pull', 'push', 'status'].includes(cmd)) {
  console.error('usage: node scripts/gas.mjs <pull|status|push>')
  process.exit(1)
}

const projects = readdirSync(base, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(base, d.name, '.clasp.json')))
  .map(d => d.name)

if (!projects.length) {
  console.error('  No projects found under apps-script/')
  process.exit(1)
}

// Unconfigured projects are skipped rather than failing the run: a half
// set-up repo should still be able to pull the projects that are ready.
const configured = []
for (const name of projects) {
  const cfg = JSON.parse(readFileSync(join(base, name, '.clasp.json'), 'utf8'))
  if (!cfg.scriptId || cfg.scriptId.startsWith('PASTE_')) {
    console.log(`  ${name.padEnd(20)} skipped - no script id in .clasp.json yet`)
    continue
  }
  configured.push(name)
}
if (!configured.length) {
  console.error('\n  Nothing to do. Put each script id in its .clasp.json first')
  console.error('  (the id is in the editor URL: /projects/<SCRIPT_ID>/edit).')
  process.exit(1)
}

if (cmd === 'push') {
  // shell:true throughout - Node will not spawn npx.cmd directly on Windows.
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: root }).trim()
  if (dirty) {
    console.error('  Refusing to push with uncommitted changes.\n')
    console.error(dirty.split('\n').slice(0, 10).map(l => '    ' + l).join('\n'))
    console.error('\n  Commit first. A live script holding something no commit records is')
    console.error('  the drift this was set up to end.')
    process.exit(1)
  }
  console.log('  Pushing OVERWRITES the live scripts. Pull first if unsure.\n')
}

let failed = 0
for (const name of configured) {
  const dir = join(base, name)
  const args = cmd === 'status' ? ['clasp', 'status']
    : cmd === 'pull' ? ['clasp', 'pull']
    : ['clasp', 'push', '--force']
  try {
    const out = execFileSync('npx', args, { encoding: 'utf8', cwd: dir, shell: true, stdio: 'pipe' })
    console.log(`  ${name}`)
    console.log(out.split('\n').filter(Boolean).map(l => '    ' + l).join('\n'))
  } catch (e) {
    failed++
    const msg = String(e.stderr || e.stdout || e.message)
    console.error(`  ${name}  FAILED`)
    console.error(msg.split('\n').filter(Boolean).slice(0, 6).map(l => '    ' + l).join('\n'))
  }
}

if (cmd === 'pull') {
  console.log('\n  Pulled. Now read `git diff` before trusting the repo:')
  console.log('  anything that appears is something the editor had and the repo did not.')
}
if (failed) process.exitCode = 1
