import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LockKeyhole, LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import Button from '../components/ui/Button.jsx'
import { ApiError } from '../api/apiClient.js'

function errorMessage(error) {
  if (!(error instanceof ApiError)) return 'Sign-in failed. Please try again.'
  if (error.status === 401) return 'Employee ID or password is incorrect.'
  if (error.status === 403 && error.code.startsWith('CSRF')) {
    return 'Your security check expired. Please try signing in again.'
  }
  if (error.status === 403) return 'This sign-in request was blocked. Check the configured frontend origin.'
  if (error.status === 429) return 'Too many sign-in attempts. Wait a few minutes and try again.'
  return error.message
}

export default function LoginPage() {
  const { status, error: restoreError, login, restoreSession } = useAuth()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState('')

  if (status === 'authenticated') return <Navigate to="/" replace />

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setLoginError('')
    try {
      await login({ employeeId: employeeId.trim().includes('@') ? employeeId.trim() : employeeId.trim().toUpperCase(), password })
    } catch (error) {
      setLoginError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const serviceError = status === 'error' ? errorMessage(restoreError) : ''

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-line bg-white p-7 shadow-card sm:p-9">
        <div className="mb-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-brand-700">TaskFlow</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your organization account to continue.</p>
        </div>

        {(loginError || serviceError) && (
          <div role="alert" className="mb-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
            {loginError || serviceError}
          </div>
        )}

        {status === 'error' && (
          <Button className="mb-4 w-full" onClick={restoreSession}>
            Retry connection
          </Button>
        )}

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="login-employee-id" className="mb-1.5 block text-[13px] font-medium text-ink">Employee ID</label>
            <input
              id="login-employee-id"
              type="text"
              autoComplete="username"
              required
              placeholder="MIT030"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-faint"
            />
            <p className="mt-1 text-[11px] text-muted">Superadmins may continue to use their existing email address.</p>
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-medium text-ink">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-faint"
            />
          </div>
          <Button type="submit" variant="primary" icon={LogIn} className="mt-2 w-full" disabled={submitting || status === 'loading'}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 border-t border-line-soft pt-4 text-xs leading-5 text-muted">
          TaskFlow prototype areas remain locally stored. Authentication and employee records are provided by the configured backend.
        </p>
      </section>
    </main>
  )
}
