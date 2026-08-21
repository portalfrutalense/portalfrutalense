'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Entidade, CategoriaMapa } from '@/types'

type SecaoMaster = 'dashboard' | 'demandas' | 'chatbot'
type AbaConfig = 'autoridades' | 'categorias' | 'ia'

export default function MasterPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [carregandoAuth, setCarregandoAuth] = useState(true)
  const [tokenSessao, setTokenSessao] = useState<string | null>(null)
  const [secao, setSecao] = useState<SecaoMaster>('dashboard')
  const [configurando, setConfigurando] = useState(false)
  const [abaConfig, setAbaConfig] = useState<AbaConfig>('autoridades')
  const [menuAberto, setMenuAberto] = useState(false)

  // Dados config
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({}) // categoria_id -> entidade_ids[]
  const [novaEntNome, setNovaEntNome] = useState('')
  const [novaEntCargo, setNovaEntCargo] = useState('')
  const [novaEntEmail, setNovaEntEmail] = useState('')
  const [novaEntCats, setNovaEntCats] = useState<string[]>([])
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatCor, setNovaCatCor] = useState('#ef4444')
  const [novaCatIcone, setNovaCatIcone] = useState<File | null>(null)
  const [editandoEnt, setEditandoEnt] = useState<string | null>(null)
  const [editEntNome, setEditEntNome] = useState('')
  const [editEntCargo, setEditEntCargo] = useState('')
  const [editEntEmail, setEditEntEmail] = useState('')
  const [editEntCats, setEditEntCats] = useState<string[]>([])
  const [editandoCat, setEditandoCat] = useState<string | null>(null)
  const [editCatNome, setEditCatNome] = useState('')
  const [editCatCor, setEditCatCor] = useState('#ef4444')
  const [editCatIcone, setEditCatIcone] = useState<File | null>(null)

  // Stats dashboard
  const [stats, setStats] = useState({ total: 0, pendente: 0, aguardando: 0, respondida: 0 })

  const client = createClient()
  const EMAIL_MASTER = 'portalfrutalense@gmail.com'

  function verificarAcesso(session: any) {
    if (session && session.user?.email === EMAIL_MASTER) {
      setAutenticado(true)
      setTokenSessao(session.access_token || null)
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
    client.from('entidades').select('*').order('nome').then(({ data }) => setEntidades((data as Entidade[]) || []))
    client.from('categorias_mapa').select('*').order('nome').then(({ data }) => setCategorias((data as CategoriaMapa[]) || []))
    client.from('categoria_entidades').select('categoria_id, entidade_id').then(({ data }) => {
      const mapa: Record<string, string[]> = {}
      for (const row of (data || [])) {
        if (!mapa[row.categoria_id]) mapa[row.categoria_id] = []
        mapa[row.categoria_id].push(row.entidade_id)
      }
      setCatEntidades(mapa)
    })
    client.from('demandas').select('status').then(({ data }) => {
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
    const { data: nova } = await client.from('entidades').insert({ nome: novaEntNome, cargo: novaEntCargo, email: novaEntEmail, ativo: true }).select().single()
    if (nova && novaEntCats.length > 0) {
      const { error: errCat } = await client.from('categoria_entidades').insert(novaEntCats.map(catId => ({ categoria_id: catId, entidade_id: nova.id })))
      if (errCat) console.error('ERRO categoria_entidades insert:', errCat)
    }
    setNovaEntNome(''); setNovaEntCargo(''); setNovaEntEmail(''); setNovaEntCats([])
    carregarDados()
  }
  async function excluirEntidade(id: string) {
    if (!confirm('Excluir esta autoridade?')) return
    await client.from('entidades').delete().eq('id', id)
    carregarDados()
  }
  async function salvarEdicaoEntidade(id: string) {
    await client.from('entidades').update({ nome: editEntNome, cargo: editEntCargo, email: editEntEmail }).eq('id', id)
    // Recria as relações: apaga tudo e insere as selecionadas
    const { error: errDel } = await client.from('categoria_entidades').delete().eq('entidade_id', id)
    if (errDel) console.error('ERRO categoria_entidades delete:', errDel)
    if (editEntCats.length > 0) {
      const { error: errIns } = await client.from('categoria_entidades').insert(editEntCats.map(catId => ({ categoria_id: catId, entidade_id: id })))
      if (errIns) console.error('ERRO categoria_entidades insert (edit):', errIns)
    }
    setEditandoEnt(null)
    carregarDados()
  }
  async function comprimirIcone(file: File, maxSize = 64): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.9)
      }
      img.src = url
    })
  }
  async function uploadIconeCategoria(file: File, id: string): Promise<string | null> {
    const blob = await comprimirIcone(file)
    const path = `${id}.png`
    const { error } = await client.storage.from('categoria-icones').upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (error) { console.error('Erro upload icone:', error); return null }
    const { data } = client.storage.from('categoria-icones').getPublicUrl(path)
    return data.publicUrl
  }
  async function salvarCategoria(e: React.FormEvent) {
    e.preventDefault()
    const { data: nova } = await client.from('categorias_mapa').insert({ nome: novaCatNome, cor: novaCatCor, ativo: true }).select().single()
    if (nova && novaCatIcone) {
      const url = await uploadIconeCategoria(novaCatIcone, nova.id)
      if (url) await client.from('categorias_mapa').update({ icone_url: url }).eq('id', nova.id)
    }
    setNovaCatNome(''); setNovaCatCor('#ef4444'); setNovaCatIcone(null)
    carregarDados()
  }
  async function excluirCategoria(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    await client.from('categorias_mapa').delete().eq('id', id)
    carregarDados()
  }
  async function salvarEdicaoCategoria(id: string) {
    let icone_url: string | undefined = undefined
    if (editCatIcone) {
      const url = await uploadIconeCategoria(editCatIcone, id)
      if (url) icone_url = url
    }
    await client.from('categorias_mapa').update({ nome: editCatNome, cor: editCatCor, ...(icone_url ? { icone_url } : {}) }).eq('id', id)
    setEditandoCat(null); setEditCatIcone(null)
    carregarDados()
  }

  async function toggleCatEntidade(catId: string, entId: string) {
    const atuais = catEntidades[catId] || []
    if (atuais.includes(entId)) {
      await client.from('categoria_entidades').delete().eq('categoria_id', catId).eq('entidade_id', entId)
    } else {
      await client.from('categoria_entidades').insert({ categoria_id: catId, entidade_id: entId })
    }
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
    { key: 'chatbot',   label: 'Chatbot IA' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: '180px',
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
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Fala Frutal</p>
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
      <main style={{ marginLeft: '180px', flex: 1, minWidth: 0 }} className="master-main">

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
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Visão geral do Fala Frutal.</p>
              </div>

              <div className="master-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
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

            </div>
          )}

          {/* ── CHATBOT IA ── */}
          {secao === 'chatbot' && (
            <div>
              <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Chatbot IA</h1>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Base de conhecimento usada pelo assistente virtual do Fala Frutal.</p>
              </div>
              <MasterChatbot />
            </div>
          )}

          {/* ── MAPA DE DEMANDAS ── */}
          {secao === 'demandas' && (
            <div>
              {/* Header da seção */}
              <div className="master-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
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
              {!configurando && <MasterDemandas token={tokenSessao} />}

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
                          {categorias.length > 0 && (
                            <div>
                              <p style={{ fontSize: '12px', fontWeight: 500, color: '#4b5563', margin: '0 0 8px' }}>Categorias responsável</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {categorias.map(cat => {
                                  const marcado = novaEntCats.includes(cat.id)
                                  return (
                                    <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', userSelect: 'none' }}>
                                      <input type="checkbox" checked={marcado} onChange={() => setNovaEntCats(prev => marcado ? prev.filter(id => id !== cat.id) : [...prev, cat.id])} />
                                      {cat.nome}
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
                        </form>
                      </div>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {entidades.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma autoridade cadastrada.</p>}
                        {entidades.map((e, i) => (
                          <div key={e.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                            {editandoEnt === e.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                  <input value={editEntNome} onChange={(ev) => setEditEntNome(ev.target.value)} placeholder="Nome" style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                  <input value={editEntCargo} onChange={(ev) => setEditEntCargo(ev.target.value)} placeholder="Cargo / Órgão" style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                  <input type="email" value={editEntEmail} onChange={(ev) => setEditEntEmail(ev.target.value)} placeholder="E-mail" style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                </div>
                                {categorias.length > 0 && (
                                  <div>
                                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#4b5563', margin: '0 0 6px' }}>Categorias responsável</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {categorias.map(cat => {
                                        const marcado = editEntCats.includes(cat.id)
                                        return (
                                          <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', userSelect: 'none' }}>
                                            <input type="checkbox" checked={marcado} onChange={() => setEditEntCats(prev => marcado ? prev.filter(id => id !== cat.id) : [...prev, cat.id])} />
                                            {cat.nome}
                                          </label>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {btnAcao('Salvar', () => salvarEdicaoEntidade(e.id), 'primario')}
                                  {btnAcao('Cancelar', () => setEditandoEnt(null), 'neutro')}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                  <div>
                                    <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: 0 }}>{e.nome}</p>
                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{e.cargo} · {e.email}</p>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {btnAcao('Editar', () => { setEditandoEnt(e.id); setEditEntNome(e.nome); setEditEntCargo(e.cargo); setEditEntEmail(e.email); setEditEntCats(Object.entries(catEntidades).filter(([, ids]) => ids.includes(e.id)).map(([catId]) => catId)) }, 'neutro')}
                                    {btnAcao('Excluir', () => excluirEntidade(e.id), 'perigo')}
                                  </div>
                                </div>
                                {/* Categorias atribuídas a esta entidade */}
                                {(() => {
                                  const cats = categorias.filter(cat => (catEntidades[cat.id] || []).includes(e.id))
                                  return cats.length > 0 ? (
                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, paddingLeft: '4px' }}>
                                      {cats.map(c => c.nome).join(', ')}
                                    </p>
                                  ) : null
                                })()}
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
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Ícone (opcional, PNG com fundo transparente)</label>
                              <input type="file" accept="image/png,image/webp,image/svg+xml" onChange={(e) => setNovaCatIcone(e.target.files?.[0] || null)} style={{ fontSize: '13px' }} />
                            </div>
                          </div>
                          <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', color: 'white', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
                        </form>
                      </div>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {categorias.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', padding: '20px' }}>Nenhuma categoria cadastrada.</p>}
                        {categorias.map((c, i) => (
                          <div key={c.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                            {editandoCat === c.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input value={editCatNome} onChange={(e) => setEditCatNome(e.target.value)} placeholder="Nome" style={{ flex: 1, minWidth: '160px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cor</label>
                                    <input type="color" value={editCatCor} onChange={(e) => setEditCatCor(e.target.value)} style={{ width: '44px', height: '34px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #d1d5db', padding: '2px' }} />
                                  </div>
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                    Ícone {categorias.find(x => x.id === editandoCat)?.icone_url ? '(atual: imagem salva — faça upload para substituir)' : '(opcional, PNG com fundo transparente)'}
                                  </label>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {categorias.find(x => x.id === editandoCat)?.icone_url && (
                                      <img src={categorias.find(x => x.id === editandoCat)!.icone_url} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                                    )}
                                    <input type="file" accept="image/png,image/webp,image/svg+xml" onChange={(e) => setEditCatIcone(e.target.files?.[0] || null)} style={{ fontSize: '13px' }} />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {btnAcao('Salvar', () => salvarEdicaoCategoria(c.id), 'primario')}
                                  {btnAcao('Cancelar', () => setEditandoCat(null), 'neutro')}
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c.cor, display: 'inline-block', border: '1px solid #e5e7eb', flexShrink: 0 }} />
                                  <p style={{ fontWeight: 500, color: '#111827', fontSize: '14px', margin: 0 }}>{c.nome}</p>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{c.cor}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {btnAcao('Editar', () => { setEditandoCat(c.id); setEditCatNome(c.nome); setEditCatCor(c.cor) }, 'neutro')}
                                  {btnAcao('Excluir', () => excluirCategoria(c.id), 'perigo')}
                                </div>
                              </div>
                            )}
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
          .master-sidebar { transform: translateX(-100%); transition: transform 0.25s ease; width: 220px !important; }
          .master-sidebar.open { transform: translateX(0); }
          .master-main { margin-left: 0 !important; }
          .master-topbar { display: flex !important; }
          .master-header-row { flex-direction: column !important; align-items: flex-start !important; }
          .master-header-actions { width: 100%; }
          .master-card-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .master-form-row { flex-direction: column !important; }
          .master-config-tabs { overflow-x: auto; }
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

function MasterDemandas({ token }: { token: string | null }) {
  const sbClient = createClient()
  const [demandas, setDemandas] = useState<any[]>([])
  const [carregandoDemandas, setCarregandoDemandas] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [notif, setNotif] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [menuAbertoDemandaId, setMenuAbertoDemandaId] = useState<string | null>(null)

  async function carregarDemandas(tkn?: string) {
    setCarregandoDemandas(true)
    const t = tkn ?? token ?? (await sbClient.auth.getSession()).data.session?.access_token
    const res = await fetch('/api/master/demanda', {
      headers: { 'Authorization': `Bearer ${t}` },
    })
    if (res.ok) setDemandas(await res.json())
    setCarregandoDemandas(false)
  }

  useEffect(() => {
    carregarDemandas(token ?? undefined)
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
    if (token) return token
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

      {/* Filtro dropdown */}
      <div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ fontSize: '13px', fontWeight: 500, color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 32px 8px 12px', cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          {(['todos', 'pendente', 'aguardando_resposta', 'respondida', 'rejeitada_ia'] as const).map(f => (
            <option key={f} value={f}>
              {f === 'todos' ? `Todas (${demandas.length})` : `${statusLabel[f]} (${demandas.filter(d => d.status === f).length})`}
            </option>
          ))}
        </select>
      </div>

      {carregandoDemandas && (
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
          Carregando demandas...
        </div>
      )}
      {!carregandoDemandas && filtradas.length === 0 && (
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
                  Criada em {new Date(d.created_at).toLocaleDateString('pt-BR')}
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

function MasterChatbot() {
  const sbClient = createClient()
  const [entradas, setEntradas] = useState<any[]>([])
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoConteudo, setNovoConteudo] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editConteudo, setEditConteudo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [notif, setNotif] = useState('')
  const [notifErro, setNotifErro] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  function toggleExpandir(id: string) {
    setExpandidos(prev => {
      const novo = new Set(prev)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  async function carregar() {
    const { data, error } = await sbClient.from('chatbot_base').select('*').order('created_at', { ascending: false })
    if (error) { mostrarNotif(`Erro ao carregar: ${error.message}`, true); return }
    setEntradas(data || [])
  }

  useEffect(() => { carregar() }, [])

  function mostrarNotif(msg: string, erro = false) { setNotif(msg); setNotifErro(erro); setTimeout(() => setNotif(''), 5000) }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoTitulo.trim() || !novoConteudo.trim()) return
    setSalvando(true)
    const { error } = await sbClient.from('chatbot_base').insert({ titulo: novoTitulo.trim(), conteudo: novoConteudo.trim(), ativo: true })
    setSalvando(false)
    if (error) { mostrarNotif(`Erro ao salvar: ${error.message}`, true); return }
    setNovoTitulo(''); setNovoConteudo('')
    await carregar()
    mostrarNotif('Entrada adicionada.')
  }

  async function salvarEdicao(id: string) {
    const { error } = await sbClient.from('chatbot_base').update({ titulo: editTitulo, conteudo: editConteudo }).eq('id', id)
    if (error) { mostrarNotif(`Erro ao salvar: ${error.message}`, true); return }
    setEditandoId(null)
    await carregar()
    mostrarNotif('Entrada atualizada.')
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta entrada da base de conhecimento?')) return
    const { error } = await sbClient.from('chatbot_base').delete().eq('id', id)
    if (error) { mostrarNotif(`Erro ao excluir: ${error.message}`, true); return }
    await carregar()
    mostrarNotif('Entrada excluída.')
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const { error } = await sbClient.from('chatbot_base').update({ ativo: !ativo }).eq('id', id)
    if (error) { mostrarNotif(`Erro: ${error.message}`, true); return }
    await carregar()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {notif && (
        <div style={{
          background: notifErro ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${notifErro ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
          color: notifErro ? '#dc2626' : '#166534',
        }}>
          {notif}
        </div>
      )}

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
        <strong>Como funciona:</strong> Cada entrada abaixo é um bloco de conhecimento que o chatbot usa para responder aos cidadãos. Adicione telefones úteis, horários, informações de serviços públicos, etc. O bot só responde com base no que está aqui.
      </div>

      {/* Formulário nova entrada */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Nova entrada</h3>
        <form onSubmit={adicionar} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} required
            placeholder="Título (ex: UBS Central — Horário e telefone)"
            style={{ border: '1px solid #d1d5db', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <textarea value={novoConteudo} onChange={e => setNovoConteudo(e.target.value)} required rows={4}
            placeholder="Conteúdo (ex: UBS Central funciona de segunda a sexta, das 7h às 17h. Telefone: (34) 3321-xxxx. Endereço: Rua XV de Novembro, 200.)"
            style={{ border: '1px solid #d1d5db', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
          <button type="submit" disabled={salvando}
            style={{ alignSelf: 'flex-start', backgroundColor: salvando ? '#9ca3af' : '#1e3a5f', color: 'white', fontWeight: 600, padding: '9px 20px', borderRadius: '7px', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* Lista de entradas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {entradas.length === 0 && (
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            Nenhuma entrada cadastrada ainda.
          </div>
        )}
        {entradas.map((e: any) => (
          <div key={e.id} style={{ background: 'white', borderRadius: '10px', border: `1px solid ${e.ativo ? '#e5e7eb' : '#f3f4f6'}`, padding: '16px', opacity: e.ativo ? 1 : 0.55 }}>
            {editandoId === e.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input value={editTitulo} onChange={ev => setEditTitulo(ev.target.value)}
                  style={{ border: '1.5px solid #1e3a5f', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <textarea value={editConteudo} onChange={ev => setEditConteudo(ev.target.value)} rows={4}
                  style={{ border: '1.5px solid #1e3a5f', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => salvarEdicao(e.id)} style={{ background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                  <button onClick={() => setEditandoId(null)} style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: expandidos.has(e.id) ? '6px' : 0 }}>
                  <button
                    onClick={() => toggleExpandir(e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expandidos.has(e.id) ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{e.titulo}</span>
                  </button>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleAtivo(e.id, e.ativo)}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: e.ativo ? '#dcfce7' : '#f3f4f6', color: e.ativo ? '#166534' : '#6b7280' }}>
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                    <button onClick={() => { setEditandoId(e.id); setEditTitulo(e.titulo); setEditConteudo(e.conteudo) }}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #e5e7eb', cursor: 'pointer', background: 'white', color: '#374151' }}>
                      Editar
                    </button>
                    <button onClick={() => excluir(e.id)}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #fecaca', cursor: 'pointer', background: 'white', color: '#dc2626' }}>
                      Excluir
                    </button>
                  </div>
                </div>
                {expandidos.has(e.id) && (
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.conteudo}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MasterIA() {
  const sbClient = createClient()
  const [config, setConfig] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [notif, setNotif] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    sbClient.from('ia_config').select('*').eq('id', 1).maybeSingle().then(({ data, error }: any) => {
      if (error) { setErro('Erro ao carregar configurações da IA.'); return }
      setConfig(data || CONFIG_PADRAO)
    })
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

    </div>
  )
}

