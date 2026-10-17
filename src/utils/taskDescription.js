import DOMPurify from 'dompurify'

const HTML_TAGS = /<\/?\s*[a-z][^>]*>/i
const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['style', 'colspan', 'rowspan', 'scope', 'width', 'align', 'valign', 'cellpadding', 'cellspacing'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'svg', 'math'],
}

export function sanitizeTaskDescriptionHtml(html) {
  return DOMPurify.sanitize(String(html ?? ''), SANITIZE_OPTIONS)
}

export function sanitizePastedTaskDescriptionHtml(html) {
  const safeHtml = sanitizeTaskDescriptionHtml(html)
  const parsed = new DOMParser().parseFromString(safeHtml, 'text/html')

  parsed.querySelectorAll('span').forEach((span) => {
    const style = span.style
    const wrappers = []
    if (style.fontWeight === 'bold' || Number.parseInt(style.fontWeight, 10) >= 600) wrappers.push('strong')
    if (style.fontStyle === 'italic') wrappers.push('em')
    const decoration = `${style.textDecoration} ${style.textDecorationLine}`
    if (decoration.includes('underline')) wrappers.push('u')
    if (decoration.includes('line-through')) wrappers.push('s')
    if (!wrappers.length) return

    let content = span
    for (const tag of wrappers.reverse()) {
      const wrapper = parsed.createElement(tag)
      while (content.firstChild) wrapper.append(content.firstChild)
      content.replaceWith(wrapper)
      content = wrapper
    }
  })

  parsed.querySelectorAll('td[style], th[style], td[align], th[align]').forEach((cell) => {
    const alignment = cell.style.textAlign || cell.getAttribute('align')
    if (!['left', 'center', 'right', 'justify'].includes(alignment)) return
    const paragraphs = [...cell.querySelectorAll('p')]
    if (paragraphs.length) {
      paragraphs.forEach((paragraph) => { paragraph.style.textAlign = alignment })
    } else {
      const paragraph = parsed.createElement('p')
      paragraph.style.textAlign = alignment
      while (cell.firstChild) paragraph.append(cell.firstChild)
      cell.append(paragraph)
    }
  })

  return sanitizeTaskDescriptionHtml(parsed.body.innerHTML)
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export function taskDescriptionToHtml(description) {
  const content = String(description ?? '')
  if (!content) return ''
  if (HTML_TAGS.test(content)) return sanitizeTaskDescriptionHtml(content)

  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>') || '<br>'}</p>`)
    .join('')
}
