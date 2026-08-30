// ============================================================
//  v2.0 — Authentication via server-side JWT
//  PINs are validated in the Worker (never in browser bundle).
//  On success the Worker returns a signed JWT stored in
//  sessionStorage. Every API call sends it as Bearer token.
//  Session clears when the tab closes (sessionStorage).
// ============================================================
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// Decode JWT payload without verification (Worker verifies on every request)
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      // v2.0 — clear legacy session keys from before JWT auth
      sessionStorage.removeItem('ge_user')
      sessionStorage.removeItem('ge_actor')

      const token = sessionStorage.getItem('ge_token')
      if (!token) return null
      const payload = decodeJwt(token)
      if (!payload || payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem('ge_token')
        return null
      }
      return { name: payload.name, role: payload.role, actor: payload.actor, tenantId: payload.tenantId, propertyIds: payload.propertyIds, compType: payload.compType }
    } catch { return null }
  })

  // Returns: { ok: true } | { ok: false, reason: 'invalid' | 'rate_limited', retryAfter }
  const login = async (pin) => {
    try {
      const res = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        return { ok: false, reason: 'rate_limited', retryAfter: data.retryAfter || 15 }
      }
      if (res.status === 401) {
        return { ok: false, reason: 'invalid' }
      }
      // A 5xx is our fault, not a wrong PIN. Reporting it as bad credentials
      // sends the user hunting for a password problem that does not exist.
      if (!res.ok) {
        return { ok: false, reason: 'server_error' }
      }

      const { token } = await res.json()
      const payload   = decodeJwt(token)
      if (!payload) return { ok: false, reason: 'invalid' }

      sessionStorage.setItem('ge_token', token)
      const userData = { name: payload.name, role: payload.role, actor: payload.actor, tenantId: payload.tenantId, propertyIds: payload.propertyIds, compType: payload.compType }
      setUser(userData)
      return { ok: true }
    } catch {
      // fetch() only throws when the request never completed — offline, DNS
      // gone, connection refused. This is exactly how a retired domain looked
      // to staff whose installed app still pointed at it: the cached shell
      // rendered, the request died, and the screen said "Invalid PIN".
      return { ok: false, reason: 'unreachable' }
    }
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('ge_token')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
