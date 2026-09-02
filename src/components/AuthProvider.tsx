'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'
// BUG CORRIGIDO (B03-5): tipo `Perfil` centralizado em `@/types` — era
// redefinido à mão aqui e de novo (como `PerfilLinha`) em master/page.tsx.
import type { Perfil } from '@/types'

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

  // getSession() e o evento inicial de onAuthStateChange normalmente disparam
  // quase juntos para a MESMA sessão no primeiro carregamento — sem essa
  // guarda, toda página loga faz duas consultas idênticas a "perfis" em vez
  // de uma. Só evita a repetição para o mesmo userId; login/logout de verdade
  // (userId diferente) continua recarregando normalmente.
  const ultimoUserIdCarregado = useRef<string | null>(null)

  // BUG CORRIGIDO (B05-11): sem try/catch, uma falha que lançasse exceção
  // de verdade (não só `{error}` no retorno — ex: um blip de rede) deixava
  // `setCarregando(false)` sem rodar, e `carregando` ficava `true` pra
  // sempre. Com isso, `precisaCPF`/`bloqueado` (que dependem de `!carregando`
  // pra valer) ficavam presos em `false` — modal de CPF nunca aparecia,
  // bloqueio nunca era aplicado, mesmo pra uma conta que devesse ser barrada.
  async function carregarPerfil(userId: string) {
    if (ultimoUserIdCarregado.current === userId) return
    ultimoUserIdCarregado.current = userId
    try {
      const { data } = await supabase.from('perfis').select('*').eq('id', userId).single()
      setPerfil(data || null)
    } catch (e) {
      console.error('[AuthProvider] falha ao carregar perfil:', e)
      setPerfil(null)
    } finally {
      setCarregando(false)
    }
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
      else { ultimoUserIdCarregado.current = null; setPerfil(null); setCarregando(false) }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sair() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('[AuthProvider] falha ao encerrar sessão no servidor:', error.message)
    ultimoUserIdCarregado.current = null
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
