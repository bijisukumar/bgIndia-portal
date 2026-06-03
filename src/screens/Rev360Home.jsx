// ============================================================
//  REV360 HOME — Portfolio KPIs with India / USA tabs
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api'

const STATUS_COLOR = {
  'Active':'#34A853','Notice Given':'#F59E0B','Delinquent':'#EF4444',
  'Evicted':'#EF4444','Runaway':'#EF4444','Completed':'#5C7080',
}

function fmtCurrency(amount, currency) {
  if (!amount && amount !== 0) return '—'
  const abs = Math.abs(amount)
  if (currency === 'USD') {
    const s = abs >= 1000 ? (abs/1000).toFixed(1)+'K' : abs.toLocaleString('en-US',{minimumFractionDigits:0})
    return (amount < 0 ? '−' : '') + '$' + s
  }
  const s = abs >= 100000 ? (abs/100000).toFixed(1)+'L' : abs >= 1000 ? (abs/1000).toFixed(1)+'K' : abs.toLocaleString('en-IN')
  return (amount < 0 ? '−' : '') + '₹' + s
}

function KpiStrip({ props, income, losses, currency }) {
  const cur = currency
  const totalNOI = income
    .filter(r => props.some(p => p.prop_id === r.prop_id))
    .reduce((s,r) => s+(r.net||0), 0)
  const activeCount = props.filter(p => p.status === 'Active' || !p.status).length
  const totalClaimed = losses
    .filter(r => props.some(p => p.prop_id === r.prop_id))
    .reduce((s,r) => s+(r.total_claimed||0), 0)
  const totalWrittenOff = losses
    .filter(r => props.some(p => p.prop_id === r.prop_id))
    .reduce((s,r) => s+(r.total_written_off||0), 0)

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
      <div style={styles.kpiCard}>
        <div style={styles.kpiLabel}>YTD NET INCOME</div>
        <div style={{...styles.kpiVal, color: totalNOI >= 0 ? '#34A853' : '#EF4444'}}>
          {fmtCurrency(totalNOI, cur)}
        </div>
        <div style={styles.kpiSub}>{new Date().getFullYear()} · {props.length} propert{props.length!==1?'ies':'y'}</div>
      </div>
      <div style={styles.kpiCard}>
        <div style={styles.kpiLabel}>ACTIVE LEASES</div>
        <div style={{...styles.kpiVal, color:'#185FA5'}}>{activeCount}</div>
        <div style={styles.kpiSub}>of {props.length} properties</div>
      </div>
      <div style={styles.kpiCard}>
        <div style={styles.kpiLabel}>TOTAL CLAIMED</div>
        <div style={{...styles.kpiVal, color:'#F59E0B'}}>{fmtCurrency(totalClaimed, cur)}</div>
        <div style={styles.kpiSub}>across all leases</div>
      </div>
      <div style={styles.kpiCard}>
        <div style={styles.kpiLabel}>WRITTEN OFF</div>
        <div style={{...styles.kpiVal, color:'#EF4444'}}>{fmtCurrency(totalWrittenOff, cur)}</div>
        <div style={styles.kpiSub}>unrecoverable losses</div>
      </div>
    </div>
  )
}

export default function Rev360Home() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [countryTab, setCountryTab] = useState('IN')

  useEffect(() => {
    api.getRev360Dashboard()
      .then(d => { if (d?.data) setDash(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Split properties by country
  const allProps   = dash?.properties || []
  const inProps    = allProps.filter(p => !p.country || p.country === 'IN')
  const usProps    = allProps.filter(p => p.country === 'US')
  const tabProps   = countryTab === 'IN' ? inProps : usProps
  const tabCur     = countryTab === 'IN' ? 'INR' : 'USD'

  const income     = dash?.income  || []
  const losses     = dash?.losses  || []
  const renewals   = (dash?.renewalAlerts || []).filter(r => r.days_left <= 60)
  const tabRenewals = renewals.filter(r => tabProps.some(p => p.prop_id === r.prop_id))

  const alertProps = tabProps.filter(p => ['Delinquent','Evicted','Runaway'].includes(p.status))

  const tabBtn = (t, label, count) => (
    <button onClick={() => setCountryTab(t)} style={{
      flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
      fontSize:'0.82rem', fontWeight:'700', textAlign:'center',
      background: countryTab===t ? 'rgba(24,95,165,0.15)' : 'transparent',
      color: countryTab===t ? '#85B7EB' : '#5C7080',
      borderBottom: countryTab===t ? '2px solid #185FA5' : '2px solid transparent',
    }}>
      {label}
      <span style={{
        marginLeft:'6px', fontSize:'0.65rem', padding:'1px 6px', borderRadius:'10px',
        background: countryTab===t ? 'rgba(24,95,165,0.2)' : 'rgba(255,255,255,0.06)',
        color: countryTab===t ? '#85B7EB' : '#5C7080',
      }}>{count}</span>
    </button>
  )

  return (
    <div className="screen">
      <div style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.brandName}>Rev360</div>
          <div style={styles.tagline}>RENTAL PORTFOLIO MANAGEMENT</div>
        </div>
        <div style={styles.welcomeBadge}><span style={styles.welcomeLabel}>OWNER</span></div>
      </div>

      <div className="screen-body">

        {/* Delinquency alerts */}
        {alertProps.length > 0 && (
          <div style={styles.alertBanner}>
            <span style={{color:'#EF4444',fontWeight:'700',fontSize:'0.82rem'}}>
              🚨 {alertProps.length} propert{alertProps.length>1?'ies':'y'} need attention
            </span>
            {alertProps.map(p => (
              <div key={p.prop_id} style={{fontSize:'0.78rem',color:'#EDF2F7',marginTop:'4px'}}>
                {p.name} — <span style={{color:STATUS_COLOR[p.status]}}>{p.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Renewal alerts */}
        {tabRenewals.length > 0 && (
          <div style={styles.renewalBanner}>
            <div style={{color:'#F59E0B',fontWeight:'700',fontSize:'0.82rem',marginBottom:'6px'}}>
              📅 {tabRenewals.length} lease{tabRenewals.length>1?'s':''} expiring soon
            </div>
            {tabRenewals.map(r => (
              <div key={r.prop_id} style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:'3px'}}>
                <span style={{color:'#EDF2F7'}}>{r.name} — {r.tenant_name}</span>
                <span style={{color:r.days_left<0?'#EF9A9A':r.days_left<30?'#FFCC80':'#F59E0B'}}>
                  {r.days_left<0?`Expired ${Math.abs(r.days_left)}d ago`:`${r.days_left}d left`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Country tab selector */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',marginBottom:'12px',background:'rgba(255,255,255,0.02)',borderRadius:'10px 10px 0 0',overflow:'hidden'}}>
          {tabBtn('IN', '🇮🇳 India', inProps.length)}
          {tabBtn('US', '🇺🇸 USA', usProps.length)}
        </div>

        {/* KPI cards — filtered by country */}
        {!loading && (
          <KpiStrip
            props={tabProps}
            income={income}
            losses={losses}
            currency={tabCur}
          />
        )}
        {loading && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
            {[1,2,3,4].map(i=>(
              <div key={i} style={{...styles.kpiCard,opacity:0.4}}>
                <div style={styles.kpiLabel}>LOADING</div>
                <div style={{...styles.kpiVal,color:'#5C7080'}}>—</div>
              </div>
            ))}
          </div>
        )}

        {/* Property list for this tab */}
        {!loading && tabProps.length > 0 && (
          <>
            <div className="card-section-label" style={{color:'#5C7080',marginBottom:'8px'}}>
              {countryTab==='IN' ? 'INDIA PROPERTIES' : 'US PROPERTIES'}
            </div>
            <div style={{marginBottom:'12px'}}>
              {tabProps.map(p => (
                <div key={p.prop_id} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 14px',marginBottom:'6px',borderRadius:'10px',
                  background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',
                }}>
                  <div>
                    <div style={{fontWeight:'600',fontSize:'0.88rem',color:'#EDF2F7'}}>{p.name}</div>
                    <div style={{fontSize:'0.7rem',color:'#5C7080',marginTop:'2px'}}>{p.location}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{
                      fontSize:'0.68rem',fontWeight:'700',padding:'2px 8px',borderRadius:'10px',
                      background:`${STATUS_COLOR[p.status]||'#5C7080'}18`,
                      color:STATUS_COLOR[p.status]||'#5C7080',
                    }}>
                      {p.status||'Active'}
                    </div>
                    {p.tenant_name && (
                      <div style={{fontSize:'0.68rem',color:'#5C7080',marginTop:'3px'}}>{p.tenant_name}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="card-section-label" style={{color:'#185FA5'}}>RENTAL MANAGEMENT</div>
        <div className="menu-tile">
          {[
            {icon:'📋', title:'Monthly tracker',    sub:'Enter income & expenses',        path:'/owner/rental',                 arrow:'#34A853'},
            {icon:'📄', title:'Agreements',         sub:'Tenant & lease details',          path:'/owner/rental/agreement',       arrow:'#185FA5'},
            {icon:'⚖️', title:'Claims ledger',      sub:'Damage & loss tracking',          path:'/owner/rental/claims',          arrow:'#E24B4A'},
            {icon:'🏠', title:'Property details',   sub:'Utilities, loan, tax, insurance', path:'/owner/rental/property',        arrow:'#34A853'},
            {icon:'📊', title:'Portfolio dashboard',sub:'Annual NOI & analytics',          path:'/owner/rental/dashboard',       arrow:'#8B5CF6'},
          ].map((item, i, arr) => (
            <div key={item.path} className="menu-row"
              onClick={()=>navigate(item.path)}
              style={{borderBottom: i < arr.length-1 ? undefined : 'none'}}>
              <div className="menu-icon" style={{background:`${item.arrow}14`}}>{item.icon}</div>
              <div className="menu-label">
                <div className="menu-title">{item.title}</div>
                <div className="menu-sub">{item.sub}</div>
              </div>
              <div className="menu-arrow" style={{background:item.arrow}}>›</div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
          <button className="logout-btn" style={{flex:1}} onClick={logout}>Log out</button>
          <button onClick={()=>navigate('/infra/d1')}
            style={{padding:'12px 16px',borderRadius:'12px',border:'1px solid rgba(24,95,165,0.3)',background:'rgba(24,95,165,0.08)',color:'#85B7EB',fontSize:'0.8rem',cursor:'pointer'}}>
            🗄
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  header:       {background:'#0D1117',padding:'16px 16px 14px',display:'flex',alignItems:'center',gap:'14px',borderBottom:'1px solid rgba(24,95,165,0.25)'},
  headerText:   {flex:1},
  brandName:    {fontFamily:"'Cormorant Garamond', serif",fontSize:'1.3rem',fontWeight:'600',color:'#85B7EB',letterSpacing:'0.5px'},
  tagline:      {fontSize:'0.58rem',color:'#5C7080',letterSpacing:'2px',marginTop:'2px'},
  welcomeBadge: {background:'rgba(24,95,165,0.12)',border:'1px solid rgba(24,95,165,0.2)',borderRadius:'20px',padding:'4px 12px'},
  welcomeLabel: {color:'#185FA5',fontSize:'0.65rem',fontWeight:'700',letterSpacing:'2px'},
  alertBanner:  {background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'12px',padding:'12px 14px',marginBottom:'12px'},
  renewalBanner:{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:'12px',padding:'12px 14px',marginBottom:'12px'},
  kpiCard:      {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'14px'},
  kpiLabel:     {fontSize:'0.62rem',color:'#5C7080',letterSpacing:'1.5px',marginBottom:'6px'},
  kpiVal:       {fontSize:'1.4rem',fontWeight:'700',lineHeight:1},
  kpiSub:       {fontSize:'0.68rem',color:'#5C7080',marginTop:'4px'},
}
