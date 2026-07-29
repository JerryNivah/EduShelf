import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout.jsx'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage.jsx'
import { AuthEntryPage } from '../pages/auth/AuthEntryPage.jsx'
import { HomePage } from '../pages/customer/HomePage.jsx'
import { NotFoundPage } from '../pages/NotFoundPage.jsx'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<AuthEntryPage />} />
        <Route path="admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
