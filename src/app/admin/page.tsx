'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Denuncia, Ocorrencia, Entidade, CategoriaMapa } from '@/types'
import { CheckCircle, XCircle, Building2, MapPin, Plus, Trash2, LogIn } from 'lucide-react'

type Aba = 'denuncias' | 'ocorrencias' | 'entidades' | 'categorias'

export default function AdminPage() {
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [aba, setAba] = useState<Aba>('denuncias')

  // Dados
  const [denuncias, setDenuncias] = useState<Denuncia[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [categorias, setCategorias] = useState<CategoriaMapa[]>([])

  // Form entidades
  const [novaEntNome, setNovaEntNome] = useState('')
  const [novaEntCargo, setNovaEntCargo] = useState('')
  const [novaEntEmail, setNovaEntEmail] = useState('')

  // Form categorias
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatCor, setNovaCatCor] = useState('#ef4444')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    // Validação simples via API
    const res = await fetch('/api/admin/aprovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': senha },
      body: JSON.stringify({ id: 'test', tipo: 'teste' }),
    })
    if (res.status === 401) {
      setErroLogin('Senha incorreta.')
    } else {
      setAutenticado(true)
      carregarDados()
    }
  }

  function carregarDados() {
    supabase.from('denuncias').select('*, entidade:entidades(*)').eq('status', 'pendente').order('created_at').then(({ data }) => setDenuncias(data as Denuncia[] || []))
    supabase.from('ocorrencias').select('*, categoria:categorias_mapa(*)').eq('status', 'pendente').order('created_at').then(({ data }) => setOcorrencias(data as Ocorrencia[] || []))
    supabase.from('entidades').select('*').order('nome').then(({ data }) => setEntidades(data as Entidade[] || []))
    supabase.from('categorias_mapa').select('*').order('nome').then(({ data }) => setCategorias(data as CategoriaMapa[] || []))
  }

  async function aprovar(id: string, tipo: 'denuncia' | 'ocorrencia') {
    await fetch('/api/admin/aprovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': senha },
      body: JSON.stringify({ id, tipo }),
    })
    carregarDados()
  }

  async function rejeitar(id: string, tipo: 'denuncia' | 'ocorrencia') {
    await fetch('/api/admin/rejeitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': senha },
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

  if (!autenticado) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">🔐 Painel Master</h1>
          {erroLogin && <p className="text-red-600 text-sm mb-4 text-center">{erroLogin}</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha de administrador"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button type="submit" className="flex items-center gap-2 justify-center w-full bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm">
              <LogIn size={16} /> Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  const abas: { key: Aba; label: string }[] = [
    { key: 'denuncias', label: `📢 Denúncias (${denuncias.length})` },
    { key: 'ocorrencias', label: `🗺️ Ocorrências (${ocorrencias.length})` },
    { key: 'entidades', label: '👤 Entidades' },
    { key: 'categorias', label: '🏷️ Categorias' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Painel Master</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {abas.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === a.key ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Fila de Denúncias */}
      {aba === 'denuncias' && (
        <div className="space-y-4">
          {denuncias.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Nenhuma denúncia pendente. 🎉</p>
          ) : denuncias.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{d.morador_nome} <span className="text-gray-400 font-mono text-xs">· {d.morador_cpf_display}</span></p>
                  {d.entidade && <p className="text-sm text-gray-500">Para: {d.entidade.nome} · {d.entidade.cargo}</p>}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap mb-4">{d.mensagem}</p>
              <div className="flex gap-2">
                <button onClick={() => aprovar(d.id, 'denuncia')} className="flex items-center gap-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <CheckCircle size={14} /> Aprovar & Enviar Link
                </button>
                <button onClick={() => rejeitar(d.id, 'denuncia')} className="flex items-center gap-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <XCircle size={14} /> Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fila de Ocorrências */}
      {aba === 'ocorrencias' && (
        <div className="space-y-4">
          {ocorrencias.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Nenhuma ocorrência pendente. 🎉</p>
          ) : ocorrencias.map((o) => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex justify-between items-start gap-4 mb-2">
                <div>
                  <p className="font-semibold text-gray-800">{o.morador_nome}</p>
                  {o.categoria && (
                    <span className="inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: o.categoria.cor + '22', color: o.categoria.cor }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.categoria.cor }} />
                      {o.categoria.nome}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-gray-700 text-sm mb-1">{o.descricao}</p>
              <p className="text-xs text-gray-400 mb-3">📍 {o.lat.toFixed(5)}, {o.lng.toFixed(5)}</p>
              <div className="flex gap-2">
                <button onClick={() => aprovar(o.id, 'ocorrencia')} className="flex items-center gap-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <CheckCircle size={14} /> Publicar no Mapa
                </button>
                <button onClick={() => rejeitar(o.id, 'ocorrencia')} className="flex items-center gap-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded-lg font-medium transition-colors">
                  <XCircle size={14} /> Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gestão de Entidades */}
      {aba === 'entidades' && (
        <div className="space-y-4">
          <form onSubmit={salvarEntidade} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">➕ Nova Entidade</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input value={novaEntNome} onChange={(e) => setNovaEntNome(e.target.value)} placeholder="Nome" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input value={novaEntCargo} onChange={(e) => setNovaEntCargo(e.target.value)} placeholder="Cargo / Órgão" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input type="email" value={novaEntEmail} onChange={(e) => setNovaEntEmail(e.target.value)} placeholder="E-mail" required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button type="submit" className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Salvar Entidade
            </button>
          </form>

          <div className="space-y-2">
            {entidades.map((e) => (
              <div key={e.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{e.nome}</p>
                  <p className="text-xs text-gray-500">{e.cargo} · {e.email}</p>
                </div>
                <button onClick={() => excluirEntidade(e.id)} className="text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestão de Categorias */}
      {aba === 'categorias' && (
        <div className="space-y-4">
          <form onSubmit={salvarCategoria} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">➕ Nova Categoria</h2>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco)" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cor do pin</label>
                <input type="color" value={novaCatCor} onChange={(e) => setNovaCatCor(e.target.value)} className="w-12 h-10 rounded cursor-pointer border border-gray-300" />
              </div>
            </div>
            <button type="submit" className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              <Plus size={14} /> Salvar Categoria
            </button>
          </form>

          <div className="space-y-2">
            {categorias.map((c) => (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: c.cor }} />
                  <p className="font-medium text-gray-800 text-sm">{c.nome}</p>
                  <span className="text-xs text-gray-400 font-mono">{c.cor}</span>
                </div>
                <button onClick={() => excluirCategoria(c.id)} className="text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
