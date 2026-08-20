'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { Entidade, CategoriaMapa } from '@/types'

type SecaoMaster = 'dashboard' | 'demandas'
type AbaConfig = 'autoridades' | 'categorias' | 'ia'

export default function MasterPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [carregandoAuth, setCarregandoAuth] = useState(true)
  const [secao, setSecao] = useState<SecaoMaster>('dashboard')
  const [configurando, setConfigurando] = useState(false)
  const [abaConfig, setAbaConfig] = useState<AbaConfig>('autoridades')
  const [menuAberto, setMenuAberto] = useState(false)

  // Dados config
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [novaEntNome, setNovaEntNome] = useState('')
  const [novaEntCargo, setNovaEntCargo] = useState('')
  const [novaEntEmail, setNovaEntEmail] = useState('')
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatCor, setNovaCatCor] = useState('#ef4444')
  const [editandoEnt, setEditandoEnt] = useState<string | null>(null)
  const [editEntNome, setEditEntNome] = useState('')
  const [editEntCargo, setEditEntCargo] = useState('')
  const [editEntEmail, setEditEntEmail] = useState('')

  // Stats dashboard
  const [stats, setStats] = useState({ total: 0, pendente: 0, aguardando: 0, respondida: 0 })

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

  function carregarDados() {
    supabase.from('entidades').select('*').order('nome').then(({ data }) => setEntidades((data as Entidade[]) || []))
    supabase.from('categorias_mapa').select('*').order('nome').then(({ data }) => setCategorias((data as CategoriaMapa[]) || []))
    supabase.from('demandas').select('status').then(({ data }) => {
      const d = data || []
      setStats({
        total: d.length,
        pendente: d.filter((x: any) => x.status === 'pendente').length,
        aguardando: d.filter((x: any) => x.status === 'aguardando_resposta').length,
        respondida: d.filter((x: any) => x.status === 'respondida').length,
      })
    })
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

  const btnAcao = (label: string, onClick: () => void, variante: 'primario' | 'perigo' | 'neutro') => {
    const cores: Record<string, React.CSSProperties> = {
      primario: { background: '#1e3a5f', color: 'white', border: 'none' },
      perigo:   { background: 'white', color: '#dc2626', border: '1px solid #fecaca' },
      neutro:   { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' },
    }
    return <button onClick={onClick} style={{ ...cores[variante], fontSize: '12px', borderRadius: '5px', padding: '5px 12px', fontWeight: 500, cursor: 'pointer' }}>{label}</button>
  }

  // ── TELA DE LOGIN ──────────────────────────────────────────
  if (carregandoAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px', background: '#f8fafc' }}>Verificando sessão...</div>
  }

  if (!autenticado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '36px 32px', width: '100%', maxWidth: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Painel Master</h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Acesso restrito ao administrador.</p>
          </div>

          <button onClick={async () => {
            await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=/master` } })
          }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" required
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
            <button type="submit" style={{ backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── PAINEL ────────────────────────────────────────────────
  const navItems: { key: SecaoMaster; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'demandas',  label: 'Mapa de Demandas' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        background: '#1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        zIndex: 100,
      }} className={`master-sidebar${menuAberto ? ' open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>Painel Master</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Portal Frutalense</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { setSecao(item.key); setConfigurando(false); setMenuAberto(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                background: secao === item.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: secao === item.key ? 'white' : 'rgba(255,255,255,0.55)',
                marginBottom: '2px', textAlign: 'left',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sair */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => client.auth.signOut()} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: 500 }}>
            Sair
          </button>
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main style={{ marginLeft: '220px', flex: 1, minWidth: 0 }} className="master-main">

        {/* Topbar mobile */}
        <div className="master-topbar" style={{ display: 'none', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#1e3a5f', position: 'sticky', top: 0, zIndex: 50 }}>
          <button onClick={() => setMenuAberto(!menuAberto)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px 8px', fontSize: '13px', fontWeight: 600 }}>
            Menu
          </button>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Painel Master</span>
        </div>

        {/* Overlay mobile menu */}
        {menuAberto && (
          <div onClick={() => setMenuAberto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
        )}

        <div style={{ padding: 'clamp(20px, 3vw, 32px)' }}>

          {/* ── DASHBOARD ── */}
          {secao === 'dashboard' && (
            <div>
              <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Dashboard</h1>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Visão geral do Portal Frutalense.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {[
                  { label: 'Total de demandas', valor: stats.total, cor: '#1e3a5f', fundo: '#eff6ff' },
                  { label: 'Pendentes (IA)', valor: stats.pendente, cor: '#92400e', fundo: '#fef3c7' },
                  { label: 'Aguardando resposta', valor: stats.aguardando, cor: '#1e40af', fundo: '#dbeafe' },
                  { label: 'Respondidas', valor: stats.respondida, cor: '#166534', fundo: '#dcfce7' },
                ].map((s) => (
                  <div key={s.label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{s.label}</p>
                    <p style={{ fontSize: '32px', fontWeight: 800, color: s.cor, margin: 0, lineHeight: 1 }}>{s.valor}</p>
                  </div>
                ))}
              </div>

              <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '24px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 12px' }}>Acesso rápido</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button onClick={() => { setSecao('demandas'); setConfigurando(false) }}
                    style={{ fontSize: '13px', fontWeight: 600, color: '#1e3a5f', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
                    Ver demandas
                  </button>
                  <button onClick={() => { setSecao('demandas'); setConfigurando(true); setAbaConfig('autoridades') }}
                    style={{ fontSize: '13px', fontWeight: 600, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
                    Configurar autoridades
                  </button>
                  <button onClick={() => { setSecao('demandas'); setConfigurando(true); setAbaConfig('ia') }}
                    style={{ fontSize: '13px', fontWeight: 600, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
                    Configurar IA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── MAPA DE DEMANDAS ── */}
          {secao === 'demandas' && (
            <div>
              {/* Header da seção */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                    {configurando ? 'Configurações' : 'Mapa de Demandas'}
                  </h1>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                    {configurando ? 'Gerencie autoridades, categorias e a inteligência artificial.' : 'Gerencie as demandas enviadas pelos cidadãos.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {configurando ? (
                    <button onClick={() => setConfigurando(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
                      Voltar as demandas
                    </button>
                  ) : (
                    <button onClick={() => { setConfigurando(true); setAbaConfig('autoridades') }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
                      Configurar
                    </button>
                  )}
                </div>
              </div>

              {/* DEMANDAS */}
              {!configurando && <MasterDemandas />}

              {/* CONFIGURAÇÕES */}
              {configurando && (
                <div>
                  {/* Sub-abas */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '6px' }}>
                    {(['autoridades', 'categorias', 'ia'] as AbaConfig[]).map((a) => {
                      const labels: Record<AbaConfig, string> = { autoridades: 'Autoridades', categorias: 'Categorias', ia: 'IA' }
                      return (
                        <button key={a} onClick={() => setAbaConfig(a)} style={{
                          flex: 1, padding: '8px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                          background: abaConfig === a ? '#1e3a5f' : 'transparent',
                          color: abaConfig === a ? 'white' : '#6b7280',
                        }}>
                          {labels[a]}
                        </button>
                      )
                    })}
                  </div>

                  {abaConfig === 'autoridades' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Autoridade</h2>
                        <form onSubmit={salvarEntidade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                            <input value={novaEntNome} onChange={(e) => setNovaEntNome(e.target.value)} placeholder="Nome" required style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', outline: 'none' }} />
                            <input value={novaEntCargo} onChange={(e) => setNovaEntCargo(e.target.value)} placeholder="Cargo / Órgão" required style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', outline: 'none' }} />
                            <input type="email" value={novaEntEmail} onChange={(e) => setNovaEntEmail(e.target.value)} placeholder="E-mail" required style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', outline: 'none' }} />
                          </div>
                          <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
                        </form>
                      </div>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {entidades.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma autoridade cadastrada.</p>}
                        {entidades.map((e, i) => (
                          <div key={e.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                            {editandoEnt === e.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                  <input value={editEntNome} onChange={(ev) => setEditEntNome(ev.target.value)} placeholder="Nome" style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                  <input value={editEntCargo} onChange={(ev) => setEditEntCargo(ev.target.value)} placeholder="Cargo / Órgão" style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                  <input type="email" value={editEntEmail} onChange={(ev) => setEditEntEmail(ev.target.value)} placeholder="E-mail" style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
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

                  {abaConfig === 'categorias' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Categoria</h2>
                        <form onSubmit={salvarCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco na via)" required style={{ flex: 1, minWidth: '200px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', outline: 'none' }} />
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cor do pin</label>
                              <input type="color" value={novaCatCor} onChange={(e) => setNovaCatCor(e.target.value)} style={{ width: '44px', height: '38px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #d1d5db', padding: '2px' }} />
                            </div>
                          </div>
                          <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
                        </form>
                      </div>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {categorias.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma categoria cadastrada.</p>}
                        {categorias.map((c, i) => (
                          <div key={c.id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c.cor, display: 'inline-block', border: '1px solid #e5e7eb', flexShrink: 0 }} />
                              <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: 0 }}>{c.nome}</p>
                              <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{c.cor}</span>
                            </div>
                            <button onClick={() => excluirCategoria(c.id)} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Excluir</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {abaConfig === 'ia' && <MasterIA />}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @media (max-width: 640px) {
          .master-sidebar { transform: translateX(-100%); transition: transform 0.25s ease; }
          .master-sidebar.open { transform: translateX(0); }
          .master-main { margin-left: 0 !important; }
          .master-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-componente: Demandas ───────────────────────────────
// Capitaliza a primeira letra de cada palavra
function titleCase(str: string | null | undefined): string {
  if (!str) return '—'
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

// Capitaliza apenas a primeira letra da frase
function sentenceCase(str: string | null | undefined): string {
  if (!str) return '—'
  const s = str.trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function MasterDemandas() {
  const sbClient = createClient()
  const [demandas, setDemandas] = useState<any[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [notif, setNotif] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [menuAbertoDemandaId, setMenuAbertoDemandaId] = useState<string | null>(null)

  function carregarDemandas() {
    sbClient.from('demandas')
      .select('*, categoria:categorias_mapa(*), entidade:entidades(*)')
      .order('created_at', { ascending: false })
      .then(async ({ data }: any) => {
        const lista = data || []
        // Busca emails dos perfis separadamente
        const userIds = [...new Set(lista.map((d: any) => d.user_id).filter(Boolean))] as string[]
        if (userIds.length > 0) {
          const { data: perfis } = await sbClient.from('perfis').select('id, email').in('id', userIds)
          const emailMap: Record<string, string> = {}
          ;(perfis || []).forEach((p: any) => { if (p.email) emailMap[p.id] = p.email })
          setDemandas(lista.map((d: any) => ({ ...d, morador_email: emailMap[d.user_id] || null })))
        } else {
          setDemandas(lista)
        }
      })
  }

  useEffect(() => {
    carregarDemandas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function mostrarNotif(msg: string, erro = false) {
    setNotif((erro ? 'Erro: ' : '') + msg)
    setTimeout(() => setNotif(''), 5000)
  }

  async function reenviarLink(id: string) {
    const { data: { session } } = await sbClient.auth.getSession()
    const res = await fetch('/api/master/reenviar-link-demanda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ demanda_id: id }),
    })
    const d = await res.json()
    d.ok ? mostrarNotif('Link reenviado com sucesso.') : mostrarNotif(d.error, true)
  }

  async function getToken() {
    const { data: { session } } = await sbClient.auth.getSession()
    return session?.access_token
  }

  async function excluirDemanda(id: string) {
    if (!confirm('Excluir esta demanda permanentemente? Esta ação não pode ser desfeita.')) return
    const token = await getToken()
    const res = await fetch('/api/master/demanda', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ demanda_id: id }),
    })
    const d = await res.json()
    if (!d.ok) { mostrarNotif(d.error, true); return }
    mostrarNotif('Demanda excluída.')
    carregarDemandas()
  }

  async function salvarEdicao(id: string) {
    if (!editDescricao.trim()) return
    const token = await getToken()
    const res = await fetch('/api/master/demanda', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ demanda_id: id, descricao: editDescricao.trim() }),
    })
    const d = await res.json()
    if (!d.ok) { mostrarNotif(d.error, true); return }
    setEditandoId(null)
    mostrarNotif('Demanda atualizada.')
    carregarDemandas()
  }

  const statusLabel: Record<string, string> = {
    pendente: 'Pendente',
    aguardando_resposta: 'Aguardando resposta',
    respondida: 'Respondida',
    rejeitada_ia: 'Rejeitada pela IA',
    resolvida: 'Resolvida',
  }

  const statusCor: Record<string, { bg: string; color: string }> = {
    pendente:           { bg: '#fef3c7', color: '#92400e' },
    aguardando_resposta:{ bg: '#dbeafe', color: '#1e40af' },
    respondida:         { bg: '#dcfce7', color: '#166534' },
    rejeitada_ia:       { bg: '#fef2f2', color: '#dc2626' },
    resolvida:          { bg: '#f0fdf4', color: '#15803d' },
  }

  const filtradas = filtro === 'todos' ? demandas : demandas.filter(d => d.status === filtro)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {notif && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>
          {notif}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['todos', 'pendente', 'aguardando_resposta', 'respondida', 'rejeitada_ia'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '20px', border: '1.5px solid', borderColor: filtro === f ? '#1e3a5f' : '#e5e7eb', background: filtro === f ? '#1e3a5f' : 'white', color: filtro === f ? 'white' : '#6b7280', cursor: 'pointer', fontWeight: filtro === f ? 600 : 400 }}>
            {f === 'todos' ? `Todas (${demandas.length})` : `${statusLabel[f]} (${demandas.filter(d => d.status === f).length})`}
          </button>
        ))}
      </div>

      {filtradas.length === 0 && (
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
          Nenhuma demanda encontrada.
        </div>
      )}

      {filtradas.map((d: any) => {
        const cor = statusCor[d.status] || { bg: '#f3f4f6', color: '#6b7280' }
        const editando = editandoId === d.id
        const menuAberto = menuAbertoDemandaId === d.id

        return (
          <div key={d.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', position: 'relative' }}>

            {/* Botão "..." no canto superior direito */}
            <div style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10 }}>
              <button
                onClick={() => setMenuAbertoDemandaId(menuAberto ? null : d.id)}
                style={{ fontSize: '16px', fontWeight: 700, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1, borderRadius: '4px' }}
              >
                ···
              </button>
              {menuAberto && (
                <>
                  {/* Overlay para fechar ao clicar fora */}
                  <div onClick={() => setMenuAbertoDemandaId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{ position: 'absolute', top: '28px', right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '160px', zIndex: 20, padding: '4px 0' }}>
                    <button
                      onClick={() => { setEditandoId(editando ? null : d.id); setEditDescricao(d.descricao); setMenuAbertoDemandaId(null) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {editando ? 'Cancelar edição' : 'Editar demanda'}
                    </button>
                    {d.status === 'aguardando_resposta' && (
                      <button
                        onClick={() => { reenviarLink(d.id); setMenuAbertoDemandaId(null) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Reenviar link
                      </button>
                    )}
                    <div style={{ height: '1px', background: '#f3f4f6', margin: '4px 0' }} />
                    <button
                      onClick={() => { excluirDemanda(d.id); setMenuAbertoDemandaId(null) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Corpo do card */}
            <div style={{ padding: '16px 20px', paddingRight: '48px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {/* Linha 1: só status */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, background: cor.bg, color: cor.color, borderRadius: '20px', padding: '3px 10px' }}>
                  {statusLabel[d.status] || d.status}
                </span>
              </div>

              {/* Caixa principal */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  Nome: <strong style={{ color: '#111827' }}>{titleCase(d.morador_nome)}</strong>
                  <span style={{ color: '#6b7280' }}> · {d.morador_cpf || '—'} · {d.morador_email || '—'}</span>
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  Para: <strong style={{ color: '#111827' }}>{titleCase(d.entidade?.nome)}</strong>
                  {d.entidade?.cargo && <span style={{ color: '#6b7280' }}> ({titleCase(d.entidade.cargo)})</span>}
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: '#6b7280', fontWeight: 400 }}>Endereço:</strong> {titleCase(d.endereco_label)}
                </p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: '#6b7280', fontWeight: 400 }}>Categoria:</strong> {d.categoria?.nome ? titleCase(d.categoria.nome) : '—'}
                </p>
                {editando ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <textarea
                      value={editDescricao}
                      onChange={(e) => setEditDescricao(e.target.value)}
                      rows={3}
                      style={{ width: '100%', border: '1.5px solid #1e3a5f', borderRadius: '7px', padding: '8px 12px', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, background: 'white' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => salvarEdicao(d.id)}
                        style={{ fontSize: '12px', fontWeight: 600, background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
                        Salvar
                      </button>
                      <button onClick={() => setEditandoId(null)}
                        style={{ fontSize: '12px', fontWeight: 500, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', fontWeight: 400, color: '#111827', margin: 0, lineHeight: 1.5 }}>
                    <strong style={{ color: '#6b7280', fontWeight: 400 }}>Demanda:</strong> {sentenceCase(d.descricao)}
                  </p>
                )}
                {/* Ver foto — dentro da caixa, abaixo da demanda */}
                <button
                  onClick={() => d.foto_url && window.open(d.foto_url, '_blank')}
                  disabled={!d.foto_url}
                  style={{
                    alignSelf: 'flex-start', marginTop: '2px',
                    fontSize: '12px', fontWeight: 500,
                    color: d.foto_url ? '#1e40af' : '#d1d5db',
                    background: 'none', border: 'none',
                    cursor: d.foto_url ? 'pointer' : 'default',
                    padding: 0, textDecoration: d.foto_url ? 'underline' : 'none',
                  }}
                >
                  Ver foto
                </button>
              </div>

              {/* Análise IA — oculta se não houver */}
              {d.ia_motivo && (
                <div style={{
                  fontSize: '12px',
                  color: d.status === 'rejeitada_ia' ? '#dc2626' : '#6b7280',
                  background: d.status === 'rejeitada_ia' ? '#fef2f2' : '#f9fafb',
                  border: `1px solid ${d.status === 'rejeitada_ia' ? '#fecaca' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  padding: '7px 10px',
                  lineHeight: 1.5,
                }}>
                  <strong>Análise IA:</strong> {d.ia_motivo}
                </div>
              )}

              {/* Resposta — oculta se não houver */}
              {d.resposta && (
                <div style={{ fontSize: '12px', color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', lineHeight: 1.5 }}>
                  <strong>Resposta:</strong> {d.resposta}
                </div>
              )}

              {/* Data — alinhada à direita, no final */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  Criado em {new Date(d.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>

            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Sub-componente: IA ────────────────────────────────────
const CONFIG_PADRAO = {
  ativo: true,
  rigor: 'moderado',
  prompt: 'Analise a demanda do cidadão e decida se deve ser aprovada ou rejeitada. Rejeite se: for ofensiva, difamatória, sem relação com problemas reais do município de Frutal-MG, spam, ou conteúdo político partidário. Aprove se for uma demanda legítima de um cidadão sobre infraestrutura, saúde, educação, segurança ou outro serviço público.',
}

function MasterIA() {
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

  if (erro) return <p style={{ color: '#dc2626', fontSize: '13px' }}>{erro}</p>
  if (!config) return <p style={{ color: '#9ca3af', fontSize: '13px' }}>Carregando...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {notif && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>{notif}</div>}

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h2 style={{ fontWeight: 700, color: '#111827', fontSize: '15px', marginBottom: '20px' }}>Configurações da IA</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Análise automática ativa</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Quando desativada, demandas ficam pendentes para aprovação manual</p>
            </div>
            <button onClick={() => setConfig({ ...config, ativo: !config.ativo })}
              style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: config.ativo ? '#1e3a5f' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '2px', left: config.ativo ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block' }} />
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Nível de rigor</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['permissivo', 'moderado', 'rigoroso'].map(r => (
                <button key={r} onClick={() => setConfig({ ...config, rigor: r })}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1.5px solid', borderColor: config.rigor === r ? '#1e3a5f' : '#e5e7eb', background: config.rigor === r ? '#eff6ff' : 'white', color: config.rigor === r ? '#1e3a5f' : '#374151', fontSize: '13px', fontWeight: config.rigor === r ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
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

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Prompt de análise</label>
            <textarea value={config.prompt} onChange={(e) => setConfig({ ...config, prompt: e.target.value })} rows={6}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>

          <button onClick={salvar} disabled={salvando}
            style={{ backgroundColor: salvando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '8px', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h2 style={{ fontWeight: 700, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Histórico de análises (últimas 20)</h2>
        {historico.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>Nenhuma análise ainda.</p>}
        {historico.map((h: any) => (
          <div key={h.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: h.decisao === 'aprovada' ? '#166534' : '#dc2626', background: h.decisao === 'aprovada' ? '#f0fdf4' : '#fef2f2', borderRadius: '20px', padding: '3px 10px', flexShrink: 0 }}>
              {h.decisao === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
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
