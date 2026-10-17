# Monarch IT TaskFlow

Monarch IT TaskFlow is a frontend-only Issue & Task Tracker prototype for exploring task workflows, team permissions, projects, reporting, and internal support tickets. It is built with React 19 and Vite 8, with a responsive interface styled using Tailwind CSS 4.

> **Demo application:** there is no backend, server-side database, or real authentication. Demo records and changes are stored in the current browser's `localStorage`; they are not shared between users or devices.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Available scripts](#available-scripts)
- [Application structure](#application-structure)
- [Pages and navigation](#pages-and-navigation)
- [Demo roles and permissions](#demo-roles-and-permissions)
- [State and persistence](#state-and-persistence)
- [Rich-text task descriptions](#rich-text-task-descriptions)
- [Employee performance reports](#employee-performance-reports)
- [Tests](#tests)
- [Limitations and production considerations](#limitations-and-production-considerations)
- [Troubleshooting](#troubleshooting)

## Features

- **Overview:** dashboard-style summary of work and activity available to the selected demo user.
- **My Tasks:** search, filter, sort, and view assigned tasks as a list or board; open task details, update permitted fields, comment, and manage subtasks when allowed.
- **Team Tasks:** view work within the current role's permitted scope.
- **Kanban:** review tasks by status and change status when allowed.
- **Helpdesk:** browse and search internal support tickets, view ticket activity, reply, escalate when permitted, and create a linked follow-up task when eligible.
- **Projects:** browse seeded project information and related tasks. Project authoring is not implemented.
- **Employees and Departments:** browse and manage records where the current demo role and scope permit it.
- **Reports:** view prototype reporting summaries within the selected role's access.
- **Employee Performance Reports:** Superadmin, Admin, and Manager can report on employees within their respective organization, configured-department, or own-department scope; filter by date, employee, department, and current task status, then download individual or team PDFs.
- **Role Permissions:** inspect the role-permission matrix.
- **Notifications:** review notifications for the current demo user, mark them read, and navigate to their related area.
- **Demo role switching:** switch between representative users for six roles without signing in.
- **Rich-text task descriptions:** format descriptions and paste supported HTML tables; see [Rich-text task descriptions](#rich-text-task-descriptions).

The global search in the top bar searches supported navigation destinations and people. It does **not** currently search tasks or tickets.

## Technology

- React 19, React DOM, and React Router 7
- Vite 8 and the React plugin for Vite
- Tailwind CSS 4
- TipTap for rich-text editing, table support, and clipboard HTML
- DOMPurify for sanitizing rich task-description HTML
- jsPDF and jsPDF-AutoTable for paginated employee and team performance report downloads
- `@hello-pangea/dnd`, Recharts, and Lucide icons
- Node.js **20.19+** or **22.12+** (per the Vite runtime requirement)

The app uses JavaScript and JSX; it does not currently use TypeScript.

## Run locally

Run these commands from the `frontend` project directory:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally <http://localhost:5173/>). To create and serve a production build locally:

```powershell
npm run build
npm run preview
```

`npm run preview` serves the already-built `dist/` output; run the build first after making changes.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Create an optimized production build in `dist/`. |
| `npm run preview` | Locally preview the production build. |
| `npm test` | Run the Node.js test suite. |

There is no lint script in `package.json` at this time.

## Application structure

```text
frontend/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── layout/       App shell, navigation, search, role switcher, notifications
    │   └── ui/           Shared UI, toast context, rich-text editor and description display
    ├── data/             Demo roles, users, departments, tasks and tickets
    ├── hooks/            Shared React hooks
    ├── pages/            Overview, tasks, helpdesk, people, projects, reports and settings
    ├── permissions/      Role matrix, task/ticket checks and permission tests
    ├── store/            Shared app context, reducer, and useApp hook
    └── utils/             Navigation, search, dates, rich descriptions, performance metrics and PDF output
```

Useful implementation references:

- [Application entry and provider setup](./src/main.jsx)
- [Routes](./src/App.jsx)
- [Navigation and route availability](./src/utils/navigation.js)
- [Task permissions and role matrix](./src/permissions/taskPermissions.js)
- [Shared state, reducer, and browser persistence](./src/store/AppContext.jsx)
- [App context hook](./src/store/useApp.js)
- [Rich-text editor](./src/components/ui/RichTextEditor.jsx)
- [Task description sanitizing and legacy-text conversion](./src/utils/taskDescription.js)
- [Employee performance report UI](./src/pages/EmployeePerformanceReportsPage.jsx)
- [Report date logic, employee scoping and metric calculations](./src/utils/employeePerformance.js)
- [Paginated PDF generation](./src/utils/employeePerformancePdf.js)
- [Performance report tests](./src/utils/employeePerformance.test.js)
- [PDF pagination tests](./src/utils/employeePerformancePdf.test.js)
- [Task create/edit and detail experience](./src/pages/MyTasksPage.jsx)
- [Settings and demo reset](./src/pages/SettingsPage.jsx)

`main.jsx` mounts the router, application state provider, and toast provider. The route tree renders within the shared app shell. Navigation configuration supplies the sidebar entries and role-based page availability; action-level permissions are checked separately by pages and the shared store.

## Pages and navigation

| Page | Path | Available demo roles |
| --- | --- | --- |
| Overview | `/` | All |
| My Tasks | `/my-tasks` | All |
| Team Tasks* | `/team-tasks` | Superadmin, Admin, Manager, HR |
| Kanban Board | `/kanban` | All |
| Helpdesk | `/helpdesk` | All |
| Projects | `/projects` | Superadmin, Admin, Manager, HR, Executive |
| Employees | `/employees` | Superadmin, Admin, Manager, HR |
| Departments | `/departments` | Superadmin, Admin |
| Reports | `/reports` | Superadmin, Admin, Manager, HR, Support |
| Employee Performance Reports | `/employee-performance-reports` | Superadmin, Admin, Manager |
| Role Permissions | `/role-permissions` | Superadmin, Admin, Manager, HR |
| Settings | `/settings` | All |

The sidebar, breadcrumbs, and route guard use [the navigation configuration](./src/utils/navigation.js). A role may have a route available while seeing only a subset of the data or actions on that page. Unknown paths show a 404 page.

\* The Team Tasks navigation label changes to **Organization Tasks** for Superadmin, **Department Tasks** for Admin, and **People Ops Tasks** for HR; Managers see **Team Tasks**.

## Demo roles and permissions

Use the **Demo role** switcher in the top bar or profile menu to change the active sample user. The available roles are:

| Role | Key | Typical prototype scope |
| --- | --- | --- |
| Superadmin | `superadmin` | Organization-wide task, ticket, people, and department workflows. |
| Admin | `admin` | Administrative workflows restricted to the configured department scope. |
| Manager | `manager` | Team tasks, reporting, and people information within the manager's scope. |
| HR | `hr` | HR tasks and people workflows, with role-specific restrictions. |
| Executive | `executive` | Personal work and eligible task/subtask workflows. |
| Support Staff | `support` | Support tickets and eligible ticket follow-up work. |

The actual route availability is listed in [Pages and navigation](#pages-and-navigation); action-level behavior is defined by the [permission matrix and checks](./src/permissions/taskPermissions.js). Examples of checks include whether a user may create, edit, assign, reassign, change the status of, or delete a task; view or update a ticket; and view or manage employee or department records. Data is filtered by the selected user's scope, not just by which navigation links are shown.

Employee performance reports have a separate permission: Superadmin sees employees organization-wide, Admin is limited to configured department scope, and Manager is limited to their own department. HR, Support Staff, and Executive are not granted this report permission. These boundaries are frontend simulation only.

These are **frontend demo rules, not a security boundary**. A production system must authenticate users and independently authorize every request on a trusted server. Do not use the prototype to protect real or sensitive data.

## State and persistence

The app's shared state is held in React context and managed by a reducer in [AppContext.jsx](./src/store/AppContext.jsx). It includes demo users, departments, tasks, tickets, notifications, and related activity. Initial sample users and departments are defined in [mockUsers.js](./src/data/mockUsers.js) and [mockDepartments.js](./src/data/mockDepartments.js); task and ticket sample records are assembled by the store's initial-state helpers.

After state changes, the app serializes the demo state to the browser `localStorage` key:

```text
taskflow.demo.state.v1
```

The selected demo user is also remembered separately under `taskflow.demo.userId`. This persistence is local to the browser profile and origin. Clearing site data, using another browser/profile, or changing the origin gives a different local state. The app has no API, synchronization, backup, or shared database.

Choose **Reset demo data** from the profile menu (or the Settings page) to return the demo state to its initial sample values. Resetting replaces local demo changes; it does not affect any server because there is none.

## Rich-text task descriptions

Task descriptions use TipTap and are stored in the existing task `description` field as HTML. The editor supports text styles, headings, lists, alignment, links, tables, and undo/redo. Its table controls allow inserting a table and editing rows, columns, and the table. The editor is lazy-loaded so its dependencies are not required on every initial page render.

Clipboard HTML is sanitized with DOMPurify before it is loaded or displayed. When a supported source provides an HTML table, the editor can preserve its cells and basic formatting; pasted content remains editable and is saved with the task state in `localStorage`. If the clipboard only contains plain text, it is handled as text; the app cannot reconstruct reliable table structure that the source did not provide. Existing plain-text task descriptions remain supported and are converted for display without showing raw HTML tags.

Key implementation points:

- [Editor and table toolbar](./src/components/ui/RichTextEditor.jsx)
- [Sanitize, detect, and convert descriptions](./src/utils/taskDescription.js)
- [Safe formatted description display](./src/components/ui/TaskDescription.jsx)
- [Task form and detail integration](./src/pages/MyTasksPage.jsx)
- [Team task description display](./src/pages/TeamTasksPage.jsx)

This supports compatible clipboard HTML; it does not guarantee identical rendering for every Word, Google Docs, or PDF application. Clipboard formats and styles vary by source.

## Employee performance reports

The page supports daily, Monday-to-Sunday weekly, monthly, last-three-complete-month, and custom date ranges. It filters by authorized department, employee name/selection, and current task status. Individual and team PDF downloads include the selected period, scoped summaries, employee comparison metrics, and paginated task breakdowns.

The report does not invent historical activity. Current task records include a creation timestamp and current status, but do not track assignment timestamps, completion timestamps, or status history. Accordingly, the period cohort is labeled as tasks **created** during the range (not proven assignments); cohort completion rate uses current status; historical completion and on-time/late results and pending-at-period-end values are reported as unavailable unless a reliable completion timestamp exists on the task record. Current overdue/open status is a snapshot at report generation time.

## Tests

Run the test suite with:

```powershell
npm test
```

The current suite includes permission logic tests in [taskPermissions.test.js](./src/permissions/taskPermissions.test.js), report period/scope/metric tests in [employeePerformance.test.js](./src/utils/employeePerformance.test.js), and long-report pagination tests in [employeePerformancePdf.test.js](./src/utils/employeePerformancePdf.test.js). For changes to task permissions or descriptions, also verify the relevant user flow in the browser: switch roles, create or edit a task, reload the page, and confirm that the role scope and saved description are preserved.

## Limitations and production considerations

- No real login, identity provider, API, backend, or database is included.
- Role switching is a demonstration feature. Frontend route guards and permission checks do not replace server authorization.
- Data is sample/demo data persisted only in the current browser's local storage.
- Projects are seeded for browsing; create/edit project workflows are not implemented.
- The top-bar **Create** menu currently identifies forms planned for later phases; it does not create a task, ticket, or employee from that menu. Use the applicable page workflow where implemented.
- Global search does not search tasks or tickets.
- Plain-text-only clipboard data cannot reliably preserve source table layout.
- The page title and theme branding are in `index.html`; the Inter font is loaded from Google Fonts, with the site's CSS fallback used if that external font is unavailable.

Before production use, replace the demo state layer with a real persistence/API design, implement server-side authentication and authorization, review privacy and data-retention requirements, and configure deployment routing and security.

## Troubleshooting

### Vite reports an unsupported Node.js version

Check `node --version`. Use Node.js 20.19 or later in the 20.x line, or 22.12 or later in the 22.x line, then reinstall dependencies if your Node version changed.

### A route is missing from the sidebar or shows an access message

Check the selected demo role and the role list in [navigation.js](./src/utils/navigation.js). Route visibility is separate from record-level and action-level permissions in [taskPermissions.js](./src/permissions/taskPermissions.js).

### A task or ticket is not visible or an action is unavailable

Task and ticket lists are filtered by the active demo user's scope, and controls depend on permission checks. Switch to a role that has the appropriate scope or use the sample records to inspect another role's view.

### Local demo changes do not appear after reopening

Confirm that the page is opened at the same origin and in the same browser profile, and that browser storage is enabled. State is local to `localStorage`; it is not synchronized. Check that `taskflow.demo.state.v1` has not been cleared.

### Pasted content appears as text rather than a table

The source may have put only plain text on the clipboard. The editor can preserve a table when the clipboard includes usable HTML table markup, but it cannot infer a reliable grid from arbitrary text.

### The editor or page does not load after a dependency change

From the project directory, run `npm install`, restart `npm run dev`, and inspect the browser console and Vite terminal output for the first reported error.
