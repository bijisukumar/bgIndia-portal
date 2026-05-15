import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const TEST_PREFIX = 'TEST-' + new Date().toISOString().split('T')[0]
const TEST_GUEST  = 'Test Guest (DELETE ME)'
const TEST_DATE_IN  = new Date(Date.now() + 86400000).toISOString().split('T')[0] // tomorrow
const TEST_DATE_OUT = new Date(Date.now() + 172800000).toISOString().split('T')[0] // +2 days

const TESTS = [
  {
    id: 1, name: 'API Connection', group: 'Infrastructure',
    fn: async () => {
      const stays = await api.getStays('dwarka', new Date().getFullYear())
      if (!Array.isArray(stays)) throw new Error('Invalid response from API')
      return 'API connected and responding ✓'
    }
  },
  {
    id: 2, name: 'Create Booking (New Booking screen)', group: 'Owner Flow',
    fn: async () => {
      const res = await api.createBooking({
        bookerName: TEST_GUEST, villaId: 'dwarka',
        checkInDate: TEST_DATE_IN, checkOutDate: TEST_DATE_OUT,
        nights: 1, guestCount: 2, channel: 'Direct',
        gross: 1, commPct: 0, commAmt: 0, net: 1,
        tariffPerNight: 1, extraCharges: 0, status: 'booked',
      })
      if (!res?.stayId) throw new Error('No Stay ID returned')
      window.__TEST_STAY_ID__ = res.stayId
      return `Stay ID: ${res.stayId} ✓`
    }
  },
  {
    id: 3, name: 'Get Pending Check-ins', group: 'Raman Flow',
    fn: async () => {
      const rows = await api.getPendingCheckIns()
      if (!Array.isArray(rows)) throw new Error('Not an array')
      return `${rows.length} pending check-in(s) loaded ✓`
    }
  },
  {
    id: 4, name: 'Confirm Check-in', group: 'Raman Flow',
    fn: async () => {
      const res = await api.confirmCheckIn({
        villaId: 'dwarka',
        guestName: TEST_GUEST, bookerName: TEST_GUEST,
        checkInDate: TEST_DATE_IN, checkOutDate: TEST_DATE_OUT,
        adultsCount: 2, childrenCount: 0, infantsCount: 0,
        citizenship: 'Indian', govtId: 'TEST-ID-001',
        phone: '9999999999', email: 'test@test.com',
        channel: 'Direct', breakfastPrepaid: 'No',
        additionalGuests: 'No', transport: 'No',
        purpose: 'Testing', eta: '4 PM', carNumber: 'KL00TEST',
      })
      if (!res?.stayId) throw new Error('No Stay ID returned')
      window.__CHECKIN_STAY_ID__ = res.stayId
      return `Stay ID: ${res.stayId} ✓`
    }
  },
  {
    id: 5, name: 'Get Active Stay', group: 'Raman Flow',
    fn: async () => {
      const stay = await api.getActiveStay('dwarka')
      if (!stay?.stayId) throw new Error('No active stay found')
      return `Active: ${stay.guestName} (${stay.stayId}) ✓`
    }
  },
  {
    id: 6, name: 'Save Kitchen Entry', group: 'Raman Flow',
    fn: async () => {
      const stay = await api.getActiveStay('dwarka')
      await api.saveKitchenEntry({
        stayId: stay?.stayId, guestName: stay?.guestName,
        items: [{ name:'Water', qty:2, price:1, subtotal:2 }],
        totalAmount: 1, notes: 'TEST ENTRY DELETE ME',
      })
      return 'Kitchen entry saved ✓'
    }
  },
  {
    id: 7, name: 'Save Breakfast Entry', group: 'Raman Flow',
    fn: async () => {
      const stay = await api.getActiveStay('dwarka')
      await api.saveBreakfastEntry({
        stayId: stay?.stayId, guestName: stay?.guestName,
        date: TEST_DATE_IN, guestCount: 2, ratePerPerson: 1, total: 1,
      })
      return 'Breakfast entry saved ✓'
    }
  },
  {
    id: 8, name: 'Save Car Rental', group: 'Raman Flow',
    fn: async () => {
      const stay = await api.getActiveStay('dwarka')
      await api.saveCarRental({
        stayId: stay?.stayId, guestName: stay?.guestName,
        date: TEST_DATE_IN, destination: 'Test Destination',
        amount: 1, commission: 0, net: 1, notes: 'TEST DELETE ME',
      })
      return 'Car rental saved ✓'
    }
  },
  {
    id: 9, name: 'Get Stays (Dashboard data)', group: 'Owner Dashboard',
    fn: async () => {
      const stays = await api.getStays('dwarka', new Date().getFullYear())
      if (!Array.isArray(stays)) throw new Error('Not an array')
      return `${stays.length} stay(s) loaded for this year ✓`
    }
  },
  {
    id: 10, name: 'Get Villa Dashboard', group: 'Owner Dashboard',
    fn: async () => {
      const d = await api.getVillaDashboard('dwarka', 2023)
      if (!d?.months) throw new Error('No months data returned')
      const total = Object.values(d.months).reduce((s,m) => s+(m.revenue||0), 0)
      const bookings = Object.values(d.months).reduce((s,m) => s+(m.bookings||0), 0)
      return `2023: ${bookings} bookings · ₹${Math.round(total).toLocaleString('en-IN')} revenue ✓`
    }
  },
  {
    id: 11, name: 'Get Guests (Repository)', group: 'Owner Dashboard',
    fn: async () => {
      const guests = await api.getGuests()
      if (!Array.isArray(guests)) throw new Error('Not an array')
      return `${guests.length} guest(s) in repository ✓`
    }
  },
  {
    id: 12, name: 'Get Raman Unpaid', group: 'R-Dashboard',
    fn: async () => {
      const d = await api.getRamanUnpaid()
      if (d?.totalUnpaid === undefined) throw new Error('No unpaid data')
      return `Unpaid: ₹${d.totalUnpaid?.toLocaleString('en-IN')} across ${d.unpaidCount} stays ✓`
    }
  },
  {
    id: 13, name: 'Get Raman History', group: 'R-Dashboard',
    fn: async () => {
      const h = await api.getRamanHistory()
      if (!Array.isArray(h)) throw new Error('Not an array')
      return `${h.length} historical payment(s) found ✓`
    }
  },
  {
    id: 14, name: 'Save Villa Expense', group: 'Owner Flow',
    fn: async () => {
      await api.saveVillaExpense({
        villaId: 'dwarka', date: TEST_DATE_IN,
        category: 'TEST-EXPENSE-DELETE-ME', amount: 1, paidTo: 'Test', description: 'Test only',
      })
      return 'Villa expense saved ✓'
    }
  },
  {
    id: 15, name: 'Get Coconut Harvests', group: 'Estate',
    fn: async () => {
      const d = await api.getCoconutHarvests(new Date().getFullYear())
      return `${d?.totalHarvests || 0} harvest(s) this year ✓`
    }
  },
  {
    id: 16, name: 'Get Rubber Harvests', group: 'Estate',
    fn: async () => {
      const h = await api.getRubberHarvests(new Date().getFullYear())
      if (!Array.isArray(h)) throw new Error('Not an array')
      return `${h.length} rubber entry(s) this year ✓`
    }
  },
]

const GROUP_COLORS = {
  'Infrastructure': '#185FA5',
  'Owner Flow':     '#C8903A',
  'Raman Flow':     '#34A853',
  'Owner Dashboard':'#8B5CF6',
  'R-Dashboard':    '#C8903A',
  'Estate':         '#3B6D11',
}

export default function TestRunner() {
  const navigate = useNavigate()
  const [results, setResults]   = useState({})
  const [running, setRunning]   = useState(false)
  const [current, setCurrent]   = useState(null)

  const runAll = async () => {
    setRunning(true)
    setResults({})
    for (const test of TESTS) {
      setCurrent(test.id)
      try {
        const msg = await test.fn()
        setResults(r => ({ ...r, [test.id]: { status:'pass', msg } }))
      } catch (e) {
        setResults(r => ({ ...r, [test.id]: { status:'fail', msg: e.message } }))
      }
      await new Promise(r => setTimeout(r, 500))
    }
    setCurrent(null)
    setRunning(false)
  }

  const runOne = async (test) => {
    setCurrent(test.id)
    try {
      const msg = await test.fn()
      setResults(r => ({ ...r, [test.id]: { status:'pass', msg } }))
    } catch(e) {
      setResults(r => ({ ...r, [test.id]: { status:'fail', msg: e.message } }))
    }
    setCurrent(null)
  }

  const passed = Object.values(results).filter(r => r.status==='pass').length
  const failed = Object.values(results).filter(r => r.status==='fail').length
  const total  = Object.keys(results).length

  const groups = [...new Set(TESTS.map(t => t.group))]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div>
          <div className="topbar-title">Test Runner</div>
          <div className="topbar-sub">END-TO-END VALIDATION · OWNER ONLY</div>
        </div>
        <div style={{width:34}}/>
      </div>

      <div className="screen-body">
        {/* Summary */}
        {total > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
            <div style={{ background:'rgba(52,168,83,0.1)', border:'1px solid rgba(52,168,83,0.3)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
              <div style={{ color:'var(--green)', fontSize:'1.6rem', fontWeight:'800' }}>{passed}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>PASSED</div>
            </div>
            <div style={{ background:'rgba(229,57,53,0.1)', border:'1px solid rgba(229,57,53,0.3)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
              <div style={{ color:'var(--red)', fontSize:'1.6rem', fontWeight:'800' }}>{failed}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>FAILED</div>
            </div>
            <div style={{ background:'rgba(200,144,58,0.1)', border:'1px solid rgba(200,144,58,0.3)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
              <div style={{ color:'var(--gold)', fontSize:'1.6rem', fontWeight:'800' }}>{total}</div>
              <div style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>RAN</div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div style={{ background:'rgba(229,57,53,0.08)', border:'1px solid rgba(229,57,53,0.2)', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px' }}>
          <div style={{ color:'var(--red)', fontSize:'0.78rem', fontWeight:'700', marginBottom:'4px' }}>⚠️ TEST DATA NOTICE</div>
          <div style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>
            Tests create real records with ₹1 amounts. After testing, go to Master Sheet and delete rows where guestName = "{TEST_GUEST}" or category = "TEST-EXPENSE-DELETE-ME".
          </div>
        </div>

        <button className="btn btn-gold" onClick={runAll} disabled={running} style={{ marginBottom:'16px' }}>
          {running ? `Running test ${current} of ${TESTS.length}...` : '▶ Run All Tests'}
        </button>

        {/* Test groups */}
        {groups.map(group => (
          <div key={group}>
            <div className="card-section-label" style={{ color: GROUP_COLORS[group] }}>{group}</div>
            <div style={{ background:'var(--dark-card)', borderRadius:'12px', border:'1px solid var(--border-dim)', overflow:'hidden', marginBottom:'12px' }}>
              {TESTS.filter(t => t.group === group).map((test, i, arr) => {
                const r = results[test.id]
                const isRunning = current === test.id
                return (
                  <div key={test.id} style={{
                    padding:'12px 16px',
                    borderBottom: i < arr.length-1 ? '1px solid var(--border-dim)' : 'none',
                    display:'flex', justifyContent:'space-between', alignItems:'center'
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'0.7rem', color:'var(--text-dim)', fontFamily:'monospace' }}>#{test.id}</span>
                        <span style={{ color:'var(--text)', fontSize:'0.85rem', fontWeight:'500' }}>{test.name}</span>
                        {isRunning && <span style={{ fontSize:'0.75rem', color:'var(--gold)' }}>running...</span>}
                      </div>
                      {r && (
                        <div style={{ marginTop:'4px', fontSize:'0.75rem',
                          color: r.status==='pass' ? 'var(--green)' : 'var(--red)' }}>
                          {r.status==='pass' ? '✅' : '❌'} {r.msg}
                        </div>
                      )}
                    </div>
                    <button onClick={() => runOne(test)} disabled={running}
                      style={{ padding:'5px 10px', borderRadius:'8px', border:'1px solid var(--border-dim)',
                        background:'transparent', color:'var(--text-dim)', fontSize:'0.72rem', cursor:'pointer', flexShrink:0 }}>
                      Run
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Cleanup guide */}
        <div className="card-section-label">🧹 CLEANUP AFTER TESTING</div>
        <div className="card" style={{ fontSize:'0.8rem', color:'var(--text-dim)', lineHeight:'1.8' }}>
          <div style={{ color:'var(--text)', fontWeight:'600', marginBottom:'8px' }}>Delete test records from Master Sheet:</div>
          {[
            ['Stays tab', `Filter column B (guestName) = "${TEST_GUEST}" → delete rows`],
            ['Kitchen tab', 'Filter notes = "TEST ENTRY DELETE ME" → delete rows'],
            ['Breakfast tab', `Filter guestName = "${TEST_GUEST}" → delete rows`],
            ['CarRental tab', 'Filter notes = "TEST DELETE ME" → delete rows'],
            ['VillaExpense tab', 'Filter category = "TEST-EXPENSE-DELETE-ME" → delete rows'],
          ].map(([tab, action], i) => (
            <div key={i} style={{ display:'flex', gap:'10px', marginBottom:'6px' }}>
              <span style={{ color:'var(--gold)', fontWeight:'600', minWidth:'110px', flexShrink:0 }}>{tab}</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
