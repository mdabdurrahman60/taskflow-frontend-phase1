export function getProjectProgress(tasks) {
  const completed = tasks.filter((task) => task.status === 'Completed').length
  const total = tasks.length
  return {
    completed,
    total,
    pending: total - completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  }
}
