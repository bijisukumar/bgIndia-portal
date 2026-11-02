# Apps Script projects

The Google Apps Script editor used to be the source of truth and `scripts/*.gs`
a hopeful copy of it. Nothing kept the two in step, and by late 2026 three
places could change the same file: this machine, the other machine, and the
editor itself. A fix made in one was invisible to the others until something
broke.

clasp makes the repo authoritative. Each project below is a directory with its
own `.clasp.json` (which holds only the script id — not a secret, it is in the
editor's own URL) and an `appsscript.json` manifest.

## Before anything else: log in

    npx clasp login

This opens a browser and writes a credential to your home directory. It is
never stored in this repo, and nobody should paste it anywhere.

## The one rule: pull before you push

`clasp push` overwrites the live script completely. Until a project has been
pulled at least once and the difference reconciled, **the repo is not yet known
to match live** and pushing would silently discard whatever is only in the
editor.

    npm run gas:pull     # bring live down, then read `git diff` carefully
    npm run gas:push     # only once the diff is understood and intended

`gas:pull` is safe and repeatable. `gas:push` is not, so it is deliberately not
wired into any build, deploy or hook.

## Finding a script id

Open the project in the Apps Script editor. The URL is:

    https://script.google.com/.../projects/<SCRIPT_ID>/edit

Paste that id into the matching `.clasp.json`.

## Triggers and properties are not code

clasp syncs files. It does **not** sync time-based triggers or script
properties, which live only in the editor. A pushed script with no trigger
never runs, and one with no properties cannot authenticate - and neither says
so. **See CONFIG.md** for what every project needs, which values are set by
hand, and the one trigger that exists in no code at all.
