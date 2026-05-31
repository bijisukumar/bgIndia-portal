// ============================================================
//  bgIndia Portal — Cloudflare Pages Function (D1 Worker)
//  v2.0 — JWT authentication (PINs server-side only)
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
// In-memory map resets on worker restart; good enough for PIN brute-force protection
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
function genStayId(villaId = 'dwarka') {
  const prefix = villaId === 'dwarka' ? 'DWK' : villaId.toUpperCase().slice(0, 3)
  const year   = new Date().getFullYear()
  const rand   = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${year}-${rand}`
}
function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── ROUTER ────────────────────────────────────────────────
export async function onRequest(ctx) {
  const { request, env } = ctx
  const DB         = env.bgindia_db
  const DB_ESTATES = env.DB_ESTATES

  const ESTATE_ACTIONS = new Set([
    'getCoconutHarvests', 'saveCoconutHarvest',
    'getRubberHarvests',  'saveRubberHarvest',
    'getEstateTransactions', 'saveEstateTransaction',
    'getEstateDashboard',
    'getPradoshQuickInfo',   // quick info for PradoshHome
    'logIrrigation',         // record irrigation log tap
  ])

  // OPTIONS preflight
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
      // Send lockout alert
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
      // Send failed attempt alert (every wrong PIN)
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
      // Creates or updates stay, stores all Form C fields, sets status to pending_review
      if (action === 'submitGuestCheckIn') {
        const publicBody = await request.json().catch(() => ({}))
        const {
          villaId = 'dwarka', partner = 'direct', stayId: existingStayId,
          guestName, dob, gender, nationality = 'Indian',
          phone, email,
          homeAddress, city, state, pincode, country = 'India', fromCity,
          homeCountryAddress,
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
        const bfChoice     = breakfastChoice     || null
        const reqCab       = requestCab          ? 1 : 0
        const reqBeds      = requestExtraBeds    ? 1 : 0
        const bedsCount    = reqBeds ? (parseInt(extraBedsCount) || 1) : 0
        const now          = () => new Date().toISOString().slice(0,19).replace('T',' ')

        // Strip any leading digits/spaces that browser autofill may prepend
        const cleanName = guestName ? guestName.replace(/^[\d\s]+/, '').trim() : ''
        if (!cleanName) return err('guestName is required')
        const safeGuestName = cleanName
        if (!checkInDate) return err('checkInDate is required')

        const submittedAt = now()
        let stayId = existingStayId

        // Try to match existing stay first
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
          // Update existing stay with all form fields
          await DB.prepare(`
            UPDATE stays SET
              guest_phone = COALESCE(NULLIF(guest_phone,''), ?),
              guest_email = COALESCE(NULLIF(guest_email,''), ?),
              dob = ?, gender = ?, nationality = ?,
              home_address = ?, city = ?, state = ?, country = ?, from_city = ?, pincode = ?,
              home_country_address = ?,
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
              checkin_form_submitted = 1, checkin_form_submitted_at = ?,
              status = CASE WHEN status IN ('confirmed','booked','pending_review') THEN 'pending_review' ELSE status END,
              updated_by = 'auto', updated_at = ?
            WHERE stay_id = ?
          `).bind(
            phone||null, email||null,
            dob||null, gender||null, nationality,
            homeAddress||null, city||null, state||null, country, fromCity||city||null, pincode||null,
            homeCountryAddress||null,
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
            submittedAt, submittedAt, stayId
          ).run()
        } else {
          // Create new provisional stay
          stayId = genStayId(villaId)
          const n = parseInt(nights) || (checkOutDate
            ? Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000))
            : 1)
          await DB.prepare(`
            INSERT INTO stays (
              stay_id, villa_id, source, guest_name, guest_phone, guest_email,
              checkin_date, checkout_date, nights, adults, children, gross, net,
              dob, gender, nationality,
              home_address, city, state, country, from_city, pincode, home_country_address,
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
              ?,?,?,?,?,?,?,?,?,?,
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
            pincode||null, homeCountryAddress||null,
            guestList||null, purposeOfVisit||null,
            modeOfTransport||null, vehicleNumber||null, eta||null,
            govtIdType||null, govtIdNum||null,
            passportNumber||null, passportIssueDate||null, passportIssuePlace||null,
            passportExpiry||null,
            visaNumber||null, visaType||null, visaIssueDate||null, visaIssuePlace||null,
            arrivalDateIndia||null, portOfArrival||null, nextDestination||null,
            reqEarly, reqLate, reqBreakfast, bfChoice, reqCab
          ).run()
        }

        // Note: ID file uploads (idFileB64, passportFileB64, visaFileB64) are accepted
        // but not stored in DB — they will be uploaded to Drive folder by Apps Script
        // when the owner onboards the guest. This avoids Cloudflare 100KB payload limits.

        // ── Save ID documents to guest_documents table ──────────────────
        // Images are compressed in browser to ~80KB before encoding
        // Apps Script reads these and uploads to Drive, then deletes from D1
        const docId = (type, sid) => `DOC-${sid}-${type}-${Date.now()}`
        if (idFileB64) {
          try {
            await DB.prepare(
              `INSERT OR REPLACE INTO guest_documents
               (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
               VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
            ).bind(
              docId('id', stayId), stayId, 'govt_id',
              idFileName || ('ID-' + stayId + '.jpg'), idFileB64
            ).run()
            console.log('Saved ID doc to guest_documents for', stayId)
          } catch(e) { console.warn('ID doc store error:', e.message) }
        }
        if (publicBody.passportFileB64) {
          try {
            await DB.prepare(
              `INSERT OR REPLACE INTO guest_documents
               (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
               VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
            ).bind(
              docId('passport', stayId), stayId, 'passport',
              'passport-' + stayId + '.jpg', publicBody.passportFileB64
            ).run()
          } catch(e) { console.warn('Passport doc store error:', e.message) }
        }
        if (publicBody.visaFileB64) {
          try {
            await DB.prepare(
              `INSERT OR REPLACE INTO guest_documents
               (doc_id, stay_id, doc_type, file_name, file_b64, folder_created, created_at)
               VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
            ).bind(
              docId('visa', stayId), stayId, 'visa',
              'visa-' + stayId + '.jpg', publicBody.visaFileB64
            ).run()
          } catch(e) { console.warn('Visa doc store error:', e.message) }
        }

        return json({ success: true, data: { stayId, status: 'pending_review' } })
      }



      // RESOLVE CHECKIN LINK — public endpoint (no auth)
      if (action === 'resolveCheckinLink') {
        const rlBody = await request.json().catch(() => ({}))
        const { token: linkToken } = rlBody
        if (!linkToken) return err('token required')
        const link = await DB.prepare(
          `SELECT token, villa_id, partner, label, is_active FROM checkin_links WHERE token = ?`
        ).bind(linkToken).first()
        if (!link) return json({ success: false, error: 'Invalid link' }, { status: 404 })
        if (!link.is_active) return json({ success: false, error: 'Link deactivated' }, { status: 403 })
        await DB.prepare(`UPDATE checkin_links SET use_count = use_count + 1, updated_at = ? WHERE token = ?`).bind(now(), linkToken).run()
        return json({ success: true, data: { villaId: link.villa_id, partner: link.partner, label: link.label } })
      }


  // ── AUTH GUARD — verify JWT on every other request ─────
  const authHeader = request.headers.get('Authorization') || ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  // System token — long-lived token for Apps Script automation (not a JWT)
  // Stored in Cloudflare env as SYSTEM_TOKEN
  let payload = null
  if (token && env.SYSTEM_TOKEN && token === env.SYSTEM_TOKEN) {
    payload = { name: 'System', role: 'owner', actor: 'auto' }
  } else {
    payload = token ? await verifyJwt(token, env.JWT_SECRET) : null
  }
  if (!payload) return json({ success: false, error: 'Unauthorized' }, 401)

  // Actor comes from verified JWT — not from any client header
  const actor = payload.actor || 'owner'
  const now   = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

  // Route to correct DB
  const ActiveDB = ESTATE_ACTIONS.has(action) ? DB_ESTATES : DB
  if (ESTATE_ACTIONS.has(action) && !DB_ESTATES) {
    return err('Estates DB not configured', 503)
  }

  try {
    // ── GET ROUTES ──────────────────────────────────────
    if (method === 'GET') {

      // STAYS
      if (action === 'getStays') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        // year='all' returns all stays (for trend/comparison/lead-time charts)
        const { results } = year === 'all'
          ? await DB.prepare(`SELECT * FROM stays WHERE villa_id = ? ORDER BY checkin_date DESC`).bind(villaId).all()
          : await DB.prepare(`SELECT * FROM stays WHERE villa_id = ? AND checkin_date LIKE ? ORDER BY checkin_date DESC`).bind(villaId, `${year}%`).all()
        // Map snake_case → camelCase for frontend compatibility
        const mapped = results.map(r => ({
          ...r,
          stayId:          r.stay_id,
          guestName:       r.guest_name,
          bookerName:      r.guest_name,
          villaId:         r.villa_id,
          checkIn:         r.checkin_date,
          checkOut:        r.checkout_date,
          checkInDate:     r.checkin_date,
          checkOutDate:    r.checkout_date,
          bookedDate:      r.booked_date || r.created_at,
          commPct:         r.commission_pct,
          commAmt:         r.commission_amt,
          channel:         r.source,
          driveFolder:     r.drive_folder_url,
          driveFolderUrl:  r.drive_folder_url,
          driveFolderId:   r.drive_folder_id,
          reviewRating:    r.review_rating,
          fromCity:        r.from_city,
          nightFee:        r.night_fee         || 0,
          cleaningFee:     r.cleaning_fee      || 0,
          hostServiceFee:  r.host_service_fee  || 0,
          youEarn:         r.you_earn          || 0,
          guestServiceFee: r.guest_service_fee || 0,
          guestPaidTotal:  r.guest_paid_total  || 0,
          airbnbConf:      r.airbnb_conf       || '',
        }))
        return json({ success: true, data: mapped })
      }

      if (action === 'getActiveStay') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const stay = await DB.prepare(
          `SELECT * FROM stays WHERE villa_id = ? AND status = 'checked_in' ORDER BY checkin_date DESC LIMIT 1`
        ).bind(villaId).first()
        if (!stay) return json({ success: true, data: null })
        // Expose both snake_case and camelCase for compatibility
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
        // Returns stays in 'ready_for_checkin' status for Raman's check-in screen
        const { results } = await DB.prepare(
          `SELECT * FROM stays WHERE status = 'ready_for_checkin' ORDER BY checkin_date ASC`
        ).all()
        return json({ success: true, data: results })
      }

      if (action === 'getGuests') {
        const { results } = await DB.prepare(
          `SELECT
            guest_name,
            guest_phone,
            guest_email,
            source,
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
        // Map snake_case DB fields → camelCase expected by GuestRepository.jsx
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

      // VILLA DASHBOARD
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
        const totalComm      = stays.reduce((s, r) => s + (r.commission_amt || r.commAmt || 0), 0)
        const byChannel      = {}
        stays.forEach(s => {
          if (!byChannel[s.source]) byChannel[s.source] = { bookings: 0, net: 0 }
          byChannel[s.source].bookings++
          byChannel[s.source].net += (s.net || 0)
        })
        // Fetch kitchen revenue from stay_incidentals (uses created_at and total columns)
        let kitchenByMonth = {}, breakfastByMonth = {}, carByMonth = {}
        try {
          const { results: kitchenRows } = await DB.prepare(
            `SELECT strftime('%m', created_at) as month, SUM(total) as total
             FROM stay_incidentals WHERE strftime('%Y', created_at) = ? GROUP BY month`
          ).bind(String(year)).all()
          kitchenByMonth = Object.fromEntries((kitchenRows||[]).map(r=>[parseInt(r.month),r.total||0]))
        } catch(e) {}
        // guest_requests table does not have amount/total columns yet — will add later
        // breakfastByMonth and carByMonth remain empty ({}) for now

        // Build months map (1-12)
        const months = {}
        for (let m = 1; m <= 12; m++) {
          const mStays  = stays.filter(s => new Date(s.checkin_date).getMonth() + 1 === m)
          const gross   = mStays.reduce((s, r) => s + (r.gross || 0), 0)
          const fees    = mStays.reduce((s, r) => s + (r.commission_amt || 0), 0)
          const net     = mStays.reduce((s, r) => s + (r.net || 0), 0)
          const kitchen   = kitchenByMonth[m]   || 0
          const breakfast = breakfastByMonth[m] || 0
          const carRental = carByMonth[m]        || 0
          const tariff    = gross  // room tariff = gross (before commission)
          const profit    = net - 0  // net already = gross - commission; no expense data yet
          const direct    = mStays.filter(s => (s.source || '').toLowerCase() === 'direct').length

          months[m] = {
            bookings:  mStays.length,
            revenue:   gross,          // gross revenue from room
            gross,
            fees,                      // commission paid to channels
            profit:    net,            // net after commission (profit before expenses)
            net,
            direct,
            breakdown: {
              tariff,
              kitchen,
              breakfast,
              carRental,
              events: 0,
            }
          }
        }

        // Quarterly net
        const quarterly = {
          Q1: [1,2,3].reduce((s,m)  => s + (months[m].net||0), 0),
          Q2: [4,5,6].reduce((s,m)  => s + (months[m].net||0), 0),
          Q3: [7,8,9].reduce((s,m)  => s + (months[m].net||0), 0),
          Q4: [10,11,12].reduce((s,m) => s + (months[m].net||0), 0),
        }

        // Direct ratio for full year
        const totalDirect = stays.filter(s => (s.source||'').toLowerCase() === 'direct').length

        // Key insights
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
          bestMonth, topChannel, directSaving, avgNights
        }})
      }

      // RAMAN COMMISSION
      if (action === 'getRamanUnpaid') {
        const { results } = await DB.prepare(
          `SELECT rc.*,
                  COALESCE(s.review_rating, 0) as review_rating
           FROM raman_commissions rc
           LEFT JOIN stays s ON s.stay_id = rc.stay_id
           WHERE rc.is_paid = 0
           ORDER BY rc.checkin_date ASC`
        ).all()
        const totalUnpaid = results.reduce((s, r) => s + (r.commission || 0), 0)
        // Group by quarter
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
           FROM raman_commissions WHERE is_paid = 1
           GROUP BY paid_date ORDER BY paid_date DESC`
        ).all()
        return json({ success: true, data: results })
      }

      // RAMAN DASHBOARD SUMMARY — year-by-year + current quarter unpaid detail
      if (action === 'getRamanDashboard') {
        // Paid totals by year
        const { results: byYear } = await DB.prepare(
          `SELECT strftime('%Y', COALESCE(paid_date, created_at)) as year,
                  SUM(commission) as total_paid,
                  COUNT(*) as stays_paid
           FROM raman_commissions
           WHERE is_paid = 1
           GROUP BY year ORDER BY year DESC`
        ).all()

        // Unpaid — all, with quarter breakdown
        const { results: unpaidRows } = await DB.prepare(
          `SELECT comm_id, guest_name, checkin_date, nights, commission
           FROM raman_commissions
           WHERE is_paid = 0
           ORDER BY checkin_date ASC`
        ).all()

        const totalUnpaid = unpaidRows.reduce((s,r) => s + (r.commission||0), 0)

        // Group unpaid by year+quarter
        const unpaidByQ = {}
        unpaidRows.forEach(r => {
          const d = new Date(r.checkin_date)
          const yr = d.getFullYear()
          const q  = Math.floor(d.getMonth() / 3) + 1
          const key = `${yr}-Q${q}`
          if (!unpaidByQ[key]) unpaidByQ[key] = { key, year: yr, quarter: q,
            label: `Q${q} ${yr}`, total: 0, stays: [] }
          unpaidByQ[key].total += r.commission || 0
          unpaidByQ[key].stays.push({
            commId:    r.comm_id,
            guestName: r.guest_name,
            checkIn:   r.checkin_date,
            nights:    r.nights,
            commission: r.commission,
          })
        })

        // All-time total paid
        const allTimePaid = byYear.reduce((s,r) => s + (r.total_paid||0), 0)

        return json({ success: true, data: {
          byYear: byYear.map(r => ({
            year:       r.year,
            totalPaid:  r.total_paid,
            staysPaid:  r.stays_paid,
          })),
          unpaidByQ:    Object.values(unpaidByQ).sort((a,b) => b.key.localeCompare(a.key)),
          totalUnpaid,
          allTimePaid,
          grandTotal:   allTimePaid + totalUnpaid,
        }})
      }

      // RENTAL INCOME
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
        const { results } = await DB.prepare(
          `SELECT prop_id, month,
            SUM(rent + car_parking) as income,
            SUM(maintenance + electricity + water + property_tax + land_tax + extra_maintenance) as expense,
            SUM(net) as net
           FROM rental_income WHERE year = ? GROUP BY prop_id, month ORDER BY prop_id, month`
        ).bind(year).all()
        // Aggregate totals
        const totalIncome  = results.reduce((s, r) => s + (r.income || 0), 0)
        const totalExpense = results.reduce((s, r) => s + (r.expense || 0), 0)
        const netIncome    = results.reduce((s, r) => s + (r.net || 0), 0)
        return json({ success: true, data: { totalIncome, totalExpense, netIncome, rows: results } })
      }

      // COCONUT
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
          scheduledNext:     r.scheduled_harvest_date || null,  // harvest_date + 45 days (auto)
          actualNext:        r.next_harvest_date || null,       // real date of next harvest
        }))
        // Next harvest = scheduled date of most recent harvest (harvest[0] + 45 days)
        const nextHarvestDate = results[0]?.scheduled_harvest_date || null
        return json({ success: true, data: { totalHarvests, totalCount, grossRevenue, netIncome, totalExpense, harvests, nextHarvestDate } })
      }

      // RUBBER
      if (action === 'getRubberHarvests') {
        const year = url.searchParams.get('year') || new Date().getFullYear()
        const { results } = await ActiveDB.prepare(
          `SELECT * FROM rubber_harvests WHERE harvest_date LIKE ? ORDER BY harvest_date DESC`
        ).bind(`${year}%`).all()
        return json({ success: true, data: results })
      }

      // INVENTORY
      if (action === 'getInventory') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(
          `SELECT * FROM inventory WHERE villa_id = ? ORDER BY category, name`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      if (action === 'getInventoryPrices') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(
          `SELECT item_id, cost_price, sell_price FROM inventory WHERE villa_id = ?`
        ).bind(villaId).all()
        const prices = Object.fromEntries(results.map(r => [r.item_id, { costPrice: r.cost_price, sellPrice: r.sell_price }]))
        return json({ success: true, data: prices })
      }

      // FREE-FORM SQL (owner only — any SELECT query)
      if (action === 'runSQL') {
        const sql = url.searchParams.get('sql') || ''
        const trimmed = sql.trim().toUpperCase()
        // Safety: only allow SELECT statements
        if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA')) {
          return err('Only SELECT and PRAGMA queries allowed')
        }
        try {
          const { results } = await DB.prepare(sql).all()
          return json({ success: true, data: results, rowCount: results.length })
        } catch (e) {
          return json({ success: false, error: e.message }, 400)
        }
      }

      // WRITE SQL — owner only, allows DELETE/UPDATE/INSERT/ALTER
      if (action === 'runSQLWrite') {
        const sql = (body && body.sql) ? body.sql.trim() : ''
        if (!sql) return err('sql required')
        const upper = sql.toUpperCase()
        const blocked = ['DROP TABLE','TRUNCATE','DROP DATABASE','ATTACH','DETACH']
        if (blocked.some(b => upper.includes(b))) {
          return err('Operation not permitted — DROP TABLE and TRUNCATE are blocked')
        }
        try {
          const result = await DB.prepare(sql).run()
          return json({ success: true, data: {
            changes:  result.meta?.changes  ?? 0,
            duration: result.meta?.duration ?? 0,
          }})
        } catch (e) {
          return json({ success: false, error: e.message }, 400)
        }
      }

      // AD-HOC QUERY (owner only — runs preset queries by key)
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
          coconut_by_year:   `SELECT strftime('%Y', harvest_date) as year, COUNT(*) as harvests, SUM(total_nuts) as nuts, ROUND(SUM(total_earnings),0) as earnings, ROUND(SUM(net_income),0) as net FROM coconut_harvests GROUP BY year ORDER BY year DESC`,
          rental_ytd:        `SELECT prop_id, SUM(rent+car_parking) as income, SUM(maintenance+electricity+water+property_tax+land_tax) as expense, SUM(net) as net FROM rental_income WHERE year = strftime('%Y','now') GROUP BY prop_id`,
          direct_conversion: `SELECT source, COUNT(*) as bookings FROM stays WHERE status != 'cancelled' GROUP BY source`,
          avg_tariff_year:   `SELECT strftime('%Y', checkin_date) as year, ROUND(AVG(tariff_per_night),0) as avg_tariff, ROUND(AVG(nights),1) as avg_nights FROM stays WHERE status != 'cancelled' AND tariff_per_night > 0 GROUP BY year ORDER BY year DESC`,
        }
        const sql = PRESET_QUERIES[key]
        if (!sql) return err(`Unknown query key: ${key}`)
        const { results } = await DB.prepare(sql).all()
        return json({ success: true, data: results, sql })
      }

      // MARKETING STATS — city breakdown, purpose, channel vs revenue
      if (action === 'getMarketingStats') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'

        const statYear = url.searchParams.get('statYear') || null

        // City breakdown — optionally filtered by year
        const cityQuery = statYear
          ? `SELECT
              COALESCE(NULLIF(from_city,''), NULLIF(city,''), 'Unknown') as city_name,
              COALESCE(NULLIF(state,''), '') as state_name,
              COALESCE(NULLIF(country,''), 'India') as country_name,
              COUNT(DISTINCT guest_name) as guest_count,
              COUNT(*) as booking_count,
              ROUND(SUM(COALESCE(net,0)),0) as revenue
             FROM stays
             WHERE villa_id = ? AND status NOT IN ('cancelled')
               AND checkin_date LIKE ?
             GROUP BY city_name, state_name, country_name
             ORDER BY guest_count DESC`
          : `SELECT
              COALESCE(NULLIF(from_city,''), NULLIF(city,''), 'Unknown') as city_name,
              COALESCE(NULLIF(state,''), '') as state_name,
              COALESCE(NULLIF(country,''), 'India') as country_name,
              COUNT(DISTINCT guest_name) as guest_count,
              COUNT(*) as booking_count,
              ROUND(SUM(COALESCE(net,0)),0) as revenue
             FROM stays
             WHERE villa_id = ? AND status NOT IN ('cancelled')
             GROUP BY city_name, state_name, country_name
             ORDER BY guest_count DESC`
        const cityBinds = statYear ? [villaId, `${statYear}%`] : [villaId]
        const { results: cityRows } = await DB.prepare(cityQuery).bind(...cityBinds).all()

        // Purpose/category breakdown
        const { results: purposeRows } = await DB.prepare(
          `SELECT
            CASE
              WHEN LOWER(notes) LIKE '%wedding%'       THEN 'Wedding'
              WHEN LOWER(notes) LIKE '%temple%'
                OR LOWER(notes) LIKE '%guruvayur%'     THEN 'Temple / Pilgrimage'
              WHEN LOWER(notes) LIKE '%tourism%'
                OR LOWER(notes) LIKE '%holiday%'
                OR LOWER(notes) LIKE '%vacation%'      THEN 'Tourism'
              WHEN LOWER(notes) LIKE '%family%'        THEN 'Family Visit'
              WHEN LOWER(notes) LIKE '%arangettam%'    THEN 'Arangettam'
              WHEN LOWER(notes) LIKE '%kerala%'        THEN 'Kerala Tour'
              ELSE 'Other'
            END as purpose,
            COUNT(*) as bookings,
            COUNT(DISTINCT guest_name) as guests,
            ROUND(SUM(COALESCE(net,0)),0) as revenue
           FROM stays
           WHERE villa_id = ? AND status NOT IN ('cancelled')
           GROUP BY purpose ORDER BY bookings DESC`
        ).bind(villaId).all()

        // Channel breakdown — bookings + revenue
        const { results: channelRows } = await DB.prepare(
          `SELECT
            source as channel,
            COUNT(*) as bookings,
            COUNT(DISTINCT guest_name) as unique_guests,
            ROUND(SUM(COALESCE(gross,0)),0) as gross_revenue,
            ROUND(SUM(COALESCE(net,0)),0) as net_revenue,
            ROUND(SUM(COALESCE(commission_amt,0)),0) as total_commission
           FROM stays
           WHERE villa_id = ? AND status NOT IN ('cancelled')
           GROUP BY source ORDER BY net_revenue DESC`
        ).bind(villaId).all()

        // Stale data report
        const { results: staleRows } = await DB.prepare(
          `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN from_city IS NULL OR from_city = '' THEN 1 ELSE 0 END) as missing_city,
            SUM(CASE WHEN state IS NULL OR state = '' THEN 1 ELSE 0 END) as missing_state,
            SUM(CASE WHEN country IS NULL OR country = '' THEN 1 ELSE 0 END) as missing_country,
            SUM(CASE WHEN guest_phone IS NULL OR guest_phone = '' THEN 1 ELSE 0 END) as missing_phone,
            SUM(CASE WHEN guest_email IS NULL OR guest_email = '' THEN 1 ELSE 0 END) as missing_email
           FROM stays WHERE status NOT IN ('cancelled')`
        ).all()

        // Month-wise bookings for trend
        const { results: monthRows } = await DB.prepare(
          `SELECT
            strftime('%Y', checkin_date) as year,
            strftime('%m', checkin_date) as month,
            COALESCE(NULLIF(state,''), COALESCE(NULLIF(country,''),'India')) as region,
            COUNT(DISTINCT guest_name) as guests,
            COUNT(*) as bookings,
            ROUND(SUM(COALESCE(net,0)),0) as revenue
           FROM stays
           WHERE villa_id = ? AND status NOT IN ('cancelled')
             AND from_city IS NOT NULL AND from_city != ''
           GROUP BY year, month, region
           ORDER BY year DESC, month ASC`
        ).bind(villaId).all()

        return json({ success: true, data: {
          cities:   cityRows,
          purposes: purposeRows,
          channels: channelRows,
          stale:    staleRows[0] || {},
          monthlyByRegion: monthRows,
          statYear: statYear || 'all',
        }})
      }

      // GET OPEN STAYS — for Drive file watcher in Apps Script
      // Returns stays in booked/confirmed/docs_uploaded status with their folder IDs
      if (action === 'getOpenStays') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, drive_folder_id, drive_folder_url, status
           FROM stays
           WHERE status IN ('booked','confirmed','docs_uploaded')
           ORDER BY checkin_date ASC`
        ).all()
        return json({ success: true, data: results.map(r => ({
          stayId:        r.stay_id,
          guestName:     r.guest_name,
          checkinDate:   r.checkin_date,
          driveFolderId: r.drive_folder_id,
          driveFolderUrl:r.drive_folder_url,
          status:        r.status,
        }))})
      }

      // FIND OPEN STAY — match by guest name + check-in date for form submit trigger
      if (action === 'findOpenStay') {
        const guestName   = url.searchParams.get('guestName')   || ''
        const checkInDate = url.searchParams.get('checkInDate')  || ''
        const firstName   = guestName.split(' ')[0]
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights,
                  adults, children, guest_phone, guest_email,
                  drive_folder_id, drive_folder_url, status,
                  purpose_of_visit, mode_of_transport, vehicle_number, eta,
                  nationality, city, state, country,
                  request_early_checkin, request_late_checkout,
                  request_breakfast, breakfast_choice, request_cab,
                  govt_id_type, govt_id_num
           FROM stays
           WHERE guest_name LIKE ?
             AND status NOT IN ('cancelled','closed','checked_out')
           ORDER BY ABS(JULIANDAY(checkin_date) - JULIANDAY(?)) ASC
           LIMIT 1`
        ).bind(`%${firstName}%`, checkInDate || new Date().toISOString().slice(0,10)).all()
        if (results.length > 0) {
          const r = results[0]
          return json({ success: true, data: {
            stayId:           r.stay_id,
            guestName:        r.guest_name,
            checkinDate:      r.checkin_date,
            checkoutDate:     r.checkout_date,
            nights:           r.nights,
            adults:           r.adults,
            children:         r.children,
            phone:            r.guest_phone,
            email:            r.guest_email,
            driveFolderId:    r.drive_folder_id,
            driveFolderUrl:   r.drive_folder_url,
            status:           r.status,
            purposeOfVisit:   r.purpose_of_visit,
            modeOfTransport:  r.mode_of_transport,
            vehicleNumber:    r.vehicle_number,
            eta:              r.eta,
            nationality:      r.nationality,
            city:             r.city,
            state:            r.state,
            country:          r.country,
            requestEarlyCheckin: r.request_early_checkin,
            requestLateCheckout: r.request_late_checkout,
            requestBreakfast:    r.request_breakfast,
            breakfastChoice:     r.breakfast_choice,
            requestCab:          r.request_cab,
            govtIdType:          r.govt_id_type,
            govtIdNum:           r.govt_id_num,
          }})
        }
        return json({ success: true, data: null })
      }

      // FIND STAY FOR REVIEW MATCHING — called by Apps Script Gmail poller
      // Matches guest name + checkout within 14 days before reviewDate
      if (action === 'findStayForReview') {
        const guestName  = url.searchParams.get('guestName') || ''
        const reviewDate = url.searchParams.get('reviewDate') || ''
        if (!guestName || !reviewDate) return err('guestName and reviewDate required')

        const reviewDt = new Date(reviewDate)
        const windowStart = new Date(reviewDt)
        windowStart.setDate(windowStart.getDate() - 14)

        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkout_date FROM stays
           WHERE guest_name LIKE ?
             AND checkout_date >= ?
             AND checkout_date <= ?
             AND status NOT IN ('cancelled')
           ORDER BY checkout_date DESC LIMIT 1`
        ).bind(`%${guestName.split(' ')[0]}%`,
               windowStart.toISOString().slice(0,10),
               reviewDate).all()

        if (results.length > 0) {
          return json({ success: true, data: { stayId: results[0].stay_id, guestName: results[0].guest_name }})
        }
        return json({ success: true, data: null })
      }

      // RAMAN TODO — two lists for Raman's home screen
      // 1. Overdue: guests whose checkout_date has passed but stay is still open (checked_in / ready_for_checkout)
      // 2. Upcoming: guests checking in within next 7 days (confirmed / booked / ready_for_checkin)
      if (action === 'getRamanTodo') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'

        // Overdue — past checkout date, still open
        const { results: overdueRows } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, source, status
           FROM stays
           WHERE villa_id = ?
             AND status IN ('checked_in','ready_for_checkout','pending_review')
             AND checkout_date < date('now')
           ORDER BY checkout_date ASC`
        ).bind(villaId).all()

        // Upcoming check-ins — next 7 days, not yet checked in
        const { results: upcomingRows } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults, source, status
           FROM stays
           WHERE villa_id = ?
             AND status IN ('confirmed','booked','ready_for_checkin','pending_review')
             AND checkin_date >= date('now')
             AND checkin_date <= date('now', '+7 days')
           ORDER BY checkin_date ASC`
        ).bind(villaId).all()

        return json({ success: true, data: {
          overdue:  overdueRows.map(r => ({
            stayId:       r.stay_id,
            guestName:    r.guest_name,
            checkInDate:  r.checkin_date,
            checkOutDate: r.checkout_date,
            nights:       r.nights,
            adults:       r.adults,
            source:       r.source,
            status:       r.status,
            daysOver:     Math.floor((new Date() - new Date(r.checkout_date)) / 86400000),
          })),
          upcoming: upcomingRows.map(r => ({
            stayId:       r.stay_id,
            guestName:    r.guest_name,
            checkInDate:  r.checkin_date,
            checkOutDate: r.checkout_date,
            nights:       r.nights,
            adults:       r.adults,
            source:       r.source,
            status:       r.status,
            daysUntil:    Math.floor((new Date(r.checkin_date) - new Date()) / 86400000) + 1,
          })),
        }})
      }

      // UPCOMING STAYS — for Complete Booking screen
      // Returns stays checking in within next 30 days OR checked in within last 2 days
      // Excludes closed and cancelled
      if (action === 'getUpcomingStays') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const { results } = await DB.prepare(
          `SELECT * FROM stays
           WHERE villa_id = ?
             AND status NOT IN ('closed','cancelled','checked_out')
             AND (
               checkin_date >= date('now', '-2 days')
               OR status IN ('checked_in','ready_for_checkout','ready_for_checkin')
             )
           ORDER BY checkin_date ASC`
        ).bind(villaId).all()
        return json({ success: true, data: results })
      }

      // RENTAL AGREEMENTS — get tenant details for all rental properties
      if (action === 'getRentalAgreements') {
        const { results } = await DB.prepare(
          `SELECT * FROM rental_props ORDER BY prop_id`
        ).all()
        return json({ success: true, data: results })
      }

      // GET GUEST DOCUMENTS — for Apps Script to fetch and upload to Drive
      if (action === 'getGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        // Only return docs not yet uploaded to Drive (folder_created=0)
        const { results } = await DB.prepare(
          `SELECT doc_id, stay_id, doc_type, file_name, file_b64
           FROM guest_documents WHERE stay_id = ? AND folder_created = 0`
        ).bind(stayId).all()
        return json({ success: true, data: results })
      }

      // DUPLICATE BOOKINGS — audit log for channel sync analysis
      if (action === 'getDuplicateBookings') {
        const months = parseInt(url.searchParams.get('months') || '2')
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() - months)
        const cutoffStr = cutoff.toISOString().slice(0,10)
        const { results } = await DB.prepare(
          `SELECT * FROM duplicate_bookings
           WHERE detected_at >= ?
           ORDER BY detected_at DESC`
        ).bind(cutoffStr).all()
        // Group by channel for summary
        const byChannel = {}
        results.forEach(r => {
          const ch = r.new_source || 'unknown'
          if (!byChannel[ch]) byChannel[ch] = { channel: ch, count: 0, incidents: [] }
          byChannel[ch].count++
          byChannel[ch].incidents.push({
            dupId:         r.dup_id,
            detectedAt:    r.detected_at,
            existingGuest: r.existing_guest,
            existingDates: r.existing_checkin + ' → ' + r.existing_checkout,
            newGuest:      r.new_guest,
            newDates:      r.new_checkin + ' → ' + r.new_checkout,
            overlapNights: r.overlap_nights,
          })
        })
        return json({ success: true, data: {
          total: results.length,
          months,
          byChannel: Object.values(byChannel).sort((a,b) => b.count - a.count),
          all: results,
        }})
      }

      return err(`Unknown GET action: ${action}`, 404)
    }

      // PRADOSH HOME — quick info (next harvest, last price, irrigation alert)
      if (action === 'getPradoshQuickInfo') {
        const harvest = await ActiveDB.prepare(
          `SELECT harvest_date, price_per_kg, scheduled_harvest_date
           FROM coconut_harvests WHERE estate_id = 'pollachi'
           ORDER BY harvest_date DESC LIMIT 1`
        ).first()
        const irrigation = await ActiveDB.prepare(
          `SELECT logged_date FROM irrigation_logs
           WHERE estate = 'pollachi'
           ORDER BY logged_date DESC LIMIT 1`
        ).first()
        const today          = new Date().toISOString().slice(0, 10)
        const lastPrice      = harvest?.price_per_kg           || null
        const nextHarvest    = harvest?.scheduled_harvest_date || null
        const lastIrrigation = irrigation?.logged_date         || null
        const irrigationDays = lastIrrigation
          ? Math.round((new Date(today) - new Date(lastIrrigation)) / 86400000)
          : null
        const harvestDays = nextHarvest
          ? Math.round((new Date(nextHarvest) - new Date(today)) / 86400000)
          : null
        return json({ success: true, data: {
          nextHarvestDate:    nextHarvest,
          harvestDaysAway:    harvestDays,
          lastPricePerKg:     lastPrice,
          lastIrrigationDate: lastIrrigation,
          irrigationDaysAgo:  irrigationDays,
          irrigationAlert:    irrigationDays === null || irrigationDays > 14,
        }})
      }

    // ── POST ROUTES ─────────────────────────────────────
    if (method === 'POST') {
      const body = await request.json()

      // BOOKING
      if (action === 'createBooking') {
        const stayId = genStayId(body.villaId)
        const nights = parseInt(body.nights) || 1

        // ── EXISTING STAY MERGE ──────────────────────────────────────────
        // If a stay already exists for this guest+date (from a previous poller run,
        // guest form, or manual entry), update it with Airbnb financials rather
        // than creating a duplicate or triggering a double-booking alert.
        const firstName = (body.guestName || body.bookerName || '').split(' ')[0]
        const provisional = await DB.prepare(
          `SELECT stay_id, status FROM stays
           WHERE guest_name LIKE ? AND checkin_date = ?
             AND villa_id = ?
             AND status NOT IN ('cancelled','closed','checked_out')
           LIMIT 1`
        ).bind(`%${firstName}%`, body.checkInDate, body.villaId || 'dwarka').first()

        if (provisional) {
          // Update the existing stay with Airbnb financials
          await DB.prepare(`
            UPDATE stays SET
              source = 'airbnb',
              airbnb_conf = ?,
              gross = ?, commission_pct = ?, commission_amt = ?, net = ?,
              night_fee = ?, cleaning_fee = ?, host_service_fee = ?,
              you_earn = ?, guest_service_fee = ?, guest_paid_total = ?,
              checkout_date = COALESCE(NULLIF(checkout_date,''), ?),
              nights = COALESCE(NULLIF(nights,0), ?),
              adults = COALESCE(NULLIF(adults,0), ?),
              updated_by = ?, updated_at = datetime('now')
            WHERE stay_id = ?
          `).bind(
            body.airbnbConf || null,
            body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0,
            body.nightFee || 0, body.cleaningFee || 0, body.hostServiceFee || 0,
            body.youEarn || body.net || 0, body.guestServiceFee || 0, body.guestPaid || 0,
            body.checkOutDate || null, parseInt(body.nights) || 1,
            body.adults || 1,
            actor, provisional.stay_id
          ).run()
          console.log('Merged Airbnb financials into existing stay:', provisional.stay_id, '(was:', provisional.status, ')')
          return json({ success: true, data: { stayId: provisional.stay_id, merged: true, wasStatus: provisional.status } })
        }

        // ── DOUBLE-BOOKING CHECK ──────────────────────────────────────────
        // Check if any non-cancelled stay overlaps with the requested dates
        const conflict = await DB.prepare(`
          SELECT stay_id, guest_name, checkin_date, checkout_date, status, source, created_at
          FROM stays
          WHERE villa_id = ?
            AND status NOT IN ('cancelled','closed','checked_out')
            AND checkin_date  < ?
            AND checkout_date > ?
          LIMIT 1
        `).bind(body.villaId || 'dwarka', body.checkOutDate, body.checkInDate).first()

        if (conflict) {
          // ── DOUBLE BOOKING ALERT EMAIL ──────────────────────────────────
          // Send rich alert email to owner with full details of both bookings
          const alertSubject = '🚨 URGENT — Double booking detected! ' + (body.checkInDate || '')
          const alertBody = [
            '🚨 DOUBLE BOOKING DETECTED — IMMEDIATE ACTION REQUIRED',
            '='.repeat(60),
            '',
            'A new booking was BLOCKED because the villa is already booked',
            'for overlapping dates. Please contact both guests immediately.',
            '',
            'EXISTING BOOKING (already confirmed):',
            '-'.repeat(40),
            '  Stay ID  :  ' + conflict.stay_id,
            '  Guest    :  ' + conflict.guest_name,
            '  Check-in :  ' + conflict.checkin_date,
            '  Check-out:  ' + conflict.checkout_date,
            '  Status   :  ' + conflict.status,
            '  Source   :  ' + (conflict.source || 'unknown'),
            '  Booked   :  ' + (conflict.created_at || 'unknown'),
            '',
            'NEW BOOKING ATTEMPT (BLOCKED):',
            '-'.repeat(40),
            '  Guest    :  ' + (body.guestName || body.bookerName || 'unknown'),
            '  Check-in :  ' + (body.checkInDate || ''),
            '  Check-out:  ' + (body.checkOutDate || ''),
            '  Source   :  ' + (body.source || 'unknown'),
            '  Airbnb # :  ' + (body.airbnbConf || 'N/A'),
            '  Attempted:  ' + new Date().toISOString().replace('T',' ').slice(0,19) + ' UTC',
            '',
            'OVERLAPPING DATES:',
            '-'.repeat(40),
            '  Conflict period: ' + (body.checkInDate || '') + ' → ' + (body.checkOutDate || ''),
            '',
            'ACTION REQUIRED:',
            '-'.repeat(40),
            '  1. Contact the NEW guest immediately to apologise and cancel',
            '  2. Check all channel partners and BLOCK the dates',
            '  3. Review your calendar sync settings on Airbnb/MakeMyTrip/etc.',
            '  4. Log into portal to verify: manage.luxuryvillasofguruvayur.com',
            '',
            '='.repeat(60),
            'This is an automated alert from bgIndia Portal.',
            'Stay ID of existing booking: ' + conflict.stay_id,
          ].join('\n')

          // Send via MailChannels (free on Cloudflare Workers)
          try {
            await fetch('https://api.mailchannels.net/tx/v1/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{
                  to: [{ email: env.OWNER_EMAIL || 'kerala.luxuryvillas@gmail.com' }],
                  cc: [{ email: 'bijisukumar@gmail.com' }],
                }],
                from: { email: 'alerts@bgindia-portal.com', name: 'bgIndia Portal — URGENT' },
                subject: alertSubject,
                content: [{ type: 'text/plain', value: alertBody }],
              }),
            })
          } catch(emailErr) {
            console.error('Double booking alert email failed:', emailErr.message)
          }

          // Log to duplicate_bookings table for audit and channel sync analysis
          try {
            const dupId = `DUP-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
            const overlapNights = body.checkInDate && body.checkOutDate
              ? Math.max(0, Math.round(
                  (Math.min(new Date(conflict.checkout_date), new Date(body.checkOutDate)) -
                   Math.max(new Date(conflict.checkin_date), new Date(body.checkInDate))) / 86400000
                ))
              : 0
            await DB.prepare(`
              INSERT INTO duplicate_bookings (
                dup_id, villa_id, detected_at,
                existing_stay_id, existing_guest, existing_checkin, existing_checkout,
                existing_source, existing_booked_at,
                new_guest, new_checkin, new_checkout, new_source, new_airbnb_conf,
                overlap_nights
              ) VALUES (?,?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?)
            `).bind(
              dupId, body.villaId || 'dwarka',
              conflict.stay_id, conflict.guest_name,
              conflict.checkin_date, conflict.checkout_date,
              conflict.source || 'unknown', conflict.created_at || null,
              body.guestName || body.bookerName || 'unknown',
              body.checkInDate, body.checkOutDate,
              body.source || 'unknown', body.airbnbConf || null,
              overlapNights
            ).run()
            console.log('Duplicate booking logged:', dupId)
          } catch(logErr) {
            console.error('Failed to log duplicate:', logErr.message)
          }

          console.warn('DOUBLE BOOKING BLOCKED:', conflict.stay_id,
            'conflicts with new booking for', body.guestName, body.checkInDate)

          return json({
            success: false,
            error: `Double booking detected: ${conflict.guest_name} is already booked ` +
                   `${conflict.checkin_date} → ${conflict.checkout_date} (${conflict.stay_id}). ` +
                   `Owner has been alerted by email.`,
            conflict: {
              stayId:    conflict.stay_id,
              guestName: conflict.guest_name,
              checkIn:   conflict.checkin_date,
              checkOut:  conflict.checkout_date,
              status:    conflict.status,
              source:    conflict.source,
            }
          }, 409)
        }
        // ── END DOUBLE-BOOKING CHECK ──────────────────────────────────────

        await DB.prepare(`
          INSERT INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, children,
            tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status,
            home_address, city, state, country, from_city,
            night_fee, cleaning_fee, host_service_fee, you_earn, guest_service_fee, guest_paid_total,
            airbnb_conf,
            created_by, updated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          stayId, body.villaId || 'dwarka', body.source || (body.channel ? body.channel.toLowerCase().replace(/[^a-z]/g,'_') : 'direct'),
          body.guestName || body.bookerName, body.guestPhone || null, body.guestEmail || null,
          body.checkInDate, body.checkOutDate, nights,
          body.adults || 1, body.children || 0,
          body.tariffPerNight || 0, body.extraCharges || 0,
          body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0,
          body.homeAddress || null, body.city || null, body.state || null,
          body.country || 'India', body.fromCity || body.city || null,
          body.nightFee || 0, body.cleaningFee || 0, body.hostServiceFee || 0,
          body.youEarn || body.net || 0, body.guestServiceFee || 0, body.guestPaid || 0,
          body.airbnbConf || null,
          actor, actor
        ).run()
        // Raman commission is created at check-OUT (not here) to avoid
        // creating commission records for cancelled bookings
        return json({ success: true, data: { stayId } })
      }

      if (action === 'confirmCheckIn') {
        // If stayId provided, update that stay directly
        // Otherwise find the most recent confirmed stay for this guest (used by CheckIn screen)
        let stayId = body.stayId
        if (!stayId) {
          const found = await DB.prepare(
            `SELECT stay_id FROM stays WHERE guest_name = ? AND status IN ('confirmed','booked') ORDER BY checkin_date DESC LIMIT 1`
          ).bind(body.guestName || body.bookerName).first()
          stayId = found?.stay_id
        }
        // If still no stay, create one on the fly (CheckIn screen flow)
        if (!stayId) {
          stayId = genStayId(body.villaId || 'dwarka')
          await DB.prepare(`
            INSERT INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email,
              checkin_date, checkout_date, nights, adults, children, gross, net, status,
              created_by, updated_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,'checked_in',?,?,?,?)
          `).bind(
            stayId, body.villaId || 'dwarka', 'direct',
            body.guestName || body.bookerName,
            body.phone || null, body.email || null,
            body.checkInDate, body.checkOutDate,
            Math.max(1, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000)),
            body.adultsCount || 1, body.childrenCount || 0,
            actor, actor, now(), now()
          ).run()
        } else {
          await DB.prepare(
            `UPDATE stays SET status = 'checked_in', updated_by = ?, updated_at = ? WHERE stay_id = ?`
          ).bind(actor, now(), stayId).run()
        }
        return json({ success: true, data: { stayId } })
      }

      // CHECK-OUT: complete the stay lifecycle + create Raman commission
      if (action === 'checkOut') {
        const { stayId } = body

        // Mark stay as checked_out
        await DB.prepare(
          `UPDATE stays SET status = 'checked_out', updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(actor, now(), stayId).run()

        // Fetch stay details to calculate commission
        const stay = await DB.prepare(
          `SELECT guest_name, checkin_date, nights FROM stays WHERE stay_id = ?`
        ).bind(stayId).first()

        if (stay) {
          // Only create commission if one doesn't already exist for this stay
          const existing = await DB.prepare(
            `SELECT comm_id FROM raman_commissions WHERE stay_id = ?`
          ).bind(stayId).first()

          if (!existing) {
            const nights    = parseInt(stay.nights) || 1
            const ramanComm = nights > 1 ? 2000 : 1000
            await DB.prepare(
              `INSERT INTO raman_commissions
                 (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid,
                  created_by, updated_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, 'system', 'system', ?, ?)`
            ).bind(genId('RC'), stayId, stay.guest_name, stay.checkin_date, nights, ramanComm, now(), now()).run()
            return json({ success: true, data: { stayId, ramanComm, commissionCreated: true } })
          }
        }
        return json({ success: true, data: { stayId, commissionCreated: false } })
      }

      // CANCEL STAY: mark cancelled, never creates a commission
      if (action === 'cancelStay') {
        await DB.prepare(
          `UPDATE stays SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(actor, now(), body.stayId).run()
        // Also remove any erroneously created commission for this stay
        await DB.prepare(
          `DELETE FROM raman_commissions WHERE stay_id = ? AND is_paid = 0`
        ).bind(body.stayId).run()
        return json({ success: true })
      }

      // KITCHEN INCIDENTALS
      if (action === 'saveKitchenEntry') {
        const items = body.items || []
        for (const item of items) {
          await DB.prepare(`
            INSERT INTO stay_incidentals
              (item_id, stay_id, inv_item_id, name, qty, price_per_unit, total,
               created_by, updated_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
          `).bind(genId('INC'), body.stayId, item.itemId || item.inv_item_id || null,
                  item.name, item.qty || 1,
                  item.pricePerUnit || item.price || 0,
                  item.subtotal || item.total || 0,
                  actor, actor, now(), now()).run()
        }
        return json({ success: true })
      }

      // VILLA RENTAL INCOME (saves as a stay record)
      if (action === 'saveVillaRentalIncome') {
        // If stayId provided → UPDATE existing stay financials (CompleteBooking flow)
        // Otherwise → INSERT new closed stay (legacy VillaRentalIncome manual entry)
        if (body.stayId) {
          await DB.prepare(`
            UPDATE stays SET
              source             = COALESCE(NULLIF(?, ''), source),
              tariff_per_night   = ?,
              extra_charges      = ?,
              extra_lines        = ?,
              gross              = ?,
              commission_pct     = ?,
              commission_amt     = ?,
              net                = ?,
              night_fee          = COALESCE(NULLIF(?,0), night_fee),
              cleaning_fee       = COALESCE(NULLIF(?,0), cleaning_fee),
              host_service_fee   = COALESCE(NULLIF(?,0), host_service_fee),
              you_earn           = COALESCE(NULLIF(?,0), you_earn),
              guest_service_fee  = COALESCE(NULLIF(?,0), guest_service_fee),
              guest_paid_total   = COALESCE(NULLIF(?,0), guest_paid_total),
              updated_by = ?, updated_at = ?
            WHERE stay_id = ?
          `).bind(
            body.channel ? body.channel.toLowerCase().replace(/[^a-z]/g,'_') : null,
            body.tariffPerNight || 0,
            body.extraCharges   || 0,
            body.extraLines     || null,
            body.gross          || 0,
            body.commPct        || 0,
            body.commAmt        || 0,
            body.net            || 0,
            // Airbnb fee fields — only overwrite if provided
            body.airbnbFees ? JSON.parse(body.airbnbFees).nightFee        || 0 : 0,
            body.airbnbFees ? JSON.parse(body.airbnbFees).cleaningFee     || 0 : 0,
            body.airbnbFees ? JSON.parse(body.airbnbFees).hostServiceFee  || 0 : 0,
            body.airbnbFees ? JSON.parse(body.airbnbFees).youEarn         || 0 : 0,
            body.airbnbFees ? JSON.parse(body.airbnbFees).guestServiceFee || 0 : 0,
            body.airbnbFees ? JSON.parse(body.airbnbFees).guestPaid       || 0 : 0,
            actor, now(),
            body.stayId
          ).run()
          return json({ success: true, data: { stayId: body.stayId, updated: true } })
        }

        // Legacy: INSERT new closed stay (manual income entry from VillaRentalIncome screen)
        const stayId = genStayId(body.villaId || 'dwarka')
        await DB.prepare(`
          INSERT INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date,
            nights, gross, commission_pct, commission_amt, net, status,
            created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,'closed',?,?,?,?)
        `).bind(
          stayId, body.villaId || 'dwarka', (body.channel||'Direct').toLowerCase().replace('.','_').replace(' ','_'),
          body.guestName, body.checkInDate, body.checkOutDate,
          body.nights || 1, body.gross || 0, body.commPct || 0, body.commAmt || 0, body.net || 0,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { stayId } })
      }

      // RENTAL INCOME — supports multi-month range
      if (action === 'saveRentalIncome') {
        const { year, monthFrom, monthTo, properties } = body
        // monthFrom/monthTo = 0-indexed. If single month, monthTo = monthFrom
        const from = parseInt(monthFrom ?? body.month ?? 0)
        const to   = parseInt(monthTo   ?? body.month ?? from)
        for (let m = from; m <= to; m++) {
          for (let pi = 0; pi < properties.length; pi++) {
            const prop = properties[pi]
            const propId = `rental_${pi + 1}`
            const income = (parseFloat(prop.rent) || 0) + (parseFloat(prop.carParking) || 0)
            const expense = (parseFloat(prop.maintenance)||0) + (parseFloat(prop.electricity)||0) +
                            (parseFloat(prop.water)||0) + (parseFloat(prop.propertyTax)||0) +
                            (parseFloat(prop.landTax)||0) + (parseFloat(prop.extraMaintenance)||0)
            const net = income - expense
            const recId = `RI-${propId}-${year}-${String(m+1).padStart(2,'0')}`
            await DB.prepare(`
              INSERT OR REPLACE INTO rental_income
                (record_id, prop_id, month, year, rent, car_parking, maintenance, electricity,
                 water, property_tax, land_tax, extra_maintenance, net,
                 created_by, updated_by, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `).bind(
              recId, propId, m + 1, year,
              parseFloat(prop.rent)||0, parseFloat(prop.carParking)||0,
              parseFloat(prop.maintenance)||0, parseFloat(prop.electricity)||0,
              parseFloat(prop.water)||0, parseFloat(prop.propertyTax)||0,
              parseFloat(prop.landTax)||0, parseFloat(prop.extraMaintenance)||0, net,
              actor, actor, now(), now()
            ).run()
          }
        }
        return json({ success: true })
      }

      // COCONUT HARVEST
      if (action === 'saveCoconutHarvest') {
        const id = genId('CH')
        // Auto-calculate scheduled next harvest = harvest_date + 45 days
        const harvestDate = body.harvestDate
        const scheduledNext = harvestDate
          ? new Date(new Date(harvestDate).getTime() + 45 * 86400000).toISOString().slice(0, 10)
          : null
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
             next_harvest_date, scheduled_harvest_date, notes,
             created_by, updated_by, created_at, updated_at)
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
          body.nextHarvestDate||null, scheduledNext,
          body.notes||null,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { harvestId: id, scheduledNextHarvest: scheduledNext } })
      }

      // RUBBER HARVEST
      if (action === 'saveRubberHarvest') {
        const id = genId('RH')
        const gross = (parseFloat(body.weightKg)||0) * (parseFloat(body.pricePerKg)||0)
        const net   = gross - (parseFloat(body.expense)||0)
        await ActiveDB.prepare(`
          INSERT INTO rubber_harvests
            (harvest_id, estate_id, harvest_date, weight_kg, price_per_kg, gross, expense, net, notes,
             created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(id, 'pavutumuri', body.harvestDate, parseFloat(body.weightKg)||0,
                parseFloat(body.pricePerKg)||0, gross, parseFloat(body.expense)||0, net, body.notes||null,
                actor, actor, now(), now()).run()
        return json({ success: true, data: { harvestId: id } })
      }

      // UPDATE STAY LOCATION — called by GuestFormScript after form submission
      if (action === 'updateStayLocation') {
        const { stayId, homeAddress, city, state, country, fromCity, phone, email } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(
          `UPDATE stays
           SET home_address = ?, city = ?, state = ?, country = ?, from_city = ?,
               guest_phone = COALESCE(NULLIF(guest_phone,''), ?),
               guest_email = COALESCE(NULLIF(guest_email,''), ?),
               updated_by = 'auto', updated_at = ?
           WHERE stay_id = ?`
        ).bind(
          homeAddress||null, city||null, state||null, country||'India', fromCity||null,
          phone||null, email||null, now(), stayId
        ).run()
        return json({ success: true, data: { stayId, city, state, country } })
      }

      // UPDATE DRIVE FOLDER — called by Apps Script after folder creation
      if (action === 'updateDriveFolder') {
        const { stayId, driveFolderId, driveFolderUrl, processingNote } = body
        if (!stayId) return err('stayId required')
        // Set folder_created_at only on first time (when folder didn't exist before)
        const existing = await DB.prepare(
          `SELECT folder_created_at, processing_log FROM stays WHERE stay_id = ?`
        ).bind(stayId).first()
        const folderCreatedAt = existing?.folder_created_at || now()
        const prevLog = existing?.processing_log ? existing.processing_log + '\n' : ''
        const logEntry = now() + ' — Drive folder created: ' + (driveFolderUrl || '') +
          (processingNote ? ' | ' + processingNote : '')
        const setFolderCreated = body.folderCreated !== undefined ? (body.folderCreated ? 1 : 0) : (existing?.folder_created || 0)
        await DB.prepare(
          `UPDATE stays SET
            drive_folder_id   = ?,
            drive_folder_url  = ?,
            folder_created    = ?,
            folder_created_at = ?,
            processing_log    = ?,
            updated_by = 'auto', updated_at = datetime('now')
           WHERE stay_id = ?`
        ).bind(
          driveFolderId || null,
          driveFolderUrl || null,
          setFolderCreated,
          folderCreatedAt,
          prevLog + logEntry,
          stayId
        ).run()
        return json({ success: true, data: { stayId, driveFolderId, folderCreatedAt } })
      }

      // SAVE REVIEW — called by Apps Script when review email arrives
      if (action === 'saveReview') {
        const { stayId, rating, source, reviewDate, guestName } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(
          `UPDATE stays
           SET review_rating = ?, review_source = ?, review_date = ?,
               updated_by = ?, updated_at = ?
           WHERE stay_id = ?`
        ).bind(rating || 0, source || 'airbnb', reviewDate || now(),
               'auto', now(), stayId).run()
        return json({ success: true, data: { stayId, rating, source } })
      }

      // SET READY FOR CHECK-IN — called by Drive file watcher when both docs detected
      if (action === 'setReadyForCheckIn') {
        const { stayId } = body
        if (!stayId) return err('stayId required')
        // Only transition if currently in booked/confirmed/docs_uploaded
        const stay = await DB.prepare(
          `SELECT status FROM stays WHERE stay_id = ?`
        ).bind(stayId).first()
        if (!stay) return json({ success: true, data: { changed: false, reason: 'stay not found' }})
        if (!['booked','confirmed','docs_uploaded'].includes(stay.status)) {
          return json({ success: true, data: { changed: false, reason: 'already at ' + stay.status }})
        }
        await DB.prepare(
          `UPDATE stays SET status = 'ready_for_checkin', updated_by = 'auto', updated_at = ? WHERE stay_id = ?`
        ).bind(now(), stayId).run()
        return json({ success: true, data: { changed: true, stayId, status: 'ready_for_checkin' }})
      }

      // UPDATE STAY STATUS — used by Complete Booking and CheckIn screens
      // Allowed transitions enforced here for safety
      if (action === 'updateStayStatus') {
        const { stayId, status } = body
        const allowed = ['booked','confirmed','docs_uploaded','ready_for_checkin',
                         'checked_in','ready_for_checkout','checked_out','closed','cancelled']
        if (!stayId) return err('stayId required')
        if (!allowed.includes(status)) return err(`Invalid status: ${status}`)

        await DB.prepare(
          `UPDATE stays SET status = ?, updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(status, actor, now(), stayId).run()

        // Auto-create Raman commission when moving to checked_out
        if (status === 'checked_out') {
          const stay = await DB.prepare(
            `SELECT guest_name, checkin_date, nights FROM stays WHERE stay_id = ?`
          ).bind(stayId).first()
          if (stay) {
            const existing = await DB.prepare(
              `SELECT comm_id FROM raman_commissions WHERE stay_id = ?`
            ).bind(stayId).first()
            if (!existing) {
              const nights = parseInt(stay.nights) || 1
              const ramanComm = nights > 1 ? 2000 : 1000
              await DB.prepare(
                `INSERT INTO raman_commissions
                   (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid,
                    created_by, updated_by, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,0,'system','system',?,?)`
              ).bind(genId('RC'), stayId, stay.guest_name, stay.checkin_date,
                     nights, ramanComm, now(), now()).run()
            }
          }
        }

        return json({ success: true, data: { stayId, status } })
      }

      // BREAKFAST ENTRY
      if (action === 'saveBreakfastEntry') {
        const id = genId('BF')
        await DB.prepare(`
          INSERT INTO guest_requests
            (req_id, stay_id, type, detail, status,
             created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).bind(
          id, body.stayId, 'breakfast',
          JSON.stringify({
            date:        body.date,
            guestCount:  body.guestCount  || 1,
            ratePerPerson: body.ratePerPerson || 0,
            total:       body.total       || 0,
            notes:       body.notes       || '',
          }),
          'done', actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { id } })
      }

      // CAR RENTAL ENTRY
      if (action === 'saveCarRental') {
        const id = genId('CR')
        await DB.prepare(`
          INSERT INTO guest_requests
            (req_id, stay_id, type, detail, status,
             created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).bind(
          id, body.stayId, 'car_rental',
          JSON.stringify({
            date:        body.date,
            destination: body.destination || '',
            amount:      body.amount      || 0,
            commission:  body.commission  || 0,
            net:         body.net         || 0,
            notes:       body.notes       || '',
          }),
          'done', actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { id } })
      }

      // VILLA EXPENSE
      if (action === 'saveVillaExpense') {
        const id = genId('VE')
        await DB.prepare(`
          INSERT INTO guest_requests
            (req_id, stay_id, type, detail, status,
             created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).bind(
          id, body.stayId || null, 'villa_expense',
          JSON.stringify({
            villaId:     body.villaId    || 'dwarka',
            date:        body.date,
            category:    body.category   || '',
            amount:      body.amount     || 0,
            paidTo:      body.paidTo     || '',
            description: body.description|| '',
          }),
          'done', actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { id } })
      }

      // ESTATE LEDGER — income / expense entry (Pollachi & Pavutumuri)
      if (action === 'saveEstateTransaction') {
        const { estate, type, date, category, amount, paidTo, description } = body
        if (!estate || !type || !date || !category || !amount) {
          return err('Missing required fields: estate, type, date, category, amount', 400)
        }
        try {
          const id = genId('ET')
          await ActiveDB.prepare(`
            INSERT INTO estate_transactions
              (txn_id, estate, type, date, category, amount, paid_to, description,
               created_by, updated_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          `).bind(
            id, estate, type, date, category,
            parseFloat(amount) || 0,
            paidTo || null,
            description || null,
            actor, actor, now(), now()
          ).run()
          return json({ success: true, data: { id } })
        } catch (dbErr) {
          console.error('saveEstateTransaction error:', dbErr?.message)
          return err(`DB error: ${dbErr?.message || 'unknown'}`, 500)
        }
      }

      // ESTATE LEDGER — GET transactions
      if (action === 'getEstateTransactions') {
        const estate = url.searchParams.get('estate') || body?.estate
        const year   = url.searchParams.get('year')   || new Date().getFullYear()
        if (!estate) return err('estate param required', 400)
        const { results } = await ActiveDB.prepare(`
          SELECT * FROM estate_transactions
          WHERE estate = ? AND strftime('%Y', date) = ?
          ORDER BY date DESC
        `).bind(estate, String(year)).all()
        const income  = results.filter(r => r.type === 'income').reduce((s,r)  => s + r.amount, 0)
        const expense = results.filter(r => r.type === 'expense').reduce((s,r) => s + r.amount, 0)
        return json({ success: true, data: { transactions: results, income, expense, net: income - expense } })
      }

      // IRRIGATION LOG — record that Pradosh logged irrigation today
      if (action === 'logIrrigation') {
        const date = body?.date || new Date().toISOString().slice(0, 10)
        const id   = genId('IR')
        await ActiveDB.prepare(
          `INSERT INTO irrigation_logs (log_id, estate, logged_date, notes, created_by, created_at)
           VALUES (?, 'pollachi', ?, ?, ?, datetime('now'))`
        ).bind(id, date, body?.notes || null, actor).run()
        return json({ success: true, data: { logId: id, loggedDate: date } })
      }

      // Supports three modes:
      //   commIds: [...] — pay specific selected stays by their comm_id
      //   quarter: 'Q1 2026' — pay all stays in that quarter
      //   (neither)  — pay ALL unpaid stays
      if (action === 'markRamanPaid') {
        const today = new Date().toISOString().slice(0, 10)
        const paidDate = body.paidDate || today
        let result

        if (body.commIds && Array.isArray(body.commIds) && body.commIds.length > 0) {
          // Pay specific selected stays — run one UPDATE per id (D1 doesn't support IN with bind arrays)
          for (const commId of body.commIds) {
            await DB.prepare(
              `UPDATE raman_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ? WHERE comm_id = ? AND is_paid = 0`
            ).bind(paidDate, actor, now(), commId).run()
          }
        } else if (body.quarter) {
          // Pay all stays in a specific quarter
          const [q, y] = body.quarter.split(' ')
          const qNum   = parseInt(q.replace('Q',''))
          const mStart = String((qNum - 1) * 3 + 1).padStart(2, '0')
          const mEnd   = String(qNum * 3).padStart(2, '0')
          await DB.prepare(
            `UPDATE raman_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ?
             WHERE is_paid = 0
               AND strftime('%Y', checkin_date) = ?
               AND strftime('%m', checkin_date) BETWEEN ? AND ?`
          ).bind(paidDate, actor, now(), y, mStart, mEnd).run()
        } else {
          // Pay ALL outstanding
          await DB.prepare(
            `UPDATE raman_commissions SET is_paid = 1, paid_date = ?, updated_by = ?, updated_at = ? WHERE is_paid = 0`
          ).bind(paidDate, actor, now()).run()
        }

        // Return total paid in this batch
        const { results: totals } = await DB.prepare(
          `SELECT SUM(commission) as total FROM raman_commissions WHERE paid_date = ? AND is_paid = 1`
        ).bind(paidDate).all()
        return json({ success: true, data: { totalPaid: totals[0]?.total || 0 } })
      }

      // INVENTORY PRICES
      if (action === 'saveInventoryPrices') {
        const { villaId = 'dwarka', prices } = body
        for (const [itemId, p] of Object.entries(prices || {})) {
          await DB.prepare(`UPDATE inventory SET cost_price = ?, sell_price = ?, updated_by = ?, updated_at = ? WHERE item_id = ? AND villa_id = ?`)
            .bind(p.costPrice || 0, p.sellPrice || 0, actor, now(), itemId, villaId).run()
        }
        return json({ success: true })
      }

      if (action === 'saveInventoryRestock') {
        const { villaId = 'dwarka', entries } = body
        for (const e of (entries || [])) {
          await DB.prepare(`UPDATE inventory SET qty_in_stock = qty_in_stock + ?, last_restocked = ?, updated_by = ?, updated_at = ? WHERE item_id = ? AND villa_id = ?`)
            .bind(parseFloat(e.qty)||0, now(), actor, now(), e.id, villaId).run()
        }
        return json({ success: true })
      }

      // RENTAL AGREEMENTS — save tenant agreement for a rental property
      if (action === 'saveRentalAgreement') {
        const { propId, propName, location, tenantName, deposit, agreedRent, maintenance, leaseStart, leaseEnd, notes } = body
        if (!propId) return err('propId is required')
        const existing = await DB.prepare(
          `SELECT prop_id FROM rental_props WHERE prop_id = ?`
        ).bind(propId).first()
        if (existing) {
          await DB.prepare(
            `UPDATE rental_props
             SET tenant_name = ?, deposit = ?, agreed_rent = ?, maintenance_fee = ?,
                 lease_start = ?, lease_end = ?, notes = ?,
                 updated_by = ?, updated_at = ?
             WHERE prop_id = ?`
          ).bind(tenantName||'', deposit||0, agreedRent||0, maintenance||0,
                 leaseStart||null, leaseEnd||null, notes||null,
                 actor, now(), propId).run()
        } else {
          // New property — include name and location
          await DB.prepare(
            `INSERT INTO rental_props
               (prop_id, prop_name, location, tenant_name, deposit, agreed_rent, maintenance_fee,
                lease_start, lease_end, notes, created_by, updated_by, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(propId, propName||propId, location||'',
                 tenantName||'', deposit||0, agreedRent||0, maintenance||0,
                 leaseStart||null, leaseEnd||null, notes||null,
                 actor, actor, now(), now()).run()
        }
        return json({ success: true, data: { propId } })
      }


      // CREATE PROVISIONAL BOOKING — called by GuestFormScript when no match found
      if (action === 'createProvisionalBooking') {
        const guestName   = body.guestName || ''
        const checkInDate = body.checkInDate || ''
        if (!guestName || !checkInDate) return err('guestName and checkInDate required')

        // Duplicate guard: same villa + guest name + checkin date
        const existing = await DB.prepare(
          `SELECT stay_id FROM stays WHERE villa_id = ? AND guest_name = ? AND checkin_date = ? AND status != 'cancelled' LIMIT 1`
        ).bind(body.villaId || 'dwarka', guestName, checkInDate).first()
        if (existing) {
          return json({ success: true, data: { stayId: existing.stay_id, existed: true } })
        }

        const stayId = genStayId(body.villaId || 'dwarka')
        const nights = (body.checkInDate && body.checkOutDate)
          ? Math.max(1, Math.round((new Date(body.checkOutDate) - new Date(body.checkInDate)) / 86400000))
          : 1

        await DB.prepare(`
          INSERT INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, children, gross, net, status,
            created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,1,0,0,0,'pending_review',?,?,?,?)
        `).bind(
          stayId, body.villaId || 'dwarka', body.source || 'guest_form',
          guestName, body.guestPhone || null, body.guestEmail || null,
          checkInDate, body.checkOutDate || null, nights,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { stayId, created: true } })
      }

      // APPROVE PENDING BOOKING — owner approves provisional → ready_for_checkin
      if (action === 'approvePendingBooking') {
        const { stayId } = body
        if (!stayId) return err('stayId required')
        const stay = await DB.prepare(`SELECT status FROM stays WHERE stay_id = ?`).bind(stayId).first()
        if (!stay) return err('Stay not found', 404)
        if (!['booked','confirmed','docs_uploaded','pending_review'].includes(stay.status)) {
          return json({ success: true, data: { changed: false, reason: 'already at ' + stay.status } })
        }
        await DB.prepare(
          `UPDATE stays SET status = 'ready_for_checkin', updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(actor, now(), stayId).run()
        return json({ success: true, data: { stayId, status: 'ready_for_checkin' } })
      }

      // CLEANUP EXPIRED DOCUMENTS — deletes guest_documents older than 24hrs
      // where folder_created=1 (safely stored in Drive)
      // Called at end of every processPendingCheckInForms run
      if (action === 'cleanupExpiredDocuments') {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString().slice(0, 19).replace('T', ' ')
        const result = await DB.prepare(
          `DELETE FROM guest_documents
           WHERE folder_created = 1
             AND created_at < ?`
        ).bind(cutoff).run()
        return json({ success: true, data: { deleted: result.changes || 0, cutoff } })
      }

      // MARK DOCUMENT UPLOADED — sets folder_created=1 on doc after Drive upload
      if (action === 'markDocumentUploaded') {
        const { docId } = body
        if (!docId) return err('docId required')
        await DB.prepare(
          `UPDATE guest_documents SET folder_created = 1 WHERE doc_id = ?`
        ).bind(docId).run()
        return json({ success: true, data: { docId, marked: true } })
      }

      // DELETE GUEST DOCUMENTS — called by Apps Script after uploading to Drive
      // Cleans up base64 image data from D1 once safely stored in Drive
      if (action === 'deleteGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || body?.stayId || ''
        if (!stayId) return err('stayId required')
        await DB.prepare(
          `DELETE FROM guest_documents WHERE stay_id = ?`
        ).bind(stayId).run()
        Logger.log && console.log('Cleaned guest_documents for', stayId)
        return json({ success: true, data: { stayId, cleaned: true } })
      }

      // GET GUEST DOCUMENTS — for Apps Script to fetch and upload to Drive
      if (action === 'getGuestDocuments') {
        const stayId = url.searchParams.get('stayId') || ''
        if (!stayId) return err('stayId required')
        // Only return docs not yet uploaded to Drive (folder_created=0)
        const { results } = await DB.prepare(
          `SELECT doc_id, stay_id, doc_type, file_name, file_b64
           FROM guest_documents WHERE stay_id = ? AND folder_created = 0`
        ).bind(stayId).all()
        return json({ success: true, data: results })
      }

      // GET PENDING REVIEW STAYS — for owner portal block (pre-checkin pending)
      // These are stays awaiting owner approval before check-in
      if (action === 'getPendingReviewStays') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights,
                  guest_phone, guest_email, drive_folder_url, created_at,
                  folder_created, folder_created_at
           FROM stays
           WHERE status = 'pending_review'
             AND (checkout_date IS NULL OR checkout_date >= date('now'))
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
        })) })
      }

      // GET REVIEW CHASE LIST — stays past checkout awaiting a review
      // Includes: checked_out + pending_review past checkout_date, no review yet
      // Auto-close candidates: review_chased_at > 20 days ago (or never chased > 20 days post-checkout)
      if (action === 'getReviewChaseList') {
        const { results } = await DB.prepare(
          `SELECT stay_id, guest_name, checkin_date, checkout_date, nights, adults,
                  source, guest_phone, review_rating, review_date,
                  review_chased_at, review_chase_count
           FROM stays
           WHERE status IN ('checked_out','pending_review')
             AND checkout_date < date('now')
             AND (review_rating IS NULL OR review_rating = 0)
           ORDER BY checkout_date DESC`
        ).all()

        const today = new Date()
        return json({ success: true, data: results.map(r => {
          const checkout    = new Date(r.checkout_date)
          const daysOut     = Math.floor((today - checkout) / 86400000)
          const lastChased  = r.review_chased_at ? new Date(r.review_chased_at) : null
          const daysSinceChase = lastChased ? Math.floor((today - lastChased) / 86400000) : null
          const autoCloseReady = daysOut >= 20
          return {
            stayId:          r.stay_id,
            guestName:       r.guest_name,
            checkIn:         r.checkin_date,
            checkOut:        r.checkout_date,
            nights:          r.nights,
            adults:          r.adults,
            source:          r.source,
            phone:           r.guest_phone,
            reviewRating:    r.review_rating || 0,
            reviewDate:      r.review_date || null,
            chasedAt:        r.review_chased_at || null,
            chaseCount:      r.review_chase_count || 0,
            daysSinceChase,
            daysOut,
            autoCloseReady,  // true when 20+ days past checkout with no review
          }
        }) })
      }

      // MARK REVIEW CHASED — record that WhatsApp was sent
      if (action === 'markReviewChased') {
        const { stayId } = body
        if (!stayId) return err('stayId required')
        await DB.prepare(
          `UPDATE stays
           SET review_chased_at   = ?,
               review_chase_count = COALESCE(review_chase_count, 0) + 1,
               updated_by = ?, updated_at = ?
           WHERE stay_id = ?`
        ).bind(now(), actor, now(), stayId).run()
        return json({ success: true, data: { stayId, chasedAt: now() } })
      }

      // CLOSE STAY WITH REVIEW — owner manually sets star rating and closes
      // Also used for auto-close (rating = 0, closedReason = 'no_review')
      if (action === 'closeStayWithReview') {
        const { stayId, rating, closedReason } = body
        if (!stayId) return err('stayId required')

        await DB.prepare(
          `UPDATE stays
           SET status         = 'closed',
               review_rating  = ?,
               review_source  = ?,
               review_date    = ?,
               updated_by = ?, updated_at = ?
           WHERE stay_id = ?`
        ).bind(
          rating || 0,
          closedReason === 'no_review' ? 'none' : 'manual',
          rating ? now().substring(0,10) : null,
          actor, now(), stayId
        ).run()

        return json({ success: true, data: { stayId, status: 'closed', rating: rating || 0 } })
      }


      // RESOLVE CHECKIN LINK — handled in public section above auth guard

      // GET ALL CHECKIN LINKS — owner only (auth required below)
      if (action === 'getCheckinLinks') {
        const { results } = await DB.prepare(
          `SELECT token, villa_id, partner, label, is_active, use_count, created_at
           FROM checkin_links ORDER BY villa_id, partner`
        ).all()
        return json({ success: true, data: results })
      }

      // CREATE CHECKIN LINK
      if (action === 'createCheckinLink') {
        const { villaId = 'dwarka', partner: p, label: lbl } = body
        if (!p) return err('partner required')
        // Generate short token: villa prefix + random
        const rand = Math.random().toString(36).slice(2,7)
        const newToken = `${villaId.slice(0,3)}-${p.slice(0,3)}-${rand}`
        await DB.prepare(
          `INSERT INTO checkin_links (token, villa_id, partner, label, created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?)`
        ).bind(newToken, villaId, p, lbl||p, actor, now(), now()).run()
        return json({ success: true, data: { token: newToken } })
      }

      // TOGGLE CHECKIN LINK active/inactive
      if (action === 'toggleCheckinLink') {
        const { token: linkToken } = body
        if (!linkToken) return err('token required')
        const link = await DB.prepare(`SELECT is_active FROM checkin_links WHERE token = ?`).bind(linkToken).first()
        if (!link) return err('Link not found', 404)
        await DB.prepare(
          `UPDATE checkin_links SET is_active = ?, updated_at = ? WHERE token = ?`
        ).bind(link.is_active ? 0 : 1, now(), linkToken).run()
        return json({ success: true, data: { token: linkToken, is_active: !link.is_active } })
      }

      return err(`Unknown POST action: ${action}`, 404)
    }

    return err('Method not allowed', 405)

  } catch (e) {
    console.error('Worker error:', e)
    return json({ success: false, error: e.message }, 500)
  }
}
