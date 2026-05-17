import { createContext, useContext, useState, useEffect } from 'react'
import { CONFIG } from '../config.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Persist session in sessionStorage — clears when browser/tab closes
    try {
      const saved = sessionStorage.getItem('ge_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const login = (pin) => {
    const found = CONFIG.users[pin]
    if (!found) return false
    const userData = { ...found, pin }
    setUser(userData)
    sessionStorage.setItem('ge_user', JSON.stringify(userData))
    // Store actor for X-Actor header — maps role to DB actor value
    // owner → 'owner', manager (Raman) → 'raman', estate_manager (Pradosh) → 'pradosh'
    const actorMap = { owner: 'owner', manager: 'raman', estate_manager: 'pradosh' }
    sessionStorage.setItem('ge_actor', actorMap[found.role] || 'owner')
    return true
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('ge_user')
    sessionStorage.removeItem('ge_actor')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
