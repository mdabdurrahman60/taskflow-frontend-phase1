// Date helpers. Mock data is generated relative to "today" so the demo always
// has believable overdue / upcoming items no matter when it is presented.

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (avoids UTC off-by-one problems). */
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

export function minutesAgo(m) {
  return new Date(Date.now() - m * 60 * 1000).toISOString()
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d)
}

export function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(iso)
}

export function getGreeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** A task is overdue when its due date has passed and it is not finished. */
export function isOverdue(dueDate, status) {
  if (!dueDate || status === 'Completed' || status === 'Cancelled') return false
  return dueDate < toISODate(new Date())
}
