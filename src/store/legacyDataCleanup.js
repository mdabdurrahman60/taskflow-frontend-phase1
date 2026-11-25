function clearTaskIdentities(tasks) {
  return tasks.map((task) => {
    const taskData = { ...task }
    delete taskData.assigneeId
    delete taskData.reporterId
    delete taskData.creatorId
    delete taskData.departmentId
    return {
      ...taskData,
      assigneeId: null,
      reporterId: null,
      creatorId: null,
      departmentId: null,
      comments: (task.comments || []).map((comment) => {
        const cleanedComment = { ...comment }
        delete cleanedComment.userId
        return cleanedComment
      }),
      subtasks: (task.subtasks || []).map((subtask) => {
        const subtaskData = { ...subtask }
        delete subtaskData.assigneeId
        delete subtaskData.creatorId
        delete subtaskData.departmentId
        return {
          ...subtaskData,
          assigneeId: null,
          creatorId: null,
          departmentId: null,
          comments: (subtask.comments || []).map((comment) => {
            const cleanedComment = { ...comment }
            delete cleanedComment.userId
            return cleanedComment
          }),
        }
      }),
    }
  })
}

function clearTicketIdentities(tickets) {
  return tickets.map((ticket) => {
    const ticketData = { ...ticket }
    delete ticketData.requesterId
    delete ticketData.assigneeId
    delete ticketData.createdById
    delete ticketData.departmentId
    return {
      ...ticketData,
      requesterId: null,
      assigneeId: null,
      createdById: null,
      departmentId: null,
      updates: (ticket.updates || []).map((update) => {
        const cleanedUpdate = { ...update }
        delete cleanedUpdate.authorId
        return cleanedUpdate
      }),
    }
  })
}

export function sanitizeLegacyAppState(state) {
  const cleaned = {
    ...state,
    users: [],
    departments: [],
    currentUserId: null,
    notifications: [],
    activity: [],
  }
  if (Array.isArray(cleaned.tasks)) cleaned.tasks = clearTaskIdentities(cleaned.tasks)
  if (Array.isArray(cleaned.tickets)) cleaned.tickets = clearTicketIdentities(cleaned.tickets)
  if (Array.isArray(cleaned.projects)) {
    cleaned.projects = cleaned.projects.map((project) => ({
      ...project,
      projectManagerId: null,
      ownerId: null,
      createdBy: null,
      teamMemberIds: [],
      departmentId: null,
    }))
  }
  return cleaned
}

export { clearTaskIdentities, clearTicketIdentities }
