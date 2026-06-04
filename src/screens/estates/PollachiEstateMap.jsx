// ============================================================
//  PollachiEstateMap.jsx — Pollachi Estate interactive SVG map
//  C tree = currently producing coconut trees
//  Holes  = new planting holes for this season
// ============================================================

const ZONES = [
  { id:'Z1', label:'1', x:82,  y:108, w:178, h:148, trees:20,  holes:0,   motor:'5HP',  col:'#1B3A1B' },
  { id:'Z2', label:'2', x:82,  y:258, w:178, h:158, trees:49,  holes:10,  motor:'7HP',  col:'#1B3A1B' },
  { id:'Z3', label:'3', x:82,  y:418, w:178, h:138, trees:80,  holes:34,  motor:null,   col:'#1B3A1B' },
  { id:'Z4', label:'4', x:340, y:78,  w:158, h:138, trees:23,  holes:2,   motor:'7HP',  col:'#1A2B3A' },
  { id:'Z5', label:'5', x:340, y:218, w:158, h:198, trees:110, holes:114, motor:null,   col:'#1A2B3A' },
  { id:'Z6', label:'6', x:340, y:418, w:158, h:138, trees:49,  holes:51,  motor:null,   col:'#1A2B3A' },
  { id:'Z7', label:'7', x:558, y:78,  w:178, h:138, trees:49,  holes:18,  motor:null,   col:'#2A1B3A' },
  { id:'Z8', label:'8', x:558, y:218, w:178, h:198, trees:200, holes:149, motor:null,   col:'#2A1B3A' },
  { id:'Z9', label:'9', x:558, y:418, w:178, h:138, trees:214, holes:81,  motor:'7HP',  col:'#2A1B3A' },
]

const STATUS_COLOR = {
  ok:'#34A853', warn:'#F59E0B', alert:'#EA7020', critical:'#EF4444', never:'#EF4444', unknown:'#3A4A3A',
}

export default function PollachiEstateMap({ zoneHealth = [] }) {
  const getZ = (label) => zoneHealth.find(z => z.zone_label === label)
  const statusCol = (label) => STATUS_COLOR[getZ(label)?.status || 'unknown']
  const days = (label) => getZ(label)?.days_since ?? null
  const status = (label) => getZ(label)?.status || 'unknown'

  return (
    <div style={{ width:'100%', overflowX:'auto', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', background:'#080F08' }}>
      <svg viewBox="0 0 760 580" style={{ width:'100%', minWidth:'320px', display:'block' }} xmlns="http://www.w3.org/2000/svg">
        <rect width="760" height="580" fill="#080F08"/>

        {/* Colony boundary */}
        <text x="380" y="20" textAnchor="middle" fill="#3A5A3A" fontSize="9" letterSpacing="4" fontFamily="monospace">COLONY BOUNDARY</text>
        <rect x="70" y="26" width="620" height="530" rx="4" fill="none" stroke="#2A4A2A" strokeWidth="1" strokeDasharray="8 4"/>

        {/* Column dividers */}
        <line x1="268" y1="26" x2="268" y2="556" stroke="#1A2A1A" strokeWidth="1"/>
        <line x1="502" y1="26" x2="502" y2="556" stroke="#1A2A1A" strokeWidth="1"/>

        {/* Main irrigation pipeline */}
        <path d="M 262 68 L 262 418 Q 262 440 282 448 L 410 448 Q 430 448 430 468 L 430 556"
          fill="none" stroke="#185FA5" strokeWidth="2.5" strokeOpacity="0.55"/>
        <text x="240" y="300" textAnchor="middle" fill="#185FA5" fontSize="7" fontFamily="monospace" transform="rotate(-90,240,300)" fillOpacity="0.6">MAIN LINE</text>

        {/* Zone rectangles */}
        {ZONES.map(z => {
          const sc = statusCol(z.label)
          const st = status(z.label)
          const d  = days(z.label)
          const total = z.trees + z.holes
          return (
            <g key={z.id}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6"
                fill={z.col} stroke={sc} strokeWidth={st==='unknown'?0.5:1.8} strokeOpacity={st==='unknown'?0.25:0.85}/>
              {st !== 'unknown' && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6" fill={sc} fillOpacity="0.05"/>
              )}

              {/* Zone number badge */}
              <circle cx={z.x+16} cy={z.y+16} r="11" fill={sc} fillOpacity="0.9"/>
              <text x={z.x+16} y={z.y+20} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="monospace">{z.label}</text>

              {/* Producing trees */}
              <text x={z.x+z.w/2} y={z.y+z.h/2-18} textAnchor="middle" fill="#5BC85B" fontSize="8.5" fontFamily="monospace">
                🌴 {z.trees} producing
              </text>

              {/* New holes */}
              {z.holes > 0 && (
                <g>
                  <text x={z.x+z.w/2} y={z.y+z.h/2-5} textAnchor="middle" fill="#C8903A" fontSize="8" fontFamily="monospace">
                    ⬛ {z.holes} new holes
                  </text>
                  <text x={z.x+z.w/2} y={z.y+z.h/2+7} textAnchor="middle" fill="#7A6030" fontSize="7.5" fontFamily="monospace">
                    → {total} total
                  </text>
                </g>
              )}

              {/* Irrigation status */}
              {d !== null ? (
                <text x={z.x+z.w/2} y={z.y+z.h/2+21} textAnchor="middle"
                  fill={sc} fontSize="8" fontWeight="bold" fontFamily="monospace">
                  💧 {d}d ago
                </text>
              ) : st === 'never' ? (
                <text x={z.x+z.w/2} y={z.y+z.h/2+21} textAnchor="middle"
                  fill={sc} fontSize="7.5" fontFamily="monospace">💧 never</text>
              ) : null}

              {/* Motor badge */}
              {z.motor && (
                <g>
                  <rect x={z.x+z.w-38} y={z.y+z.h-17} width={36} height={13} rx="3" fill="#8B5E1A" fillOpacity="0.9"/>
                  <text x={z.x+z.w-20} y={z.y+z.h-7} textAnchor="middle" fill="#FFD580" fontSize="7.5" fontWeight="bold" fontFamily="monospace">{z.motor}</text>
                </g>
              )}

              {/* Drip emitter dots */}
              {Array.from({length:Math.min(3,Math.floor(z.h/32))}).map((_,i)=>(
                <g key={i}>
                  <line x1={z.x+32} y1={z.y+30+i*26} x2={z.x+z.w-8} y2={z.y+30+i*26}
                    stroke="#185FA5" strokeWidth="0.7" strokeOpacity="0.25" strokeDasharray="4 4"/>
                  {[0.25,0.5,0.75].map((p,j)=>(
                    <circle key={j} cx={z.x+32+p*(z.w-40)} cy={z.y+30+i*26} r="1.8"
                      fill="#185FA5" fillOpacity="0.4"/>
                  ))}
                </g>
              ))}
            </g>
          )
        })}

        {/* House */}
        <g>
          <rect x="286" y="155" width="44" height="50" rx="3" fill="#1A1A10" stroke="#C8903A" strokeWidth="1.5"/>
          <polygon points="280,157 336,157 308,138" fill="#252510" stroke="#C8903A" strokeWidth="1"/>
          <text x="308" y="222" textAnchor="middle" fill="#C8903A" fontSize="8" fontFamily="monospace">HOUSE</text>
        </g>

        {/* Mango motor (Zone 1 area) */}
        <g>
          <rect x="130" y="152" width="48" height="20" rx="3" fill="#1A2A10" stroke="#5B8A1B" strokeWidth="1"/>
          <text x="154" y="165" textAnchor="middle" fill="#8BC85B" fontSize="7" fontFamily="monospace">🥭 MOTOR</text>
        </g>

        {/* Pond crate */}
        <g>
          <rect x="355" y="34" width="46" height="28" rx="4" fill="#0D1F2A" stroke="#185FA5" strokeWidth="1.5"/>
          <text x="378" y="48" textAnchor="middle" fill="#85B7EB" fontSize="7.5" fontFamily="monospace">POND</text>
          <text x="378" y="58" textAnchor="middle" fill="#4A6A7A" fontSize="7" fontFamily="monospace">CRATE</text>
        </g>

        {/* Back crate */}
        <g>
          <rect x="404" y="542" width="46" height="24" rx="4" fill="#0D1F2A" stroke="#185FA5" strokeWidth="1.5"/>
          <text x="427" y="555" textAnchor="middle" fill="#85B7EB" fontSize="7.5" fontFamily="monospace">BACK CRATE</text>
        </g>

        {/* 10HP Motor */}
        <g>
          <rect x="576" y="498" width="52" height="20" rx="3" fill="#2A1A08" stroke="#C8903A" strokeWidth="1.5"/>
          <text x="602" y="511" textAnchor="middle" fill="#FFD580" fontSize="7.5" fontWeight="bold" fontFamily="monospace">10HP MTR</text>
        </g>

        {/* Summary totals */}
        <g>
          <rect x="70" y="558" width="620" height="18" rx="3" fill="#0D150D"/>
          <text x="380" y="570" textAnchor="middle" fill="#5C7080" fontSize="8" fontFamily="monospace">
            TOTAL: 804 producing coconut trees · 499 new holes → 1,303 future trees
          </text>
        </g>

        {/* Legend */}
        <g transform="translate(76,540)">
          {[['#34A853','On track'],['#F59E0B','1 miss'],['#EA7020','2 misses'],['#EF4444','3+ / never']].map(([col,lbl],i)=>(
            <g key={i} transform={`translate(${i*118},0)`}>
              <circle cx="6" cy="5" r="4.5" fill={col} fillOpacity="0.9"/>
              <text x="14" y="9" fill="#9AA5B4" fontSize="7.5" fontFamily="monospace">{lbl}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
