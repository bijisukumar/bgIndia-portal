import { useNavigate } from 'react-router-dom'
import { CONFIG } from '../config'

export default function VillaHub() {
  const navigate = useNavigate()
  const villa = CONFIG.villas[0]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>
        <div><div className="topbar-title">GVR Villa(s)</div><div className="topbar-sub">OWNER VIEW</div></div>
        <div style={{width:34}}/>
      </div>
      <div className="screen-body">
        <div className="card-section-label">ACTIVE PROPERTY</div>
        <div style={styles.propCard}>
          <div style={styles.propHeader}>
            <div>
              <div style={styles.propName}>{villa.full}</div>
              <div style={styles.propLoc}>{villa.location}</div>
            </div>
            <span className="tag tag-green">Active</span>
          </div>
          <div style={{padding:'4px 0'}}>
            <div className="menu-row" style={{padding:'14px 0',borderBottom:'1px solid var(--border-dim)'}} onClick={() => navigate('/owner/villa/booking')}>
              <div className="menu-icon" style={{background:'rgba(52,168,83,0.08)'}}>📋</div>
              <div className="menu-label">
                <div className="menu-title">New booking</div>
                <div className="menu-sub">Record booking · assign Stay ID · create Drive folder</div>
              </div>
              <div className="menu-arrow" style={{background:'#34A853'}}>›</div>
            </div>
            <div className="menu-row" style={{padding:'14px 0',borderBottom:'1px solid var(--border-dim)'}} onClick={() => navigate('/owner/villa/income')}>
              <div className="menu-icon" style={{background:'rgba(200,144,58,0.08)'}}>🏨</div>
              <div className="menu-label">
                <div className="menu-title">Villa rental income</div>
                <div className="menu-sub">Bookings · tariffs · commissions</div>
              </div>
              <div className="menu-arrow" style={{background:'#C8903A'}}>›</div>
            </div>
            <div className="menu-row" style={{padding:'14px 0',borderBottom:'none'}} onClick={() => navigate('/owner/villa/dashboard')}>
              <div className="menu-icon" style={{background:'rgba(24,95,165,0.08)'}}>📊</div>
              <div className="menu-label">
                <div className="menu-title">Villa dashboard</div>
                <div className="menu-sub">Revenue · profit · breakdown</div>
              </div>
              <div className="menu-arrow" style={{background:'#185FA5'}}>›</div>
            </div>
          </div>
        </div>
        <div className="card-dashed" onClick={() => {}}>
          <div className="card-dashed-icon">+</div>
          <div className="card-dashed-text">
            <strong>Add another villa</strong>
            <span>New property will appear here with its own trackers</span>
          </div>
        </div>
      </div>
    </div>
  )
}
const styles = {
  propCard:{background:'#1E2535',borderRadius:'14px',border:'1px solid rgba(200,144,58,0.2)',overflow:'hidden',marginBottom:'12px'},
  propHeader:{background:'rgba(200,144,58,0.06)',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(200,144,58,0.15)'},
  propName:{color:'#E8B86D',fontSize:'1rem',fontWeight:'700',fontFamily:"'Cormorant Garamond',serif"},
  propLoc:{color:'#5C7080',fontSize:'0.75rem',marginTop:'2px'},
}
