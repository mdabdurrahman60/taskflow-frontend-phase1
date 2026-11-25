import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import Button from '../components/ui/Button.jsx'
import { Card, CardBody } from '../components/ui/Card.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { ApiError } from '../api/apiClient.js'

export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const required = Boolean(user?.mustChangePassword)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) {
      setError('Use at least 12 characters and no more than 72 UTF-8 bytes.')
      return
    }

    setSubmitting(true)
    try {
      await changePassword({
        ...(required ? {} : { currentPassword }),
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      navigate('/', { replace: true })
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === 'INVALID_CURRENT_PASSWORD') {
        setError('The current password is incorrect.')
      } else {
        setError(requestError instanceof Error ? requestError.message : 'The password could not be changed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <section className="w-full max-w-lg">
        <PageHeader
          title={required ? 'Set a new password' : 'Change password'}
          description={required
            ? 'Your account has a temporary password. Choose a new password to continue to TaskFlow.'
            : 'Update your TaskFlow sign-in password.'}
        />
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{required ? 'Password update required' : 'Account security'}</p>
                <p className="text-xs text-muted">Minimum 12 characters; maximum 72 UTF-8 bytes.</p>
              </div>
            </div>
            {error && <p role="alert" className="mb-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-700">{error}</p>}
            <form onSubmit={submit} className="space-y-4">
              {!required && (
                <label className="block text-[13px] font-medium text-ink">
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
                  />
                </label>
              )}
              <label className="block text-[13px] font-medium text-ink">
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
                />
              </label>
              <label className="block text-[13px] font-medium text-ink">
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={72}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                {!required && <Link to="/settings"><Button variant="secondary" disabled={submitting}>Cancel</Button></Link>}
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </section>
    </main>
  )
}
