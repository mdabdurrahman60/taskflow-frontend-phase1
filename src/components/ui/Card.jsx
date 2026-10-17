export function Card({ className = '', children }) {
  return <section className={`rounded-lg border border-line bg-white shadow-card ${className}`}>{children}</section>
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <header className={`flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function CardBody({ className = '', children }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}
