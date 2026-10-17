import { FlaskConical } from 'lucide-react'

/** Always-visible strip so nobody mistakes the prototype for a live system. */
export default function DemoBanner() {
  return (
    <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-ink px-3 text-[11px] font-medium text-white">
      <FlaskConical className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
      <span className="rounded bg-brand-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">Demo Mode</span>
      <span className="hidden truncate text-slate-300 sm:inline">
        Prototype with simulated data. Changes live in this browser tab only and are not saved to a server.
      </span>
    </div>
  )
}
