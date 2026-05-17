// ============================================================
//  bgIndia Portal — Cloudflare Pages Function (D1 Worker)
//  File: functions/api/[[route]].js
//  This catches ALL requests to /api/* and routes them.
//  D1 binding name: bgindia_db (matches wrangler.toml)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
  const DB = env.bgindia_db

  // ── AUDIT: resolve who is making this request ──────────
  // The client sends X-Actor header with the role of the logged-in user.
  // Allowed values: owner | raman | pradosh | auto | system
  // Falls back to 'owner' if header is absent (e.g. direct API calls).
  const actor = (() => {
    const h = request.headers.get('X-Actor') || ''
    const allowed = ['owner', 'raman', 'pradosh', 'auto', 'system']
    return allowed.includes(h) ? h : 'owner'
  })()
  const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

  // OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const url    = new URL(request.url)
  // Strip /api/ prefix to get the action
  const action = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')
  const method = request.method

  try {
    // ── GET ROUTES ──────────────────────────────────────
    if (method === 'GET') {

      // STAYS
      if (action === 'getStays') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const year    = url.searchParams.get('year') || new Date().getFullYear()
        const { results } = await DB.prepare(
          `SELECT * FROM stays WHERE villa_id = ? AND checkin_date LIKE ? ORDER BY checkin_date DESC`
        ).bind(villaId, `${year}%`).all()
        return json({ success: true, data: results })
      }

      if (action === 'getActiveStay') {
        const villaId = url.searchParams.get('villaId') || 'dwarka'
        const stay = await DB.prepare(
          `SELECT * FROM stays WHERE villa_id = ? AND status = 'checked_in' ORDER BY checkin_date DESC LIMIT 1`
        ).bind(villaId).first()
        return json({ success: true, data: stay || null })
      }

      if (action === 'getPendingCheckIns') {
        const { results } = await DB.prepare(
          `SELECT * FROM stays WHERE status = 'confirmed' ORDER BY checkin_date ASC`
        ).all()
        return json({ success: true, data: results })
      }

      if (action === 'getGuests') {
        const { results } = await DB.prepare(
          `SELECT DISTINCT guest_name, guest_phone, guest_email, source,
            MAX(checkin_date) as last_stay, COUNT(*) as total_stays, SUM(net) as total_spent
           FROM stays WHERE status != 'cancelled'
           GROUP BY guest_name ORDER BY last_stay DESC`
        ).all()
        return json({ success: true, data: results })
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
        const totalComm      = stays.reduce((s, r) => s + (r.commission_amt || 0), 0)
        const byChannel      = {}
        stays.forEach(s => {
          if (!byChannel[s.source]) byChannel[s.source] = { bookings: 0, net: 0 }
          byChannel[s.source].bookings++
          byChannel[s.source].net += (s.net || 0)
        })
        return json({ success: true, data: { totalBookings, totalNights, grossRevenue, totalNet, totalComm, byChannel, stays } })
      }

      // RAMAN COMMISSION
      if (action === 'getRamanUnpaid') {
        const { results } = await DB.prepare(
          `SELECT * FROM raman_commissions WHERE is_paid = 0 ORDER BY checkin_date ASC`
        ).all()
        const totalUnpaid = results.reduce((s, r) => s + (r.commission || 0), 0)
        // Group by quarter
        const quarters = {}
        results.forEach(r => {
          const d = new Date(r.checkin_date)
          const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
          if (!quarters[q]) quarters[q] = { label: q, stays: [], total: 0 }
          quarters[q].stays.push({ guestName: r.guest_name, checkIn: r.checkin_date, nights: r.nights, ramanComm: r.commission, commId: r.comm_id })
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
          ? await DB.prepare(query).bind(...binds).all()
          : await DB.prepare(query).all()
        const totalHarvests  = results.length
        const totalCount     = results.reduce((s, r) => s + (r.total_nuts || 0), 0)
        const grossRevenue   = results.reduce((s, r) => s + (r.total_earnings || 0), 0)
        const netIncome      = results.reduce((s, r) => s + (r.net_income || 0), 0)
        const totalExpense   = results.reduce((s, r) => s + (r.total_expense || 0), 0)
        const harvests = results.map(r => ({
          date: r.harvest_date, monthShort: new Date(r.harvest_date).toLocaleString('en-IN',{month:'short'}),
          year: new Date(r.harvest_date).getFullYear(),
          count: r.total_nuts, weight: r.total_weight_kg, pricePerKg: r.price_per_kg,
          harvester: r.harvester_name, netIncome: r.net_income, balanceDue: r.balance_due
        }))
        return json({ success: true, data: { totalHarvests, totalCount, grossRevenue, netIncome, totalExpense, harvests } })
      }

      // RUBBER
      if (action === 'getRubberHarvests') {
        const year = url.searchParams.get('year') || new Date().getFullYear()
        const { results } = await DB.prepare(
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

      // RENTAL AGREEMENTS — get tenant details for all rental properties
      if (action === 'getRentalAgreements') {
        const { results } = await DB.prepare(
          `SELECT * FROM rental_props ORDER BY prop_id`
        ).all()
        return json({ success: true, data: results })
      }

      return err(`Unknown GET action: ${action}`, 404)
    }

    // ── POST ROUTES ─────────────────────────────────────
    if (method === 'POST') {
      const body = await request.json()

      // BOOKING
      if (action === 'createBooking') {
        const stayId = genStayId(body.villaId)
        const nights = parseInt(body.nights) || 1
        await DB.prepare(`
          INSERT INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email,
            checkin_date, checkout_date, nights, adults, children,
            tariff_per_night, extra_charges, gross, commission_pct, commission_amt, net, status,
            created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,?,?)
        `).bind(
          stayId, body.villaId || 'dwarka', body.source || 'direct',
          body.guestName, body.guestPhone || null, body.guestEmail || null,
          body.checkInDate, body.checkOutDate, nights,
          body.adults || 1, body.children || 0,
          body.tariffPerNight || 0, body.extraCharges || 0,
          body.gross || 0, body.commissionPct || 0, body.commissionAmt || 0, body.net || 0,
          actor, actor, now(), now()
        ).run()
        // Raman commission is created at check-OUT (not here) to avoid
        // creating commission records for cancelled bookings
        return json({ success: true, data: { stayId } })
      }

      if (action === 'confirmCheckIn') {
        await DB.prepare(
          `UPDATE stays SET status = 'checked_in', updated_by = ?, updated_at = ? WHERE stay_id = ?`
        ).bind(actor, now(), body.stayId).run()
        return json({ success: true })
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
          `).bind(genId('INC'), body.stayId, item.itemId || null, item.name, item.qty, item.pricePerUnit, item.subtotal,
                  actor, actor, now(), now()).run()
        }
        return json({ success: true })
      }

      // VILLA RENTAL INCOME (saves as a stay record)
      if (action === 'saveVillaRentalIncome') {
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
        await DB.prepare(`
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
             next_harvest_date, notes,
             created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
          body.nextHarvestDate||null, body.notes||null,
          actor, actor, now(), now()
        ).run()
        return json({ success: true, data: { harvestId: id } })
      }

      // RUBBER HARVEST
      if (action === 'saveRubberHarvest') {
        const id = genId('RH')
        const gross = (parseFloat(body.weightKg)||0) * (parseFloat(body.pricePerKg)||0)
        const net   = gross - (parseFloat(body.expense)||0)
        await DB.prepare(`
          INSERT INTO rubber_harvests
            (harvest_id, estate_id, harvest_date, weight_kg, price_per_kg, gross, expense, net, notes,
             created_by, updated_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(id, 'pavutumuri', body.harvestDate, parseFloat(body.weightKg)||0,
                parseFloat(body.pricePerKg)||0, gross, parseFloat(body.expense)||0, net, body.notes||null,
                actor, actor, now(), now()).run()
        return json({ success: true, data: { harvestId: id } })
      }

      // RAMAN — MARK PAID
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
        const { propId, tenantName, deposit, agreedRent, maintenance, leaseStart, leaseEnd, notes } = body
        if (!propId) return err('propId is required')
        // Upsert: update if exists, insert if not
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
          await DB.prepare(
            `INSERT INTO rental_props
               (prop_id, tenant_name, deposit, agreed_rent, maintenance_fee, lease_start, lease_end, notes,
                created_by, updated_by, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(propId, tenantName||'', deposit||0, agreedRent||0, maintenance||0,
                 leaseStart||null, leaseEnd||null, notes||null,
                 actor, actor, now(), now()).run()
        }
        return json({ success: true, data: { propId } })
      }

      return err(`Unknown POST action: ${action}`, 404)
    }

    return err('Method not allowed', 405)

  } catch (e) {
    console.error('Worker error:', e)
    return json({ success: false, error: e.message }, 500)
  }
}
