'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

interface Perfil {
  id: string
  nome: string
  cpf: string
}

interface AuthContextType {
  user: User | null
  perfil: Perfil | null
  carregando: boolean
  precisaCPF: boolean
  setPerfil: (p: Perfil) => void
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: null,
  carregando: true,
  precisaCPF: false,
  setPerfil: () => {},
  sair: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregarPerfil(userId: string) {
    const { data } = await supabase.from('perfis').select('*').eq('id', userId).single()
    setPerfil(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) carregarPerfil(session.user.id)
      else setCarregando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) carregarPerfil(session.user.id)
      else { setPerfil(null); setCarregando(false) }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user !== null) setCarregando(false)
  }, [user, perfil])

  async function sair() {
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
  }

  const precisaCPF = !!user && !perfil && !carregando

  return (
    <AuthContext.Provider value={{ user, perfil, carregando, precisaCPF, setPerfil, sair }}>
      {children}
    </AuthContext.Provider>
  )
}
