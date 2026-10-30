// Runs scripts/check-partners.mjs at the start of every Vite build, so a booking platform's name or rate written in the code stops the
// deploy instead of reaching a screen. What a platform is, keeps and does belongs in the partner files (/partners) and a host's config.
//
// A violation fails the build. If the checker itself cannot run (a broken install), the build is NOT stopped: that is a warning, so a
// tooling problem can never keep a fix from shipping.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

export function checkPartners() {
  return {
    name: 'check-partners',
    apply: 'build',
    buildStart() {
      const root = process.cwd()
      const r = spawnSync(process.execPath, [path.resolve(root, 'scripts', 'check-partners.mjs')], { cwd: root, encoding: 'utf8' })
      if (r.status === 0) return
      if (r.status === 1) {
        this.error('A booking platform\'s name or rate is written in the code. Describe it in /partners (or the host\'s `partners` block in ' +
          'hosts/<id>/config.js) and read it through src/utils/partners.js. Details:\n' + String(r.stdout || '').split('\n').slice(0, 60).join('\n'))
      }
      this.warn('check-partners could not run (exit ' + r.status + '): ' + String(r.stderr || (r.error && r.error.message) || '').slice(0, 300))
    },
  }
}
