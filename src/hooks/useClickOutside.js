import { useEffect } from 'react'

/** Calls `handler` when a mouse press happens outside `ref` (while `active`). */
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler(e)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler, active])
}
