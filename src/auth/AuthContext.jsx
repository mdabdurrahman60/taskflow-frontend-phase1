import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ApiError, apiClient } from '../api/apiClient.js'

const AuthContext = createContext(null)

function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [error, setError] = useState(null)

  const acceptSession = useCallback((response) => {
    const authenticatedUser = response?.data?.user
    if (!authenticatedUser?.id || !authenticatedUser?.role) {
      throw new ApiError('The server returned an incomplete user profile.', { code: 'INVALID_RESPONSE' })
    }
    setUser(authenticatedUser)
    setPermissions(Array.isArray(response.data.permissions) ? response.data.permissions : [])
    setError(null)
    setStatus('authenticated')
    return authenticatedUser
  }, [])

  const restoreSession = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      acceptSession(await apiClient.auth.me())
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        setUser(null)
        setPermissions([])
        setStatus('unauthenticated')
        setError(null)
        return
      }
      setUser(null)
      setPermissions([])
      setStatus('error')
      setError(requestError)
    }
  }, [acceptSession])

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null)
      setPermissions([])
      setStatus('unauthenticated')
      setError(null)
    }
    window.addEventListener('taskflow:auth-expired', handleExpiredSession)
    return () => window.removeEventListener('taskflow:auth-expired', handleExpiredSession)
  }, [])

  const login = useCallback(async (credentials) => {
    setError(null)
    await apiClient.auth.csrf()
    return acceptSession(await apiClient.auth.login(credentials))
  }, [acceptSession])

  const changePassword = useCallback(async (passwords) => {
    const response = await apiClient.auth.changePassword(passwords)
    acceptSession(response)
    return response
  }, [acceptSession])

  const updateAuthenticatedUser = useCallback((profile) => {
    setUser((previous) => {
      if (!previous || profile?.id !== previous.id) return previous
      return { ...previous, ...profile }
    })
  }, [])

  const logout = useCallback(async () => {
    await apiClient.auth.logout()
    setUser(null)
    setPermissions([])
    setStatus('unauthenticated')
    setError(null)
  }, [])

  const value = useMemo(() => ({
    status,
    user,
    permissions,
    error,
    login,
    changePassword,
    updateAuthenticatedUser,
    logout,
    restoreSession,
  }), [status, user, permissions, error, login, changePassword, updateAuthenticatedUser, logout, restoreSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
