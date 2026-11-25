import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, EyeOff, ImagePlus, KeyRound, Save, Trash2, Upload } from 'lucide-react'
import Avatar from '../components/ui/Avatar.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import PageHeader from '../components/ui/PageHeader.jsx'
import { ApiError, apiClient } from '../api/apiClient.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useApp } from '../store/useApp.js'
import { useToast } from '../components/ui/useToast.js'

const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_BYTES = 72

function byteLength(value) {
  return new TextEncoder().encode(value).length
}

function passwordStrength(password) {
  if (!password) return { score: 0, label: 'Not entered' }
  const score = [
    password.length >= PASSWORD_MIN_LENGTH,
    byteLength(password) <= PASSWORD_MAX_BYTES,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong']
  return { score, label: labels[score] }
}

function roleLabel(role) {
  return {
    SUPERADMIN: 'Superadmin',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    HR: 'HR',
    SUPPORT: 'Support Staff',
    EXECUTIVE: 'Executive',
  }[role] || role || '—'
}

export default function ProfilePage() {
  const { user, changePassword, updateAuthenticatedUser } = useAuth()
  const { departments } = useApp()
  const toast = useToast()
  const fileInput = useRef(null)
  const [profile, setProfile] = useState(user)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState(user?.phone || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [pictureFile, setPictureFile] = useState(null)
  const [picturePreview, setPicturePreview] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    let active = true
    apiClient.profile.get()
      .then((response) => {
        if (!response?.data?.id || response.data.id !== user?.id) throw new Error('The profile response was invalid.')
        if (!active) return
        setProfile(response.data)
        setPhone(response.data.phone || '')
        updateAuthenticatedUser(response.data)
      })
      .catch((error) => {
        if (active) toast({ title: 'Profile unavailable', description: error.message, type: 'error' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [toast, updateAuthenticatedUser, user?.id])

  useEffect(() => () => {
    if (picturePreview) URL.revokeObjectURL(picturePreview)
  }, [picturePreview])

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword])
  const passwordChecks = [
    { label: 'At least 12 characters', valid: newPassword.length >= PASSWORD_MIN_LENGTH },
    { label: 'No more than 72 UTF-8 bytes', valid: !!newPassword && byteLength(newPassword) <= PASSWORD_MAX_BYTES },
    { label: 'Different from the current password', valid: !!newPassword && newPassword !== currentPassword },
    { label: 'New passwords match', valid: !!confirmPassword && confirmPassword === newPassword },
  ]

  const savePersonalInformation = async (event) => {
    event.preventDefault()
    setProfileSaving(true)
    try {
      const response = await apiClient.profile.update({ phone: phone.trim() || null })
      setProfile(response.data)
      setPhone(response.data.phone || '')
      updateAuthenticatedUser(response.data)
      toast({ title: 'Profile updated', description: 'Your personal information was saved.', type: 'success' })
    } catch (error) {
      toast({ title: 'Profile not updated', description: error.message, type: 'error' })
    } finally {
      setProfileSaving(false)
    }
  }

  const selectPicture = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Unsupported image', description: 'Choose a JPEG, PNG, or WebP image.', type: 'error' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image is too large', description: 'Profile pictures must be 5 MB or smaller.', type: 'error' })
      return
    }
    setPicturePreview(URL.createObjectURL(file))
    setPictureFile(file)
  }

  const uploadPicture = async () => {
    if (!pictureFile) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const response = await apiClient.profile.uploadPicture(pictureFile, setUploadProgress)
      setProfile(response.data)
      updateAuthenticatedUser(response.data)
      setPictureFile(null)
      setPicturePreview('')
      setUploadProgress(100)
      if (response.warning) {
        toast({ title: 'Photo updated with a cleanup warning', description: response.warning, type: 'info' })
      } else {
        toast({ title: 'Profile photo updated', description: 'Your photo is now visible across TaskFlow.', type: 'success' })
      }
    } catch (error) {
      toast({ title: 'Photo not uploaded', description: error.message, type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const removePicture = async () => {
    if (!profile?.avatarUrl || !window.confirm('Remove your current profile photo?')) return
    try {
      const response = await apiClient.profile.removePicture()
      setProfile(response.data)
      updateAuthenticatedUser(response.data)
      toast({
        title: response.warning ? 'Profile photo removed with a cleanup warning' : 'Profile photo removed',
        description: response.warning || 'Your initials are now shown as your avatar.',
        type: response.warning ? 'info' : 'success',
      })
    } catch (error) {
      toast({ title: 'Photo not removed', description: error.message, type: 'error' })
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH || byteLength(newPassword) > PASSWORD_MAX_BYTES) {
      setPasswordError('Use at least 12 characters and no more than 72 UTF-8 bytes.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('Choose a password different from your current password.')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Your password was changed successfully. Other active sessions were signed out.')
    } catch (error) {
      setPasswordError(error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD'
        ? 'The current password is incorrect.'
        : error.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const department = profile?.department || departments.find((item) => item.id === profile?.departmentId)

  return (
    <div>
      <PageHeader title="My Profile" description="Manage your profile photo, personal contact information, and sign-in security." />
      {loading ? (
        <Card><CardBody><p role="status" className="text-[13px] text-muted">Loading your profile…</p></CardBody></Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="lg:sticky lg:top-4">
            <CardBody className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar user={{ ...profile, avatarUrl: picturePreview || profile?.avatarUrl }} size="xl" className="h-20 w-20 text-2xl" />
                <button
                  type="button"
                  aria-label="Upload or change profile photo"
                  onClick={() => fileInput.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-brand-700 shadow-card"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <h2 className="mt-4 text-base font-semibold text-ink">{profile?.name}</h2>
              <p className="mt-1 text-[13px] text-muted">{profile?.title}</p>
              <Badge tone="blue" className="mt-3">{roleLabel(profile?.role)}</Badge>
              <nav aria-label="Profile sections" className="mt-5 grid w-full gap-1 border-t border-line-soft pt-4 text-left">
                {[['personal-information', 'Personal information'], ['profile-picture', 'Profile picture'], ['change-password', 'Change password'], ['account-information', 'Account information']].map(([id, label]) => (
                  <a key={id} href={`#${id}`} className="rounded-md px-3 py-2 text-[13px] text-ink-2 hover:bg-surface-2">{label}</a>
                ))}
              </nav>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card id="personal-information">
              <CardHeader title="Personal information" subtitle="Only your phone number can be changed here." />
              <CardBody>
                <form onSubmit={savePersonalInformation} className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <ReadOnlyField label="Full name" value={profile?.name} />
                    <ReadOnlyField label="Email address" value={profile?.email} />
                    <label className="block text-[12px] font-medium text-ink">
                      Phone number
                      <input
                        type="tel"
                        autoComplete="tel"
                        maxLength={32}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="Add a phone number"
                        className="mt-1.5 h-10 w-full rounded-md border border-line bg-white px-3 text-[13px]"
                      />
                    </label>
                    <ReadOnlyField label="Designation" value={profile?.title} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" icon={Save} disabled={profileSaving || phone.trim() === (profile?.phone || '')}>
                      {profileSaving ? 'Saving…' : 'Save personal information'}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            <Card id="profile-picture">
              <CardHeader title="Profile picture" subtitle="JPEG, PNG, or WebP. Maximum file size: 5 MB." />
              <CardBody>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    selectPicture(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar user={{ ...profile, avatarUrl: picturePreview || profile?.avatarUrl }} size="xl" className="h-16 w-16 text-xl" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()}>
                      {profile?.avatarUrl ? 'Change photo' : 'Upload photo'}
                    </Button>
                    {profile?.avatarUrl && !picturePreview && (
                      <Button variant="danger" icon={Trash2} onClick={removePicture}>Remove photo</Button>
                    )}
                    {pictureFile && (
                      <>
                        <Button variant="primary" icon={Check} disabled={uploading} onClick={uploadPicture}>
                          {uploading ? 'Uploading…' : 'Save photo'}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={uploading}
                          onClick={() => {
                            setPictureFile(null)
                            setPicturePreview('')
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {pictureFile && <p className="mt-3 truncate text-xs text-muted">Preview: {pictureFile.name} · {(pictureFile.size / (1024 * 1024)).toFixed(2)} MB</p>}
                {uploading && (
                  <div className="mt-4" aria-live="polite">
                    <div className="mb-1 flex justify-between text-xs text-muted"><span>Uploading photo</span><span>{uploadProgress}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card id="change-password">
              <CardHeader title="Change password" subtitle="Use your current password to confirm this security change." />
              <CardBody>
                <form onSubmit={savePassword} className="space-y-4">
                  {passwordError && <p role="alert" className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-700">{passwordError}</p>}
                  {passwordSuccess && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{passwordSuccess}</p>}
                  <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showPasswords} toggle={() => setShowPasswords((value) => !value)} autoComplete="current-password" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <PasswordField label="New password" value={newPassword} onChange={setNewPassword} visible={showPasswords} toggle={() => setShowPasswords((value) => !value)} autoComplete="new-password" />
                    <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showPasswords} toggle={() => setShowPasswords((value) => !value)} autoComplete="new-password" />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-2">Password strength</span>
                      <span className="text-muted">{strength.label}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full transition-all ${strength.score <= 1 ? 'bg-red-500' : strength.score <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${strength.score * 20}%` }} />
                    </div>
                  </div>
                  <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
                    {passwordChecks.map((check) => (
                      <li key={check.label} className={check.valid ? 'text-emerald-700' : 'text-muted'}>
                        <span className="mr-1.5" aria-hidden="true">{check.valid ? '✓' : '○'}</span>{check.label}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" icon={KeyRound} disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}>
                      {passwordSaving ? 'Updating…' : 'Save new password'}
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            <Card id="account-information">
              <CardHeader title="Account information" subtitle="These values are managed by your organization." />
              <CardBody className="grid gap-3 md:grid-cols-2">
                <ReadOnlyField label="Employee ID" value={profile?.employeeId || 'Not applicable'} />
                <ReadOnlyField label="Department" value={department?.name || 'Unassigned'} />
                <ReadOnlyField label="Role" value={roleLabel(profile?.role)} />
                <ReadOnlyField label="Account status" value={profile?.status?.replaceAll('_', ' ') || '—'} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 break-words text-[13px] font-medium text-ink">{value || '—'}</p>
    </div>
  )
}

function PasswordField({ label, value, onChange, visible, toggle, autoComplete }) {
  return (
    <label className="block text-[12px] font-medium text-ink">
      {label}
      <span className="relative mt-1.5 block">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-line bg-white px-3 pr-10 text-[13px]"
        />
        <button type="button" onClick={toggle} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink">
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </span>
    </label>
  )
}
