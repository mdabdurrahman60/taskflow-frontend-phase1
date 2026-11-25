import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import Button from '../ui/Button.jsx'

export default function RequireAuth({ children }) {
  const { status, error, user, restoreSession } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-muted" role="status">
        Checking your TaskFlow session…
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-center">
        <p className="text-sm font-medium text-ink">Unable to connect to TaskFlow.</p>
        <p className="max-w-md text-sm text-muted">{error?.message || 'Check that the backend is running and try again.'}</p>
        <Button variant="primary" onClick={restoreSession}>Retry connection</Button>
      </div>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}
