import { Circle } from 'lucide-react'
import { Card, CardBody, CardHeader } from './Card'
import Badge from './Badge'

/**
 * Temporary body for pages that are built in a later phase.
 * Remove this component's usage page by page as each phase lands.
 */
export default function ComingSoon({ phase, items }) {
  return (
    <Card>
      <CardHeader
        title="Built in a later phase"
        subtitle="The page exists and is reachable so you can check navigation and role access."
        action={<Badge tone="amber">Phase {phase}</Badge>}
      />
      <CardBody>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">This page will include</p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] text-ink-2">
              <Circle className="mt-1 h-2 w-2 shrink-0 fill-line text-line" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

