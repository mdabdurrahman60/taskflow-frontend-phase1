const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 border border-brand-600 shadow-card',
  secondary: 'bg-white text-ink-2 hover:bg-surface border border-line shadow-card',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 border border-transparent',
  danger: 'bg-white text-brand-700 hover:bg-brand-50 border border-brand-200',
}

const SIZES = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-[13px] gap-2',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  )
}
