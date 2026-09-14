import type { AuthResult, Role, User } from './api'

const KEY = 'arogyakhosh.session'

export interface Session {
  token: string
  role: Role
  user: User
  expiresAt: number
}

export function saveSession(result: AuthResult): Session {
  const session: Session = {
    token: result.token,
    role: result.role ?? result.user.role,
    user: result.user,
    expiresAt: Date.now() + result.expires_in * 1000,
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Storage can be unavailable in private windows; the session stays in memory.
  }

  return session
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const session = JSON.parse(raw) as Session
    if (!session.token || typeof session.expiresAt !== 'number') return null

    return session
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
