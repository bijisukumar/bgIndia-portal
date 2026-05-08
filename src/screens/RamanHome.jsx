import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'
import { api } from '../api'

export default function RamanHome() {
  const { logout }=useAuth()
  const navigate=useNavigate()
  const [activeStay,setActiveStay]=useState(null)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    api.getActiveStay('dwarka')
      .then(d=>{
        // Only set if we got a real stay object with a stayId
        if (d && d.stayId) setActiveStay(d)
        setLoading(false)
      })
      .catch(()=>setLoading(false))
  },[])

  const villaRows=[
    {icon:'🏠',bg:'rgba(200,144,58,0.08)',arrow:'#C8903A',title:'Check-in',sub:activeStay?`Active: ${activeStay.guestName}`:'New guest arrival',path:'/raman/checkin',disabled:false},
    {icon:'🛒',bg:'rgba(200,144,58,0.08)',arrow:'#C8903A',title:'Kitchen incidentals',sub:activeStay?`Linked to ${activeStay.guestName}`:'No active stay',path:'/raman/kitchen',disabled:!activeStay},
    {icon:'🍳',bg:'rgba(200,144,58,0.08)',arrow:'#C8903A',title:'Breakfast',sub:activeStay?`${activeStay.guestCount || activeStay.adultsCount || ''} guests · ₹${CONFIG.breakfastRate}/person`:'No active stay',path:'/raman/breakfast',disabled:!activeStay},
    {icon:'🚗',bg:'rgba(200,144,58,0.08)',arrow:'#C8903A',title:'Car rental',sub:'Trip log',path:'/raman/carrental',disabled:!activeStay},
  ]
  const estateRows=[
    {icon:'🌳',bg:'rgba(15,110,86,0.08)',arrow:'#0F6E56',title:'Rubber tracker',sub:'Harvest · tapping log',path:'/pavutumuri/rubber'},
    {icon:'🌿',bg:'rgba(15,110,86,0.08)',arrow:'#0F6E56',title:'Income / expense',sub:'Monthly ledger',path:'/pavutumuri/ledger'},
  ]

  return (
    <div className="screen">
      <div style={styles.header}>
        <img src="/icons/logo-black.png" alt="GE" style={styles.logo} onError={e=>e.target.style.display='none'}/>
        <div style={styles.headerText}>
          <div style={styles.brandName}>{CONFIG.brandName}</div>
          <div style={styles.tagline}>PROPERTY MANAGEMENT PORTAL</div>
        </div>
        <div style={styles.badge}><span style={styles.badgeLabel}>RAMAN</span></div>
      </div>
      <div className="screen-body">
        {loading?(
          <div style={{background:'rgba(52,168,83,0.06)',border:'1px solid rgba(52,168,83,0.15)',borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',display:'flex',gap:'10px',alignItems:'center'}}>
            <div className="spinner"/><span style={{color:'#5C7080',fontSize:'0.85rem'}}>Checking active stay...</span>
          </div>
        ):activeStay?(
          <div className="active-stay-banner" onClick={()=>navigate('/raman/checkin')}>
            <div className="banner-dot"/>
            <div style={{flex:1}}>
              <div className="active-stay-name">Active: {activeStay.guestName}</div>
              <div className="active-stay-sub">Check-in {activeStay.checkIn || activeStay.checkInDate || ''} · {activeStay.guestCount || activeStay.adultsCount || ''} guests</div>
            </div>
            <div style={{color:'var(--green)',fontSize:'0.85rem',fontWeight:'600'}}>View ›</div>
          </div>
        ):(
          <div style={{background:'rgba(200,144,58,0.05)',border:'1px solid rgba(200,144,58,0.15)',borderRadius:'10px',padding:'12px 14px',marginBottom:'16px',display:'flex',gap:'12px',alignItems:'center'}}>
            <span style={{fontSize:'1.3rem'}}>🏠</span>
            <div>
              <div style={{color:'#C8903A',fontSize:'0.85rem',fontWeight:'600'}}>No active stay</div>
              <div style={{color:'#5C7080',fontSize:'0.75rem',marginTop:'2px'}}>Tap Check-in when guests arrive</div>
            </div>
          </div>
        )}
        <div className="card-section-label">GVR DWARKA VILLA</div>
        <div className="menu-tile">
          {villaRows.map((r,i)=>(
            <div key={i} className="menu-row" onClick={()=>!r.disabled&&navigate(r.path)}
              style={{...(i===villaRows.length-1?{borderBottom:'none'}:{}),cursor:r.disabled?'default':'pointer',opacity:r.disabled?0.5:1}}>
              <div className="menu-icon" style={{background:r.bg}}>{r.icon}</div>
              <div className="menu-label">
                <div className="menu-title">{r.title}</div>
                <div className="menu-sub">{r.sub}</div>
              </div>
              {!r.disabled&&<div className="menu-arrow" style={{background:r.arrow}}>›</div>}
              {r.disabled&&<span style={{fontSize:'0.9rem'}}>🔒</span>}
            </div>
          ))}
        </div>
        <div className="card-section-label">PAVUTUMURI ESTATE</div>
        <div className="menu-tile">
          {estateRows.map((r,i)=>(
            <div key={i} className="menu-row" onClick={()=>navigate(r.path)} style={i===estateRows.length-1?{borderBottom:'none'}:{}}>
              <div className="menu-icon" style={{background:r.bg}}>{r.icon}</div>
              <div className="menu-label"><div className="menu-title">{r.title}</div><div className="menu-sub">{r.sub}</div></div>
              <div className="menu-arrow" style={{background:r.arrow}}>›</div>
            </div>
          ))}
        </div>
        <button className="logout-btn" onClick={logout}>Log out</button>
      </div>
    </div>
  )
}
const styles={
  header:{background:'#111111',padding:'16px 16px 14px',display:'flex',alignItems:'center',gap:'14px',borderBottom:'1px solid rgba(200,144,58,0.18)'},
  logo:{height:'52px',width:'52px',borderRadius:'10px',objectFit:'cover',border:'1px solid rgba(200,144,58,0.3)',boxShadow:'0 4px 12px rgba(200,144,58,0.15)'},
  headerText:{flex:1},
  brandName:{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:'600',color:'#E8B86D'},
  tagline:{fontSize:'0.6rem',color:'#5C7080',letterSpacing:'2px',marginTop:'2px'},
  badge:{background:'rgba(200,144,58,0.1)',border:'1px solid rgba(200,144,58,0.2)',borderRadius:'20px',padding:'4px 12px'},
  badgeLabel:{color:'#C8903A',fontSize:'0.65rem',fontWeight:'700',letterSpacing:'2px'},
}
