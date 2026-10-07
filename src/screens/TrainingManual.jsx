// Route: /Training-Manual   (no app login — like /flexibility)
// The owner training manual.
//
// Its words are NOT in this file or anywhere in the browser bundle. They live
// in content/trainingManual.js, which only the API imports, and are sent after
// an access check (getTrainingManual in functions/api/[[route]].js): open to
// anyone with the link, or — when the owner has locked it — only to someone
// holding a passcode, or the signed-in owner. Importing that file here would
// put the text back in public JavaScript and make every passcode decorative.
//
// This file only lays the text out. Deep links work on every section:
//   /Training-Manual#channel-mix   /Training-Manual#dashboard   …

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONFIG } from '../config'
import { useAuth } from '../hooks/useAuth'
import { guestBaseUrl } from '../utils/guestMessages'
import { whenLong } from '../utils/localWhen'

const FALLBACK_TITLE = 'Owner Training Manual'
const CODE_KEY = 'tm_passcode'
// The manual's content, once the server has let this visitor in.
const ManualCtx = createContext(null)

// ── Inline markup: **bold**, [[on-screen label]], {{section-id|link text}} ──
const TOKEN = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\]|\{\{[^}|]+\|[^}]+\}\})/g

function jump(e, id) {
  const el = document.getElementById(id)
  if (!el) return
  e.preventDefault()
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // replaceState, not a hash change: a manual is read by jumping around, and
  // each jump should not become a Back-button step.
  try { window.history.replaceState(null, '', `#${id}`) } catch { /* private mode */ }
}

function Rich({ text }) {
  return String(text).split(TOKEN).map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('[[')) return <span key={i} className="tm-ui">{p.slice(2, -2)}</span>
    if (p.startsWith('{{')) {
      const [id, label] = p.slice(2, -2).split('|')
      return <a key={i} href={`#${id}`} className="tm-link" onClick={e => jump(e, id)}>{label}</a>
    }
    return p
  })
}

const Paras = ({ items }) => (items || []).map((t, i) => <p key={i}><Rich text={t} /></p>)

// ── Copy-a-link button beside every heading ──────────────────────────────
function useCopyLink() {
  const [copied, setCopied] = useState(null)
  async function copy(id) {
    const url = `${guestBaseUrl()}/Training-Manual#${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      setTimeout(() => setCopied(c => (c === id ? null : c)), 1800)
    } catch {
      window.prompt('Copy this link', url)   // clipboard refused — hand over the link to copy by hand
    }
  }
  return [copied, copy]
}

function Title({ id, level = 3, icon, children, copied, onCopy }) {
  const H = `h${level}`
  return (
    <H className="tm-title">
      {icon && <span className="tm-ico" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
      {id && (
        <button type="button" className="tm-copy" onClick={() => onCopy(id)}
          aria-label="Copy a link to this section" title="Copy a link to this section">
          {copied === id ? '✓ copied' : '🔗'}
        </button>
      )}
    </H>
  )
}

function Field({ label, children }) {
  return (
    <div className="tm-field">
      <div className="tm-label">{label}</div>
      <div className="tm-body">{children}</div>
    </div>
  )
}

const Gain = ({ children }) => (
  <div className="tm-gain"><span aria-hidden="true">✦</span> <b>What you gain:</b> {children}</div>
)

const Callout = ({ tone = 'note', title, children }) => (
  <div className={`tm-callout tm-callout-${tone}`}>
    {title && <div className="tm-callout-title">{title}</div>}
    {children}
  </div>
)

function Steps({ items }) {
  return <ol className="tm-steps">{items.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ol>
}

function Inside({ label, items }) {
  if (!items?.length) return null
  return (
    <Field label={label || 'Inside'}>
      <dl className="tm-inside">
        {items.map((it, i) => (
          <div key={i} className="tm-inside-row">
            <dt>{it.name}</dt>
            <dd>
              <Rich text={it.text} />
              {it.bullets && <ul className="tm-bullets tm-tight">{it.bullets.map((t, j) => <li key={j}><Rich text={t} /></li>)}</ul>}
            </dd>
          </div>
        ))}
      </dl>
    </Field>
  )
}

// ── A home-screen block ──────────────────────────────────────────────────
function BlockCard({ b, copied, onCopy }) {
  const { KINDS } = useContext(ManualCtx)
  const k = KINDS[b.kind]
  return (
    <article id={b.id} className={`tm-card tm-block tm-kind-${b.kind}${b.featured ? ' tm-featured' : ''}`}>
      <Title id={b.id} icon={b.icon} copied={copied} onCopy={onCopy}>{b.name}</Title>
      <p className="tm-tldr">{b.tldr}</p>
      <div className="tm-chips">
        <span className="tm-chip tm-chip-kind">{k.label}</span>
        <span className="tm-chip">shows: {b.when}</span>
      </div>
      <Field label="What it is">
        <Paras items={b.what} />
        {b.bullets && <ul className="tm-bullets">{b.bullets.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul>}
      </Field>
      <Field label="When you will see it"><p><Rich text={b.shows} /></p></Field>
      {b.detail && (
        <Field label="How it works">
          <dl className="tm-inside">
            {b.detail.map((d, i) => (
              <div key={i} className="tm-inside-row"><dt>{d.name}</dt><dd><Rich text={d.text} /></dd></div>
            ))}
          </dl>
        </Field>
      )}
      <Field label="Why it is here"><p><Rich text={b.why} /></p></Field>
      <Gain><Rich text={b.gain} /></Gain>
      {b.steps && <Field label="What to do"><Steps items={b.steps} /></Field>}
      {b.example && <Callout tone="example" title="Worked example"><p><Rich text={b.example} /></p></Callout>}
      {b.faq && (
        <Field label="Common questions">
          {b.faq.map((f, i) => (
            <div key={i} className="tm-qa"><div className="tm-q">{f.q}</div><div><Rich text={f.a} /></div></div>
          ))}
        </Field>
      )}
      {b.note && <Callout><Rich text={b.note} /></Callout>}
    </article>
  )
}

// ── A screen inside a tile ───────────────────────────────────────────────
function ScreenCard({ s, copied, onCopy }) {
  return (
    <article id={s.id} className="tm-screen">
      <Title id={s.id} level={4} icon={s.icon} copied={copied} onCopy={onCopy}>{s.name}</Title>
      <div className="tm-opens">Opens from: {s.opens}</div>
      <Paras items={s.does} />
      {s.why && <Field label="Why it is here"><p><Rich text={s.why} /></p></Field>}
      <Inside label={s.insideLabel} items={s.inside} />
      {s.gain && <Gain><Rich text={s.gain} /></Gain>}
      {s.note && <Callout><Rich text={s.note} /></Callout>}
    </article>
  )
}

// ── A menu tile ──────────────────────────────────────────────────────────
function TileCard({ t, copied, onCopy }) {
  return (
    <article id={t.id} className="tm-card tm-tile">
      <Title id={t.id} icon={t.icon} copied={copied} onCopy={onCopy}>{t.name}</Title>
      <div className="tm-chips"><span className="tm-chip tm-chip-kind">Tile</span><span className="tm-chip">{t.opens}</span></div>
      {t.tagline && <p className="tm-tagline">{t.tagline}</p>}
      <Field label="What it is"><Paras items={t.what} /></Field>
      {t.why && <Field label="Why it is here"><p><Rich text={t.why} /></p></Field>}
      <Inside label={t.insideLabel} items={t.inside} />
      {t.gain && <Gain><Rich text={t.gain} /></Gain>}
      {t.steps && <Field label="Try it"><Steps items={t.steps} /></Field>}
      {t.note && <Callout><Rich text={t.note} /></Callout>}
      {t.screens && (
        <div className="tm-screens">
          <div className="tm-label">Inside {t.name}</div>
          {t.screens.map(s => <ScreenCard key={s.id} s={s} copied={copied} onCopy={onCopy} />)}
        </div>
      )}
    </article>
  )
}

// ── "Your home screen at a glance" ───────────────────────────────────────
function HomeMap({ KINDS, HOME_ORDER, TILE_GROUPS, BLOCK_BY_ID, TILE_BY_ID }) {
  return (
    <div className="tm-phone" role="group" aria-label="Your home screen, top to bottom">
      <div className="tm-phone-head">
        <b>{CONFIG.brandName}</b>
        <span>OWNER</span>
      </div>
      {HOME_ORDER.map(id => {
        const b = BLOCK_BY_ID[id]
        return (
          <a key={id} href={`#${id}`} onClick={e => jump(e, id)} className={`tm-row tm-kind-${b.kind}`}>
            <span className="tm-row-ico" aria-hidden="true">{b.icon}</span>
            <span className="tm-row-main">
              <span className="tm-row-name">{b.name}</span>
              <span className="tm-row-when">{b.when}</span>
            </span>
            <span className="tm-chip tm-chip-kind">{KINDS[b.kind].label}</span>
          </a>
        )
      })}
      {TILE_GROUPS.map(g => (
        <div key={g.label}>
          <div className="tm-phone-group">{g.label}</div>
          {g.ids.map(id => {
            const t = TILE_BY_ID[id]
            return (
              <a key={id} href={`#${id}`} onClick={e => jump(e, id)} className="tm-row tm-kind-tile">
                <span className="tm-row-ico" aria-hidden="true">{t.icon}</span>
                <span className="tm-row-main">
                  <span className="tm-row-name">{t.name}</span>
                  <span className="tm-row-when">{t.tagline}</span>
                </span>
                <span className="tm-chev" aria-hidden="true">›</span>
              </a>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// The manual proper. Mounted only once the server has handed over the content,
// so everything it needs is already here and a deep link's target exists.
function ManualBody({ content, access, isOwner }) {
  const {
    UPDATED, TITLE, TAGLINE, INTRO, IDEAS, KINDS, HOME_ORDER, TILE_GROUPS, LAYOUT,
    BLOCKS, TILES, GUEST_PAGES, MANAGER, FIRST_WEEK, ROUTINES, BY_GOAL, GLOSSARY, FAQ,
  } = content
  const BLOCK_BY_ID = useMemo(() => Object.fromEntries(BLOCKS.map(b => [b.id, b])), [BLOCKS])
  const TILE_BY_ID  = useMemo(() => Object.fromEntries(TILES.map(t => [t.id, t])), [TILES])
  const [copied, onCopy] = useCopyLink()

  // Land on a deep link (/Training-Manual#channel-mix). This page scrolls inside
  // #root, not the window, so the browser's own jump to the fragment is a race
  // with React rendering and often misses — scroll explicitly, a few times as
  // fonts and layout settle, and stop the moment the reader scrolls themselves.
  // (Same approach, and the same reasons, as the /flexibility page.)
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    let touched = false
    const stop = () => { touched = true }
    const events = ['wheel', 'touchstart', 'keydown', 'mousedown']
    events.forEach(e => window.addEventListener(e, stop, { passive: true }))
    const go = () => { if (!touched) document.getElementById(id)?.scrollIntoView() }
    go()
    document.fonts?.ready.then(go)
    const late = setTimeout(go, 400)
    return () => { clearTimeout(late); events.forEach(e => window.removeEventListener(e, stop)) }
  }, [])

  const blocksByKind = kind => BLOCKS.filter(b => b.kind === kind)

  return (
    <ManualCtx.Provider value={content}>
      <nav className="tm-nav" aria-label="Sections">
        <div className="tm-nav-in">
          {LAYOUT.nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={e => jump(e, id)}>{label}</a>
          ))}
        </div>
      </nav>

      <div className="tm-wrap">
        {/* Who this visitor is, when it matters: someone invited with a
            passcode sees when it runs out; the owner sees that outsiders are
            being kept out. Neither is shown when the manual is simply open. */}
        {access.kind === 'passcode' && (
          <div className="tm-banner" role="status">
            🔐 Shared with you by invitation{access.expiresAt ? <> · your access ends <b>{whenLong(access.expiresAt)}</b></> : null}
          </div>
        )}
        {access.kind === 'owner' && access.mode === 'passcode' && (
          <div className="tm-banner" role="status">
            🔐 This manual is locked to people with a passcode. You can always read it while you are signed in.
          </div>
        )}

        {/* ── Hero ───────────────────────────────────────────── */}
        <header id="start" className="tm-hero">
          <div className="tm-brand">
            <img src="/icons/StayVibe360Logo.png" alt="" onError={e => { e.target.style.display = 'none' }} />
            <span>StayVibe360 · {CONFIG.brandName}</span>
          </div>
          <div className="tm-badge">📘 {TITLE.toUpperCase()}</div>
          <h1>{TAGLINE}</h1>
          {INTRO.map((p, i) => <p key={i} className="tm-lead"><Rich text={p} /></p>)}
          <div className="tm-actions">
            <button type="button" className="tm-btn" onClick={() => window.print()}>🖨 Print / save as PDF</button>
            <Link to="/" className="tm-btn tm-btn-ghost">Open your home screen →</Link>
            {isOwner && <Link to="/owner/maintenance/manual-access" className="tm-btn tm-btn-ghost">🔐 Who can read this</Link>}
          </div>
          <div className="tm-updated">Describes the app as it works on {UPDATED}.</div>
        </header>

        {/* ── Ideas ──────────────────────────────────────────── */}
        <section id="ideas" aria-labelledby="ideas-h">
          <h2 id="ideas-h" className="tm-h2">{LAYOUT.ideas.h}</h2>
          <div className="tm-ideas">
            {IDEAS.map((d, i) => (
              <div key={i} className="tm-idea">
                <div className="tm-idea-ico" aria-hidden="true">{d.icon}</div>
                <h3>{d.title}</h3>
                <p><Rich text={d.body} /></p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Home map ───────────────────────────────────────── */}
        <section id="map" aria-labelledby="map-h">
          <h2 id="map-h" className="tm-h2">{LAYOUT.map.h}</h2>
          <p className="tm-sub">{LAYOUT.map.sub}</p>
          <div className="tm-mapwrap">
            <HomeMap KINDS={KINDS} HOME_ORDER={HOME_ORDER} TILE_GROUPS={TILE_GROUPS} BLOCK_BY_ID={BLOCK_BY_ID} TILE_BY_ID={TILE_BY_ID} />
            <aside className="tm-legend" aria-label="How to read the map">
              <div className="tm-label">{LAYOUT.map.legendTitle}</div>
              {Object.entries(KINDS).map(([k, v]) => (
                <div key={k} className={`tm-legend-row tm-kind-${k}`}>
                  <span className="tm-chip tm-chip-kind">{v.label}</span>
                  <span>{v.blurb}</span>
                </div>
              ))}
              <div className={`tm-legend-row tm-kind-tile`}>
                <span className="tm-chip tm-chip-kind">Tile</span>
                <span>{LAYOUT.map.legendTile}</span>
              </div>
              <p className="tm-legend-tip">{LAYOUT.map.legendTip}</p>
            </aside>
          </div>
        </section>

        {/* ── Home blocks ────────────────────────────────────── */}
        <section id="home-blocks" aria-labelledby="blocks-h">
          <h2 id="blocks-h" className="tm-h2">{LAYOUT.blocks.h}</h2>
          {LAYOUT.kindGroups.map(([kind, label, blurb]) => (
            <div key={kind} className="tm-group">
              <h3 className="tm-h3">{label}</h3>
              <p className="tm-sub">{blurb}</p>
              {blocksByKind(kind).map(b => <BlockCard key={b.id} b={b} copied={copied} onCopy={onCopy} />)}
            </div>
          ))}
        </section>

        {/* ── Tiles and screens ──────────────────────────────── */}
        <section id="screens" aria-labelledby="screens-h">
          <h2 id="screens-h" className="tm-h2">{LAYOUT.screens.h}</h2>
          <p className="tm-sub">{LAYOUT.screens.sub}</p>
          {TILE_GROUPS.map(g => (
            <div key={g.label} className="tm-group">
              <h3 className="tm-h3">{g.label}</h3>
              {g.ids.map(id => <TileCard key={id} t={TILE_BY_ID[id]} copied={copied} onCopy={onCopy} />)}
            </div>
          ))}
        </section>

        {/* ── Pages guests and partners see ─────────────────── */}
        <section id="guest-pages" aria-labelledby="gp-h">
          <h2 id="gp-h" className="tm-h2">{LAYOUT.guestPages.h}</h2>
          <p className="tm-sub">{LAYOUT.guestPages.sub}</p>
          {GUEST_PAGES.map(p => (
            <article key={p.id} id={p.id} className="tm-card tm-block tm-kind-tile">
              <Title id={p.id} icon={p.icon} copied={copied} onCopy={onCopy}>{p.name}</Title>
              <div className="tm-chips">
                <span className="tm-chip tm-chip-kind">{p.who}</span>
                <span className="tm-chip tm-mono">{p.path}</span>
              </div>
              <Paras items={p.text} />
            </article>
          ))}
        </section>

        {/* ── On-site manager ────────────────────────────────── */}
        <section id="manager" aria-labelledby="mgr-h">
          <h2 id="mgr-h" className="tm-h2">{LAYOUT.manager.h}</h2>
          <Paras items={MANAGER.intro} />
          <div className="tm-card">
            <dl className="tm-inside">
              {MANAGER.screens.map((s, i) => (
                <div key={i} className="tm-inside-row">
                  <dt><span aria-hidden="true">{s.icon}</span> {s.name}</dt>
                  <dd><Rich text={s.text} /></dd>
                </div>
              ))}
            </dl>
            <Callout title="How it reaches your numbers"><Rich text={MANAGER.flows} /></Callout>
          </div>
        </section>

        {/* ── First week + routines ──────────────────────────── */}
        <section id="first-week" aria-labelledby="fw-h">
          <h2 id="fw-h" className="tm-h2">{LAYOUT.firstWeek.h}</h2>
          <p className="tm-sub">{LAYOUT.firstWeek.sub}</p>
          <div className="tm-card"><Steps items={FIRST_WEEK} /></div>
        </section>

        <section id="routines" aria-labelledby="rt-h">
          <h2 id="rt-h" className="tm-h2">{LAYOUT.routines.h}</h2>
          <div className="tm-routines">
            {ROUTINES.map((r, i) => (
              <div key={i} className="tm-card tm-routine">
                <h3 className="tm-h3"><span aria-hidden="true">{r.icon}</span> {r.when}<small>{r.time}</small></h3>
                <ul className="tm-bullets">{r.items.map((t, j) => <li key={j}><Rich text={t} /></li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Find it by goal ────────────────────────────────── */}
        <section id="by-goal" aria-labelledby="goal-h">
          <h2 id="goal-h" className="tm-h2">{LAYOUT.byGoal.h}</h2>
          <p className="tm-sub">{LAYOUT.byGoal.sub}</p>
          {BY_GOAL.map((g, i) => (
            <article key={i} className={`tm-card tm-goal${g.notYet ? ' tm-notyet' : ''}`}>
              <h3 className="tm-title"><span className="tm-ico" aria-hidden="true">{g.icon}</span><span>{g.goal}</span>
                {g.notYet && <span className="tm-chip tm-chip-warn">not in the app yet</span>}
              </h3>
              <p className="tm-means">{g.means}</p>
              <ul className="tm-bullets">{g.where.map((t, j) => <li key={j}><Rich text={t} /></li>)}</ul>
            </article>
          ))}
        </section>

        {/* ── Glossary ───────────────────────────────────────── */}
        <section id="glossary" aria-labelledby="gl-h">
          <h2 id="gl-h" className="tm-h2">{LAYOUT.glossary.h}</h2>
          <dl className="tm-glossary">
            {GLOSSARY.map((g, i) => (
              <div key={i}><dt>{g.term}</dt><dd><Rich text={g.def} /></dd></div>
            ))}
          </dl>
        </section>

        {/* ── FAQ ────────────────────────────────────────────── */}
        <section id="faq" aria-labelledby="faq-h">
          <h2 id="faq-h" className="tm-h2">{LAYOUT.faq.h}</h2>
          {FAQ.map((f, i) => (
            <div key={i} className="tm-card tm-qa">
              <div className="tm-q">{f.q}</div>
              <div><Rich text={f.a} /></div>
            </div>
          ))}
        </section>

        <footer className="tm-foot">
          <a href="#start" onClick={e => jump(e, 'start')} className="tm-link">↑ Back to the top</a>
          <div>{TITLE} · StayVibe360 · describes the app as it works on {UPDATED}.</div>
        </footer>
      </div>
    </ManualCtx.Provider>
  )
}

// ── Asking the server ────────────────────────────────────────────────────
// A plain fetch, not api/index.js: that layer logs the user out on a 401, and
// this is a public page whose visitors are not logged in. POST, so the text can
// never be cached by a service worker or CDN under a URL.
async function fetchManual(code) {
  let token = ''
  try { token = sessionStorage.getItem('ge_token') || '' } catch { /* no storage */ }
  try {
    const res = await fetch('/api/getTrainingManual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ code: code || '' }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.success) return { ok: true, content: data.data.content, access: data.data.access }
    return { ok: false, reason: data?.reason || 'unavailable', retryAfter: data?.retryAfter, expiresAt: data?.expiresAt }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

// The passcode a visitor typed stays on their own device so they are not asked
// again on every visit. The server still checks it, and its time limit, each time.
const readCode = () => { try { return localStorage.getItem(CODE_KEY) || '' } catch { return '' } }
const saveCode = c => { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY) } catch { /* private mode */ } }
const normalizeCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// ── The passcode screen ──────────────────────────────────────────────────
function Gate({ reason, expiresAt, retryAfter, busy, onSubmit }) {
  const [value, setValue] = useState('')
  const message = {
    passcode_invalid: 'That passcode was not recognised. Check it and try again.',
    passcode_expired: `This passcode expired${expiresAt ? ' on ' + whenLong(expiresAt) : ''}. Ask the person who invited you for a new one.`,
    passcode_revoked: 'This passcode is no longer active. Ask the person who invited you for a new one.',
    rate_limited: `Too many attempts. Please wait ${retryAfter || 15} minutes and try again.`,
    unavailable: 'The manual could not be loaded just now. Please try again in a moment.',
    offline: 'Could not reach the server. Check your connection and try again.',
  }[reason]
  return (
    <div className="tm-gate">
      <form className="tm-gate-card" onSubmit={e => { e.preventDefault(); onSubmit(value) }}>
        <div className="tm-gate-ico" aria-hidden="true">🔐</div>
        <h1>{FALLBACK_TITLE}</h1>
        <p>This manual is shared by invitation. Enter the passcode you were given.</p>
        <input className="tm-gate-input" value={value} onChange={e => setValue(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX" autoFocus autoCapitalize="characters" autoComplete="off" autoCorrect="off"
          spellCheck={false} maxLength={24} aria-label="Passcode" />
        {message && <div className="tm-gate-err" role="alert">{message}</div>}
        <button className="tm-btn" type="submit" disabled={busy || !normalizeCode(value)}>
          {busy ? 'Checking…' : 'Open the manual'}
        </button>
        <div className="tm-gate-foot">
          Are you the owner? <Link to="/login" className="tm-link">Sign in</Link> and you can read it without a passcode.
        </div>
      </form>
    </div>
  )
}

export default function TrainingManual() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner' || user?.role === 'master_owner'
  const [view, setView] = useState({ phase: 'loading' })   // loading | ready | locked
  const [busy, setBusy] = useState(false)

  // quiet = the person did not just type this (a stored code, or a first visit
  // to a locked manual), so "passcode needed" is not an error worth shouting.
  async function attempt(code, quiet) {
    const r = await fetchManual(code)
    if (r.ok) {
      if (code) saveCode(code)
      setView({ phase: 'ready', content: r.content, access: r.access })
      return
    }
    // A stored passcode that no longer works is only noise next time.
    if (['passcode_invalid', 'passcode_expired', 'passcode_revoked'].includes(r.reason)) saveCode('')
    setView({
      phase: 'locked',
      reason: quiet && r.reason === 'passcode_required' ? null : r.reason,
      expiresAt: r.expiresAt, retryAfter: r.retryAfter,
    })
  }

  // First load: a passcode in the address (?code=…, the one-tap link the owner
  // can send) wins, then one remembered on this device. Either way the address
  // is tidied straight away so a passcode does not linger in history or get
  // forwarded along with the link.
  useEffect(() => {
    let code = ''
    try {
      const u = new URL(window.location.href)
      const q = u.searchParams.get('code')
      if (q) {
        code = normalizeCode(q)
        u.searchParams.delete('code')
        window.history.replaceState(null, '', u.pathname + u.search + u.hash)
      }
    } catch { /* odd URL — fall through to a stored code */ }
    attempt(code || readCode(), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(typed) {
    const code = normalizeCode(typed)
    if (!code) return
    setBusy(true)
    await attempt(code, false)
    setBusy(false)
  }

  // A page that is already open must not outlive its passcode. The server
  // refuses the next load; this closes the one in front of the reader, and drops
  // the text from memory with it.
  useEffect(() => {
    if (view.phase !== 'ready' || view.access?.kind !== 'passcode' || !view.access.expiresAt) return
    const end = new Date(view.access.expiresAt).getTime()
    let t
    const tick = () => {
      const left = end - Date.now()
      if (left <= 0) {
        saveCode('')
        setView({ phase: 'locked', reason: 'passcode_expired', expiresAt: view.access.expiresAt })
        return
      }
      t = setTimeout(tick, Math.min(left, 2000000000))   // a timer cannot hold more than ~24.8 days
    }
    tick()
    return () => clearTimeout(t)
  }, [view])

  // Tab title, and a note to search engines: this is for people who were given
  // the link, not for the open web.
  useEffect(() => {
    const prev = document.title
    document.title = `${view.content?.TITLE || FALLBACK_TITLE} · StayVibe360`
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => { document.title = prev; meta.remove() }
  }, [view.content])

  return (
    <div className="tm-page">
      <style>{CSS}</style>
      {view.phase === 'loading' && <div className="tm-loading" role="status">Loading the manual…</div>}
      {view.phase === 'locked' && (
        <Gate reason={view.reason} expiresAt={view.expiresAt} retryAfter={view.retryAfter} busy={busy} onSubmit={submit} />
      )}
      {view.phase === 'ready' && <ManualBody content={view.content} access={view.access} isOwner={isOwner} />}
    </div>
  )
}

// All colours come from custom properties so the print rules below can swap the
// whole palette in one place (a dark page on paper is unreadable and wastes ink).
const CSS = `
.tm-page{--bg:#0E0E10;--text:#EDF2F7;--dim:#9AA5B4;--faint:#6B7280;--card:#1B2130;--card2:#151A26;--line:rgba(255,255,255,.08);--gold:#C8903A;--goldsoft:rgba(200,144,58,.10);--goldline:rgba(200,144,58,.30);--green:#34A853;
  min-height:100vh;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.65}
.tm-page [id]{scroll-margin-top:64px}
.tm-page *{box-sizing:border-box}
.tm-wrap{max-width:860px;margin:0 auto;padding:22px 18px 90px}
.tm-page p{margin:0 0 10px}
.tm-page a{color:inherit}

.tm-nav{position:sticky;top:0;z-index:30;background:rgba(14,14,16,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.tm-nav-in{max-width:860px;margin:0 auto;padding:10px 18px;display:flex;gap:6px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
.tm-nav-in::-webkit-scrollbar{display:none}
.tm-nav-in a{flex:none;text-decoration:none;font-size:.78rem;font-weight:600;color:var(--dim);padding:6px 12px;border-radius:99px;border:1px solid var(--line)}
.tm-nav-in a:hover{color:var(--gold);border-color:var(--goldline)}

.tm-hero{padding:18px 0 10px}
.tm-brand{display:flex;align-items:center;gap:10px;color:var(--dim);font-size:.8rem;letter-spacing:.4px;margin-bottom:16px}
.tm-brand img{height:34px;width:34px;border-radius:8px;object-fit:cover;border:1px solid var(--goldline)}
.tm-badge{display:inline-flex;padding:7px 14px;border-radius:99px;margin-bottom:14px;background:linear-gradient(135deg,rgba(200,144,58,.22),rgba(200,144,58,.06));border:1px solid var(--goldline);font-size:.7rem;letter-spacing:2px;color:var(--gold);font-weight:700}
.tm-hero h1{font-size:clamp(1.9rem,6vw,2.7rem);line-height:1.12;margin:0 0 14px;text-wrap:balance}
.tm-lead{color:var(--dim);font-size:1.02rem}
.tm-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 10px}
.tm-btn{display:inline-flex;align-items:center;gap:6px;padding:11px 16px;border-radius:10px;border:1px solid var(--gold);background:var(--gold);color:#111!important;font-weight:800;font-size:.86rem;cursor:pointer;text-decoration:none;font-family:inherit}
.tm-btn-ghost{background:transparent;color:var(--gold)!important}
.tm-updated{color:var(--faint);font-size:.74rem}

.tm-h2{font-size:clamp(1.5rem,4.5vw,1.9rem);color:var(--gold);margin:46px 0 10px;line-height:1.2}
.tm-h3{font-size:1.2rem;margin:26px 0 4px}
.tm-sub{color:var(--dim);font-size:.9rem;margin:0 0 14px}
.tm-group{margin-bottom:8px}

.tm-ideas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tm-idea{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.tm-idea-ico{font-size:1.6rem;margin-bottom:6px}
.tm-idea h3{font-size:1.1rem;margin:0 0 6px;color:var(--text)}
.tm-idea p{color:var(--dim);font-size:.86rem;margin:0}

.tm-phone{max-width:430px;margin:8px 0 14px;background:var(--card2);border:1px solid var(--goldline);border-radius:22px;padding:10px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.tm-phone-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px 10px;font-size:.82rem;color:var(--gold)}
.tm-phone-head span{font-size:.62rem;letter-spacing:2px;border:1px solid var(--goldline);border-radius:99px;padding:3px 10px}
.tm-phone-group{font-size:.64rem;letter-spacing:1.6px;color:var(--faint);text-transform:uppercase;margin:12px 4px 6px}
.tm-row{display:flex;align-items:center;gap:10px;padding:9px 10px;margin-bottom:6px;border-radius:12px;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--k);text-decoration:none}
.tm-row:hover{border-color:var(--k)}
.tm-row-ico{font-size:1.15rem;flex:none}
.tm-row-main{display:flex;flex-direction:column;min-width:0;flex:1}
.tm-row-name{font-weight:700;font-size:.86rem}
.tm-row-when{color:var(--dim);font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-chev{color:var(--k);font-size:1.2rem}
.tm-mapwrap{display:grid;grid-template-columns:minmax(0,430px) minmax(0,1fr);gap:26px;align-items:start}
.tm-mapwrap .tm-phone{margin:8px 0 14px;width:100%}
.tm-legend{margin-top:8px;display:flex;flex-direction:column;gap:12px;position:sticky;top:76px}
.tm-legend-row{display:flex;flex-direction:column;align-items:flex-start;gap:4px;font-size:.88rem;color:var(--dim)}
.tm-legend-tip{font-size:.8rem;color:var(--faint);margin:2px 0 0}
.tm-tldr{font-size:1.02rem;color:var(--gold);margin:0 0 10px;line-height:1.5}

.tm-kind-act{--k:#F59E0B}.tm-kind-health{--k:#34A853}.tm-kind-insight{--k:#85B7EB}.tm-kind-shortcut{--k:#8B5CF6}.tm-kind-tile{--k:#C8903A}
.tm-chip{display:inline-block;font-size:.68rem;font-weight:600;padding:3px 10px;border-radius:99px;border:1px solid var(--line);color:var(--dim);line-height:1.5}
.tm-chip-kind{color:var(--k,var(--gold));border-color:var(--k,var(--goldline));background:color-mix(in srgb,var(--k,#C8903A) 12%,transparent)}
.tm-chip-warn{color:#F59E0B;border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.1);margin-left:8px;font-family:system-ui,sans-serif;font-weight:700}
.tm-mono{font-family:ui-monospace,Menlo,Consolas,monospace}

.tm-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 18px 8px;margin:0 0 16px}
.tm-block{border-left:4px solid var(--k,var(--gold))}
.tm-featured{border-color:var(--goldline);box-shadow:0 0 0 1px var(--goldline),0 8px 28px rgba(200,144,58,.08)}
.tm-tile{border-left:4px solid var(--gold)}
.tm-title{display:flex;align-items:center;gap:10px;font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.3rem;line-height:1.25;margin:0 0 8px;flex-wrap:wrap}
h4.tm-title{font-size:1.15rem}
.tm-ico{font-size:1.4rem}
.tm-copy{margin-left:auto;background:none;border:1px solid var(--line);color:var(--faint);border-radius:8px;font-size:.72rem;padding:3px 9px;cursor:pointer;font-family:inherit}
.tm-copy:hover{color:var(--gold);border-color:var(--goldline)}
.tm-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.tm-tagline{color:var(--gold);font-size:.98rem;margin:0 0 12px}
.tm-opens{color:var(--faint);font-size:.72rem;letter-spacing:.3px;margin:-2px 0 10px}

.tm-field{margin:0 0 14px}
.tm-label{font-size:.66rem;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--faint);margin:0 0 4px}
.tm-body,.tm-field p{font-size:.93rem;color:var(--text)}
.tm-body p:last-child{margin-bottom:0}
.tm-bullets{margin:6px 0 10px 18px;font-size:.93rem}
.tm-bullets li{margin:0 0 6px}
.tm-tight{margin:6px 0 2px 18px;font-size:inherit}
.tm-inside dd .tm-bullets li{margin:0 0 5px}
.tm-steps{margin:2px 0 10px 20px;font-size:.93rem}
.tm-steps li{margin:0 0 6px;padding-left:2px}
.tm-gain{margin:2px 0 14px;padding:10px 12px;border-radius:10px;background:var(--goldsoft);border:1px solid var(--goldline);font-size:.88rem;color:var(--text)}
.tm-gain span{color:var(--gold)}

.tm-callout{margin:0 0 14px;padding:11px 13px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.03);font-size:.88rem;color:var(--dim)}
.tm-callout-example{border-color:rgba(133,183,235,.35);background:rgba(133,183,235,.07);color:var(--text)}
.tm-callout-title{font-size:.66rem;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#85B7EB;margin-bottom:4px}
.tm-callout p:last-child{margin:0}

.tm-inside{margin:4px 0 6px}
.tm-inside-row{padding:9px 0;border-top:1px solid var(--line)}
.tm-inside-row:first-child{border-top:none}
.tm-inside dt{font-weight:700;font-size:.9rem;color:var(--gold);margin-bottom:2px}
.tm-inside dd{margin:0;font-size:.9rem;color:var(--text)}
.tm-screens{margin-top:6px;padding-top:6px}
.tm-screen{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:14px 14px 4px;margin:0 0 12px}

.tm-ui{display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82em;background:var(--goldsoft);border:1px solid var(--goldline);color:var(--gold);border-radius:6px;padding:0 6px;line-height:1.6;white-space:normal}
.tm-link{color:var(--gold)!important;text-decoration:underline;text-decoration-color:var(--goldline);text-underline-offset:3px}

.tm-routines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.tm-routine{margin:0}
.tm-routine .tm-h3{margin:0 0 6px;font-size:1.1rem}
.tm-routine small{display:block;font-family:system-ui,sans-serif;font-size:.7rem;color:var(--faint);font-weight:500}
.tm-goal .tm-title{margin-bottom:2px}
.tm-means{color:var(--dim);font-size:.9rem;margin:0 0 6px}
.tm-notyet{border-style:dashed;border-color:rgba(245,158,11,.4)}
.tm-glossary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tm-glossary>div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tm-glossary dt{font-weight:700;color:var(--gold);font-size:.9rem;margin-bottom:2px}
.tm-glossary dd{margin:0;font-size:.86rem;color:var(--dim)}
.tm-qa{padding:14px 16px 10px}
.tm-q{font-weight:700;margin-bottom:4px}
.tm-foot{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:var(--faint);font-size:.76rem;display:flex;flex-direction:column;gap:6px}

.tm-loading{min-height:60vh;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:.95rem}
.tm-banner{margin:0 0 6px;padding:10px 14px;border-radius:10px;background:var(--goldsoft);border:1px solid var(--goldline);font-size:.84rem;color:var(--text)}
.tm-gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.tm-gate-card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--goldline);border-radius:18px;padding:30px 24px 22px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.tm-gate-ico{font-size:2.2rem;margin-bottom:6px}
.tm-gate-card h1{font-size:1.7rem;margin:0 0 8px;line-height:1.2}
.tm-gate-card p{color:var(--dim);font-size:.92rem;margin:0 0 18px}
.tm-gate-input{width:100%;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--text);font-size:1.25rem;letter-spacing:4px;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;outline:none;margin-bottom:12px}
.tm-gate-input:focus{border-color:var(--gold)}
.tm-gate-err{color:#F59E0B;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:9px 12px;font-size:.84rem;margin-bottom:12px;text-align:left}
.tm-gate .tm-btn{width:100%;justify-content:center;padding:13px 16px;font-size:.95rem}
.tm-gate .tm-btn:disabled{opacity:.5;cursor:not-allowed}
.tm-gate-foot{margin-top:16px;color:var(--faint);font-size:.78rem}

@media (max-width:720px){
  /* minmax(0,1fr), not 1fr: a bare 1fr track will not shrink below its widest
     unwrapped content (the map rows are nowrap), which made the page scroll sideways. */
  .tm-ideas,.tm-routines,.tm-glossary,.tm-mapwrap{grid-template-columns:minmax(0,1fr)}
  .tm-legend{position:static}
  .tm-wrap{padding:16px 14px 80px}
  .tm-card{padding:16px 14px 6px}
}

@media print{
  html,body,#root{height:auto!important;overflow:visible!important;background:#fff!important}
  .tm-page{--bg:#fff;--text:#111;--dim:#333;--faint:#555;--card:#fff;--card2:#fff;--line:#ccc;--gold:#7a4f0d;--goldsoft:#f6efe3;--goldline:#c9a46a;min-height:0}
  .tm-nav,.tm-actions,.tm-copy,.tm-banner{display:none!important}
  .tm-wrap{max-width:none;padding:0}
  .tm-card,.tm-phone{box-shadow:none!important}
  .tm-block,.tm-screen,.tm-callout,.tm-qa,.tm-goal,.tm-idea,.tm-routine{break-inside:avoid}
  .tm-h2{break-after:avoid}
  .tm-btn{display:none}
  .tm-page a{text-decoration:none}
  .tm-page,.tm-page *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`
