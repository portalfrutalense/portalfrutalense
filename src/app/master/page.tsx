'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'
import { Entidade, CategoriaMapa } from '@/types'

type SecaoMaster = 'dashboard' | 'demandas' | 'chatbot' | 'perfis'
type SubSecaoPerfis = 'cidadao' | 'autoridade' | 'empresa'
type AbaConfig = 'categorias' | 'ia'

export default function MasterPage() {
  const { user, perfil, carregando: carregandoAuth } = useAuth()
  const router = useRouter()
  const [tokenSessao, setTokenSessao] = useState<string | null>(null)
  const [secao, setSecao] = useState<SecaoMaster>('dashboard')
  const [subSecaoPerfis, setSubSecaoPerfis] = useState<SubSecaoPerfis | null>(null)
  const [perfisAberto, setPerfisAberto] = useState(false)
  const [configurando, setConfigurando] = useState(false)
  const [abaConfig, setAbaConfig] = useState<AbaConfig>('categorias')
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
  const [novaCatCor, setNovaCatCor] = useState('#dc2626')
  const [novaCatIcone, setNovaCatIcone] = useState<File | null>(null)
  const [editandoEnt, setEditandoEnt] = useState<string | null>(null)
  const [editEntNome, setEditEntNome] = useState('')
  const [editEntCargo, setEditEntCargo] = useState('')
  const [editEntEmail, setEditEntEmail] = useState('')
  const [editEntCats, setEditEntCats] = useState<string[]>([])
  const [editandoCat, setEditandoCat] = useState<string | null>(null)
  const [editCatNome, setEditCatNome] = useState('')
  const [editCatCor, setEditCatCor] = useState('#dc2626')
  const [editCatIcone, setEditCatIcone] = useState<File | null>(null)

  // Stats dashboard
  const [stats, setStats] = useState({ total: 0, pendente: 0, aguardando: 0, respondida: 0, resolvida: 0, nao_resolvida: 0 })

  const client = createClient()

  useEffect(() => {
    if (carregandoAuth) return
    if (!user || perfil?.role !== 'master') {
      router.replace('/')
      return
    }
    client.auth.getSession().then(({ data }) => {
      setTokenSessao(data.session?.access_token || null)
      carregarDados()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoAuth, user, perfil])

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
        resolvida: d.filter((x: any) => x.status === 'resolvida').length,
        nao_resolvida: d.filter((x: any) => x.status === 'nao_resolvida').length,
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
    setNovaCatNome(''); setNovaCatCor('#dc2626'); setNovaCatIcone(null)
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
      primario: { background: '#4256c8', color: 'white', border: 'none' },
      perigo:   { background: 'white', color: '#dc2626', border: '1px solid #e5e7eb' },
      neutro:   { background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' },
    }
    return <button onClick={onClick} style={{ ...cores[variante], fontSize: '12px', borderRadius: '5px', padding: '5px 12px', fontWeight: 500, cursor: 'pointer' }}>{label}</button>
  }

  if (carregandoAuth || !user || perfil?.role !== 'master') {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px', background: '#f9fafb' }}>Carregando...</div>
  }

  // ── PAINEL ────────────────────────────────────────────────
  const navItems: { key: SecaoMaster; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'perfis',    label: 'Perfis' },
    { key: 'demandas',  label: 'Mapa de Demandas' },
    { key: 'chatbot',   label: 'Chatbot IA' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: '180px',
        flexShrink: 0,
        background: '#4256c8',
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
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>CidadanIA Frutal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {/* Dashboard */}
          {[
            { key: 'dashboard' as SecaoMaster, label: 'Dashboard' },
            { key: 'demandas'  as SecaoMaster, label: 'Mapa de Demandas' },
            { key: 'chatbot'   as SecaoMaster, label: 'Chatbot IA' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => { setSecao(item.key); setPerfisAberto(false); setConfigurando(false); setMenuAberto(false) }}
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

          {/* Perfis — flyout */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setPerfisAberto(o => !o)
                setConfigurando(false)
                setMenuAberto(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                background: secao === 'perfis' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: secao === 'perfis' ? 'white' : 'rgba(255,255,255,0.55)',
                marginBottom: '2px', textAlign: 'left',
              }}
            >
              <span>Perfis</span>
              <span style={{ fontSize: '10px', opacity: 0.6 }}>›</span>
            </button>

            {perfisAberto && (
              <>
                <div onClick={() => setPerfisAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                <div style={{
                  position: 'absolute', left: 'calc(100% + 8px)', top: 0,
                  background: '#4256c8', borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  minWidth: '150px', zIndex: 99, padding: '6px',
                }}>
                  {([
                    { key: 'cidadao'    as SubSecaoPerfis, label: 'Cidadãos'    },
                    { key: 'autoridade' as SubSecaoPerfis, label: 'Autoridades' },
                    { key: 'empresa'    as SubSecaoPerfis, label: 'Empresas'    },
                  ]).map(sub => (
                    <button
                      key={sub.key}
                      onClick={() => { setSecao('perfis'); setSubSecaoPerfis(sub.key); setPerfisAberto(false); setMenuAberto(false) }}
                      style={{
                        display: 'block', width: '100%', padding: '9px 14px',
                        borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                        background: subSecaoPerfis === sub.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: subSecaoPerfis === sub.key ? 'white' : 'rgba(255,255,255,0.65)',
                        textAlign: 'left',
                      }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
        <div className="master-topbar" style={{ display: 'none', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#4256c8', position: 'sticky', top: 0, zIndex: 50 }}>
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
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Visão geral do CidadanIA Frutal.</p>
              </div>

              <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '32px', maxWidth: '280px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Mapa de Demandas</h2>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { label: 'Total de demandas', valor: stats.total },
                    { label: 'Pendentes (IA)', valor: stats.pendente },
                    { label: 'Aguardando resposta', valor: stats.aguardando },
                    { label: 'Respondidas', valor: stats.respondida },
                    { label: 'Resolvidas', valor: stats.resolvida },
                    { label: 'Não resolvidas', valor: stats.nao_resolvida },
                  ].map((s, i) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #e5e7eb' }}>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, fontWeight: 500 }}>{s.label}</p>
                      <p style={{ fontSize: '16px', color: '#111827', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.valor}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── CHATBOT IA ── */}
          {secao === 'chatbot' && (
            <div>
              <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Chatbot IA</h1>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Base de conhecimento usada pelo assistente virtual do CidadanIA Frutal.</p>
              </div>
              <MasterChatbot />
            </div>
          )}

          {/* ── PERFIS ── */}
          {secao === 'perfis' && <MasterPerfis token={tokenSessao} subSecao={subSecaoPerfis} />}

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
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
                      Voltar as demandas
                    </button>
                  ) : (
                    <button onClick={() => { setConfigurando(true); setAbaConfig('categorias') }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
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
                  <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
                    {(['categorias', 'ia'] as AbaConfig[]).map((a) => {
                      const labels: Record<AbaConfig, string> = { categorias: 'Categorias', ia: 'IA' }
                      return (
                        <button key={a} onClick={() => setAbaConfig(a)} style={{
                          padding: '8px 16px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                          background: abaConfig === a ? '#4256c8' : 'transparent',
                          color: abaConfig === a ? 'white' : '#6b7280',
                        }}>
                          {labels[a]}
                        </button>
                      )
                    })}
                  </div>

                  {abaConfig === 'categorias' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
                        <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Categoria</h2>
                        <form onSubmit={salvarCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco na via)" required style={{ flex: 1, minWidth: '200px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', outline: 'none' }} />
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cor do pin</label>
                              <input type="color" value={novaCatCor} onChange={(e) => setNovaCatCor(e.target.value)} style={{ width: '44px', height: '38px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e5e7eb', padding: '2px' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Ícone (opcional, PNG com fundo transparente)</label>
                              <input type="file" accept="image/png,image/webp,image/svg+xml" onChange={(e) => setNovaCatIcone(e.target.files?.[0] || null)} style={{ fontSize: '13px' }} />
                            </div>
                          </div>
                          <button type="submit" style={{ alignSelf: 'flex-start', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Salvar</button>
                        </form>
                      </div>
                      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        {categorias.length === 0 && <p style={{ color: '#6b7280', fontSize: '13px', padding: '20px' }}>Nenhuma categoria cadastrada.</p>}
                        {categorias.map((c, i) => (
                          <div key={c.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                            {editandoCat === c.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input value={editCatNome} onChange={(e) => setEditCatNome(e.target.value)} placeholder="Nome" style={{ flex: 1, minWidth: '160px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                                  <div>
                                    <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cor</label>
                                    <input type="color" value={editCatCor} onChange={(e) => setEditCatCor(e.target.value)} style={{ width: '44px', height: '34px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e5e7eb', padding: '2px' }} />
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
                                  <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>{c.cor}</span>
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
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())

  function toggleExpandida(id: string) {
    setExpandidas(prev => {
      const novo = new Set(prev)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [menuAbertoDemandaId, setMenuAbertoDemandaId] = useState<string | null>(null)

  async function carregarDemandas() {
    const t = token ?? (await sbClient.auth.getSession()).data.session?.access_token
    if (!t || t === 'undefined' || t === 'null') return
    setCarregandoDemandas(true)
    const res = await fetch('/api/master/demanda', {
      headers: { 'Authorization': `Bearer ${t}` },
    })
    if (res.ok) setDemandas(await res.json())
    setCarregandoDemandas(false)
  }

  useEffect(() => {
    if (token) carregarDemandas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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
    pendente:           { bg: '#f9fafb', color: '#92400e' },
    aguardando_resposta:{ bg: '#f9fafb', color: '#4256c8' },
    respondida:         { bg: '#f9fafb', color: '#166534' },
    rejeitada_ia:       { bg: '#f9fafb', color: '#dc2626' },
    resolvida:          { bg: '#f9fafb', color: '#166534' },
  }

  const filtradas = filtro === 'todos' ? demandas : demandas.filter(d => d.status === filtro)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {notif && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>
          {notif}
        </div>
      )}

      {/* Filtro de status */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {(['todos', 'pendente', 'aguardando_resposta', 'respondida', 'resolvida', 'rejeitada_ia'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
              border: filtro === f ? '2px solid #4256c8' : '1px solid #e5e7eb',
              background: filtro === f ? '#4256c8' : 'white',
              color: filtro === f ? 'white' : '#111827',
            }}
          >
            {f === 'todos' ? `Todas (${demandas.length})` : `${statusLabel[f]} (${demandas.filter(d => d.status === f).length})`}
          </button>
        ))}
      </div>

      {carregandoDemandas && (
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
          Carregando demandas...
        </div>
      )}
      {!carregandoDemandas && filtradas.length === 0 && (
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
          Nenhuma demanda encontrada.
        </div>
      )}

      {filtradas.map((d: any) => {
        const cor = statusCor[d.status] || { bg: '#f9fafb', color: '#6b7280' }
        const editando = editandoId === d.id
        const menuAberto = menuAbertoDemandaId === d.id
        const expandida = expandidas.has(d.id)

        return (
          <div key={d.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', position: 'relative' }}>

            {/* Linha-resumo — sempre visível, clicável para expandir/recolher */}
            <div
              onClick={() => toggleExpandida(d.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 48px 12px 20px', cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transform: expandida ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 600, background: cor.bg, color: cor.color, borderRadius: '20px', padding: '3px 10px', flexShrink: 0 }}>
                {statusLabel[d.status] || d.status}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {titleCase(d.morador_nome)} · {d.categoria?.nome ? titleCase(d.categoria.nome) : '—'}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
                {new Date(d.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Botão "..." no canto superior direito */}
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10 }}>
              <button
                onClick={() => setMenuAbertoDemandaId(menuAberto ? null : d.id)}
                style={{ fontSize: '16px', fontWeight: 700, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1, borderRadius: '4px' }}
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
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {editando ? 'Cancelar edição' : 'Editar demanda'}
                    </button>
                    {d.status === 'aguardando_resposta' && (
                      <button
                        onClick={() => { reenviarLink(d.id); setMenuAbertoDemandaId(null) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Reenviar link
                      </button>
                    )}
                    {['aguardando_resposta', 'respondida', 'nao_resolvida'].includes(d.status) && (
                      <button
                        onClick={async () => {
                          await sbClient.from('demandas').update({ status: 'resolvida' }).eq('id', d.id)
                          setDemandas(prev => prev.map(x => x.id === d.id ? { ...x, status: 'resolvida' } : x))
                          setMenuAbertoDemandaId(null)
                        }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#166534', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Marcar como resolvida
                      </button>
                    )}
                    <div style={{ height: '1px', background: '#f9fafb', margin: '4px 0' }} />
                    <button
                      onClick={() => { excluirDemanda(d.id); setMenuAbertoDemandaId(null) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Corpo do card — só aparece expandido */}
            {expandida && (
            <div style={{ padding: '0 20px 16px', paddingRight: '48px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

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
                      style={{ width: '100%', border: '1.5px solid #4256c8', borderRadius: '7px', padding: '8px 12px', fontSize: '12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, background: 'white' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => salvarEdicao(d.id)}
                        style={{ fontSize: '12px', fontWeight: 600, background: '#4256c8', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
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
                    color: d.foto_url ? '#4256c8' : '#e5e7eb',
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
                  background: d.status === 'rejeitada_ia' ? '#f9fafb' : '#f9fafb',
                  border: `1px solid ${d.status === 'rejeitada_ia' ? '#e5e7eb' : '#e5e7eb'}`,
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

            </div>
            )}
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

const LABEL_PERFIS: Record<SubSecaoPerfis, string> = {
  cidadao:    'Cidadãos',
  autoridade: 'Autoridades',
  empresa:    'Empresas',
}

function MasterPerfis({ token, subSecao }: { token: string | null; subSecao: SubSecaoPerfis | null }) {
  const sbClient = createClient()
  const [perfis, setPerfis] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCpf, setEditCpf] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCargo, setEditCargo] = useState('')
  const [editCats, setEditCats] = useState<string[]>([])
  const [notif, setNotif] = useState('')
  const [criando, setCriando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoCargo, setNovoCargo] = useState('')
  const [novasCats, setNovasCats] = useState<string[]>([])
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [categorias, setCategorias] = useState<any[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({})

  async function getToken() {
    // Sempre busca sessão fresca para evitar token expirado
    const { data } = await sbClient.auth.getSession()
    return data.session?.access_token ?? token ?? null
  }

  function mostrarNotif(msg: string, erro = false) {
    setNotif((erro ? '⚠️ ' : '') + msg)
    setTimeout(() => setNotif(''), 4000)
  }

  async function carregar() {
    const t = await getToken()
    if (!t || t === 'undefined' || t === 'null') return
    setCarregando(true)
    const [resP, resC, resE] = await Promise.all([
      fetch('/api/master/perfis', { headers: { 'Authorization': `Bearer ${t}` } }),
      sbClient.from('categorias_mapa').select('id, nome').order('nome'),
      sbClient.from('entidades').select('id, nome, cargo, email, ativo'),
    ])
    const dataP = await resP.json()
    if (resP.ok) {
      // Mesclar: autoridades antigas (só em entidades, sem perfil com role=autoridade)
      const perfisIds = new Set(dataP.map((p: any) => p.id))
      const entidadesOrfas = (resE.data || [])
        .filter((e: any) => !perfisIds.has(e.id))
        .map((e: any) => ({ ...e, role: 'autoridade', _legado: true }))
      setPerfis([...dataP, ...entidadesOrfas])

      // Carregar categorias de todas as autoridades
      const todasAuts = [
        ...dataP.filter((p: any) => p.role === 'autoridade'),
        ...entidadesOrfas,
      ]
      if (todasAuts.length > 0) {
        const ids = todasAuts.map((a: any) => a.id)
        const { data: catEnt } = await sbClient
          .from('categoria_entidades')
          .select('entidade_id, categoria_id')
          .in('entidade_id', ids)
        const mapa: Record<string, string[]> = {}
        for (const row of (catEnt || [])) {
          if (!mapa[row.entidade_id]) mapa[row.entidade_id] = []
          mapa[row.entidade_id].push(row.categoria_id)
        }
        setCatEntidades(mapa)
      }
    } else {
      mostrarNotif(`Erro ${resP.status}: ${dataP?.error || 'desconhecido'}`)
    }
    if (resC.data) setCategorias(resC.data)
    setCarregando(false)
  }

  useEffect(() => { if (token) carregar() }, [token])

  async function salvarEdicao(id: string) {
    const t = await getToken()
    const perfil = perfis.find(p => p.id === id)
    const body: any = { id, nome: editNome, cpf: editCpf, email: editEmail }
    if (perfil?.role === 'autoridade') {
      body.cargo = editCargo
      body.categorias = editCats
    }
    await fetch('/api/master/perfis', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify(body),
    })
    setEditandoId(null)
    mostrarNotif('Perfil atualizado.')
    carregar()
  }

  async function bloquear(id: string, bloqueado: boolean) {
    const t = await getToken()
    await fetch('/api/master/perfis', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ id, bloqueado: !bloqueado }),
    })
    mostrarNotif(bloqueado ? 'Acesso liberado.' : 'Acesso bloqueado.')
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta autoridade? Esta ação não pode ser desfeita.')) return
    const t = await getToken()
    if (!t) { mostrarNotif('Sem autenticação. Faça login novamente.', true); return }
    try {
      const res = await fetch('/api/master/perfis', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ id }),
      })
      const d = await res.json()
      if (!res.ok || !d.ok) { mostrarNotif(d.error || `Erro ${res.status}`, true); return }
      mostrarNotif('Excluído com sucesso.')
      carregar()
    } catch (e: any) {
      mostrarNotif('Erro inesperado: ' + e.message, true)
    }
  }

  async function criarConta() {
    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha.trim()) {
      mostrarNotif('Preencha nome, e-mail e senha.')
      return
    }
    const t = await getToken()
    setSalvandoNovo(true)
    const res = await fetch('/api/master/criar-perfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ nome: novoNome, email: novoEmail, senha: novaSenha, role: subSecao, cargo: novoCargo, categorias: novasCats }),
    })
    const d = await res.json()
    setSalvandoNovo(false)
    if (!d.ok) { mostrarNotif(d.error || 'Erro ao criar conta.'); return }
    setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovoCargo(''); setNovasCats([]); setCriando(false)
    mostrarNotif('Conta criada com sucesso.')
    carregar()
  }

  const filtrados = perfis
    .filter(p => p.role === subSecao)
    .filter(p =>
      p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.email?.toLowerCase().includes(busca.toLowerCase()) ||
      p.cpf?.includes(busca)
    )

  if (!subSecao) return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Perfis</h1>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>Selecione um tipo na sidebar.</p>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          {LABEL_PERFIS[subSecao]}
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          {perfis.filter(p => p.role === subSecao).length} cadastro{perfis.filter(p => p.role === subSecao).length !== 1 ? 's' : ''}
        </p>
      </div>

      {notif && <div style={{ background: notif.startsWith('⚠️') ? '#f9fafb' : '#f9fafb', border: `1px solid ${notif.startsWith('⚠️') ? '#e5e7eb' : '#e5e7eb'}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: notif.startsWith('⚠️') ? '#dc2626' : '#166534', marginBottom: '16px' }}>{notif}</div>}

      {/* Formulário de criação — só para autoridade e empresa */}
      {subSecao !== 'cidadao' && (
        <div style={{ marginBottom: '20px' }}>
          {!criando ? (
            <button
              onClick={() => setCriando(true)}
              style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              + Nova conta
            </button>
          ) : (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Nova {subSecao === 'autoridade' ? 'Autoridade' : 'Empresa'}
              </p>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome completo"
                style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none' }} />
              <input value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="E-mail" type="email"
                style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none' }} />
              <input value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Senha inicial" type="password"
                style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none' }} />
              {subSecao === 'autoridade' && (
                <>
                  <input value={novoCargo} onChange={e => setNovoCargo(e.target.value)} placeholder="Cargo (ex: Secretário de Obras)"
                    style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none' }} />
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Categorias</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
                      {categorias.length === 0 && <span style={{ fontSize: '12px', color: '#6b7280' }}>Nenhuma categoria cadastrada.</span>}
                      {categorias.map(cat => (
                        <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#111827', cursor: 'pointer' }}>
                          <input type="checkbox" checked={novasCats.includes(cat.id)}
                            onChange={e => setNovasCats(prev => e.target.checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id))} />
                          {cat.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={criarConta} disabled={salvandoNovo}
                  style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: salvandoNovo ? 0.6 : 1 }}>
                  {salvandoNovo ? 'Criando...' : 'Criar conta'}
                </button>
                <button onClick={() => { setCriando(false); setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovoCargo(''); setNovasCats([]) }}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou CPF..."
          style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', width: '260px', outline: 'none' }}
        />
      </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtrados.map(p => (
              <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', position: 'relative' }}>

                {/* Menu ··· */}
                <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                  <button
                    onClick={() => setMenuAbertoId(menuAbertoId === p.id ? null : p.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 700, color: '#6b7280', padding: '2px 6px' }}>
                    ···
                  </button>
                  {menuAbertoId === p.id && (
                    <>
                      <div onClick={() => setMenuAbertoId(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                      <div style={{ position: 'absolute', top: '28px', right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '160px', zIndex: 20, padding: '4px 0' }}>
                        <button onClick={() => { setEditandoId(p.id); setEditNome(p.nome || ''); setEditCpf(p.cpf || ''); setEditEmail(p.email || ''); setEditCargo(p.cargo || ''); setEditCats(catEntidades[p.id] || []); setMenuAbertoId(null) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'none', border: 'none', cursor: 'pointer' }}>
                          Editar
                        </button>
                        {!p._legado && (
                          <button onClick={() => { bloquear(p.id, p.bloqueado); setMenuAbertoId(null) }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: p.bloqueado ? '#166534' : '#92400e', background: 'none', border: 'none', cursor: 'pointer' }}>
                            {p.bloqueado ? 'Liberar acesso' : 'Bloquear acesso'}
                          </button>
                        )}
                        <div style={{ height: '1px', background: '#f9fafb', margin: '4px 0' }} />
                        <button onClick={() => { excluir(p.id); setMenuAbertoId(null) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Dados */}
                {editandoId === p.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '40px' }}>
                    <input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome"
                      style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                    {p.role !== 'autoridade' && (
                      <input value={editCpf} onChange={e => setEditCpf(e.target.value)} placeholder="CPF"
                        style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                    )}
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="E-mail"
                      style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                    {p.role === 'autoridade' && (
                      <>
                        <input value={editCargo} onChange={e => setEditCargo(e.target.value)} placeholder="Cargo"
                          style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Categorias</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                            {categorias.map(cat => (
                              <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#111827', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editCats.includes(cat.id)}
                                  onChange={e => setEditCats(prev => e.target.checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id))} />
                                {cat.nome}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => salvarEdicao(p.id)}
                        style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Salvar
                      </button>
                      <button onClick={() => setEditandoId(null)}
                        style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ paddingRight: '40px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{p.nome || '—'}</span>
                      {p.bloqueado && <span style={{ fontSize: '10px', fontWeight: 700, background: '#f9fafb', color: '#dc2626', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '2px 8px' }}>BLOQUEADO</span>}
                      {p._legado && <span style={{ fontSize: '10px', fontWeight: 600, background: '#f9fafb', color: '#92400e', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '2px 8px' }}>sem login</span>}
                    </div>
                    {p.role === 'autoridade' && p.cargo && (
                      <span style={{ fontSize: '12px', color: '#111827' }}>{p.cargo}</span>
                    )}
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{p.email || '—'}</span>
                    {p.role !== 'autoridade' && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>CPF: {p.cpf || '—'}</span>
                    )}
                    {p.role === 'autoridade' && catEntidades[p.id]?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                        {catEntidades[p.id].map(catId => {
                          const cat = categorias.find(c => c.id === catId)
                          return cat ? (
                            <span key={catId} style={{ fontSize: '10px', background: '#f9fafb', color: '#4256c8', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '2px 8px' }}>
                              {cat.nome}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filtrados.length === 0 && !carregando && (
              <p style={{ color: '#6b7280', fontSize: '14px' }}>Nenhum cadastro encontrado.</p>
            )}
            {carregando && (
              <p style={{ color: '#6b7280', fontSize: '14px' }}>Carregando...</p>
            )}
          </div>
    </div>
  )
}

function MasterChatbot() {
  const sbClient = createClient()
  const [aba, setAba] = useState<'base' | 'config' | 'sem_resposta'>('base')
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
  // Config
  const [cfgNomeBot, setCfgNomeBot] = useState('')
  const [cfgDescricao, setCfgDescricao] = useState('')
  const [cfgTomVoz, setCfgTomVoz] = useState('')
  const [cfgResponsabilidades, setCfgResponsabilidades] = useState('')
  const [cfgPromptExtra, setCfgPromptExtra] = useState('')
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  // Sem resposta
  const [semResposta, setSemResposta] = useState<any[]>([])

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

  async function carregarConfig() {
    const { data } = await sbClient.from('chatbot_config').select('*').eq('id', 1).maybeSingle()
    setCfgNomeBot(data?.nome_bot || '')
    setCfgDescricao(data?.descricao_bot || '')
    setCfgTomVoz(data?.tom_voz || '')
    setCfgResponsabilidades(data?.responsabilidades || '')
    setCfgPromptExtra(data?.prompt_extra || '')
  }

  async function salvarConfig() {
    setSalvandoConfig(true)
    const { error } = await sbClient.from('chatbot_config').upsert({
      id: 1,
      nome_bot: cfgNomeBot,
      descricao_bot: cfgDescricao,
      tom_voz: cfgTomVoz,
      responsabilidades: cfgResponsabilidades,
      prompt_extra: cfgPromptExtra,
      updated_at: new Date().toISOString(),
    })
    setSalvandoConfig(false)
    if (error) { mostrarNotif(`Erro ao salvar: ${error.message}`, true); return }
    mostrarNotif('Configurações salvas.')
  }

  async function carregarSemResposta() {
    const { data } = await sbClient.from('chatbot_sem_resposta').select('*').order('created_at', { ascending: false }).limit(100)
    setSemResposta(data || [])
  }

  async function excluirSemResposta(id: string) {
    await sbClient.from('chatbot_sem_resposta').delete().eq('id', id)
    carregarSemResposta()
  }

  useEffect(() => { carregar(); carregarConfig(); carregarSemResposta() }, [])

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

  const ABAS_CHATBOT = [
    { key: 'base', label: 'Base de conhecimento' },
    { key: 'config', label: 'Configurações' },
    { key: 'sem_resposta', label: 'Sem resposta' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {notif && (
        <div style={{
          background: notifErro ? '#f9fafb' : '#f9fafb',
          border: `1px solid ${notifErro ? '#e5e7eb' : '#e5e7eb'}`,
          borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
          color: notifErro ? '#dc2626' : '#166534',
        }}>
          {notif}
        </div>
      )}

      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {ABAS_CHATBOT.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0', background: aba === a.key ? '#4256c8' : 'transparent', color: aba === a.key ? 'white' : '#6b7280' }}>
            {a.label}
            {a.key === 'sem_resposta' && semResposta.length > 0 && (
              <span style={{ marginLeft: '6px', background: '#dc2626', color: 'white', borderRadius: '20px', fontSize: '10px', padding: '1px 6px' }}>{semResposta.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Base de conhecimento ── */}
      {aba === 'base' && <>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#4256c8', lineHeight: 1.6 }}>
        <strong>Como funciona:</strong> Cada entrada abaixo é um bloco de conhecimento que o chatbot usa para responder aos cidadãos. Adicione telefones úteis, horários, informações de serviços públicos, etc. O bot só responde com base no que está aqui.
      </div>

      {/* Formulário nova entrada */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Nova entrada</h3>
        <form onSubmit={adicionar} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)} required
            placeholder="Título (ex: UBS Central — Horário e telefone)"
            style={{ border: '1px solid #e5e7eb', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          <textarea value={novoConteudo} onChange={e => setNovoConteudo(e.target.value)} required rows={4}
            placeholder="Conteúdo (ex: UBS Central funciona de segunda a sexta, das 7h às 17h. Telefone: (34) 3321-xxxx. Endereço: Rua XV de Novembro, 200.)"
            style={{ border: '1px solid #e5e7eb', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
          <button type="submit" disabled={salvando}
            style={{ alignSelf: 'flex-start', backgroundColor: salvando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '9px 20px', borderRadius: '7px', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* Lista de entradas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {entradas.length === 0 && (
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
            Nenhuma entrada cadastrada ainda.
          </div>
        )}
        {entradas.map((e: any) => (
          <div key={e.id} style={{ background: 'white', borderRadius: '10px', border: `1px solid ${e.ativo ? '#e5e7eb' : '#f9fafb'}`, padding: '16px', opacity: e.ativo ? 1 : 0.55 }}>
            {editandoId === e.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input value={editTitulo} onChange={ev => setEditTitulo(ev.target.value)}
                  style={{ border: '1.5px solid #4256c8', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <textarea value={editConteudo} onChange={ev => setEditConteudo(ev.target.value)} rows={4}
                  style={{ border: '1.5px solid #4256c8', borderRadius: '7px', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => salvarEdicao(e.id)} style={{ background: '#4256c8', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
                  <button onClick={() => setEditandoId(null)} style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: expandidos.has(e.id) ? '6px' : 0 }}>
                  <button
                    onClick={() => toggleExpandir(e.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expandidos.has(e.id) ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{e.titulo}</span>
                  </button>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => toggleAtivo(e.id, e.ativo)}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: e.ativo ? '#f9fafb' : '#f9fafb', color: e.ativo ? '#166534' : '#6b7280' }}>
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                    <button onClick={() => { setEditandoId(e.id); setEditTitulo(e.titulo); setEditConteudo(e.conteudo) }}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #e5e7eb', cursor: 'pointer', background: 'white', color: '#111827' }}>
                      Editar
                    </button>
                    <button onClick={() => excluir(e.id)}
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #e5e7eb', cursor: 'pointer', background: 'white', color: '#dc2626' }}>
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
      </>}

      {/* ── Configurações ── */}
      {aba === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { label: 'Nome do assistente', desc: 'Como o bot se chama.', value: cfgNomeBot, set: setCfgNomeBot, rows: 1, placeholder: 'Ex: Assistente Virtual' },
            { label: 'Quem é o assistente', desc: 'Descrição do personagem — origem, personalidade, missão.', value: cfgDescricao, set: setCfgDescricao, rows: 4, placeholder: 'Ex: Sou um assistente virtual da Prefeitura de Frutal, aqui para ajudar os cidadãos.' },
            { label: 'Tom de voz', desc: 'Como ele deve falar — regras de linguagem e estilo.', value: cfgTomVoz, set: setCfgTomVoz, rows: 5, placeholder: 'Ex: Seja amigável e breve. Não use emojis...' },
            { label: 'Responsabilidades', desc: 'O que ele pode e não pode fazer.', value: cfgResponsabilidades, set: setCfgResponsabilidades, rows: 4, placeholder: 'Ex: 1. Responder perguntas usando a base de conhecimento...' },
            { label: 'Instruções adicionais', desc: 'Qualquer regra extra que queira adicionar pontualmente.', value: cfgPromptExtra, set: setCfgPromptExtra, rows: 4, placeholder: 'Ex: Não responda sobre política. Se perguntarem sobre lixo, mencione o telefone...' },
          ].map(campo => (
            <div key={campo.label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{campo.label}</p>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{campo.desc}</p>
              </div>
              <textarea
                value={campo.value}
                onChange={e => campo.set(e.target.value)}
                rows={campo.rows}
                placeholder={campo.placeholder}
                style={{ border: '1px solid #e5e7eb', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
          ))}
          <button onClick={salvarConfig} disabled={salvandoConfig}
            style={{ alignSelf: 'flex-start', background: salvandoConfig ? '#6b7280' : '#4256c8', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 20px', fontSize: '13px', fontWeight: 600, cursor: salvandoConfig ? 'not-allowed' : 'pointer' }}>
            {salvandoConfig ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      )}

      {/* ── Sem resposta ── */}
      {aba === 'sem_resposta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Perguntas que o chatbot não soube responder. Use para identificar o que adicionar na base de conhecimento.</p>
          {semResposta.length === 0 && (
            <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
              Nenhuma pergunta sem resposta registrada.
            </div>
          )}
          {semResposta.map((r: any) => (
            <div key={r.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>"{r.pergunta}"</span>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <button onClick={() => excluirSemResposta(r.id)}
                  style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #e5e7eb', cursor: 'pointer', background: 'white', color: '#dc2626', flexShrink: 0 }}>
                  Excluir
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, background: '#f9fafb', borderRadius: '6px', padding: '8px 10px', lineHeight: 1.5 }}>
                <strong>Bot respondeu:</strong> {r.resposta_bot}
              </p>
            </div>
          ))}
        </div>
      )}
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
  if (!config) return <p style={{ color: '#6b7280', fontSize: '13px' }}>Carregando...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {notif && <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>{notif}</div>}

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <h2 style={{ fontWeight: 700, color: '#111827', fontSize: '15px', marginBottom: '20px' }}>Configurações da IA</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Análise automática ativa</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Quando desativada, demandas ficam pendentes para aprovação manual</p>
            </div>
            <button onClick={() => setConfig({ ...config, ativo: !config.ativo })}
              style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: config.ativo ? '#4256c8' : '#e5e7eb', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '2px', left: config.ativo ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block' }} />
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Nível de rigor</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['permissivo', 'moderado', 'rigoroso'].map(r => (
                <button key={r} onClick={() => setConfig({ ...config, rigor: r })}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1.5px solid', borderColor: config.rigor === r ? '#4256c8' : '#e5e7eb', background: config.rigor === r ? '#f9fafb' : 'white', color: config.rigor === r ? '#4256c8' : '#111827', fontSize: '13px', fontWeight: config.rigor === r ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {r}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '6px 0 0' }}>
              {config.rigor === 'permissivo' && 'Rejeita apenas conteúdo claramente ofensivo ou spam.'}
              {config.rigor === 'moderado' && 'Rejeita conteúdo ofensivo, político-partidário ou sem relação com serviços públicos.'}
              {config.rigor === 'rigoroso' && 'Rejeita demandas vagas, sem endereço ou que não sejam solicitações legítimas.'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Prompt de análise</label>
            <textarea value={config.prompt} onChange={(e) => setConfig({ ...config, prompt: e.target.value })} rows={6}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>

          <button onClick={salvar} disabled={salvando}
            style={{ backgroundColor: salvando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '8px', border: 'none', cursor: salvando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>

    </div>
  )
}

