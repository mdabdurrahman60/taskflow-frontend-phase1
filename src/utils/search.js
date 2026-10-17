// Global search used by the top bar. Phase 3 will add tasks and tickets here.

export function searchGlobal(query, { navGroups, users, departments, canViewDirectory }) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const pages = navGroups
    .flatMap((g) => g.items)
    .filter((item) => item.label.toLowerCase().includes(q))
    .map((item) => ({
      type: 'page',
      id: `page-${item.key}`,
      label: item.label,
      hint: item.groupLabel,
      to: item.path,
      icon: item.icon,
    }))

  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? ''

  const people = canViewDirectory
    ? users
        .filter((u) => u.name.toLowerCase().includes(q) || u.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((u) => ({
          type: 'person',
          id: `person-${u.id}`,
          label: u.name,
          hint: `${u.title} · ${deptName(u.departmentId)}`,
          to: `/employees?q=${encodeURIComponent(u.name)}`,
          user: u,
        }))
    : []

  return [...pages, ...people]
}
