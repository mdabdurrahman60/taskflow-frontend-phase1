import { Route, Routes } from 'react-router-dom'
import RequireAuth from './components/layout/RequireAuth'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import MyTasksPage from './pages/MyTasksPage'
import TeamTasksPage from './pages/TeamTasksPage'
import ProjectsPage from './pages/ProjectsPage'
import KanbanPage from './pages/KanbanPage'
import HelpdeskPage from './pages/HelpdeskPage'
import EmployeesPage from './pages/EmployeesPage'
import DepartmentsPage from './pages/DepartmentsPage'
import ReportsPage from './pages/ReportsPage'
import EmployeePerformanceReportsPage from './pages/EmployeePerformanceReportsPage'
import SettingsPage from './pages/SettingsPage'
import RolePermissionsPage from './pages/RolePermissionsPage'
import NotFoundPage from './pages/NotFoundPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProfilePage from './pages/ProfilePage'
import WarehousePage from './pages/WarehousePage'

// App.jsx only wires routes together. Each page guards itself with <RoleGuard>.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<OverviewPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="team-tasks" element={<TeamTasksPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="helpdesk" element={<HelpdeskPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="employee-performance-reports" element={<EmployeePerformanceReportsPage />} />
        <Route path="role-permissions" element={<RolePermissionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
