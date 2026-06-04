// ============================================================
//  PollachiEstateMap.jsx — Interactive SVG estate map
//  Shows zones, trees, bore holes, motors, irrigation lines
// ============================================================

const ZONES = [
  { id:'Z1', label:'1', x:80,  y:120, w:190, h:140, trees:20,  holes:0,   motor:'5HP', color:'#2D5A1B' },
  { id:'Z2', label:'2', x:80,  y:260, w:190, h:160, trees:49,  holes:10,  motor:'7HP', color:'#2D5A1B' },
  { id:'Z3', label:'3', x:80,  y:420, w:190, h:140, trees:80,  holes:34,  motor:null,  color:'#2D5A1B' },
  { id:'Z4', label:'4', x:340, y:80,  w:160, h:140, trees:23,  holes:2,   motor:'7HP', color:'#1B3A5A' },
  { id:'Z5', label:'5', x:340, y:220, w:160, h:200, trees:110, holes:114, motor:null,  color:'#1B3A5A' },
  { id:'Z6', label:'6', x:340, y:420, w:160, h:140, trees:49,  holes:51,  motor:null,  color:'#1B3A5A' },
  { id:'Z7', label:'7', x:560, y:80,  w:180, h:140, trees:49,  holes:18,  motor:null,  color:'#3A1B5A' },
  { id:'Z8', label:'8', x:560, y:220, w:180, h:200, trees:200, holes:149, motor:null,  color:'#3A1B5A' },
  { id:'Z9', label:'9', x:560, y:420, w:180, h:140, trees:214, holes:81,  motor:'7HP', color:'#3A1B5A' },
]

const STATUS_COLOR = {
  ok:       '#34A853',
  warn:     '#F59E0B',
  alert:    '#EA7020',
  critical: '#EF4444',
  never:    '#EF4444',
  unknown:  '#5C7080',
}

export default function PollachiEstateMap({ zoneHealth = [] }) {
  const getStatus = (zoneLabel) => {
    const zh = zoneHealth.find(z => z.zone_label === zoneLabel)
    return zh ? zh.status : 'unknown'
  }
  const getDays = (zoneLabel) => {
    const zh = zoneHealth.find(z => z.zone_label === zoneLabel)
    return zh?.days_since ?? null
  }

  return (
    <div style={{ width:'100%', overflowX:'auto', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.08)', background:'#0D1A0D' }}>
      <svg viewBox="0 0 780 580" style={{ width:'100%', minWidth:'340px', display:'block' }} xmlns="http://www.w3.org/2000/svg">

        {/* Background */}
        <rect width="780" height="580" fill="#0D1A0D"/>

        {/* Colony boundary labels */}
        <text x="380" y="22" textAnchor="middle" fill="#5C7080" fontSize="10" letterSpacing="3" fontFamily="monospace">COLONY BOUNDARY</text>
        <line x1="80" y1="28" x2="740" y2="28" stroke="#3A4A3A" strokeWidth="1.5" strokeDasharray="6 3"/>
        <text x="12" y="300" textAnchor="middle" fill="#5C7080" fontSize="9" letterSpacing="2" fontFamily="monospace" transform="rotate(-90,12,300)">COLONY</text>
        <line x1="70" y1="80" x2="70" y2="570" stroke="#3A4A3A" strokeWidth="1" strokeDasharray="4 3"/>

        {/* Main irrigation pipeline (the thick line in the image) */}
        <path d="M 270 100 L 270 420 Q 270 440 290 450 L 420 450 Q 440 450 440 470 L 440 560"
          fill="none" stroke="#185FA5" strokeWidth="3" strokeOpacity="0.6"/>
        <path d="M 420 100 L 420 420"
          fill="none" stroke="#185FA5" strokeWidth="2" strokeOpacity="0.4"/>

        {/* Zone rectangles */}
        {ZONES.map(z => {
          const status = getStatus(z.label)
          const statusCol = STATUS_COLOR[status]
          const days = getDays(z.label)
          return (
            <g key={z.id}>
              {/* Zone background */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6"
                fill={`${z.color}55`}
                stroke={statusCol} strokeWidth={status === 'unknown' ? 0.5 : 1.5}
                strokeOpacity={status === 'unknown' ? 0.3 : 0.8}/>

              {/* Status glow overlay */}
              {status !== 'unknown' && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6"
                  fill={statusCol} fillOpacity="0.06"/>
              )}

              {/* Zone label */}
              <circle cx={z.x + 18} cy={z.y + 18} r="12" fill={statusCol} fillOpacity="0.9"/>
              <text x={z.x + 18} y={z.y + 22} textAnchor="middle"
                fill="#fff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                {z.label}
              </text>

              {/* Tree + hole count */}
              <text x={z.x + z.w/2} y={z.y + z.h/2 - 10} textAnchor="middle"
                fill="#34A853" fontSize="9" fontFamily="monospace">
                🥥 {z.trees} trees
              </text>
              {z.holes > 0 && (
                <text x={z.x + z.w/2} y={z.y + z.h/2 + 4} textAnchor="middle"
                  fill="#5C8A5C" fontSize="8" fontFamily="monospace">
                  ⬛ {z.holes} holes
                </text>
              )}

              {/* Days since irrigation */}
              {days !== null && (
                <text x={z.x + z.w/2} y={z.y + z.h/2 + 18} textAnchor="middle"
                  fill={statusCol} fontSize="8" fontWeight="bold" fontFamily="monospace">
                  {days}d ago
                </text>
              )}
              {status === 'never' && (
                <text x={z.x + z.w/2} y={z.y + z.h/2 + 18} textAnchor="middle"
                  fill={statusCol} fontSize="8" fontFamily="monospace">
                  never logged
                </text>
              )}

              {/* Motor badge */}
              {z.motor && (
                <g>
                  <rect x={z.x + z.w - 36} y={z.y + z.h - 18} width={34} height={14} rx="3"
                    fill="#C8903A" fillOpacity="0.85"/>
                  <text x={z.x + z.w - 19} y={z.y + z.h - 8} textAnchor="middle"
                    fill="#fff" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
                    {z.motor}
                  </text>
                </g>
              )}

              {/* Drip lines — horizontal marks */}
              {Array.from({length: Math.min(4, Math.floor(z.h / 28))}).map((_, i) => (
                <g key={i}>
                  <line
                    x1={z.x + 35} y1={z.y + 35 + i * 24}
                    x2={z.x + z.w - 10} y2={z.y + 35 + i * 24}
                    stroke="#185FA5" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="3 3"/>
                  {Array.from({length: 3}).map((_, j) => (
                    <circle key={j}
                      cx={z.x + 55 + j * ((z.w - 65) / 3)}
                      cy={z.y + 35 + i * 24}
                      r="1.8" fill="#185FA5" fillOpacity="0.5"/>
                  ))}
                </g>
              ))}
            </g>
          )
        })}

        {/* House */}
        <g>
          <rect x="290" y="160" width="40" height="45" rx="3" fill="#2A2A1A" stroke="#C8903A" strokeWidth="1.5"/>
          <polygon points="285,162 330,162 310,145" fill="#3A3A1A" stroke="#C8903A" strokeWidth="1"/>
          <text x="310" y="220" textAnchor="middle" fill="#C8903A" fontSize="8" fontFamily="monospace">HOUSE</text>
        </g>

        {/* Pond crate (top) */}
        <g>
          <rect x="358" y="38" width="44" height="30" rx="4" fill="#0D2A3A" stroke="#185FA5" strokeWidth="1.5"/>
          <text x="380" y="53" textAnchor="middle" fill="#85B7EB" fontSize="7.5" fontFamily="monospace">POND</text>
          <text x="380" y="63" textAnchor="middle" fill="#5C7080" fontSize="6.5" fontFamily="monospace">CRATE</text>
        </g>

        {/* Back crate (bottom) */}
        <g>
          <rect x="400" y="540" width="40" height="28" rx="4" fill="#0D2A3A" stroke="#185FA5" strokeWidth="1.5"/>
          <text x="420" y="554" textAnchor="middle" fill="#85B7EB" fontSize="7.5" fontFamily="monospace">BACK</text>
          <text x="420" y="564" textAnchor="middle" fill="#5C7080" fontSize="6.5" fontFamily="monospace">CRATE</text>
        </g>

        {/* 10HP Motor */}
        <g>
          <rect x="595" y="500" width="44" height="22" rx="3" fill="#8B4513" stroke="#C8903A" strokeWidth="1.5"/>
          <text x="617" y="514" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="bold" fontFamily="monospace">10HP MTR</text>
        </g>

        {/* Legend */}
        <g transform="translate(10, 535)">
          {[
            { col:'#34A853', label:'On track' },
            { col:'#F59E0B', label:'1 miss' },
            { col:'#EA7020', label:'2 miss' },
            { col:'#EF4444', label:'3+ / never' },
          ].map((l, i) => (
            <g key={i} transform={`translate(${i * 90}, 0)`}>
              <circle cx="6" cy="6" r="5" fill={l.col} fillOpacity="0.9"/>
              <text x="14" y="10" fill="#9AA5B4" fontSize="7.5" fontFamily="monospace">{l.label}</text>
            </g>
          ))}
        </g>

      </svg>
    </div>
  )
}
