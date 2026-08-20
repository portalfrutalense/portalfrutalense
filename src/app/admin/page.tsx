'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { Denuncia, Ocorrencia, Entidade, CategoriaMapa } from '@/types'
import { formatarCPF } from '@/lib/cpf'

type Aba = 'demandas' | 'denuncias' | 'ocorrencias' | 'entidades' | 'categorias' | 'ia'

const STATUS_LABEL: Record<string, { label: string; cor: string; fundo: string }> = {
  pendente:                       { label: 'Pendente',               cor: '#92400e', fundo: '#fef3c7' },
  aguardando_resposta:            { label: 'Aguardando resposta',    cor: '#1e40af', fundo: '#dbeafe' },
  aguardando_aprovacao_resposta:  { label: 'Aguard. aprovação',      cor: '#b45309', fundo: '#fff7ed' },
  respondida:                     { label: 'Respondida',             cor: '#166534', fundo: '#dcfce7' },
  rejeitada:                      { label: 'Rejeitada',              cor: '#6b7280', fundo: '#f3f4f6' },
  nao_respondida:                 { label: 'Não respondida',         cor: '#dc2626', fundo: '#fef2f2' },
  publicada:                      { label: 'Publicada',              cor: '#166534', fundo: '#dcfce7' },
}

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [carregandoAuth, setCarregandoAuth] = useState(true)
  const [aba, setAba] = useState<Aba>('denuncias')

  const [denuncias, setDenuncias] = useState<(Denuncia & { oculto?: boolean })[]>([])
  const [ocorrencias, setOcorrencias] = useState<(Ocorrencia & { oculto?: boolean })[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])

  const [filtroDen, setFiltroDen] = useState<string>('todos')
  const [filtroOco, setFiltroOco] = useState<string>('todos')

  const [novaEntNome, setNovaEntNome] = useState('')
  const [novaEntCargo, setNovaEntCargo] = useState('')
  const [novaEntEmail, setNovaEntEmail] = useState('')
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatCor, setNovaCatCor] = useState('#ef4444')
  const [notificacao, setNotificacao] = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  // Edição inline de entidade
  const [editandoEnt, setEditandoEnt] = useState<string | null>(null)
  const [editEntNome, setEditEntNome] = useState('')
  const [editEntCargo, setEditEntCargo] = useState('')
  const [editEntEmail, setEditEntEmail] = useState('')

  // Edição inline de denúncia
  const [editandoDen, setEditandoDen] = useState<string | null>(null)
  const [editDenMsg, setEditDenMsg] = useState('')

  // Edição inline de ocorrência
  const [editandoOco, setEditandoOco] = useState<string | null>(null)
  const [editOcoDesc, setEditOcoDesc] = useState('')
  const [editOcoNome, setEditOcoNome] = useState('')
  const [editOcoCatId, setEditOcoCatId] = useState('')
  const [editOcoLat, setEditOcoLat] = useState('')
  const [editOcoLng, setEditOcoLng] = useState('')
  const [editOcoEndereco, setEditOcoEndereco] = useState('')
  const [editOcoEnderecoLabel, setEditOcoEnderecoLabel] = useState('')
  const [buscandoEndereco, setBuscandoEndereco] = useState(false)
  const [enderecoReverso, setEnderecoReverso] = useState<Record<string, string>>({})

  const client = createClient()

  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      if (data.session) { setAutenticado(true); carregarDados() }
      setCarregandoAuth(false)
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session) { setAutenticado(true); carregarDados() } else { setAutenticado(false) }
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
    supabase.from('denuncias').select('*, entidade:entidades(*)').order('created_at', { ascending: false }).then(({ data }) => setDenuncias((data as (Denuncia & { oculto?: boolean })[]) || []))
    supabase.from('ocorrencias').select('*, categoria:categorias_mapa(*)').order('created_at', { ascending: false }).then(({ data }) => setOcorrencias((data as (Ocorrencia & { oculto?: boolean })[]) || []))
    supabase.from('entidades').select('*').order('nome').then(({ data }) => setEntidades((data as Entidade[]) || []))
    supabase.from('categorias_mapa').select('*').order('nome').then(({ data }) => setCategorias((data as CategoriaMapa[]) || []))
  }

  async function getToken() {
    const { data } = await client.auth.getSession()
    return data.session?.access_token || ''
  }

  async function aprovar(id: string, tipo: 'denuncia' | 'ocorrencia') {
    const res = await fetch('/api/admin/aprovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, tipo }),
    })
    const data = await res.json()
    if (tipo === 'denuncia') {
      if (data.emailErro) {
        setNotificacao(`Denúncia aprovada, mas erro no e-mail: ${data.emailErro}`)
      } else if (data.emailStatus) {
        setNotificacao(`Denúncia aprovada e e-mail enviado. (ID: ${data.emailStatus})`)
      } else {
        setNotificacao('Denúncia aprovada. Nenhum e-mail enviado (autoridade sem e-mail cadastrado).')
      }
      setTimeout(() => setNotificacao(''), 10000)
    }
    carregarDados()
  }

  async function reenviarLink(id: string) {
    const res = await fetch('/api/admin/reenviar-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (data.emailErro) {
      setNotificacao(`Erro ao reenviar: ${data.emailErro}`)
    } else {
      setNotificacao('Link reenviado com sucesso.')
    }
    setTimeout(() => setNotificacao(''), 8000)
    carregarDados()
  }

  async function aprovarResposta(id: string, acao: 'publicar' | 'recusar') {
    await fetch('/api/admin/aprovar-resposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, acao }),
    })
    setNotificacao(acao === 'publicar' ? 'Resposta publicada com sucesso.' : 'Resposta recusada. Autoridade pode enviar nova resposta.')
    setTimeout(() => setNotificacao(''), 5000)
    carregarDados()
  }

  async function rejeitar(id: string, tipo: 'denuncia' | 'ocorrencia') {
    await fetch('/api/admin/rejeitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, tipo }),
    })
    carregarDados()
  }

  async function excluir(id: string, tipo: 'denuncia' | 'ocorrencia') {
    if (!confirm('Tem certeza que deseja excluir permanentemente este registro?')) return
    await fetch('/api/admin/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, tipo }),
    })
    carregarDados()
  }

  async function toggleOculto(id: string, tipo: 'denuncia' | 'ocorrencia', ocultoAtual: boolean) {
    await fetch('/api/admin/ocultar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, tipo, oculto: !ocultoAtual }),
    })
    carregarDados()
  }

  async function salvarEdicaoDen(id: string) {
    await fetch('/api/admin/editar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, tipo: 'denuncia', campos: { mensagem: editDenMsg } }),
    })
    setEditandoDen(null)
    carregarDados()
  }

  async function buscarEnderecoAdmin() {
    if (!editOcoEndereco.trim()) return
    setBuscandoEndereco(true)
    try {
      const q = encodeURIComponent(editOcoEndereco + ', Frutal, MG, Brasil')
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
      const data = await res.json()
      if (data.length > 0) {
        setEditOcoLat(parseFloat(data[0].lat).toFixed(6))
        setEditOcoLng(parseFloat(data[0].lon).toFixed(6))
        setEditOcoEnderecoLabel(editOcoEndereco.trim())
      } else {
        alert('Endereço não encontrado. Tente ser mais específico.')
      }
    } catch { alert('Erro ao buscar endereço.') }
    finally { setBuscandoEndereco(false) }
  }

  async function geocodificarReverso(id: string, lat: number, lng: number) {
    setEnderecoReverso(prev => ({ ...prev, [id]: 'buscando...' }))
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      const data = await res.json()
      setEnderecoReverso(prev => ({ ...prev, [id]: data.display_name || 'Endereço não encontrado.' }))
    } catch {
      setEnderecoReverso(prev => ({ ...prev, [id]: 'Erro ao buscar endereço.' }))
    }
  }

  async function salvarEdicaoOco(id: string) {
    const campos: Record<string, unknown> = {
      descricao: editOcoDesc,
      morador_nome: editOcoNome,
      categoria_id: editOcoCatId,
    }
    if (editOcoEnderecoLabel) campos.endereco_label = editOcoEnderecoLabel
    const lat = parseFloat(editOcoLat)
    const lng = parseFloat(editOcoLng)
    if (!isNaN(lat)) campos.lat = lat
    if (!isNaN(lng)) campos.lng = lng
    await fetch('/api/admin/editar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
      body: JSON.stringify({ id, tipo: 'ocorrencia', campos }),
    })
    setEditandoOco(null)
    carregarDados()
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

  const denPendentes = denuncias.filter(d => d.status === 'pendente').length
  const ocoPendentes = ocorrencias.filter(o => o.status === 'pendente').length

  const denFiltradas = filtroDen === 'todos' ? denuncias : denuncias.filter(d => d.status === filtroDen)
  const ocoFiltradas = filtroOco === 'todos' ? ocorrencias : ocorrencias.filter(o => o.status === filtroOco)

  const abas: { key: Aba; label: string; badge?: number }[] = [
    { key: 'demandas',    label: 'Demandas' },
    { key: 'denuncias',   label: 'Denúncias',   badge: denPendentes },
    { key: 'ocorrencias', label: 'Ocorrências',  badge: ocoPendentes },
    { key: 'entidades',   label: 'Autoridades' },
    { key: 'categorias',  label: 'Categorias' },
    { key: 'ia',          label: '🤖 IA' },
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
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Painel Master</h1>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>Moderação e configuração do Portal Frutalense.</p>
      </div>

      {/* Notificação */}
      {notificacao && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {notificacao}
          <button onClick={() => setNotificacao('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
        {abas.map((a) => (
          <button key={a.key} onClick={() => setAba(a.key)}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 500, border: 'none', borderBottom: aba === a.key ? '2px solid #1e3a5f' : '2px solid transparent', background: 'none', cursor: 'pointer', color: aba === a.key ? '#1e3a5f' : '#6b7280', marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {a.label}
            {a.badge !== undefined && a.badge > 0 && (
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', background: '#fee2e2', color: '#dc2626' }}>
                {a.badge} novo{a.badge > 1 ? 's' : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === DENÚNCIAS === */}
      {aba === 'denuncias' && (
        <div>
          {/* Filtro */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Filtrar:</span>
            <select value={filtroDen} onChange={(e) => setFiltroDen(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', background: 'white', outline: 'none', color: '#111827' }}>
              {['todos', 'pendente', 'aguardando_resposta', 'respondida', 'nao_respondida', 'rejeitada'].map(f => (
                <option key={f} value={f}>
                  {f === 'todos' ? 'Todos' : STATUS_LABEL[f]?.label}
                  {' '}({f === 'todos' ? denuncias.length : denuncias.filter(d => d.status === f).length})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {denFiltradas.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '48px 0', fontSize: '14px' }}>Nenhuma denúncia encontrada.</p>
            ) : denFiltradas.map((d) => (
              <div key={d.id} style={{ background: 'white', borderRadius: '8px', border: d.oculto ? '1px dashed #d1d5db' : '1px solid #e5e7eb', padding: '18px 20px', opacity: d.oculto ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                      <p style={{ fontWeight: 600, color: '#111827', fontSize: '14px', margin: 0 }}>{d.morador_nome}</p>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 500, backgroundColor: STATUS_LABEL[d.status]?.fundo || '#f3f4f6', color: STATUS_LABEL[d.status]?.cor || '#6b7280' }}>
                        {STATUS_LABEL[d.status]?.label || d.status}
                      </span>
                      {d.oculto && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#f3f4f6', color: '#6b7280' }}>Oculta do público</span>}
                    </div>
                    <p style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace', margin: '2px 0' }}>{d.morador_cpf_display}</p>
                    {d.entidade && <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>Para: {d.entidade.nome} — {d.entidade.cargo}</p>}
                  </div>
                  <p style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
                </div>

                {editandoDen === d.id ? (
                  <div style={{ marginBottom: '12px' }}>
                    <textarea value={editDenMsg} onChange={(e) => setEditDenMsg(e.target.value)} rows={4}
                      style={{ width: '100%', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {btnAcao('Salvar edição', () => salvarEdicaoDen(d.id), 'primario')}
                      {btnAcao('Cancelar', () => setEditandoDen(null), 'neutro')}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '14px' }}>{d.mensagem}</p>
                )}


                {/* Resposta já publicada */}
                {d.status === 'respondida' && d.resposta && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 16px', marginBottom: '14px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Resposta publicada</p>
                    <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{d.resposta}</p>
                  </div>
                )}

                {/* Status do e-mail + reenviar */}
                {d.status === 'aguardando_resposta' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#166534' }}>
                      ✓ Link enviado
                      {(d as any).magic_token_expira_em && ` · expira em ${new Date((d as any).magic_token_expira_em).toLocaleDateString('pt-BR')}`}
                    </span>
                    <button onClick={() => reenviarLink(d.id)} style={{ marginLeft: 'auto', fontSize: '12px', color: '#1e40af', background: 'none', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '3px 10px', cursor: 'pointer', fontWeight: 500 }}>
                      Reenviar link
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {d.status === 'pendente' ? (
                    <>
                      {btnAcao('Aprovar e enviar link', () => aprovar(d.id, 'denuncia'), 'primario')}
                      {btnAcao('Excluir', () => excluir(d.id, 'denuncia'), 'perigo')}
                    </>
                  ) : (
                    <>
                      {editandoDen !== d.id && btnAcao('Editar', () => { setEditandoDen(d.id); setEditDenMsg(d.mensagem) }, 'neutro')}
                      {btnAcao(d.oculto ? 'Mostrar ao público' : 'Ocultar do público', () => toggleOculto(d.id, 'denuncia', !!d.oculto), 'aviso')}
                      {btnAcao('Excluir', () => excluir(d.id, 'denuncia'), 'perigo')}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === OCORRÊNCIAS === */}
      {aba === 'ocorrencias' && (
        <div>
          {/* Filtro */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Filtrar:</span>
            <select value={filtroOco} onChange={(e) => setFiltroOco(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', background: 'white', outline: 'none', color: '#111827' }}>
              {['todos', 'pendente', 'publicada', 'rejeitada'].map(f => (
                <option key={f} value={f}>
                  {f === 'todos' ? 'Todos' : STATUS_LABEL[f]?.label}
                  {' '}({f === 'todos' ? ocorrencias.length : ocorrencias.filter(o => o.status === f).length})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ocoFiltradas.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '48px 0', fontSize: '14px' }}>Nenhuma ocorrência encontrada.</p>
            ) : ocoFiltradas.map((o) => (
              <div key={o.id} style={{ background: 'white', borderRadius: '8px', border: o.oculto ? '1px dashed #d1d5db' : '1px solid #e5e7eb', padding: '18px 20px', opacity: o.oculto ? 0.7 : 1 }}>

                {/* Linha 1: Categoria + Status + Oculto + Data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {o.categoria && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: o.categoria.cor, display: 'inline-block', flexShrink: 0 }} />
                      {o.categoria.nome}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 500, backgroundColor: STATUS_LABEL[o.status]?.fundo || '#f3f4f6', color: STATUS_LABEL[o.status]?.cor || '#6b7280' }}>
                    {STATUS_LABEL[o.status]?.label || o.status}
                  </span>
                  {o.oculto && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#f3f4f6', color: '#6b7280' }}>Oculta do público</span>}
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
                </div>

                {/* Linha 2: Nome */}
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: '0 0 2px' }}>{o.morador_nome}</p>

                {/* Linha 3: CPF */}
                <p style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace', margin: '0 0 12px' }}>{formatarCPF(o.morador_cpf)}</p>

                {editandoOco === o.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="grid-2col">
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Nome do morador</label>
                        <input value={editOcoNome} onChange={(e) => setEditOcoNome(e.target.value)}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Categoria</label>
                        <select value={editOcoCatId} onChange={(e) => setEditOcoCatId(e.target.value)}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: 'white' }}>
                          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Descrição</label>
                      <textarea value={editOcoDesc} onChange={(e) => setEditOcoDesc(e.target.value)} rows={3}
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Endereço — buscar para atualizar coordenadas</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <input value={editOcoEndereco} onChange={(e) => { setEditOcoEndereco(e.target.value); setEditOcoEnderecoLabel('') }}
                          placeholder="Ex: Godofredo Magalhães Macedo, 18"
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarEnderecoAdmin() } }}
                          style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 10px', fontSize: '13px', outline: 'none' }} />
                        <button onClick={buscarEnderecoAdmin} disabled={buscandoEndereco}
                          style={{ backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          {buscandoEndereco ? '...' : 'Buscar'}
                        </button>
                      </div>
                      {editOcoEnderecoLabel && (
                        <p style={{ fontSize: '12px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '5px', padding: '6px 10px', margin: '0 0 8px' }}>
                          Coordenadas atualizadas para: {editOcoEnderecoLabel}
                        </p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} className="grid-2col">
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '3px' }}>Latitude</label>
                          <input value={editOcoLat} onChange={(e) => setEditOcoLat(e.target.value)}
                            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '3px' }}>Longitude</label>
                          <input value={editOcoLng} onChange={(e) => setEditOcoLng(e.target.value)}
                            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {btnAcao('Salvar edição', () => salvarEdicaoOco(o.id), 'primario')}
                      {btnAcao('Cancelar', () => setEditandoOco(null), 'neutro')}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Descrição */}
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 3px' }}>Descrição</p>
                    <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: '0 0 10px' }}>{o.descricao}</p>

                    {/* Foto */}
                    {o.foto_url && (
                      <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Foto</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={o.foto_url}
                          alt="Foto da ocorrência"
                          onClick={() => setFotoAmpliada(o.foto_url!)}
                          style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'zoom-in', display: 'block' }}
                        />
                      </div>
                    )}

                    {/* Endereço */}
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 3px' }}>Endereço</p>
                    <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {(() => {
                        const label = (o as Ocorrencia & { endereco_label?: string }).endereco_label || enderecoReverso[o.id]
                        if (label && label !== 'buscando...') return <span>{label}</span>
                        if (label === 'buscando...') return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>buscando...</span>
                        return (
                          <button onClick={() => geocodificarReverso(o.id, o.lat, o.lng)}
                            style={{ fontSize: '13px', color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '3px 10px', cursor: 'pointer' }}>
                            Buscar pelo GPS
                          </button>
                        )
                      })()}
                      <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' }}>{o.lat.toFixed(5)}, {o.lng.toFixed(5)}</span>
                      <a href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}&zoom=17`} target="_blank" rel="noreferrer"
                        style={{ fontSize: '12px', color: '#1e3a5f', textDecoration: 'underline' }}>
                        Ver no mapa
                      </a>
                    </p>
                  </>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {o.status === 'pendente' ? (
                    <>
                      {btnAcao('Publicar no mapa', () => aprovar(o.id, 'ocorrencia'), 'primario')}
                      {btnAcao('Excluir', () => excluir(o.id, 'ocorrencia'), 'perigo')}
                    </>
                  ) : (
                    <>
                      {editandoOco !== o.id && btnAcao('Editar', () => {
                        setEditandoOco(o.id)
                        setEditOcoDesc(o.descricao)
                        setEditOcoNome(o.morador_nome)
                        setEditOcoCatId(o.categoria_id)
                        setEditOcoLat(o.lat.toString())
                        setEditOcoLng(o.lng.toString())
                        setEditOcoEndereco('')
                        setEditOcoEnderecoLabel('')
                      }, 'neutro')}
                      {btnAcao(o.oculto ? 'Mostrar ao público' : 'Ocultar do público', () => toggleOculto(o.id, 'ocorrencia', !!o.oculto), 'aviso')}
                      {btnAcao('Excluir', () => excluir(o.id, 'ocorrencia'), 'perigo')}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === ENTIDADES === */}
      {aba === 'entidades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', marginBottom: '16px' }}>Nova Autoridade</h2>
            <form onSubmit={salvarEntidade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }} className="grid-3col">
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }} className="grid-3col">
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco na via)" required style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', outline: 'none' }} />
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

      {/* Lightbox de foto */}
      {fotoAmpliada && (
        <div
          onClick={() => setFotoAmpliada(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}
        >
          <button onClick={() => setFotoAmpliada(null)} style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAmpliada}
            alt="Foto ampliada"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '10px', display: 'block', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', cursor: 'default' }}
          />
        </div>
      )}

      {/* === DEMANDAS === */}
      {aba === 'demandas' && (
        <AdminDemandas senha={senha} />
      )}

      {/* === IA === */}
      {aba === 'ia' && (
        <AdminIA senha={senha} />
      )}
    </div>
  )
}

// ---- Sub-componente: Demandas ----
function AdminDemandas({ senha }: { senha: string }) {
  const [demandas, setDemandas] = useState<any[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [notif, setNotif] = useState('')

  useEffect(() => {
    supabase.from('demandas').select('*, categoria:categorias_mapa(*), entidade:entidades(*)').order('created_at', { ascending: false }).then(({ data }: any) => setDemandas(data || []))
  }, [])

  async function reenviarLink(id: string) {
    const res = await fetch('/api/admin/reenviar-link-demanda', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${senha}` }, body: JSON.stringify({ demanda_id: id }) })
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
function AdminIA({ senha }: { senha: string }) {
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
