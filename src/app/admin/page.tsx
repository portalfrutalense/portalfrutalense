'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { Denuncia, Ocorrencia, Entidade, CategoriaMapa } from '@/types'

type Aba = 'denuncias' | 'ocorrencias' | 'entidades' | 'categorias'

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [carregandoAuth, setCarregandoAuth] = useState(true)
  const [aba, setAba] = useState<Aba>('denuncias')

  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])

  const [novaEntNome, setNovaEntNome] = useState('')
  const [novaEntCargo, setNovaEntCargo] = useState('')
  const [novaEntEmail, setNovaEntEmail] = useState('')
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatCor, setNovaCatCor] = useState('#ef4444')
  const [notificacao, setNotificacao] = useState('')

  const client = createClient()

  // Verifica sessão existente ao carregar
  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAutenticado(true)
        carregarDados()
      }
      setCarregandoAuth(false)
    })

    // Escuta mudanças de auth
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAutenticado(true)
        carregarDados()
      } else {
        setAutenticado(false)
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErroLogin('')
    const { error } = await client.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErroLogin('Email ou senha incorretos.')
    }
  }

  async function handleLogout() {
    await client.auth.signOut()
    setAutenticado(false)
  }

  function carregarDados() {
    supabase.from('denuncias').select('*, entidade:entidades(*)').eq('status', 'pendente').order('created_at').then(({ data }) => setDenuncias(data as Denuncia[] || []))
    supabase.from('ocorrencias').select('*, categoria:categorias_mapa(*)').eq('status', 'pendente').order('created_at').then(({ data }) => setOcorrencias(data as Ocorrencia[] || []))
    supabase.from('entidades').select('*').order('nome').then(({ data }) => setEntidades(data as Entidade[] || []))
    supabase.from('categorias_mapa').select('*').order('nome').then(({ data }) => setCategorias(data as CategoriaMapa[] || []))
  }

  async function aprovar(id: string, tipo: 'denuncia' | 'ocorrencia') {
    const session = await client.auth.getSession()
    const res = await fetch('/api/admin/aprovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.data.session?.access_token}` },
      body: JSON.stringify({ id, tipo }),
    })
    const data = await res.json()
    if (tipo === 'denuncia') {
      if (data.magicLink) {
        setNotificacao('Denúncia aprovada e e-mail enviado à autoridade.')
      } else {
        setNotificacao('Denúncia aprovada. Nenhum e-mail enviado (entidade sem e-mail cadastrado).')
      }
      setTimeout(() => setNotificacao(''), 5000)
    }
    carregarDados()
  }

  async function rejeitar(id: string, tipo: 'denuncia' | 'ocorrencia') {
    const session = await client.auth.getSession()
    await fetch('/api/admin/rejeitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.data.session?.access_token}` },
      body: JSON.stringify({ id, tipo }),
    })
    carregarDados()
  }

  async function salvarEntidade(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('entidades').insert({ nome: novaEntNome, cargo: novaEntCargo, email: novaEntEmail, ativo: true })
    setNovaEntNome(''); setNovaEntCargo(''); setNovaEntEmail('')
    carregarDados()
  }

  async function excluirEntidade(id: string) {
    if (!confirm('Excluir esta entidade?')) return
    await supabase.from('entidades').delete().eq('id', id)
    carregarDados()
  }

  async function salvarCategoria(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('categorias_mapa').insert({ nome: novaCatNome, cor: novaCatCor, ativo: true })
    setNovaCatNome(''); setNovaCatCor('#ef4444')
    carregarDados()
  }

  async function excluirCategoria(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    await supabase.from('categorias_mapa').delete().eq('id', id)
    carregarDados()
  }

  if (carregandoAuth) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px' }}>
        Verificando sessao...
      </div>
    )
  }

  if (!autenticado) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '32px', width: '100%', maxWidth: '360px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Painel Master</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>Acesso restrito ao administrador.</p>
          {erroLogin && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{erroLogin}</p>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px', marginTop: '4px' }}>
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  const abas: { key: Aba; label: string; count?: number }[] = [
    { key: 'denuncias', label: 'Denuncias', count: denuncias.length },
    { key: 'ocorrencias', label: 'Ocorrencias', count: ocorrencias.length },
    { key: 'entidades', label: 'Entidades' },
    { key: 'categorias', label: 'Categorias' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Painel Master</h1>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Moderacao e configuracao do Portal Frutalense.</p>
        </div>
        <button onClick={handleLogout} style={{ fontSize: '13px', color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
          Sair
        </button>
      </div>

      {/* Notificação */}
      {notificacao && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {notificacao}
          <button onClick={() => setNotificacao('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
        {abas.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 500, border: 'none', borderBottom: aba === a.key ? '2px solid #1e3a5f' : '2px solid transparent', background: 'none', cursor: 'pointer', color: aba === a.key ? '#1e3a5f' : '#6b7280', marginBottom: '-1px' }}>
            {a.label}
            {a.count !== undefined && (
              <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 6px', borderRadius: '999px', background: a.count > 0 ? '#fee2e2' : '#f3f4f6', color: a.count > 0 ? '#dc2626' : '#6b7280' }}>
                {a.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Denuncias */}
      {aba === 'denuncias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {denuncias.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '64px 0', fontSize: '14px' }}>Nenhuma denuncia pendente.</p>
          ) : denuncias.map((d) => (
            <div key={d.id} style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#111827', fontSize: '14px', margin: 0 }}>{d.morador_nome}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace', margin: '2px 0' }}>{d.morador_cpf_display}</p>
                  {d.entidade && <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>Para: {d.entidade.nome} — {d.entidade.cargo}</p>}
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>{d.mensagem}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => aprovar(d.id, 'denuncia')} style={{ fontSize: '13px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontWeight: 600, cursor: 'pointer' }}>
                  Aprovar e Enviar Link
                </button>
                <button onClick={() => rejeitar(d.id, 'denuncia')} style={{ fontSize: '13px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 16px', fontWeight: 500, cursor: 'pointer' }}>
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ocorrencias */}
      {aba === 'ocorrencias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ocorrencias.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '64px 0', fontSize: '14px' }}>Nenhuma ocorrencia pendente.</p>
          ) : ocorrencias.map((o) => (
            <div key={o.id} style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#111827', fontSize: '14px', margin: 0 }}>{o.morador_nome}</p>
                  {o.categoria && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '4px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: o.categoria.cor, display: 'inline-block' }} />
                      {o.categoria.nome}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>{o.descricao}</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace', marginBottom: '16px' }}>{o.lat.toFixed(5)}, {o.lng.toFixed(5)}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => aprovar(o.id, 'ocorrencia')} style={{ fontSize: '13px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontWeight: 600, cursor: 'pointer' }}>
                  Publicar no Mapa
                </button>
                <button onClick={() => rejeitar(o.id, 'ocorrencia')} style={{ fontSize: '13px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 16px', fontWeight: 500, cursor: 'pointer' }}>
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entidades */}
      {aba === 'entidades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Entidade</h2>
            <form onSubmit={salvarEntidade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <input value={novaEntNome} onChange={(e) => setNovaEntNome(e.target.value)} placeholder="Nome" required style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                <input value={novaEntCargo} onChange={(e) => setNovaEntCargo(e.target.value)} placeholder="Cargo / Orgao" required style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                <input type="email" value={novaEntEmail} onChange={(e) => setNovaEntEmail(e.target.value)} placeholder="E-mail" required style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
              </div>
              <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '8px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
            </form>
          </div>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {entidades.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma entidade cadastrada.</p>}
            {entidades.map((e, i) => (
              <div key={e.id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                <div>
                  <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: 0 }}>{e.nome}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{e.cargo} · {e.email}</p>
                </div>
                <button onClick={() => excluirEntidade(e.id)} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Excluir</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorias */}
      {aba === 'categorias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Categoria</h2>
            <form onSubmit={salvarCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco na Via)" required style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cor do pin</label>
                  <input type="color" value={novaCatCor} onChange={(e) => setNovaCatCor(e.target.value)} style={{ width: '44px', height: '38px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #d1d5db', padding: '2px' }} />
                </div>
              </div>
              <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '8px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
            </form>
          </div>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {categorias.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma categoria cadastrada.</p>}
            {categorias.map((c, i) => (
              <div key={c.id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c.cor, display: 'inline-block', border: '1px solid #e5e7eb' }} />
                  <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: 0 }}>{c.nome}</p>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{c.cor}</span>
                </div>
                <button onClick={() => excluirCategoria(c.id)} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Excluir</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
