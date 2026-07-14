import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { router } from '@/app/router'
import { ApiError } from '@/lib/api/client'
import '@/i18n'
import '@/index.css'

const queryClient = new QueryClient({
  // A 401 on any query means the session expired: drop cache, go to login.
  queryCache: new QueryCache({
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        window.location.pathname !== '/login'
      ) {
        queryClient.clear()
        window.location.assign('/login')
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </NuqsAdapter>
    </QueryClientProvider>
  </StrictMode>,
)
