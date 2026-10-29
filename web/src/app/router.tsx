import { createBrowserRouter } from 'react-router-dom'

import AppLayout from '@/app/app-layout'
import LoginPage from '@/features/auth/login-page'
import RegisterPage from '@/features/auth/register-page'
import VerifyEmailPage from '@/features/auth/verify-email-page'
import CodeLoginPage from '@/features/auth/code-login-page'
import ForgotPasswordPage from '@/features/auth/forgot-password-page'
import DashboardPage from '@/features/dashboard/dashboard-page'
import AnimalsPage from '@/features/animals/animals-page'
import AnimalNewPage from '@/features/animals/animal-new-page'
import AnimalEditPage from '@/features/animals/animal-edit-page'
import AnimalDetailPage from '@/features/animals/animal-detail-page'
import FarmsPage from '@/features/farms/farms-page'
import BreedsPage from '@/features/breeds/breeds-page'
import ImportsPage from '@/features/imports/imports-page'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/login/code', element: <CodeLoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'animals', element: <AnimalsPage /> },
      { path: 'animals/new', element: <AnimalNewPage /> },
      { path: 'animals/:id', element: <AnimalDetailPage /> },
      { path: 'animals/:id/edit', element: <AnimalEditPage /> },
      { path: 'farms', element: <FarmsPage /> },
      { path: 'breeds', element: <BreedsPage /> },
      { path: 'imports', element: <ImportsPage /> },
    ],
  },
])
