import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    if (window.confirm('Uma nova versão está disponível. Atualizar agora?')) {
      void updateServiceWorker(true)
    }
  },
})
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter basename={import.meta.env.BASE_URL}><App /></BrowserRouter></QueryClientProvider></StrictMode>)
