import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { queryClient } from '../../services/queryClient.js'
import { useThemeStore } from '../../store/useThemeStore.js'

function ThemeSync() {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return null
}

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeSync />
        {children}
        <ToastContainer
          newestOnTop
          position="top-right"
          theme="colored"
          closeButton={false}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
