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

// ── EMAIL ALERT via MailChannels (free on Cloudflare Workers) ──
async function sendAlert(env, subject, lines) {
  try {
    const body = {
      personalizations: [{ to: [{ email: env.OWNER_EMAIL || 'bijisukumar@gmail.com' }] }],
      from: { email: 'alerts@bgindia-portal.com', name: 'bgIndia Security' },
      subject,
      content: [{ type: 'text/plain', value: lines.join('\n') }],
    }
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
  } catch (_) { /* silent — never block the response for email */ }
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

// ── ROUTER ────────────────────────────────────────────────
export async function onRequest(ctx) {
  const { request, env } = ctx
  const DB         = env.DB || env.bgindia_db
  const DB_ESTATES = env.DB_ESTATES

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
        'A login has been LOCKED after too many failed attempts.',
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
      ])
      return json({ success: false, error: 'Too many attempts', retryAfter: rl.retryAfter }, 429)
    }

    const { pin } = await request.json().catch(() => ({}))
    if (!pin) return err('PIN required', 400)

    const users = {
      [env.PIN_OWNER]:   { name: 'Owner',        role: 'owner',          actor: 'owner'   },
      [env.PIN_RAMAN]:   { name: 'RamananKutty', role: 'manager',        actor: 'raman'   },
      [env.PIN_PRADOSH]: { name: 'Pradosh',       role: 'estate_manager', actor: 'pradosh' },
    }
    const found = users[String(pin)]

    if (!found) {
      await sendAlert(env, '⚠️ bgIndia — Failed login attempt', [
        'Someone entered a wrong PIN.',
        '',
        `Time:       ${timestamp}`,
        `IP Address: ${ip}`,
        `Location:   ${city}${region ? ', ' + region : ''}, ${country}`,
        `User Agent: ${userAgent}`,
        `Referer:    ${referer || 'direct'}`,
        `PIN tried:  ${String(pin).length} digits (not shown for security)`,
        '',
        'No action needed unless you see many of these.',
      ])
      return json({ success: false, error: 'Invalid PIN' }, 401)
    }

    const token = await signJwt({
      name:  found.name,
      role:  found.role,
      actor: found.actor,
      iat:   Math.floor(Date.now() / 1000),
      exp:   Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    }, env.JWT_SECRET)

    return json({ success: true, token })
  }

  // SUBMIT GUEST CHECK-IN FORM — public endpoint (no auth required for guests)
  if (action === 'submitGuestCheckIn' && method === 'POST') {
    try {
      const publicBody = await request.json().catch(() => ({}))
      const {
        villaId = 'dwarka', partner = 'direct', stayId: existingStayId,
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

      if (!stayId) {
        const firstName = guestName.split(' ')[0]
        const found = await DB.prepare(
          `SELECT stay_id, status FROM stays
           WHERE guest_name LIKE ? AND checkin_date = ?
             AND villa_id = ? AND status NOT IN ('cancelled','closed','checked_out')
           LIMIT 1`
        ).bind(`%${firstName}%`, checkInDate, villaId).first()
        if (found) stayId = found.stay_id
      }

      if (stayId) {
        await DB.prepare(`
          UPDATE stays SET
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
          INSERT INTO stays (
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

      const docId = (type, sid) => `DOC-${sid}-${type}-${Date.now()}`
      if (idFileB64) {
        try {
          await DB.prepare(
            `INSERT OR REPLACE INTO guest_documents
             (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
             VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
          ).bind(docId('id', stayId), stayId, 'govt_id', idFileName || ('ID-' + stayId + '.jpg'), idFileB64).run()
        } catch(e) { console.warn('ID doc store error:', e.message) }
      }
      if (publicBody.passportFileB64) {
        try {
          await DB.prepare(
            `INSERT OR REPLACE INTO guest_documents
             (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
             VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
          ).bind(docId('passport', stayId), stayId, 'passport', 'passport-' + stayId + '.jpg', publicBody.passportFileB64).run()
        } catch(e) { console.warn('Passport doc store error:', e.message) }
      }
      if (publicBody.visaFileB64) {
        try {
          await DB.prepare(
            `INSERT OR REPLACE INTO guest_documents
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
          `INSERT INTO processing_log (log_id, event_type, stay_id, note, created_at)
           VALUES (?, 'error', 'unknown', ?, datetime('now'))`
        ).bind('ERR-' + Date.now(), 'submitGuestCheckIn failed: ' + submitErr.message).run()
      } catch(logErr) {}
      return json({ success: false, error: 'Check-in submission failed: ' + submitErr.message }, 500)
    }
  }

  // RESOLVE CHECKIN LINK — public endpoint (no auth)
  if (action === 'resolveCheckinLink' && method === 'POST') {
    const rlBody = await request.json().catch(() => ({}))
    const { token: linkToken } = rlBody
    if (!linkToken) return err('token required')
    const link = await DB.prepare(
      `SELECT token, villa_id, partner, label, is_active FROM checkin_links WHERE token = ?`
    ).bind(linkToken).first()
    if (!link) return json({ success: false, error: 'Invalid link' }, 404)
    if (!link.is_active) return json({ success: false, error: 'Link deactivated' }, 403)
    await DB.prepare(`UPDATE checkin_links SET use_count = use_count + 1, updated_at = ? WHERE token = ?`).bind(new Date().toISOString().slice(0, 19).replace('T', ' '), linkToken).run()
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

  const ActiveDB = ESTATE_ACTIONS.has(action) ? DB_ESTATES : DB
  if (ESTATE_ACTIONS.has(action) && !DB_ESTATES) {
    return err('Estates DB not configured', 503)
  }

  try {
    // ── GET ROUTES ──────────────────────────────────────
    if (method === 'GET') {

      if (action === 'getTenantConfig') {
        const tenantId = url.searchParams.get('tenantId') || 'dwarka'
        const tenant = await DB.prepare(
          `SELECT tenant_id, villa_name, phone1, phone2, guest_contact,
                  address, checkin_time, checkout_time,
                  breakfast_rate, raman_comm_pct, logo_url, plan
           FROM tenants WHERE tenant_id = ? AND active = 1`
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
        }})
      }

      if (action === 'getStays') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results } = year === 'all'
          ? await DB.prepare(`SELECT * FROM stays WHERE villa_id = ? ORDER BY checkin_date DESC`).bind(villaId).all()
          : await DB.prepare(`SELECT * FROM stays WHERE villa_id = ? AND checkin_date LIKE ? ORDER BY checkin_date DESC`).bind(villaId, `${year}%`).all()
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
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, status, adults, nights
           FROM stays WHERE villa_id = ?
           AND status NOT IN ('confirmed','pending_review','checked_in','ready_for_checkout','cancelled')
           ORDER BY checkout_date DESC LIMIT 2`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getActiveStay') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const stay = await DB.prepare(
          `SELECT * FROM stays WHERE villa_id = ? AND status = 'checked_in' ORDER BY checkin_date DESC LIMIT 1`
        ).bind(villaId).first()
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
          `SELECT * FROM stays WHERE status = 'ready_for_checkin' ORDER BY checkin_date ASC`
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
           FROM stays WHERE status != 'cancelled'
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
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results: stays } = await DB.prepare(
          `SELECT * FROM stays WHERE villa_id = ? AND checkin_date LIKE ? AND status != 'cancelled'`
        ).bind(villaId, `${year}%`).all()

        const totalBookings  = stays.length
        const totalNights    = stays.reduce((s, r) => s + (r.nights || 0), 0)
        const grossRevenue   = stays.reduce((s, r) => s + (r.gross || 0), 0)
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
             FROM stay_incidentals WHERE strftime('%Y', created_at) = ? GROUP BY month`
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
            FROM stay_incidentals si
            LEFT JOIN inventory i ON i.item_id = si.inv_item_id
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
            SELECT COUNT(*) as c FROM inventory
            WHERE villa_id = ? AND preferred_stock > 0 AND qty_in_stock <= (preferred_stock * 0.1)
          `).bind(villaId).all()
          lowStockCount = lowStock?.[0]?.c || 0
        } catch(e) {}

        const months = {}
        for (let m = 1; m <= 12; m++) {
          const mStays  = stays.filter(s => new Date(s.checkin_date).getMonth() + 1 === m)
          const gross   = mStays.reduce((s, r) => s + (r.gross || 0), 0)
          const fees    = mStays.reduce((s, r) => s + (r.commission_amt || 0), 0)
          const net     = mStays.reduce((s, r) => s + (r.net || 0), 0)
          const kitchen   = kitchenByMonth[m]   || 0
          const direct    = mStays.filter(s => (s.source || '').toLowerCase() === 'direct').length

          months[m] = {
            bookings:  mStays.length,
            revenue:   gross,
            gross,
            fees,
            profit:    net,
            net,
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

        return json({ success: true, data: {
          totalBookings, totalNights, grossRevenue, totalNet, totalComm,
          totalDirect, byChannel, stays, months, quarterly,
          bestMonth, topChannel, directSaving, avgNights,
          kitchenSummary, lowStockCount
        }})
      }

      if (action === 'getRamanUnpaid') {
        const { results } = await DB.prepare(
          `SELECT rc.*, COALESCE(s.review_rating, 0) as review_rating
           FROM raman_commissions rc LEFT JOIN stays s ON s.stay_id = rc.stay_id
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
           FROM raman_commissions WHERE is_paid = 1 GROUP BY paid_date ORDER BY paid_date DESC`
        ).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRamanReport') {
        // Year/month reporting for owner — replaces flat history laundry-list.
        // Also detects "missed" guests: checked_out stays with NO matching
        // raman_commissions row (e.g. commission was never auto-created).
        const { results: paidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission, paid_date
           FROM raman_commissions WHERE is_paid = 1 ORDER BY checkin_date ASC`
        ).all()
        const { results: unpaidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission
           FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date ASC`
        ).all()
        const { results: missedRows } = await DB.prepare(
          `SELECT s.stay_id, s.guest_name, s.checkin_date, s.nights
           FROM stays s
           LEFT JOIN raman_commissions rc ON rc.stay_id = s.stay_id
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
           FROM raman_commissions WHERE is_paid = 1 GROUP BY year ORDER BY year DESC`
        ).all()
        const { results: unpaidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date ASC`
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
        let query = `SELECT * FROM rental_income WHERE year = ?`
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
          FROM rent_transactions
          WHERE substr(period_month, 1, 4) = ?
          GROUP BY prop_id, month
        `).bind(String(year)).all()
        const expenseRows = await DB.prepare(`
          SELECT prop_id, month, SUM(total_expense) as expense
          FROM property_expenses
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
        let query = `SELECT * FROM coconut_harvests`
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
        let query = `SELECT * FROM rubber_harvests WHERE estate_id = ?`
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
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(`SELECT * FROM inventory WHERE villa_id = ? ORDER BY category, name`).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getInventoryPrices') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(`SELECT item_id, cost_price, sell_price FROM inventory WHERE villa_id = ?`).bind(villaId).all()
        const prices = Object.fromEntries(results.map(r => [r.item_id, { costPrice: r.cost_price, sellPrice: r.sell_price }]))
        return json({ success: true, data: prices })
      }

      if (action === 'getRateCard') {
        // Per-night tariff by villa + billable guest count (1-12). Used by the
        // "Get pricing" button on the enquiry screen, and reusable later by a
        // guest-facing quick-pricing screen — same shape either way.
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(
          `SELECT guest_count, tariff_per_night FROM villa_rate_cards WHERE villa_id = ? ORDER BY guest_count`
        ).bind(villaId).all()
        const rateCard = results.map(r => ({ guests: r.guest_count, tariff: r.tariff_per_night }))
        return json({ success: true, data: { villaId, rateCard } })
      }

      if (action === 'getInventoryRestockLog') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const limit   = parseInt(url.searchParams.get('limit') || '50', 10)
        const { results } = await DB.prepare(
          `SELECT * FROM inventory_restock_log WHERE villa_id = ? ORDER BY created_at DESC LIMIT ?`
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
          total_stays:       `SELECT COUNT(*) as total FROM stays`,
          by_channel:        `SELECT source, COUNT(*) as bookings, ROUND(SUM(net),0) as total_net FROM stays WHERE status != 'cancelled' GROUP BY source ORDER BY total_net DESC`,
          by_year:           `SELECT strftime('%Y', checkin_date) as year, COUNT(*) as bookings, ROUND(SUM(gross),0) as gross, ROUND(SUM(net),0) as net FROM stays WHERE status != 'cancelled' GROUP BY year ORDER BY year DESC`,
          top_guests:        `SELECT guest_name, COUNT(*) as visits, ROUND(SUM(net),0) as total_spent FROM stays WHERE status != 'cancelled' GROUP BY guest_name HAVING visits > 1 ORDER BY visits DESC LIMIT 10`,
          recent_5:          `SELECT stay_id, guest_name, checkin_date, source, ROUND(net,0) as net, status FROM stays ORDER BY checkin_date DESC LIMIT 5`,
          raman_unpaid:      `SELECT guest_name, checkin_date, nights, commission FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date DESC`,
          raman_summary:     `SELECT is_paid, COUNT(*) as count, SUM(commission) as total FROM raman_commissions GROUP BY is_paid`,
          inventory_stock:   `SELECT name, category, qty_in_stock, sell_price FROM inventory WHERE villa_id = 'dwarka' ORDER BY category, name`,
          low_stock:         `SELECT name, qty_in_stock, sell_price FROM inventory WHERE villa_id = 'dwarka' AND qty_in_stock <= 3 ORDER BY qty_in_stock`,
          rental_ytd:        `SELECT prop_id, SUM(rent+car_parking) as income, SUM(maintenance+electricity+water+property_tax+land_tax) as expense, SUM(net) as net FROM rental_income WHERE year = strftime('%Y','now') GROUP BY prop_id`,
          direct_conversion: `SELECT source, COUNT(*) as bookings FROM stays WHERE status != 'cancelled' GROUP BY source`,
          avg_tariff_year:   `SELECT strftime('%Y', checkin_date) as year, ROUND(AVG(tariff_per_night),0) as avg_tariff, ROUND(AVG(nights),1) as avg_nights FROM stays WHERE status != 'cancelled' AND tariff_per_night > 0 GROUP BY year ORDER BY year DESC`,
        }
        const sql = PRESET_QUERIES[key]
        if (!sql) return err(`Unknown query key: ${key}`)
        const { results } = await DB.prepare(sql).all()
        return json({ success: true, data: results, sql })
      }

      if (action === 'getMarketingStats') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const statYear = url.searchParams.get('statYear') || null

        const cityQuery = statYear
          ? `SELECT COALESCE(NULLIF(from_city,''), NULLIF(city,''), 'Unknown') as city_name, COALESCE(NULLIF(state,''), '') as state_name, COALESCE(NULLIF(country,''), 'India') as country_name, COUNT(DISTINCT guest_name) as guest_count, COUNT(*) as booking_count, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stays WHERE villa_id = ? AND status NOT IN ('cancelled') AND checkin_date LIKE ? GROUP BY city_name, state_name, country_name ORDER BY guest_count DESC`
          : `SELECT COALESCE(NULLIF(from_city,''), NULLIF(city,''), 'Unknown') as city_name, COALESCE(NULLIF(state,''), '') as state_name, COALESCE(NULLIF(country,''), 'India') as country_name, COUNT(DISTINCT guest_name) as guest_count, COUNT(*) as booking_count, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stays WHERE villa_id = ? AND status NOT IN ('cancelled') GROUP BY city_name, state_name, country_name ORDER BY guest_count DESC`
        const cityBinds = statYear ? [villaId, `${statYear}%`] : [villaId]
        const { results: cityRows } = await DB.prepare(cityQuery).bind(...cityBinds).all()

        const { results: purposeRows } = await DB.prepare(
          `SELECT CASE WHEN LOWER(notes) LIKE '%wedding%' THEN 'Wedding' WHEN LOWER(notes) LIKE '%temple%' OR LOWER(notes) LIKE '%guruvayur%' THEN 'Temple / Pilgrimage' WHEN LOWER(notes) LIKE '%tourism%' OR LOWER(notes) LIKE '%holiday%' OR LOWER(notes) LIKE '%vacation%' THEN 'Tourism' WHEN LOWER(notes) LIKE '%family%' THEN 'Family Visit' WHEN LOWER(notes) LIKE '%arangettam%' THEN 'Arangettam' WHEN LOWER(notes) LIKE '%kerala%' THEN 'Kerala Tour' ELSE 'Other' END as purpose, COUNT(*) as bookings, COUNT(DISTINCT guest_name) as guests, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stays WHERE villa_id = ? AND status NOT IN ('cancelled') GROUP BY purpose ORDER BY bookings DESC`
        ).bind(villaId).all()

        const { results: channelRows } = await DB.prepare(
          `SELECT source as channel, COUNT(*) as bookings, COUNT(DISTINCT guest_name) as unique_guests, ROUND(SUM(COALESCE(gross,0)),0) as gross_revenue, ROUND(SUM(COALESCE(net,0)),0) as net_revenue, ROUND(SUM(COALESCE(commission_amt,0)),0) as total_commission FROM stays WHERE villa_id = ? AND status NOT IN ('cancelled') GROUP BY source ORDER BY net_revenue DESC`
        ).bind(villaId).all()

        const { results: staleRows } = await DB.prepare(
          `SELECT COUNT(*) as total, SUM(CASE WHEN from_city IS NULL OR from_city = '' THEN 1 ELSE 0 END) as missing_city, SUM(CASE WHEN state IS NULL OR state = '' THEN 1 ELSE 0 END) as missing_state, SUM(CASE WHEN country IS NULL OR country = '' THEN 1 ELSE 0 END) as missing_country, SUM(CASE WHEN guest_phone IS NULL OR guest_phone = '' THEN 1 ELSE 0 END) as missing_phone, SUM(CASE WHEN guest_email IS NULL OR guest_email = '' THEN 1 ELSE 0 END) as missing_email FROM stays WHERE status NOT IN ('cancelled')`
        ).all()

        const { results: monthRows } = await DB.prepare(
          `SELECT strftime('%Y', checkin_date) as year, strftime('%m', checkin_date) as month, COALESCE(NULLIF(state,''), COALESCE(NULLIF(country,''),'India')) as region, COUNT(DISTINCT guest_name) as guests, COUNT(*) as bookings, ROUND(SUM(COALESCE(net,0)),0) as revenue FROM stays WHERE villa_id = ? AND status NOT IN ('cancelled') AND from_city IS NOT NULL AND from_city != '' GROUP BY year, month, region ORDER BY year DESC, month ASC`
        ).bind(villaId).all()

        return json({ success: true, data: { cities: cityRows, purposes: purposeRows, channels: channelRows, stale: staleRows[0] || {}, monthlyByRegion: monthRows, statYear: statYear || 'all' } })
      }

      if (action === 'getOpenStays') {
        const { results } = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, drive_folder_id, drive_folder_url, status FROM stays WHERE status IN ('booked','confirmed','docs_uploaded') ORDER BY checkin_date ASC`).all()
        return json({ success: true, data: results.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkinDate: r.checkin_date, driveFolderId: r.drive_folder_id, driveFolderUrl: r.drive_folder_url, status: r.status })) })
      }

      if (action === 'findOpenStay') {
        const guestName   = url.searchParams.get('guestName')   || ''
        const checkInDate = url.searchParams.get('checkInDate')  || ''
        const firstName   = guestName.split(' ')[0]
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, children, guest_phone, guest_email, drive_folder_id, drive_folder_url, status, purpose_of_visit, mode_of_transport, vehicle_number, eta, nationality, city, state, country, request_early_checkin, request_late_checkout, request_breakfast, breakfast_choice, request_cab, govt_id_type, govt_id_num FROM stays WHERE guest_name LIKE ? AND status NOT IN ('cancelled','closed','checked_out') ORDER BY ABS(JULIANDAY(checkin_date) - JULIANDAY(?)) ASC LIMIT 1`
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
        const { results } = await DB.prepare(`SELECT stay_id, guest_name, checkout_date FROM stays WHERE guest_name LIKE ? AND checkout_date >= ? AND checkout_date <= ? AND status NOT IN ('cancelled') ORDER BY checkout_date DESC LIMIT 1`).bind(`%${guestName.split(' ')[0]}%`, windowStart.toISOString().slice(0,10), reviewDate).all()
        if (results.length > 0) return json({ success: true, data: { stayId: results[0].stay_id, guestName: results[0].guest_name }})
        return json({ success: true, data: null })
      }

      if (action === 'getRamanTodo') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results: overdueRows } = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, source, status FROM stays WHERE villa_id = ? AND status IN ('checked_in','ready_for_checkout','pending_review') AND checkout_date < date('now') ORDER BY checkout_date ASC`).bind(villaId).all()
        const { results: upcomingRows } = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, source, status FROM stays WHERE villa_id = ? AND status IN ('confirmed','booked','ready_for_checkin','pending_review') AND checkin_date >= date('now') AND checkin_date <= date('now', '+7 days') ORDER BY checkin_date ASC`).bind(villaId).all()
        return json({ success: true, data: {
          overdue: overdueRows.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkInDate: r.checkin_date, checkOutDate: r.checkout_date, nights: r.nights, adults: r.adults, source: r.source, status: r.status, daysOver: Math.floor((new Date() - new Date(r.checkout_date)) / 86400000) })),
          upcoming: upcomingRows.map(r => ({ stayId: r.stay_id, guestName: r.guest_name, checkInDate: r.checkin_date, checkOutDate: r.checkout_date, nights: r.nights, adults: r.adults, source: r.source, status: r.status, daysUntil: Math.floor((new Date(r.checkin_date) - new Date()) / 86400000) + 1 }))
        }})
      }

      if (action === 'getUpcomingStays') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
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
           FROM stays
           WHERE villa_id = ?
             AND status NOT IN ('closed','cancelled')
             AND (checkin_date >= date('now', '-1 day') OR status IN ('checked_in','ready_for_checkout'))
           ORDER BY checkin_date ASC`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRentalAgreements') {
        const { results } = await DB.prepare(`SELECT * FROM rental_props ORDER BY prop_id`).all()
        return json({ success: true, data: results })
      }

      if (action === 'getPropertyDetails') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const row = await DB.prepare(`SELECT * FROM property_details WHERE prop_id = ?`).bind(propId).first()
        return json({ success: true, data: row || null })
      }

      if (action === 'getHoaHistory') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM hoa_history WHERE prop_id = ? ORDER BY effective_date DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getTaxHistory') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM tax_history WHERE prop_id = ? ORDER BY tax_year DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getPropertyDocs') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM property_documents WHERE prop_id = ? ORDER BY category, created_at DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getLeaseLosses') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM lease_losses WHERE prop_id = ? ORDER BY created_at DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getRev360Dashboard') {
        const year = new Date().getFullYear()
        const props = await DB.prepare(`SELECT * FROM rental_props ORDER BY prop_id`).all()
        // Income: rent_transactions (base_rent + maintenance + car_parking + late_fee,
        // i.e. total_due) is the new source of truth, replacing rental_income's
        // combined rent+car_parking column -- rental_income can't represent a
        // late fee or an actual payment date, which is the whole reason this
        // table exists. rental_income itself is left untouched, just no longer
        // read here.
        const rentIncome = await DB.prepare(`
          SELECT prop_id, SUM(total_due) as income, COUNT(*) as months_entered
          FROM rent_transactions
          WHERE substr(period_month, 1, 4) = ?
          GROUP BY prop_id
        `).bind(String(year)).all()
        // Expenses: property_expenses replaces rental_income's expense
        // columns (electricity/water/property_tax/land_tax/extra_maintenance).
        const propExpense = await DB.prepare(`
          SELECT prop_id, SUM(total_expense) as expense
          FROM property_expenses
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
        const losses = await DB.prepare(`SELECT prop_id, SUM(amount) as total_claimed, SUM(CASE WHEN status='Unrecoverable' THEN amount ELSE 0 END) as total_written_off, SUM(CASE WHEN status='Recovered' THEN amount ELSE 0 END) as total_recovered, COUNT(*) as claim_count FROM lease_losses GROUP BY prop_id`).all()
        const renewalAlerts = await DB.prepare(`SELECT prop_id, name, tenant_name, lease_end, status, CAST((julianday(lease_end) - julianday('now')) AS INTEGER) as days_left FROM rental_props WHERE lease_end IS NOT NULL AND lease_end != '' AND julianday(lease_end) - julianday('now') <= 90 ORDER BY lease_end ASC`).all()
        return json({ success: true, data: { year, properties: props.results, income, losses: losses.results, renewalAlerts: renewalAlerts.results } })
      }

      if (action === 'getGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        const { results } = await DB.prepare(`SELECT doc_id, stay_id, doc_type, file_name, file_b64 FROM guest_documents WHERE stay_id = ? AND folder_created = 0`).bind(stayId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getDuplicateBookings') {
        const months = parseInt(url.searchParams.get('months') || '2')
        const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
        const { results } = await DB.prepare(`SELECT * FROM duplicate_bookings WHERE detected_at >= ? ORDER BY detected_at DESC`).bind(cutoff.toISOString().slice(0,10)).all()
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
            `SELECT harvest_date, price_per_kg, scheduled_harvest_date FROM coconut_harvests WHERE estate_id = ? ORDER BY harvest_date DESC LIMIT 1`
          ).bind(estateId).first()

          const irrigation = await ActiveDB.prepare(
            `SELECT logged_date FROM irrigation_logs WHERE estate = ? ORDER BY logged_date DESC LIMIT 1`
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
          `SELECT harvest_date, price_per_kg FROM rubber_harvests WHERE estate_id = ? ORDER BY harvest_date DESC LIMIT 1`
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
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(`SELECT c.id, c.campaign_name, c.unique_token, c.channel, c.is_active, c.notes, c.created_at, SUM(CASE WHEN a.event_type='click' THEN 1 ELSE 0 END) as clicks, SUM(CASE WHEN a.event_type='inquiry' THEN 1 ELSE 0 END) as inquiries, SUM(CASE WHEN a.event_type='booking' THEN 1 ELSE 0 END) as bookings FROM marketing_campaigns c LEFT JOIN campaign_analytics a ON a.campaign_id = c.id WHERE c.villa_id = ? GROUP BY c.id ORDER BY c.created_at DESC`).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getCampaignAnalytics') {
        const campaignId = url.searchParams.get('campaignId') || ''
        if (!campaignId) return err('campaignId required')
        const events = await DB.prepare(`SELECT event_type, country, region, city, strftime('%H', ts) as hour, DATE(ts) as day, COUNT(*) as n FROM campaign_analytics WHERE campaign_id = ? GROUP BY event_type, country, region, city, hour, day ORDER BY day DESC, hour DESC`).bind(campaignId).all()
        return json({ success: true, data: events.results })
      }

      // IRRIGATION ZONE HEALTH DASHBOARD (Cleaned to exclude non-existent column fields)
      if (action === 'getIrrigationZoneHealth') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        const today    = new Date().toISOString().slice(0, 10)

        let zones = []
        try {
          const { results } = await ActiveDB.prepare(
            `SELECT * FROM irrigation_zones WHERE estate = ? AND active = 1 ORDER BY sort_order ASC`
          ).bind(estateId).all()
          zones = results
        } catch(e) { return json({ success: true, data: { zones: [], lastRun: null } }) }

        if (zones.length === 0) return json({ success: true, data: { zones: [], lastRun: null } })

        const zoneHealth = await Promise.all(zones.map(async (z) => {
          const { results: logs } = await ActiveDB.prepare(
            `SELECT logged_date FROM irrigation_logs WHERE estate = ? AND zone_id = ? ORDER BY logged_date DESC LIMIT 5`
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

        const lastRun = await ActiveDB.prepare(`SELECT MAX(logged_date) as last FROM irrigation_logs WHERE estate = ?`).bind(estateId).first()
        return json({ success: true, data: { zones: zoneHealth, lastRun: lastRun?.last || null } })
      }

      // IRRIGATION HISTORY — full log list
      if (action === 'getIrrigationHistory') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        const { results } = await ActiveDB.prepare(`SELECT * FROM irrigation_logs WHERE estate = ? ORDER BY logged_date DESC LIMIT 200`).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // MANGO HARVESTS — list
      if (action === 'getMangoHarvests') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        const { results } = await ActiveDB.prepare(`SELECT * FROM mango_harvests WHERE estate = ? ORDER BY harvest_date DESC`).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // ESTATE LEDGER TRANSACTIONS — full history list (Income/Expense tab)
      if (action === 'getEstateTransactions') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        const { results } = await ActiveDB.prepare(
          `SELECT txn_id, estate, type, date, category, amount, paid_to, description, created_at
           FROM estate_transactions WHERE estate = ? ORDER BY date DESC, created_at DESC LIMIT 500`
        ).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // ESTATE CONTACTS
      if (action === 'getEstateContacts') {
        const estateId = url.searchParams.get('estate') || 'pollachi'
        const { results } = await ActiveDB.prepare(`SELECT * FROM estate_contacts WHERE estate = ? AND active = 1 ORDER BY category, name`).bind(estateId).all()
        return json({ success: true, data: results })
      }

      // ESTATE HIGHLIGHTS — Operational Summary Dashboard
      if (action === 'getEstateHighlights') {
        const estateId  = url.searchParams.get('estate') || 'pollachi'
        const cutoff    = new Date(); cutoff.setMonth(cutoff.getMonth() - 12)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        const today     = new Date().toISOString().slice(0, 10)

        const { results: harvests } = await ActiveDB.prepare(
          `SELECT harvest_date, scheduled_harvest_date, total_nuts, total_weight_kg, harvester_name FROM coconut_harvests WHERE estate_id = ? AND harvest_date >= ? ORDER BY harvest_date DESC`
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
          `SELECT logged_date, strftime('%Y-%m', logged_date) as ym, COUNT(*) as count FROM irrigation_logs WHERE estate = ? AND logged_date >= ? GROUP BY ym ORDER BY ym DESC`
        ).bind(estateId, cutoffStr).all()

        const lastIrrigation = await ActiveDB.prepare(`SELECT logged_date FROM irrigation_logs WHERE estate = ? ORDER BY logged_date DESC LIMIT 1`).bind(estateId).first()

        let lastFert = null, nextFert = null
        try {
          const { results: fertilizations } = await ActiveDB.prepare(
            `SELECT planned_date, actual_date, fertilizer_type, notes FROM fertilization_log WHERE estate = ? ORDER BY planned_date DESC`
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
             FROM mango_harvests WHERE estate = ?
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
        if (payload.role !== 'owner') return err('Owner access only', 403)
        const estateId = url.searchParams.get('estate') || 'pollachi'
        const today = new Date()
        const curYear = today.getFullYear()
        const cutoffStr = `${curYear}-01-01`            // calendar year-to-date
        const todayStr  = today.toISOString().slice(0, 10)

        const { results: harvests } = await ActiveDB.prepare(
          `SELECT harvest_date, total_earnings, total_expense, net_income, harvest_expense, dehusk_expense, tractor_expense, other_expense FROM coconut_harvests WHERE estate_id = ? AND harvest_date >= ? ORDER BY harvest_date DESC`
        ).bind(estateId, cutoffStr).all()

        const { results: txns } = await ActiveDB.prepare(
          `SELECT date, type, category, amount, paid_to, description FROM estate_transactions WHERE estate = ? AND date >= ? ORDER BY date DESC`
        ).bind(estateId, cutoffStr).all()

        let mangoRevenue = 0
        try {
          const mangoData = await ActiveDB.prepare(`SELECT SUM(total_revenue) as total FROM mango_harvests WHERE estate = ? AND harvest_date >= ?`).bind(estateId, cutoffStr).first()
          mangoRevenue = mangoData?.total || 0
        } catch(e) {}

        let rubberHarvests = []
        try {
          const { results: rh } = await ActiveDB.prepare(
            `SELECT harvest_date, gross, expense, net FROM rubber_harvests WHERE estate_id = ? AND harvest_date >= ? ORDER BY harvest_date DESC`
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
        const { results } = await DB.prepare(`SELECT token, villa_id, partner, label, is_active, use_count, created_at FROM checkin_links ORDER BY villa_id, partner`).all()
        return json({ success: true, data: results })
      }


      // PENDING REVIEW STAYS — GET version (also available as POST)
      if (action === 'getPendingReviewStays') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights,
                  guest_phone, guest_email, drive_folder_url, created_at,
                  folder_created, folder_created_at, booked_by_name
           FROM stays
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
           FROM stays
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
           FROM guest_documents WHERE stay_id = ?`
        ).bind(stayId).all()
        return json({ success: true, data: results })
      }

      // DELETE GUEST DOCUMENTS — called by Apps Script after uploading to Drive
      // Deletes ALL docs for the stay (regardless of folder_created) since upload is confirmed
      if (action === 'deleteGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        const result = await DB.prepare(
          `DELETE FROM guest_documents WHERE stay_id = ?`
        ).bind(stayId).run()
        return json({ success: true, data: { stayId, deleted: result.meta?.changes || 0 } })
      }

      // ════════════════ GUEST ENQUIRY MANAGEMENT (CRM) — GET ═══════════════

      // List enquiries for the tracker grid (optionally filtered by status)
      if (action === 'getEnquiries') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const status  = url.searchParams.get('status') || ''
        const { results } = await DB.prepare(
          status
            ? `SELECT * FROM enquiries WHERE villa_id = ? AND status = ? ORDER BY date_received DESC`
            : `SELECT * FROM enquiries WHERE villa_id = ? ORDER BY date_received DESC`
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
          FROM enquiries
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
        const enquiry = await DB.prepare(`SELECT * FROM enquiries WHERE enquiry_id = ?`).bind(enquiryId).first()
        if (!enquiry) return err('Enquiry not found', 404)
        const { results: timeline } = await DB.prepare(
          `SELECT * FROM communication_log WHERE enquiry_id = ? ORDER BY occurred_at ASC`
        ).bind(enquiryId).all()
        let guest = null
        if (enquiry.guest_id) {
          guest = await DB.prepare(`SELECT * FROM guests WHERE guest_id = ?`).bind(enquiry.guest_id).first()
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
          `SELECT * FROM guests WHERE (phone = ? AND phone != '') OR (email = ? AND email != '') LIMIT 1`
        ).bind(phoneRaw, emailRaw).first()
        if (!guest) return json({ success: true, data: null })
        const { results: pastStays } = await DB.prepare(
          `SELECT stay_id, checkin_date, checkout_date, net, source FROM stays
           WHERE (guest_phone = ? OR guest_email = ?) AND status != 'cancelled'
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
          `SELECT guest_id, name, phone, email, total_stays FROM guests
           WHERE name LIKE ? ORDER BY total_stays DESC LIMIT 15`
        ).bind(`%${q}%`).all()
        return json({ success: true, data: results })
      }

      // Conversion dashboard — KPIs, source breakdown, repeat-guest metrics
      if (action === 'getEnquiryDashboard') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results: rows } = await DB.prepare(
          `SELECT * FROM enquiries WHERE villa_id = ? AND date_received LIKE ?`
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
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(`
          SELECT * FROM enquiries
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
        const { results } = await DB.prepare(`SELECT * FROM tenancy_history WHERE prop_id = ? ORDER BY lease_end DESC`).bind(propId).all()
        return json({ success: true, data: results })
      }

      // RENT LEDGER read — backs the Quick-Post Billing component on the
      // Tenant Agreement screen. The matching write actions
      // (postRentPayment) are in the POST block below.
      if (action === 'getRentTransactions') {
        const propId = url.searchParams.get('propId') || ''
        if (!propId) return err('propId required')
        const { results } = await DB.prepare(`SELECT * FROM rent_transactions WHERE prop_id = ? ORDER BY period_month DESC`).bind(propId).all()
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
        const row = await DB.prepare(`SELECT * FROM incoming_tenants WHERE prop_id = ?`).bind(propId).first()
        return json({ success: true, data: row || null })
      }

      // PROPERTY EXPENSES read — backs the Expenses block on the Monthly
      // Tracker screen. The matching write (savePropertyExpense) is in
      // the POST block below.
      if (action === 'getPropertyExpenses') {
        const propId = url.searchParams.get('propId') || ''
        const year = url.searchParams.get('year') || ''
        if (!propId || !year) return err('propId and year required')
        const { results } = await DB.prepare(`SELECT * FROM property_expenses WHERE prop_id = ? AND year = ? ORDER BY month ASC`).bind(propId, parseInt(year)).all()
        return json({ success: true, data: results })
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
        const villaId = body.villaId || 'dwarka'
        const normPhone = (body.phone || '').replace(/[\s\-]/g, '').replace(/^\+?91/, '')
        const normEmail = (body.email || '').trim().toLowerCase()

        let enquiryId = body.enquiryId
        let guestId = body.guestId || null

        // New enquiry — match or create the guest record
        if (!enquiryId) {
          enquiryId = genId('ENQ')
          if (normPhone || normEmail) {
            const existing = await DB.prepare(
              `SELECT * FROM guests WHERE (phone = ? AND phone != '') OR (email = ? AND email != '') LIMIT 1`
            ).bind(normPhone, normEmail).first()
            if (existing) {
              guestId = existing.guest_id
              await DB.prepare(`UPDATE guests SET last_seen_at = ?, updated_by = ?, updated_at = ? WHERE guest_id = ?`)
                .bind(now(), actor, now(), guestId).run()
            } else {
              guestId = genId('GST')
              await DB.prepare(`
                INSERT INTO guests (guest_id, name, phone, email, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(guestId, body.guestName || 'Unknown', normPhone, normEmail, actor, actor).run()
            }
          }
        }

        const guest = guestId ? await DB.prepare(`SELECT * FROM guests WHERE guest_id = ?`).bind(guestId).first() : null
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
        const finalOffer = quoteAmount - discountAmount

        if (body.enquiryId) {
          // Update existing
          await DB.prepare(`
            UPDATE enquiries SET
              guest_name = ?, phone = ?, email = ?, source = ?,
              checkin_date = ?, checkout_date = ?, nights = ?, guests_count = ?,
              adults = ?, children = ?, infants = ?, purpose = ?,
              quote_amount = ?, repeat_discount_pct = ?, discount_category = ?, discount_pct = ?,
              discount_amount = ?, final_offer_amount = ?,
              status = ?, last_contact_date = ?, follow_up_due = ?,
              lost_reason = ?, assigned_to = ?, notes = ?,
              updated_by = ?, updated_at = ?
            WHERE enquiry_id = ?
          `).bind(
            body.guestName, normPhone, normEmail, body.source || 'website',
            body.checkInDate || null, body.checkOutDate || null, nights, guestsCount,
            adults, children, infants, body.purpose || null,
            quoteAmount, discountPct, discountCategory, categoryDiscountPct,
            discountAmount, finalOffer,
            body.status || 'new', body.lastContactDate || null, body.followUpDue || null,
            body.lostReason || null, body.assignedTo || 'owner', body.notes || null,
            actor, now(), body.enquiryId
          ).run()
          return json({ success: true, data: { enquiryId: body.enquiryId, isRepeatGuest: isRepeat, previousStays } })
        }

        await DB.prepare(`
          INSERT INTO enquiries (
            enquiry_id, villa_id, guest_id, guest_name, phone, email, source,
            checkin_date, checkout_date, nights, guests_count, adults, children, infants, purpose,
            quote_amount, is_repeat_guest, previous_stays, repeat_discount_pct,
            discount_category, discount_pct, discount_amount, final_offer_amount,
            status, assigned_to, notes, created_by, updated_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          enquiryId, villaId, guestId, body.guestName || 'Unknown', normPhone, normEmail, body.source || 'website',
          body.checkInDate || null, body.checkOutDate || null, nights, guestsCount, adults, children, infants, body.purpose || null,
          quoteAmount, isRepeat ? 1 : 0, previousStays, discountPct,
          discountCategory, categoryDiscountPct, discountAmount, finalOffer,
          body.status || 'new', body.assignedTo || 'owner', body.notes || null, actor, actor
        ).run()

        // First entry in the communication timeline
        await DB.prepare(`
          INSERT INTO communication_log (comm_id, enquiry_id, type, notes, created_by)
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
          INSERT INTO communication_log (comm_id, enquiry_id, type, notes, created_by)
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

        await DB.prepare(`UPDATE enquiries SET ${updates.join(', ')} WHERE enquiry_id = ?`)
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
        await DB.prepare(`UPDATE enquiries SET ${col} = ? WHERE enquiry_id = ?`).bind(now(), enquiryId).run()
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
          INSERT INTO processing_log (log_id, event_type, stay_id, note, created_at)
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
          UPDATE enquiries SET status = 'lost', lost_reason = ?, updated_by = ?, updated_at = ? WHERE enquiry_id = ?
        `).bind(body.lostReason || 'other', actor, now(), enquiryId).run()
        await DB.prepare(`
          INSERT INTO communication_log (comm_id, enquiry_id, type, notes, created_by)
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
        const enquiry = await DB.prepare(`SELECT * FROM enquiries WHERE enquiry_id = ?`).bind(enquiryId).first()
        if (!enquiry) return err('Enquiry not found', 404)
        if (!enquiry.checkin_date || !enquiry.checkout_date) return err('Enquiry is missing check-in/check-out dates')

        const villaId = enquiry.villa_id || 'dwarka'
        const bookingValue = parseFloat(body.bookingValue) || enquiry.final_offer_amount || enquiry.quote_amount || 0

        // Respect the same overlap protection used by createBooking — refuse
        // to silently double-book the villa.
        const conflict = await DB.prepare(`
          SELECT stay_id, guest_name, checkin_date, checkout_date FROM stays
          WHERE villa_id = ? AND status NOT IN ('cancelled','closed','checked_out')
            AND checkin_date < ? AND checkout_date > ? LIMIT 1
        `).bind(villaId, enquiry.checkout_date, enquiry.checkin_date).first()
        if (conflict) {
          return json({ success: false, error: `Villa already booked ${conflict.checkin_date} → ${conflict.checkout_date} (${conflict.guest_name})`, conflict }, 409)
        }

        const stayId = genStayId(villaId)
        await DB.prepare(`
          INSERT INTO stays (
            stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, children,
            gross, net, status, created_by, updated_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?)
        `).bind(
          stayId, villaId, enquiry.source || 'direct', enquiry.guest_name, enquiry.phone, enquiry.email,
          enquiry.checkin_date, enquiry.checkout_date, enquiry.nights || 1, enquiry.guests_count || 1, 0,
          bookingValue, bookingValue, actor, actor
        ).run()

        const bookingId = genId('BKG')
        await DB.prepare(`
          INSERT INTO bookings (booking_id, enquiry_id, guest_id, stay_id, booking_value, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(bookingId, enquiryId, enquiry.guest_id, stayId, bookingValue, actor).run()

        await DB.prepare(`
          UPDATE enquiries SET status = 'confirmed', booking_confirmed = 1, booking_value = ?, updated_by = ?, updated_at = ? WHERE enquiry_id = ?
        `).bind(bookingValue, actor, now(), enquiryId).run()

        if (enquiry.guest_id) {
          await DB.prepare(`
            UPDATE guests SET
              total_stays = total_stays + 1,
              total_nights = total_nights + ?,
              total_revenue = total_revenue + ?,
              last_seen_at = ?, updated_by = ?, updated_at = ?
            WHERE guest_id = ?
          `).bind(enquiry.nights || 1, bookingValue, now(), actor, now(), enquiry.guest_id).run()
        }

        await DB.prepare(`
          INSERT INTO communication_log (comm_id, enquiry_id, type, notes, created_by)
          VALUES (?, ?, 'status_change', ?, ?)
        `).bind(genId('COMM'), enquiryId, `Booking confirmed — stay ${stayId}`, actor).run()

        return json({ success: true, data: { stayId, bookingId } })
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
            `UPDATE raman_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ?
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
            `UPDATE raman_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ?
             WHERE checkin_date BETWEEN ? AND ? AND is_paid = 0`
          ).bind(paidDate, actor, now(), startDate, endDate).run()
          return json({ success: true, data: { changes: result.meta?.changes ?? 0 } })
        }

        // Shape 3: pay all unpaid
        const result = await DB.prepare(
          `UPDATE raman_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ? WHERE is_paid = 0`
        ).bind(paidDate, actor, now()).run()
        return json({ success: true, data: { changes: result.meta?.changes ?? 0 } })
      }

      if (action === 'createBooking') {
        const stayId = genStayId(body.villaId)
        const nights = parseInt(body.nights) || 1

        const firstName = (body.guestName || body.bookerName || '').split(' ')[0]
        const provisional = await DB.prepare(`SELECT stay_id, status FROM stays WHERE guest_name LIKE ? AND checkin_date = ? AND villa_id = ? AND status NOT IN ('cancelled','closed','checked_out') LIMIT 1`).bind(`%${firstName}%`, body.checkInDate, body.villaId || 'dwarka').first()

        if (provisional) {
          await DB.prepare(`UPDATE stays SET source = 'airbnb', airbnb_conf = ?, gross = ?, commission_pct = ?, commission_amt = ?, net = ?, night_fee = ?, cleaning_fee = ?, host_service_fee = ?, you_earn = ?, guest_service_fee = ?, guest_paid_total = ?, checkout_date = COALESCE(NULLIF(checkout_date,''), ?), nights = COALESCE(NULLIF(nights,0), ?), adults = COALESCE(NULLIF(adults,0), ?), updated_by = ?, updated_at = datetime('now') WHERE stay_id = ?`).bind(body.airbnbConf || null, body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0, body.nightFee || 0, body.cleaningFee || 0, body.hostServiceFee || 0, body.youEarn || body.net || 0, body.guestServiceFee || 0, body.guestPaid || 0, body.checkOutDate || null, parseInt(body.nights) || 1, body.adults || 1, actor, provisional.stay_id).run()
          return json({ success: true, data: { stayId: provisional.stay_id, merged: true, wasStatus: provisional.status } })
        }

        const conflict = await DB.prepare(`SELECT stay_id, guest_name, checkin_date, checkout_date, status, source, created_at FROM stays WHERE villa_id = ? AND status NOT IN ('cancelled','closed','checked_out') AND checkin_date < ? AND checkout_date > ? LIMIT 1`).bind(body.villaId || 'dwarka', body.checkOutDate, body.checkInDate).first()

        if (conflict) {
          const alertSubject = '🚨 URGENT — Double booking detected! ' + (body.checkInDate || '')
          const alertBody = ['🚨 DOUBLE BOOKING DETECTED — IMMEDIATE ACTION REQUIRED', '='.repeat(60), '', 'A new booking was BLOCKED because the villa is already booked overlapping.', '', `EXISTING: ${conflict.stay_id} | ${conflict.guest_name} | ${conflict.checkin_date} -> ${conflict.checkout_date}`, `NEW ATTEMPT: ${body.guestName} | ${body.checkInDate} -> ${body.checkOutDate}`].join('\n')
          try {
            await fetch('https://api.mailchannels.net/tx/v1/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: env.OWNER_EMAIL || 'kerala.luxuryvillas@gmail.com' }], cc: [{ email: 'bijisukumar@gmail.com' }] }], from: { email: 'alerts@bgindia-portal.com', name: 'bgIndia Portal — URGENT' }, subject: alertSubject, content: [{ type: 'text/plain', value: alertBody }] }) })
          } catch(emailErr) {}

          try {
            const overlapNights = body.checkInDate && body.checkOutDate ? Math.max(0, Math.round((Math.min(new Date(conflict.checkout_date), new Date(body.checkOutDate)) - Math.max(new Date(conflict.checkin_date), new Date(body.checkInDate))) / 86400000)) : 0
            await DB.prepare(`INSERT INTO duplicate_bookings (dup_id, villa_id, detected_at, existing_stay_id, existing_guest, existing_checkin, existing_checkout, existing_source, existing_booked_at, new_guest, new_checkin, new_checkout, new_source, new_airbnb_conf, overlap_nights) VALUES (?,?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`DUP-${Date.now()}`, body.villaId || 'dwarka', conflict.stay_id, conflict.guest_name, conflict.checkin_date, conflict.checkout_date, conflict.source || 'unknown', conflict.created_at || null, body.guestName || 'unknown', body.checkInDate, body.checkOutDate, body.source || 'unknown', body.airbnbConf || null, overlapNights).run()
          } catch(logErr) {}

          return json({ success: false, error: `Double booking detected: ${conflict.guest_name} is already booked`, conflict }, 409)
        }

        await DB.prepare(`INSERT INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, adults, children, tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status, home_address, city, state, country, from_city, night_fee, cleaning_fee, host_service_fee, you_earn, guest_service_fee, guest_paid_total, airbnb_conf, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(stayId, body.villaId || 'dwarka', body.source || 'direct', body.guestName || body.bookerName, body.guestPhone || null, body.guestEmail || null, body.checkInDate, body.checkOutDate, nights, body.adults || 1, body.children || 0, (body.tariffPerNight || (body.nightFee && body.nights ? Math.round((body.nightFee / body.nights) * 100) / 100 : 0)), body.extraCharges || 0, body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0, 'confirmed', body.homeAddress || null, body.city || null, body.state || null, body.country || 'India', body.fromCity || body.city || null, body.nightFee || 0, body.cleaningFee || 0, body.hostServiceFee || 0, body.youEarn || body.net || 0, body.guestServiceFee || 0, body.guestPaid || 0, body.airbnbConf || null, actor, actor).run()
        return json({ success: true, data: { stayId } })
      }

      if (action === 'confirmCheckIn') {
        let stayId = body.stayId
        if (!stayId) {
          const found = await DB.prepare(`SELECT stay_id FROM stays WHERE guest_name = ? AND status IN ('confirmed','booked') ORDER BY checkin_date DESC LIMIT 1`).bind(body.guestName || body.bookerName).first()
          stayId = found?.stay_id
        }
        if (!stayId) {
          stayId = genStayId(body.villaId || 'dwarka')
          await DB.prepare(`INSERT INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, adults, children, gross, net, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,'checked_in',?,?,?,?)`).bind(stayId, body.villaId || 'dwarka', 'direct', body.guestName || body.bookerName, body.phone || null, body.email || null, body.checkInDate, body.checkOutDate, Math.max(1, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000)), body.adultsCount || 1, body.childrenCount || 0, actor, actor, now(), now()).run()
        } else {
          await DB.prepare(`UPDATE stays SET status = 'checked_in', updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(actor, now(), stayId).run()
        }
        return json({ success: true, data: { stayId } })
      }

      if (action === 'checkOut') {
        const { stayId } = body
        await DB.prepare(`UPDATE stays SET status = 'checked_out', updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(actor, now(), stayId).run()
        const stay = await DB.prepare(`SELECT guest_name, checkin_date, nights FROM stays WHERE stay_id = ?`).bind(stayId).first()
        if (stay) {
          const existing = await DB.prepare(`SELECT comm_id FROM raman_commissions WHERE stay_id = ?`).bind(stayId).first()
          if (!existing) {
            const nights = parseInt(stay.nights) || 1; const ramanComm = nights > 1 ? 2000 : 1000
            await DB.prepare(`INSERT INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 'system', 'system', ?, ?)`).bind(genId('RC'), stayId, stay.guest_name, stay.checkin_date, nights, ramanComm, now(), now()).run()
            return json({ success: true, data: { stayId, ramanComm, commissionCreated: true } })
          }
        }
        return json({ success: true, data: { stayId, commissionCreated: false } })
      }

      if (action === 'cancelStay') {
        await DB.prepare(`UPDATE stays SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(actor, now(), body.stayId).run()
        await DB.prepare(`DELETE FROM raman_commissions WHERE stay_id = ? AND is_paid = 0`).bind(body.stayId).run()
        return json({ success: true })
      }

      // INVENTORY — save cost/sell prices (Prices tab)
      if (action === 'saveInventoryPrices') {
        const villaId = body.villaId || 'dwarka'
        const prices  = body.prices || {}
        for (const [itemId, p] of Object.entries(prices)) {
          const costPrice = parseFloat(p.costPrice) || 0
          const sellPrice = parseFloat(p.sellPrice) || 0
          const result = await DB.prepare(`
            UPDATE inventory
            SET cost_price = ?, sell_price = ?, updated_by = ?, updated_at = ?
            WHERE item_id = ? AND villa_id = ?
          `).bind(costPrice, sellPrice, actor, now(), itemId, villaId).run()
          if (!result.meta?.changes) {
            await DB.prepare(`
              INSERT INTO inventory (item_id, villa_id, name, cost_price, sell_price, created_by, updated_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(itemId, villaId, p.name || itemId, costPrice, sellPrice, actor, actor, now(), now()).run()
          }
        }
        return json({ success: true })
      }

      // INVENTORY — record a restock (Restock tab): logs the purchase + bumps qty_in_stock
      if (action === 'saveInventoryRestock') {
        const villaId = body.villaId || 'dwarka'
        const entries = body.entries || []
        if (!entries.length) return err('entries required')
        for (const e of entries) {
          const qty       = parseFloat(e.qty) || 0
          const totalCost = parseFloat(e.totalCost) || 0
          if (qty <= 0) continue
          const pricePerUnit = qty > 0 ? totalCost / qty : 0

          await DB.prepare(`
            INSERT INTO inventory_restock_log
              (id, villa_id, item_id, item_name, qty_bought, total_cost, price_per_unit, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(genId('RSTK'), villaId, e.id, e.name || e.id, qty, totalCost, pricePerUnit, actor, now()).run()

          const result = await DB.prepare(`
            UPDATE inventory
            SET qty_in_stock = COALESCE(qty_in_stock, 0) + ?,
                last_restocked = ?,
                updated_by = ?, updated_at = ?
            WHERE item_id = ? AND villa_id = ?
          `).bind(qty, now(), actor, now(), e.id, villaId).run()
          if (!result.meta?.changes) {
            await DB.prepare(`
              INSERT INTO inventory (item_id, villa_id, name, qty_in_stock, last_restocked, created_by, updated_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(e.id, villaId, e.name || e.id, qty, now(), actor, actor, now(), now()).run()
          }
        }
        return json({ success: true })
      }

      // INVENTORY — direct stock quantity correction (Stock tab +/- and manual edit)
      if (action === 'saveInventoryStock') {
        const villaId = body.villaId || 'dwarka'
        const stock   = body.stock || {}
        for (const [itemId, s] of Object.entries(stock)) {
          const qty = parseFloat(s.qty) || 0
          const result = await DB.prepare(`
            UPDATE inventory
            SET qty_in_stock = ?, updated_by = ?, updated_at = ?
            WHERE item_id = ? AND villa_id = ?
          `).bind(qty, actor, now(), itemId, villaId).run()
          if (!result.meta?.changes) {
            await DB.prepare(`
              INSERT INTO inventory (item_id, villa_id, name, qty_in_stock, created_by, updated_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(itemId, villaId, s.name || itemId, qty, actor, actor, now(), now()).run()
          }
        }
        return json({ success: true })
      }

      // INVENTORY — set preferred (target) stock levels per item; used to flag low stock
      if (action === 'saveInventoryPreferredStock') {
        const villaId = body.villaId || 'dwarka'
        const levels  = body.levels || {}
        for (const [itemId, val] of Object.entries(levels)) {
          const preferred = Math.max(0, parseInt(val, 10) || 0)
          const result = await DB.prepare(`
            UPDATE inventory
            SET preferred_stock = ?, updated_by = ?, updated_at = ?
            WHERE item_id = ? AND villa_id = ?
          `).bind(preferred, actor, now(), itemId, villaId).run()
          if (!result.meta?.changes) {
            await DB.prepare(`
              INSERT INTO inventory (item_id, villa_id, name, preferred_stock, created_by, updated_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(itemId, villaId, itemId, preferred, actor, actor, now(), now()).run()
          }
        }
        return json({ success: true })
      }

      // INVENTORY — low-stock items (qty_in_stock <= 10% of preferred_stock), for dashboard alerts
      if (action === 'getLowStockItems') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(`
          SELECT item_id, name, unit, category, qty_in_stock, preferred_stock
          FROM inventory
          WHERE villa_id = ? AND preferred_stock > 0 AND qty_in_stock <= (preferred_stock * 0.1)
          ORDER BY (CAST(qty_in_stock AS REAL) / preferred_stock) ASC
        `).bind(villaId).all()
        return json({ success: true, data: results })
      }

     if (action === 'saveKitchenEntry') {
        const items = body.items || [];
        const villaId = body.villaId || 'dwarka';
        
        // SAFE CONTEXT INTIATION — Guarantee fallback tokens exist
        const currentActor = typeof actor !== 'undefined' ? actor : 'raman';
        const timestamp = typeof now === 'function' ? now() : new Date().toISOString();

        const lowStockAlerts = [];

        for (const item of items) {
          await DB.prepare(
            `INSERT INTO stay_incidentals (
              item_id, stay_id, inv_item_id, name, qty, price_per_unit, total, created_by, updated_by, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(
            genId('INC'), 
            body.stayId, 
            item.itemId || item.inv_item_id || null, 
            item.name, 
            Number(item.qty) || 1, 
            Number(item.pricePerUnit) || Number(item.price) || 0, 
            Number(item.subtotal) || Number(item.total) || 0, 
            currentActor, 
            currentActor, 
            timestamp, 
            timestamp
          ).run();

          // Decrement live stock — skip ad-hoc/custom items, they have no inventory row.
          const invItemId = item.itemId || item.inv_item_id || null
          if (invItemId && invItemId !== 'custom') {
            const qtySold = Number(item.qty) || 1
            await DB.prepare(`
              UPDATE inventory
              SET qty_in_stock = MAX(0, COALESCE(qty_in_stock, 0) - ?),
                  updated_by = ?, updated_at = ?
              WHERE item_id = ? AND villa_id = ?
            `).bind(qtySold, currentActor, timestamp, invItemId, villaId).run()

            // Check resulting stock against 10% of preferred level
            const row = await DB.prepare(
              `SELECT name, qty_in_stock, preferred_stock FROM inventory WHERE item_id = ? AND villa_id = ?`
            ).bind(invItemId, villaId).first()
            if (row && row.preferred_stock > 0 && row.qty_in_stock <= row.preferred_stock * 0.1) {
              lowStockAlerts.push({ itemId: invItemId, name: row.name, qtyInStock: row.qty_in_stock, preferredStock: row.preferred_stock })
            }
          }
        }
        return json({ success: true, data: { lowStockAlerts } });
      }

      if (action === 'saveVillaRentalIncome') {
        if (body.stayId) {
          await DB.prepare(`UPDATE stays SET source = COALESCE(NULLIF(?, ''), source), tariff_per_night = ?, extra_charges = ?, extra_lines = ?, gross = ?, commission_pct = ?, commission_amt = ?, net = ?, notes = ?, night_fee = COALESCE(NULLIF(?,0), night_fee), cleaning_fee = COALESCE(NULLIF(?,0), cleaning_fee), host_service_fee = COALESCE(NULLIF(?,0), host_service_fee), you_earn = COALESCE(NULLIF(?,0), you_earn), guest_service_fee = COALESCE(NULLIF(?,0), guest_service_fee), guest_paid_total = COALESCE(NULLIF(?,0), guest_paid_total), updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(body.channel ? body.channel.toLowerCase().replace(/[^a-z]/g,'_') : null, body.tariffPerNight || 0, body.extraCharges || 0, body.extraLines || null, body.gross || 0, body.commPct || 0, body.commAmt || 0, body.net || 0, body.notes || null, body.airbnbFees ? JSON.parse(body.airbnbFees).nightFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).cleaningFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).hostServiceFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).youEarn || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).guestServiceFee || 0 : 0, body.airbnbFees ? JSON.parse(body.airbnbFees).guestPaid || 0 : 0, actor, now(), body.stayId).run()
          return json({ success: true, data: { stayId: body.stayId, updated: true } })
        }
        const stayId = genStayId(body.villaId || 'dwarka')
        await DB.prepare(`INSERT INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'closed',?,?,?,?)`).bind(stayId, body.villaId || 'dwarka', (body.channel||'Direct').toLowerCase().replace('.','_').replace(' ','_'), body.guestName, body.checkInDate, body.checkOutDate, body.nights || 1, body.gross || 0, body.commPct || 0, body.commAmt || 0, body.net || 0, actor, actor, now(), now()).run()
        // This manual-entry path creates a stay directly in 'closed' state, bypassing
        // the normal checked_out transition where Raman's commission is normally
        // auto-created. Without this, guests entered here would be invisible to
        // Raman's commission tracking entirely (silent data gap). Mirror the same
        // commission logic used in updateStayStatus's checked_out handler.
        {
          const nightsForComm = parseInt(body.nights) || 1
          const ramanComm = nightsForComm > 1 ? 2000 : 1000
          await DB.prepare(`INSERT INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,0,'system','system',?,?)`).bind(genId('RC'), stayId, body.guestName, body.checkInDate, nightsForComm, ramanComm, now(), now()).run()
        }
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
            await DB.prepare(`INSERT OR REPLACE INTO rental_income (record_id, prop_id, month, year, rent, car_parking, maintenance, electricity, water, property_tax, land_tax, extra_maintenance, net, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(recId, propId, m + 1, year, parseFloat(prop.rent)||0, parseFloat(prop.carParking)||0, parseFloat(prop.maintenance)||0, parseFloat(prop.electricity)||0, parseFloat(prop.water)||0, parseFloat(prop.propertyTax)||0, parseFloat(prop.landTax)||0, parseFloat(prop.extraMaintenance)||0, net, actor, actor, now(), now()).run()
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
          INSERT INTO coconut_harvests
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
          INSERT INTO rubber_harvests
            (harvest_id, estate_id, harvest_date, weight_kg, price_per_kg, gross, expense, net, notes, created_by, created_at, updated_by, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(id, estateId, harvestDate, weightKg, pricePerKg, gross, expense, net, body.notes||null, actor, now(), actor, now()).run()

        const rubberEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estateId] || estateId
        sendAlert(env, `🌳 Estate360 — New rubber harvest: ₹${net.toLocaleString('en-IN')} net (${rubberEstateLabel})`, [
          'A new rubber harvest entry was logged.',
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
        ])

        return json({ success: true, data: { harvestId: id } })
      }

      // MANGO HARVEST — Mirroring exact production db layout indices 0 to 17
      if (action === 'saveMangoHarvest') {
        const { estate, harvestDate, boxType, buyer, pricePerBox, totalRevenue, totalBoxes, notes, alphonsa=0, neelam=0, malgova=0, banganapally=0, kilimooku=0, sindooram=0, mix=0 } = body
        if (!harvestDate || !estate) return json({ success:false, error:'estate and harvestDate required' }, 400)
        const id = `MH-${Date.now()}`
        await ActiveDB.prepare(`
          INSERT INTO mango_harvests (
            harvest_id, estate, harvest_date, box_type, 
            alphonsa, neelam, malgova, banganapally, kilimooku, sindooram, mix, 
            total_boxes, buyer, price_per_box, total_revenue, notes, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(id, estate, harvestDate, boxType || 'Normal', parseInt(alphonsa) || 0, parseInt(neelam) || 0, parseInt(malgova) || 0, parseInt(banganapally) || 0, parseInt(kilimooku) || 0, parseInt(sindooram) || 0, parseInt(mix) || 0, parseInt(totalBoxes) || 0, buyer || null, parseFloat(pricePerBox) || 0, parseFloat(totalRevenue) || 0, notes || null, actor).run()

        const mangoEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        const mangoRevenue = parseFloat(totalRevenue) || 0
        sendAlert(env, `🥭 Estate360 — New mango harvest: ₹${mangoRevenue.toLocaleString('en-IN')} (${mangoEstateLabel})`, [
          'A new mango harvest entry was logged.',
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
        ])

        return json({ success:true, data:{ harvestId:id } })
      }

      if (action === 'updateStayLocation') {
        const { stayId, homeAddress, city, state, country, fromCity, phone, email } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(`UPDATE stays SET home_address = ?, city = ?, state = ?, country = ?, from_city = ?, guest_phone = COALESCE(NULLIF(guest_phone,''), ?), guest_email = COALESCE(NULLIF(guest_email,''), ?), updated_by = 'auto', updated_at = ? WHERE stay_id = ?`).bind(homeAddress||null, city||null, state||null, country||'India', fromCity||null, phone||null, email||null, now(), stayId).run()
        return json({ success: true, data: { stayId, city, state, country } })
      }

      if (action === 'updateDriveFolder') {
        const { stayId, driveFolderId, driveFolderUrl, processingNote } = body
        if (!stayId) return err('stayId required')
        const existing = await DB.prepare(`SELECT folder_created_at, processing_log, folder_created FROM stays WHERE stay_id = ?`).bind(stayId).first()
        const folderCreatedAt = existing?.folder_created_at || now()
        const prevLog = existing?.processing_log ? existing.processing_log + '\n' : ''
        const logEntry = now() + ' — Drive folder created: ' + (driveFolderUrl || '') + (processingNote ? ' | ' + processingNote : '')
        const setFolderCreated = body.folderCreated !== undefined ? (body.folderCreated ? 1 : 0) : (existing?.folder_created || 0)
        await DB.prepare(`UPDATE stays SET drive_folder_id = ?, drive_folder_url = ?, folder_created = ?, folder_created_at = ?, processing_log = ?, updated_by = 'auto', updated_at = datetime('now') WHERE stay_id = ?`).bind(driveFolderId || null, driveFolderUrl || null, setFolderCreated, folderCreatedAt, prevLog + logEntry, stayId).run()
        return json({ success: true, data: { stayId, driveFolderId, folderCreatedAt } })
      }

      if (action === 'saveReview') {
        const { stayId, rating, source, reviewDate, reviewText, reviewNote, highlights } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(`UPDATE stays SET review_rating = ?, review_source = ?, review_date = ?, review_text = ?, review_note = ?, review_highlights = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(rating || 0, source || 'airbnb', reviewDate || now(), reviewText || null, reviewNote || null, highlights || null, 'auto', now(), stayId).run()
        return json({ success: true, data: { stayId, rating, source } })
      }

      if (action === 'setReadyForCheckIn') {
        const { stayId } = body; if (!stayId) return err('stayId required')
        const stay = await DB.prepare(`SELECT status FROM stays WHERE stay_id = ?`).bind(stayId).first()
        if (!stay) return json({ success: true, data: { changed: false, reason: 'stay not found' }})
        if (!['booked','confirmed','docs_uploaded','pending_review'].includes(stay.status)) return json({ success: true, data: { changed: false, reason: 'already at ' + stay.status }})
        await DB.prepare(`UPDATE stays SET status = 'ready_for_checkin', updated_by = 'auto', updated_at = ? WHERE stay_id = ?`).bind(now(), stayId).run()
        return json({ success: true, data: { changed: true, stayId, status: 'ready_for_checkin' }})
      }

      if (action === 'updateStayStatus') {
        const { stayId, status } = body
        if (!stayId) return err('stayId required')
        if (!['booked','confirmed','docs_uploaded','ready_for_checkin','checked_in','ready_for_checkout','checked_out','closed','cancelled'].includes(status)) return err(`Invalid status: ${status}`)
        await DB.prepare(`UPDATE stays SET status = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`).bind(status, actor, now(), stayId).run()
        if (status === 'checked_out') {
          const stay = await DB.prepare(`SELECT guest_name, checkin_date, nights FROM stays WHERE stay_id = ?`).bind(stayId).first()
          if (stay) {
            const existing = await DB.prepare(`SELECT comm_id FROM raman_commissions WHERE stay_id = ?`).bind(stayId).first()
            if (!existing) {
              const nights = parseInt(stay.nights) || 1; const ramanComm = nights > 1 ? 2000 : 1000
              await DB.prepare(`INSERT INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,0,'system','system',?,?)`).bind(genId('RC'), stayId, stay.guest_name, stay.checkin_date, nights, ramanComm, now(), now()).run()
            }
          }
        }
        return json({ success: true, data: { stayId, status } })
      }

      if (action === 'markReviewChased') {
        const { stayId } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(
          `UPDATE stays SET review_chased_at = ?, review_chase_count = COALESCE(review_chase_count, 0) + 1, updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(now(), actor, now(), stayId).run()
        return json({ success: true, data: { stayId } })
      }

      // Link a stay to whoever actually made the enquiry/booking, when that's
      // a different person from whoever checks in (e.g. a family member books
      // and pays, someone else physically stays). Pass guestId=null to unlink.
      // Denormalizes the name alongside the id so list views can render
      // "Booked by: X" without an extra JOIN, same pattern as guest_name itself.
      if (action === 'linkBookedBy') {
        const { stayId, guestId } = body
        if (!stayId) return err('stayId required')
        let guestName = null
        if (guestId) {
          const guest = await DB.prepare(`SELECT name FROM guests WHERE guest_id = ?`).bind(guestId).first()
          if (!guest) return err('Guest not found', 404)
          guestName = guest.name
        }
        await DB.prepare(
          `UPDATE stays SET booked_by_guest_id = ?, booked_by_name = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(guestId || null, guestName, actor, now(), stayId).run()
        return json({ success: true, data: { stayId, guestId: guestId || null, guestName } })
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
        await DB.prepare(`UPDATE stays SET ${updates.join(', ')} WHERE stay_id = ?`).bind(...binds).run()
        return json({ success: true, data: { stayId, status: 'closed', rating: rating || 0 } })
      }

      if (action === 'saveBreakfastEntry') {
        const id = genId('BF')
        await DB.prepare(`INSERT INTO guest_requests (req_id, stay_id, type, detail, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, body.stayId, 'breakfast', JSON.stringify({ date: body.date, guestCount: body.guestCount || 1, ratePerPerson: body.ratePerPerson || 0, total: body.total || 0, notes: body.notes || '' }), 'done', actor, actor, now(), now()).run()
        return json({ success: true, data: { id } })
      }

      if (action === 'saveCarRental') {
        const id = genId('CR')
        await DB.prepare(`INSERT INTO guest_requests (req_id, stay_id, type, detail, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, body.stayId, 'car_rental', JSON.stringify({ date: body.date, destination: body.destination || '', amount: body.amount || 0, commission: body.commission || 0, net: body.net || 0, notes: body.notes || '' }), 'done', actor, actor, now(), now()).run()
        return json({ success: true, data: { id } })
      }

      if (action === 'saveVillaExpense') {
        const id = genId('VE')
        await DB.prepare(`INSERT INTO guest_requests (req_id, stay_id, type, detail, status, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, body.stayId || null, 'villa_expense', JSON.stringify({ villaId: body.villaId || 'dwarka', date: body.date, category: body.category || '', amount: body.amount || 0, paidTo: body.paidTo || '', description: body.description|| '' }), 'done', actor, actor, now(), now()).run()
        return json({ success: true, data: { id } })
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
          await ActiveDB.prepare(`UPDATE estate_transactions SET type=?, date=?, category=?, amount=?, paid_to=?, description=?, updated_by=?, updated_at=? WHERE txn_id=?`).bind(type, date, category, amt, paidTo||null, description||null, actor, now(), txnId).run()

          sendAlert(env, `${emoji} Estate360 — ${typeLabel} updated: ₹${amt.toLocaleString('en-IN')} (${estateLabel})`, [
            `An estate ${typeLabel.toLowerCase()} entry was UPDATED.`,
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
          ])

          return json({ success: true, data: { txnId } })
        } else {
          const id = 'ET_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)
          await ActiveDB.prepare(`INSERT INTO estate_transactions (txn_id, estate, type, date, category, amount, paid_to, description, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, estate, type, date, category, amt, paidTo||null, description||null, actor, actor, now(), now()).run()

          sendAlert(env, `${emoji} Estate360 — New ${typeLabel.toLowerCase()}: ₹${amt.toLocaleString('en-IN')} (${estateLabel})`, [
            `A new estate ${typeLabel.toLowerCase()} entry was logged.`,
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
          ])

          return json({ success: true, data: { txnId: id } })
        }
      }

      if (action === 'createCampaign') {
        const { campaignName, channel, villaId, notes } = body; if (!campaignName?.trim()) return err('campaignName required')
        const slug = campaignName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
        const token = `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; const id = 'cmp_' + Date.now()
        await DB.prepare(`INSERT INTO marketing_campaigns (id, campaign_name, unique_token, channel, villa_id, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id, campaignName.trim(), token, channel || 'whatsapp', villaId || 'dwarka', notes || null, actor, now()).run()
        return json({ success: true, data: { id, token, campaignName: campaignName.trim() } })
      }

      if (action === 'toggleCampaign') {
        const { campaignId } = body; if (!campaignId) return err('campaignId required')
        await DB.prepare(`UPDATE marketing_campaigns SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id = ?`).bind(campaignId).run()
        return json({ success: true })
      }

      if (action === 'deleteCampaign') {
        const { campaignId } = body; if (!campaignId) return err('campaignId required')
        await DB.prepare(`DELETE FROM campaign_analytics WHERE campaign_id = ?`).bind(campaignId).run()
        await DB.prepare(`DELETE FROM marketing_campaigns WHERE id = ?`).bind(campaignId).run()
        return json({ success: true })
      }

      if (action === 'trackCampaignClick') {
        const { token, referrer } = body; if (!token) return err('token required')
        const campaign = await DB.prepare(`SELECT id FROM marketing_campaigns WHERE unique_token = ? AND is_active = 1`).bind(token).first()
        if (!campaign) return json({ success: false, error: 'Unknown token' })
        const cf = request.cf || {}; const id = 'evt_' + Date.now()
        await DB.prepare(`INSERT INTO campaign_analytics (id, campaign_id, event_type, country, region, city, user_agent, referrer) VALUES (?,?,?,?,?,?,?,?)`).bind(id, campaign.id, 'click', cf.country || null, cf.region || null, cf.city || null, request.headers.get('user-agent') || null, referrer || null).run()
        return json({ success: true })
      }

      if (action === 'trackCampaignAction') {
        const { token, eventType } = body; if (!token) return err('token required')
        const campaign = await DB.prepare(`SELECT id FROM marketing_campaigns WHERE unique_token = ?`).bind(token).first()
        if (!campaign) return json({ success: false })
        const cf = request.cf || {}; const id = 'evt_' + Date.now()
        await DB.prepare(`INSERT INTO campaign_analytics (id, campaign_id, event_type, country, region, city, user_agent) VALUES (?,?,?,?,?,?,?)`).bind(id, campaign.id, eventType, cf.country || null, cf.region || null, cf.city || null, request.headers.get('user-agent') || null).run()
        return json({ success: true })
      }

      // LOG IRRIGATION — Simple tap log (No zone info specified)
      if (action === 'logIrrigation') {
        const { estate, loggedDate, notes, durationMins } = body
        if (!estate || !loggedDate) return err('estate and loggedDate required')
        const id = 'irr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        await ActiveDB.prepare(
          `INSERT INTO irrigation_logs (log_id, estate, logged_date, notes, created_by, created_at, zone_id, zone_name, duration_mins)
           VALUES (?,?,?,?,?,?, NULL, NULL, ?)`
        ).bind(id, estate, loggedDate, notes||null, actor, now(), parseInt(durationMins)||0).run()

        const irrEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        sendAlert(env, `💧 Estate360 — Irrigation logged (${irrEstateLabel})`, [
          'An irrigation entry was logged.',
          '',
          `Estate:    ${irrEstateLabel}`,
          `Date:      ${loggedDate}`,
          `Duration:  ${parseInt(durationMins)||0} mins`,
          `Notes:     ${notes || '—'}`,
          `Log ID:    ${id}`,
          '',
          `Logged by: ${actor}`,
          `Logged at: ${now()}`,
        ])

        return json({ success: true, data: { logId: id } })
      }

      // IRRIGATION ZONE LOG — Save targeted run
      if (action === 'saveIrrigationZoneLog') {
        const { estate, zoneId, zoneName, loggedDate, durationMins, notes } = body
        if (!estate || !zoneId || !loggedDate) return err('estate, zoneId, loggedDate required')
        const id = 'irr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        await ActiveDB.prepare(
          `INSERT INTO irrigation_logs (log_id, estate, logged_date, notes, created_by, created_at, zone_id, zone_name, duration_mins)
           VALUES (?,?,?,?,?,?,?,?,?)`
        ).bind(id, estate, loggedDate, notes||null, actor, now(), zoneId, zoneName||null, parseInt(durationMins)||0).run()

        const zoneEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        sendAlert(env, `💧 Estate360 — Irrigation logged: ${zoneName || zoneId} (${zoneEstateLabel})`, [
          'An irrigation zone entry was logged.',
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
        ])

        return json({ success: true, data: { logId: id } })
      }

      // IRRIGATION ZONE CONFIG — Cleaned to completely isolate non-existent 'notes' column
      if (action === 'saveIrrigationZone') {
        const { zoneId, estate, zoneName, zoneLabel, expectedFreqDays, active, sortOrder, coconutTrees=0, mangoTrees=0, motor=null, newHoles=0 } = body
        if (!estate || !zoneName) return err('estate and zoneName required')
        const id = zoneId || ('zone_' + estate + '_' + Date.now())
        await ActiveDB.prepare(
          `INSERT OR REPLACE INTO irrigation_zones (zone_id, estate, zone_name, zone_label, expected_freq_days, coconut_trees, new_holes, motor, mango_trees, active, sort_order, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM irrigation_zones WHERE zone_id=?), ?))`
        ).bind(id, estate, zoneName, zoneLabel||null, parseInt(expectedFreqDays)||7, parseInt(coconutTrees)||0, parseInt(newHoles)||0, motor||null, parseInt(mangoTrees)||0, active !== false ? 1 : 0, parseInt(sortOrder)||0, id, now()).run()
        return json({ success: true, data: { zoneId: id } })
      }

      // SAVE FERTILIZATION — Completely Rewritten to align with structural layout columns (log_id, quantity_kg, cost)
      if (action === 'saveFertilization') {
        const { estate, plannedDate, actualDate, fertilizerType, quantityKg, cost, doneBy, notes } = body
        if (!estate || !plannedDate) return err('estate and plannedDate required')
        const id = 'fert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        await ActiveDB.prepare(
          `INSERT INTO fertilization_log (log_id, estate, planned_date, actual_date, fertilizer_type, quantity_kg, cost, done_by, notes, created_by, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id, estate, plannedDate, actualDate||null, fertilizerType||null, parseFloat(quantityKg)||0, parseFloat(cost)||0, doneBy||null, notes||null, actor, now()).run()

        const fertEstateLabel = ({ pollachi: 'Pollachi Estate', pavutumuri: 'Pavutumuri Estate' })[estate] || estate
        sendAlert(env, `🌱 Estate360 — Fertilization logged (${fertEstateLabel})`, [
          'A fertilization entry was logged.',
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
        ])

        return json({ success: true, data: { id } })
      }

      if (action === 'deleteEstateTransaction') {
        const { txnId } = body; if (!txnId) return err('txnId required')
        await ActiveDB.prepare(`DELETE FROM estate_transactions WHERE txn_id = ?`).bind(txnId).run()
        return json({ success: true, data: { txnId, deleted: true } })
      }

      // RENTAL AGREEMENT — create or update a tenant's lease record on rental_props.
      // This action was called by RentalAgreement.jsx's Save button and Add-Property
      // flow, but had NO backend handler at all — every save silently did nothing.
      if (action === 'saveRentalAgreement') {
        const d = body
        if (!d.propId) return err('propId required')

        const existing = await DB.prepare(`SELECT prop_id, next_renewal_date FROM rental_props WHERE prop_id = ?`).bind(d.propId).first()

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
            UPDATE rental_props SET
              name = COALESCE(?, name), location = COALESCE(?, location),
              country = ?, currency = ?,
              tenant_name = ?, tenant_email = ?, tenant_phone = ?, tenant_address = ?, tenant_pan = ?,
              deposit = ?, agreed_rent = ?, maintenance_fee = ?,
              lease_start = ?, lease_end = ?, notes = ?,
              drive_folder_url = ?, next_renewal_date = ?,
              early_terminated = ?, early_termination_date = ?,
              is_month_to_month = ?, month_to_month_since = ?,
              doc_contract_signed = ?, doc_id_captured = ?, doc_move_in = ?, doc_move_out = ?, doc_damage_report = ?,
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
            actor, now(), d.propId
          ).run()
        } else {
          await DB.prepare(`
            INSERT INTO rental_props (
              prop_id, name, location, country, currency,
              tenant_name, tenant_email, tenant_phone, tenant_address, tenant_pan,
              deposit, agreed_rent, maintenance_fee,
              lease_start, lease_end, notes, drive_folder_url, status,
              next_renewal_date, early_terminated, early_termination_date,
              is_month_to_month, month_to_month_since,
              doc_contract_signed, doc_id_captured, doc_move_in, doc_move_out, doc_damage_report,
              created_by, updated_by, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            d.propId, d.propName || d.propId, d.location || '', d.country || 'IN', d.currency || 'INR',
            d.tenantName || '', d.tenantEmail || null, d.tenantPhone || null, d.tenantAddress || null, d.tenantPan || null,
            parseFloat(d.deposit) || 0, parseFloat(d.agreedRent) || 0, parseFloat(d.maintenance) || 0,
            d.leaseStart || null, d.leaseEnd || null, d.notes || null, d.driveFolderUrl || null, 'Signed Up',
            nextRenewal, earlyTerminated, earlyTerminationDt,
            isMonthToMonth, monthToMonthSince,
            docFlags.doc_contract_signed, docFlags.doc_id_captured, docFlags.doc_move_in, docFlags.doc_move_out, docFlags.doc_damage_report,
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
          UPDATE rental_props SET stage = ?, is_delinquent = ?, end_reason = ?, status = ?, updated_by = ?, updated_at = ?
          WHERE prop_id = ?
        `).bind(stage, isDelinquent ? 1 : 0, stage === 'Completed' ? (endReason || 'Lease Ended') : null, legacyStatus, actor, now(), propId).run()
        return json({ success: true, data: { propId, stage, isDelinquent: !!isDelinquent, endReason } })
      }

      if (action === 'updateTenantStatus') {
        const { propId, status } = body; if (!propId || !status) return err('propId and status required')
        if (!['Active','Notice Given','Delinquent','Evicted','Runaway','Completed'].includes(status)) return err('Invalid status')
        await DB.prepare(`UPDATE rental_props SET status = ?, updated_by = ?, updated_at = ? WHERE prop_id = ?`).bind(status, actor, now(), propId).run()
        return json({ success: true, data: { propId, status } })
      }

      // Instant single-checkbox toggle for the document checklist, so ticking a box
      // doesn't require resubmitting the whole tenant form.
      if (action === 'updateRentalDocChecklist') {
        const { propId, field, value } = body
        const allowed = ['doc_contract_signed','doc_id_captured','doc_move_in','doc_move_out','doc_damage_report']
        if (!propId || !allowed.includes(field)) return err('propId and a valid field required')
        await DB.prepare(`UPDATE rental_props SET ${field} = ?, updated_by = ?, updated_at = ? WHERE prop_id = ?`)
          .bind(value ? 1 : 0, actor, now(), propId).run()
        return json({ success: true, data: { propId, field, value: !!value } })
      }

      if (action === 'savePropertyDetails') {
        const d = body; if (!d.propId) return err('propId required')
        const existing = await DB.prepare(`SELECT prop_id FROM property_details WHERE prop_id = ?`).bind(d.propId).first()
        const fields = ['address_line1','address_line2','city','state_province','postal_code','country','elec_provider','elec_consumer_id','elec_account_number','elec_portal_url','elec_monthly_avg','water_provider','water_consumer_id','water_account_number','water_portal_url','water_monthly_avg','gas_provider','gas_consumer_id','gas_account_number','gas_portal_url','gas_monthly_avg','internet_provider','internet_account','internet_monthly','hoa_name','hoa_account','hoa_monthly','other_utility_name','other_utility_id','other_utility_monthly','tax_parcel_id','tax_authority','tax_annual','tax_portal_url','loan_lender','loan_account','loan_original','loan_outstanding','loan_monthly_emi','loan_interest_rate','loan_start_date','loan_end_date','loan_portal_url','purchase_price','purchase_date','estimated_value','estimated_value_date','currency','insurance_provider','insurance_policy_no','insurance_annual','insurance_expiry','notes']
        const vals = fields.map(f => { const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); const v = d[camel] !== undefined ? d[camel] : d[f]; return (typeof v === 'number' ? v : (v || null)) })
        if (existing) {
          const sets = fields.map(f => f + ' = ?').join(', ')
          await DB.prepare(`UPDATE property_details SET ${sets}, updated_at = ? WHERE prop_id = ?`).bind(...vals, now(), d.propId).run()
        } else {
          const cols = ['prop_id', ...fields, 'created_at', 'updated_at'].join(', '); const placeholders = ['?', ...fields.map(() => '?'), '?', '?'].join(', ')
          await DB.prepare(`INSERT INTO property_details (${cols}) VALUES (${placeholders})`).bind(d.propId, ...vals, now(), now()).run()
        }
        return json({ success: true, data: { propId: d.propId } })
      }

      if (action === 'saveHoaEntry') {
        const { id, propId, effectiveDate, monthlyAmount, currency, notes } = body; if (!propId || !effectiveDate || monthlyAmount === undefined) return err('propId, effectiveDate, monthlyAmount required')
        const entryId = id || ('hoa_' + Date.now()); await DB.prepare(`INSERT OR REPLACE INTO hoa_history (id, prop_id, effective_date, monthly_amount, currency, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM hoa_history WHERE id=?), ?))`).bind(entryId, propId, effectiveDate, parseFloat(monthlyAmount)||0, currency||'INR', notes||null, entryId, now()).run()
        return json({ success: true, data: { id: entryId } })
      }

      if (action === 'deleteHoaEntry') {
        const { id } = body; if (!id) return err('id required')
        await DB.prepare(`DELETE FROM hoa_history WHERE id = ?`).bind(id).run()
        return json({ success: true, data: { id, deleted: true } })
      }

      if (action === 'saveTaxEntry') {
        const { id, propId, taxYear, annualAmount, currency, parcelId, taxAuthority, dueDate, paidDate, paidAmount, receiptRef, notes } = body; if (!propId || !taxYear || annualAmount === undefined) return err('propId, taxYear, annualAmount required')
        const entryId = id || ('tax_' + propId + '_' + taxYear); await DB.prepare(`INSERT OR REPLACE INTO tax_history (id, prop_id, tax_year, annual_amount, currency, parcel_id, tax_authority, due_date, paid_date, paid_amount, receipt_ref, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM tax_history WHERE id=?),?))`).bind(entryId, propId, parseInt(taxYear), parseFloat(annualAmount)||0, currency||'INR', parcelId||null, taxAuthority||null, dueDate||null, paidDate||null, parseFloat(paidAmount)||0, receiptRef||null, notes||null, entryId, now()).run()
        return json({ success: true, data: { id: entryId } })
      }

      if (action === 'deleteTaxEntry') {
        const { id } = body; if (!id) return err('id required')
        await DB.prepare(`DELETE FROM tax_history WHERE id = ?`).bind(id).run()
        return json({ success: true, data: { id, deleted: true } })
      }

      if (action === 'savePropertyDoc') {
        const { docId, propId, category, docName, driveUrl, driveFolderUrl, fileType, docDate, notes } = body; if (!propId || !docName) return err('propId and docName required')
        const id = docId || ('doc_' + Date.now()); await DB.prepare(`INSERT OR REPLACE INTO property_documents (doc_id, prop_id, category, doc_name, drive_url, drive_folder_url, file_type, doc_date, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?, COALESCE((SELECT created_at FROM property_documents WHERE doc_id=?),?))`).bind(id, propId, category||'Other', docName.trim(), driveUrl||null, driveFolderUrl||null, fileType||null, docDate||null, notes||null, id, now()).run()
        return json({ success: true, data: { docId: id } })
      }

      if (action === 'deletePropertyDoc') {
        const { docId } = body; if (!docId) return err('docId required')
        await DB.prepare(`DELETE FROM property_documents WHERE doc_id = ?`).bind(docId).run()
        return json({ success: true, data: { docId, deleted: true } })
      }

      if (action === 'saveLeaseLoss') {
        const { lossId, propId, leaseSnapshot, itemCategory, description, amount, currency, evidenceFileName, evidenceDriveUrl, evidenceTimestamp, status: lossStatus } = body; if (!propId || !description || amount === undefined) return err('propId, description, amount required')
        if (!['Rent','Damage','Cleaning','Legal','Other'].includes(itemCategory)) return err('Invalid itemCategory')
        const id = lossId || ('loss_' + Date.now()); await DB.prepare(`INSERT OR REPLACE INTO lease_losses (loss_id, prop_id, lease_snapshot, item_category, description, amount, currency, evidence_file_name, evidence_drive_url, evidence_timestamp, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT created_at FROM lease_losses WHERE loss_id=?),?),?)`).bind(id, propId, leaseSnapshot||'', itemCategory||'Other', description, parseFloat(amount)||0, currency||'INR', evidenceFileName||null, evidenceDriveUrl||null, evidenceTimestamp||null, lossStatus||'Estimated', actor, id, now(), now()).run()
        return json({ success: true, data: { lossId: id } })
      }

      if (action === 'updateLeaseLossStatus') {
        const { lossId, status: lossStatus } = body; if (!lossId || !lossStatus) return err('lossId and status required')
        await DB.prepare(`UPDATE lease_losses SET status = ?, updated_at = ? WHERE loss_id = ?`).bind(lossStatus, now(), lossId).run()
        return json({ success: true, data: { lossId, status: lossStatus } })
      }

      if (action === 'deleteLeaseLoss') {
        const { lossId } = body; if (!lossId) return err('lossId required')
        await DB.prepare(`DELETE FROM lease_losses WHERE loss_id = ?`).bind(lossId).run()
        return json({ success: true, data: { lossId, deleted: true } })
      }

      // RENT LEDGER — "Paid on Time" / late-fee exception POST lands here.
      // (getRentTransactions, the matching read, lives in the GET block
      // above — it was originally misplaced here too, which is exactly
      // why it 404'd: GET requests never reach code inside this POST block.)
      if (action === 'postRentPayment') {
        const { propId, periodMonth, baseRent, maintenance, carParking, lateFee, paidDate, currency, isException, notes } = body
        if (!propId || !periodMonth) return err('propId and periodMonth required')
        if (!/^\d{4}-\d{2}$/.test(periodMonth)) return err('periodMonth must be YYYY-MM')
        const base = parseFloat(baseRent) || 0
        const maint = parseFloat(maintenance) || 0
        const parking = parseFloat(carParking) || 0
        const late = parseFloat(lateFee) || 0
        const total = base + maint + parking + late
        const id = 'rtxn_' + Date.now() + '_' + Math.floor(Math.random()*1000)
        try {
          await DB.prepare(`
            INSERT INTO rent_transactions (
              txn_id, prop_id, period_month, base_rent, maintenance, car_parking, late_fee,
              total_due, is_exception, paid_date, currency, notes, created_by, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            id, propId, periodMonth, base, maint, parking, late,
            total, isException ? 1 : 0, paidDate || now().slice(0,10), currency || 'INR', notes || null, actor, now()
          ).run()
        } catch (e) {
          if (String(e.message || '').includes('UNIQUE')) {
            return err(`Rent for ${periodMonth} has already been posted for this property.`, 409)
          }
          throw e
        }
        return json({ success: true, data: { txnId: id, propId, periodMonth, totalDue: total } })
      }

      // PROPERTY EXPENSES — electricity/water/taxes/extra-maintenance,
      // independent of whether rent was collected that month (vacant
      // periods, or simply tracking property-level costs). Replaces
      // rental_income's expense columns going forward; rental_income
      // itself is left untouched/unwritten-to rather than dropped, so
      // its historical rows are still there for reference.
      if (action === 'savePropertyExpense') {
        const { propId, month, year, electricity, water, propertyTax, landTax, extraMaintenance, notes } = body
        if (!propId || !month || !year) return err('propId, month, and year required')
        const e1 = parseFloat(electricity) || 0
        const e2 = parseFloat(water) || 0
        const e3 = parseFloat(propertyTax) || 0
        const e4 = parseFloat(landTax) || 0
        const e5 = parseFloat(extraMaintenance) || 0
        const total = e1 + e2 + e3 + e4 + e5
        const recId = `PE-${propId}-${year}-${month}`
        await DB.prepare(`
          INSERT OR REPLACE INTO property_expenses (
            record_id, prop_id, month, year, electricity, water, property_tax, land_tax,
            extra_maintenance, total_expense, notes, created_by, updated_by, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          recId, propId, month, year, e1, e2, e3, e4, e5, total, notes || null,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { recordId: recId, totalExpense: total } })
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
            UPDATE tenancy_history SET
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
            INSERT INTO tenancy_history (
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
        await DB.prepare(`DELETE FROM tenancy_history WHERE history_id = ?`).bind(historyId).run()
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
        const existing = await DB.prepare(`SELECT incoming_id FROM incoming_tenants WHERE prop_id = ?`).bind(t.propId).first()
        const id = existing?.incoming_id || ('inc_' + Date.now() + '_' + Math.floor(Math.random()*1000))
        if (existing) {
          await DB.prepare(`
            UPDATE incoming_tenants SET
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
            INSERT INTO incoming_tenants (
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

      if (action === 'deleteIncomingTenant') {
        const { propId } = body; if (!propId) return err('propId required')
        await DB.prepare(`DELETE FROM incoming_tenants WHERE prop_id = ?`).bind(propId).run()
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
        const current = await DB.prepare(`SELECT * FROM rental_props WHERE prop_id = ?`).bind(propId).first()
        const incoming = await DB.prepare(`SELECT * FROM incoming_tenants WHERE prop_id = ?`).bind(propId).first()
        if (!incoming) return err('No incoming tenant queued for this property')

        const histId = 'hist_' + Date.now() + '_' + Math.floor(Math.random()*1000)
        const batch = []

        // Step 1 — only archive if there's an actual outgoing tenant to
        // archive (a property moving in its very first-ever tenant has
        // no prior occupant, so current.tenant_name may be empty).
        if (current && current.tenant_name) {
          batch.push(DB.prepare(`
            INSERT INTO tenancy_history (
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
          UPDATE rental_props SET
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
        batch.push(DB.prepare(`DELETE FROM incoming_tenants WHERE prop_id = ?`).bind(propId))

        await DB.batch(batch)
        return json({ success: true, data: { propId, movedInTenant: incoming.tenant_name, archivedOutgoing: !!(current && current.tenant_name) } })
      }


      // CREATE PROVISIONAL BOOKING — called when guest submits form but no booking exists
      if (action === 'createProvisionalBooking') {
        const stayId = genStayId(body.villaId || 'dwarka')
        const nights = body.checkInDate && body.checkOutDate
          ? Math.max(1, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000))
          : 1
        await DB.prepare(`
          INSERT INTO stays (
            stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, gross, net,
            status, created_by, updated_by, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,'pending_review',?,?,?,?)
        `).bind(
          stayId, body.villaId || 'dwarka', body.source || 'guest_form',
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
          `UPDATE guest_documents SET folder_created = 1, updated_at = ? WHERE doc_id = ?`
        ).bind(now(), docId).run()
        return json({ success: true, data: { docId } })
      }

      // CLEANUP EXPIRED DOCUMENTS — removes docs older than 14 days
      // folder_created=1: Drive upload confirmed, safe to delete
      // folder_created=0: Drive upload never happened — stale, also cleaned after 14 days
      if (action === 'cleanupExpiredDocuments') {
        // Count stale unprocessed docs before deleting (for logging)
        const staleUnprocessed = await DB.prepare(
          `SELECT COUNT(*) as cnt FROM guest_documents
           WHERE folder_created = 0
             AND created_at < datetime('now', '-14 days')`
        ).first()
        const result = await DB.prepare(
          `DELETE FROM guest_documents
           WHERE created_at < datetime('now', '-14 days')`
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
           FROM stays
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
    console.error('Worker error:', e)
    return json({ success: false, error: e.message }, 500)
  }
}