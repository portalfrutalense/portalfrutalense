'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

interface Perfil {
  id: string
  nome: string
  cpf: string
  email?: string
  role?: string
  bloqueado?: boolean
  whatsapp?: string
  data_nascimento?: string
}

interface AuthContextType {
  user: User | null
  perfil: Perfil | null
  carregando: boolean
  precisaCPF: boolean
  bloqueado: boolean
  setPerfil: (p: Perfil) => void
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: null,
  carregando: true,
  precisaCPF: false,
  bloqueado: false,
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
    setCarregando(false)
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

  async function sair() {
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
  }

  // CPF só é exigido de cidadãos (ou de contas novas, ainda sem perfil/role definido).
  // Autoridades e empresas nunca precisam de CPF.
  const ehCidadaoOuNovo = !perfil || !perfil.role || perfil.role === 'cidadao'
  const precisaCPF = !!user && !carregando && ehCidadaoOuNovo && (!perfil || !perfil.nome?.trim() || !perfil.cpf?.trim())
  const bloqueado = !!user && !carregando && !!perfil?.bloqueado

  return (
    <AuthContext.Provider value={{ user, perfil, carregando, precisaCPF, bloqueado, setPerfil, sair }}>
      {children}
    </AuthContext.Provider>
  )
}
