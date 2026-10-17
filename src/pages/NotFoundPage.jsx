import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-1 text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1.5 text-[13px] text-muted">The page you are looking for does not exist in this prototype.</p>
      <Link to="/" className="mt-5 inline-block">
        <Button variant="primary">Back to Overview</Button>
      </Link>
    </div>
  )
}
