import { useNavigate } from 'react-router-dom'
export default function RubberTracker() {
  const navigate = useNavigate()
  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <div><div className="topbar-title">RubberTracker</div><div className="topbar-sub">COMING NEXT</div></div>
      </div>
      <div className="screen-body">
        <div className="card" style={{textAlign:'center',padding:'40px 20px'}}>
          <div style={{fontSize:'2rem',marginBottom:'12px'}}>🚧</div>
          <div style={{color:'var(--gold)',fontWeight:'600',marginBottom:'8px'}}>RubberTracker</div>
          <div style={{color:'var(--text-dim)',fontSize:'0.85rem'}}>This screen is being built next. Check back soon.</div>
        </div>
      </div>
    </div>
  )
}
