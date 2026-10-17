import { ChevronRight } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../../store/useApp'
import { getBreadcrumbs } from '../../utils/navigation'

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const { role } = useApp()
  const crumbs = getBreadcrumbs(pathname, role)
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={c.label} className={`flex items-center gap-1.5 ${last ? 'min-w-0' : 'hidden sm:flex'}`}>
              {i > 0 && <ChevronRight className="hidden h-3.5 w-3.5 text-faint sm:block" aria-hidden="true" />}
              <span className={`truncate ${last ? 'font-semibold text-ink' : 'text-muted'}`} aria-current={last ? 'page' : undefined}>
                {c.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
