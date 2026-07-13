import { createBrowserRouter } from 'react-router-dom'

import HomePage from '@/features/home/home-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
])
