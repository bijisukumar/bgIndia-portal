// ============================================================
//   bgIndia Portal — Cloudflare Pages Function (D1 Worker)
//   v2.0 — JWT authentication (PINs server-side only)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
function err(msg, status = 400) {
  return json({ success: false, error: msg }, status)
}

// ── PLATE NORMALIZER ──────────────────────────────────────────
// Cleans an OCR'd plate string into a tidy, spaced Indian-format plate
// when it matches (e.g. "KL07AB1234" -> "KL 07 AB 1234"), otherwise returns
// the stripped uppercase characters. Purely cosmetic + advisory — Raman can
// always overwrite whatever this produces, so it never rejects input.
function normalizePlate(s) {
  if (!s) return ''
  const t = String(s).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!t) return ''
  // Standard series: 2 letters (state) + 1-2 digits (RTO) + 1-3 letters + 4 digits
  const std = t.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/)
  if (std) return `${std[1]} ${std[2]} ${std[3]} ${std[4]}`
  // BH (Bharat) series: 2 digits (year) + BH + 4 digits + 1-2 letters
  const bh = t.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/)
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`
  return t
}

// ── PASSPORT MRZ PARSER (TD3 — 2 lines × 44 chars) ────────────
// Deterministically parses the machine-readable zone of a passport into
// structured fields. Advisory only (the guest verifies everything), so it is
// permissive: it returns whatever it can and leaves the rest blank rather
// than failing. Kept out of the model's hands on purpose — the model only
// transcribes the two MRZ lines; the field extraction happens here where it's
// reliable and testable.
function parseMrzTD3(text) {
  if (!text) return null
  const lines = String(text).toUpperCase()
    .split(/[\r\n]+/)
    .map(l => l.replace(/[^A-Z0-9<]/g, ''))
    .filter(l => l.includes('<') && l.length >= 30)
  if (lines.length < 2) return null
  // The two longest <-bearing lines are the MRZ.
  lines.sort((a, b) => b.length - a.length)
  let l1 = lines[0], l2 = lines[1]
  // Name line starts with the document type letter (P for passport).
  if (!/^P/.test(l1) && /^P/.test(l2)) { const t = l1; l1 = l2; l2 = t }
  const pad = s => (s + '<'.repeat(44)).slice(0, 44)
  l1 = pad(l1); l2 = pad(l2)

  const clean = s => s.replace(/</g, ' ').replace(/\s+/g, ' ').trim()
  const num   = s => s.replace(/</g, '').trim()

  const issuing   = num(l1.slice(2, 5))
  const [surRaw, givRaw = ''] = l1.slice(5).split('<<')
  const surname     = clean(surRaw)
  const givenNames  = clean(givRaw)

  const passportNumber = num(l2.slice(0, 9))
  const nationality    = num(l2.slice(10, 13))
  const dobRaw         = l2.slice(13, 19)
  const sexRaw         = l2.slice(20, 21)
  const expRaw         = l2.slice(21, 27)

  const toDate = (yymmdd, kind) => {
    if (!/^\d{6}$/.test(yymmdd)) return ''
    const yy = parseInt(yymmdd.slice(0, 2), 10)
    const mm = yymmdd.slice(2, 4)
    const dd = yymmdd.slice(4, 6)
    if (mm < '01' || mm > '12' || dd < '01' || dd > '31') return ''
    const curYY = new Date().getFullYear() % 100
    const year = kind === 'expiry' ? 2000 + yy : (yy > curYY ? 1900 + yy : 2000 + yy)
    return `${year}-${mm}-${dd}`
  }

  const titled = clean([givenNames, surname].join(' '))
    .toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

  return {
    passportNumber,
    nationalityCode: nationality,
    issuingCountry:  issuing,
    dob:    toDate(dobRaw, 'dob'),
    sex:    sexRaw === 'M' ? 'Male' : sexRaw === 'F' ? 'Female' : '',
    expiry: toDate(expRaw, 'expiry'),
    surname,
    givenNames,
    fullName: titled,
  }
}

// ── JWT HELPERS (Web Crypto API — available in all CF Workers) ──
async function signJwt(payload, secret) {
  const enc     = new TextEncoder()
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const body    = btoa(JSON.stringify(payload))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${header}.${body}.${sigB64}`
}

async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`))
    if (!valid) return null
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp * 1000 < Date.now()) return null  // expired
    return payload
  } catch { return null }
}

// ── PIN HASHING (SHA-256 hex) ─────────────────────────────────
// platform_auth_tokens stores only the hash, never the raw PIN — a debug
// tool like D1Explorer.jsx can read this table, so plaintext PINs would be
// a real exposure. Same crypto.subtle already used for JWT signing above.
async function hashPin(pin) {
  const enc  = new TextEncoder()
  const buf  = await crypto.subtle.digest('SHA-256', enc.encode(String(pin)))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── EMAIL ALERT via Resend ───────────────────────────────────
// Forced full rebuild #2 (2026-07-01, post RESEND_API_KEY dashboard
// re-add) — testing whether Cloudflare Pages was reusing a warm Functions
// container with stale secret bindings despite the deployment ID/commit
// SHA changing. If this rebuild still doesn't pick up RESEND_API_KEY,
// that rules out container staleness as the cause too.
const __REBUILD_MARKER_2 = 'resend-secret-retest-' + Date.now()
// Previously used MailChannels' free anonymous API (api.mailchannels.net) —
// that endpoint was permanently shut down 2024-08-31 and every failure this
// whole time was actually that dead endpoint, not a DNS/domain-lockdown
// issue. Switched to Resend (resend.com): requires a RESEND_API_KEY secret
// (wrangler pages secret put RESEND_API_KEY) and a verified sending domain
// in the Resend dashboard.
// toEmail overrides the recipient (used for per-villa OwnerEmailAlert —
// see getOwnerAlertEmail below); falls back to the env-level OWNER_EMAIL
// secret, then to a hardcoded last-resort address.
// DB/villaId are optional — when passed, every attempt (success or failure)
// is logged to alert_log so you can check delivery without live Cloudflare
// Logs access. Browse it via D1 Explorer like any other table.
async function sendAlert(env, subject, lines, toEmail, DB, villaId) {
  const recipient = toEmail || env.OWNER_EMAIL || 'bijits@hotmail.com'
  let ok = false, statusCode = null, detail = ''
  try {
    const apiKey = await getResendApiKey(DB, env)
    if (!apiKey) {
      throw new Error(`RESEND_API_KEY not configured (checked env and DB fallback). Run: wrangler pages secret put RESEND_API_KEY, or save it to villa_settings key '_resend_api_key'.`)
    }
    const body = {
      from: 'bgIndia Security <alerts@luxuryvillasofguruvayur.com>',
      to: [recipient],
      subject,
      text: lines.join('\n'),
    }
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    ok = res.ok
    statusCode = res.status
    if (!res.ok) {
      // Common causes: unverified sending domain in Resend, bad/expired
      // API key, or recipient on Resend's testing-mode allowlist only.
      // Include a masked preview of the key actually used (never the
      // full value) so a bad/corrupted/mismatched key is visible without
      // exposing the secret in alert_log or the UI.
      const masked = apiKey.length > 12
        ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (len ${apiKey.length})`
        : `(len ${apiKey.length}, too short to preview safely)`
      const keySource = env.RESEND_API_KEY ? 'env secret' : 'DB fallback'
      detail = await res.text().catch(() => '')
      detail = `[key used: ${masked}, source: ${keySource}] ${detail}`
      console.error(`sendAlert failed: ${res.status} ${res.statusText} — ${detail.slice(0, 300)}`)
    }
  } catch (e) {
    detail = e?.message || String(e)
    console.error('sendAlert threw:', detail)
  }
  if (DB) {
    try {
      await DB.prepare(`INSERT INTO infra_alert_log (log_id, villa_id, subject, to_email, success, status_code, error_detail, created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(genId('AL'), villaId || null, subject, recipient, ok ? 1 : 0, statusCode, detail ? detail.slice(0, 500) : null, new Date().toISOString().slice(0, 19).replace('T', ' '))
        .run()
    } catch (e) { console.error('alert_log insert failed:', e?.message || e) }
  }
}

// ── PER-VILLA OWNER ALERT EMAIL ─────────────────────────────
// SaaS-ready config lookup: each villa (tenant) can have its own alert
// recipient stored in villa_settings (key='owner_email_alert'), settable
// from the owner's Notification Settings screen — no code change or
// redeploy needed to onboard a new villa/owner. Falls back to the global
// OWNER_EMAIL env secret, then a hardcoded last resort.
async function getOwnerAlertEmail(DB, env, villaId) {
  try {
    const row = await DB.prepare(`SELECT value FROM stayvibe_villa_settings WHERE villa_id = ? AND key = 'owner_email_alert'`).bind(villaId || env.DEFAULT_VILLA_ID || 'dwarka').first()
    if (row?.value) return row.value
  } catch (e) { console.error('getOwnerAlertEmail lookup failed:', e?.message || e) }
  return env.OWNER_EMAIL || 'bijits@hotmail.com'
}

// ── STOPGAP: Resend API key via DB, bypassing a broken Cloudflare secret ──
// env.RESEND_API_KEY has been confirmed, repeatedly, bound in the
// Cloudflare dashboard but absent from the live Function's runtime env —
// a platform-side issue outside app control (support ticket filed
// 2026-07-01). Falls back to a DB-stored copy so email sending isn't
// blocked on that ticket. Stored under a key never returned by the
// general getVillaSettings endpoint (see the exclusion filter there) so
// it's not exposed to the browser. Once Cloudflare fixes secret
// propagation, remove this fallback and delete the DB row.
async function getResendApiKey(DB, env) {
  if (env.RESEND_API_KEY) return env.RESEND_API_KEY
  try {
    const row = await DB.prepare(`SELECT value FROM stayvibe_villa_settings WHERE villa_id = ? AND key = '_resend_api_key'`).bind(env.DEFAULT_VILLA_ID || 'dwarka').first()
    if (row?.value) return row.value
  } catch (e) { console.error('getResendApiKey DB lookup failed:', e?.message || e) }
  return null
}

// ── RATE LIMITER — 5 attempts per IP per 15 min ──────────────
const loginAttempts = new Map()
function checkRateLimit(ip) {
  const now    = Date.now()
  const window = 15 * 60 * 1000  // 15 minutes
  const max    = 5
  const entry  = loginAttempts.get(ip) || { count: 0, firstAt: now }
  if (now - entry.firstAt > window) {
    loginAttempts.set(ip, { count: 1, firstAt: now })
    return { limited: false }
  }
  if (entry.count >= max) {
    const retryAfter = Math.ceil((window - (now - entry.firstAt)) / 60000)
    return { limited: true, retryAfter }
  }
  loginAttempts.set(ip, { ...entry, count: entry.count + 1 })
  return { limited: false }
}

// ── ID GENERATORS ─────────────────────────────────────────
// Splits a SQL script into individual statements, respecting single-quoted
// string literals (incl. escaped ''), double-quoted identifiers (incl. escaped ""),
// line comments (-- to end of line), and block comments (/* ... */).
// Semicolons inside any of those are NOT treated as statement separators.
function splitSqlStatements(sql) {
  const statements = []
  let current = ''
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (ch === "'") {
      current += ch; i++
      while (i < n) {
        current += sql[i]
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { current += sql[i + 1]; i += 2; continue }
          i++; break
        }
        i++
      }
      continue
    }

    if (ch === '"') {
      current += ch; i++
      while (i < n) {
        current += sql[i]
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { current += sql[i + 1]; i += 2; continue }
          i++; break
        }
        i++
      }
      continue
    }

    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') { current += sql[i]; i++ }
      continue
    }

    if (ch === '/' && next === '*') {
      current += ch; current += next; i += 2
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) { current += sql[i]; i++ }
      if (i < n) { current += '*'; current += '/'; i += 2 }
      continue
    }

    if (ch === ';') {
      statements.push(current.trim())
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  if (current.trim().length > 0) statements.push(current.trim())
  return statements.filter(s => s.length > 0)
}

function genStayId(villaId = 'dwarka') {
  const prefix = villaId === 'dwarka' ? 'DWK' : villaId.toUpperCase().slice(0, 3)
  const year   = new Date().getFullYear()
  // Timestamp-based: last 4 digits of ms epoch + 1 random digit = 5-char suffix
  // Near-zero collision probability; deleted IDs are never re-rolled
  const suffix = String(Date.now()).slice(-4) + String(Math.floor(Math.random() * 10))
  return `${prefix}-${year}-${suffix}`
}
function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── LEDGER ADAPTER (Step C — docs/DB-Ledger-Refactor-Spec.md) ─────────────
// One mapping, called after every financial write to `stays`, with just the
// stayId. It re-reads the row post-write, so all write paths share this ONE
// decode — byte-identical to the Step B backfill rules validated on all 293
// historical rows. Deterministic line_id = stayId:item_type; DELETE+INSERT
// in a single DB.batch (atomic in D1) so edits replace lines cleanly. The
// roll-up (item_type-explicit, spec §4) then rewrites gross/commission/net
// FROM the ledger, enforcing net = gross − commission by construction.
// NON-BLOCKING by design: any failure here logs and returns — the booking
// write that already succeeded is never affected.
async function syncStayLedger(DB, stayId) {
  try {
    if (!stayId) return
    const s = await DB.prepare(`SELECT stay_id, villa_id, gross, commission_amt, net, extra_charges, cleaning_fee, night_fee, guest_service_fee FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
    if (!s) return
    const r2 = x => Math.round((Number(x) || 0) * 100) / 100
    const cleaning = r2(s.cleaning_fee)
    const extras   = r2(s.extra_charges)
    const comm     = r2(s.commission_amt)
    const gsf      = r2(s.guest_service_fee)
    const nightFee = r2(s.night_fee)
    // room_fee: night_fee-authoritative (Airbnb), else derived from gross so
    // the roll-up reproduces the stored gross exactly on non-itemized rows.
    const roomFee  = nightFee > 0 ? nightFee : r2((s.gross || 0) - cleaning - extras)

    const lines = []
    const add = (type, dir, amt, note) => lines.push({ id: `${stayId}:${type}`, type, dir, amt: r2(amt), note })
    if (roomFee !== 0)  add('room_fee', 'inflow', roomFee, nightFee > 0 ? 'adapter: from night_fee' : 'adapter: derived from gross')
    if (cleaning > 0)   add('cleaning_fee', 'inflow', cleaning, 'adapter')
    if (extras > 0)     add('extra_charge', 'inflow', extras, 'adapter')  // upsell revenue
    if (extras < 0)     add('discount', 'outflow', Math.abs(extras), 'adapter: reclassified from negative extra_charges')
    if (comm > 0)       add('channel_commission', 'outflow', comm, 'adapter')
    if (gsf > 0)        add('guest_service_fee', 'passthrough', gsf, 'adapter')  // excluded from P&L

    const stmts = [DB.prepare(`DELETE FROM stayvibe_booking_line_items WHERE stay_id = ?`).bind(stayId)]
    for (const l of lines) {
      stmts.push(DB.prepare(`INSERT INTO stayvibe_booking_line_items (line_id, stay_id, villa_id, item_type, direction, gross_amount, tax_amount, note) VALUES (?,?,?,?,?,?,0,?)`)
        .bind(l.id, stayId, s.villa_id || null, l.type, l.dir, l.amt, l.note))
    }
    if (lines.length) {
      const gross = r2(
        lines.filter(l => ['room_fee','cleaning_fee','extra_charge'].includes(l.type)).reduce((a,l) => a + l.amt, 0)
        - lines.filter(l => l.type === 'discount').reduce((a,l) => a + l.amt, 0))
      const commission = r2(lines.filter(l => l.type === 'channel_commission').reduce((a,l) => a + l.amt, 0))
      stmts.push(DB.prepare(`UPDATE stayvibe_stays SET gross = ?, commission_amt = ?, net = ? WHERE stay_id = ?`)
        .bind(gross, commission, r2(gross - commission), stayId))
    }
    await DB.batch(stmts)
  } catch (e) {
    console.log('syncStayLedger non-blocking failure:', stayId, e && e.message)
  }
}

// ── GUEST IDENTITY RESOLVER ───────────────────────────────────
// Find-or-create a guests row by normalized phone/email. This is the SAME
// matching saveEnquiry uses, extracted here so every write path resolves a
// guest the same way instead of forking its own logic. Returns guest_id, or
// null when there's nothing to match on (no phone and no email) — the same
// conservative behavior as before, so we never create blank guest records.
async function resolveGuest(DB, { name, phone, email, actor = 'auto' }) {
  const normPhone = (phone || '').replace(/[\s\-]/g, '').replace(/^\+?91/, '')
  const normEmail = (email || '').trim().toLowerCase()
  if (!normPhone && !normEmail) return null
  const existing = await DB.prepare(
    `SELECT guest_id FROM stayvibe_guests WHERE (phone = ? AND phone != '') OR (email = ? AND email != '') LIMIT 1`
  ).bind(normPhone, normEmail).first()
  if (existing) {
    await DB.prepare(`UPDATE stayvibe_guests SET last_seen_at = datetime('now'), updated_by = ?, updated_at = datetime('now') WHERE guest_id = ?`)
      .bind(actor, existing.guest_id).run()
    return existing.guest_id
  }
  const guestId = genId('GST')
  await DB.prepare(`INSERT INTO stayvibe_guests (guest_id, name, phone, email, created_by, updated_by) VALUES (?,?,?,?,?,?)`)
    .bind(guestId, name || 'Unknown', normPhone, normEmail, actor, actor).run()
  return guestId
}

// ── STAY OVERLAP CLASSIFIER ───────────────────────────────────
// Classifies how a candidate date range relates to existing active stays at
// a villa, using a half-open interval [checkin, checkout): the checkout day
// itself is free, so a guest checking out and another checking in on the
// same day is NOT an overlap. Returns:
//   ownOverlap   — an overlapping active stay belonging to the same guest
//                  (an extension / re-submit of THEIR booking, not a dup)
//   otherOverlap — an overlapping stay for a DIFFERENT guest (double booking)
//   backToBack   — stays that only touch on a turnover day (valid, info only)
async function classifyStayConflicts(DB, { villaId, checkinDate, checkoutDate, excludeStayId = null, guestId = null, phone = null, email = null, guestName = null }) {
  const co = checkoutDate || checkinDate
  const { results } = await DB.prepare(
    `SELECT stay_id, guest_name, guest_phone, guest_email, checkin_date, checkout_date, status, source, created_at, guest_id
       FROM stayvibe_stays
      WHERE villa_id = ? AND status NOT IN ('cancelled','closed','checked_out','void')
        AND stay_id != ?
        AND checkin_date <= ? AND checkout_date >= ?`
  ).bind(villaId, excludeStayId || '', co, checkinDate).all()

  const normP = (phone || '').replace(/[\s\-]/g, '').replace(/^\+?91/, '')
  const normE = (email || '').trim().toLowerCase()
  const fullName = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  // "Same guest" only on a RELIABLE signal — guest_id, phone, email, or an
  // exact full-name match. A loose first-name match is deliberately NOT enough:
  // silently merging two different guests is worse than a false alarm, so any
  // ambiguous overlap falls through to otherOverlap and gets flagged for a
  // human to resolve rather than auto-merged.
  const sameGuest = s =>
    (guestId && s.guest_id && s.guest_id === guestId) ||
    (!!normP && !!s.guest_phone && s.guest_phone.replace(/[\s\-]/g, '').replace(/^\+?91/, '') === normP) ||
    (!!normE && !!s.guest_email && s.guest_email.trim().toLowerCase() === normE) ||
    (!!guestName && !!s.guest_name && fullName(s.guest_name) === fullName(guestName))

  const overlaps = [], backToBack = []
  for (const s of (results || [])) {
    const strictOverlap = s.checkin_date < co && s.checkout_date > checkinDate
    const touches = s.checkout_date === checkinDate || s.checkin_date === co
    if (strictOverlap) overlaps.push(s)
    else if (touches) backToBack.push(s)
  }
  return {
    ownOverlap:   overlaps.find(sameGuest) || null,
    otherOverlap: overlaps.find(s => !sameGuest(s)) || null,
    backToBack,
  }
}

// ── ROUTER ────────────────────────────────────────────────
export async function onRequest(ctx) {
  const { request, env } = ctx
  const DB         = env.DB || env.bgindia_db
  const DB_ESTATES = env.DB_ESTATES
  // Per-host default villa id (set via wrangler.toml [vars] — see
  // Release 2.1 de-hardcode: each host's deployment sets its own value,
  // falls back to 'dwarka' for the current single-host deployment).
  const DEFAULT_VILLA_ID = env.DEFAULT_VILLA_ID || 'dwarka'

  if (!DB) {
    console.error('DB binding missing — env keys:', Object.keys(env).join(', '))
    return new Response(JSON.stringify({ success: false, error: 'Database binding not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }

  const ESTATE_ACTIONS = new Set([
    'getCoconutHarvests', 'saveCoconutHarvest',
    'getRubberHarvests',  'saveRubberHarvest',
    'getRubberProduction', 'saveRubberProduction', 'deleteRubberProduction', 'getRubberMonthly',
    'getManagerSettlements', 'saveManagerSettlement', 'deleteManagerSettlement',
    'getEstateTransactions', 'saveEstateTransaction', 'deleteEstateTransaction',
    'getEstateDashboard',
    'getManagerQuickInfo',   
    'logIrrigation',         
    'getEstateHighlights',    
    'getIrrigationZoneHealth', 
    'saveIrrigationZoneLog',   
    'saveIrrigationZone',      
    'saveFertilization',      
    'saveMangoHarvest',        
    'getMangoHarvests',       
    'getIrrigationHistory',   
    'getEstateContacts',      
  ])

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url    = new URL(request.url)
  const action = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')
  const method = request.method

  // ── LOGIN — validate PIN server-side, return JWT ───────
  if (action === 'login' && method === 'POST') {
    const ip        = request.headers.get('CF-Connecting-IP') || 'unknown'
    const country   = request.headers.get('CF-IPCountry')     || 'unknown'
    const city      = request.cf?.city                         || 'unknown'
    const region    = request.cf?.region                       || ''
    const userAgent = request.headers.get('User-Agent')        || 'unknown'
    const referer   = request.headers.get('Referer')           || ''
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

    const rl = checkRateLimit(ip)
    if (rl.limited) {
      await sendAlert(env, '🔒 bgIndia — Login LOCKED (rate limit hit)', [
        'Source: Login screen (rate limiter)',
        'Action: Login LOCKED after too many failed attempts',
        '',
        `Time:       ${timestamp}`,
        `IP Address: ${ip}`,
        `Location:   ${city}${region ? ', ' + region : ''}, ${country}`,
        `User Agent: ${userAgent}`,
        `Referer:    ${referer || 'direct'}`,
        '',
        `Locked for: ${rl.retryAfter} minutes`,
        '',
        'If this was you — wait and try again.',
        'If this was not you — consider changing your PIN.',
      ], undefined, DB, null)
      return json({ success: false, error: 'Too many attempts', retryAfter: rl.retryAfter }, 429)
    }

    const { pin } = await request.json().catch(() => ({}))
    if (!pin) return err('PIN required', 400)

    // Platform-level bypass: the master owner isn't tenant data, so this
    // PIN lives as an env secret (like JWT_SECRET), not a DB row.
    // propertyIds: null means "every property, every tenant" — checked
    // explicitly by assertPropertyAccess(), never accidentally.
    let found = null
    if (env.PIN_MASTER_OWNER && String(pin) === String(env.PIN_MASTER_OWNER)) {
      found = { name: 'Master Owner', role: 'master_owner', actor: 'master_owner', tenantId: null, propertyIds: null }
    } else {
      const pinHash = await hashPin(pin)
      const row = await DB.prepare(
        `SELECT tenant_id, role, actor, label FROM platform_auth_tokens WHERE token_hash = ? AND active = 1`
      ).bind(pinHash).first()
      if (row) {
        const { results: props } = await DB.prepare(
          `SELECT property_id FROM platform_properties WHERE tenant_id = ? AND active = 1`
        ).bind(row.tenant_id).all()
        found = {
          name: row.label || row.actor, role: row.role, actor: row.actor,
          tenantId: row.tenant_id, propertyIds: props.map(p => p.property_id),
        }
      } else {
        // Self-healing migration path: the 3 original users' PINs live
        // only in these env vars until each one logs in for the first
        // time post-cutover. On a match here, silently write the hashed
        // row so every subsequent login uses the fast DB path — nobody
        // needs to retype a PIN, and their real PIN value is never seen
        // or typed into a migration script. Safe to delete this block
        // (and the 3 env vars) once all 3 have logged in at least once.
        const LEGACY = {
          [env.PIN_OWNER]:   { tenantId: 'dwarka', role: 'owner',          actor: 'owner'   },
          [env.PIN_RAMAN]:   { tenantId: 'dwarka', role: 'manager',        actor: 'raman'   },
          [env.PIN_PRADOSH]: { tenantId: 'dwarka', role: 'estate_manager', actor: 'pradosh' },
        }
        const legacy = LEGACY[String(pin)]
        if (legacy) {
          try {
            await DB.prepare(
              `INSERT OR IGNORE INTO platform_auth_tokens (token_hash, tenant_id, role, actor, label, active, created_at)
               VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`
            ).bind(pinHash, legacy.tenantId, legacy.role, legacy.actor, legacy.actor).run()
          } catch (e) { console.error('legacy PIN auto-migration failed:', e?.message || e) }
          const { results: props } = await DB.prepare(
            `SELECT property_id FROM platform_properties WHERE tenant_id = ? AND active = 1`
          ).bind(legacy.tenantId).all()
          found = { name: legacy.actor, role: legacy.role, actor: legacy.actor,
            tenantId: legacy.tenantId, propertyIds: props.map(p => p.property_id) }
        }
      }
    }

    if (!found) {
      await sendAlert(env, '⚠️ bgIndia — Failed login attempt', [
        'Source: Login screen',
        'Action: Wrong PIN entered',
        '',
        `Time:       ${timestamp}`,
        `IP Address: ${ip}`,
        `Location:   ${city}${region ? ', ' + region : ''}, ${country}`,
        `User Agent: ${userAgent}`,
        `Referer:    ${referer || 'direct'}`,
        `PIN tried:  ${String(pin).length} digits (not shown for security)`,
        '',
        'No action needed unless you see many of these.',
      ], undefined, DB, null)
      return json({ success: false, error: 'Invalid PIN' }, 401)
    }

    const token = await signJwt({
      name:        found.name,
      role:        found.role,
      actor:       found.actor,
      tenantId:    found.tenantId,
      propertyIds: found.propertyIds,
      iat:         Math.floor(Date.now() / 1000),
      exp:         Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    }, env.JWT_SECRET)

    return json({ success: true, token })
  }

  // SUBMIT GUEST CHECK-IN FORM — public endpoint (no auth required for guests)
  if (action === 'submitGuestCheckIn' && method === 'POST') {
    try {
      const publicBody = await request.json().catch(() => ({}))
      const {
        villaId = DEFAULT_VILLA_ID, partner = 'direct', stayId: existingStayId,
        guestName, dob, gender, nationality = 'Indian',
        phone, email,
        homeAddress, city, state, pincode, country = 'India', fromCity,
        homeCountryAddress, homeCountry,
        checkInDate, checkOutDate, nights,
        adults = 1, children = 0, guestList,
        purposeOfVisit, modeOfTransport, vehicleNumber, eta,
        govtIdType, govtIdNum,
        passportNumber, passportIssueDate, passportIssuePlace, passportExpiry,
        visaNumber, visaType, visaIssueDate, visaIssuePlace,
        arrivalDateIndia, portOfArrival, nextDestination,
        idFileB64, idFileName,
        requestEarlyCheckIn, requestLateCheckOut,
        requestBreakfast, breakfastChoice, requestCab,
        requestExtraBeds, extraBedsCount,
      } = publicBody
      const reqEarly     = requestEarlyCheckIn ? 1 : 0
      const reqLate      = requestLateCheckOut ? 1 : 0
      const reqBreakfast = requestBreakfast    ? 1 : 0
      const bfChoice      = breakfastChoice      || null
      const reqCab       = requestCab          ? 1 : 0
      const reqBeds      = requestExtraBeds    ? 1 : 0
      const bedsCount    = reqBeds ? (parseInt(extraBedsCount) || 1) : 0
      const now          = () => new Date().toISOString().slice(0,19).replace('T',' ')

      const cleanName = guestName ? guestName.replace(/^[\d\s]+/, '').trim() : ''
      if (!cleanName) return err('guestName is required')
      const safeGuestName = cleanName
      if (!checkInDate) return err('checkInDate is required')

      const submittedAt = now()
      let stayId = existingStayId
      const guestId = await resolveGuest(DB, { name: safeGuestName, phone, email })
      let reviewNote = null
      let dupOtherStay = null

      if (!stayId) {
        // Identity + overlap match (replaces the fragile exact-checkin_date
        // match that forked the Gulshan duplicate). If this guest already has
        // an overlapping active stay, this form belongs to THAT booking —
        // update it rather than inserting a second stay.
        const cls = await classifyStayConflicts(DB, {
          villaId, checkinDate: checkInDate, checkoutDate: checkOutDate,
          guestId, phone, email, guestName: safeGuestName,
        })
        if (cls.ownOverlap) {
          stayId = cls.ownOverlap.stay_id
          const co = checkOutDate || ''
          if (cls.ownOverlap.checkin_date !== checkInDate || (co && cls.ownOverlap.checkout_date !== co)) {
            reviewNote = `Check-in form dates ${checkInDate}→${checkOutDate || '?'} differ from booked ${cls.ownOverlap.checkin_date}→${cls.ownOverlap.checkout_date} — verify (possible extension).`
          }
        } else if (cls.otherOverlap) {
          dupOtherStay = cls.otherOverlap
        }
      }

      if (stayId) {
        await DB.prepare(`
          UPDATE stayvibe_stays SET
            guest_phone = COALESCE(NULLIF(guest_phone,''), ?),
            guest_email = COALESCE(NULLIF(guest_email,''), ?),
            dob = ?, gender = ?, nationality = ?,
            home_address = ?, city = ?, state = ?, country = ?, from_city = ?, pincode = ?,
            home_country_address = ?, home_country = ?,
            checkout_date = COALESCE(checkout_date, ?),
            nights = COALESCE(NULLIF(nights,0), ?),
            adults = ?, children = ?,
            guest_list = ?, purpose_of_visit = ?,
            mode_of_transport = ?, vehicle_number = ?, eta = ?,
            govt_id_type = ?, govt_id_num = ?,
            passport_number = ?, passport_issue_date = ?, passport_issue_place = ?,
            passport_expiry = ?, visa_number = ?, visa_type = ?,
            visa_issue_date = ?, visa_issue_place = ?,
            arrival_date_india = ?, port_of_arrival = ?, next_destination = ?,
            request_early_checkin = ?, request_late_checkout = ?,
            request_breakfast = ?, breakfast_choice = ?, request_cab = ?,
            request_extra_beds = ?, extra_beds_count = ?,
            source = CASE WHEN source = 'direct' OR source IS NULL THEN ? ELSE source END,
            checkin_form_submitted = 1, checkin_form_submitted_at = ?,
            status = CASE WHEN status IN ('confirmed','booked','pending_review') THEN 'pending_review' ELSE status END,
            updated_by = 'auto', updated_at = ?
          WHERE stay_id = ?
        `).bind(
          phone||null, email||null,
          dob||null, gender||null, nationality,
          homeAddress||null, city||null, state||null, country, fromCity||city||null, pincode||null,
          homeCountryAddress||null, homeCountry||null,
          checkOutDate||null, parseInt(nights)||1,
          parseInt(adults)||1, parseInt(children)||0,
          guestList||null, purposeOfVisit||null,
          modeOfTransport||null, vehicleNumber||null, eta||null,
          govtIdType||null, govtIdNum||null,
          passportNumber||null, passportIssueDate||null, passportIssuePlace||null,
          passportExpiry||null, visaNumber||null, visaType||null,
          visaIssueDate||null, visaIssuePlace||null,
          arrivalDateIndia||null, portOfArrival||null, nextDestination||null,
          reqEarly, reqLate, reqBreakfast, bfChoice, reqCab, reqBeds, bedsCount,
          partner||'direct', submittedAt, submittedAt, stayId
        ).run()
      } else {
        stayId = genStayId(villaId)
        const n = parseInt(nights) || (checkOutDate
          ? Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000))
          : 1)
        await DB.prepare(`
          INSERT INTO stayvibe_stays (
            stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, children, gross, net,
            dob, gender, nationality,
            home_address, city, state, country, from_city, pincode, home_country_address, home_country,
            guest_list, purpose_of_visit, mode_of_transport, vehicle_number, eta,
            govt_id_type, govt_id_num,
            passport_number, passport_issue_date, passport_issue_place, passport_expiry,
            visa_number, visa_type, visa_issue_date, visa_issue_place,
            arrival_date_india, port_of_arrival, next_destination,
            request_early_checkin, request_late_checkout,
            request_breakfast, breakfast_choice, request_cab,
            request_extra_beds, extra_beds_count,
            checkin_form_submitted, status, created_by, updated_by
          ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,0,0,
            ?,?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,
            ?,?,
            ?,?,?,?,
            ?,?,?,?,
            ?,?,?,
            ?,?,?,?,?,
            ?,?,
            1,'pending_review','auto','auto'
          )
        `).bind(
          stayId, villaId, partner || 'direct',
          safeGuestName, phone||null, email||null,
          checkInDate, checkOutDate||null, n,
          parseInt(adults)||1, parseInt(children)||0,
          dob||null, gender||null, nationality,
          homeAddress||null, city||null, state||null, country, fromCity||city||null,
          pincode||null, homeCountryAddress||null, homeCountry||null,
          guestList||null, purposeOfVisit||null,
          modeOfTransport||null, vehicleNumber||null, eta||null,
          govtIdType||null, govtIdNum||null,
          passportNumber||null, passportIssueDate||null, passportIssuePlace||null,
          passportExpiry||null,
          visaNumber||null, visaType||null, visaIssueDate||null, visaIssuePlace||null,
          arrivalDateIndia||null, portOfArrival||null, nextDestination||null,
          reqEarly, reqLate, reqBreakfast, bfChoice, reqCab,
          reqBeds, bedsCount
        ).run()
      }

      // Stamp the resolved guest link (Phase 1 column) — starts populating
      // stays.guest_id for the check-in-form path, which never wrote it before.
      if (guestId) {
        await DB.prepare(`UPDATE stayvibe_stays SET guest_id = COALESCE(guest_id, ?) WHERE stay_id = ?`).bind(guestId, stayId).run()
      }

      // Extension / date-change on the guest's own booking → flag for review
      // rather than silently trusting guest-entered dates.
      if (reviewNote) {
        await DB.prepare(
          `UPDATE stayvibe_stays SET notes = TRIM(COALESCE(notes,'') || ' | ' || ?), status = 'pending_review', updated_at = datetime('now') WHERE stay_id = ?`
        ).bind(reviewNote, stayId).run()
      }

      // Genuine overlap with a DIFFERENT guest — a real double booking arriving
      // through the check-in form, the exact gap that let the Gulshan case
      // through unflagged. Don't block the guest, but log it, alert staff, and
      // mark the new stay pending_review so nobody checks two parties into one
      // villa.
      if (dupOtherStay) {
        const co = checkOutDate || checkInDate
        const overlapNights = Math.max(0, Math.round(
          (Math.min(new Date(dupOtherStay.checkout_date), new Date(co)) -
           Math.max(new Date(dupOtherStay.checkin_date), new Date(checkInDate))) / 86400000))
        try {
          await DB.prepare(
            `INSERT INTO stayvibe_duplicate_bookings (dup_id, villa_id, detected_at, existing_stay_id, existing_guest, existing_checkin, existing_checkout, existing_source, existing_booked_at, new_guest, new_checkin, new_checkout, new_source, new_airbnb_conf, overlap_nights)
             VALUES (?,?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(`DUP-${Date.now()}`, villaId, dupOtherStay.stay_id, dupOtherStay.guest_name, dupOtherStay.checkin_date, dupOtherStay.checkout_date, dupOtherStay.source || 'unknown', dupOtherStay.created_at || null, safeGuestName, checkInDate, checkOutDate || null, 'checkin_form', null, overlapNights).run()
        } catch (e) { console.error('dup log (checkin form):', e?.message || e) }
        await DB.prepare(
          `UPDATE stayvibe_stays SET status='pending_review', notes = TRIM(COALESCE(notes,'') || ' | ' || ?), updated_at = datetime('now') WHERE stay_id = ?`
        ).bind(`Overlaps existing stay ${dupOtherStay.stay_id} (${dupOtherStay.guest_name}) ${dupOtherStay.checkin_date}→${dupOtherStay.checkout_date} — possible double booking.`, stayId).run()
        try {
          await sendAlert(env, '🚨 Possible double booking (check-in form) — ' + villaId, [
            'Source: Guest check-in form (submitGuestCheckIn)',
            `New guest:  ${safeGuestName} | ${checkInDate} → ${checkOutDate || '?'}`,
            `Existing:   ${dupOtherStay.stay_id} | ${dupOtherStay.guest_name} | ${dupOtherStay.checkin_date} → ${dupOtherStay.checkout_date}`,
            `Overlap:    ${overlapNights} night(s)`,
            '',
            'The new stay is marked pending_review — verify before check-in.',
          ], await getOwnerAlertEmail(DB, env, villaId), DB, villaId)
        } catch (e) { console.error('dup alert (checkin form):', e?.message || e) }
      }

      const docId = (type, sid) => `DOC-${sid}-${type}-${Date.now()}`
      if (idFileB64) {
        try {
          await DB.prepare(
            `INSERT OR REPLACE INTO stayvibe_guest_documents
             (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
             VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
          ).bind(docId('id', stayId), stayId, 'govt_id', idFileName || ('ID-' + stayId + '.jpg'), idFileB64).run()
        } catch(e) { console.warn('ID doc store error:', e.message) }
      }
      if (publicBody.passportFileB64) {
        try {
          await DB.prepare(
            `INSERT OR REPLACE INTO stayvibe_guest_documents
             (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
             VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
          ).bind(docId('passport', stayId), stayId, 'passport', 'passport-' + stayId + '.jpg', publicBody.passportFileB64).run()
        } catch(e) { console.warn('Passport doc store error:', e.message) }
      }
      if (publicBody.visaFileB64) {
        try {
          await DB.prepare(
            `INSERT OR REPLACE INTO stayvibe_guest_documents
             (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
             VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
          ).bind(docId('visa', stayId), stayId, 'visa', 'visa-' + stayId + '.jpg', publicBody.visaFileB64).run()
        } catch(e) { console.warn('Visa doc store error:', e.message) }
      }

      return json({ success: true, data: { stayId, status: 'pending_review' } })
    } catch(submitErr) {
      console.error('submitGuestCheckIn crash:', submitErr.message)
      try {
        await DB.prepare(
          `INSERT INTO infra_processing_log (log_id, event_type, stay_id, note, created_at)
           VALUES (?, 'error', 'unknown', ?, datetime('now'))`
        ).bind('ERR-' + Date.now(), 'submitGuestCheckIn failed: ' + submitErr.message).run()
      } catch(logErr) {}
      return json({ success: false, error: 'Check-in submission failed: ' + submitErr.message }, 500)
    }
  }

  // RESOLVE CHECKIN LINK — public endpoint (no auth)
  // ── PASSPORT MRZ OCR (public — guest check-in form pre-fill) ──────
  // Reads the passport photo page with the hosted vision model and returns
  // structured MRZ fields to PRE-FILL the guest's own check-in form. Public
  // by necessity: the guest form is unauthenticated, exactly like
  // submitGuestCheckIn. Advisory + self-healing — any failure returns empty
  // fields so the guest simply types them in; it can never throw the form.
  if (action === 'ocrPassport' && method === 'POST') {
    const pBody = await request.json().catch(() => ({}))
    const b64 = pBody.passportPhotoB64
    const empty = (reason) => json({ success: true, data: { fields: {}, reason } })
    if (!b64) return empty('no_image')
    if (b64.length > 8000000) return empty('too_large')   // ~6MB decoded image guard
    if (!env.AI) { console.error('ocrPassport: env.AI binding missing'); return empty('ai_unbound') }

    const OCR_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct'
    const OCR_PROMPT = 'This is the photo page of a passport. Find the machine-readable zone: the two long lines of capital letters, digits and < characters at the very bottom. Transcribe those two lines EXACTLY as printed, each on its own line, including every < character, and output nothing else. If there is no machine-readable zone, respond with exactly NONE.'

    let bytes
    try {
      const bin = atob(b64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      bytes = [...arr]
    } catch (e) { console.error('ocrPassport: bad base64:', e?.message || e); return empty('bad_b64') }

    const runOcr = async () => {
      const out = await env.AI.run(OCR_MODEL, { prompt: OCR_PROMPT, image: bytes, max_tokens: 128, temperature: 0 })
      return (out && out.response ? String(out.response) : '').trim()
    }

    let raw = ''
    try {
      raw = await runOcr()
    } catch (e1) {
      // Same one-time Meta license 'agree' self-heal as the plate OCR.
      console.error('ocrPassport: first attempt failed, license agree + retry:', e1?.message || e1)
      try {
        await env.AI.run(OCR_MODEL, { prompt: 'agree' })
        raw = await runOcr()
      } catch (e2) {
        console.error('ocrPassport: retry failed:', e2?.message || e2)
        return empty('ocr_error')
      }
    }

    if (!raw || /^none$/i.test(raw.trim())) return empty('no_mrz')
    const parsed = parseMrzTD3(raw)
    if (!parsed || !parsed.passportNumber) return empty('parse_failed')
    return json({ success: true, data: { fields: parsed, raw } })
  }

  if (action === 'resolveCheckinLink' && method === 'POST') {
    const rlBody = await request.json().catch(() => ({}))
    const { token: linkToken } = rlBody
    if (!linkToken) return err('token required')
    const link = await DB.prepare(
      `SELECT token, villa_id, partner, label, is_active FROM stayvibe_checkin_links WHERE token = ?`
    ).bind(linkToken).first()
    if (!link) return json({ success: false, error: 'Invalid link' }, 404)
    if (!link.is_active) return json({ success: false, error: 'Link deactivated' }, 403)
    await DB.prepare(`UPDATE stayvibe_checkin_links SET use_count = use_count + 1, updated_at = ? WHERE token = ?`).bind(new Date().toISOString().slice(0, 19).replace('T', ' '), linkToken).run()
    return json({ success: true, data: { villaId: link.villa_id, partner: link.partner, label: link.label } })
  }

  // ── AUTH GUARD — verify JWT on every other request ─────
  const authHeader = request.headers.get('Authorization') || ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  let payload = null
  if (token && env.SYSTEM_TOKEN && token === env.SYSTEM_TOKEN) {
    payload = { name: 'System', role: 'owner', actor: 'auto' }
  } else {
    payload = token ? await verifyJwt(token, env.JWT_SECRET) : null
  }
  if (!payload) return json({ success: false, error: 'Unauthorized' }, 401)

  const actor = payload.actor || 'owner'
  const now   = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

  // ── PROPERTY ACCESS GUARD ────────────────────────────────────────
  // The actual multi-tenant security boundary: a logged-in user can only
  // touch the villaId(s) their own tenant owns. propertyIds == null means
  // full access (master_owner, and the server-to-server SYSTEM_TOKEN,
  // whose synthetic payload above has no propertyIds at all) — an
  // explicit bypass, checked here, never an accidental gap. Any real
  // tenant token always carries a concrete array from login, even if
  // empty, so there's no ambiguous in-between state.
  function assertPropertyAccess(payload, villaId) {
    if (!villaId) return
    if (payload.propertyIds == null) return
    if (!payload.propertyIds.includes(villaId)) {
      throw new Error('FORBIDDEN_PROPERTY')
    }
  }

  // Same principle for estates: raman/pradosh each only work one estate.
  // Previously the client-supplied ?estate= param was trusted outright;
  // now it's validated against the actor's actual assignment.
  const ESTATE_BY_ACTOR = { raman: 'pavutumuri', pradosh: 'pollachi' }
  function assertEstateAccess(payload, estateId) {
    if (!estateId) return
    if (payload.role === 'owner' || payload.role === 'master_owner') return
    if (ESTATE_BY_ACTOR[payload.actor] === estateId) return
    throw new Error('FORBIDDEN_PROPERTY')
  }

  const ActiveDB = ESTATE_ACTIONS.has(action) ? DB_ESTATES : DB
  if (ESTATE_ACTIONS.has(action) && !DB_ESTATES) {
    return err('Estates DB not configured', 503)
  }

  try {
    // ── GET ROUTES ──────────────────────────────────────
    if (method === 'GET') {

      if (action === 'getTenantConfig') {
        const tenantId = url.searchParams.get('tenantId') || DEFAULT_VILLA_ID
        const tenant = await DB.prepare(
          `SELECT tenant_id, villa_name, phone1, phone2, guest_contact,
                  address, checkin_time, checkout_time,
                  breakfast_rate, raman_comm_pct, logo_url, plan,
                  owner_email, owner_email_cc, drive_root_id
           FROM platform_tenants WHERE tenant_id = ? AND active = 1`
        ).bind(tenantId).first()
        if (!tenant) return err('Tenant not found', 404)
        return json({ success: true, data: {
          tenantId:      tenant.tenant_id,
          villaName:     tenant.villa_name,
          phone1:        tenant.phone1,
          phone2:        tenant.phone2,
          guestContact:  tenant.guest_contact,
          address:       tenant.address,
          checkinTime:   tenant.checkin_time  || '16:00',
          checkoutTime:  tenant.checkout_time || '11:00',
          breakfastRate: tenant.breakfast_rate || 275,
          ramanCommPct:  tenant.raman_comm_pct || 10,
          logoUrl:       tenant.logo_url || null,
          plan:          tenant.plan || 'starter',
          ownerEmail:    tenant.owner_email || null,
          ownerEmailCC:  tenant.owner_email_cc || null,
          driveRootId:   tenant.drive_root_id || null,
        }})
      }

      // ── PROPERTY PICKER OPTIONS (post-login, before entering the app) ──
      // Normal tenant login: their own properties. master_owner: every
      // property across every tenant, grouped by tenant, for
      // troubleshooting. The frontend skips the picker entirely when
      // there's only 1 option (today's real Dwarka case).
      if (action === 'getPropertyPickerOptions') {
        if (payload.propertyIds == null) {
          const { results } = await DB.prepare(
            `SELECT p.property_id, p.name, p.unit_type, p.tenant_id, t.villa_name AS tenant_name
               FROM platform_properties p
               JOIN platform_tenants t ON t.tenant_id = p.tenant_id
              WHERE p.active = 1
              ORDER BY t.villa_name, p.name`
          ).all()
          return json({ success: true, data: { isMasterOwner: true, properties: results.map(r => ({
            propertyId: r.property_id, name: r.name, unitType: r.unit_type,
            tenantId: r.tenant_id, tenantName: r.tenant_name,
          })) } })
        }
        // Deliberately scoped to payload.propertyIds (the JWT's own claim
        // from login), NOT a fresh "WHERE tenant_id = ?" re-query. A live
        // re-query can surface a property added after this token was
        // issued — the picker would then offer something
        // assertPropertyAccess (which checks the same claim) immediately
        // 403s on. Requiring a fresh login to see a newly-added property
        // is the normal, expected JWT tradeoff; showing an option that
        // can't actually be used is a real bug (caught in local testing).
        if (payload.propertyIds.length === 0) {
          return json({ success: true, data: { isMasterOwner: false, properties: [] } })
        }
        const placeholders = payload.propertyIds.map(() => '?').join(',')
        const { results } = await DB.prepare(
          `SELECT p.property_id, p.name, p.unit_type, p.tenant_id, t.villa_name AS tenant_name
             FROM platform_properties p
             JOIN platform_tenants t ON t.tenant_id = p.tenant_id
            WHERE p.property_id IN (${placeholders}) AND p.active = 1
            ORDER BY p.name`
        ).bind(...payload.propertyIds).all()
        return json({ success: true, data: { isMasterOwner: false, properties: results.map(r => ({
          propertyId: r.property_id, name: r.name, unitType: r.unit_type,
          tenantId: r.tenant_id, tenantName: r.tenant_name,
        })) } })
      }

      if (action === 'getStays') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results } = year === 'all'
          ? await DB.prepare(`SELECT * FROM stayvibe_stays WHERE villa_id = ? ORDER BY checkin_date DESC`).bind(villaId).all()
          : await DB.prepare(`SELECT * FROM stayvibe_stays WHERE villa_id = ? AND checkin_date LIKE ? ORDER BY checkin_date DESC`).bind(villaId, `${year}%`).all()
        const mapped = results.map(r => ({
          ...r,
          stayId:          r.stay_id,
          guestName:       r.guest_name,
          bookerName:      r.guest_name,
          villaId:          r.villa_id,
          checkIn:          r.checkin_date,
          checkOut:         r.checkout_date,
          checkInDate:      r.checkin_date,
          checkOutDate:     r.checkout_date,
          bookedDate:       r.booked_date || r.created_at,
          commPct:          r.commission_pct,
          commAmt:          r.commission_amt,
          channel:          r.source,
          driveFolder:      r.drive_folder_url,
          driveFolderUrl:  r.drive_folder_url,
          driveFolderId:   r.drive_folder_id,
          reviewRating:    r.review_rating,
          fromCity:         r.from_city,
          nightFee:         r.night_fee          || 0,
          cleaningFee:     r.cleaning_fee       || 0,
          hostServiceFee:  r.host_service_fee   || 0,
          youEarn:         r.you_earn           || 0,
          guestServiceFee: r.guest_service_fee || 0,
          guestPaidTotal:  r.guest_paid_total  || 0,
          airbnbConf:      r.airbnb_conf       || '',
        }))
        return json({ success: true, data: mapped })
      }

      if (action === 'getRecentCheckouts') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        // Includes 'ready_for_checkout' — a guest whose stay period ended
        // but hasn't been formally checked out yet (the exact "old guest
        // still needs closing out" case: their checkout_date arrived, a
        // new guest may already be checked in for the turnover, but no
        // one has run the actual checkout action). Ordered so that guest
        // surfaces first since it's the most actionable/urgent; already-
        // processed checked_out/closed stays follow, capped at 7 days so
        // a stale one from a slow period doesn't linger as "recent".
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, status, adults, nights
           FROM stayvibe_stays WHERE villa_id = ?
           AND (
             status = 'ready_for_checkout'
             OR (status IN ('checked_out', 'closed') AND checkout_date >= date('now', '-7 days'))
           )
           ORDER BY CASE status WHEN 'ready_for_checkout' THEN 0 ELSE 1 END, checkout_date DESC
           LIMIT 3`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getActiveStay') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        // "Today" in IST — a stay is only live once its check-in date has arrived.
        const todayIST = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
        const stay = await DB.prepare(
          `SELECT * FROM stayvibe_stays
             WHERE villa_id = ? AND status = 'checked_in' AND checkin_date <= ?
             ORDER BY checkin_date DESC LIMIT 1`
        ).bind(villaId, todayIST).first()
        if (!stay) return json({ success: true, data: null })
        return json({ success: true, data: {
          ...stay,
          stayId:       stay.stay_id,
          guestName:    stay.guest_name,
          villaId:      stay.villa_id,
          checkInDate:  stay.checkin_date,
          checkOutDate: stay.checkout_date,
          guestCount:   stay.adults,
        }})
      }

      if (action === 'getPendingCheckIns') {
        const { results } = await DB.prepare(
          `SELECT * FROM stayvibe_stays WHERE status = 'ready_for_checkin' ORDER BY checkin_date ASC`
        ).all()
        return json({ success: true, data: results })
      }

      if (action === 'getGuests') {
        const { results } = await DB.prepare(
          `SELECT guest_name, guest_phone, guest_email, source,
            MAX(checkin_date)   as last_stay,
            MIN(checkin_date)   as first_stay,
            COUNT(*)            as total_stays,
            SUM(COALESCE(nights,0))       as total_nights,
            ROUND(SUM(COALESCE(net,0)),0) as total_spent,
            MAX(adults)         as last_adults,
            MAX(children)       as last_children,
            MAX(review_rating)  as last_review_rating,
            MAX(review_source)  as last_review_source,
            MAX(review_date)    as last_review_date,
            MAX(from_city)      as from_city,
            MAX(state)          as state,
            MAX(country)        as country,
            GROUP_CONCAT(DISTINCT source) as all_sources
           FROM stayvibe_stays WHERE status NOT IN ('cancelled','void')
           GROUP BY guest_name ORDER BY last_stay DESC`
        ).all()
        const guests = results.map(r => ({
          name:             r.guest_name,
          phone:            r.guest_phone,
          email:            r.guest_email,
          source:           r.source,
          lastStay:         r.last_stay,
          firstStay:        r.first_stay,
          totalStays:       r.total_stays,
          totalNights:      r.total_nights,
          totalSpent:       r.total_spent,
          adults:           r.last_adults,
          children:         r.last_children,
          fromCity:         r.from_city    || '',
          state:            r.state        || '',
          country:          r.country      || '',
          lastReviewRating: r.last_review_rating || 0,
          lastReviewSource: r.last_review_source || '',
          lastReviewDate:   r.last_review_date   || '',
          allSources:       r.all_sources       || '',
        }))
        return json({ success: true, data: guests })
      }

      if (action === 'getVillaDashboard') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results: stays } = await DB.prepare(
          `SELECT * FROM stayvibe_stays WHERE villa_id = ? AND checkin_date LIKE ? AND status NOT IN ('cancelled','void')`
        ).bind(villaId, `${year}%`).all()

        // Robust per-stay figures. Many rows (especially Airbnb-imported) have
        // an empty nights/gross column — which made nights show 0 and net
        // exceed gross. Derive nights from the dates, and when gross is missing
        // treat gross as net + channel commission so gross is always >= net.
        const nightsOf = r => (r.nights && r.nights > 0)
          ? r.nights
          : Math.max(0, Math.round((new Date(r.checkout_date) - new Date(r.checkin_date)) / 86400000))
        // A villa's gross for a channel booking = what it earns BEFORE the
        // channel's host commission = net + commission. Many Airbnb rows have a
        // stored gross that's understated (base tariff only), which made net
        // exceed gross. Floor gross at net+commission so gross is always >= net;
        // keep a legitimately larger stored gross where present.
        const grossOf = r => Math.max(r.gross || 0, (r.net || 0) + (r.commission_amt || 0))

        const totalBookings  = stays.length
        const totalNights    = stays.reduce((s, r) => s + nightsOf(r), 0)
        const grossRevenue   = stays.reduce((s, r) => s + grossOf(r), 0)
        const totalNet       = stays.reduce((s, r) => s + (r.net || 0), 0)
        const totalComm      = stays.reduce((s, r) => s + (r.commission_amt || 0), 0)
        const byChannel      = {}
        stays.forEach(s => {
          if (!byChannel[s.source]) byChannel[s.source] = { bookings: 0, net: 0 }
          byChannel[s.source].bookings++
          byChannel[s.source].net += (s.net || 0)
        })

        let kitchenByMonth = {}
        try {
          const { results: kitchenRows } = await DB.prepare(
            `SELECT strftime('%m', created_at) as month, SUM(total) as total
             FROM stayvibe_incidentals WHERE strftime('%Y', created_at) = ? GROUP BY month`
          ).bind(String(year)).all()
          kitchenByMonth = Object.fromEntries((kitchenRows||[]).map(r=>[parseInt(r.month), r.total||0]))
        } catch(e) {}

        // Kitchen/inventory revenue + profit (revenue minus cost basis from inventory.cost_price)
        // and a per-item sales summary, for the dashboard's inventory revenue view.
        let kitchenSummary = { revenue: 0, cost: 0, profit: 0, items: [] }
        try {
          const { results: itemRows } = await DB.prepare(`
            SELECT si.inv_item_id as item_id,
                   COALESCE(i.name, si.name) as name,
                   SUM(si.qty) as qty_sold,
                   SUM(si.total) as revenue,
                   SUM(si.qty * COALESCE(i.cost_price, 0)) as cost
            FROM stayvibe_incidentals si
            LEFT JOIN stayvibe_inventory i ON i.item_id = si.inv_item_id
            WHERE strftime('%Y', si.created_at) = ?
            GROUP BY si.inv_item_id, COALESCE(i.name, si.name)
            ORDER BY revenue DESC
          `).bind(String(year)).all()
          const items = (itemRows||[]).map(r => ({
            itemId: r.item_id, name: r.name, qtySold: r.qty_sold || 0,
            revenue: r.revenue || 0, cost: r.cost || 0, profit: (r.revenue||0) - (r.cost||0),
          }))
          kitchenSummary = {
            revenue: items.reduce((s,i)=>s+i.revenue, 0),
            cost:    items.reduce((s,i)=>s+i.cost, 0),
            profit:  items.reduce((s,i)=>s+i.profit, 0),
            items,
          }
        } catch(e) {}

        // Current low-stock count for a dashboard alert tile
        let lowStockCount = 0
        try {
          const { results: lowStock } = await DB.prepare(`
            SELECT COUNT(*) as c FROM stayvibe_inventory
            WHERE villa_id = ? AND preferred_stock > 0 AND qty_in_stock <= (preferred_stock * 0.1)
          `).bind(villaId).all()
          lowStockCount = lowStock?.[0]?.c || 0
        } catch(e) {}

        const months = {}
        for (let m = 1; m <= 12; m++) {
          const mStays  = stays.filter(s => new Date(s.checkin_date).getMonth() + 1 === m)
          const gross   = mStays.reduce((s, r) => s + grossOf(r), 0)
          const fees    = mStays.reduce((s, r) => s + (r.commission_amt || 0), 0)
          const net     = mStays.reduce((s, r) => s + (r.net || 0), 0)
          const nights  = mStays.reduce((s, r) => s + nightsOf(r), 0)
          const kitchen   = kitchenByMonth[m]   || 0
          const direct    = mStays.filter(s => (s.source || '').toLowerCase() === 'direct').length

          months[m] = {
            bookings:  mStays.length,
            revenue:   gross,
            gross,
            fees,
            profit:    net,
            net,
            nights,
            direct,
            breakdown: { tariff: gross, kitchen, breakfast: 0, carRental: 0, events: 0 }
          }
        }

        const quarterly = {
          Q1: [1,2,3].reduce((s,m)  => s + (months[m].net||0), 0),
          Q2: [4,5,6].reduce((s,m)  => s + (months[m].net||0), 0),
          Q3: [7,8,9].reduce((s,m)  => s + (months[m].net||0), 0),
          Q4: [10,11,12].reduce((s,m) => s + (months[m].net||0), 0),
        }

        const totalDirect = stays.filter(s => (s.source||'').toLowerCase() === 'direct').length
        const bestMonthIdx = Object.keys(months).reduce((b,m) => (months[m].gross||0) > (months[b]?.gross||0) ? m : b, 1)
        const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const bestMonth = MONTH_NAMES[bestMonthIdx] || '—'
        const channelTotals = {}
        stays.forEach(s => { const ch = s.source||'direct'; if(!channelTotals[ch])channelTotals[ch]=0; channelTotals[ch]+=(s.net||0) })
        const topChannel = Object.keys(channelTotals).sort((a,b)=>channelTotals[b]-channelTotals[a])[0] || '—'
        const directSaving = stays.filter(s=>(s.source||'').toLowerCase()!=='direct').reduce((sum,s)=>sum+(s.commission_amt||0),0)
        const avgNights = totalBookings > 0 ? Math.round((totalNights/totalBookings)*10)/10 : 0

        // ── P&L (Step D) — computed FROM the ledger, upsell broken out ──
        // Four-part P&L per spec: Net to owner = gross − channel commission
        // − staff commission − expenses. Upsell = extra_charge line items
        // (floor beds, extended checkout, add-ons collected outside the
        // channel). Passthrough (guest_service_fee/guest_tax) excluded.
        // Wrapped in try/catch: if ledger tables are ever absent the
        // dashboard still renders everything else unchanged.
        let pnl = null
        try {
          const { results: lg } = await DB.prepare(`
            SELECT b.item_type, ROUND(SUM(b.gross_amount),2) AS total
            FROM stayvibe_booking_line_items b JOIN stayvibe_stays s ON s.stay_id = b.stay_id
            WHERE s.villa_id = ? AND s.checkin_date LIKE ? AND s.status NOT IN ('cancelled','void')
            GROUP BY b.item_type`).bind(villaId, `${year}%`).all()
          const t = {}
          ;(lg || []).forEach(r => { t[r.item_type] = r.total || 0 })
          const r2 = x => Math.round((Number(x) || 0) * 100) / 100
          const staffRow = await DB.prepare(`SELECT ROUND(SUM(commission),2) AS total FROM stayvibe_manager_commissions WHERE strftime('%Y', checkin_date) = ?`).bind(String(year)).first()
          const expRow   = await DB.prepare(`SELECT ROUND(SUM(amount),2) AS total FROM stayvibe_villa_expenses WHERE villa_id = ? AND strftime('%Y', date) = ?`).bind(villaId, String(year)).first()
          const upsell            = r2(t.extra_charge)
          const grossLedger       = r2((t.room_fee || 0) + (t.cleaning_fee || 0) + (t.extra_charge || 0) - (t.discount || 0))
          const channelCommission = r2(t.channel_commission)
          const staffCommission   = r2(staffRow && staffRow.total)
          const expenses          = r2(expRow && expRow.total)
          pnl = {
            gross: grossLedger,
            upsell,
            roomFees:     r2(t.room_fee),
            cleaningFees: r2(t.cleaning_fee),
            discounts:    r2(t.discount),
            channelCommission,
            staffCommission,
            expenses,
            netToOwner:  r2(grossLedger - channelCommission - staffCommission - expenses),
            passthrough: r2(t.guest_service_fee),
          }
        } catch (e) {}

        return json({ success: true, data: {
          totalBookings, totalNights, grossRevenue, totalNet, totalComm,
          totalDirect, byChannel, stays, months, quarterly,
          bestMonth, topChannel, directSaving, avgNights,
          kitchenSummary, lowStockCount, pnl
        }})
      }

      // ── CHANNEL-MIX INSIGHT (owner dashboard card) ───────────────────
      // Shows what OTA commission actually cost this month, per channel,
      // plus an illustrative "what a direct-booking discount would've
      // cost instead" line. Pure aggregation over stayvibe_stays — no AI
      // call needed, commission_amt is already kept accurate by
      // syncStayLedger() on every financial write, so summing it directly
      // is reliable without joining stayvibe_channels.
      if (action === 'getChannelMixInsight') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const now2    = new Date()
        const month   = url.searchParams.get('month') || String(now2.getMonth() + 1).padStart(2, '0')
        const year    = url.searchParams.get('year')  || now2.getFullYear()
        const { results: stays } = await DB.prepare(
          `SELECT * FROM stayvibe_stays WHERE villa_id = ? AND checkin_date LIKE ? AND status NOT IN ('cancelled','void')`
        ).bind(villaId, `${year}-${month}%`).all()

        // Same defensive gross derivation as getVillaDashboard — some
        // Airbnb-imported rows understate the stored `gross` column.
        const grossOf = r => Math.max(r.gross || 0, (r.net || 0) + (r.commission_amt || 0))

        const byChannel = {}
        for (const s of stays) {
          const key = s.source || 'direct'
          if (!byChannel[key]) byChannel[key] = { channel: key, bookings: 0, gross: 0, commission: 0 }
          byChannel[key].bookings++
          byChannel[key].gross      += grossOf(s)
          byChannel[key].commission += (s.commission_amt || 0)
        }
        const channels = Object.values(byChannel)
        const totalCommission = channels.reduce((s, c) => s + c.commission, 0)

        // Illustrative only — assumes a direct-booking incentive worth HALF
        // of the actual commission paid, not a flat % of gross. A flat %
        // of gross overshoots for low-commission channels (e.g. Airbnb's
        // ~3% commission vs. a flat 5%-of-gross guess), which can produce a
        // nonsensical negative "savings" number. Basing it on actual
        // commission paid instead guarantees this is always a real saving.
        const illustrativeDiscountCost = totalCommission * 0.5

        return json({ success: true, data: {
          month, year, channels, totalCommission,
          illustrativeDiscountCost,
          illustrativeNetSavings: totalCommission - illustrativeDiscountCost,
        } })
      }

      // ── OCCUPANCY GAP ALERTS (owner dashboard card) ──────────────────
      // Flags unbooked stretches of 2+ nights in the next 60 days so the
      // host can act (discount, win-back message, promo). No rate-calendar
      // or pricing-flow changes — this villa is a single unit, so occupancy
      // per night is binary; there's no partial-occupancy signal to base a
      // rate-increase suggestion on. Pure date-overlap aggregation, same
      // half-open-interval semantics as the duplicate-booking checker.
      if (action === 'getOccupancyGaps') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const windowDays = 60
        const { results: stays } = await DB.prepare(
          `SELECT checkin_date, checkout_date FROM stayvibe_stays
            WHERE villa_id = ? AND status NOT IN ('cancelled','closed','checked_out','void')
              AND checkin_date < date('now', '+' || ? || ' days') AND checkout_date > date('now')`
        ).bind(villaId, windowDays).all()

        const today = new Date(); today.setHours(0, 0, 0, 0)
        const fmt = d => d.toISOString().slice(0, 10)
        const isOccupied = dateStr => stays.some(s => s.checkin_date <= dateStr && dateStr < s.checkout_date)

        const gaps = []
        let gapStart = null
        for (let i = 0; i <= windowDays; i++) {
          const d = new Date(today); d.setDate(d.getDate() + i)
          const dateStr = fmt(d)
          const free = i < windowDays && !isOccupied(dateStr)
          if (free && gapStart === null) gapStart = dateStr
          if (!free && gapStart !== null) {
            const nights = Math.round((new Date(dateStr) - new Date(gapStart)) / 86400000)
            if (nights >= 2) {
              const leadDays = Math.round((new Date(gapStart) - today) / 86400000)
              gaps.push({ start: gapStart, end: dateStr, nights, leadDays })
            }
            gapStart = null
          }
        }
        return json({ success: true, data: { windowDays, gaps } })
      }

      if (action === 'getRamanUnpaid') {
        const { results } = await DB.prepare(
          `SELECT rc.*, COALESCE(s.review_rating, 0) as review_rating
           FROM stayvibe_manager_commissions rc LEFT JOIN stayvibe_stays s ON s.stay_id = rc.stay_id
           WHERE rc.is_paid = 0 ORDER BY rc.checkin_date ASC`
        ).all()
        const totalUnpaid = results.reduce((s, r) => s + (r.commission || 0), 0)
        const quarters = {}
        results.forEach(r => {
          const d = new Date(r.checkin_date)
          const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
          if (!quarters[q]) quarters[q] = { label: q, stays: [], total: 0 }
          quarters[q].stays.push({ guestName: r.guest_name, checkIn: r.checkin_date, nights: r.nights, ramanComm: r.commission, commId: r.comm_id, reviewRating: r.review_rating || 0 })
          quarters[q].total += r.commission
        })
        return json({ success: true, data: {
          totalUnpaid, unpaidCount: results.length,
          quarters: Object.values(quarters).sort((a, b) => a.label > b.label ? -1 : 1)
        }})
      }

      if (action === 'getRamanHistory') {
        const { results } = await DB.prepare(
          `SELECT paid_date, COUNT(*) as stays, SUM(commission) as total
           FROM stayvibe_manager_commissions WHERE is_paid = 1 GROUP BY paid_date ORDER BY paid_date DESC`
        ).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRamanReport') {
        // Year/month reporting for owner — replaces flat history laundry-list.
        // Also detects "missed" guests: checked_out stays with NO matching
        // raman_commissions row (e.g. commission was never auto-created).
        const { results: paidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission, paid_date
           FROM stayvibe_manager_commissions WHERE is_paid = 1 ORDER BY checkin_date ASC`
        ).all()
        const { results: unpaidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission
           FROM stayvibe_manager_commissions WHERE is_paid = 0 ORDER BY checkin_date ASC`
        ).all()
        const { results: missedRows } = await DB.prepare(
          `SELECT s.stay_id, s.guest_name, s.checkin_date, s.nights
           FROM stayvibe_stays s
           LEFT JOIN stayvibe_manager_commissions rc ON rc.stay_id = s.stay_id
           WHERE s.status IN ('checked_out','closed') AND rc.comm_id IS NULL
           ORDER BY s.checkin_date ASC`
        ).all()

        // Group paid + unpaid together by year -> month, count guests, sum totals
        const byYearMonth = {}
        function addRow(r, isPaid) {
          const d = new Date(r.checkin_date)
          const yr = d.getFullYear()
          const mo = d.getMonth() + 1 // 1-12
          const yKey = String(yr)
          const mKey = `${yr}-${String(mo).padStart(2,'0')}`
          if (!byYearMonth[yKey]) byYearMonth[yKey] = { year: yr, months: {}, totalGuests: 0, totalPaid: 0, totalUnpaid: 0 }
          if (!byYearMonth[yKey].months[mKey]) {
            byYearMonth[yKey].months[mKey] = { key: mKey, month: mo, year: yr, guests: [], paidCount: 0, unpaidCount: 0, totalPaid: 0, totalUnpaid: 0 }
          }
          const mEntry = byYearMonth[yKey].months[mKey]
          mEntry.guests.push({ guestName: r.guest_name, checkIn: r.checkin_date, nights: r.nights, commission: r.commission, isPaid })
          if (isPaid) { mEntry.paidCount++; mEntry.totalPaid += r.commission||0; byYearMonth[yKey].totalPaid += r.commission||0 }
          else        { mEntry.unpaidCount++; mEntry.totalUnpaid += r.commission||0; byYearMonth[yKey].totalUnpaid += r.commission||0 }
          byYearMonth[yKey].totalGuests++
        }
        paidRows.forEach(r => addRow(r, true))
        unpaidRows.forEach(r => addRow(r, false))

        // Convert nested objects to sorted arrays
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const years = Object.values(byYearMonth)
          .sort((a,b) => b.year - a.year)
          .map(y => ({
            year: y.year,
            totalGuests: y.totalGuests,
            totalPaid: y.totalPaid,
            totalUnpaid: y.totalUnpaid,
            months: Object.values(y.months)
              .sort((a,b) => b.month - a.month)
              .map(m => ({
                ...m,
                monthName: MONTH_NAMES[m.month - 1],
                guests: m.guests.sort((a,b) => new Date(a.checkIn) - new Date(b.checkIn)),
              }))
          }))

        const grandTotalPaid   = paidRows.reduce((s,r) => s + (r.commission||0), 0)
        const grandTotalUnpaid = unpaidRows.reduce((s,r) => s + (r.commission||0), 0)

        return json({ success: true, data: {
          years,
          missedGuests: missedRows.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkIn: r.checkin_date, nights: r.nights })),
          grandTotalPaid, grandTotalUnpaid,
          totalGuestsAllTime: paidRows.length + unpaidRows.length,
        }})
      }

      if (action === 'getRamanDashboard') {
        const { results: byYear } = await DB.prepare(
          `SELECT strftime('%Y', COALESCE(paid_date, created_at)) as year, SUM(commission) as total_paid, COUNT(*) as stays_paid
           FROM stayvibe_manager_commissions WHERE is_paid = 1 GROUP BY year ORDER BY year DESC`
        ).all()
        const { results: unpaidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission FROM stayvibe_manager_commissions WHERE is_paid = 0 ORDER BY checkin_date ASC`
        ).all()

        const totalUnpaid = unpaidRows.reduce((s,r) => s + (r.commission||0), 0)
        const unpaidByQ = {}
        unpaidRows.forEach(r => {
          const d = new Date(r.checkin_date)
          const yr = d.getFullYear()
          const q  = Math.floor(d.getMonth() / 3) + 1
          const key = `${yr}-Q${q}`
          if (!unpaidByQ[key]) unpaidByQ[key] = { key, year: yr, quarter: q, label: `Q${q} ${yr}`, total: 0, stays: [] }
          unpaidByQ[key].total += r.commission || 0
          unpaidByQ[key].stays.push({ commId: r.comm_id, guestName: r.guest_name, checkIn: r.checkin_date, nights: r.nights, commission: r.commission })
        })
        const allTimePaid = byYear.reduce((s,r) => s + (r.total_paid||0), 0)

        return json({ success: true, data: {
          byYear: byYear.map(r => ({ year: r.year, totalPaid: r.total_paid, staysPaid: r.stays_paid })),
          unpaidByQ: Object.values(unpaidByQ).sort((a,b) => b.key.localeCompare(a.key)),
          totalUnpaid, allTimePaid, grandTotal: allTimePaid + totalUnpaid
        }})
      }

      if (action === 'getRentalIncome') {
        const propId = url.searchParams.get('propId')
        const year   = url.searchParams.get('year') || new Date().getFullYear()
        const month  = url.searchParams.get('month')
        let query = `SELECT * FROM rev360_rental_income WHERE year = ?`
        const binds = [year]
        if (propId) { query += ` AND prop_id = ?`; binds.push(propId) }
        if (month !== null && month !== undefined) { query += ` AND month = ?`; binds.push(parseInt(month)) }
        query += ` ORDER BY month ASC`
        const { results } = await DB.prepare(query).bind(...binds).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRentalDashboard') {
        const year = url.searchParams.get('year') || new Date().getFullYear()
        // Same migration as getRev360Dashboard: income from rent_transactions
        // (replaces rental_income's combined rent+car_parking), expense from
        // property_expenses (replaces rental_income's expense columns).
        const rentRows = await DB.prepare(`
          SELECT prop_id, CAST(substr(period_month, 6, 2) AS INTEGER) as month, SUM(total_due) as income
          FROM rev360_rent_transactions
          WHERE substr(period_month, 1, 4) = ?
          GROUP BY prop_id, month
        `).bind(String(year)).all()
        const expenseRows = await DB.prepare(`
          SELECT prop_id, month, SUM(total_expense) as expense
          FROM rev360_property_expenses
          WHERE year = ?
          GROUP BY prop_id, month
        `).bind(parseInt(year)).all()
        // Merge by (prop_id, month) into one row each, same as the
        // per-property merge in getRev360Dashboard.
        const byKey = {}
        rentRows.results.forEach(r => {
          byKey[`${r.prop_id}|${r.month}`] = { prop_id: r.prop_id, month: r.month, income: r.income || 0, expense: 0 }
        })
        expenseRows.results.forEach(r => {
          const k = `${r.prop_id}|${r.month}`
          if (!byKey[k]) byKey[k] = { prop_id: r.prop_id, month: r.month, income: 0, expense: 0 }
          byKey[k].expense = r.expense || 0
        })
        const rows = Object.values(byKey).map(r => ({ ...r, net: r.income - r.expense })).sort((a,b) => a.prop_id===b.prop_id ? a.month-b.month : (a.prop_id<b.prop_id?-1:1))
        const totalIncome  = rows.reduce((s, r) => s + (r.income || 0), 0)
        const totalExpense = rows.reduce((s, r) => s + (r.expense || 0), 0)
        const netIncome    = rows.reduce((s, r) => s + (r.net || 0), 0)
        return json({ success: true, data: { totalIncome, totalExpense, netIncome, rows } })
      }

      // COCONUT HARVESTS — Get History List
      if (action === 'getCoconutHarvests') {
        const year = url.searchParams.get('year')
        let query = `SELECT * FROM estate360_coconut_harvests`
        const binds = []
        if (year && year !== 'all') { query += ` WHERE harvest_date LIKE ?`; binds.push(`${year}%`) }
        query += ` ORDER BY harvest_date DESC`
        const { results } = binds.length
          ? await ActiveDB.prepare(query).bind(...binds).all()
          : await ActiveDB.prepare(query).all()
        const totalHarvests  = results.length
        const totalCount     = results.reduce((s, r) => s + (r.total_nuts || 0), 0)
        const grossRevenue   = results.reduce((s, r) => s + (r.total_earnings || 0), 0)
        const netIncome      = results.reduce((s, r) => s + (r.net_income || 0), 0)
        const totalExpense   = results.reduce((s, r) => s + (r.total_expense || 0), 0)
        const harvests = results.map(r => ({
          date:              r.harvest_date,
          monthShort:        new Date(r.harvest_date).toLocaleString('en-IN', { month: 'short' }),
          year:              new Date(r.harvest_date).getFullYear(),
          count:             r.total_nuts        || 0,
          rejected:          r.nuts_rejected     || 0,
          weight:            r.total_weight_kg   || 0,
          pricePerKg:        r.price_per_kg      || 0,
          harvester:         r.harvester_name    || '—',
          netIncome:         r.net_income        || 0,
          totalExpense:      r.total_expense     || 0,
          balanceDue:        r.balance_due       || 0,
          scheduledNext:     r.scheduled_harvest_date || null,
          actualNext:        r.next_harvest_date || null,
        }))
        const nextHarvestDate = results[0]?.scheduled_harvest_date || null
        return json({ success: true, data: { totalHarvests, totalCount, grossRevenue, netIncome, totalExpense, harvests, nextHarvestDate } })
      }

      // RUBBER HARVESTS — Get History List
      if (action === 'getRubberHarvests') {
        const year     = url.searchParams.get('year')
        const estateId = url.searchParams.get('estate') || 'pavutumuri'
        assertEstateAccess(payload, estateId)
        let query = `SELECT * FROM estate360_rubber_harvests WHERE estate_id = ?`
        const binds = [estateId]
        if (year && year !== 'all') { query += ` AND harvest_date LIKE ?`; binds.push(`${year}%`) }
        query += ` ORDER BY harvest_date DESC`
        const { results } = await ActiveDB.prepare(query).bind(...binds).all()

        const totalHarvests = results.length
        const totalWeightKg = results.reduce((s, r) => s + (r.weight_kg || 0), 0)
        const grossRevenue  = results.reduce((s, r) => s + (r.gross     || 0), 0)
        const totalExpense  = results.reduce((s, r) => s + (r.expense   || 0), 0)
        const netIncome     = results.reduce((s, r) => s + (r.net       || 0), 0)
        const harvests = results.map(r => ({
          date:         r.harvest_date,
          monthShort:   r.harvest_date ? new Date(r.harvest_date).toLocaleString('en-IN', { month: 'short' }) : '—',
          year:         r.harvest_date ? new Date(r.harvest_date).getFullYear() : null,
          weightKg:     r.weight_kg    || 0,
          pricePerKg:   r.price_per_kg || 0,
          gross:        r.gross        || 0,
          expense:      r.expense      || 0,
          net:          r.net          || 0,
          notes:        r.notes        || '',
        }))
        return json({ success: true, data: { totalHarvests, totalWeightKg, grossRevenue, totalExpense, netIncome, harvests } })
      }

      if (action === 'getInventory') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const includeInactive = url.searchParams.get('includeInactive') === '1'
        const { results } = await DB.prepare(
          includeInactive
            ? `SELECT * FROM stayvibe_inventory WHERE villa_id = ? ORDER BY sort_order, name`
            : `SELECT * FROM stayvibe_inventory WHERE villa_id = ? AND (active IS NULL OR active = 1) ORDER BY sort_order, name`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getInventoryPrices') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(`SELECT item_id, cost_price, sell_price FROM stayvibe_inventory WHERE villa_id = ?`).bind(villaId).all()
        const prices = Object.fromEntries(results.map(r => [r.item_id, { costPrice: r.cost_price, sellPrice: r.sell_price }]))
        return json({ success: true, data: prices })
      }

      if (action === 'getRateCard') {
        // Per-night tariff by villa + billable guest count (1-12). Used by the
        // "Get pricing" button on the enquiry screen, and reusable later by a
        // guest-facing quick-pricing screen — same shape either way.
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(
          `SELECT guest_count, tariff_per_night FROM stayvibe_villa_rate_cards WHERE villa_id = ? ORDER BY guest_count`
        ).bind(villaId).all()
        const rateCard = results.map(r => ({ guests: r.guest_count, tariff: r.tariff_per_night }))
        return json({ success: true, data: { villaId, rateCard } })
      }

      if (action === 'getInventoryRestockLog') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const limit   = parseInt(url.searchParams.get('limit') || '50', 10)
        const { results } = await DB.prepare(
          `SELECT * FROM stayvibe_inventory_restock_log WHERE villa_id = ? ORDER BY created_at DESC LIMIT ?`
        ).bind(villaId, limit).all()
        return json({ success: true, data: results })
      }

      if (action === 'runSQL') {
        const sql = url.searchParams.get('sql') || ''
        if (!sql.trim().toUpperCase().startsWith('SELECT') && !sql.trim().toUpperCase().startsWith('PRAGMA')) {
          return err('Only SELECT and PRAGMA queries allowed')
        }
        try {
          const { results } = await DB.prepare(sql).all()
          return json({ success: true, data: results, rowCount: results.length })
        } catch (e) { return json({ success: false, error: e.message }, 400) }
      }

      // SCHEMA SNAPSHOT — returns all tables + columns from live DB
      // Used by Maintenance > Schema Validation screen
      if (action === 'getSchemaSnapshot') {
        try {
          const { results: tables } = await DB.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name`
          ).all()

          const snapshot = {}
          for (const { name } of tables) {
            try {
              const { results: cols } = await DB.prepare(`PRAGMA table_info(${name})`).all()
              snapshot[name] = cols.map(c => ({
                name:    c.name,
                type:    c.type,
                notnull: c.notnull,
                dflt:    c.dflt_value,
                pk:      c.pk,
              }))
            } catch(_) {}
          }

          return json({ success: true, data: {
            snapshot,
            tableCount: Object.keys(snapshot).length,
            generatedAt: new Date().toISOString(),
          }})
        } catch(e) { return json({ success: false, error: e.message }, 500) }
      }

      if (action === 'runQuery') {
        const key = url.searchParams.get('key')
        const PRESET_QUERIES = {
          total_stays:       `SELECT COUNT(*) as total FROM stayvibe_stays`,
          by_channel:        `SELECT source, COUNT(*) as bookings, ROUND(SUM(net),0) as total_net FROM stayvibe_stays WHERE status NOT IN ('cancelled','void') GROUP BY source ORDER BY total_net DESC`,
          by_year:           `SELECT strftime('%Y', checkin_date) as year, COUNT(*) as bookings, ROUND(SUM(gross),0) as gross, ROUND(SUM(net),0) as net FROM stayvibe_stays WHERE status NOT IN ('cancelled','void') GROUP BY year ORDER BY year DESC`,
          top_guests:        `SELECT guest_name, COUNT(*) as visits, ROUND(SUM(net),0) as total_spent FROM stayvibe_stays WHERE status NOT IN ('cancelled','void') GROUP BY guest_name HAVING visits > 1 ORDER BY visits DESC LIMIT 10`,
          recent_5:          `SELECT stay_id, guest_name, checkin_date, source, ROUND(net,0) as net, status FROM stayvibe_stays ORDER BY checkin_date DESC LIMIT 5`,
          raman_unpaid:      `SELECT guest_name, checkin_date, nights, commission FROM stayvibe_manager_commissions WHERE is_paid = 0 ORDER BY checkin_date DESC`,
          raman_summary:     `SELECT is_paid, COUNT(*) as count, SUM(commission) as total FROM stayvibe_manager_commissions GROUP BY is_paid`,
          inventory_stock:   `SELECT name, category, qty_in_stock, sell_price FROM stayvibe_inventory WHERE villa_id = '${DEFAULT_VILLA_ID}' ORDER BY category, name`,
          low_stock:         `SELECT name, qty_in_stock, sell_price FROM stayvibe_inventory WHERE villa_id = '${DEFAULT_VILLA_ID}' AND qty_in_stock <= 3 ORDER BY qty_in_stock`,
          rental_ytd:        `SELECT prop_id, SUM(rent+car_parking) as income, SUM(maintenance+electricity+water+property_tax+land_tax) as expense, SUM(net) as net FROM rev360_rental_income WHERE year = strftime('%Y','now') GROUP BY prop_id`,
          direct_conversion: `SELECT source, COUNT(*) as bookings FROM stayvibe_stays WHERE status NOT IN ('cancelled','void') GROUP BY source`,
          avg_tariff_year:   `SELECT strftime('%Y', checkin_date) as year, ROUND(AVG(tariff_per_night),0) as avg_tariff, ROUND(AVG(nights),1) as avg_nights FROM stayvibe_stays WHERE status NOT IN ('cancelled','void') AND tariff_per_night > 0 GROUP BY year ORDER BY year DESC`,
        }
        const sql = PRESET_QUERIES[key]
        if (!sql) return err(`Unknown query key: ${key}`)
        const { results } = await DB.prepare(sql).all()
        return json({ success: true, data: results, sql })
      }

      if (action === 'getMarketingStats') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const statYear = url.searchParams.get('statYear') || null

        const cityQuery = statYear
          ? `SELECT COALESCE(NULLIF(from_city,''), NULLIF(city,''), 'Unknown') as city_name, COALESCE(NULLIF(state,''), '') as state_name, COALESCE(NULLIF(country,''), 'India') as country_name, COUNT(DISTINCT guest_name) as guest_count, COUNT(*) as booking_count, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stayvibe_stays WHERE villa_id = ? AND status NOT IN ('cancelled','void') AND checkin_date LIKE ? GROUP BY city_name, state_name, country_name ORDER BY guest_count DESC`
          : `SELECT COALESCE(NULLIF(from_city,''), NULLIF(city,''), 'Unknown') as city_name, COALESCE(NULLIF(state,''), '') as state_name, COALESCE(NULLIF(country,''), 'India') as country_name, COUNT(DISTINCT guest_name) as guest_count, COUNT(*) as booking_count, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stayvibe_stays WHERE villa_id = ? AND status NOT IN ('cancelled','void') GROUP BY city_name, state_name, country_name ORDER BY guest_count DESC`
        const cityBinds = statYear ? [villaId, `${statYear}%`] : [villaId]
        const { results: cityRows } = await DB.prepare(cityQuery).bind(...cityBinds).all()

        const { results: purposeRows } = await DB.prepare(
          `SELECT CASE WHEN LOWER(notes) LIKE '%wedding%' THEN 'Wedding' WHEN LOWER(notes) LIKE '%temple%' OR LOWER(notes) LIKE '%guruvayur%' THEN 'Temple / Pilgrimage' WHEN LOWER(notes) LIKE '%tourism%' OR LOWER(notes) LIKE '%holiday%' OR LOWER(notes) LIKE '%vacation%' THEN 'Tourism' WHEN LOWER(notes) LIKE '%family%' THEN 'Family Visit' WHEN LOWER(notes) LIKE '%arangettam%' THEN 'Arangettam' WHEN LOWER(notes) LIKE '%kerala%' THEN 'Kerala Tour' ELSE 'Other' END as purpose, COUNT(*) as bookings, COUNT(DISTINCT guest_name) as guests, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stayvibe_stays WHERE villa_id = ? AND status NOT IN ('cancelled','void') GROUP BY purpose ORDER BY bookings DESC`
        ).bind(villaId).all()

        const { results: channelRows } = await DB.prepare(
          `SELECT source as channel, COUNT(*) as bookings, COUNT(DISTINCT guest_name) as unique_guests, ROUND(SUM(COALESCE(gross,0)),0) as gross_revenue, ROUND(SUM(COALESCE(net,0)),0) as net_revenue, ROUND(SUM(COALESCE(commission_amt,0)),0) as total_commission FROM stayvibe_stays WHERE villa_id = ? AND status NOT IN ('cancelled','void') GROUP BY source ORDER BY net_revenue DESC`
        ).bind(villaId).all()

        const { results: staleRows } = await DB.prepare(
          `SELECT COUNT(*) as total, SUM(CASE WHEN from_city IS NULL OR from_city = '' THEN 1 ELSE 0 END) as missing_city, SUM(CASE WHEN state IS NULL OR state = '' THEN 1 ELSE 0 END) as missing_state, SUM(CASE WHEN country IS NULL OR country = '' THEN 1 ELSE 0 END) as missing_country, SUM(CASE WHEN guest_phone IS NULL OR guest_phone = '' THEN 1 ELSE 0 END) as missing_phone, SUM(CASE WHEN guest_email IS NULL OR guest_email = '' THEN 1 ELSE 0 END) as missing_email FROM stayvibe_stays WHERE status NOT IN ('cancelled','void')`
        ).all()

        const { results: monthRows } = await DB.prepare(
          `SELECT strftime('%Y', checkin_date) as year, strftime('%m', checkin_date) as month, COALESCE(NULLIF(state,''), COALESCE(NULLIF(country,''),'India')) as region, COUNT(DISTINCT guest_name) as guests, COUNT(*) as bookings, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stayvibe_stays WHERE villa_id = ? AND status NOT IN ('cancelled','void') AND from_city IS NOT NULL AND from_city != '' GROUP BY year, month, region ORDER BY year DESC, month ASC`
        ).bind(villaId).all()

        return json({ success: true, data: { cities: cityRows, purposes: purposeRows, channels: channelRows, stale: staleRows[0] || {}, monthlyByRegion: monthRows, statYear: statYear || 'all' } })
      }

      if (action === 'getOpenStays') {
        const { results } = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, drive_folder_id, drive_folder_url, status FROM stayvibe_stays WHERE status IN ('booked','confirmed','docs_uploaded') ORDER BY checkin_date ASC`).all()
        return json({ success: true, data: results.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkinDate: r.checkin_date, driveFolderId: r.drive_folder_id, driveFolderUrl: r.drive_folder_url, status: r.status })) })
      }

      if (action === 'findOpenStay') {
        const guestName   = url.searchParams.get('guestName')   || ''
        const checkInDate = url.searchParams.get('checkInDate')  || ''
        const firstName   = guestName.split(' ')[0]
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, children, guest_phone, guest_email, drive_folder_id, drive_folder_url, status, purpose_of_visit, mode_of_transport, vehicle_number, eta, nationality, city, state, country, request_early_checkin, request_late_checkout, request_breakfast, breakfast_choice, request_cab, govt_id_type, govt_id_num FROM stayvibe_stays WHERE guest_name LIKE ? AND status NOT IN ('cancelled','closed','checked_out','void') ORDER BY ABS(JULIANDAY(checkin_date) - JULIANDAY(?)) ASC LIMIT 1`
        ).bind(`%${firstName}%`, checkInDate || new Date().toISOString().slice(0,10)).all()
        if (results.length > 0) {
          const r = results[0]
          return json({ success: true, data: { stayId: r.stay_id, guestName: r.guest_name, checkinDate: r.checkin_date, checkoutDate: r.checkout_date, nights: r.nights, adults: r.adults, children: r.children, phone: r.guest_phone, email: r.guest_email, driveFolderId: r.drive_folder_id, driveFolderUrl: r.drive_folder_url, status: r.status, purposeOfVisit: r.purpose_of_visit, modeOfTransport: r.mode_of_transport, vehicleNumber: r.vehicle_number, eta: r.eta, nationality: r.nationality, city: r.city, state: r.state, country: r.country, requestEarlyCheckin: r.request_early_checkin, requestLateCheckout: r.request_late_checkout, requestBreakfast: r.request_breakfast, breakfastChoice: r.breakfast_choice, requestCab: r.request_cab, govtIdType: r.govt_id_type, govtIdNum: r.govt_id_num } })
        }
        return json({ success: true, data: null })
      }

      if (action === 'findStayForReview') {
        const guestName = url.searchParams.get('guestName') || ''
        const reviewDate = url.searchParams.get('reviewDate') || ''
        if (!guestName || !reviewDate) return err('guestName and reviewDate required')
        const windowStart = new Date(reviewDate)
        windowStart.setDate(windowStart.getDate() - 14)
        const { results } = await DB.prepare(`SELECT stay_id, guest_name, checkout_date FROM stayvibe_stays WHERE guest_name LIKE ? AND checkout_date >= ? AND checkout_date <= ? AND status NOT IN ('cancelled','void') ORDER BY checkout_date DESC LIMIT 1`).bind(`%${guestName.split(' ')[0]}%`, windowStart.toISOString().slice(0,10), reviewDate).all()
        if (results.length > 0) return json({ success: true, data: { stayId: results[0].stay_id, guestName: results[0].guest_name }})
        return json({ success: true, data: null })
      }

      if (action === 'getRamanTodo') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results: overdueRows } = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, source, status FROM stayvibe_stays WHERE villa_id = ? AND status IN ('checked_in','ready_for_checkout','pending_review') AND checkout_date < date('now') ORDER BY checkout_date ASC`).bind(villaId).all()
        const { results: upcomingRows } = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, source, status FROM stayvibe_stays WHERE villa_id = ? AND status IN ('confirmed','booked','ready_for_checkin','pending_review') AND checkin_date >= date('now') AND checkin_date <= date('now', '+7 days') ORDER BY checkin_date ASC`).bind(villaId).all()
        return json({ success: true, data: {
          overdue: overdueRows.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkInDate: r.checkin_date, checkOutDate: r.checkout_date, nights: r.nights, adults: r.adults, source: r.source, status: r.status, daysOver: Math.floor((new Date() - new Date(r.checkout_date)) / 86400000) })),
          upcoming: upcomingRows.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkInDate: r.checkin_date, checkOutDate: r.checkout_date, nights: r.nights, adults: r.adults, source: r.source, status: r.status, daysUntil: Math.floor((new Date(r.checkin_date) - new Date()) / 86400000) + 1 }))
        }})
      }

      // ── CHECK AVAILABILITY (enquiry screen) ─────────────────────────────
      // Conflicts = stays overlapping the requested range (same-day
      // turnover allowed: checkout day == requested check-in is NOT a
      // conflict). Nearby = stays within ±3 days for turnover context.
      if (action === 'checkAvailability') {
        const villaId  = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const checkIn  = url.searchParams.get('checkIn')
        const checkOut = url.searchParams.get('checkOut')
        if (!checkIn || !checkOut || checkOut <= checkIn) return err('checkIn and checkOut (after checkIn) required')
        const { results } = await DB.prepare(`
          SELECT stay_id, guest_name, checkin_date, checkout_date, source, status
          FROM stayvibe_stays
          WHERE villa_id = ?
            AND status NOT IN ('cancelled','void')
            AND checkout_date IS NOT NULL AND checkout_date != ''
            AND checkin_date  < date(?, '+3 day')
            AND checkout_date > date(?, '-3 day')
          ORDER BY checkin_date`).bind(villaId, checkOut, checkIn).all()
        const conflicts = [], nearby = []
        for (const r of (results || [])) {
          if (r.checkin_date < checkOut && r.checkout_date > checkIn) conflicts.push(r)
          else nearby.push(r)
        }
        return json({ success: true, data: { available: conflicts.length === 0, conflicts, nearby } })
      }

      if (action === 'getUpcomingStays') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, guest_phone, guest_email,
                  checkin_date, checkout_date, nights, adults, children,
                  source, status, villa_id, from_city,
                  drive_folder_id, drive_folder_url,
                  tariff_per_night, extra_charges, extra_lines, gross, net, notes,
                  commission_pct, commission_amt,
                  night_fee, cleaning_fee, host_service_fee, you_earn,
                  guest_service_fee, guest_paid_total,
                  airbnb_conf, folder_created,
                  request_early_checkin, request_late_checkout,
                  request_breakfast, breakfast_choice, request_cab,
                  request_extra_beds, extra_beds_count,
                  nationality, purpose_of_visit, mode_of_transport, eta,
                  booked_by_guest_id, booked_by_name
           FROM stayvibe_stays
           WHERE villa_id = ?
             AND status NOT IN ('closed','cancelled','void')
             AND (checkin_date >= date('now', '-1 day') OR status IN ('checked_in','ready_for_checkout'))
           ORDER BY checkin_date ASC`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRentalAgreements') {
        const { results } = await DB.prepare(`SELECT * FROM rev360_rental_props ORDER BY prop_id`).all()
        return json({ success: true, data: results })
      }

      // ALL PROPERTIES — the real fix for a long-standing bug: 5
      // screens (RentalProperties, RentalAgreement, PropertyDetails,
      // ClaimsLedger, ClaimsReport) used to read property lists from
      // CONFIG.rentalProperties, a hardcoded array in config.js. Every
      // "Add Property" flow did CONFIG.rentalProperties.push(...),
      // which only mutates the in-memory object for that page load --
      // never persisted, so a newly added property vanished from every
      // screen on reload even though it WAS correctly saved to
      // rental_props. This action gives every screen ONE live,
      // database-backed source of truth instead. Joins rental_props
      // (tenancy/lease state) with property_details (unit/floor/
      // building/parking/furnishing/address -- added in
      // migrate-property-details-characteristics.sql specifically to
      // make this join possible) so the shape matches what
      // CONFIG.rentalProperties used to provide.
      if (action === 'getAllProperties') {
        const { results } = await DB.prepare(`
          SELECT
            rp.prop_id as id, rp.name, rp.location, rp.country, rp.tenant_name as tenantName,
            rp.lease_end as leaseEnd, rp.stage,
            pd.unit_no as unitNo, pd.floor, pd.building_name as building,
            pd.has_parking as hasParking, pd.furnishing,
            pd.elec_consumer_id as electricityConsumerNo,
            pd.address_line1, pd.address_line2, pd.city, pd.state_province, pd.postal_code, pd.country as detailsCountry
          FROM rev360_rental_props rp
          LEFT JOIN rev360_property_details pd ON pd.prop_id = rp.prop_id
          ORDER BY rp.prop_id
        `).all()
        // Build the same fullAddress convenience field RentalAgreement.jsx
        // already computes client-side for documents, so every screen
        // gets it for free without re-deriving the same logic.
        const withFullAddress = results.map(r => ({
          ...r,
          hasParking: !!r.hasParking,
          fullAddress: r.address_line1
            ? [r.address_line1, r.address_line2, [r.city, r.state_province].filter(Boolean).join(', '), r.postal_code, r.detailsCountry]
                .filter(Boolean).join(', ')
            : null,
        }))
        return json({ success: true, data: withFullAddress })
      }

      if (action === 'getPropertyDetails') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const row = await DB.prepare(`SELECT * FROM rev360_property_details WHERE prop_id = ?`).bind(propId).first()
        return json({ success: true, data: row || null })
      }

      if (action === 'getHoaHistory') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_hoa_history WHERE prop_id = ? ORDER BY effective_date DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getTaxHistory') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_tax_history WHERE prop_id = ? ORDER BY tax_year DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getPropertyDocs') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_property_documents WHERE prop_id = ? ORDER BY category, created_at DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getLeaseLosses') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_lease_losses WHERE prop_id = ? ORDER BY created_at DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRev360Dashboard') {
        const year = new Date().getFullYear()
        const props = await DB.prepare(`SELECT * FROM rev360_rental_props ORDER BY prop_id`).all()
        // Income: rent_transactions (base_rent + maintenance + car_parking + late_fee,
        // i.e. total_due) is the new source of truth, replacing rental_income's
        // combined rent+car_parking column -- rental_income can't represent a
        // late fee or an actual payment date, which is the whole reason this
        // table exists. rental_income itself is left untouched, just no longer
        // read here.
        const rentIncome = await DB.prepare(`
          SELECT prop_id, SUM(total_due) as income, COUNT(*) as months_entered
          FROM rev360_rent_transactions
          WHERE substr(period_month, 1, 4) = ?
          GROUP BY prop_id
        `).bind(String(year)).all()
        // Expenses: property_expenses replaces rental_income's expense
        // columns (electricity/water/property_tax/land_tax/extra_maintenance).
        const propExpense = await DB.prepare(`
          SELECT prop_id, SUM(total_expense) as expense
          FROM rev360_property_expenses
          WHERE year = ?
          GROUP BY prop_id
        `).bind(year).all()
        // Merge the two by prop_id into the same {prop_id, income, expense, net,
        // months_entered} shape the frontend already expects -- a property with
        // rent postings but no expense rows (or vice versa) still gets a single
        // combined row rather than two partial ones.
        const byProp = {}
        rentIncome.results.forEach(r => {
          byProp[r.prop_id] = { prop_id: r.prop_id, income: r.income || 0, expense: 0, months_entered: r.months_entered || 0 }
        })
        propExpense.results.forEach(r => {
          if (!byProp[r.prop_id]) byProp[r.prop_id] = { prop_id: r.prop_id, income: 0, expense: 0, months_entered: 0 }
          byProp[r.prop_id].expense = r.expense || 0
        })
        const income = Object.values(byProp).map(r => ({ ...r, net: r.income - r.expense }))
        const losses = await DB.prepare(`SELECT prop_id, SUM(amount) as total_claimed, SUM(CASE WHEN status='Unrecoverable' THEN amount ELSE 0 END) as total_written_off, SUM(CASE WHEN status='Recovered' THEN amount ELSE 0 END) as total_recovered, COUNT(*) as claim_count FROM rev360_lease_losses GROUP BY prop_id`).all()
        const renewalAlerts = await DB.prepare(`
          SELECT prop_id, name, tenant_name, lease_end, status,
            CAST((julianday(lease_end) - julianday('now')) AS INTEGER) as days_left,
            'main' as unit_type
          FROM rev360_rental_props
          WHERE lease_end IS NOT NULL AND lease_end != ''
            AND julianday(lease_end) - julianday('now') <= 90
          UNION ALL
          SELECT prop_id, name, parking_tenant_name as tenant_name, parking_lease_end as lease_end, status,
            CAST((julianday(parking_lease_end) - julianday('now')) AS INTEGER) as days_left,
            'parking' as unit_type
          FROM rev360_rental_props
          WHERE has_separate_parking = 1
            AND parking_lease_end IS NOT NULL AND parking_lease_end != ''
            AND julianday(parking_lease_end) - julianday('now') <= 30
          ORDER BY days_left ASC
        `).all()
        return json({ success: true, data: { year, properties: props.results, income, losses: losses.results, renewalAlerts: renewalAlerts.results } })
      }

      if (action === 'getGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        const { results } = await DB.prepare(`SELECT doc_id, stay_id, doc_type, file_name, file_b64 FROM stayvibe_guest_documents WHERE stay_id = ? AND folder_created = 0`).bind(stayId).all()
        return json({ success: true, data: results })
      }

      // Car/plate photos for in-app viewing — returns them whether or not
      // they've reached Drive yet (folder_created 0 or 1), since they're
      // intentionally kept in D1 for ~5 days for exactly this purpose.
      if (action === 'getStayPhotos') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        const { results } = await DB.prepare(
          `SELECT doc_id, doc_type, file_name, file_b64, created_at
           FROM stayvibe_guest_documents WHERE stay_id = ? AND doc_type IN ('car_photo','plate_photo')
           ORDER BY created_at DESC`
        ).bind(stayId).all()
        return json({ success: true, data: results })
      }
      // Any stay with unprocessed docs (folder_created=0), regardless of
      // status — catches car/plate photos attached at check-in (status
      // already 'checked_in' by then), which getPendingReviewStays alone
      // would never surface since it's scoped to pending_review only.
      if (action === 'getStaysWithPendingDocuments') {
        const { results } = await DB.prepare(`
          SELECT DISTINCT s.stay_id, s.guest_name, s.checkin_date, s.checkout_date,
                 s.status, s.drive_folder_id, s.drive_folder_url,
                 (s.drive_folder_id IS NOT NULL AND s.drive_folder_id != '') as folder_created
          FROM stayvibe_stays s
          JOIN stayvibe_guest_documents d ON d.stay_id = s.stay_id
          WHERE d.folder_created = 0
        `).all()
        return json({ success: true, data: results.map(r => ({
          stayId: r.stay_id, guestName: r.guest_name, checkIn: r.checkin_date, checkOut: r.checkout_date,
          status: r.status, driveFolderId: r.drive_folder_id, driveFolderUrl: r.drive_folder_url,
          folderCreated: !!r.folder_created,
        })) })
      }

      // ── RECENT ACTIVITY (last 48 hrs) — bookings + cancellations ─────
      // Feeds the owner-home "Your last 48 hrs" acknowledgement block. New
      // bookings by created_at, cancellations by updated_at.
      if (action === 'recentActivity') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, source, status, booked_by_name,
                  CASE WHEN status = 'cancelled' THEN 'cancellation' ELSE 'booking' END AS kind,
                  CASE WHEN status = 'cancelled' THEN updated_at ELSE created_at END AS event_at
             FROM stayvibe_stays
            WHERE villa_id = ?
              AND (
                (status = 'cancelled' AND updated_at >= datetime('now','-48 hours'))
                OR (status NOT IN ('cancelled','void','closed') AND created_at >= datetime('now','-48 hours'))
              )
            ORDER BY event_at DESC
            LIMIT 25`
        ).bind(villaId).all()
        const items = (results || []).map(r => ({
          stayId: r.stay_id, guestName: r.guest_name,
          checkIn: r.checkin_date, checkOut: r.checkout_date,
          source: r.source || 'direct', bookedByName: r.booked_by_name || null,
          kind: r.kind, eventAt: r.event_at,
        }))
        return json({ success: true, data: { items } })
      }

      if (action === 'getDuplicateBookings') {
        const months = parseInt(url.searchParams.get('months') || '2')
        const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
        const { results } = await DB.prepare(`SELECT * FROM stayvibe_duplicate_bookings WHERE detected_at >= ? AND (resolved IS NULL OR resolved = 0) ORDER BY detected_at DESC`).bind(cutoff.toISOString().slice(0,10)).all()
        const byChannel = {}
        results.forEach(r => {
          const ch = r.new_source || 'unknown'
          if (!byChannel[ch]) byChannel[ch] = { channel: ch, count: 0, incidents: [] }
          byChannel[ch].count++
          byChannel[ch].incidents.push({ dupId: r.dup_id, detectedAt: r.detected_at, existingGuest: r.existing_guest, existingDates: r.existing_checkin + ' → ' + r.existing_checkout, newGuest: r.new_guest, newDates: r.new_checkin + ' → ' + r.new_checkout, overlapNights: r.overlap_nights })
        })
        return json({ success: true, data: { total: results.length, months, byChannel: Object.values(byChannel).sort((a,b) => b.count - a.count), all: results } })
      }

      // MANAGER HOME — Quick Info Stats Block (Aligned to exact Schema Fields)
      if (action === 'getManagerQuickInfo') {
        const estateId   = actor === 'pradosh' ? 'pollachi' : (actor === 'raman' ? 'pavutumuri' : 'pollachi')
        const estateType = actor === 'raman' ? 'rubber' : 'coconut'
        const today      = new Date().toISOString().slice(0, 10)

        if (estateType === 'coconut') {
          const harvest = await ActiveDB.prepare(
            `SELECT harvest_date, price_per_kg, scheduled_harvest_date FROM estate360_coconut_harvests WHERE estate_id = ? ORDER BY harvest_date DESC LIMIT 1`
          ).bind(estateId).first()

          const irrigation = await ActiveDB.prepare(
            `SELECT logged_date FROM estate360_irrigation_logs WHERE estate = ? ORDER BY logged_date DESC LIMIT 1`
          ).bind(estateId).first()

          const lastPrice      = harvest?.price_per_kg           || null
          const nextHarvest    = harvest?.scheduled_harvest_date || null
          const lastIrrigation = irrigation?.logged_date         || null
          const irrigationDays = lastIrrigation ? Math.round((new Date(today) - new Date(lastIrrigation)) / 86400000) : null
          const harvestDays    = nextHarvest ? Math.round((new Date(nextHarvest) - new Date(today)) / 86400000) : null

          return json({ success: true, data: {
            managerName: actor === 'pradosh' ? 'Pradosh' : 'Manager', estateId, estateType,
            nextHarvestDate:    nextHarvest,
            harvestDaysAway:    harvestDays,
            lastPricePerKg:      lastPrice,
            lastIrrigationDate: lastIrrigation,
            irrigationDaysAgo:  irrigationDays,
            irrigationAlert:    irrigationDays === null || irrigationDays > 14,
          }})
        }

        const harvest = await ActiveDB.prepare(
          `SELECT harvest_date, price_per_kg FROM estate360_rubber_harvests WHERE estate_id = ? ORDER BY harvest_date DESC LIMIT 1`
        ).bind(estateId).first()
        return json({ success: true, data: {
          managerName: 'RamananKutty', estateId, estateType,
          lastPricePerKg:  harvest?.price_per_kg || null,
          lastHarvestDate: harvest?.harvest_date || null,
          irrigationAlert: false,
        }})
      }

      if (action === 'getCoconutMarketPrice') {
        try {
          const html = await fetch('https://coconutboard.in/PriceAppScroll/commodity.aspx', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bgIndia/1.0)' },
          }).then(r => r.text())

          // Extract value from a named span: <span id="lblcoconutgrn">35</span>
          const spanVal = (id) => {
            const m = html.match(new RegExp(`<span[^>]+id=["']${id}["'][^>]*>([^<]*)<\\/span>`, 'i'))
            return m ? m[1].trim() : ''
          }

          const parseEntry = (priceId, dateId) => {
            const priceRaw = spanVal(priceId)
            const dateRaw  = spanVal(dateId).replace(/[()]/g, '').trim()
            const price    = priceRaw ? parseFloat(priceRaw) : null
            const date     = dateRaw  || null
            return (price || date) ? { price, date } : null
          }

          return json({ success: true, data: {
            pollachiGreen: parseEntry('lblcoconutgrn',  'lblcoconutgrndate'),
            pollachiBlack: parseEntry('lblcoconutblk',  'lblcoconutblkdate'),
            thrissur:      parseEntry('lblcoconutthr',  'lblcoconutthrdate'),
            fetchedAt:     new Date().toISOString(),
          }})
        } catch (e) {
          return json({ success: false, error: 'Failed to fetch market price: ' + e.message })
        }
      }

      if (action === 'getCampaigns') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(`SELECT c.id, c.campaign_name, c.unique_token, c.channel, c.is_active, c.notes, c.created_at, SUM(CASE WHEN a.event_type='click' THEN 1 ELSE 0 END) as clicks, SUM(CASE WHEN a.event_type='inquiry' THEN 1 ELSE 0 END) as inquiries, SUM(CASE WHEN a.event_type='booking' THEN 1 ELSE 0 END) as bookings FROM stayvibe_marketing_campaigns c LEFT JOIN stayvibe_campaign_analytics a ON a.campaign_id = c.id WHERE c.villa_id = ? GROUP BY c.id ORDER BY c.created_at DESC`).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getCampaignAnalytics') {
        const campaignId = url.searchParams.get('campaignId') || ''
        if (!campaignId) return err('campaignId required')
        const events = await DB.prepare(`SELECT event_type, country, region, city, strftime('%H', ts) as hour, DATE(ts) as day, COUNT(*) as n FROM stayvibe_campaign_analytics WHERE campaign_id = ? GROUP BY event_type, country, region, city, hour, day ORDER BY day DESC, hour DESC`).bind(campaignId).all()
        return json({ success: true, data: events.results })
      }

      // IRRIGATION ZONE HEALTH DASHBOARD (Cleaned to exclude non-existent column fields)
      if (action === 'getIrrigationZoneHealth') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const today    = new Date().toISOString().slice(0, 10)

        let zones = []
        try {
          const { results } = await ActiveDB.prepare(
            `SELECT * FROM estate360_irrigation_zones WHERE estate = ? AND active = 1 ORDER BY sort_order ASC`
          ).bind(estateId).all()
          zones = results
        } catch(e) { return json({ success: true, data: { zones: [], lastRun: null } }) }

        if (zones.length === 0) return json({ success: true, data: { zones: [], lastRun: null } })

        const zoneHealth = await Promise.all(zones.map(async (z) => {
          const { results: logs } = await ActiveDB.prepare(
            `SELECT logged_date FROM estate360_irrigation_logs WHERE estate = ? AND zone_id = ? ORDER BY logged_date DESC LIMIT 5`
          ).bind(estateId, z.zone_id).all()

          const lastLogged   = logs[0]?.logged_date || null
          const freq         = z.expected_freq_days || 7
          const daysSince    = lastLogged ? Math.round((new Date(today) - new Date(lastLogged)) / 86400000) : null

          let consecutiveMisses = 0
          if (!lastLogged) { consecutiveMisses = 3 }
          else {
            const missedCycles = daysSince !== null ? Math.floor(daysSince / freq) : 3
            consecutiveMisses = Math.max(0, missedCycles - 1)
            if (daysSince > freq + 2) consecutiveMisses = Math.max(1, consecutiveMisses)
          }

          const status = !lastLogged ? 'never' : consecutiveMisses >= 3 ? 'critical' : consecutiveMisses === 2 ? 'alert' : consecutiveMisses === 1 ? 'warn' : daysSince !== null && daysSince > freq + 2 ? 'warn' : 'ok'

          return { zone_id: z.zone_id, zone_name: z.zone_name, zone_label: z.zone_label, expected_freq_days: freq, last_logged: lastLogged, days_since: daysSince, consecutive_misses: consecutiveMisses, status }
        }))

        const lastRun = await ActiveDB.prepare(`SELECT MAX(logged_date) as last FROM estate360_irrigation_logs WHERE estate = ?`).bind(estateId).first()
        return json({ success: true, data: { zones: zoneHealth, lastRun: lastRun?.last || null } })
      }

      // IRRIGATION HISTORY — full log list
      if (action === 'getIrrigationHistory') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const { results } = await ActiveDB.prepare(`SELECT * FROM estate360_irrigation_logs WHERE estate = ? ORDER BY logged_date DESC LIMIT 200`).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // MANGO HARVESTS — list
      if (action === 'getMangoHarvests') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const { results } = await ActiveDB.prepare(`SELECT * FROM estate360_mango_harvests WHERE estate = ? ORDER BY harvest_date DESC`).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // ESTATE LEDGER TRANSACTIONS — full history list (Income/Expense tab)
      if (action === 'getEstateTransactions') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const { results } = await ActiveDB.prepare(
          `SELECT txn_id, estate, type, date, category, amount, paid_to, description, created_at
           FROM estate360_estate_transactions WHERE estate = ? ORDER BY date DESC, created_at DESC LIMIT 500`
        ).bind(estateId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getVillaExpenses') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(
          `SELECT txn_id, villa_id, date, category, amount, paid_to, description, created_at
           FROM stayvibe_villa_expenses WHERE villa_id = ? ORDER BY date DESC, created_at DESC LIMIT 500`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      // Per-villa configurable settings (SaaS onboarding) — key/value pairs,
      // e.g. 'owner_email_alert'. Returned as a flat object for easy form binding.
      if (action === 'getVillaSettings') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(`SELECT key, value FROM stayvibe_villa_settings WHERE villa_id = ?`).bind(villaId).all()
        const settings = {}
        // Keys prefixed with '_' are internal/sensitive (e.g. _resend_api_key)
        // and are never returned to the browser via this general endpoint.
        for (const row of results) if (!row.key.startsWith('_')) settings[row.key] = row.value
        return json({ success: true, data: settings })
      }

      // Recent alert-email attempts (success + failure) — see sendAlert().
      if (action === 'getAlertLog') {
        const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200)
        const { results } = await DB.prepare(
          `SELECT log_id, villa_id, subject, to_email, success, status_code, error_detail, created_at
           FROM infra_alert_log ORDER BY created_at DESC LIMIT ?`
        ).bind(limit).all()
        return json({ success: true, data: results })
      }

      // ESTATE CONTACTS
      if (action === 'getEstateContacts') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const { results } = await ActiveDB.prepare(`SELECT * FROM estate360_estate_contacts WHERE estate = ? AND active = 1 ORDER BY category, name`).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // ESTATE HIGHLIGHTS — Operational Summary Dashboard
      if (action === 'getEstateHighlights') {
        const estateId  = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const cutoff    = new Date(); cutoff.setMonth(cutoff.getMonth() - 12)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        const today     = new Date().toISOString().slice(0, 10)

        const { results: harvests } = await ActiveDB.prepare(
          `SELECT harvest_date, scheduled_harvest_date, total_nuts, total_weight_kg, harvester_name FROM estate360_coconut_harvests WHERE estate_id = ? AND harvest_date >= ? ORDER BY harvest_date DESC`
        ).bind(estateId, cutoffStr).all()

        const harvestTimings = harvests.map((h, i) => {
          // planned = what the PREVIOUS harvest said the next one should be
          // harvests are sorted DESC so prev = harvests[i+1]
          const prev = harvests[i + 1]
          const planned = prev?.scheduled_harvest_date || null
          const gap = (planned && h.harvest_date)
            ? Math.round((new Date(h.harvest_date) - new Date(planned)) / 86400000)
            : null
          return { date: h.harvest_date, planned, gap, nuts: h.total_nuts, weightKg: h.total_weight_kg }
        })

        const lastHarvest = harvests[0]
        const nextScheduled = lastHarvest?.scheduled_harvest_date || null
        const daysToNext = nextScheduled ? Math.round((new Date(nextScheduled) - new Date(today)) / 86400000) : null

        const { results: irrigLogs } = await ActiveDB.prepare(
          `SELECT logged_date, strftime('%Y-%m', logged_date) as ym, COUNT(*) as count FROM estate360_irrigation_logs WHERE estate = ? AND logged_date >= ? GROUP BY ym ORDER BY ym DESC`
        ).bind(estateId, cutoffStr).all()

        const lastIrrigation = await ActiveDB.prepare(`SELECT logged_date FROM estate360_irrigation_logs WHERE estate = ? ORDER BY logged_date DESC LIMIT 1`).bind(estateId).first()

        let lastFert = null, nextFert = null
        try {
          const { results: fertilizations } = await ActiveDB.prepare(
            `SELECT planned_date, actual_date, fertilizer_type, notes FROM estate360_fertilization_log WHERE estate = ? ORDER BY planned_date DESC`
          ).bind(estateId).all()
          lastFert = fertilizations.find(f => f.actual_date) || null
          nextFert = fertilizations.find(f => !f.actual_date) || null
        } catch(e) {}

        let mangoes = []
        try {
          const { results: mangoResults } = await ActiveDB.prepare(
            `SELECT strftime('%Y', harvest_date) as harvest_year,
               SUM(alphonsa)     as alphonsa,
               SUM(neelam)       as neelam,
               SUM(malgova)      as malgova,
               SUM(banganapally) as banganapally,
               SUM(kilimooku)    as kilimooku,
               SUM(sindooram)    as sindooram,
               SUM(mix)          as mix,
               SUM(CASE WHEN box_type='Normal' THEN total_boxes ELSE 0 END) as normal_boxes,
               SUM(CASE WHEN box_type='Small'  THEN total_boxes ELSE 0 END) as small_boxes,
               SUM(total_boxes)  as total_boxes,
               SUM(total_revenue) as revenue
             FROM estate360_mango_harvests WHERE estate = ?
             GROUP BY harvest_year ORDER BY harvest_year DESC LIMIT 3`
          ).bind(estateId).all()
          mangoes = mangoResults
        } catch(e) {}

        return json({ success: true, data: {
          coconut: { harvestTimings, nextScheduled, daysToNext, totalHarvests: harvests.length },
          irrigation: { monthly: irrigLogs, lastDate: lastIrrigation?.logged_date || null, daysAgo: lastIrrigation?.logged_date ? Math.round((new Date(today) - new Date(lastIrrigation.logged_date)) / 86400000) : null },
          fertilization: { last: lastFert ? { date: lastFert.actual_date, type: lastFert.fertilizer_type } : null, next: nextFert ? { date: nextFert.planned_date, type: nextFert.fertilizer_type, notes: nextFert.notes } : null },
          mango: mangoes,
        }})
      }

      // ESTATE DASHBOARD — Financial Year-to-Date P&L Aggregation
      if (action === 'getEstateDashboard') {
        if (payload.role !== 'owner' && payload.role !== 'master_owner') return err('Owner access only', 403)
        const estateId = url.searchParams.get('estate') || 'pollachi'
        assertEstateAccess(payload, estateId)
        const today = new Date()
        const curYear = today.getFullYear()
        const cutoffStr = `${curYear}-01-01`            // calendar year-to-date
        const todayStr  = today.toISOString().slice(0, 10)

        const { results: harvests } = await ActiveDB.prepare(
          `SELECT harvest_date, total_earnings, total_expense, net_income, harvest_expense, dehusk_expense, tractor_expense, other_expense FROM estate360_coconut_harvests WHERE estate_id = ? AND harvest_date >= ? ORDER BY harvest_date DESC`
        ).bind(estateId, cutoffStr).all()

        const { results: txns } = await ActiveDB.prepare(
          `SELECT date, type, category, amount, paid_to, description FROM estate360_estate_transactions WHERE estate = ? AND date >= ? ORDER BY date DESC`
        ).bind(estateId, cutoffStr).all()

        let mangoRevenue = 0
        try {
          const mangoData = await ActiveDB.prepare(`SELECT SUM(total_revenue) as total FROM estate360_mango_harvests WHERE estate = ? AND harvest_date >= ?`).bind(estateId, cutoffStr).first()
          mangoRevenue = mangoData?.total || 0
        } catch(e) {}

        let rubberHarvests = []
        try {
          const { results: rh } = await ActiveDB.prepare(
            `SELECT harvest_date, gross, expense, net FROM estate360_rubber_harvests WHERE estate_id = ? AND harvest_date >= ? ORDER BY harvest_date DESC`
          ).bind(estateId, cutoffStr).all()
          rubberHarvests = rh
        } catch(e) {}

        const harvestIncome  = harvests.reduce((s, r) => s + (r.total_earnings || 0), 0)
        const harvestExpense = harvests.reduce((s, r) => s + (r.total_expense  || 0), 0)

        const rubberIncome  = rubberHarvests.reduce((s, r) => s + (r.gross   || 0), 0)
        const rubberExpense = rubberHarvests.reduce((s, r) => s + (r.expense || 0), 0)

        const txnIncome  = txns.filter(t => t.type === 'income' ).reduce((s,t) => s+(t.amount||0), 0)
        const txnExpense = txns.filter(t => t.type === 'expense').reduce((s,t) => s+(t.amount||0), 0)

        const totalIncome  = harvestIncome  + txnIncome + mangoRevenue + rubberIncome
        const totalExpense = harvestExpense + txnExpense + rubberExpense
        const netProfit    = totalIncome - totalExpense

        const expBreakdown = {}
        const addExp = (bucket, k, v) => { if (v) bucket[k] = (bucket[k]||0) + v }
        harvests.forEach(r => {
          addExp(expBreakdown, 'Harvest labour',   r.harvest_expense)
          addExp(expBreakdown, 'Dehusking',         r.dehusk_expense)
          addExp(expBreakdown, 'Tractor / tiling',  r.tractor_expense)
          addExp(expBreakdown, 'Other (harvest)',   r.other_expense)
        })
        if (rubberExpense > 0) expBreakdown['Rubber tapping'] = (expBreakdown['Rubber tapping']||0) + rubberExpense
        txns.filter(t => t.type === 'expense').forEach(t => addExp(expBreakdown, t.category, t.amount))

        // Per-month aggregation, including a per-month expense category breakdown
        // (totals, for the bars) AND per-line-item detail (expLines: category ->
        // [{date, amount, paidTo, description}]) so the UI can drill a clicked
        // category open into its individual dated entries.
        const monthly = {}
        const ensureMonth = (ym) => { if (!monthly[ym]) monthly[ym] = { income:0, expense:0, net:0, harvests:0, expBreakdown:{}, expLines:{} } }
        const addExpLine = (bucket, k, v, extra) => {
          if (!v) return
          if (!bucket[k]) bucket[k] = []
          bucket[k].push({ amount: v, ...extra })
        }

        harvests.forEach(r => {
          const ym = r.harvest_date.slice(0, 7)
          ensureMonth(ym)
          monthly[ym].income  += r.total_earnings || 0
          monthly[ym].expense += r.total_expense  || 0
          monthly[ym].harvests += 1
          addExp(monthly[ym].expBreakdown, 'Harvest labour',  r.harvest_expense)
          addExp(monthly[ym].expBreakdown, 'Dehusking',        r.dehusk_expense)
          addExp(monthly[ym].expBreakdown, 'Tractor / tiling', r.tractor_expense)
          addExp(monthly[ym].expBreakdown, 'Other (harvest)',  r.other_expense)
          addExpLine(monthly[ym].expLines, 'Harvest labour',  r.harvest_expense, { date: r.harvest_date, description: 'Harvest labour' })
          addExpLine(monthly[ym].expLines, 'Dehusking',        r.dehusk_expense,  { date: r.harvest_date, description: 'Dehusking' })
          addExpLine(monthly[ym].expLines, 'Tractor / tiling', r.tractor_expense, { date: r.harvest_date, description: 'Tractor / tiling' })
          addExpLine(monthly[ym].expLines, 'Other (harvest)',  r.other_expense,   { date: r.harvest_date, description: 'Other harvest expense' })
        })
        rubberHarvests.forEach(r => {
          if (!r.harvest_date) return
          const ym = r.harvest_date.slice(0, 7)
          ensureMonth(ym)
          monthly[ym].income  += r.gross   || 0
          monthly[ym].expense += r.expense || 0
          addExp(monthly[ym].expBreakdown, 'Rubber tapping', r.expense)
          addExpLine(monthly[ym].expLines, 'Rubber tapping', r.expense, { date: r.harvest_date, description: 'Rubber tapping' })
        })
        txns.forEach(t => {
          const ym = t.date.slice(0, 7)
          ensureMonth(ym)
          if (t.type === 'income')  monthly[ym].income  += t.amount || 0
          if (t.type === 'expense') {
            monthly[ym].expense += t.amount || 0
            addExp(monthly[ym].expBreakdown, t.category, t.amount)
            addExpLine(monthly[ym].expLines, t.category, t.amount, { date: t.date, paidTo: t.paid_to || null, description: t.description || null })
          }
        })
        // Sort each category's line items newest-first, for a sensible default order
        Object.values(monthly).forEach(m => {
          Object.values(m.expLines).forEach(lines => lines.sort((a, b) => (b.date || '').localeCompare(a.date || '')))
        })

        const monthlyArr = Object.entries(monthly)
          .sort((a,b) => b[0].localeCompare(a[0]))
          .map(([ym, v]) => ({ ym, ...v, net: v.income - v.expense }))

        return json({ success: true, data: {
          rangeFrom: cutoffStr, rangeTo: todayStr,
          totalIncome, totalExpense, netProfit,
          harvestCount: harvests.length + rubberHarvests.length,
          expBreakdown, monthly: monthlyArr,
        } })
      }



      if (action === 'getCheckinLinks') {
        const { results } = await DB.prepare(`SELECT token, villa_id, partner, label, is_active, use_count, created_at FROM stayvibe_checkin_links ORDER BY villa_id, partner`).all()
        return json({ success: true, data: results })
      }


      // PENDING REVIEW STAYS — GET version (also available as POST)
      if (action === 'getPendingReviewStays') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights,
                  guest_phone, guest_email, drive_folder_url, created_at,
                  folder_created, folder_created_at, booked_by_name
           FROM stayvibe_stays
           WHERE status = 'pending_review'
             AND (checkout_date IS NULL OR checkout_date = '' OR checkout_date >= date('now'))
           ORDER BY checkin_date ASC`
        ).all()
        return json({ success: true, data: results.map(r => ({
          stayId:          r.stay_id,
          guestName:       r.guest_name,
          checkIn:         r.checkin_date,
          checkOut:        r.checkout_date,
          nights:          r.nights,
          phone:           r.guest_phone,
          email:           r.guest_email,
          driveFolderUrl:  r.drive_folder_url,
          createdAt:       r.created_at,
          folderCreated:   r.folder_created || 0,
          folderCreatedAt: r.folder_created_at || null,
          bookedByName:    r.booked_by_name || null,
        })) })
      }

      // REVIEW CHASE LIST — GET version
      if (action === 'getReviewChaseList') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults,
                  source, guest_phone, review_rating, review_date,
                  review_chased_at, review_chase_count
           FROM stayvibe_stays
           WHERE status = 'checked_out'
             AND checkout_date < date('now')
             AND (review_rating IS NULL OR review_rating = 0)
           ORDER BY checkout_date DESC
           LIMIT 100`
        ).all()
        const today = new Date()
        return json({ success: true, data: results.map(r => {
          const checkout = new Date(r.checkout_date)
          const daysOut  = Math.floor((today - checkout) / 86400000)
          const lastChased = r.review_chased_at ? new Date(r.review_chased_at) : null
          const daysSinceChase = lastChased ? Math.floor((today - lastChased) / 86400000) : null
          return {
            stayId:        r.stay_id,
            guestName:     r.guest_name,
            checkIn:       r.checkin_date,
            checkOut:      r.checkout_date,
            nights:        r.nights,
            adults:        r.adults,
            source:        r.source,
            phone:         r.guest_phone,
            reviewRating:  r.review_rating || 0,
            reviewDate:    r.review_date || null,
            chasedAt:      r.review_chased_at || null,
            chaseCount:    r.review_chase_count || 0,
            daysSinceChase,
            daysOut,
            autoCloseReady: daysOut >= 20,
          }
        }) })
      }


      // GET DOCUMENT STATUS — returns doc rows for a stay (all statuses)
      if (action === 'getDocumentStatus') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        const { results } = await DB.prepare(
          `SELECT doc_id, stay_id, doc_type, file_name, folder_created, created_at, updated_at
           FROM stayvibe_guest_documents WHERE stay_id = ?`
        ).bind(stayId).all()
        return json({ success: true, data: results })
      }

      // DELETE GUEST DOCUMENTS — called by Apps Script after uploading to Drive
      // Deletes ALL docs for the stay (regardless of folder_created) since upload is confirmed
      if (action === 'deleteGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        const result = await DB.prepare(
          `DELETE FROM stayvibe_guest_documents WHERE stay_id = ?`
        ).bind(stayId).run()
        return json({ success: true, data: { stayId, deleted: result.meta?.changes || 0 } })
      }

      // ════════════════ GUEST ENQUIRY MANAGEMENT (CRM) — GET ═══════════════

      // List enquiries for the tracker grid (optionally filtered by status)
      if (action === 'getEnquiries') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const status  = url.searchParams.get('status') || ''
        const { results } = await DB.prepare(
          status
            ? `SELECT * FROM stayvibe_enquiries WHERE villa_id = ? AND status = ? ORDER BY date_received DESC`
            : `SELECT * FROM stayvibe_enquiries WHERE villa_id = ? ORDER BY date_received DESC`
        ).bind(...(status ? [villaId, status] : [villaId])).all()
        return json({ success: true, data: results })
      }

      // Active (non-terminal) enquiries that have gone quiet — used by the daily
      // Apps Script run to decide who needs a 2-day or 5-day follow-up reminder
      // emailed to the owner. Excludes anything already emailed for that exact
      // threshold (reminder_Nday_sent_at IS NOT NULL), so the script can call
      // this every day without re-sending duplicates — markReminderSent clears
      // that once the email goes out, and logCommunication clears it again on
      // any fresh contact, restarting the clock.
      if (action === 'getStaleEnquiries') {
        const { results } = await DB.prepare(`
          SELECT enquiry_id, guest_name, phone, email, source, checkin_date, checkout_date,
                 nights, guests_count, status, quote_amount, final_offer_amount, notes,
                 date_received, last_contact_date, reminder_2day_sent_at, reminder_5day_sent_at,
                 CAST((julianday('now') - julianday(COALESCE(last_contact_date, date_received))) AS INTEGER) AS days_since_contact
          FROM stayvibe_enquiries
          WHERE status NOT IN ('confirmed','lost','cancelled')
            AND (
              (CAST((julianday('now') - julianday(COALESCE(last_contact_date, date_received))) AS INTEGER) >= 2 AND reminder_2day_sent_at IS NULL)
              OR
              (CAST((julianday('now') - julianday(COALESCE(last_contact_date, date_received))) AS INTEGER) >= 5 AND reminder_5day_sent_at IS NULL)
            )
          ORDER BY days_since_contact DESC
        `).all()
        return json({ success: true, data: results })
      }

      // Single enquiry + its communication timeline, for the detail screen
      if (action === 'getEnquiryDetail') {
        const enquiryId = url.searchParams.get('enquiryId') || ''
        if (!enquiryId) return err('enquiryId required')
        const enquiry = await DB.prepare(`SELECT * FROM stayvibe_enquiries WHERE enquiry_id = ?`).bind(enquiryId).first()
        if (!enquiry) return err('Enquiry not found', 404)
        const { results: timeline } = await DB.prepare(
          `SELECT * FROM stayvibe_communication_log WHERE enquiry_id = ? ORDER BY occurred_at ASC`
        ).bind(enquiryId).all()
        let guest = null
        if (enquiry.guest_id) {
          guest = await DB.prepare(`SELECT * FROM stayvibe_guests WHERE guest_id = ?`).bind(enquiry.guest_id).first()
        }
        return json({ success: true, data: { enquiry, timeline, guest } })
      }

      // Repeat-guest lookup by phone/email — used while creating a new enquiry,
      // before the enquiry is saved, so the UI can show the "Repeat Guest" badge live.
      if (action === 'findGuestMatch') {
        const phoneRaw = (url.searchParams.get('phone') || '').replace(/[\s\-]/g, '').replace(/^\+?91/, '')
        const emailRaw = (url.searchParams.get('email') || '').trim().toLowerCase()
        if (!phoneRaw && !emailRaw) return json({ success: true, data: null })
        const guest = await DB.prepare(
          `SELECT * FROM stayvibe_guests WHERE (phone = ? AND phone != '') OR (email = ? AND email != '') LIMIT 1`
        ).bind(phoneRaw, emailRaw).first()
        if (!guest) return json({ success: true, data: null })
        const { results: pastStays } = await DB.prepare(
          `SELECT stay_id, checkin_date, checkout_date, net, source FROM stayvibe_stays
           WHERE (guest_phone = ? OR guest_email = ?) AND status NOT IN ('cancelled','void')
           ORDER BY checkin_date DESC LIMIT 10`
        ).bind(phoneRaw, emailRaw).all()
        return json({ success: true, data: { guest, pastStays } })
      }

      // Type-ahead name search for the "Booked By" linker on Complete Booking —
      // returns guest_id (which findGuestMatch above doesn't, since it's keyed
      // off phone/email, not freeform name text). Minimum 2 chars to avoid
      // scanning the whole table on every keystroke.
      if (action === 'searchGuestsByName') {
        const q = (url.searchParams.get('q') || '').trim()
        if (q.length < 2) return json({ success: true, data: [] })
        const { results } = await DB.prepare(
          `SELECT guest_id, name, phone, email, total_stays FROM stayvibe_guests
           WHERE name LIKE ? ORDER BY total_stays DESC LIMIT 15`
        ).bind(`%${q}%`).all()
        return json({ success: true, data: results })
      }

      // Conversion dashboard — KPIs, source breakdown, repeat-guest metrics
      if (action === 'getEnquiryDashboard') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results: rows } = await DB.prepare(
          `SELECT * FROM stayvibe_enquiries WHERE villa_id = ? AND date_received LIKE ?`
        ).bind(villaId, `${year}%`).all()

        const totalEnquiries = rows.length
        const confirmed = rows.filter(r => r.status === 'confirmed')
        const lost      = rows.filter(r => r.status === 'lost')
        const revenueWon  = confirmed.reduce((s, r) => s + (r.booking_value || 0), 0)
        const revenueLost = lost.reduce((s, r) => s + (r.quote_amount || 0), 0)
        const conversionRate = totalEnquiries > 0 ? Math.round((confirmed.length / totalEnquiries) * 1000) / 10 : 0

        const bySource = {}
        rows.forEach(r => {
          const src = r.source || 'other'
          if (!bySource[src]) bySource[src] = { enquiries: 0, bookings: 0 }
          bySource[src].enquiries++
          if (r.status === 'confirmed') bySource[src].bookings++
        })
        Object.keys(bySource).forEach(src => {
          const b = bySource[src]
          b.conversionPct = b.enquiries > 0 ? Math.round((b.bookings / b.enquiries) * 1000) / 10 : 0
        })

        const repeatGuestRows = rows.filter(r => r.is_repeat_guest)
        const repeatGuestsThisYear = repeatGuestRows.length
        const repeatGuestRevenue = repeatGuestRows.filter(r => r.status === 'confirmed').reduce((s, r) => s + (r.booking_value || 0), 0)
        const avgRepeatDiscount = repeatGuestRows.length
          ? Math.round((repeatGuestRows.reduce((s, r) => s + (r.repeat_discount_pct || 0), 0) / repeatGuestRows.length) * 10) / 10
          : 0

        const lostReasons = {}
        lost.forEach(r => { const reason = r.lost_reason || 'other'; lostReasons[reason] = (lostReasons[reason] || 0) + 1 })

        return json({ success: true, data: {
          totalEnquiries, confirmedCount: confirmed.length, lostCount: lost.length,
          conversionRate, revenueWon, revenueLost, bySource,
          repeatGuestsThisYear, repeatGuestRevenue, avgRepeatDiscount, lostReasons,
        }})
      }

      // Enquiries needing follow-up today or overdue, for the dashboard alert block
      if (action === 'getEnquiryFollowUps') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(`
          SELECT * FROM stayvibe_enquiries
          WHERE villa_id = ? AND status NOT IN ('confirmed','lost','cancelled')
            AND follow_up_due IS NOT NULL AND follow_up_due <= date('now')
          ORDER BY follow_up_due ASC
        `).bind(villaId).all()
        return json({ success: true, data: results })
      }

      // TENANCY HISTORY read — past tenants for a property, kept fully
      // separate from rental_props' single current-tenant slot. The
      // matching write actions (saveTenancyHistory/deleteTenancyHistory)
      // are in the POST block below.
      if (action === 'getTenancyHistory') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_tenancy_history WHERE prop_id = ? ORDER BY lease_end DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      // RENT LEDGER read — backs the Quick-Post Billing component on the
      // Tenant Agreement screen. The matching write actions
      // (postRentPayment) are in the POST block below.
      if (action === 'getRentTransactions') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_rent_transactions WHERE prop_id = ? ORDER BY period_month DESC, unit_type ASC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      // INCOMING TENANT read — the forward-looking mirror of
      // getTenancyHistory. Holds a queued future tenant's intake data
      // separately from rental_props' single live slot, for the real
      // situation where a new tenant has signed while the current one is
      // still living there (e.g. on Notice Given). The matching write
      // actions (saveIncomingTenant/deleteIncomingTenant/
      // moveInIncomingTenant) are in the POST block below.
      if (action === 'getIncomingTenant') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const row = await DB.prepare(`SELECT * FROM rev360_incoming_tenants WHERE prop_id = ?`).bind(propId).first()
        return json({ success: true, data: row || null })
      }

      // PROPERTY EXPENSES read — backs the Expenses block on the Monthly
      // Tracker screen. The matching write (savePropertyExpense) is in
      // the POST block below.
      if (action === 'getPropertyExpenses') {
        const propId = url.searchParams.get('propId') || ''
        const year = url.searchParams.get('year') || ''
        if (!propId || !year) return err('propId and year required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_property_expenses WHERE prop_id = ? AND year = ? ORDER BY month ASC`).bind(propId, parseInt(year)).all()
        return json({ success: true, data: results })
      }

      // MAINTENANCE EVENTS read — backs the per-property maintenance log
      // on the Monthly Tracker's Expenses block. A property can have
      // multiple events in the same month (e.g. a fridge repair AND a
      // plumbing fix) -- this replaces the old single extra_maintenance
      // number, which is now auto-computed as SUM(amount) from here
      // (see savePropertyExpense in the POST block below).
      if (action === 'getMaintenanceEvents') {
        const propId = url.searchParams.get('propId') || ''
        const month = url.searchParams.get('month') || ''
        const year = url.searchParams.get('year') || ''
        if (!propId || !month || !year) return err('propId, month, and year required')
        const { results } = await DB.prepare(`SELECT * FROM rev360_maintenance_events WHERE prop_id = ? AND month = ? AND year = ? ORDER BY event_date ASC, created_at ASC`).bind(propId, parseInt(month), parseInt(year)).all()
        return json({ success: true, data: results })
      }

      // ── FIX (found during Release 2.1 demo-onboarding simulation,
      // pre-existing, unrelated to this release): these 4 actions were
      // misplaced inside the POST block below, but are called via HTTP GET
      // from the frontend (src/api/index.js's get() helper) — every one of
      // them 404'd in production. Relocated here, logic unchanged. ──

      // INVENTORY — low-stock items (qty_in_stock <= 10% of preferred_stock), for dashboard alerts
      if (action === 'getLowStockItems') {
        const villaId = url.searchParams.get('villaId') || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const { results } = await DB.prepare(`
          SELECT item_id, name, unit, category, qty_in_stock, preferred_stock
          FROM stayvibe_inventory
          WHERE villa_id = ? AND preferred_stock > 0 AND qty_in_stock <= (preferred_stock * 0.1)
          ORDER BY (CAST(qty_in_stock AS REAL) / preferred_stock) ASC
        `).bind(villaId).all()
        return json({ success: true, data: results })
      }

      // ── RUBBER MONTHLY REGISTER SUMMARY ─────────────────────────────────
      // Per-DATE classification across all tappers (a calendar day counts
      // once): rain if any row flags rain; tapping if sheets were produced;
      // maintenance if trees were worked but no sheets (prep/maintenance —
      // matches the paper register where trees are accounted but sheets = 0).
      // Wages = SUM(tree_count * tapping_rate). Plus month P&L from
      // estate_transactions (income vs expense by category).
      if (action === 'getRubberMonthly') {
        const estateId = url.searchParams.get('estate') || 'pavutumuri'
        assertEstateAccess(payload, estateId)
        const month = url.searchParams.get('month')
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return err("month required as 'YYYY-MM'")
        const { results: rows } = await ActiveDB.prepare(`
          SELECT prod_date,
                 MAX(COALESCE(rain,0))                          AS rain,
                 SUM(COALESCE(tree_count,0))                    AS trees,
                 SUM(COALESCE(sheet_count,0))                   AS sheets,
                 SUM(COALESCE(ottupal_count,0))                 AS ottupal,
                 ROUND(SUM(COALESCE(tree_count,0) * COALESCE(tapping_rate,0)), 2) AS wages
          FROM estate360_rubber_production
          WHERE estate_id = ? AND prod_date LIKE ?
          GROUP BY prod_date ORDER BY prod_date`).bind(estateId, `${month}%`).all()
        let tappingDays = 0, maintenanceDays = 0, rainDays = 0
        let trees = 0, sheets = 0, ottupal = 0, wages = 0
        for (const r of (rows || [])) {
          if (r.rain) rainDays++
          else if ((r.sheets || 0) > 0) tappingDays++
          else if ((r.trees || 0) > 0) maintenanceDays++
          trees += r.trees || 0; sheets += r.sheets || 0; ottupal += r.ottupal || 0; wages += r.wages || 0
        }
        const { results: txns } = await ActiveDB.prepare(`
          SELECT type, category, ROUND(SUM(amount),2) AS total
          FROM estate360_estate_transactions
          WHERE estate = ? AND date LIKE ?
          GROUP BY type, category ORDER BY type, total DESC`).bind(estateId, `${month}%`).all()
        const income  = (txns || []).filter(t => t.type === 'income')
        const expense = (txns || []).filter(t => t.type === 'expense')
        const totalIncome  = Math.round(income.reduce((a, t) => a + (t.total || 0), 0) * 100) / 100
        const totalExpense = Math.round(expense.reduce((a, t) => a + (t.total || 0), 0) * 100) / 100
        return json({ success: true, data: {
          month, days: { tapping: tappingDays, maintenance: maintenanceDays, rain: rainDays, recorded: (rows || []).length },
          production: { trees, sheets, ottupal, wages: Math.round(wages * 100) / 100 },
          pnl: { income, expense, totalIncome, totalExpense, net: Math.round((totalIncome - totalExpense) * 100) / 100 },
        }})
      }

      if (action === 'getRubberProduction') {
        const estateId = url.searchParams.get('estate') || 'pavutumuri'
        assertEstateAccess(payload, estateId)
        const month    = url.searchParams.get('month')      // 'YYYY-MM' optional
        const weekStart= url.searchParams.get('weekStart')  // 'YYYY-MM-DD' optional
        let query = `SELECT * FROM estate360_rubber_production WHERE estate_id = ?`
        const binds = [estateId]
        if (weekStart) {
          // week window: weekStart .. weekStart+6
          const ws = new Date(weekStart + 'T00:00:00')
          const we = new Date(ws); we.setDate(we.getDate() + 6)
          query += ` AND prod_date BETWEEN ? AND ?`
          binds.push(weekStart, we.toISOString().slice(0, 10))
        } else if (month) {
          query += ` AND prod_date LIKE ?`; binds.push(`${month}%`)
        }
        query += ` ORDER BY prod_date DESC LIMIT 400`
        const { results } = await ActiveDB.prepare(query).bind(...binds).all()
        const { results: workerRows } = await ActiveDB.prepare(
          `SELECT DISTINCT worker_name FROM estate360_rubber_production WHERE estate_id = ? ORDER BY worker_name`
        ).bind(estateId).all()
        const totalTrees   = results.reduce((s, r) => s + (r.tree_count    || 0), 0)
        const totalSheets  = results.reduce((s, r) => s + (r.sheet_count   || 0), 0)
        const totalOttupal = results.reduce((s, r) => s + (r.ottupal_count || 0), 0)
        return json({ success: true, data: {
          rows: results, totalTrees, totalSheets, totalOttupal,
          workers: workerRows.map(w => w.worker_name).filter(Boolean),
        }})
      }

      if (action === 'getManagerSettlements') {
        const estateId = url.searchParams.get('estate') || 'pavutumuri'
        assertEstateAccess(payload, estateId)
        const { results: payments } = await ActiveDB.prepare(
          `SELECT * FROM estate360_manager_settlements WHERE estate_id = ? ORDER BY payment_date DESC, created_at DESC LIMIT 500`
        ).bind(estateId).all()
        // Balance owed to the manager = total estate expenses − total paid to manager.
        const expRow = await ActiveDB.prepare(
          `SELECT COALESCE(SUM(amount),0) AS total FROM estate360_estate_transactions WHERE estate = ? AND type = 'expense'`
        ).bind(estateId).first()
        const totalExpenses = expRow?.total || 0
        const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
        return json({ success: true, data: {
          payments, totalExpenses, totalPaid,
          balance: totalExpenses - totalPaid,
        }})
      }

      return err(`Unknown GET action: ${action}`, 404)
    }

    // ── POST ROUTES ─────────────────────────────────────
    if (method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return err(`Invalid request body: ${e.message}`)
      }

      // ════════════════ GUEST ENQUIRY MANAGEMENT (CRM) — POST ══════════════

      // Create or update an enquiry. On create, runs phone/email matching
      // against `guests` — creates a new guests row if no match, or flags
      // is_repeat_guest + fills previous_stays/discount context if matched.
      if (action === 'saveEnquiry') {
        const villaId = body.villaId || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const normPhone = (body.phone || '').replace(/[\s\-]/g, '').replace(/^\+?91/, '')
        const normEmail = (body.email || '').trim().toLowerCase()

        let enquiryId = body.enquiryId
        let guestId = body.guestId || null

        // New enquiry — match or create the guest record
        if (!enquiryId) {
          enquiryId = genId('ENQ')
          if (normPhone || normEmail) {
            const existing = await DB.prepare(
              `SELECT * FROM stayvibe_guests WHERE (phone = ? AND phone != '') OR (email = ? AND email != '') LIMIT 1`
            ).bind(normPhone, normEmail).first()
            if (existing) {
              guestId = existing.guest_id
              await DB.prepare(`UPDATE stayvibe_guests SET last_seen_at = ?, updated_by = ?, updated_at = ? WHERE guest_id = ?`)
                .bind(now(), actor, now(), guestId).run()
            } else {
              guestId = genId('GST')
              await DB.prepare(`
                INSERT INTO stayvibe_guests (guest_id, name, phone, email, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(guestId, body.guestName || 'Unknown', normPhone, normEmail, actor, actor).run()
            }
          }
        }

        const guest = guestId ? await DB.prepare(`SELECT * FROM stayvibe_guests WHERE guest_id = ?`).bind(guestId).first() : null
        const isRepeat = !!(guest && guest.total_stays > 0)
        const previousStays = guest?.total_stays || 0

        const nights = body.checkInDate && body.checkOutDate
          ? Math.max(0, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000))
          : 0
        const adults = parseInt(body.adults, 10) || 0
        const children = parseInt(body.children, 10) || 0
        const infants = parseInt(body.infants, 10) || 0
        const guestsCount = body.guestsCount || (adults + children + infants) || 1

        const quoteAmount = parseFloat(body.quoteAmount) || 0
        const discountPct = parseFloat(body.repeatDiscountPct) || 0
        // New discount-category system is additive to the legacy repeat_discount_pct field.
        // The two are mutually exclusive in the UI per enquiry, but stored independently —
        // discount_amount/final_offer prefer discount_pct (new system) when a category is set,
        // otherwise fall back to the legacy repeat_discount_pct, matching what the form shows.
        const discountCategory = body.discountCategory || null
        const categoryDiscountPct = parseFloat(body.discountPct) || 0
        const effectiveDiscountPct = discountCategory ? categoryDiscountPct : discountPct
        const discountAmount = Math.round(quoteAmount * effectiveDiscountPct) / 100
        // Extra charges (e.g. "Additional Guest") are added on top of the base
        // quote and are NOT discounted — mirrors how extra_lines work on stays.
        const extraCharges = parseFloat(body.extraCharges) || 0
        const extraLines = body.extraLines != null ? String(body.extraLines) : null
        const finalOffer = quoteAmount - discountAmount + extraCharges

        if (body.enquiryId) {
          // Update existing
          await DB.prepare(`
            UPDATE stayvibe_enquiries SET
              guest_name = ?, phone = ?, email = ?, source = ?,
              checkin_date = ?, checkout_date = ?, nights = ?, guests_count = ?,
              adults = ?, children = ?, infants = ?, purpose = ?,
              quote_amount = ?, repeat_discount_pct = ?, discount_category = ?, discount_pct = ?,
              discount_amount = ?, extra_charges = ?, extra_lines = ?, final_offer_amount = ?,
              status = ?, last_contact_date = ?, follow_up_due = ?,
              lost_reason = ?, assigned_to = ?, notes = ?,
              updated_by = ?, updated_at = ?
            WHERE enquiry_id = ?
          `).bind(
            body.guestName, normPhone, normEmail, body.source || 'website',
            body.checkInDate || null, body.checkOutDate || null, nights, guestsCount,
            adults, children, infants, body.purpose || null,
            quoteAmount, discountPct, discountCategory, categoryDiscountPct,
            discountAmount, extraCharges, extraLines, finalOffer,
            body.status || 'new', body.lastContactDate || null, body.followUpDue || null,
            body.lostReason || null, body.assignedTo || 'owner', body.notes || null,
            actor, now(), body.enquiryId
          ).run()
          return json({ success: true, data: { enquiryId: body.enquiryId, isRepeatGuest: isRepeat, previousStays } })
        }

        await DB.prepare(`
          INSERT INTO stayvibe_enquiries (
            enquiry_id, villa_id, guest_id, guest_name, phone, email, source,
            checkin_date, checkout_date, nights, guests_count, adults, children, infants, purpose,
            quote_amount, is_repeat_guest, previous_stays, repeat_discount_pct,
            discount_category, discount_pct, discount_amount, extra_charges, extra_lines, final_offer_amount,
            status, assigned_to, notes, created_by, updated_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          enquiryId, villaId, guestId, body.guestName || 'Unknown', normPhone, normEmail, body.source || 'website',
          body.checkInDate || null, body.checkOutDate || null, nights, guestsCount, adults, children, infants, body.purpose || null,
          quoteAmount, isRepeat ? 1 : 0, previousStays, discountPct,
          discountCategory, categoryDiscountPct, discountAmount, extraCharges, extraLines, finalOffer,
          body.status || 'new', body.assignedTo || 'owner', body.notes || null, actor, actor
        ).run()

        // First entry in the communication timeline
        await DB.prepare(`
          INSERT INTO stayvibe_communication_log (comm_id, enquiry_id, type, notes, created_by)
          VALUES (?, ?, 'internal_note', 'Enquiry received', ?)
        `).bind(genId('COMM'), enquiryId, actor).run()

        return json({ success: true, data: { enquiryId, guestId, isRepeatGuest: isRepeat, previousStays, guest } })
      }

      // Append a communication log entry, optionally bumping the enquiry's
      // status/last_contact_date/follow_up_due in the same call.
      if (action === 'logCommunication') {
        const enquiryId = body.enquiryId
        if (!enquiryId) return err('enquiryId required')
        await DB.prepare(`
          INSERT INTO stayvibe_communication_log (comm_id, enquiry_id, type, notes, created_by)
          VALUES (?, ?, ?, ?, ?)
        `).bind(genId('COMM'), enquiryId, body.type || 'internal_note', body.notes || '', actor).run()

        const updates = []
        const vals = []
        if (body.status)      { updates.push('status = ?');            vals.push(body.status) }
        if (body.followUpDue) { updates.push('follow_up_due = ?');      vals.push(body.followUpDue) }
        updates.push('last_contact_date = ?'); vals.push(now())
        // Any fresh contact resets the staleness clock — clear prior reminder
        // flags so the 2-day/5-day emails can fire again on the next gap.
        updates.push('reminder_2day_sent_at = NULL, reminder_5day_sent_at = NULL')
        updates.push('updated_by = ?, updated_at = ?'); vals.push(actor, now())

        await DB.prepare(`UPDATE stayvibe_enquiries SET ${updates.join(', ')} WHERE enquiry_id = ?`)
          .bind(...vals, enquiryId).run()

        return json({ success: true })
      }

      // Mark a 2-day or 5-day reminder as sent, so getStaleEnquiries won't
      // return this enquiry again for the same threshold tomorrow.
      // FIX (2026-06-24): this was originally placed in the GET block by
      // mistake, where `body` doesn't exist — every call silently fell
      // through to "Unknown POST action" even though the action existed
      // in the file. Confirmed live via Apps Script execution log before
      // moving it here.
      if (action === 'markReminderSent') {
        const { enquiryId, threshold } = body
        if (!enquiryId || !['2day','5day'].includes(threshold)) return err('enquiryId and threshold (2day|5day) required')
        const col = threshold === '2day' ? 'reminder_2day_sent_at' : 'reminder_5day_sent_at'
        await DB.prepare(`UPDATE stayvibe_enquiries SET ${col} = ? WHERE enquiry_id = ?`).bind(now(), enquiryId).run()
        return json({ success: true })
      }

      // Generic structured logging endpoint for the Apps Script side — lets
      // any scheduled function (not just enquiry reminders) write into the
      // same processing_log table already used for check-in error logging,
      // so execution history is visible from D1 Admin / the D1 console
      // instead of only Apps Script's own Executions panel (which the
      // owner doesn't check day to day, and which ages out after ~30 days).
      // Same misplacement bug as markReminderSent above — moved here for
      // the same reason.
      if (action === 'logScriptEvent') {
        const { source, eventType, note, refId } = body
        if (!source || !note) return err('source and note required')
        await DB.prepare(`
          INSERT INTO infra_processing_log (log_id, event_type, stay_id, note, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(
          'LOG-' + Date.now() + '-' + Math.floor(Math.random()*1000),
          eventType || 'info',
          refId || ('script:' + source),
          `[${source}] ${note}`,
        ).run()
        return json({ success: true })
      }

      // Mark an enquiry Lost with a reason
      if (action === 'markEnquiryLost') {
        const enquiryId = body.enquiryId
        if (!enquiryId) return err('enquiryId required')
        await DB.prepare(`
          UPDATE stayvibe_enquiries SET status = 'lost', lost_reason = ?, updated_by = ?, updated_at = ? WHERE enquiry_id = ?
        `).bind(body.lostReason || 'other', actor, now(), enquiryId).run()
        await DB.prepare(`
          INSERT INTO stayvibe_communication_log (comm_id, enquiry_id, type, notes, created_by)
          VALUES (?, ?, 'status_change', ?, ?)
        `).bind(genId('COMM'), enquiryId, `Marked Lost — ${body.lostReason || 'other'}`, actor).run()
        return json({ success: true })
      }

      // Confirm an enquiry: creates a stays row (so dashboard/calendar pick it
      // up immediately), links it via `bookings`, updates the guest's running
      // totals, and flips the enquiry to status=confirmed.
      if (action === 'confirmEnquiry') {
        const enquiryId = body.enquiryId
        if (!enquiryId) return err('enquiryId required')
        const enquiry = await DB.prepare(`SELECT * FROM stayvibe_enquiries WHERE enquiry_id = ?`).bind(enquiryId).first()
        if (!enquiry) return err('Enquiry not found', 404)
        if (!enquiry.checkin_date || !enquiry.checkout_date) return err('Enquiry is missing check-in/check-out dates')

        const villaId = enquiry.villa_id || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const bookingValue = parseFloat(body.bookingValue) || enquiry.final_offer_amount || enquiry.quote_amount || 0

        // ── Idempotency / partial-write recovery ──────────────────────
        // The writes below are now atomic (DB.batch), but earlier confirms
        // were not — one could create the stay + booking yet fail before
        // marking the enquiry confirmed, leaving it on "Quoted" while a
        // confirmed stay exists. Every retry then self-conflicts on the
        // overlap check and 409s forever. If a booking already exists for
        // this enquiry, heal the enquiry state and return it instead.
        const priorBooking = await DB.prepare(
          `SELECT booking_id, stay_id FROM stayvibe_bookings WHERE enquiry_id = ? ORDER BY created_at DESC LIMIT 1`
        ).bind(enquiryId).first()
        if (priorBooking) {
          await DB.prepare(
            `UPDATE stayvibe_enquiries SET status='confirmed', booking_confirmed=1, booking_value=?, updated_by=?, updated_at=? WHERE enquiry_id=? AND booking_confirmed=0`
          ).bind(bookingValue, actor, now(), enquiryId).run()
          return json({ success: true, data: { stayId: priorBooking.stay_id, bookingId: priorBooking.booking_id, alreadyConfirmed: true } })
        }

        // Overlap protection — identity-aware (Phase 2b). A same-guest overlap
        // is this guest's OWN existing stay (an extension / already-booked),
        // not a double booking — surface it with the stay id so the UI can
        // attach or adjust dates instead of dead-409'ing forever. A different
        // guest overlapping is a real double booking → block.
        const cls = await classifyStayConflicts(DB, {
          villaId, checkinDate: enquiry.checkin_date, checkoutDate: enquiry.checkout_date,
          guestId: enquiry.guest_id, phone: enquiry.phone, email: enquiry.email, guestName: enquiry.guest_name,
        })
        if (cls.otherOverlap) {
          const c = cls.otherOverlap
          return json({ success: false, code: 'double_booking', conflict: c,
            error: `Villa already booked ${c.checkin_date} → ${c.checkout_date} (${c.guest_name})` }, 409)
        }
        if (cls.ownOverlap) {
          const o = cls.ownOverlap
          return json({ success: false, code: 'same_guest_existing_stay', existingStayId: o.stay_id,
            error: `${enquiry.guest_name} already has an overlapping stay (${o.stay_id}: ${o.checkin_date} → ${o.checkout_date}). Modify that booking or adjust these dates instead of creating a second one.` }, 409)
        }

        // ── Create stay + booking + side effects atomically ───────────
        // DB.batch runs as one transaction, so we can never again land in the
        // half-written state that caused the self-conflict above.
        const stayId = genStayId(villaId)
        const bookingId = genId('BKG')
        const stmts = [
          DB.prepare(`
            INSERT INTO stayvibe_stays (
              stay_id, villa_id, source, guest_name, guest_phone, guest_email,
              checkin_date, checkout_date, nights, adults, children,
              gross, net, status, created_by, updated_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?)
          `).bind(
            stayId, villaId, enquiry.source || 'direct', enquiry.guest_name, enquiry.phone, enquiry.email,
            enquiry.checkin_date, enquiry.checkout_date, enquiry.nights || 1, enquiry.guests_count || 1, 0,
            bookingValue, bookingValue, actor, actor
          ),
          DB.prepare(`
            INSERT INTO stayvibe_bookings (booking_id, enquiry_id, guest_id, stay_id, booking_value, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(bookingId, enquiryId, enquiry.guest_id, stayId, bookingValue, actor),
          DB.prepare(`
            UPDATE stayvibe_enquiries SET status = 'confirmed', booking_confirmed = 1, booking_value = ?, updated_by = ?, updated_at = ? WHERE enquiry_id = ?
          `).bind(bookingValue, actor, now(), enquiryId),
        ]
        if (enquiry.guest_id) {
          stmts.push(DB.prepare(`
            UPDATE stayvibe_guests SET
              total_stays = total_stays + 1,
              total_nights = total_nights + ?,
              total_revenue = total_revenue + ?,
              last_seen_at = ?, updated_by = ?, updated_at = ?
            WHERE guest_id = ?
          `).bind(enquiry.nights || 1, bookingValue, now(), actor, now(), enquiry.guest_id))
        }
        stmts.push(DB.prepare(`
          INSERT INTO stayvibe_communication_log (comm_id, enquiry_id, type, notes, created_by)
          VALUES (?, ?, 'status_change', ?, ?)
        `).bind(genId('COMM'), enquiryId, `Booking confirmed — stay ${stayId}`, actor))

        await DB.batch(stmts)
        await syncStayLedger(DB, stayId)
        return json({ success: true, data: { stayId, bookingId } })
      }

      // ── RESOLVE / VOID A STAY (soft — default) ───────────────────────
      // Marks a stay void/cancelled, keeps the row (excluded from active
      // views), logs a tombstone, and reverses an UNPAID commission. A PAID
      // commission is left untouched — money is never silently erased.
      if (action === 'resolveStay') {
        const stayId = body.stayId
        if (!stayId) return err('stayId required')
        const reason = (body.reason || '').trim() || 'resolved'
        const newStatus = body.status === 'cancelled' ? 'cancelled' : 'void'
        const stay = await DB.prepare(`SELECT * FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
        if (!stay) return err('Stay not found', 404)
        const paidComm = await DB.prepare(`SELECT comm_id FROM stayvibe_manager_commissions WHERE stay_id = ? AND is_paid = 1 LIMIT 1`).bind(stayId).first()
        const stmts = [
          DB.prepare(`UPDATE stayvibe_stays SET status = ?, notes = TRIM(COALESCE(notes,'') || ' | ' || ? || ': ' || ?), updated_by = ?, updated_at = datetime('now') WHERE stay_id = ?`)
            .bind(newStatus, newStatus, reason, actor, stayId),
          DB.prepare(`INSERT INTO infra_deletion_log (del_id, stay_id, villa_id, action, guest_name, checkin_date, checkout_date, reason, snapshot, actor) VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .bind(genId('DEL'), stayId, stay.villa_id, newStatus, stay.guest_name, stay.checkin_date, stay.checkout_date, reason,
                  JSON.stringify({ status: stay.status, source: stay.source, nights: stay.nights, net: stay.net, guest_phone: stay.guest_phone, guest_id: stay.guest_id }), actor),
        ]
        if (!paidComm) stmts.push(DB.prepare(`DELETE FROM stayvibe_manager_commissions WHERE stay_id = ? AND is_paid = 0`).bind(stayId))
        await DB.batch(stmts)
        return json({ success: true, data: { stayId, status: newStatus, paidCommissionKept: !!paidComm } })
      }

      // ── HARD DELETE A STAY (admin, guarded) ──────────────────────────
      // Cascades the operational child rows and removes the stay, but refuses
      // if a PAID commission exists (forcing a soft void instead), writes a
      // full-snapshot tombstone, and PRESERVES the duplicate_bookings incident
      // (marks it resolved) rather than erasing history. Requires confirm:true.
      if (action === 'deleteStay') {
        const stayId = body.stayId
        if (!stayId) return err('stayId required')
        if (body.confirm !== true && body.confirm !== 'true') return err('confirm:true required for hard delete')
        const stay = await DB.prepare(`SELECT * FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
        if (!stay) return err('Stay not found', 404)
        const paidComm = await DB.prepare(`SELECT comm_id FROM stayvibe_manager_commissions WHERE stay_id = ? AND is_paid = 1 LIMIT 1`).bind(stayId).first()
        if (paidComm) return json({ success: false, code: 'paid_commission', error: 'This stay has a PAID commission — hard delete is blocked. Void it instead to preserve the financial record.' }, 409)
        const reason = (body.reason || '').trim() || 'hard delete'
        await DB.batch([
          DB.prepare(`INSERT INTO infra_deletion_log (del_id, stay_id, villa_id, action, guest_name, checkin_date, checkout_date, reason, snapshot, actor) VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .bind(genId('DEL'), stayId, stay.villa_id, 'delete', stay.guest_name, stay.checkin_date, stay.checkout_date, reason, JSON.stringify(stay), actor),
          DB.prepare(`DELETE FROM stayvibe_guest_requests   WHERE stay_id = ?`).bind(stayId),
          DB.prepare(`DELETE FROM stayvibe_cars        WHERE stay_id = ?`).bind(stayId),
          DB.prepare(`DELETE FROM stayvibe_incidentals WHERE stay_id = ?`).bind(stayId),
          DB.prepare(`DELETE FROM stayvibe_guest_documents  WHERE stay_id = ?`).bind(stayId),
          DB.prepare(`DELETE FROM stayvibe_bookings         WHERE stay_id = ?`).bind(stayId),
          DB.prepare(`DELETE FROM infra_processing_log   WHERE stay_id = ?`).bind(stayId),
          DB.prepare(`DELETE FROM stayvibe_manager_commissions WHERE stay_id = ? AND is_paid = 0`).bind(stayId),
          DB.prepare(`UPDATE stayvibe_duplicate_bookings SET resolved = 1, resolved_by = ?, resolved_at = datetime('now'), resolution = 'stay deleted' WHERE existing_stay_id = ? AND (resolved IS NULL OR resolved = 0)`).bind(actor, stayId),
          DB.prepare(`DELETE FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId),
        ])
        return json({ success: true, data: { stayId, deleted: true } })
      }

      // ── RESOLVE A DUPLICATE-BOOKING INCIDENT (keep for reference) ─────
      if (action === 'resolveDuplicate') {
        const dupId = body.dupId
        if (!dupId) return err('dupId required')
        await DB.prepare(`UPDATE stayvibe_duplicate_bookings SET resolved = 1, resolved_by = ?, resolved_at = datetime('now'), resolution = ? WHERE dup_id = ?`)
          .bind(actor, (body.resolution || 'reviewed').trim(), dupId).run()
        return json({ success: true, data: { dupId, resolved: true } })
      }

      // ── CANCEL A BOOKING BY AIRBNB CONFIRMATION CODE ─────────────────
      // Called by the Gmail poller when an Airbnb "Canceled: Reservation
      // <code>" email arrives. Finds the stay by airbnb_conf, sets it
      // cancelled, and logs it. Idempotent: re-processing the same cancel
      // email is a no-op, and a code we never imported returns matched:false
      // (not an error) so the poller can safely mark the email read.
      // Money fields are left intact — cancelled stays are already excluded
      // from every revenue query by the status filter, and keeping the amounts
      // preserves cancellation/lost-revenue reporting.
      if (action === 'cancelByConfirmation') {
        const conf = (body.confirmationCode || '').trim()
        if (!conf) return err('confirmationCode required')
        const stay = await DB.prepare(
          `SELECT stay_id, guest_name, status, checkin_date, checkout_date, source FROM stayvibe_stays WHERE airbnb_conf = ? LIMIT 1`
        ).bind(conf).first()
        if (!stay) return json({ success: true, data: { matched: false, confirmationCode: conf } })
        if (stay.status === 'cancelled') {
          return json({ success: true, data: { matched: true, stayId: stay.stay_id, alreadyCancelled: true } })
        }
        await DB.batch([
          DB.prepare(`UPDATE stayvibe_stays SET status = 'cancelled', updated_by = 'auto', updated_at = datetime('now') WHERE stay_id = ?`).bind(stay.stay_id),
          DB.prepare(`INSERT INTO infra_processing_log (log_id, event_type, stay_id, note, created_at) VALUES (?, 'cancellation', ?, ?, datetime('now'))`)
            .bind(genId('LOG'), stay.stay_id, `Airbnb cancellation (${conf}) — ${stay.guest_name} ${stay.checkin_date} → ${stay.checkout_date}. Status set to cancelled.`),
        ])
        return json({ success: true, data: { matched: true, stayId: stay.stay_id, cancelled: true, guestName: stay.guest_name } })
      }

      if (action === 'runSQLWrite') {
        const sql = body?.sql ? body.sql.trim() : ''
        if (!sql) return err('sql required')
        if (['DROP TABLE','TRUNCATE','DROP DATABASE','ATTACH','DETACH'].some(b => sql.toUpperCase().includes(b))) {
          return err('Operation not permitted — DROP TABLE and TRUNCATE are blocked')
        }
        try {
          // SQL-aware split — correctly handles semicolons inside string
          // literals, quoted identifiers, and comments (see splitSqlStatements above)
          const statements = splitSqlStatements(sql)
          if (statements.length === 0) return err('No valid SQL statement found')
          if (statements.length === 1) {
            const result = await DB.prepare(statements[0]).run()
            return json({ success: true, data: { changes: result.meta?.changes ?? 0, duration: result.meta?.duration ?? 0, statements: 1 } })
          }
          // Multiple statements — run as batch
          const batch = statements.map(s => DB.prepare(s))
          const results = await DB.batch(batch)
          const totalChanges = results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0)
          return json({ success: true, data: {
            changes: totalChanges,
            statements: statements.length,
            perStatement: results.map((r, i) => ({ sql: statements[i].substring(0, 60), changes: r.meta?.changes ?? 0 }))
          }})
        } catch (e) {
          return json({ success: false, error: e.message || String(e), errorName: e.name, errorCause: e.cause?.message || null }, 400)
        }
      }

      if (action === 'markRamanPaid') {
        // Three call shapes from RDashboard.jsx:
        //  1. { commIds: [...], paidDate } — pay specific selected stays
        //  2. { quarter: 'Q1 2026', paidDate } — pay one whole quarter
        //  3. { paidDate } — pay all unpaid
        const paidDate = body.paidDate || now().slice(0, 10)

        if (Array.isArray(body.commIds) && body.commIds.length > 0) {
          // Shape 1: pay selected comm_ids
          const placeholders = body.commIds.map(() => '?').join(',')
          const result = await DB.prepare(
            `UPDATE stayvibe_manager_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ?
             WHERE comm_id IN (${placeholders}) AND is_paid = 0`
          ).bind(paidDate, actor, now(), ...body.commIds).run()
          return json({ success: true, data: { changes: result.meta?.changes ?? 0 } })
        }

        if (body.quarter) {
          // Shape 2: pay a whole quarter — parse "Q1 2026" into a date range
          const m = String(body.quarter).match(/^Q([1-4])\s+(\d{4})$/)
          if (!m) return err('Invalid quarter format — expected "Q1 2026"')
          const q = parseInt(m[1]), year = parseInt(m[2])
          const startMonth = (q - 1) * 3 + 1
          const endMonth   = startMonth + 2
          const startDate  = `${year}-${String(startMonth).padStart(2, '0')}-01`
          // Last day of endMonth — use day 0 of the following month
          const endDateObj = new Date(year, endMonth, 0)
          const endDate     = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`

          const result = await DB.prepare(
            `UPDATE stayvibe_manager_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ?
             WHERE checkin_date BETWEEN ? AND ? AND is_paid = 0`
          ).bind(paidDate, actor, now(), startDate, endDate).run()
          return json({ success: true, data: { changes: result.meta?.changes ?? 0 } })
        }

        // Shape 3: pay all unpaid
        const result = await DB.prepare(
          `UPDATE stayvibe_manager_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ? WHERE is_paid = 0`
        ).bind(paidDate, actor, now()).run()
        return json({ success: true, data: { changes: result.meta?.changes ?? 0 } })
      }

      if (action === 'createBooking') {
        const stayId = genStayId(body.villaId)
        const nights = parseInt(body.nights) || 1

        // Identity + overlap classification (Phase 2b) — replaces the fragile
        // exact-checkin_date "provisional" match. A same-guest overlap is this
        // guest's existing hold/enquiry stay → enrich it with the Airbnb data
        // (no duplicate even if the dates shifted). A different-guest overlap
        // is a real double booking → alert + log + block.
        const cls = await classifyStayConflicts(DB, {
          villaId: body.villaId || DEFAULT_VILLA_ID,
          checkinDate: body.checkInDate, checkoutDate: body.checkOutDate,
          phone: body.guestPhone, email: body.guestEmail,
          guestName: body.guestName || body.bookerName,
        })

        if (cls.ownOverlap) {
          const provisional = cls.ownOverlap
          await DB.prepare(`UPDATE stayvibe_stays SET source = 'airbnb', airbnb_conf = ?, gross = ?, commission_pct = ?, commission_amt = ?, net = ?, night_fee = ?, cleaning_fee = ?, host_service_fee = ?, you_earn = ?, guest_service_fee = ?, guest_paid_total = ?, checkout_date = COALESCE(NULLIF(checkout_date,''), ?), nights = COALESCE(NULLIF(nights,0), ?), adults = COALESCE(NULLIF(adults,0), ?), updated_by = ?, updated_at = datetime('now') WHERE stay_id = ?`).bind(body.airbnbConf || null, body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0, body.nightFee || 0, body.cleaningFee || 0, body.hostServiceFee || 0, body.youEarn || body.net || 0, body.guestServiceFee || 0, body.guestPaid || 0, body.checkOutDate || null, parseInt(body.nights) || 1, body.adults || 1, actor, provisional.stay_id).run()
          await syncStayLedger(DB, provisional.stay_id)
          return json({ success: true, data: { stayId: provisional.stay_id, merged: true, wasStatus: provisional.status } })
        }

        if (cls.otherOverlap) {
          const conflict = cls.otherOverlap
          const alertSubject = '🚨 URGENT — Double booking detected! ' + (body.checkInDate || '')
          const alertVillaId = body.villaId || DEFAULT_VILLA_ID
          const alertLines = [
            'Source: New Booking screen (createBooking)',
            'Action: New booking BLOCKED — overlapping dates detected',
            '',
            'IMMEDIATE ACTION REQUIRED — the villa is already booked for these dates.',
            '',
            `EXISTING: ${conflict.stay_id} | ${conflict.guest_name} | ${conflict.checkin_date} -> ${conflict.checkout_date}`,
            `NEW ATTEMPT: ${body.guestName} | ${body.checkInDate} -> ${body.checkOutDate}`,
            '',
            `Attempted by: ${actor}`,
            `Time:         ${now()}`,
          ]
          await sendAlert(env, alertSubject, alertLines, await getOwnerAlertEmail(DB, env, alertVillaId), DB, alertVillaId)

          try {
            const overlapNights = body.checkInDate && body.checkOutDate ? Math.max(0, Math.round((Math.min(new Date(conflict.checkout_date), new Date(body.checkOutDate)) - Math.max(new Date(conflict.checkin_date), new Date(body.checkInDate))) / 86400000)) : 0
            await DB.prepare(`INSERT INTO stayvibe_duplicate_bookings (dup_id, villa_id, detected_at, existing_stay_id, existing_guest, existing_checkin, existing_checkout, existing_source, existing_booked_at, new_guest, new_checkin, new_checkout, new_source, new_airbnb_conf, overlap_nights) VALUES (?,?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`DUP-${Date.now()}`, body.villaId || DEFAULT_VILLA_ID, conflict.stay_id, conflict.guest_name, conflict.checkin_date, conflict.checkout_date, conflict.source || 'unknown', conflict.created_at || null, body.guestName || 'unknown', body.checkInDate, body.checkOutDate, body.source || 'unknown', body.airbnbConf || null, overlapNights).run()
          } catch(logErr) {}

          return json({ success: false, error: `Double booking detected: ${conflict.guest_name} is already booked`, conflict }, 409)
        }

        await DB.prepare(`INSERT INTO stayvibe_stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, adults, children, tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status, home_address, city, state, country, from_city, night_fee, cleaning_fee, host_service_fee, you_earn, guest_service_fee, guest_paid_total, airbnb_conf, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(stayId, body.villaId || DEFAULT_VILLA_ID, body.source || 'direct', body.guestName || body.bookerName, body.guestPhone || null, body.guestEmail || null, body.checkInDate, body.checkOutDate, nights, body.adults || 1, body.children || 0, (body.tariffPerNight || (body.nightFee && body.nights ? Math.round((body.nightFee / body.nights) * 100) / 100 : 0)), body.extraCharges || 0, body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0, 'confirmed', body.homeAddress || null, body.city || null, body.state || null, body.country || 'India', body.fromCity || body.city || null, body.nightFee || 0, body.cleaningFee || 0, body.hostServiceFee || 0, body.youEarn || body.net || 0, body.guestServiceFee || 0, body.guestPaid || 0, body.airbnbConf || null, actor, actor).run()
        await syncStayLedger(DB, stayId)
        return json({ success: true, data: { stayId } })
      }

      // ── LICENSE-PLATE OCR (Raman check-in pre-fill) ──────────────────
      // Reads the number-plate photo with a Cloudflare-hosted vision model
      // (Workers AI) and returns a best-guess plate string to PRE-FILL the
      // "Car number" field on Raman's screen. Strictly advisory: Raman always
      // verifies/corrects, and this never blocks or is required for check-in.
      // Every failure path returns { plate: '' } with success:true so the UI
      // just falls back to manual entry — it must never throw the screen.
      // v2: same fix as ocrReceipt — Llama 3.2 Vision alone was unreliable
      // (that's why receipts moved to Scout first); Llama 4 Scout is now
      // primary, Llama 3.2 stays as the fallback so it can't get worse.
      if (action === 'ocrPlate') {
        const b64 = body.platePhotoB64
        if (!b64) return json({ success: true, data: { plate: '', raw: '', reason: 'no_image' } })
        if (!env.AI) {
          console.error('ocrPlate: env.AI binding missing on this deployment')
          return json({ success: true, data: { plate: '', raw: '', reason: 'ai_unbound' } })
        }

        const OCR_INSTRUCTION = 'This is a photo of an Indian vehicle number plate. Read the registration number exactly. Respond with ONLY the plate characters in capital letters, no spaces and no other words. If no plate is legible, respond with exactly NONE.'

        // base64 → raw image bytes (the Llama 3.2 fallback expects a byte array)
        let bytes
        try {
          const bin = atob(b64)
          const arr = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
          bytes = [...arr]
        } catch (e) {
          console.error('ocrPlate: bad base64:', e?.message || e)
          return json({ success: true, data: { plate: '', raw: '', reason: 'bad_b64' } })
        }

        const cleanPlate = (rawStr) => String(rawStr || '').replace(/["'`.\r\n]/g, ' ').trim()
        const isPlate = (cleaned) => !!cleaned && !/^none$/i.test(cleaned)

        // Primary: Llama 4 Scout (natively multimodal, image as data-URL)
        let raw = '', modelUsed = 'llama-4-scout'
        try {
          const out = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
            messages: [
              { role: 'system', content: 'You are a precise vehicle number-plate reader.' },
              { role: 'user', content: [
                { type: 'text', text: OCR_INSTRUCTION },
                { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } },
              ] },
            ],
            max_tokens: 24,
            temperature: 0,
          })
          raw = (out && out.response ? String(out.response) : '').trim()
        } catch (e) {
          console.error('ocrPlate: Scout attempt failed:', e?.message || e)
        }
        let cleaned = cleanPlate(raw)

        // Fallback: Llama 3.2 11B Vision (known { prompt, image: bytes } format)
        if (!isPlate(cleaned)) {
          modelUsed = 'llama-3.2-vision'
          const runLegacy = async () => {
            const out = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { prompt: OCR_INSTRUCTION, image: bytes, max_tokens: 24, temperature: 0 })
            return (out && out.response ? String(out.response) : '').trim()
          }
          try {
            raw = await runLegacy()
          } catch (e1) {
            // Meta's first-use license gate requires a one-time { prompt: 'agree' }
            // per account. Self-heal it here so the owner never runs a manual
            // activation step, then retry once.
            console.error('ocrPlate: legacy attempt failed, trying license agree:', e1?.message || e1)
            try {
              await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { prompt: 'agree' })
              raw = await runLegacy()
            } catch (e2) {
              console.error('ocrPlate: legacy retry failed:', e2?.message || e2)
              raw = ''
            }
          }
          cleaned = cleanPlate(raw)
        }

        if (!isPlate(cleaned)) return json({ success: true, data: { plate: '', raw: cleaned, reason: 'ocr_error', model: modelUsed } })
        const plate = normalizePlate(cleaned)
        return json({ success: true, data: { plate, raw: cleaned, model: modelUsed } })
      }

      // ── RECEIPT OCR (Villa Expenses pre-fill, Raman-side) ────────────
      // v2: Llama 4 Scout (natively multimodal) with guided_json for reliable
      // structured output + a few-shot prompt. Falls back to Llama 3.2 Vision
      // (known image format) if Scout errors or returns nothing, so it can
      // never be worse than before. Read-only: the image is NOT stored. Never
      // blocks — any failure returns empty fields so Raman just types it in.
      if (action === 'ocrReceipt') {
        const b64 = body.receiptPhotoB64
        const empty = (reason) => json({ success: true, data: { fields: {}, reason } })
        if (!b64) return empty('no_image')
        if (b64.length > 8000000) return empty('too_large')
        if (!env.AI) { console.error('ocrReceipt: env.AI binding missing'); return empty('ai_unbound') }

        // Categories: per-villa list from villa_settings ('expense_categories',
        // JSON array) so the OCR matches against the same options the dropdown
        // shows; hardcoded list is only the fallback default.
        const DEFAULT_CATS = ['Electricity','Maintenance','Repairs','Laundry','Deep Cleaning','Housekeeping Supplies','Pest Control (Mosquito & Bats)','Kitchen Crockery','Kitchen Supplies','Appliance / AC Service','Landscaping','Painting','Water Filtration System','Water System — Motor & Associated','Bulk Purchases (Soap, Shampoo, Body Wash etc.)','Other']
        let CATS = DEFAULT_CATS
        try {
          const catRow = await DB.prepare(`SELECT value FROM stayvibe_villa_settings WHERE villa_id = ? AND key = 'expense_categories'`).bind(body.villaId || DEFAULT_VILLA_ID).first()
          const parsedCats = catRow && catRow.value ? JSON.parse(catRow.value) : null
          if (Array.isArray(parsedCats) && parsedCats.length) CATS = parsedCats
        } catch (e) { /* fall back to defaults */ }
        const SYSTEM = 'You are a precise receipt and bill data extractor. Read the image carefully and read the printed numbers exactly. Return only the requested fields.'
        const INSTRUCTION =
          'Extract from this receipt/bill image: the vendor or shop name; the GRAND TOTAL actually paid as a number only with no currency symbol (the final total, not a single line item); the date as YYYY-MM-DD; the closest category from this list — ' +
          CATS.join(' | ') +
          '; and a short description of what was bought. If a field is unreadable use an empty string, or 0 for amount. If unsure of the category use "Other".\n' +
          'Example output: {"vendor":"Reliance Fresh","amount":1240.5,"date":"2026-06-14","category":"Bulk Purchases (Soap, Shampoo, Body Wash etc.)","description":"groceries and cleaning supplies"}'
        const RECEIPT_SCHEMA = {
          type: 'object',
          properties: {
            vendor:      { type: 'string' },
            amount:      { type: 'number' },
            date:        { type: 'string' },
            category:    { type: 'string' },
            description: { type: 'string' },
          },
          required: ['vendor', 'amount', 'category'],
        }

        let bytes = null
        try {
          const bin = atob(b64); const arr = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
          bytes = [...arr]
        } catch (e) { console.error('ocrReceipt: bad base64:', e?.message || e); return empty('bad_b64') }

        const parseFields = (rawStr) => {
          if (!rawStr) return null
          let obj = null
          try { obj = JSON.parse(rawStr) } catch (_) {
            const m = String(rawStr).match(/\{[\s\S]*\}/)
            if (m) { try { obj = JSON.parse(m[0]) } catch (_2) {} }
          }
          if (!obj) return null
          const amtNum = parseFloat(String(obj.amount == null ? '' : obj.amount).replace(/[^0-9.]/g, '')) || 0
          return {
            vendor:      String(obj.vendor || '').slice(0, 120),
            amount:      amtNum > 0 ? amtNum : '',
            date:        /^\d{4}-\d{2}-\d{2}$/.test(obj.date || '') ? obj.date : '',
            category:    CATS.includes(obj.category) ? obj.category : 'Other',
            description: String(obj.description || '').slice(0, 300),
          }
        }
        const hasContent = (f) => !!(f && (f.amount || f.vendor || f.date))

        // Primary: Llama 4 Scout with guided_json (image as data-URL in messages)
        let raw = '', modelUsed = 'llama-4-scout'
        try {
          const out = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: [
                { type: 'text', text: INSTRUCTION },
                { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } },
              ] },
            ],
            guided_json: RECEIPT_SCHEMA,
            max_tokens: 500,
            temperature: 0,
          })
          raw = (out && out.response != null)
            ? (typeof out.response === 'string' ? out.response : JSON.stringify(out.response))
            : ''
          raw = String(raw).trim()
        } catch (e) {
          console.error('ocrReceipt: Scout attempt failed:', e?.message || e)
        }
        let fields = parseFields(raw)

        // Fallback: Llama 3.2 11B Vision (known { prompt, image: bytes } format)
        if (!hasContent(fields)) {
          modelUsed = 'llama-3.2-vision'
          const runLegacy = async () => {
            const out = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
              prompt: INSTRUCTION + '\nRespond with the JSON object only.',
              image: bytes, max_tokens: 500, temperature: 0,
            })
            return (out && out.response ? String(out.response) : '').trim()
          }
          try {
            raw = await runLegacy()
          } catch (e1) {
            try { await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { prompt: 'agree' }); raw = await runLegacy() }
            catch (e2) { console.error('ocrReceipt: legacy retry failed:', e2?.message || e2) }
          }
          fields = parseFields(raw) || fields
        }

        const rawOut = String(raw || '').slice(0, 500)
        if (!hasContent(fields)) return json({ success: true, data: { fields: {}, reason: 'unreadable', raw: rawOut, model: modelUsed } })
        return json({ success: true, data: { fields, raw: rawOut, model: modelUsed } })
      }

      if (action === 'confirmCheckIn') {
        let stayId = body.stayId
        if (!stayId) {
          const found = await DB.prepare(`SELECT stay_id FROM stayvibe_stays WHERE guest_name = ? AND status IN ('confirmed','booked') ORDER BY checkin_date DESC LIMIT 1`).bind(body.guestName || body.bookerName).first()
          stayId = found?.stay_id
        }
        if (!stayId) {
          stayId = genStayId(body.villaId || DEFAULT_VILLA_ID)
          await DB.prepare(`INSERT INTO stayvibe_stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, adults, children, gross, net, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,'checked_in',?,?,?,?)`).bind(stayId, body.villaId || DEFAULT_VILLA_ID, 'direct', body.guestName || body.bookerName, body.phone || null, body.email || null, body.checkInDate, body.checkOutDate, Math.max(1, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000)), body.adultsCount || 1, body.childrenCount || 0, actor, actor, now(), now()).run()
        } else {
          await DB.prepare(`UPDATE stayvibe_stays SET status = 'checked_in', updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(actor, now(), stayId).run()
        }

        // Car / number-plate photos Raman took at check-in — same pipeline as
        // guest ID docs: land in D1 as base64, the Apps Script
        // (GuestFormScript.gs) picks them up on its next run, uploads them
        // into the guest's Drive folder, then deletes the D1 copy. A 14-day
        // sweep (cleanupExpiredDocuments) is the safety-net backstop, not
        // the normal path — under normal operation this clears out in
        // however long it is until the next scheduled Apps Script run, not
        // a full week.
        const docId = (type) => `DOC-${stayId}-${type}-${Date.now()}`
        if (body.carPhotoB64) {
          try {
            await DB.prepare(
              `INSERT OR REPLACE INTO stayvibe_guest_documents
               (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
               VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
            ).bind(docId('car'), stayId, 'car_photo', `Car-${stayId}.jpg`, body.carPhotoB64).run()
          } catch (e) { console.error('car photo store error:', e?.message || e) }
        }
        if (body.platePhotoB64) {
          try {
            await DB.prepare(
              `INSERT OR REPLACE INTO stayvibe_guest_documents
               (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
               VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
            ).bind(docId('plate'), stayId, 'plate_photo', `Plate-${stayId}.jpg`, body.platePhotoB64).run()
          } catch (e) { console.error('plate photo store error:', e?.message || e) }
        }
        if (body.carNumber) {
          try {
            await DB.prepare(`UPDATE stayvibe_stays SET vehicle_number = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`)
              .bind(body.carNumber, actor, now(), stayId).run()
          } catch (e) { console.error('vehicle_number update error:', e?.message || e) }
        }

        const alertVillaId = body.villaId || DEFAULT_VILLA_ID
        ctx.waitUntil(sendAlert(env, `🔑 bgIndia — Guest checked in: ${body.guestName || body.bookerName || 'Guest'}`, [
          `Source: Raman > Check-in screen`,
          `Action: Guest checked in`,
          '',
          `Guest:      ${body.guestName || body.bookerName || '—'}`,
          `Check-in:   ${body.checkInDate || '—'}`,
          `Check-out:  ${body.checkOutDate || '—'}`,
          `Stay ID:    ${stayId}`,
          `Villa:      ${alertVillaId}`,
          '',
          `Checked in by: ${actor}`,
          `Time:          ${now()}`,
        ], await getOwnerAlertEmail(DB, env, alertVillaId), DB, alertVillaId))

        return json({ success: true, data: { stayId } })
      }

      if (action === 'checkOut') {
        const { stayId } = body
        await DB.prepare(`UPDATE stayvibe_stays SET status = 'checked_out', updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(actor, now(), stayId).run()
        const stay = await DB.prepare(`SELECT guest_name, checkin_date, nights, villa_id FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
        const coVillaId = stay?.villa_id || DEFAULT_VILLA_ID
        if (stay) {
          const existing = await DB.prepare(`SELECT comm_id FROM stayvibe_manager_commissions WHERE stay_id = ?`).bind(stayId).first()
          if (!existing) {
            const nights = parseInt(stay.nights) || 1; const ramanComm = nights > 1 ? 2000 : 1000
            await DB.prepare(`INSERT INTO stayvibe_manager_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'system', 'system', ?, ?)`).bind(genId('RC'), stayId, stay.guest_name, stay.checkin_date, nights, ramanComm, now(), now()).run()

            ctx.waitUntil(sendAlert(env, `🚪 bgIndia — Guest checked out: ${stay.guest_name || 'Guest'}`, [
              `Source: Raman > Check-in screen (check-out)`,
              `Action: Guest checked out`,
              '',
              `Guest:            ${stay.guest_name || '—'}`,
              `Check-in date:    ${stay.checkin_date || '—'}`,
              `Nights:           ${nights}`,
              `Stay ID:          ${stayId}`,
              `Villa:            ${coVillaId}`,
              `Raman commission: ₹${ramanComm.toLocaleString('en-IN')}`,
              '',
              `Checked out by: ${actor}`,
              `Time:           ${now()}`,
            ], await getOwnerAlertEmail(DB, env, coVillaId), DB, coVillaId))

            return json({ success: true, data: { stayId, ramanComm, commissionCreated: true } })
          }
        }

        ctx.waitUntil(sendAlert(env, `🚪 bgIndia — Guest checked out: ${stay?.guest_name || 'Guest'}`, [
          `Source: Raman > Check-in screen (check-out)`,
          `Action: Guest checked out`,
          '',
          `Guest:         ${stay?.guest_name || '—'}`,
          `Stay ID:       ${stayId}`,
          `Villa:         ${coVillaId}`,
          '',
          `Checked out by: ${actor}`,
          `Time:           ${now()}`,
        ], await getOwnerAlertEmail(DB, env, coVillaId), DB, coVillaId))

        return json({ success: true, data: { stayId, commissionCreated: false } })
      }

      if (action === 'cancelStay') {
        await DB.prepare(`UPDATE stayvibe_stays SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(actor, now(), body.stayId).run()
        await DB.prepare(`DELETE FROM stayvibe_manager_commissions WHERE stay_id = ? AND is_paid = 0`).bind(body.stayId).run()
        return json({ success: true })
      }

      // INVENTORY — save cost/sell prices (Prices tab)
      if (action === 'saveInventoryPrices') {
        const villaId = body.villaId || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const prices  = body.prices || {}
        for (const [itemId, p] of Object.entries(prices)) {
          const costPrice = parseFloat(p.costPrice) || 0
          const sellPrice = parseFloat(p.sellPrice) || 0
          const result = await DB.prepare(`
            UPDATE stayvibe_inventory
            SET cost_price = ?, sell_price = ?, updated_by = ?, updated_at = ?
            WHERE item_id = ? AND villa_id = ?
          `).bind(costPrice, sellPrice, actor, now(), itemId, villaId).run()
          if (!result.meta?.changes) {
            await DB.prepare(`
              INSERT INTO stayvibe_inventory (item_id, villa_id, name, cost_price, sell_price, created_by, updated_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(itemId, villaId, p.name || itemId, costPrice, sellPrice, actor, actor, now(), now()).run()
          }
        }
        return json({ success: true })
      }

      // INVENTORY — record a restock (Restock tab): logs the purchase + bumps qty_in_stock
      if (action === 'saveInventoryRestock') {
        const villaId = body.villaId || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const entries = body.entries || []
        if (!entries.length) return err('entries required')
        const errors = []
        let savedCount = 0
        for (const e of entries) {
          const qty          = parseFloat(e.qty) || 0
          const ratePerUnit  = parseFloat(e.ratePerUnit) || 0
          const gstPct       = parseFloat(e.gstPct) || 0
          if (qty <= 0) continue
          // Rate/Qty is pre-tax, as entered; GST is added on top. Computed
          // server-side (not trusted from the client) so the log always
          // reflects qty x rate x (1+gst%) consistently.
          const totalCost    = Math.round(qty * ratePerUnit * (1 + gstPct / 100) * 100) / 100
          const pricePerUnit = qty > 0 ? Math.round((totalCost / qty) * 100) / 100 : 0
          try {
            await DB.prepare(`
              INSERT INTO stayvibe_inventory_restock_log
                (id, villa_id, item_id, item_name, qty_bought, total_cost, price_per_unit, rate_per_unit, gst_pct, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(genId('RSTK'), villaId, e.id, e.name || e.id, qty, totalCost, pricePerUnit, ratePerUnit, gstPct, actor, now()).run()

            const result = await DB.prepare(`
              UPDATE stayvibe_inventory
              SET qty_in_stock = COALESCE(qty_in_stock, 0) + ?,
                  last_restocked = ?,
                  updated_by = ?, updated_at = ?
              WHERE item_id = ? AND villa_id = ?
            `).bind(qty, now(), actor, now(), e.id, villaId).run()
            if (!result.meta?.changes) {
              await DB.prepare(`
                INSERT INTO stayvibe_inventory (item_id, villa_id, name, qty_in_stock, last_restocked, created_by, updated_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(e.id, villaId, e.name || e.id, qty, now(), actor, actor, now(), now()).run()
            }
            savedCount++
          } catch (err2) {
            // Same class of bug as saveInventoryPreferredStock: one bad
            // item_id used to silently fail the ENTIRE restock batch with
            // no detail. Now every other item still saves.
            console.error(`saveInventoryRestock failed for item ${e.id}:`, err2?.message || err2)
            errors.push({ itemId: e.id, error: err2?.message || String(err2) })
          }
        }
        return json({ success: true, data: { savedCount, total: entries.filter(e => (parseFloat(e.qty) || 0) > 0).length, errors } })
      }

      // INVENTORY — direct stock quantity correction (Stock tab +/- and manual edit)
      if (action === 'saveInventoryStock') {
        const villaId = body.villaId || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const stock   = body.stock || {}
        const errors = []
        let savedCount = 0
        for (const [itemId, s] of Object.entries(stock)) {
          const qty = parseFloat(s.qty) || 0
          try {
            const result = await DB.prepare(`
              UPDATE stayvibe_inventory
              SET qty_in_stock = ?, updated_by = ?, updated_at = ?
              WHERE item_id = ? AND villa_id = ?
            `).bind(qty, actor, now(), itemId, villaId).run()
            if (!result.meta?.changes) {
              await DB.prepare(`
                INSERT INTO stayvibe_inventory (item_id, villa_id, name, qty_in_stock, created_by, updated_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(itemId, villaId, s.name || itemId, qty, actor, actor, now(), now()).run()
            }
            savedCount++
          } catch (e) {
            console.error(`saveInventoryStock failed for item ${itemId}:`, e?.message || e)
            errors.push({ itemId, error: e?.message || String(e) })
          }
        }
        return json({ success: true, data: { savedCount, total: Object.keys(stock).length, errors } })
      }

      // INVENTORY — set preferred (target) stock levels per item; used to flag low stock
      // INVENTORY — add a brand-new catalog item (persisted, not the old
      // fake 'Add item' button that only showed a toast and forgot it).
      if (action === 'addInventoryItem') {
        const villaId = body.villaId || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const name = (body.name || '').trim()
        if (!name) return err('name required')
        const unit = (body.unit || '').trim() || 'unit'
        const category = body.category || 'other'
        const sellPrice = parseFloat(body.sellPrice) || 0
        const costPrice = parseFloat(body.costPrice) || 0
        const gstPct    = parseFloat(body.gstPct) || 0
        // Slugify the name into an item_id, de-duping against any existing
        // id (including archived ones — item_id is a bare PK, so reusing
        // an archived item's id would collide on INSERT).
        let baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
        let itemId = baseId
        let suffix = 2
        while (await DB.prepare(`SELECT 1 FROM stayvibe_inventory WHERE item_id = ?`).bind(itemId).first()) {
          itemId = `${baseId}_${suffix}`; suffix++
        }
        await DB.prepare(`
          INSERT INTO stayvibe_inventory (item_id, villa_id, name, unit, category, cost_price, sell_price, gst_pct, qty_in_stock, preferred_stock, active, created_by, updated_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 10, 1, ?, ?, ?, ?)
        `).bind(itemId, villaId, name, unit, category, costPrice, sellPrice, gstPct, actor, actor, now(), now()).run()
        return json({ success: true, data: { itemId } })
      }

      // INVENTORY — archive (soft-delete): hidden from all screens, restock
      // log and financial history for this item_id stay intact.
      if (action === 'archiveInventoryItem') {
        const { itemId, villaId } = body
        if (!itemId) return err('itemId required')
        await DB.prepare(`UPDATE stayvibe_inventory SET active = 0, updated_by = ?, updated_at = ? WHERE item_id = ? AND villa_id = ?`)
          .bind(actor, now(), itemId, villaId || DEFAULT_VILLA_ID).run()
        return json({ success: true, data: { itemId } })
      }

      if (action === 'restoreInventoryItem') {
        const { itemId, villaId } = body
        if (!itemId) return err('itemId required')
        await DB.prepare(`UPDATE stayvibe_inventory SET active = 1, updated_by = ?, updated_at = ? WHERE item_id = ? AND villa_id = ?`)
          .bind(actor, now(), itemId, villaId || DEFAULT_VILLA_ID).run()
        return json({ success: true, data: { itemId } })
      }

      if (action === 'saveInventoryPreferredStock') {
        const villaId = body.villaId || DEFAULT_VILLA_ID
        assertPropertyAccess(payload, villaId)
        const levels  = body.levels || {}
        const errors = []
        let savedCount = 0
        for (const [itemId, val] of Object.entries(levels)) {
          const preferred = Math.max(0, parseInt(val, 10) || 0)
          try {
            const result = await DB.prepare(`
              UPDATE stayvibe_inventory
              SET preferred_stock = ?, updated_by = ?, updated_at = ?
              WHERE item_id = ? AND villa_id = ?
            `).bind(preferred, actor, now(), itemId, villaId).run()
            if (!result.meta?.changes) {
              await DB.prepare(`
                INSERT INTO stayvibe_inventory (item_id, villa_id, name, preferred_stock, created_by, updated_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(itemId, villaId, itemId, preferred, actor, actor, now(), now()).run()
            }
            savedCount++
          } catch (e) {
            // One bad item (e.g. an item_id collision from an earlier test
            // insert under a different villa_id — item_id is a plain PK,
            // not composite with villa_id) was silently failing the ENTIRE
            // batch with a generic 'Failed to save', with zero indication
            // of which of ~15 items or why. Now every other item still
            // saves, and the real DB error comes back per-item.
            console.error(`saveInventoryPreferredStock failed for item ${itemId}:`, e?.message || e)
            errors.push({ itemId, error: e?.message || String(e) })
          }
        }
        return json({ success: true, data: { savedCount, total: Object.keys(levels).length, errors } })
      }

     if (action === 'saveKitchenEntry') {
        const items = body.items || [];
        const villaId = body.villaId || DEFAULT_VILLA_ID;
        assertPropertyAccess(payload, villaId)
        
        // SAFE CONTEXT INTIATION — Guarantee fallback tokens exist
        const currentActor = typeof actor !== 'undefined' ? actor : 'raman';
        const timestamp = typeof now === 'function' ? now() : new Date().toISOString();

        const lowStockAlerts = [];

        for (const item of items) {
          // Resolve the inventory link safely: ad-hoc/custom items and anything
          // not actually present in inventory are stored as NULL so the
          // inv_item_id foreign key can never reject the insert.
          let invItemId = item.itemId || item.inv_item_id || null
          if (invItemId === 'custom') invItemId = null
          if (invItemId) {
            const exists = await DB.prepare(
              `SELECT 1 FROM stayvibe_inventory WHERE item_id = ? AND villa_id = ?`
            ).bind(invItemId, villaId).first()
            if (!exists) invItemId = null
          }

          await DB.prepare(
            `INSERT INTO stayvibe_incidentals (
              item_id, stay_id, inv_item_id, name, qty, price_per_unit, total, created_by, updated_by, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(
            genId('INC'),
            body.stayId,
            invItemId,
            item.name,
            Number(item.qty) || 1,
            Number(item.pricePerUnit) || Number(item.price) || 0,
            Number(item.subtotal) || Number(item.total) || 0,
            currentActor,
            currentActor,
            timestamp,
            timestamp
          ).run();

          // Decrement live stock — only for real inventory items. Never let a
          // stock-update hiccup fail the incidental that already inserted.
          if (invItemId) {
            try {
              const qtySold = Number(item.qty) || 1
              await DB.prepare(`
                UPDATE stayvibe_inventory
                SET qty_in_stock = MAX(0, COALESCE(qty_in_stock, 0) - ?),
                    updated_by = ?, updated_at = ?
                WHERE item_id = ? AND villa_id = ?
              `).bind(qtySold, currentActor, timestamp, invItemId, villaId).run()

              const row = await DB.prepare(
                `SELECT name, qty_in_stock, preferred_stock FROM stayvibe_inventory WHERE item_id = ? AND villa_id = ?`
              ).bind(invItemId, villaId).first()
              if (row && row.preferred_stock > 0 && row.qty_in_stock <= row.preferred_stock * 0.1) {
                lowStockAlerts.push({ itemId: invItemId, name: row.name, qtyInStock: row.qty_in_stock, preferredStock: row.preferred_stock })
              }
            } catch (stockErr) {
              console.error('stock decrement failed (non-fatal):', stockErr?.message)
            }
          }
        }
        ctx.waitUntil(sendAlert(env, `🛒 bgIndia — Kitchen incidentals logged: ₹${Number(body.totalAmount || 0).toLocaleString('en-IN')}`, [
          `Source: Raman > Kitchen incidentals screen`,
          `Action: Kitchen incidentals logged`,
          '',
          `Guest:  ${body.guestName || '—'}`,
          `Total:  ₹${Number(body.totalAmount || 0).toLocaleString('en-IN')}`,
          `Items:  ${items.map(i => `${i.name} x${i.qty || 1}`).join(', ') || '—'}`,
          `Notes:  ${body.notes || '—'}`,
          `Villa:  ${villaId}`,
          '',
          `Logged by: ${currentActor}`,
          `Logged at: ${timestamp}`,
        ], await getOwnerAlertEmail(DB, env, villaId), DB, villaId))

        return json({ success: true, data: { lowStockAlerts } });
      }

      if (action === 'saveVillaRentalIncome') {
        if (body.stayId) {
          await DB.prepare(`UPDATE stayvibe_stays SET source = COALESCE(NULLIF(?, ''), source), tariff_per_night = ?, extra_charges = ?, extra_lines = ?, gross = ?, commission_pct = ?, commission_amt = ?, net = ?, notes = ?, night_fee = COALESCE(NULLIF(?,0), night_fee), cleaning_fee = COALESCE(NULLIF(?,0), cleaning_fee), host_service_fee = COALESCE(NULLIF(?,0), host_service_fee), you_earn = COALESCE(NULLIF(?,0), you_earn), guest_service_fee = COALESCE(NULLIF(?,0), guest_service_fee), guest_paid_total = COALESCE(NULLIF(?,0), guest_paid_total), updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(body.channel ? body.channel.toLowerCase().replace(/[^a-z]/g,'_') : null, body.tariffPerNight || 0, body.extraCharges || 0, body.extraLines || null, body.gross || 0, body.commPct || 0, body.commAmt || 0, body.net || 0, body.notes || null, body.airbnbFees ? JSON.parse(body.airbnbFees).nightFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).cleaningFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).hostServiceFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).youEarn || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).guestServiceFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).guestPaid || 0 : 0, actor, now(), body.stayId).run()
          await syncStayLedger(DB, body.stayId)
          return json({ success: true, data: { stayId: body.stayId, updated: true } })
        }
        const stayId = genStayId(body.villaId || DEFAULT_VILLA_ID)
        await DB.prepare(`INSERT INTO stayvibe_stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'closed',?,?,?,?)`).bind(stayId, body.villaId || DEFAULT_VILLA_ID, (body.channel||'Direct').toLowerCase().replace('.','_').replace(' ','_'), body.guestName, body.checkInDate, body.checkOutDate, body.nights || 1, body.gross || 0, body.commPct || 0, body.commAmt || 0, body.net || 0, actor, actor, now(), now()).run()
        // This manual-entry path creates a stay directly in 'closed' state, bypassing
        // the normal checked_out transition where Raman's commission is normally
        // auto-created. Without this, guests entered here would be invisible to
        // Raman's commission tracking entirely (silent data gap). Mirror the same
        // commission logic used in updateStayStatus's checked_out handler.
        {
          const nightsForComm = parseInt(body.nights) || 1
          const ramanComm = nightsForComm > 1 ? 2000 : 1000
          await DB.prepare(`INSERT INTO stayvibe_manager_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,0,'system','system',?,?)`).bind(genId('RC'), stayId, body.guestName, body.checkInDate, nightsForComm, ramanComm, now(), now()).run()
        }
        await syncStayLedger(DB, stayId)
        return json({ success: true, data: { stayId } })
      }

      if (action === 'saveRentalIncome') {
        const { year, monthFrom, monthTo, properties } = body
        const from = parseInt(monthFrom ?? body.month ?? 0); const to = parseInt(monthTo ?? body.month ?? from)
        for (let m = from; m <= to; m++) {
          for (let pi = 0; pi < properties.length; pi++) {
            const prop = properties[pi]; const propId = `rental_${pi + 1}`
            const income = (parseFloat(prop.rent) || 0) + (parseFloat(prop.carParking) || 0)
            const expense = (parseFloat(prop.maintenance)||0) + (parseFloat(prop.electricity)||0) + (parseFloat(prop.water)||0) + (parseFloat(prop.propertyTax)||0) + (parseFloat(prop.landTax)||0) + (parseFloat(prop.extraMaintenance)||0)
            const net = income - expense; const recId = `RI-${propId}-${year}-${String(m+1).padStart(2,'0')}`
            await DB.prepare(`INSERT OR REPLACE INTO rev360_rental_income (record_id, prop_id, month, year, rent, car_parking, maintenance, electricity, water, property_tax, land_tax, extra_maintenance, net, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(recId, propId, m + 1, year, parseFloat(prop.rent)||0, parseFloat(prop.carParking)||0, parseFloat(prop.maintenance)||0, parseFloat(prop.electricity)||0, parseFloat(prop.water)||0, parseFloat(prop.propertyTax)||0, parseFloat(prop.landTax)||0, parseFloat(prop.extraMaintenance)||0, net, actor, actor, now(), now()).run()
          }
        }
        return json({ success: true })
      }

      // COCONUT HARVEST — Record entries (Mapped cleanly to exact layout)
      if (action === 'saveCoconutHarvest') {
        const id = genId('CH')
        const harvestDate = body.harvestDate
        const scheduledNext = harvestDate ? new Date(new Date(harvestDate).getTime() + 45 * 86400000).toISOString().slice(0, 10) : null
        await ActiveDB.prepare(`
          INSERT INTO estate360_coconut_harvests
            (harvest_id, estate_id, harvester_name, harvest_date, final_payment_date,
             total_nuts, net_good_nuts, nuts_rejected, additional_unaccounted,
             total_weight_kg, price_per_kg, avg_weight_per_nut,
             earnings_main, nuts_rejected_b2, rejection_revenue,
             husk_count_sold, husk_cost_per_nut, husk_earnings, other_earnings, total_earnings,
             harvest_nuts, harvest_cost_nut, harvest_expense,
             dehusk_nuts, dehusk_cost_nut, dehusk_expense,
             tractor_expense, other_expense, total_expense, net_income,
             advance_payment, advance_date, second_payment, final_settlement, balance_due,
             next_harvest_date, scheduled_harvest_date, notes, created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          id, body.estate || 'pollachi', body.harvesterName, body.harvestDate, body.finalPaymentDate || null,
          parseInt(body.totalNuts)||0, parseInt(body.netGoodNuts)||0, parseInt(body.nutsRejected)||0, parseInt(body.additionalUnaccounted)||0,
          parseFloat(body.totalWeightKg)||0, parseFloat(body.pricePerKg)||0, parseFloat(body.avgWeight)||0,
          parseFloat(body.earningsMain)||0, parseInt(body.nutsRejectedB2)||0, parseFloat(body.coconutRejectedRevenue)||0,
          parseInt(body.huskCountSold)||0, parseFloat(body.huskCostPerNut)||0, parseFloat(body.huskEarnings)||0,
          parseFloat(body.otherEarnings)||0, parseFloat(body.totalEarnings)||0,
          parseInt(body.harvestNuts)||0, parseFloat(body.harvestCostPerNut)||0, parseFloat(body.harvestExpense)||0,
          parseInt(body.dehuskNuts)||0, parseFloat(body.dehuskCostPerNut)||0, parseFloat(body.dehuskExpense)||0,
          parseFloat(body.tractorExpense)||0, parseFloat(body.otherExpense)||0, parseFloat(body.totalExpense)||0, parseFloat(body.netIncome)||0,
          parseFloat(body.advancePayment)||0, body.advancePaymentDate||null,
          parseFloat(body.secondPayment)||0, parseFloat(body.finalSettlement)||0, parseFloat(body.balanceDue)||0,
          body.nextHarvestDate||null, scheduledNext, body.notes||null, actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { harvestId: id, scheduledNextHarvest: scheduledNext } })
      }

      // RUBBER HARVEST — Record entries (Mapped cleanly to exact layout)
      if (action === 'saveRubberHarvest') {
        const id = genId('RH')
        // RubberTracker.jsx sends: tappingDate, latexKg, pricePerKg, netKg, totalAmount,
        // totalExpenses, netIncome, estate — NOT harvestDate/weightKg/expense/estateId.
        const estateId    = body.estate || body.estateId || 'pavutumuri'
        const harvestDate = body.harvestDate || body.tappingDate
        const weightKg    = parseFloat(body.weightKg ?? body.netKg ?? body.latexKg) || 0
        const pricePerKg  = parseFloat(body.pricePerKg) || 0
        const expense     = parseFloat(body.expense ?? body.totalExpenses) || 0
        if (!harvestDate) return err('harvestDate (tappingDate) required', 400)

        const gross = (body.totalAmount != null ? parseFloat(body.totalAmount) : weightKg * pricePerKg) || 0
        const net   = body.netIncome != null ? parseFloat(body.netIncome) : (gross - expense)
        await ActiveDB.prepare(`
          INSERT INTO estate360_rubber_harvests
            (harvest_id, estate_id, harvest_date, weight_kg, price_per_kg, gross, expense, net, notes, created_by, created_at, updated_by, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(id, estateId, harvestDate, weightKg, pricePerKg, gross, expense, net, body.notes||null, actor, now(), actor, now()).run()

        const rubberEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estateId] || estateId
        ctx.waitUntil(sendAlert(env, `🌳 Estate360 — New rubber harvest: ₹${net.toLocaleString('en-IN')} net (${rubberEstateLabel})`, [
          'Source: Estate360 > Rubber Tracker',
          'Action: New rubber harvest logged',
          '',
          `Estate:       ${rubberEstateLabel}`,
          `Tapping date: ${harvestDate}`,
          `Tapper:       ${body.tapperName || '—'}`,
          `Latex (kg):   ${weightKg}`,
          `Price/kg:     ₹${pricePerKg.toLocaleString('en-IN')}`,
          `Gross:        ₹${gross.toLocaleString('en-IN')}`,
          `Expenses:     ₹${expense.toLocaleString('en-IN')}`,
          `Net income:   ₹${net.toLocaleString('en-IN')}`,
          `Notes:        ${body.notes || '—'}`,
          `Harvest ID:   ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estateId), DB, estateId))

        return json({ success: true, data: { harvestId: id } })
      }

      // ── DAILY RUBBER PRODUCTION — bulk upsert a week of counts ──
      if (action === 'saveRubberProduction') {
        const estateId = body.estate || body.estateId || 'pavutumuri'
        // Accept either the multi-worker flat shape:
        //   rows: [{ workerName, date, treeCount, sheetCount, ottupalCount, notes }]
        // or the legacy single-worker shape: { workerName, days:[{date,...}] }
        let entries = []
        if (Array.isArray(body.rows)) {
          entries = body.rows.map(r => ({
            workerName: (r.workerName || '').trim(),
            date: r.date,
            treeCount: parseInt(r.treeCount) || 0,
            sheetCount: parseInt(r.sheetCount) || 0,
            ottupalCount: parseInt(r.ottupalCount) || 0,
            block: (r.block || '').trim() || null,           // 'A' | 'B' | 'AB'
            rain: r.rain ? 1 : 0,                             // rain-affected day
            tappingRate: Math.round((parseFloat(r.tappingRate) || 0) * 100) / 100,
            notes: r.notes || body.notes || null,
            force: !!r.force,
          }))
        } else {
          const workerName = (body.workerName || '').trim()
          const days = Array.isArray(body.days) ? body.days : []
          entries = days.map(d => ({
            workerName, date: d.date,
            treeCount: parseInt(d.treeCount) || 0,
            sheetCount: parseInt(d.sheetCount) || 0,
            ottupalCount: parseInt(d.ottupalCount) || 0,
            notes: d.notes || body.notes || null,
            force: !!d.force,
          }))
        }
        if (!entries.length) return err('no rows provided', 400)

        let saved = 0, sumTree = 0, sumSheet = 0, sumOttupal = 0
        const workerSet = new Set()
        for (const e of entries) {
          if (!e.workerName || !e.date) continue
          // Rain days save with zero counts — they ARE the record (rain = no tapping)
          if (e.treeCount === 0 && e.sheetCount === 0 && e.ottupalCount === 0 && !e.rain && !e.force) continue
          const id = genId('RP')
          await ActiveDB.prepare(`
            INSERT INTO estate360_rubber_production
              (prod_id, estate_id, worker_name, prod_date, tree_count, sheet_count, ottupal_count, block, rain, tapping_rate, notes, created_by, created_at, updated_by, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(estate_id, worker_name, prod_date) DO UPDATE SET
              tree_count    = excluded.tree_count,
              sheet_count   = excluded.sheet_count,
              ottupal_count = excluded.ottupal_count,
              block         = excluded.block,
              rain          = excluded.rain,
              tapping_rate  = excluded.tapping_rate,
              notes         = excluded.notes,
              updated_by    = excluded.updated_by,
              updated_at    = excluded.updated_at
          `).bind(id, estateId, e.workerName, e.date, e.treeCount, e.sheetCount, e.ottupalCount, e.block, e.rain, e.tappingRate, e.notes, actor, now(), actor, now()).run()
          saved++; sumTree += e.treeCount; sumSheet += e.sheetCount; sumOttupal += e.ottupalCount
          workerSet.add(e.workerName)
        }

        const prodEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estateId] || estateId
        ctx.waitUntil(sendAlert(env, `🌳 Estate360 — Rubber production: ${sumSheet} sheets, ${sumTree} trees (${prodEstateLabel})`, [
          'Source: Estate360 > Rubber Tracker (daily production)',
          `Action: Saved ${saved} worker-day record(s)`,
          '',
          `Estate:        ${prodEstateLabel}`,
          `Workers:       ${[...workerSet].join(', ') || '—'}`,
          `Week starting: ${body.weekStart || entries[0]?.date || '—'}`,
          `Total trees:   ${sumTree}`,
          `Total sheets:  ${sumSheet}`,
          `Total ottupal: ${sumOttupal}`,
          `Records saved: ${saved}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estateId), DB, estateId))

        return json({ success: true, data: { saved, sumTree, sumSheet, sumOttupal } })
      }

      if (action === 'deleteRubberProduction') {
        const { prodId } = body
        if (!prodId) return err('prodId required', 400)
        await ActiveDB.prepare(`DELETE FROM estate360_rubber_production WHERE prod_id = ?`).bind(prodId).run()
        return json({ success: true })
      }

      // ── MANAGER SETTLEMENTS — Raman → Madhavan payments ──
      if (action === 'saveManagerSettlement') {
        const estateId    = body.estate || body.estateId || 'pavutumuri'
        const managerName = (body.managerName || 'Madhavan').trim()
        const payerName   = (body.payerName || 'Raman').trim()
        const paymentDate = body.paymentDate
        const amount      = parseFloat(body.amount) || 0
        if (!paymentDate || !amount) return err('paymentDate and amount required', 400)
        const id = genId('MS')
        await ActiveDB.prepare(`
          INSERT INTO estate360_manager_settlements
            (settlement_id, estate_id, manager_name, payer_name, payment_date, amount, method, note, created_by, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `).bind(id, estateId, managerName, payerName, paymentDate, amount, body.method || 'cash', body.note || null, actor, now()).run()

        const settleLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estateId] || estateId
        ctx.waitUntil(sendAlert(env, `💸 Estate360 — ${payerName} paid ${managerName} ₹${amount.toLocaleString('en-IN')} (${settleLabel})`, [
          'Source: Estate360 > Manager Settlement',
          `Action: ${payerName} → ${managerName} payment recorded`,
          '',
          `Estate:       ${settleLabel}`,
          `Payment date: ${paymentDate}`,
          `Amount:       ₹${amount.toLocaleString('en-IN')}`,
          `Method:       ${body.method || 'cash'}`,
          `Note:         ${body.note || '—'}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estateId), DB, estateId))

        return json({ success: true, data: { settlementId: id } })
      }

      if (action === 'deleteManagerSettlement') {
        const { settlementId } = body
        if (!settlementId) return err('settlementId required', 400)
        await ActiveDB.prepare(`DELETE FROM estate360_manager_settlements WHERE settlement_id = ?`).bind(settlementId).run()
        return json({ success: true })
      }

      // MANGO HARVEST — Mirroring exact production db layout indices 0 to 17
      if (action === 'saveMangoHarvest') {
        const { estate, harvestDate, boxType, buyer, pricePerBox, totalRevenue, totalBoxes, notes, alphonsa=0, neelam=0, malgova=0, banganapally=0, kilimooku=0, sindooram=0, mix=0 } = body
        if (!harvestDate || !estate) return json({ success:false, error:'estate and harvestDate required' }, 400)
        const id = `MH-${Date.now()}`
        await ActiveDB.prepare(`
          INSERT INTO estate360_mango_harvests (
            harvest_id, estate, harvest_date, box_type, 
            alphonsa, neelam, malgova, banganapally, kilimooku, sindooram, mix, 
            total_boxes, buyer, price_per_box, total_revenue, notes, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(id, estate, harvestDate, boxType || 'Normal', parseInt(alphonsa) || 0, parseInt(neelam) || 0, parseInt(malgova) || 0, parseInt(banganapally) || 0, parseInt(kilimooku) || 0, parseInt(sindooram) || 0, parseInt(mix) || 0, parseInt(totalBoxes) || 0, buyer || null, parseFloat(pricePerBox) || 0, parseFloat(totalRevenue) || 0, notes || null, actor).run()

        const mangoEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        const mangoRevenue = parseFloat(totalRevenue) || 0
        ctx.waitUntil(sendAlert(env, `🥭 Estate360 — New mango harvest: ₹${mangoRevenue.toLocaleString('en-IN')} (${mangoEstateLabel})`, [
          'Source: Estate360 > Mango Harvest',
          'Action: New mango harvest logged',
          '',
          `Estate:       ${mangoEstateLabel}`,
          `Harvest date: ${harvestDate}`,
          `Box type:     ${boxType || 'Normal'}`,
          `Total boxes:  ${parseInt(totalBoxes) || 0}`,
          `Price/box:    ₹${(parseFloat(pricePerBox) || 0).toLocaleString('en-IN')}`,
          `Total revenue:₹${mangoRevenue.toLocaleString('en-IN')}`,
          `Buyer:        ${buyer || '—'}`,
          `Notes:        ${notes || '—'}`,
          `Harvest ID:   ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estate), DB, estate))

        return json({ success:true, data:{ harvestId:id } })
      }

      if (action === 'updateStayLocation') {
        const { stayId, homeAddress, city, state, country, fromCity, phone, email } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(`UPDATE stayvibe_stays SET home_address = ?, city = ?, state = ?, country = ?, from_city = ?, guest_phone = COALESCE(NULLIF(guest_phone,''), ?), guest_email = COALESCE(NULLIF(guest_email,''), ?), updated_by = 'auto', updated_at = ? WHERE stay_id = ?`).bind(homeAddress||null, city||null, state||null, country||'India', fromCity||null, phone||null, email||null, now(), stayId).run()
        return json({ success: true, data: { stayId, city, state, country } })
      }

      if (action === 'updateDriveFolder') {
        const { stayId, driveFolderId, driveFolderUrl, processingNote } = body
        if (!stayId) return err('stayId required')
        const existing = await DB.prepare(`SELECT folder_created_at, processing_log, folder_created FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
        const folderCreatedAt = existing?.folder_created_at || now()
        const prevLog = existing?.processing_log ? existing.processing_log + '\n' : ''
        const logEntry = now() + ' — Drive folder created: ' + (driveFolderUrl || '') + (processingNote ? ' | ' + processingNote : '')
        const setFolderCreated = body.folderCreated !== undefined ? (body.folderCreated ? 1 : 0) : (existing?.folder_created || 0)
        await DB.prepare(`UPDATE stayvibe_stays SET drive_folder_id = ?, drive_folder_url = ?, folder_created = ?, folder_created_at = ?, processing_log = ?, updated_by = 'auto', updated_at = datetime('now') WHERE stay_id = ?`).bind(driveFolderId || null, driveFolderUrl || null, setFolderCreated, folderCreatedAt, prevLog + logEntry, stayId).run()
        return json({ success: true, data: { stayId, driveFolderId, folderCreatedAt } })
      }

      if (action === 'saveReview') {
        const { stayId, rating, source, reviewDate, reviewText, reviewNote, highlights } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(`UPDATE stayvibe_stays SET review_rating = ?, review_source = ?, review_date = ?, review_text = ?, review_note = ?, review_highlights = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(rating || 0, source || 'airbnb', reviewDate || now(), reviewText || null, reviewNote || null, highlights || null, 'auto', now(), stayId).run()
        return json({ success: true, data: { stayId, rating, source } })
      }

      if (action === 'setReadyForCheckIn' || action === 'approvePendingBooking') {
        const { stayId } = body; if (!stayId) return err('stayId required')
        const stay = await DB.prepare(`SELECT status FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
        if (!stay) return json({ success: true, data: { changed: false, reason: 'stay not found' }})
        if (!['booked','confirmed','docs_uploaded','pending_review'].includes(stay.status)) return json({ success: true, data: { changed: false, reason: 'already at ' + stay.status }})
        await DB.prepare(`UPDATE stayvibe_stays SET status = 'ready_for_checkin', updated_by = 'auto', updated_at = ? WHERE stay_id = ?`).bind(now(), stayId).run()
        return json({ success: true, data: { changed: true, stayId, status: 'ready_for_checkin' }})
      }

      if (action === 'updateStayStatus') {
        const { stayId, status } = body
        if (!stayId) return err('stayId required')
        if (!['booked','confirmed','docs_uploaded','ready_for_checkin','checked_in','ready_for_checkout','checked_out','closed','cancelled'].includes(status)) return err(`Invalid status: ${status}`)
        await DB.prepare(`UPDATE stayvibe_stays SET status = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(status, actor, now(), stayId).run()
        if (status === 'checked_out') {
          const stay = await DB.prepare(`SELECT guest_name, checkin_date, nights FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
          if (stay) {
            const existing = await DB.prepare(`SELECT comm_id FROM stayvibe_manager_commissions WHERE stay_id = ?`).bind(stayId).first()
            if (!existing) {
              const nights = parseInt(stay.nights) || 1; const ramanComm = nights > 1 ? 2000 : 1000
              await DB.prepare(`INSERT INTO stayvibe_manager_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,0,'system','system',?,?)`).bind(genId('RC'), stayId, stay.guest_name, stay.checkin_date, nights, ramanComm, now(), now()).run()
            }
          }
        }
        return json({ success: true, data: { stayId, status } })
      }

      if (action === 'markReviewChased') {
        const { stayId } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(
          `UPDATE stayvibe_stays SET review_chased_at = ?, review_chase_count = COALESCE(review_chase_count, 0) + 1, updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(now(), actor, now(), stayId).run()
        return json({ success: true, data: { stayId } })
      }

      // Link a stay to whoever actually made the enquiry/booking, when that's
      // a different person from whoever checks in (e.g. a family member books
      // and pays, someone else physically stays). Pass guestId=null to unlink.
      // Denormalizes the name alongside the id so list views can render
      // "Booked by: X" without an extra JOIN, same pattern as guest_name itself.
      // ── ABSORB DUPLICATE STAY — agent-booking merge, step 2 ─────────────
      // One physical stay, two rows (booker's channel booking holds the
      // money; guest's check-in row holds identity + docs). This action
      // MOVES all financial + channel fields source → target, voids the
      // source as a duplicate, and re-syncs the ledger — atomically, in one
      // D1 batch, so the money is never on two live rows (no double count)
      // and never on zero live rows (nothing lost).
      // Guards: refuses if the target already carries money (would double
      // count / overwrite), or if either row is already retired.
      // airbnb_conf moves to the target and is NULLed on the source so a
      // future Airbnb modification/cancellation email matches the LIVE row.
      // Void (not cancel) because the stay is happening — this row is a
      // duplicate, not a lost booking, so it must not appear in
      // cancellation/lost-revenue reporting.
      if (action === 'absorbDuplicateStay') {
        const { sourceStayId, targetStayId } = body
        if (!sourceStayId || !targetStayId) return err('sourceStayId and targetStayId required')
        if (sourceStayId === targetStayId) return err('source and target must differ')
        const src = await DB.prepare(`SELECT * FROM stayvibe_stays WHERE stay_id = ?`).bind(sourceStayId).first()
        const tgt = await DB.prepare(`SELECT * FROM stayvibe_stays WHERE stay_id = ?`).bind(targetStayId).first()
        if (!src || !tgt) return err('Stay not found', 404)
        if (['cancelled','void','closed'].includes(tgt.status)) return err('Target stay is not active')
        if (src.status === 'void') return err('Source stay is already void')
        if ((src.gross || 0) <= 0 && (src.net || 0) <= 0) return err('Source stay has no financials to absorb')
        if ((tgt.gross || 0) > 0 || (tgt.net || 0) > 0) {
          return err('Target already has financials — refusing to overwrite. Clear one side first to avoid double counting.')
        }
        await DB.batch([
          DB.prepare(`UPDATE stayvibe_stays SET
              source = ?, airbnb_conf = COALESCE(?, airbnb_conf),
              tariff_per_night = ?, gross = ?, commission_pct = ?, commission_amt = ?, net = ?,
              extra_charges = ?, extra_lines = ?,
              night_fee = ?, cleaning_fee = ?, host_service_fee = ?, you_earn = ?,
              guest_service_fee = ?, guest_paid_total = ?,
              notes = TRIM(COALESCE(notes,'') || ' | Financials absorbed from duplicate ' || ?),
              updated_by = ?, updated_at = datetime('now')
            WHERE stay_id = ?`).bind(
            src.source || tgt.source, src.airbnb_conf || null,
            src.tariff_per_night || 0, src.gross || 0, src.commission_pct || 0, src.commission_amt || 0, src.net || 0,
            src.extra_charges || 0, src.extra_lines || null,
            src.night_fee || 0, src.cleaning_fee || 0, src.host_service_fee || 0, src.you_earn || 0,
            src.guest_service_fee || 0, src.guest_paid_total || 0,
            sourceStayId, actor, targetStayId),
          DB.prepare(`UPDATE stayvibe_stays SET status = 'void', airbnb_conf = NULL,
              notes = TRIM(COALESCE(notes,'') || ' | Voided as duplicate — financials moved to ' || ?),
              updated_by = ?, updated_at = datetime('now')
            WHERE stay_id = ?`).bind(targetStayId, actor, sourceStayId),
          DB.prepare(`DELETE FROM stayvibe_booking_line_items WHERE stay_id = ?`).bind(sourceStayId),
          DB.prepare(`INSERT INTO infra_processing_log (log_id, event_type, stay_id, note, created_at) VALUES (?, 'merge', ?, ?, datetime('now'))`)
            .bind(genId('LOG'), targetStayId,
              `Absorbed financials from duplicate ${sourceStayId} (${src.guest_name}) into ${targetStayId} (${tgt.guest_name}); duplicate voided. Net moved: ${src.net || 0}.`),
        ])
        await syncStayLedger(DB, targetStayId)
        return json({ success: true, data: { targetStayId, sourceStayId, movedNet: src.net || 0, movedGross: src.gross || 0 } })
      }

      if (action === 'linkBookedBy') {
        const { stayId, guestId } = body
        if (!stayId) return err('stayId required')
        let guestName = null
        if (guestId) {
          const guest = await DB.prepare(`SELECT name FROM stayvibe_guests WHERE guest_id = ?`).bind(guestId).first()
          if (!guest) return err('Guest not found', 404)
          guestName = guest.name
        }
        await DB.prepare(
          `UPDATE stayvibe_stays SET booked_by_guest_id = ?, booked_by_name = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(guestId || null, guestName, actor, now(), stayId).run()

        // Linking "who's paying" (e.g. a B2B agency like Detrip) is
        // separate from tracking the person who actually stayed (e.g.
        // Akhilna). Without this, someone who arrived via a linked/agency
        // booking would have zero footprint in `guests` and could never
        // be recognized as a repeat guest on a future direct booking —
        // backfill a guests row for THIS stay's own guest here, matched
        // by phone/email exactly like saveEnquiry does, so that gap
        // doesn't silently persist.
        let backfilledGuestId = null
        try {
          const stay = await DB.prepare(`SELECT guest_name, guest_phone, guest_email FROM stayvibe_stays WHERE stay_id = ?`).bind(stayId).first()
          if (stay?.guest_name) {
            const normPhone = (stay.guest_phone || '').replace(/[\s\-]/g, '').replace(/^\+?91/, '')
            const normEmail = (stay.guest_email || '').trim().toLowerCase()
            if (normPhone || normEmail) {
              const existing = await DB.prepare(
                `SELECT guest_id FROM stayvibe_guests WHERE (phone = ? AND phone != '') OR (email = ? AND email != '') LIMIT 1`
              ).bind(normPhone, normEmail).first()
              if (existing) {
                backfilledGuestId = existing.guest_id
              } else {
                backfilledGuestId = genId('GST')
                await DB.prepare(`
                  INSERT INTO stayvibe_guests (guest_id, name, phone, email, total_stays, last_seen_at, created_by, updated_by)
                  VALUES (?, ?, ?, ?, 1, ?, ?, ?)
                `).bind(backfilledGuestId, stay.guest_name, normPhone, normEmail, now(), actor, actor).run()
              }
            }
          }
        } catch (e) { console.error('linkBookedBy guest backfill failed:', e?.message || e) }

        return json({ success: true, data: { stayId, guestId: guestId || null, guestName, backfilledGuestId } })
      }

      if (action === 'closeStayWithReview') {
        const { stayId, rating, closedReason } = body
        if (!stayId) return err('stayId required')
        const updates = [`status = 'closed'`, `updated_by = ?`, `updated_at = ?`]
        const binds = [actor, now()]
        if (rating && rating > 0) {
          updates.push(`review_rating = ?`, `review_source = 'direct'`, `review_date = ?`)
          binds.push(rating, now().slice(0, 10))
        }
        binds.push(stayId)
        await DB.prepare(`UPDATE stayvibe_stays SET ${updates.join(', ')} WHERE stay_id = ?`).bind(...binds).run()
        return json({ success: true, data: { stayId, status: 'closed', rating: rating || 0 } })
      }

      if (action === 'saveBreakfastEntry') {
        const id = genId('BF')
        await DB.prepare(`INSERT INTO stayvibe_guest_requests (req_id, stay_id, type, detail, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, body.stayId, 'breakfast', JSON.stringify({ date: body.date, guestCount: body.guestCount || 1, ratePerPerson: body.ratePerPerson || 0, total: body.total || 0, notes: body.notes || '' }), 'done', actor, actor, now(), now()).run()
        return json({ success: true, data: { id } })
      }

      if (action === 'saveCarRental') {
        const id = genId('CR')
        await DB.prepare(`INSERT INTO stayvibe_guest_requests (req_id, stay_id, type, detail, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, body.stayId, 'car_rental', JSON.stringify({ date: body.date, destination: body.destination || '', amount: body.amount || 0, commission: body.commission || 0, net: body.net || 0, notes: body.notes || '' }), 'done', actor, actor, now(), now()).run()
        return json({ success: true, data: { id } })
      }

      // VILLA EXPENSES — recurring operating costs (electricity, maintenance,
      // repairs, laundry, deep cleaning, pest control, landscaping, etc.)
      // Available to owner and Raman. Emails the owner on every save.
      if (action === 'saveVillaExpense') {
        const { txnId, villaId, date, category, amount, paidTo, description } = body
        if (!date || !category || !amount) return err('date, category and amount are required', 400)
        const amt = parseFloat(amount) || 0
        const vId = villaId || DEFAULT_VILLA_ID

        if (txnId) {
          await DB.prepare(`
            UPDATE stayvibe_villa_expenses SET date=?, category=?, amount=?, paid_to=?, description=?, updated_by=?, updated_at=?
            WHERE txn_id = ?
          `).bind(date, category, amt, paidTo || null, description || null, actor, now(), txnId).run()

          ctx.waitUntil(sendAlert(env, `🧾 bgIndia — Villa expense updated: ₹${amt.toLocaleString('en-IN')} (${category})`, [
            `Source: Owner/Raman > Villa Expenses screen`,
            `Action: Expense entry updated`,
            '',
            `Category:    ${category}`,
            `Date:        ${date}`,
            `Amount:      ₹${amt.toLocaleString('en-IN')}`,
            `Paid to:     ${paidTo || '—'}`,
            `Description: ${description || '—'}`,
            `Villa:       ${vId}`,
            `Txn ID:      ${txnId}`,
            '',
            `Updated by: ${actor}`,
            `Updated at: ${now()}`,
          ], await getOwnerAlertEmail(DB, env, vId), DB, vId))

          return json({ success: true, data: { txnId } })
        }

        const id = genId('VE')
        await DB.prepare(`
          INSERT INTO stayvibe_villa_expenses (txn_id, villa_id, date, category, amount, paid_to, description, created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).bind(id, vId, date, category, amt, paidTo || null, description || null, actor, actor, now(), now()).run()

        ctx.waitUntil(sendAlert(env, `🧾 bgIndia — New villa expense: ₹${amt.toLocaleString('en-IN')} (${category})`, [
          `Source: Owner/Raman > Villa Expenses screen`,
          `Action: New expense entry logged`,
          '',
          `Category:    ${category}`,
          `Date:        ${date}`,
          `Amount:      ₹${amt.toLocaleString('en-IN')}`,
          `Paid to:     ${paidTo || '—'}`,
          `Description: ${description || '—'}`,
          `Villa:       ${vId}`,
          `Txn ID:      ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, vId), DB, vId))

        return json({ success: true, data: { txnId: id } })
      }

      if (action === 'deleteVillaExpense') {
        const { txnId } = body; if (!txnId) return err('txnId required')
        await DB.prepare(`DELETE FROM stayvibe_villa_expenses WHERE txn_id = ?`).bind(txnId).run()
        return json({ success: true, data: { txnId, deleted: true } })
      }

      // Per-villa configurable settings (SaaS onboarding) — upsert one key/value.
      // New tenants are onboarded by adding rows here, never by touching code.
      if (action === 'saveVillaSetting') {
        const { villaId, key, value } = body
        if (!key) return err('key required')
        const vId = villaId || DEFAULT_VILLA_ID
        await DB.prepare(`
          INSERT INTO stayvibe_villa_settings (villa_id, key, value, updated_by, updated_at) VALUES (?,?,?,?,?)
          ON CONFLICT(villa_id, key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
        `).bind(vId, key, value ?? null, actor, now()).run()
        return json({ success: true, data: { villaId: vId, key, value } })
      }

      // LEDGER TRANSACTIONS — Create/Update entries
      if (action === 'saveEstateTransaction') {
        const { estate, type, date, category, amount, paidTo, description, txnId } = body
        if (!estate || !type || !date || !category || !amount) return err('Missing required fields', 400)

        const estateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        const amt = parseFloat(amount) || 0
        const typeLabel = type === 'income' ? 'Income' : 'Expense'
        const emoji = type === 'income' ? '💰' : '🧾'

        if (txnId) {
          await ActiveDB.prepare(`UPDATE estate360_estate_transactions SET type=?, date=?, category=?, amount=?, paid_to=?, description=?, updated_by=?, updated_at=? WHERE txn_id=?`).bind(type, date, category, amt, paidTo||null, description||null, actor, now(), txnId).run()

          ctx.waitUntil(sendAlert(env, `${emoji} Estate360 — ${typeLabel} updated: ₹${amt.toLocaleString('en-IN')} (${estateLabel})`, [
            `Source: Estate360 > ${estateLabel} > Income/Expense screen`,
            `Action: ${typeLabel} entry updated`,
            '',
            `Estate:      ${estateLabel}`,
            `Type:        ${typeLabel}`,
            `Date:        ${date}`,
            `Category:    ${category}`,
            `Amount:      ₹${amt.toLocaleString('en-IN')}`,
            `Paid to:     ${paidTo || '—'}`,
            `Description: ${description || '—'}`,
            `Txn ID:      ${txnId}`,
            '',
            `Updated by: ${actor}`,
            `Updated at: ${now()}`,
          ], await getOwnerAlertEmail(DB, env, estate), DB, estate))

          return json({ success: true, data: { txnId } })
        } else {
          const id = 'ET_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)
          await ActiveDB.prepare(`INSERT INTO estate360_estate_transactions (txn_id, estate, type, date, category, amount, paid_to, description, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, estate, type, date, category, amt, paidTo||null, description||null, actor, actor, now(), now()).run()

          ctx.waitUntil(sendAlert(env, `${emoji} Estate360 — New ${typeLabel.toLowerCase()}: ₹${amt.toLocaleString('en-IN')} (${estateLabel})`, [
            `Source: Estate360 > ${estateLabel} > Income/Expense screen`,
            `Action: New ${typeLabel.toLowerCase()} entry logged`,
            '',
            `Estate:      ${estateLabel}`,
            `Type:        ${typeLabel}`,
            `Date:        ${date}`,
            `Category:    ${category}`,
            `Amount:      ₹${amt.toLocaleString('en-IN')}`,
            `Paid to:     ${paidTo || '—'}`,
            `Description: ${description || '—'}`,
            `Txn ID:      ${id}`,
            '',
            `Logged by: ${actor}`,
            `Logged at: ${now()}`,
          ], await getOwnerAlertEmail(DB, env, estate), DB, estate))

          return json({ success: true, data: { txnId: id } })
        }
      }

      if (action === 'createCampaign') {
        const { campaignName, channel, villaId, notes } = body; if (!campaignName?.trim()) return err('campaignName required')
        const slug = campaignName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
        const token = `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; const id = 'cmp_' + Date.now()
        await DB.prepare(`INSERT INTO stayvibe_marketing_campaigns (id, campaign_name, unique_token, channel, villa_id, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id, campaignName.trim(), token, channel || 'whatsapp', villaId || DEFAULT_VILLA_ID, notes || null, actor, now()).run()
        return json({ success: true, data: { id, token, campaignName: campaignName.trim() } })
      }

      if (action === 'toggleCampaign') {
        const { campaignId } = body; if (!campaignId) return err('campaignId required')
        await DB.prepare(`UPDATE stayvibe_marketing_campaigns SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id = ?`).bind(campaignId).run()
        return json({ success: true })
      }

      if (action === 'deleteCampaign') {
        const { campaignId } = body; if (!campaignId) return err('campaignId required')
        await DB.prepare(`DELETE FROM stayvibe_campaign_analytics WHERE campaign_id = ?`).bind(campaignId).run()
        await DB.prepare(`DELETE FROM stayvibe_marketing_campaigns WHERE id = ?`).bind(campaignId).run()
        return json({ success: true })
      }

      if (action === 'trackCampaignClick') {
        const { token, referrer } = body; if (!token) return err('token required')
        const campaign = await DB.prepare(`SELECT id FROM stayvibe_marketing_campaigns WHERE unique_token = ? AND is_active = 1`).bind(token).first()
        if (!campaign) return json({ success: false, error: 'Unknown token' })
        const cf = request.cf || {}; const id = 'evt_' + Date.now()
        await DB.prepare(`INSERT INTO stayvibe_campaign_analytics (id, campaign_id, event_type, country, region, city, user_agent, referrer) VALUES (?,?,?,?,?,?,?,?)`).bind(id, campaign.id, 'click', cf.country || null, cf.region || null, cf.city || null, request.headers.get('user-agent') || null, referrer || null).run()
        return json({ success: true })
      }

      if (action === 'trackCampaignAction') {
        const { token, eventType } = body; if (!token) return err('token required')
        const campaign = await DB.prepare(`SELECT id FROM stayvibe_marketing_campaigns WHERE unique_token = ?`).bind(token).first()
        if (!campaign) return json({ success: false })
        const cf = request.cf || {}; const id = 'evt_' + Date.now()
        await DB.prepare(`INSERT INTO stayvibe_campaign_analytics (id, campaign_id, event_type, country, region, city, user_agent) VALUES (?,?,?,?,?,?,?)`).bind(id, campaign.id, eventType, cf.country || null, cf.region || null, cf.city || null, request.headers.get('user-agent') || null).run()
        return json({ success: true })
      }

      // LOG IRRIGATION — Simple tap log (No zone info specified)
      if (action === 'logIrrigation') {
        const { estate, loggedDate, notes, durationMins } = body
        if (!estate || !loggedDate) return err('estate and loggedDate required')
        const id = 'irr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        await ActiveDB.prepare(
          `INSERT INTO estate360_irrigation_logs (log_id, estate, logged_date, notes, created_by, created_at, zone_id, zone_name, duration_mins)
           VALUES (?,?,?,?,?,?, NULL, NULL, ?)`
        ).bind(id, estate, loggedDate, notes||null, actor, now(), parseInt(durationMins)||0).run()

        const irrEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        ctx.waitUntil(sendAlert(env, `💧 Estate360 — Irrigation logged (${irrEstateLabel})`, [
          'Source: Estate360 > Irrigation Log',
          'Action: Irrigation entry logged',
          '',
          `Estate:    ${irrEstateLabel}`,
          `Date:      ${loggedDate}`,
          `Duration:  ${parseInt(durationMins)||0} mins`,
          `Notes:     ${notes || '—'}`,
          `Log ID:    ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estate), DB, estate))

        return json({ success: true, data: { logId: id } })
      }

      // IRRIGATION ZONE LOG — Save targeted run
      if (action === 'saveIrrigationZoneLog') {
        const { estate, zoneId, zoneName, loggedDate, durationMins, notes } = body
        if (!estate || !zoneId || !loggedDate) return err('estate, zoneId, loggedDate required')
        const id = 'irr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        await ActiveDB.prepare(
          `INSERT INTO estate360_irrigation_logs (log_id, estate, logged_date, notes, created_by, created_at, zone_id, zone_name, duration_mins)
           VALUES (?,?,?,?,?,?,?,?,?)`
        ).bind(id, estate, loggedDate, notes||null, actor, now(), zoneId, zoneName||null, parseInt(durationMins)||0).run()

        const zoneEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        ctx.waitUntil(sendAlert(env, `💧 Estate360 — Irrigation logged: ${zoneName || zoneId} (${zoneEstateLabel})`, [
          'Source: Estate360 > Irrigation Log (zone)',
          'Action: Irrigation zone entry logged',
          '',
          `Estate:    ${zoneEstateLabel}`,
          `Zone:      ${zoneName || zoneId}`,
          `Date:      ${loggedDate}`,
          `Duration:  ${parseInt(durationMins)||0} mins`,
          `Notes:     ${notes || '—'}`,
          `Log ID:    ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estate), DB, estate))

        return json({ success: true, data: { logId: id } })
      }

      // IRRIGATION ZONE CONFIG — Cleaned to completely isolate non-existent 'notes' column
      if (action === 'saveIrrigationZone') {
        const { zoneId, estate, zoneName, zoneLabel, expectedFreqDays, active, sortOrder, coconutTrees=0, mangoTrees=0, motor=null, newHoles=0 } = body
        if (!estate || !zoneName) return err('estate and zoneName required')
        const id = zoneId || ('zone_' + estate + '_' + Date.now())
        await ActiveDB.prepare(
          `INSERT OR REPLACE INTO estate360_irrigation_zones (zone_id, estate, zone_name, zone_label, expected_freq_days, coconut_trees, new_holes, motor, mango_trees, active, sort_order, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM estate360_irrigation_zones WHERE zone_id=?), ?))`
        ).bind(id, estate, zoneName, zoneLabel||null, parseInt(expectedFreqDays)||7, parseInt(coconutTrees)||0, parseInt(newHoles)||0, motor||null, parseInt(mangoTrees)||0, active !== false ? 1 : 0, parseInt(sortOrder)||0, id, now()).run()
        return json({ success: true, data: { zoneId: id } })
      }

      // SAVE FERTILIZATION — Completely Rewritten to align with structural layout columns (log_id, quantity_kg, cost)
      if (action === 'saveFertilization') {
        const { estate, plannedDate, actualDate, fertilizerType, quantityKg, cost, doneBy, notes } = body
        if (!estate || !plannedDate) return err('estate and plannedDate required')
        const id = 'fert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        await ActiveDB.prepare(
          `INSERT INTO estate360_fertilization_log (log_id, estate, planned_date, actual_date, fertilizer_type, quantity_kg, cost, done_by, notes, created_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id, estate, plannedDate, actualDate||null, fertilizerType||null, parseFloat(quantityKg)||0, parseFloat(cost)||0, doneBy||null, notes||null, actor, now()).run()

        const fertEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        ctx.waitUntil(sendAlert(env, `🌱 Estate360 — Fertilization logged (${fertEstateLabel})`, [
          'Source: Estate360 > Fertilization Log',
          'Action: Fertilization entry logged',
          '',
          `Estate:        ${fertEstateLabel}`,
          `Planned date:  ${plannedDate}`,
          `Actual date:   ${actualDate || '—'}`,
          `Fertilizer:    ${fertilizerType || '—'}`,
          `Quantity (kg): ${parseFloat(quantityKg) || 0}`,
          `Cost:          ₹${(parseFloat(cost) || 0).toLocaleString('en-IN')}`,
          `Done by:       ${doneBy || '—'}`,
          `Notes:         ${notes || '—'}`,
          `Log ID:        ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ], await getOwnerAlertEmail(DB, env, estate), DB, estate))

        return json({ success: true, data: { id } })
      }

      if (action === 'deleteEstateTransaction') {
        const { txnId } = body; if (!txnId) return err('txnId required')
        await ActiveDB.prepare(`DELETE FROM estate360_estate_transactions WHERE txn_id = ?`).bind(txnId).run()
        return json({ success: true, data: { txnId, deleted: true } })
      }

      // RENTAL AGREEMENT — create or update a tenant's lease record on rental_props.
      // This action was called by RentalAgreement.jsx's Save button and Add-Property
      // flow, but had NO backend handler at all — every save silently did nothing.
      if (action === 'saveRentalAgreement') {
        const d = body
        if (!d.propId) return err('propId required')

        const existing = await DB.prepare(`SELECT prop_id, next_renewal_date FROM rev360_rental_props WHERE prop_id = ?`).bind(d.propId).first()

        // next_renewal_date: if the caller didn't explicitly pass one, default it to
        // leaseEnd (the natural "renew or vacate" checkpoint). Once set, later saves
        // that omit nextRenewalDate should not silently null it back out — preserve
        // the existing value unless a new one is explicitly supplied.
        const nextRenewal = d.nextRenewalDate !== undefined
          ? (d.nextRenewalDate || null)
          : (existing ? existing.next_renewal_date : (d.leaseEnd || null))

        const earlyTerminated     = d.earlyTerminated ? 1 : 0
        const earlyTerminationDt  = earlyTerminated ? (d.earlyTerminationDate || null) : null

        // Month-to-month: suppresses both the lease-expiry and
        // renewal-overdue warnings on the frontend while set (explicit
        // decision, 2026-06-27) -- this does NOT touch lease_end, which
        // stays as the original fixed term's end date for reference.
        const isMonthToMonth      = d.isMonthToMonth ? 1 : 0
        const monthToMonthSince   = isMonthToMonth ? (d.monthToMonthSince || null) : null

        const docFlags = {
          doc_contract_signed: d.docContractSigned ? 1 : 0,
          doc_id_captured:     d.docIdCaptured     ? 1 : 0,
          doc_move_in:         d.docMoveIn         ? 1 : 0,
          doc_move_out:        d.docMoveOut        ? 1 : 0,
          doc_damage_report:   d.docDamageReport   ? 1 : 0,
        }

        if (existing) {
          await DB.prepare(`
            UPDATE rev360_rental_props SET
              name = COALESCE(?, name), location = COALESCE(?, location),
              country = ?, currency = ?,
              tenant_name = ?, tenant_email = ?, tenant_phone = ?, tenant_address = ?, tenant_pan = ?,
              deposit = ?, agreed_rent = ?, maintenance_fee = ?,
              lease_start = ?, lease_end = ?, notes = ?,
              drive_folder_url = ?, next_renewal_date = ?,
              early_terminated = ?, early_termination_date = ?,
              is_month_to_month = ?, month_to_month_since = ?,
              doc_contract_signed = ?, doc_id_captured = ?, doc_move_in = ?, doc_move_out = ?, doc_damage_report = ?,
              has_separate_parking = ?,
              parking_tenant_name = ?, parking_tenant_phone = ?,
              parking_fee = ?, parking_deposit = ?,
              parking_lease_start = ?, parking_lease_end = ?, parking_currency = ?,
              parking_paid_in_full = ?,
              updated_by = ?, updated_at = ?
            WHERE prop_id = ?
          `).bind(
            d.propName || null, d.location || null,
            d.country || 'IN', d.currency || 'INR',
            d.tenantName || '', d.tenantEmail || null, d.tenantPhone || null, d.tenantAddress || null, d.tenantPan || null,
            parseFloat(d.deposit) || 0, parseFloat(d.agreedRent) || 0, parseFloat(d.maintenance) || 0,
            d.leaseStart || null, d.leaseEnd || null, d.notes || null,
            d.driveFolderUrl || null, nextRenewal,
            earlyTerminated, earlyTerminationDt,
            isMonthToMonth, monthToMonthSince,
            docFlags.doc_contract_signed, docFlags.doc_id_captured, docFlags.doc_move_in, docFlags.doc_move_out, docFlags.doc_damage_report,
            d.hasSeparateParking ? 1 : 0,
            d.parkingTenantName || null, d.parkingTenantPhone || null,
            parseFloat(d.parkingFee) || 0, parseFloat(d.parkingDeposit) || 0,
            d.parkingLeaseStart || null, d.parkingLeaseEnd || null, d.parkingCurrency || d.currency || 'INR',
            d.parkingPaidInFull ? 1 : 0,
            actor, now(), d.propId
          ).run()
        } else {
          await DB.prepare(`
            INSERT INTO rev360_rental_props (
              prop_id, name, location, country, currency,
              tenant_name, tenant_email, tenant_phone, tenant_address, tenant_pan,
              deposit, agreed_rent, maintenance_fee,
              lease_start, lease_end, notes, drive_folder_url, status,
              next_renewal_date, early_terminated, early_termination_date,
              is_month_to_month, month_to_month_since,
              doc_contract_signed, doc_id_captured, doc_move_in, doc_move_out, doc_damage_report,
              has_separate_parking, parking_tenant_name, parking_tenant_phone,
              parking_fee, parking_deposit, parking_lease_start, parking_lease_end, parking_currency,
              parking_paid_in_full,
              created_by, updated_by, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            d.propId, d.propName || d.propId, d.location || '', d.country || 'IN', d.currency || 'INR',
            d.tenantName || '', d.tenantEmail || null, d.tenantPhone || null, d.tenantAddress || null, d.tenantPan || null,
            parseFloat(d.deposit) || 0, parseFloat(d.agreedRent) || 0, parseFloat(d.maintenance) || 0,
            d.leaseStart || null, d.leaseEnd || null, d.notes || null, d.driveFolderUrl || null, 'Signed Up',
            nextRenewal, earlyTerminated, earlyTerminationDt,
            isMonthToMonth, monthToMonthSince,
            docFlags.doc_contract_signed, docFlags.doc_id_captured, docFlags.doc_move_in, docFlags.doc_move_out, docFlags.doc_damage_report,
            d.hasSeparateParking ? 1 : 0,
            d.parkingTenantName || null, d.parkingTenantPhone || null,
            parseFloat(d.parkingFee) || 0, parseFloat(d.parkingDeposit) || 0,
            d.parkingLeaseStart || null, d.parkingLeaseEnd || null, d.parkingCurrency || d.currency || 'INR',
            d.parkingPaidInFull ? 1 : 0,
            actor, actor, now(), now()
          ).run()
        }

        return json({ success: true, data: { propId: d.propId } })
      }

      // Tenant lifecycle stage: 'Signed Up' / 'Active' / 'Notice Given' / 'Completed'.
      // isDelinquent is a flag that can sit on top of Active/Notice Given (still
      // living there, behind on rent) — NOT its own stage. endReason is only
      // meaningful when stage='Completed' (Lease Ended / Early Termination /
      // Evicted / Runaway / After Delinquency).
      //
      // The legacy `status` column is kept in sync alongside `stage` (best
      // mapping back to the old 6-value vocabulary) rather than left to go
      // stale, since other screens (e.g. Rev360Home's KPI strip) may read it —
      // Rev360Home itself has been updated to read `stage`/`is_delinquent`
      // directly, but anything else relying on `status` keeps working too.
      if (action === 'updateTenantStage') {
        const { propId, stage, isDelinquent, endReason } = body
        if (!propId || !stage) return err('propId and stage required')
        if (!['Signed Up','Active','Notice Given','Completed'].includes(stage)) return err('Invalid stage')
        const legacyStatus = stage === 'Completed' ? (endReason || 'Completed')
          : (isDelinquent ? 'Delinquent' : stage)
        await DB.prepare(`
          UPDATE rev360_rental_props SET stage = ?, is_delinquent = ?, end_reason = ?, status = ?, updated_by = ?, updated_at = ?
          WHERE prop_id = ?
        `).bind(stage, isDelinquent ? 1 : 0, stage === 'Completed' ? (endReason || 'Lease Ended') : null, legacyStatus, actor, now(), propId).run()
        return json({ success: true, data: { propId, stage, isDelinquent: !!isDelinquent, endReason } })
      }

      if (action === 'updateTenantStatus') {
        const { propId, status } = body; if (!propId || !status) return err('propId and status required')
        if (!['Active','Notice Given','Delinquent','Evicted','Runaway','Completed'].includes(status)) return err('Invalid status')
        await DB.prepare(`UPDATE rev360_rental_props SET status = ?, updated_by = ?, updated_at = ? WHERE prop_id = ?`).bind(status, actor, now(), propId).run()
        return json({ success: true, data: { propId, status } })
      }

      // Instant single-checkbox toggle for the document checklist, so ticking a box
      // doesn't require resubmitting the whole tenant form.
      if (action === 'updateRentalDocChecklist') {
        const { propId, field, value } = body
        const allowed = ['doc_contract_signed','doc_id_captured','doc_move_in','doc_move_out','doc_damage_report']
        if (!propId || !allowed.includes(field)) return err('propId and a valid field required')
        await DB.prepare(`UPDATE rev360_rental_props SET ${field} = ?, updated_by = ?, updated_at = ? WHERE prop_id = ?`)
          .bind(value ? 1 : 0, actor, now(), propId).run()
        return json({ success: true, data: { propId, field, value: !!value } })
      }

      if (action === 'savePropertyDetails') {
        const d = body; if (!d.propId) return err('propId required')
        const existing = await DB.prepare(`SELECT prop_id FROM rev360_property_details WHERE prop_id = ?`).bind(d.propId).first()
        const fields = ['address_line1','address_line2','city','state_province','postal_code','country','elec_provider','elec_consumer_id','elec_account_number','elec_portal_url','elec_monthly_avg','water_provider','water_consumer_id','water_account_number','water_portal_url','water_monthly_avg','gas_provider','gas_consumer_id','gas_account_number','gas_portal_url','gas_monthly_avg','internet_provider','internet_account','internet_monthly','hoa_name','hoa_account','hoa_monthly','other_utility_name','other_utility_id','other_utility_monthly','tax_parcel_id','tax_authority','tax_annual','tax_portal_url','loan_lender','loan_account','loan_original','loan_outstanding','loan_monthly_emi','loan_interest_rate','loan_start_date','loan_end_date','loan_portal_url','purchase_price','purchase_date','estimated_value','estimated_value_date','currency','insurance_provider','insurance_policy_no','insurance_annual','insurance_expiry','notes']
        const vals = fields.map(f => { const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); const v = d[camel] !== undefined ? d[camel] : d[f]; return (typeof v === 'number' ? v : (v || null)) })
        if (existing) {
          const sets = fields.map(f => f + ' = ?').join(', ')
          await DB.prepare(`UPDATE rev360_property_details SET ${sets}, updated_at = ? WHERE prop_id = ?`).bind(...vals, now(), d.propId).run()
        } else {
          const cols = ['prop_id', ...fields, 'created_at', 'updated_at'].join(', '); const placeholders = ['?', ...fields.map(() => '?'), '?', '?'].join(', ')
          await DB.prepare(`INSERT INTO rev360_property_details (${cols}) VALUES (${placeholders})`).bind(d.propId, ...vals, now(), now()).run()
        }
        return json({ success: true, data: { propId: d.propId } })
      }

      if (action === 'saveHoaEntry') {
        const { id, propId, effectiveDate, monthlyAmount, currency, notes } = body; if (!propId || !effectiveDate || monthlyAmount === undefined) return err('propId, effectiveDate, monthlyAmount required')
        const entryId = id || ('hoa_' + Date.now()); await DB.prepare(`INSERT OR REPLACE INTO rev360_hoa_history (id, prop_id, effective_date, monthly_amount, currency, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM rev360_hoa_history WHERE id=?), ?))`).bind(entryId, propId, effectiveDate, parseFloat(monthlyAmount)||0, currency||'INR', notes||null, entryId, now()).run()
        return json({ success: true, data: { id: entryId } })
      }

      if (action === 'deleteHoaEntry') {
        const { id } = body; if (!id) return err('id required')
        await DB.prepare(`DELETE FROM rev360_hoa_history WHERE id = ?`).bind(id).run()
        return json({ success: true, data: { id, deleted: true } })
      }

      if (action === 'saveTaxEntry') {
        const { id, propId, taxYear, annualAmount, currency, parcelId, taxAuthority, dueDate, paidDate, paidAmount, receiptRef, notes } = body; if (!propId || !taxYear || annualAmount === undefined) return err('propId, taxYear, annualAmount required')
        const entryId = id || ('tax_' + propId + '_' + taxYear); await DB.prepare(`INSERT OR REPLACE INTO rev360_tax_history (id, prop_id, tax_year, annual_amount, currency, parcel_id, tax_authority, due_date, paid_date, paid_amount, receipt_ref, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM rev360_tax_history WHERE id=?),?))`).bind(entryId, propId, parseInt(taxYear), parseFloat(annualAmount)||0, currency||'INR', parcelId||null, taxAuthority||null, dueDate||null, paidDate||null, parseFloat(paidAmount)||0, receiptRef||null, notes||null, entryId, now()).run()
        return json({ success: true, data: { id: entryId } })
      }

      if (action === 'deleteTaxEntry') {
        const { id } = body; if (!id) return err('id required')
        await DB.prepare(`DELETE FROM rev360_tax_history WHERE id = ?`).bind(id).run()
        return json({ success: true, data: { id, deleted: true } })
      }

      if (action === 'savePropertyDoc') {
        const { docId, propId, category, docName, driveUrl, driveFolderUrl, fileType, docDate, notes } = body; if (!propId || !docName) return err('propId and docName required')
        const id = docId || ('doc_' + Date.now()); await DB.prepare(`INSERT OR REPLACE INTO rev360_property_documents (doc_id, prop_id, category, doc_name, drive_url, drive_folder_url, file_type, doc_date, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM rev360_property_documents WHERE doc_id=?),?))`).bind(id, propId, category||'Other', docName.trim(), driveUrl||null, driveFolderUrl||null, fileType||null, docDate||null, notes||null, id, now()).run()
        return json({ success: true, data: { docId: id } })
      }

      if (action === 'deletePropertyDoc') {
        const { docId } = body; if (!docId) return err('docId required')
        await DB.prepare(`DELETE FROM rev360_property_documents WHERE doc_id = ?`).bind(docId).run()
        return json({ success: true, data: { docId, deleted: true } })
      }

      if (action === 'saveLeaseLoss') {
        const { lossId, propId, leaseSnapshot, itemCategory, description, amount, currency, evidenceFileName, evidenceDriveUrl, evidenceTimestamp, status: lossStatus } = body; if (!propId || !description || amount === undefined) return err('propId, description, amount required')
        if (!['Rent','Damage','Cleaning','Legal','Other'].includes(itemCategory)) return err('Invalid itemCategory')
        const id = lossId || ('loss_' + Date.now()); await DB.prepare(`INSERT OR REPLACE INTO rev360_lease_losses (loss_id, prop_id, lease_snapshot, item_category, description, amount, currency, evidence_file_name, evidence_drive_url, evidence_timestamp, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT created_at FROM rev360_lease_losses WHERE loss_id=?),?),?)`).bind(id, propId, leaseSnapshot||'', itemCategory||'Other', description, parseFloat(amount)||0, currency||'INR', evidenceFileName||null, evidenceDriveUrl||null, evidenceTimestamp||null, lossStatus||'Estimated', actor, id, now(), now()).run()
        return json({ success: true, data: { lossId: id } })
      }

      if (action === 'updateLeaseLossStatus') {
        const { lossId, status: lossStatus } = body; if (!lossId || !lossStatus) return err('lossId and status required')
        await DB.prepare(`UPDATE rev360_lease_losses SET status = ?, updated_at = ? WHERE loss_id = ?`).bind(lossStatus, now(), lossId).run()
        return json({ success: true, data: { lossId, status: lossStatus } })
      }

      if (action === 'deleteLeaseLoss') {
        const { lossId } = body; if (!lossId) return err('lossId required')
        await DB.prepare(`DELETE FROM rev360_lease_losses WHERE loss_id = ?`).bind(lossId).run()
        return json({ success: true, data: { lossId, deleted: true } })
      }

      // RENT LEDGER — "Paid on Time" / late-fee exception POST lands here.
      // (getRentTransactions, the matching read, lives in the GET block
      // above — it was originally misplaced here too, which is exactly
      // why it 404'd: GET requests never reach code inside this POST block.)
      if (action === 'postRentPayment') {
        const { propId, periodMonth, baseRent, maintenance, carParking, lateFee, paidDate, currency, isException, notes, unitType } = body
        if (!propId || !periodMonth) return err('propId and periodMonth required')
        if (!/^\d{4}-\d{2}$/.test(periodMonth)) return err('periodMonth must be YYYY-MM')
        const base = parseFloat(baseRent) || 0
        const maint = parseFloat(maintenance) || 0
        const parking = parseFloat(carParking) || 0
        const late = parseFloat(lateFee) || 0
        const total = base + maint + parking + late
        const utype = unitType || 'main'
        const id = 'rtxn_' + Date.now() + '_' + Math.floor(Math.random()*1000)
        try {
          await DB.prepare(`
            INSERT INTO rev360_rent_transactions (
              txn_id, prop_id, period_month, base_rent, maintenance, car_parking, late_fee,
              total_due, is_exception, paid_date, currency, notes, unit_type, created_by, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            id, propId, periodMonth, base, maint, parking, late,
            total, isException ? 1 : 0, paidDate || now().slice(0,10), currency || 'INR', notes || null, utype, actor, now()
          ).run()
        } catch (e) {
          if (String(e.message || '').includes('UNIQUE')) {
            const label = utype === 'parking' ? 'Car parking rent' : 'Rent'
            return err(`${label} for ${periodMonth} has already been posted for this property.`, 409)
          }
          throw e
        }
        return json({ success: true, data: { txnId: id, propId, periodMonth, totalDue: total, unitType: utype } })
      }

      // PROPERTY EXPENSES — electricity/water/taxes/extra-maintenance,
      // independent of whether rent was collected that month (vacant
      // periods, or simply tracking property-level costs). Replaces
      // rental_income's expense columns going forward; rental_income
      // itself is left untouched/unwritten-to rather than dropped, so
      // its historical rows are still there for reference.
      if (action === 'savePropertyExpense') {
        const { propId, month, year, electricity, water, propertyTax, landTax, notes } = body
        if (!propId || !month || !year) return err('propId, month, and year required')
        const e1 = parseFloat(electricity) || 0
        const e2 = parseFloat(water) || 0
        const e3 = parseFloat(propertyTax) || 0
        const e4 = parseFloat(landTax) || 0
        // extra_maintenance is no longer a manual input (per explicit
        // decision, 2026-06-29) -- it's computed here as the sum of
        // this property/month/year's logged maintenance_events, so the
        // monthly total always reflects the real itemized log rather
        // than a hand-typed number that could drift out of sync with it.
        const maintSum = await DB.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM rev360_maintenance_events WHERE prop_id = ? AND month = ? AND year = ?`).bind(propId, month, year).first()
        const e5 = maintSum?.total || 0
        const total = e1 + e2 + e3 + e4 + e5
        const recId = `PE-${propId}-${year}-${month}`
        await DB.prepare(`
          INSERT OR REPLACE INTO rev360_property_expenses (
            record_id, prop_id, month, year, electricity, water, property_tax, land_tax,
            extra_maintenance, total_expense, notes, created_by, updated_by, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          recId, propId, month, year, e1, e2, e3, e4, e5, total, notes || null,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { recordId: recId, totalExpense: total, maintenanceFromEvents: e5 } })
      }

      // MAINTENANCE EVENTS write — log a single maintenance/repair event
      // for a property/month. category is one of a fixed list (Plumbing/
      // Electrical/Appliance Repair/Painting/Pest Control/Cleaning/
      // Carpentry/Other), confirmed with owner. Multiple events can
      // exist for the same property/month (e.g. two separate repairs).
      if (action === 'saveMaintenanceEvent') {
        const { eventId, propId, month, year, category, amount, description, eventDate } = body
        if (!propId || !month || !year) return err('propId, month, and year required')
        if (!category) return err('category required')
        const amt = parseFloat(amount) || 0
        const id = eventId || ('me_' + Date.now() + '_' + Math.floor(Math.random()*1000))
        if (eventId) {
          await DB.prepare(`
            UPDATE rev360_maintenance_events SET
              category = ?, amount = ?, description = ?, event_date = ?,
              updated_by = ?, updated_at = ?
            WHERE event_id = ?
          `).bind(category, amt, description || null, eventDate || null, actor, now(), id).run()
        } else {
          await DB.prepare(`
            INSERT INTO rev360_maintenance_events (
              event_id, prop_id, month, year, category, amount, description, event_date,
              created_by, created_at, updated_by, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(id, propId, month, year, category, amt, description || null, eventDate || now().slice(0,10), actor, now(), actor, now()).run()
        }
        return json({ success: true, data: { eventId: id } })
      }

      if (action === 'deleteMaintenanceEvent') {
        const { eventId } = body; if (!eventId) return err('eventId required')
        await DB.prepare(`DELETE FROM rev360_maintenance_events WHERE event_id = ?`).bind(eventId).run()
        return json({ success: true, data: { eventId, deleted: true } })
      }

      // TENANCY HISTORY write actions (saveTenancyHistory/
      // deleteTenancyHistory) land here. (getTenancyHistory, the matching
      // read, lives in the GET block above — same originally-misplaced
      // bug as the other two GET actions fixed alongside this one.)
      if (action === 'saveTenancyHistory') {
        const h = body
        if (!h.propId) return err('propId required')
        if (!h.tenantName) return err('tenantName required')
        const id = h.historyId || ('hist_' + Date.now() + '_' + Math.floor(Math.random()*1000))
        if (h.historyId) {
          await DB.prepare(`
            UPDATE rev360_tenancy_history SET
              tenant_name=?, tenant_email=?, tenant_phone=?, tenant_address=?, tenant_pan=?,
              deposit=?, agreed_rent=?, maintenance_fee=?, lease_start=?, lease_end=?,
              country=?, currency=?, status=?, end_reason=?, early_terminated=?, early_termination_date=?,
              notes=?, drive_folder_url=?,
              doc_contract_signed=?, doc_id_captured=?, doc_move_in=?, doc_move_out=?, doc_damage_report=?,
              updated_by=?, updated_at=?
            WHERE history_id=?
          `).bind(
            h.tenantName, h.tenantEmail||null, h.tenantPhone||null, h.tenantAddress||null, h.tenantPan||null,
            parseFloat(h.deposit)||0, parseFloat(h.agreedRent)||0, parseFloat(h.maintenance)||0,
            h.leaseStart||null, h.leaseEnd||null,
            h.country||'IN', h.currency||'INR', 'Completed', h.endReason||'Lease Ended',
            h.earlyTerminated?1:0, h.earlyTerminationDate||null,
            h.notes||null, h.driveFolderUrl||null,
            h.docContractSigned?1:0, h.docIdCaptured?1:0, h.docMoveIn?1:0, h.docMoveOut?1:0, h.docDamageReport?1:0,
            actor, now(), id
          ).run()
        } else {
          await DB.prepare(`
            INSERT INTO rev360_tenancy_history (
              history_id, prop_id, tenant_name, tenant_email, tenant_phone, tenant_address, tenant_pan,
              deposit, agreed_rent, maintenance_fee, lease_start, lease_end,
              country, currency, status, end_reason, early_terminated, early_termination_date,
              notes, drive_folder_url,
              doc_contract_signed, doc_id_captured, doc_move_in, doc_move_out, doc_damage_report,
              created_by, created_at, updated_by, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            id, h.propId, h.tenantName, h.tenantEmail||null, h.tenantPhone||null, h.tenantAddress||null, h.tenantPan||null,
            parseFloat(h.deposit)||0, parseFloat(h.agreedRent)||0, parseFloat(h.maintenance)||0,
            h.leaseStart||null, h.leaseEnd||null,
            h.country||'IN', h.currency||'INR', 'Completed', h.endReason||'Lease Ended',
            h.earlyTerminated?1:0, h.earlyTerminationDate||null,
            h.notes||null, h.driveFolderUrl||null,
            h.docContractSigned?1:0, h.docIdCaptured?1:0, h.docMoveIn?1:0, h.docMoveOut?1:0, h.docDamageReport?1:0,
            actor, now(), actor, now()
          ).run()
        }
        return json({ success: true, data: { historyId: id } })
      }

      if (action === 'deleteTenancyHistory') {
        const { historyId } = body; if (!historyId) return err('historyId required')
        await DB.prepare(`DELETE FROM rev360_tenancy_history WHERE history_id = ?`).bind(historyId).run()
        return json({ success: true, data: { historyId, deleted: true } })
      }

      // INCOMING TENANTS — saveIncomingTenant/deleteIncomingTenant POST
      // actions land here. (getIncomingTenant, the matching read, lives in
      // the GET block above — same originally-misplaced-here bug as
      // getRentTransactions, fixed at the same time for the same reason.)
      if (action === 'saveIncomingTenant') {
        const t = body
        if (!t.propId) return err('propId required')
        if (!t.tenantName) return err('tenantName required')
        const existing = await DB.prepare(`SELECT incoming_id FROM rev360_incoming_tenants WHERE prop_id = ?`).bind(t.propId).first()
        const id = existing?.incoming_id || ('inc_' + Date.now() + '_' + Math.floor(Math.random()*1000))
        if (existing) {
          await DB.prepare(`
            UPDATE rev360_incoming_tenants SET
              tenant_name=?, tenant_email=?, tenant_phone=?, tenant_address=?, tenant_pan=?,
              deposit=?, agreed_rent=?, maintenance_fee=?, lease_start=?, lease_end=?,
              country=?, currency=?, notes=?, doc_contract_signed=?, doc_id_captured=?,
              updated_by=?, updated_at=?
            WHERE prop_id=?
          `).bind(
            t.tenantName, t.tenantEmail||null, t.tenantPhone||null, t.tenantAddress||null, t.tenantPan||null,
            parseFloat(t.deposit)||0, parseFloat(t.agreedRent)||0, parseFloat(t.maintenance)||0,
            t.leaseStart||null, t.leaseEnd||null, t.country||'IN', t.currency||'INR', t.notes||null,
            t.docContractSigned?1:0, t.docIdCaptured?1:0, actor, now(), t.propId
          ).run()
        } else {
          await DB.prepare(`
            INSERT INTO rev360_incoming_tenants (
              incoming_id, prop_id, tenant_name, tenant_email, tenant_phone, tenant_address, tenant_pan,
              deposit, agreed_rent, maintenance_fee, lease_start, lease_end,
              country, currency, notes, doc_contract_signed, doc_id_captured,
              created_by, created_at, updated_by, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            id, t.propId, t.tenantName, t.tenantEmail||null, t.tenantPhone||null, t.tenantAddress||null, t.tenantPan||null,
            parseFloat(t.deposit)||0, parseFloat(t.agreedRent)||0, parseFloat(t.maintenance)||0,
            t.leaseStart||null, t.leaseEnd||null, t.country||'IN', t.currency||'INR', t.notes||null,
            t.docContractSigned?1:0, t.docIdCaptured?1:0, actor, now(), actor, now()
          ).run()
        }
        return json({ success: true, data: { incomingId: id } })
      }

      // Focused action for the "Mark Deposit Paid" button on the
      // Incoming Tenant card -- deliberately separate from the general
      // saveIncomingTenant save above, so marking the deposit paid (or
      // un-paid, to correct a mistake) never depends on resubmitting the
      // whole tenant form, and editing other fields never silently
      // resets this flag.
      if (action === 'markIncomingDepositPaid') {
        const { propId, paid, paidDate, paymentMode } = body
        if (!propId) return err('propId required')
        await DB.prepare(`
          UPDATE rev360_incoming_tenants SET
            deposit_paid = ?, deposit_paid_date = ?, deposit_payment_mode = ?,
            updated_by = ?, updated_at = ?
          WHERE prop_id = ?
        `).bind(
          paid ? 1 : 0,
          paid ? (paidDate || now().slice(0,10)) : null,
          paid ? (paymentMode || 'Bank Transfer') : null,
          actor, now(), propId
        ).run()
        return json({ success: true, data: { propId, depositPaid: !!paid } })
      }

      if (action === 'deleteIncomingTenant') {
        const { propId } = body; if (!propId) return err('propId required')
        await DB.prepare(`DELETE FROM rev360_incoming_tenants WHERE prop_id = ?`).bind(propId).run()
        return json({ success: true, data: { propId, deleted: true } })
      }

      // The actual handover, run as ONE atomic D1 batch so a failure
      // partway through can never leave the property half-swapped (e.g.
      // archived to history but not yet overwritten, or overwritten but
      // the incoming row not yet cleared so it looks like it's still
      // pending). Either all three steps land, or none do.
      //   1. archive the CURRENT rental_props row into tenancy_history
      //   2. overwrite rental_props with the incoming tenant's data, stage='Active'
      //   3. delete the now-consumed incoming_tenants row
      if (action === 'moveInIncomingTenant') {
        const { propId, endReason } = body
        if (!propId) return err('propId required')
        const current = await DB.prepare(`SELECT * FROM rev360_rental_props WHERE prop_id = ?`).bind(propId).first()
        const incoming = await DB.prepare(`SELECT * FROM rev360_incoming_tenants WHERE prop_id = ?`).bind(propId).first()
        if (!incoming) return err('No incoming tenant queued for this property')

        const histId = 'hist_' + Date.now() + '_' + Math.floor(Math.random()*1000)
        const batch = []

        // Step 1 — only archive if there's an actual outgoing tenant to
        // archive (a property moving in its very first-ever tenant has
        // no prior occupant, so current.tenant_name may be empty).
        if (current && current.tenant_name) {
          batch.push(DB.prepare(`
            INSERT INTO rev360_tenancy_history (
              history_id, prop_id, tenant_name, tenant_email, tenant_phone, tenant_address, tenant_pan,
              deposit, agreed_rent, maintenance_fee, lease_start, lease_end,
              country, currency, status, end_reason, early_terminated, early_termination_date,
              notes, drive_folder_url,
              doc_contract_signed, doc_id_captured, doc_move_in, doc_move_out, doc_damage_report,
              created_by, created_at, updated_by, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            histId, propId, current.tenant_name, current.tenant_email, current.tenant_phone,
            current.tenant_address, current.tenant_pan,
            current.deposit||0, current.agreed_rent||0, current.maintenance_fee||0,
            current.lease_start, current.lease_end,
            current.country||'IN', current.currency||'INR', 'Completed', endReason || 'Lease Ended',
            current.early_terminated||0, current.early_termination_date,
            current.notes, current.drive_folder_url,
            current.doc_contract_signed||0, current.doc_id_captured||0, current.doc_move_in||0,
            current.doc_move_out||0, current.doc_damage_report||0,
            actor, now(), actor, now()
          ))
        }

        // Step 2 — overwrite rental_props with the incoming tenant,
        // resetting per-tenancy fields (doc checklist, delinquent flag,
        // early-termination) that must not carry over from the outgoing
        // tenant onto the new one.
        batch.push(DB.prepare(`
          UPDATE rev360_rental_props SET
            tenant_name=?, tenant_email=?, tenant_phone=?, tenant_address=?, tenant_pan=?,
            deposit=?, agreed_rent=?, maintenance_fee=?, lease_start=?, lease_end=?,
            country=?, currency=?, notes=?,
            stage='Active', is_delinquent=0, end_reason=NULL, status='Active',
            early_terminated=0, early_termination_date=NULL,
            doc_contract_signed=?, doc_id_captured=?, doc_move_in=0, doc_move_out=0, doc_damage_report=0,
            next_renewal_date=?, updated_by=?, updated_at=?
          WHERE prop_id=?
        `).bind(
          incoming.tenant_name, incoming.tenant_email, incoming.tenant_phone, incoming.tenant_address, incoming.tenant_pan,
          incoming.deposit||0, incoming.agreed_rent||0, incoming.maintenance_fee||0,
          incoming.lease_start, incoming.lease_end,
          incoming.country||'IN', incoming.currency||'INR', incoming.notes,
          incoming.doc_contract_signed||0, incoming.doc_id_captured||0,
          incoming.lease_end, actor, now(), propId
        ))

        // Step 3 — the incoming record is now consumed.
        batch.push(DB.prepare(`DELETE FROM rev360_incoming_tenants WHERE prop_id = ?`).bind(propId))

        await DB.batch(batch)
        return json({ success: true, data: { propId, movedInTenant: incoming.tenant_name, archivedOutgoing: !!(current && current.tenant_name) } })
      }


      // CREATE PROVISIONAL BOOKING — called when guest submits form but no booking exists
      if (action === 'createProvisionalBooking') {
        const stayId = genStayId(body.villaId || DEFAULT_VILLA_ID)
        const nights = body.checkInDate && body.checkOutDate
          ? Math.max(1, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000))
          : 1
        await DB.prepare(`
          INSERT INTO stayvibe_stays (
            stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, gross, net,
            status, created_by, updated_by, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,'pending_review',?,?,?,?)
        `).bind(
          stayId, body.villaId || DEFAULT_VILLA_ID, body.source || 'guest_form',
          body.guestName, body.guestPhone || null, body.guestEmail || null,
          body.checkInDate, body.checkOutDate || null, nights,
          parseInt(body.adults) || 1,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { stayId, status: 'pending_review' } })
      }

      // MARK DOCUMENT UPLOADED — called by Apps Script after uploading to Drive
      if (action === 'markDocumentUploaded') {
        const { docId } = body
        if (!docId) return err('docId required')
        await DB.prepare(
          `UPDATE stayvibe_guest_documents SET folder_created = 1, updated_at = ? WHERE doc_id = ?`
        ).bind(now(), docId).run()
        return json({ success: true, data: { docId } })
      }

      // CLEANUP EXPIRED DOCUMENTS — removes docs older than 14 days
      // folder_created=1: Drive upload confirmed, safe to delete
      // folder_created=0: Drive upload never happened — stale, also cleaned after 14 days
      if (action === 'cleanupExpiredDocuments') {
        // Two different rules by doc_type:
        //  - car_photo/plate_photo: kept for 5 days regardless of upload
        //    status (folder_created), so they're viewable in-app for a
        //    few days after check-in even though they've already reached
        //    Drive — this IS the normal path for these two, not a failure
        //    backstop.
        //  - everything else (govt_id, passport, ...): unchanged — a
        //    14-day sweep that should rarely fire, since those get
        //    explicitly deleted right after confirmed upload already.
        const staleUnprocessed = await DB.prepare(
          `SELECT COUNT(*) as cnt FROM stayvibe_guest_documents
           WHERE folder_created = 0
             AND created_at < datetime('now', '-14 days')`
        ).first()
        const result = await DB.prepare(
          `DELETE FROM stayvibe_guest_documents
           WHERE (doc_type IN ('car_photo','plate_photo') AND created_at < datetime('now', '-5 days'))
              OR (doc_type NOT IN ('car_photo','plate_photo') AND created_at < datetime('now', '-14 days'))`
        ).run()
        return json({ success: true, data: {
          deleted: result.meta?.changes || 0,
          staleUnprocessed: staleUnprocessed?.cnt || 0
        }})
      }


      // GET PENDING REVIEW STAYS — POST version (Apps Script calls this as POST)
      if (action === 'getPendingReviewStays') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights,
                  guest_phone, guest_email, drive_folder_url, drive_folder_id,
                  created_at, folder_created, folder_created_at
           FROM stayvibe_stays
           WHERE status = 'pending_review'
             AND (checkout_date IS NULL OR checkout_date = '' OR checkout_date >= date('now'))
           ORDER BY checkin_date ASC`
        ).all()
        return json({ success: true, data: results.map(r => ({
          stayId:          r.stay_id,
          guestName:       r.guest_name,
          checkIn:         r.checkin_date,
          checkOut:        r.checkout_date,
          nights:          r.nights,
          phone:           r.guest_phone,
          email:           r.guest_email,
          driveFolderUrl:  r.drive_folder_url,
          driveFolderId:   r.drive_folder_id,
          createdAt:       r.created_at,
          folderCreated:   r.folder_created || 0,
          folderCreatedAt: r.folder_created_at || null,
        })) })
      }

      return err(`Unknown POST action: ${action}`, 404)
    }

    return err('Method not allowed', 405)

  } catch (e) {
    if (e.message === 'FORBIDDEN_PROPERTY') {
      return json({ success: false, error: 'You do not have access to this property' }, 403)
    }
    console.error('Worker error:', e)
    return json({ success: false, error: e.message }, 500)
  }
}