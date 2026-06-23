import { useNavigate } from 'react-router-dom'
export default function PavutumuriHub() {
  const navigate=useNavigate()
  const rows=[
    {icon:'🌿',bg:'rgba(15,110,86,0.08)',arrow:'#0F6E56',title:'Income / expense',sub:'Monthly ledger',action:()=>navigate('/pavutumuri/ledger')},
    {icon:'🌳',bg:'rgba(15,110,86,0.08)',arrow:'#0F6E56',title:'Rubber tracker',sub:'Harvest · tapping log',action:()=>navigate('/pavutumuri/rubber')},
    {icon:'📊',bg:'rgba(15,110,86,0.08)',arrow:'#0F6E56',title:'Dashboard',sub:'Harvest history · income · P&L',action:()=>navigate('/pavutumuri/dashboard')},
  ]
  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Pavutumuri estate</div><div className="topbar-sub">RUBBER ESTATE · OWNER VIEW</div></div>
      </div>
      <div className="screen-body">
        <div className="card-section-label">PAVUTUMURI ESTATE</div>
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
