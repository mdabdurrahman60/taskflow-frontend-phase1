import { hoursAgo, minutesAgo } from '../utils/dates'

// Notifications are per demo user.
// NOTE for later phases: task/ticket numbers mentioned here (e.g. TKT-1042)
// must exist in mockTasks.js / mockTickets.js so the story stays consistent.

export const MOCK_NOTIFICATIONS = [
  // Manager: Imran Chowdhury
  { id: 'n-01', userId: 'u-imran', type: 'task', title: 'Subtasks created', body: 'Ayesha Siddique split "Prepare Product Launch Campaign" into 4 subtasks.', link: '/team-tasks', createdAt: minutesAgo(25), read: false },
  { id: 'n-02', userId: 'u-imran', type: 'escalation', title: 'Ticket escalated to you', body: 'TKT-1042 "VPN access failing for Finance" needs a manager decision.', link: '/helpdesk', createdAt: hoursAgo(2), read: false },
  { id: 'n-03', userId: 'u-imran', type: 'deadline', title: 'Overdue work in Marketing', body: '2 tasks in your team are past their due date.', link: '/team-tasks', createdAt: hoursAgo(5), read: false },
  { id: 'n-04', userId: 'u-imran', type: 'system', title: 'Weekly workload report ready', body: 'Marketing team workload for last week is available.', link: '/reports', createdAt: hoursAgo(30), read: true },

  // Executive: Ayesha Siddique
  { id: 'n-05', userId: 'u-ayesha', type: 'comment', title: 'New comment', body: 'Rahim Hasan commented on "Write product descriptions".', link: '/my-tasks', createdAt: minutesAgo(18), read: false },
  { id: 'n-06', userId: 'u-ayesha', type: 'task', title: 'Subtask moved to In Review', body: 'Sarah Ahmed moved "Prepare product images" to In Review.', link: '/my-tasks', createdAt: minutesAgo(46), read: false },
  { id: 'n-07', userId: 'u-ayesha', type: 'task', title: 'New task assigned', body: 'Imran Chowdhury assigned you "Prepare Product Launch Campaign".', link: '/my-tasks', createdAt: hoursAgo(3), read: false },
  { id: 'n-08', userId: 'u-ayesha', type: 'ticket', title: 'Ticket update', body: 'TKT-1051 "Laptop battery drains quickly" is now In Progress.', link: '/helpdesk', createdAt: hoursAgo(26), read: true },

  // Superadmin: Kamal Hossain
  { id: 'n-09', userId: 'u-kamal', type: 'escalation', title: '3 tickets escalated this week', body: 'Review escalated tickets across departments.', link: '/helpdesk', createdAt: hoursAgo(1), read: false },
  { id: 'n-10', userId: 'u-kamal', type: 'system', title: 'Employee record change', body: 'Inactive status applied to Sohel Rana.', link: '/employees', createdAt: hoursAgo(9), read: false },
  { id: 'n-11', userId: 'u-kamal', type: 'system', title: 'Weekly platform summary', body: 'Organization-wide task and ticket summary is ready.', link: '/reports', createdAt: hoursAgo(28), read: true },

  // Admin: Farhana Rahman
  { id: 'n-12', userId: 'u-farhana', type: 'deadline', title: 'Overdue tasks in scope', body: 'IT Support has 2 overdue tasks.', link: '/team-tasks', createdAt: hoursAgo(1), read: false },
  { id: 'n-13', userId: 'u-farhana', type: 'escalation', title: 'Escalated ticket', body: 'TKT-1042 was escalated to Imran Chowdhury.', link: '/helpdesk', createdAt: hoursAgo(2), read: false },
  { id: 'n-14', userId: 'u-farhana', type: 'system', title: 'Employee onboarding', body: 'Rubel Mia\'s profile was updated by HR.', link: '/employees', createdAt: hoursAgo(20), read: true },

  // HR: Maliha Sultana
  { id: 'n-15', userId: 'u-maliha', type: 'task', title: 'Onboarding starts Monday', body: '2 new hires have incomplete onboarding checklists.', link: '/team-tasks', createdAt: minutesAgo(50), read: false },
  { id: 'n-16', userId: 'u-maliha', type: 'deadline', title: 'Compliance training due soon', body: 'Annual compliance training is due in 5 days.', link: '/team-tasks', createdAt: hoursAgo(6), read: false },
  { id: 'n-17', userId: 'u-maliha', type: 'system', title: 'Directory update', body: 'Tahmid Rahman is now marked On Leave.', link: '/employees', createdAt: hoursAgo(27), read: true },

  // Support Staff: Arif Mahmud
  { id: 'n-18', userId: 'u-arif', type: 'ticket', title: 'New ticket in queue', body: 'TKT-1053 "Meeting room display not working" was submitted.', link: '/helpdesk', createdAt: minutesAgo(12), read: false },
  { id: 'n-19', userId: 'u-arif', type: 'comment', title: 'Requester replied', body: 'Joya Das replied on TKT-1049.', link: '/helpdesk', createdAt: minutesAgo(55), read: false },
  { id: 'n-20', userId: 'u-arif', type: 'deadline', title: 'Response time warning', body: 'TKT-1047 needs a first response within 30 minutes.', link: '/helpdesk', createdAt: hoursAgo(1), read: false },
]
