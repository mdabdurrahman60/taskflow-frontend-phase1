import { useCallback, useEffect, useRef, useState } from 'react'
import useClickOutside from '../../hooks/useClickOutside'

/**
 * Small dropdown primitive used by the notification bell, profile menu,
 * quick-create menu and role switcher.
 *
 *   <Popover trigger={({ open, toggle }) => <button onClick={toggle} />}>
 *     {({ close }) => <div>panel content</div>}
 *   </Popover>
 */
export default function Popover({ trigger, children, align = 'right', panelClassName = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  useClickOutside(ref, close, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle, close })}
      {open && (
        <div
          className={`absolute z-50 mt-2 max-w-[calc(100vw-1rem)] rounded-lg bg-white shadow-pop ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  )
}
