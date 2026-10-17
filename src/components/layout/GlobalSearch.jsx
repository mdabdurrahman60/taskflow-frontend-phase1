import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'
import Avatar from '../ui/Avatar'
import useClickOutside from '../../hooks/useClickOutside'
import { useApp } from '../../store/useApp'
import { getNavForRole } from '../../utils/navigation'
import { searchGlobal } from '../../utils/search'

export default function GlobalSearch({ autoFocus = false, hotkey = false, onDone }) {
  const { role, users, departments, can } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const results = useMemo(
    () => searchGlobal(query, { navGroups: getNavForRole(role), users, departments, canViewDirectory: can('directory.view') }),
    [query, role, users, departments, can],
  )

  useClickOutside(wrapRef, () => setOpen(false), open)

  // Ctrl/Cmd+K focuses the search box.
  useEffect(() => {
    if (!hotkey) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hotkey])

  const choose = (result) => {
    navigate(result.to)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
    onDone?.()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      onDone?.()
    }
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={wrapRef} className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-label="Search TaskFlow"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search pages and people"
        className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-14 text-[13px] text-ink placeholder:text-faint focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 [&::-webkit-search-cancel-button]:hidden"
      />
      {hotkey && (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted lg:block">
          Ctrl K
        </kbd>
      )}

      {showPanel && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg bg-white shadow-pop">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">No results for "{query}"</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map((r, i) => {
                const Icon = r.icon
                return (
                  <li key={r.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(r)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${i === active ? 'bg-surface-2' : ''}`}
                    >
                      {r.type === 'person' ? (
                        <Avatar user={r.user} size="sm" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-surface-2 text-muted">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{r.label}</span>
                        <span className="block truncate text-xs text-muted">{r.hint}</span>
                      </span>
                      {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
