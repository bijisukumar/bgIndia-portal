import { useMemo } from 'react'
import { qrEncode, qrPath } from '../utils/qrcode'

// A QR code drawn as SVG, in the browser itself: the text (a UPI payment link: the payee, the amount) never goes to another service.
// Black on white with the quiet zone the standard asks for, whatever the screen's theme, so any phone camera or UPI app can read it.
export default function UpiQr({ value, size = 220, label = 'QR code' }) {
  const qr = useMemo(() => (value ? qrEncode(value) : null), [value])
  if (!qr) return null
  const quiet = 4
  const n = qr.size + quiet * 2
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" style={{ display: 'block', background: '#fff', maxWidth: '100%', height: 'auto' }}>
      <rect width={n} height={n} fill="#fff" />
      <path d={qrPath(qr, quiet)} fill="#000" />
    </svg>
  )
}
