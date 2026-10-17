// Initials avatar with a stable, muted colour per person.
const TONES = [
  'bg-slate-100 text-slate-700',
  'bg-red-50 text-red-700',
  'bg-amber-50 text-amber-700',
  'bg-emerald-50 text-emerald-700',
  'bg-sky-50 text-sky-700',
  'bg-violet-50 text-violet-700',
]

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-14 w-14 text-lg',
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function initials(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function Avatar({ user, name, size = 'md', className = '' }) {
  const label = user?.name ?? name ?? '?'
  const tone = TONES[hash(user?.id ?? label) % TONES.length]
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${tone} ${SIZES[size]} ${className}`}
    >
      {initials(label)}
    </span>
  )
}
