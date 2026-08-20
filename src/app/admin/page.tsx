'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { Entidade, CategoriaMapa } from '@/types'

type Aba = 'demandas' | 'entidades' | 'categorias' | 'ia'

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [carregandoAuth, setCarregandoAuth] = useState(true)
  const [aba, setAba] = useState<Aba>('demandas')

  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])

  const [novaEntNome, setNovaEntNome] = useState('')
  const [novaEntCargo, setNovaEntCargo] = useState('')
  const [novaEntEmail, setNovaEntEmail] = useState('')
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatCor, setNovaCatCor] = useState('#ef4444')
  const [notificacao, setNotificacao] = useState('')

  // Edição inline de entidade
  const [editandoEnt, setEditandoEnt] = useState<string | null>(null)
  const [editEntNome, setEditEntNome] = useState('')
  const [editEntCargo, setEditEntCargo] = useState('')
  const [editEntEmail, setEditEntEmail] = useState('')

  const client = createClient()
  const EMAIL_MASTER = 'portalfrutalense@gmail.com'

  function verificarAcesso(session: any) {
    if (session && session.user?.email === EMAIL_MASTER) {
      setAutenticado(true)
      carregarDados()
    } else if (session) {
      client.auth.signOut()
      setErroLogin('Acesso negado. Somente o administrador pode entrar aqui.')
      setAutenticado(false)
    } else {
      setAutenticado(false)
    }
  }

  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      verificarAcesso(data.session)
      setCarregandoAuth(false)
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      verificarAcesso(session)
      setCarregandoAuth(false)
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErroLogin('')
    const { error } = await client.auth.signInWithPassword({ email, password: senha })
    if (error) setErroLogin('E-mail ou senha incorretos.')
  }

  async function handleLogout() {
    await client.auth.signOut()
    setAutenticado(false)
  }

  function carregarDados() {
    supabase.from('entidades').select('*').order('nome').then(({ data }) => setEntidades((data as Entidade[]) || []))
    supabase.from('categorias_mapa').select('*').order('nome').then(({ data }) => setCategorias((data as CategoriaMapa[]) || []))
  }

  async function salvarEntidade(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('entidades').insert({ nome: novaEntNome, cargo: novaEntCargo, email: novaEntEmail, ativo: true })
    setNovaEntNome(''); setNovaEntCargo(''); setNovaEntEmail('')
    carregarDados()
  }

  async function excluirEntidade(id: string) {
    if (!confirm('Excluir esta autoridade?')) return
    await supabase.from('entidades').delete().eq('id', id)
    carregarDados()
  }

  async function salvarEdicaoEntidade(id: string) {
    await supabase.from('entidades').update({ nome: editEntNome, cargo: editEntCargo, email: editEntEmail }).eq('id', id)
    setEditandoEnt(null)
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

  const abas: { key: Aba; label: string }[] = [
    { key: 'demandas',   label: 'Demandas' },
    { key: 'entidades',  label: 'Autoridades' },
    { key: 'categorias', label: 'Categorias' },
    { key: 'ia',         label: '🤖 IA' },
  ]

  const btnAcao = (label: string, onClick: () => void, variante: 'primario' | 'perigo' | 'neutro' | 'aviso') => {
    const estilos: Record<string, React.CSSProperties> = {
      primario: { backgroundColor: '#1e3a5f', color: 'white', border: 'none' },
      perigo:   { backgroundColor: 'white', color: '#dc2626', border: '1px solid #fecaca' },
      neutro:   { backgroundColor: 'white', color: '#6b7280', border: '1px solid #e5e7eb' },
      aviso:    { backgroundColor: 'white', color: '#92400e', border: '1px solid #fde68a' },
    }
    return (
      <button onClick={onClick} style={{ ...estilos[variante], fontSize: '12px', borderRadius: '5px', padding: '5px 12px', fontWeight: 500, cursor: 'pointer' }}>
        {label}
      </button>
    )
  }

  if (carregandoAuth) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px' }}>Verificando sessão...</div>
  }

  if (!autenticado) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '32px', width: '100%', maxWidth: '360px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Painel Master</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>Acesso restrito ao administrador.</p>

          {/* Google */}
          <button onClick={async () => {
            await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` } })
          }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '10px', border: '1.5px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Entrar com Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>ou com e-mail</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          </div>

          {erroLogin && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{erroLogin}</p>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#4b5563', marginBottom: '4px' }}>E-mail</label>
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

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Painel Master</h1>
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Moderação e configuração do Portal Frutalense.</p>
        </div>
        <button onClick={handleLogout} style={{ fontSize: '13px', color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
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

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '24px', overflowX: 'auto' }}>
        {abas.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 500, border: 'none', borderBottom: aba === a.key ? '2px solid #1e3a5f' : '2px solid transparent', background: 'none', cursor: 'pointer', color: aba === a.key ? '#1e3a5f' : '#6b7280', marginBottom: '-1px', whiteSpace: 'nowrap' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* === DEMANDAS === */}
      {aba === 'demandas' && <AdminDemandas />}

      {/* === AUTORIDADES === */}
      {aba === 'entidades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Autoridade</h2>
            <form onSubmit={salvarEntidade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <input value={novaEntNome} onChange={(e) => setNovaEntNome(e.target.value)} placeholder="Nome" required style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                <input value={novaEntCargo} onChange={(e) => setNovaEntCargo(e.target.value)} placeholder="Cargo / Órgão" required style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
                <input type="email" value={novaEntEmail} onChange={(e) => setNovaEntEmail(e.target.value)} placeholder="E-mail" required style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
              </div>
              <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '8px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
            </form>
          </div>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {entidades.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma autoridade cadastrada.</p>}
            {entidades.map((e, i) => (
              <div key={e.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                {editandoEnt === e.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      <input value={editEntNome} onChange={(ev) => setEditEntNome(ev.target.value)} placeholder="Nome" style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                      <input value={editEntCargo} onChange={(ev) => setEditEntCargo(ev.target.value)} placeholder="Cargo / Órgão" style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                      <input type="email" value={editEntEmail} onChange={(ev) => setEditEntEmail(ev.target.value)} placeholder="E-mail" style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {btnAcao('Salvar', () => salvarEdicaoEntidade(e.id), 'primario')}
                      {btnAcao('Cancelar', () => setEditandoEnt(null), 'neutro')}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: 0 }}>{e.nome}</p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{e.cargo} · {e.email}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {btnAcao('Editar', () => { setEditandoEnt(e.id); setEditEntNome(e.nome); setEditEntCargo(e.cargo); setEditEntEmail(e.email) }, 'neutro')}
                      {btnAcao('Excluir', () => excluirEntidade(e.id), 'perigo')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === CATEGORIAS === */}
      {aba === 'categorias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Categoria</h2>
            <form onSubmit={salvarCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco na via)" required style={{ flex: 1, minWidth: '200px', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
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

      {/* === IA === */}
      {aba === 'ia' && <AdminIA />}
    </div>
  )
}

// ---- Sub-componente: Demandas ----
function AdminDemandas() {
  const sbClient = createClient()
  const [demandas, setDemandas] = useState<any[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [notif, setNotif] = useState('')

  useEffect(() => {
    sbClient.from('demandas').select('*, categoria:categorias_mapa(*), entidade:entidades(*)').order('created_at', { ascending: false }).then(({ data }: any) => setDemandas(data || []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reenviarLink(id: string) {
    const { data: { session } } = await sbClient.auth.getSession()
    const res = await fetch('/api/admin/reenviar-link-demanda', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ demanda_id: id }) })
    const d = await res.json()
    setNotif(d.ok ? 'Link reenviado.' : `Erro: ${d.error}`)
    setTimeout(() => setNotif(''), 5000)
  }

  const statusLabel: Record<string, string> = {
    pendente: 'Pendente',
    aguardando_resposta: 'Aguardando resposta',
    respondida: 'Respondida',
    rejeitada_ia: 'Rejeitada pela IA',
    resolvida: 'Resolvida',
  }

  const filtradas = filtro === 'todos' ? demandas : demandas.filter(d => d.status === filtro)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {notif && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>{notif}</div>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['todos', 'pendente', 'aguardando_resposta', 'respondida', 'rejeitada_ia'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: filtro === f ? '#1e3a5f' : 'white', color: filtro === f ? 'white' : '#374151', cursor: 'pointer', fontWeight: filtro === f ? 600 : 400 }}>
            {f === 'todos' ? 'Todas' : statusLabel[f]}
          </button>
        ))}
      </div>

      {filtradas.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma demanda encontrada.</p>}

      {filtradas.map((d: any) => (
        <div key={d.id} style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, background: d.status === 'rejeitada_ia' ? '#fef2f2' : d.status === 'respondida' ? '#f0fdf4' : '#eff6ff', color: d.status === 'rejeitada_ia' ? '#dc2626' : d.status === 'respondida' ? '#166534' : '#2563eb', borderRadius: '4px', padding: '2px 8px' }}>
                  {statusLabel[d.status] || d.status}
                </span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{d.categoria?.nome}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>{d.descricao}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Por: <strong>{d.morador_nome}</strong> · Para: <strong>{d.entidade?.nome} ({d.entidade?.cargo})</strong></p>
              {d.endereco_label && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>📍 {d.endereco_label}</p>}
              {d.ia_motivo && <p style={{ fontSize: '12px', color: d.status === 'rejeitada_ia' ? '#dc2626' : '#6b7280', margin: '6px 0 0', background: '#f9fafb', borderRadius: '4px', padding: '6px 10px' }}>🤖 IA: {d.ia_motivo}</p>}
              {d.resposta && <p style={{ fontSize: '12px', color: '#166534', margin: '6px 0 0', background: '#f0fdf4', borderRadius: '4px', padding: '6px 10px' }}>✓ Resposta: {d.resposta}</p>}
            </div>
            {d.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.foto_url} alt="Foto" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, cursor: 'zoom-in' }} onClick={() => window.open(d.foto_url, '_blank')} />
            )}
          </div>
          {d.status === 'aguardando_resposta' && d.link_enviado && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#166534' }}>✓ Link enviado</span>
              <button onClick={() => reenviarLink(d.id)} style={{ fontSize: '12px', color: '#1e40af', background: 'none', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '3px 10px', cursor: 'pointer' }}>Reenviar link</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const CONFIG_PADRAO = {
  ativo: true,
  rigor: 'moderado',
  prompt: 'Analise a demanda do cidadão e decida se deve ser aprovada ou rejeitada. Rejeite se: for ofensiva, difamatória, sem relação com problemas reais do município de Frutal-MG, spam, ou conteúdo político partidário. Aprove se for uma demanda legítima de um cidadão sobre infraestrutura, saúde, educação, segurança ou outro serviço público.',
}

// ---- Sub-componente: Configuração da IA ----
function AdminIA() {
  const sbClient = createClient()
  const [config, setConfig] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [notif, setNotif] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    sbClient.from('ia_config').select('*').eq('id', 1).maybeSingle().then(({ data, error }: any) => {
      if (error) { setErro('Erro ao carregar configurações da IA.'); return }
      setConfig(data || CONFIG_PADRAO)
    })
    sbClient.from('ia_historico').select('*, demanda:demandas(descricao, morador_nome)').order('created_at', { ascending: false }).limit(20).then(({ data }: any) => setHistorico(data || []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function salvar() {
    if (!config) return
    setSalvando(true)
    const { error } = await sbClient.from('ia_config').upsert({ id: 1, ativo: config.ativo, prompt: config.prompt, rigor: config.rigor, updated_at: new Date().toISOString() })
    setNotif(error ? `Erro ao salvar: ${error.message}` : 'Configurações salvas!')
    setTimeout(() => setNotif(''), 4000)
    setSalvando(false)
  }

  if (erro) return <p style={{ color: '#dc2626', fontSize: '13px', padding: '20px' }}>{erro}</p>
  if (!config) return <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Carregando...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {notif && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>{notif}</div>}

      {/* Configurações */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h2 style={{ fontWeight: 700, color: '#111827', fontSize: '15px', marginBottom: '20px' }}>Configurações da IA</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Toggle ativo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Análise automática ativa</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Quando desativada, demandas ficam pendentes para aprovação manual</p>
            </div>
            <button onClick={() => setConfig({ ...config, ativo: !config.ativo })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: config.ativo ? '#1e3a5f' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '2px', left: config.ativo ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block' }} />
            </button>
          </div>

          {/* Rigor */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Nível de rigor</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['permissivo', 'moderado', 'rigoroso'].map(r => (
                <button key={r} onClick={() => setConfig({ ...config, rigor: r })}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1.5px solid', borderColor: config.rigor === r ? '#1e3a5f' : '#e5e7eb', background: config.rigor === r ? '#eff6ff' : 'white', color: config.rigor === r ? '#1e3a5f' : '#374151', fontSize: '13px', fontWeight: config.rigor === r ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {r}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '6px 0 0' }}>
              {config.rigor === 'permissivo' && 'Rejeita apenas conteúdo claramente ofensivo ou spam.'}
              {config.rigor === 'moderado' && 'Rejeita conteúdo ofensivo, político-partidário ou sem relação com serviços públicos.'}
              {config.rigor === 'rigoroso' && 'Rejeita demandas vagas, sem endereço ou que não sejam solicitações legítimas.'}
            </p>
          </div>

          {/* Prompt */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Prompt de análise</label>
            <textarea value={config.prompt} onChange={(e) => setConfig({ ...config, prompt: e.target.value })} rows={6}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>

          <button onClick={salvar} disabled={salvando} style={{ backgroundColor: salvando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h2 style={{ fontWeight: 700, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Histórico de análises (últimas 20)</h2>
        {historico.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>Nenhuma análise ainda.</p>}
        {historico.map((h: any) => (
          <div key={h.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: h.decisao === 'aprovada' ? '#166534' : '#dc2626', background: h.decisao === 'aprovada' ? '#f0fdf4' : '#fef2f2', borderRadius: '4px', padding: '2px 8px', flexShrink: 0 }}>
              {h.decisao === 'aprovada' ? '✓ Aprovada' : '✗ Rejeitada'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', color: '#111827', margin: '0 0 2px', fontWeight: 500 }}>{h.demanda?.descricao?.slice(0, 80)}...</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{h.motivo}</p>
            </div>
            <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
