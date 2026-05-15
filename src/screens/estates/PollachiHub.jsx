import { useNavigate } from 'react-router-dom'
export default function PollachiHub() {
  const navigate=useNavigate()
  const rows=[
    {icon:'🌴',bg:'rgba(59,109,17,0.08)',arrow:'#3B6D11',title:'Irrigation log',sub:'Daily zone tracking',action:()=>window.open('https://docs.google.com/forms/d/e/1FAIpQLSep04wSbC-NThiPvnREMzm4-ICShVtQ_Po1vE1zf2b5Z98buQ/viewform','_blank')},
    {icon:'🌿',bg:'rgba(59,109,17,0.08)',arrow:'#3B6D11',title:'Income / expense',sub:'Monthly ledger',action:()=>navigate('/pollachi/ledger')},
    {icon:'🥥',bg:'rgba(59,109,17,0.08)',arrow:'#3B6D11',title:'Coconut tracker',sub:'Harvest · count · weight · revenue',action:()=>navigate('/pollachi/coconut')},
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
