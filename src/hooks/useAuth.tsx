import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
type Auth = { user: User | null; loading: boolean; configured: boolean }
const Ctx = createContext<Auth>({ user: null, loading: true, configured: false })
export function AuthProvider({ children }: { children: ReactNode }) { const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(!!supabase); useEffect(() => { if (!supabase) return; supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setLoading(false) }); const { data } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null)); return () => data.subscription.unsubscribe() }, []); return <Ctx.Provider value={{ user, loading, configured: !!supabase }}>{children}</Ctx.Provider> }
export const useAuth = () => useContext(Ctx)
