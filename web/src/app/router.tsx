import { createBrowserRouter } from 'react-router-dom'

import AppLayout from '@/app/app-layout'
import LoginPage from '@/features/auth/login-page'
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
