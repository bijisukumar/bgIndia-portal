// Who started an enquiry: the customer (from the website's estimate page), the owner, or a
// staff member (Raman, Pradosh ...). Read from the enquiry's created_by, so no new column and
// every enquiry already on file gets a label. Shown next to the guest's name.
const STYLES = {
  customer: { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E' },
  owner:    { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
  staff:    { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  auto:     { bg: 'rgba(148,163,184,0.15)', color: '#94A3B8' },
}

export function initiatedBy(createdBy) {
  const v = String(createdBy || '').trim().toLowerCase()
  if (!v) return null
  if (v === 'website' || v === 'customer') return { label: 'Customer', kind: 'customer' }
  if (v === 'owner' || v === 'master_owner') return { label: 'Owner', kind: 'owner' }
  if (v === 'auto' || v === 'system') return { label: 'Auto', kind: 'auto' }
  return { label: v.charAt(0).toUpperCase() + v.slice(1), kind: 'staff' }   // raman, pradosh, ...
}

export default function InitiatorBadge({ createdBy, style }) {
  const who = initiatedBy(createdBy)
  if (!who) return null
  const c = STYLES[who.kind]
  return (
    <span title={`Initiated by ${who.label}`}
      style={{ background: c.bg, color: c.color, fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap', ...style }}>
      {who.label}
    </span>
  )
}
