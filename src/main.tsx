import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { restoredPagesRoute } from './lib/pages-routing'

/**
 * GitHub Pages serves a static 404 document for direct visits to client-side
 * routes. `public/404.html` sends the original path in `?p=`; restore it
 * before BrowserRouter evaluates the URL. Firebase Hosting already rewrites
 * routes to index.html and never needs this branch.
 */
const pagesRedirect = restoredPagesRoute(window.location.search, import.meta.env.BASE_URL)
if (pagesRedirect) window.history.replaceState(null, '', pagesRedirect)

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter basename={import.meta.env.BASE_URL}><App /></BrowserRouter></QueryClientProvider></StrictMode>)
