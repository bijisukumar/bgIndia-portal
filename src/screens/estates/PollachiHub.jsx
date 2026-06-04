// v2 — includes irrigation + mango screens
import { useNavigate } from 'react-router-dom'
export default function PollachiHub() {
  const navigate=useNavigate()
  const rows=[
    {icon:'💧',bg:'rgba(24,95,165,0.08)',arrow:'#185FA5',title:'Irrigation log',sub:'Zone tracking · Health dashboard',action:()=>navigate('/pollachi/irrigation')},
    {icon:'🌿',bg:'rgba(59,109,17,0.08)',arrow:'#3B6D11',title:'Income / expense',sub:'Monthly ledger',action:()=>navigate('/pollachi/ledger')},
    {icon:'🥥',bg:'rgba(59,109,17,0.08)',arrow:'#3B6D11',title:'Coconut tracker',sub:'Harvest · count · weight · revenue',action:()=>navigate('/pollachi/coconut')},
    {icon:'🥭',bg:'rgba(245,158,11,0.08)',arrow:'#F59E0B',title:'Mango harvest',sub:'Box tracking · varieties · season totals',action:()=>navigate('/pollachi/mango')},
    {icon:'📊',bg:'rgba(59,109,17,0.08)',arrow:'#3B6D11',title:'Dashboard',sub:'Harvest history · income · P&L',action:()=>navigate('/pollachi/dashboard')},
  ]
  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Pollachi estate</div><div className="topbar-sub">COCONUT ESTATE · OWNER VIEW</div></div>
      </div>
      <div className="screen-body">
        <div className="card-section-label">POLLACHI ESTATE</div>
        <div className="menu-tile">
          {rows.map((r,i)=>(
            <div key={i} className="menu-row" onClick={r.action} style={i===rows.length-1?{borderBottom:'none'}:{}}>
              <div className="menu-icon" style={{background:r.bg}}>{r.icon}</div>
              <div className="menu-label"><div className="menu-title">{r.title}</div><div className="menu-sub">{r.sub}</div></div>
              <div className="menu-arrow" style={{background:r.arrow}}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
