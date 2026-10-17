import { taskDescriptionToHtml } from '../../utils/taskDescription'

export default function TaskDescription({ value, className = '' }) {
  const html = taskDescriptionToHtml(value)
  if (!html) return null

  return (
    <div
      className={`task-rich-content min-w-0 break-words text-[13px] text-ink-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
