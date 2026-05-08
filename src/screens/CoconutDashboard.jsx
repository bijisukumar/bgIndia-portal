import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const CUR_YEAR=new Date().getFullYear()
function fmt(n){if(!n&&n!==0)return'—';if(n>=100000)return`₹${(n/100000).toFixed(1)}L`;if(n>=1000)return`₹${(n/1000).toFixed(1)}K`;return`₹${n.toLocaleString('en-IN')}`}

export default function CoconutDashboard() {
  const navigate=useNavigate()
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    api.getCoconutHarvests(CUR_YEAR)
      .then(d=>{setData(d);setLoading(false)})
      .catch(()=>{setData(MOCK);setLoading(false)})
  },[])

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={()=>navigate(-1)}>‹</button>
        <div><div className="topbar-title">Coconut dashboard</div><div className="topbar-sub">POLLACHI ESTATE · {CUR_YEAR}</div></div>
      </div>
      <div className="screen-body">
        {loading?(<div className="loading"><div className="spinner"/>Loading...</div>):(
          <>
            <div className="card-section-label">ANNUAL SUMMARY</div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-label">Total harvests</div><div className="stat-val gold">{data?.totalHarvests||0}</div><div className="stat-sub">This year</div></div>
              <div className="stat-card"><div className="stat-label">Total coconuts</div><div className="stat-val">{(data?.totalCount||0).toLocaleString('en-IN')}</div><div className="stat-sub">Gross count</div></div>
              <div className="stat-card"><div className="stat-label">Gross revenue</div><div className="stat-val green">{fmt(data?.grossRevenue)}</div><div className="stat-sub">Before expenses</div></div>
              <div className="stat-card"><div className="stat-label">Net income</div><div className="stat-val green">{fmt(data?.netIncome)}</div><div className="stat-sub">After all expenses</div></div>
            </div>
            <div className="card-section-label">HARVEST HISTORY</div>
            {(data?.harvests||[]).map((h,i)=>(
              <div key={i} className="card" style={{marginBottom:'8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <span style={{color:'#C8903A',fontWeight:'600',fontSize:'0.9rem'}}>{h.date}</span>
                  <span style={{color:'var(--green)',fontWeight:'700'}}>{fmt(h.netIncome)}</span>
                </div>
                <div style={{display:'flex',gap:'16px'}}>
                  <div><div style={{color:'#5C7080',fontSize:'0.7rem'}}>COUNT</div><div style={{color:'#EDF2F7',fontWeight:'600'}}>{(h.count||0).toLocaleString('en-IN')}</div></div>
                  <div><div style={{color:'#5C7080',fontSize:'0.7rem'}}>WEIGHT</div><div style={{color:'#EDF2F7',fontWeight:'600'}}>{h.weight}kg</div></div>
                  <div><div style={{color:'#5C7080',fontSize:'0.7rem'}}>PRICE/KG</div><div style={{color:'#EDF2F7',fontWeight:'600'}}>₹{h.pricePerKg}</div></div>
                  <div><div style={{color:'#5C7080',fontSize:'0.7rem'}}>HARVESTER</div><div style={{color:'#EDF2F7',fontWeight:'600'}}>{h.harvester||'—'}</div></div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
const MOCK={totalHarvests:6,totalCount:7440,grossRevenue:208320,netIncome:189600,harvests:[
  {date:'02-May-2026',count:1240,weight:620,pricePerKg:28,harvester:'Rajan',netIncome:14938},
  {date:'17-Mar-2026',count:1180,weight:590,pricePerKg:27,harvester:'Rajan',netIncome:14200},
  {date:'31-Jan-2026',count:1320,weight:660,pricePerKg:26,harvester:'Rajan',netIncome:15400},
]}
