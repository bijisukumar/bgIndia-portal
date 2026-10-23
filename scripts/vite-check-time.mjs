// Runs scripts/check-time.mjs at the start of every Vite build, so a time that is shown or decided the
// old way (the raw UTC clock, the machine's date as "today", a hard-coded India offset) stops the deploy
// instead of reaching a screen. That is what had let the same bug come back three times.
//
// A violation fails the build. If the checker itself cannot run (a broken install), the build is NOT
// stopped: that is a warning, so a tooling problem can never keep a fix from shipping.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

export function checkTime() {
  return {
    name: 'check-time',
    apply: 'build',
    buildStart() {
      const root = process.cwd()
      const r = spawnSync(process.execPath, [path.resolve(root, 'scripts', 'check-time.mjs')], { cwd: root, encoding: 'utf8' })
      if (r.status === 0) return
      if (r.status === 1) {
        this.error('A time is shown or decided the old way. Use src/utils/tz.js (utils/dates.js in the app, the zone helpers in the Worker); ' +
          'a line that is right on purpose carries "// time-ok: why". Details:\n' + String(r.stdout || '').split('\n').slice(0, 80).join('\n'))
      }
      this.warn('check-time could not run (exit ' + r.status + '): ' + String(r.stderr || (r.error && r.error.message) || '').slice(0, 300))
    },
  }
}
