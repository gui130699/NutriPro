import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseConfigured } from '../lib/firebase'
import { nutritionService } from '../services/nutrition-service'
type AppUser = FirebaseUser & { id: string }
type Auth = { user: AppUser | null; loading: boolean; configured: boolean }
const Ctx = createContext<Auth>({ user: null, loading: true, configured: false })
export function AuthProvider({ children }: { children: ReactNode }) { const [user, setUser] = useState<AppUser | null>(null), [loading, setLoading] = useState(!!auth); useEffect(() => { if (!auth) return; return onAuthStateChanged(auth, value => { const appUser = value ? Object.assign(value, { id: value.uid }) as AppUser : null; setUser(appUser); setLoading(false); if (appUser) void nutritionService.initializeUser(appUser.uid).catch(() => undefined) }) }, []); return <Ctx.Provider value={{ user, loading, configured: firebaseConfigured }}>{children}</Ctx.Provider> }
// oxlint-disable-next-line react/only-export-components -- the hook is the public API for this provider.
export const useAuth = () => useContext(Ctx)
