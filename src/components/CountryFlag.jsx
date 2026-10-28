// A country's flag and name beside a phone number (2026-10-28, Complete booking's Guest info).
//
// The flags are small inline SVGs, not the flag emoji: Windows' emoji font has no flags, so on a Windows desktop (Chrome, Edge) the
// emoji shows as two letters, "IN", exactly where the flag should be. A country without a drawing here gets a plain code badge,
// the same on every device. To add one, add an entry to FLAGS: its own width and height for the viewBox, and its shapes.
import { useId } from 'react'
import { waNumber } from '../utils/guestMessages'
import { countryFromDigits, countryName } from '../utils/phoneCountry'

// "cx,cy" points of an n-pointed star
const starPoints = (cx, cy, outer, inner, n) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (-90 + i * 180 / n) * Math.PI / 180
  const r = i % 2 ? inner : outer
  return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
}).join(' ')
const Star = ({ cx, cy, r, fill, n = 5, stroke, sw }) => (
  <polygon points={starPoints(cx, cy, r, n === 5 ? r * 0.382 : r * 0.45, n)} fill={fill} stroke={stroke} strokeWidth={sw} />
)

// the Union Jack in a 60 x 30 box (the usual construction: the red diagonals are counter-changed, hence the clip paths)
const UnionJack = ({ uid }) => (
  <>
    <clipPath id={`${uid}s`}><path d="M0,0 v30 h60 v-30 z" /></clipPath>
    <clipPath id={`${uid}t`}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
    <g clipPath={`url(#${uid}s)`}>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${uid}t)`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </>
)

const bandsH = cols => cols.map((c, i) => <rect key={i} y={(20 / cols.length) * i} width="30" height={20 / cols.length + 0.02} fill={c} />)
const bandsV = cols => cols.map((c, i) => <rect key={i} x={(30 / cols.length) * i} width={30 / cols.length + 0.02} height="20" fill={c} />)

// one entry per country: the viewBox size and the drawing
const FLAGS = {
  IN: { w: 30, h: 20, draw: () => (
    <>
      {bandsH(['#FF9933', '#FFFFFF', '#138808'])}
      <g transform="translate(15 10)" fill="none" stroke="#000080">
        <circle r="2.7" strokeWidth="0.45" />
        <circle r="0.55" fill="#000080" stroke="none" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = i * 15 * Math.PI / 180
          return <line key={i} x1="0" y1="0" x2={(2.7 * Math.cos(a)).toFixed(2)} y2={(2.7 * Math.sin(a)).toFixed(2)} strokeWidth="0.22" />
        })}
      </g>
    </>
  ) },
  AE: { w: 40, h: 20, draw: () => (
    <>
      <rect width="40" height="20" fill="#00732F" />
      <rect y="6.67" x="10" width="30" height="6.67" fill="#fff" />
      <rect y="13.33" x="10" width="30" height="6.67" fill="#000" />
      <rect width="10" height="20" fill="#FF0000" />
    </>
  ) },
  US: { w: 38, h: 20, draw: () => (
    <>
      {Array.from({ length: 13 }, (_, i) => <rect key={i} y={(20 / 13) * i} width="38" height={20 / 13 + 0.02} fill={i % 2 ? '#fff' : '#B22234'} />)}
      <rect width="15.2" height={(7 * 20) / 13} fill="#3C3B6E" />
      {Array.from({ length: 9 }, (_, r) => Array.from({ length: r % 2 ? 5 : 6 }, (_, c) => (
        <circle key={`${r}-${c}`} cx={((r % 2 ? 2 * c + 2 : 2 * c + 1) * 15.2) / 12} cy={((r + 1) * ((7 * 20) / 13)) / 10} r="0.5" fill="#fff" />
      )))}
    </>
  ) },
  GB: { w: 60, h: 30, draw: uid => <UnionJack uid={uid} /> },
  AU: { w: 60, h: 30, draw: uid => (
    <>
      <rect width="60" height="30" fill="#00008B" />
      <g transform="scale(.5)"><UnionJack uid={uid} /></g>
      <Star cx={15} cy={22.5} r={5} n={7} fill="#fff" />
      <Star cx={45} cy={4.2} r={2.6} n={7} fill="#fff" />
      <Star cx={37} cy={13} r={2.6} n={7} fill="#fff" />
      <Star cx={52} cy={11} r={2.6} n={7} fill="#fff" />
      <Star cx={45} cy={24.5} r={2.6} n={7} fill="#fff" />
      <Star cx={49} cy={16.5} r={1.6} n={5} fill="#fff" />
    </>
  ) },
  NZ: { w: 60, h: 30, draw: uid => (
    <>
      <rect width="60" height="30" fill="#00247D" />
      <g transform="scale(.5)"><UnionJack uid={uid} /></g>
      {[[45, 5], [38, 14], [52, 11.5], [45, 24.5]].map(([x, y], i) => <Star key={i} cx={x} cy={y} r={3} fill="#CC142B" stroke="#fff" sw={0.6} />)}
    </>
  ) },
  CA: { w: 40, h: 20, draw: () => (
    <>
      <rect width="40" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#FF0000" />
      <rect x="30" width="10" height="20" fill="#FF0000" />
      <polygon transform="translate(20 10) scale(0.95) translate(-10 -9.5)" fill="#FF0000"
        points="10,1 11.6,4.6 13.8,3.8 13.2,7.6 16.6,6.4 15.6,8.6 18.6,9.2 16,12 16.8,13.4 11,12.6 11,17.6 9,17.6 9,12.6 3.2,13.4 4,12 1.4,9.2 4.4,8.6 3.4,6.4 6.8,7.6 6.2,3.8 8.4,4.6" />
    </>
  ) },
  SG: { w: 30, h: 20, draw: () => (
    <>
      <rect width="30" height="10" fill="#EF3340" />
      <rect y="10" width="30" height="10" fill="#fff" />
      <circle cx="7.5" cy="5" r="4.3" fill="#fff" />
      <circle cx="9" cy="5" r="3.6" fill="#EF3340" />
      {[0, 1, 2, 3, 4].map(k => {
        const a = (-90 + k * 72) * Math.PI / 180
        return <Star key={k} cx={12.8 + 3 * Math.cos(a)} cy={5 + 3 * Math.sin(a)} r={0.95} fill="#fff" />
      })}
    </>
  ) },
  QA: { w: 56, h: 22, draw: () => {
    const step = 22 / 9, x0 = 16, d = 5
    const pts = ['0,0', `${x0},0`]
    for (let k = 0; k < 9; k++) pts.push(`${x0 + d},${((k + 0.5) * step).toFixed(2)}`, `${x0},${((k + 1) * step).toFixed(2)}`)
    pts.push('0,22')
    return (
      <>
        <rect width="56" height="22" fill="#8A1538" />
        <polygon points={pts.join(' ')} fill="#fff" />
      </>
    )
  } },
  DE: { w: 30, h: 18, draw: () => (
    <>
      <rect width="30" height="6" fill="#000" />
      <rect y="6" width="30" height="6" fill="#DD0000" />
      <rect y="12" width="30" height="6" fill="#FFCE00" />
    </>
  ) },
  FR: { w: 30, h: 20, draw: () => bandsV(['#0055A4', '#FFFFFF', '#EF4135']) },
  IT: { w: 30, h: 20, draw: () => bandsV(['#009246', '#FFFFFF', '#CE2B37']) },
  NL: { w: 30, h: 20, draw: () => bandsH(['#AE1C28', '#FFFFFF', '#21468B']) },
  RU: { w: 30, h: 20, draw: () => bandsH(['#FFFFFF', '#0039A6', '#D52B1E']) },
  JP: { w: 30, h: 20, draw: () => (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ) },
}

// a flag, or (no drawing yet) the country's code in a small badge
export function CountryFlag({ iso, height = 14 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const f = FLAGS[iso]
  if (!f) {
    return (
      <span aria-hidden="true" style={{ display: 'inline-block', minWidth: 20, height, lineHeight: `${height - 2}px`, boxSizing: 'border-box', textAlign: 'center', padding: '0 3px',
        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.04em', borderRadius: 2, border: '1px solid var(--border-dim)', color: 'var(--text-dim)' }}>{iso}</span>
    )
  }
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${f.w} ${f.h}`} width={Math.round((height * f.w) / f.h)} height={height}
      style={{ display: 'block', flexShrink: 0, borderRadius: 2, boxShadow: '0 0 0 1px rgba(255,255,255,0.22)' }}>
      {f.draw(uid)}
    </svg>
  )
}

// The flag and the country's name for a stored phone number; nothing when the number's country is not known. Put it next to the
// number in a flex row that wraps (columnGap for the space between), so on a narrow screen it drops under the number, flush left.
export function PhoneCountry({ phone, style }) {
  const c = countryFromDigits(waNumber(phone))
  if (!c) return null
  const name = countryName(c.iso)
  return (
    <span title={`${name} (${c.code})`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: '400', color: 'var(--text-dim)', whiteSpace: 'nowrap', ...style }}>
      <CountryFlag iso={c.iso} />
      {name}
    </span>
  )
}

export const FLAG_COUNTRIES = Object.keys(FLAGS)
