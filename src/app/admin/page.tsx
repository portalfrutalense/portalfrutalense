'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Denuncia, Ocorrencia, Entidade, CategoriaMapa } from '@/types'

type Aba = 'denuncias' | 'ocorrencias' | 'entidades' | 'categorias'

export default function AdminPage() {
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': senha },
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
        <div className="bg-white rounded-lg border border-gray-200 p-8 w-full max-w-sm">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Painel Master</h1>
          <p className="text-sm text-gray-500 mb-6">Acesso restrito ao administrador.</p>
          {erroLogin && <p className="text-red-600 text-sm mb-4">{erroLogin}</p>}
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="w-full bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded text-sm transition-colors">
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
      <div className="mb-6 border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900">Painel Master</h1>
        <p className="text-sm text-gray-500 mt-1">Moderação e configuração do Portal Frutalense.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {abas.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${aba === a.key
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {a.label}
            {a.count !== undefined && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${a.count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                {a.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Denuncias pendentes */}
      {aba === 'denuncias' && (
        <div className="space-y-4">
          {denuncias.length === 0 ? (
            <p className="text-gray-400 text-center py-16">Nenhuma denuncia pendente.</p>
          ) : denuncias.map((d) => (
            <div key={d.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{d.morador_nome}</p>
                  <p className="text-xs text-gray-400 font-mono">{d.morador_cpf_display}</p>
                  {d.entidade && <p className="text-xs text-gray-500 mt-1">Para: {d.entidade.nome} — {d.entidade.cargo}</p>}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap mb-4 leading-relaxed">{d.mensagem}</p>
              <div className="flex gap-2">
                <button onClick={() => aprovar(d.id, 'denuncia')} className="text-xs bg-blue-800 hover:bg-blue-900 text-white px-4 py-1.5 rounded font-medium transition-colors">
                  Aprovar e Enviar Link
                </button>
                <button onClick={() => rejeitar(d.id, 'denuncia')} className="text-xs bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 px-4 py-1.5 rounded font-medium transition-colors border border-gray-200">
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ocorrencias pendentes */}
      {aba === 'ocorrencias' && (
        <div className="space-y-4">
          {ocorrencias.length === 0 ? (
            <p className="text-gray-400 text-center py-16">Nenhuma ocorrencia pendente.</p>
          ) : ocorrencias.map((o) => (
            <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex justify-between items-start gap-4 mb-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{o.morador_nome}</p>
                  {o.categoria && (
                    <span className="inline-flex items-center gap-1.5 text-xs mt-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.categoria.cor }} />
                      {o.categoria.nome}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <p className="text-gray-700 text-sm mb-1">{o.descricao}</p>
              <p className="text-xs text-gray-400 font-mono mb-4">{o.lat.toFixed(5)}, {o.lng.toFixed(5)}</p>
              <div className="flex gap-2">
                <button onClick={() => aprovar(o.id, 'ocorrencia')} className="text-xs bg-blue-800 hover:bg-blue-900 text-white px-4 py-1.5 rounded font-medium transition-colors">
                  Publicar no Mapa
                </button>
                <button onClick={() => rejeitar(o.id, 'ocorrencia')} className="text-xs bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 px-4 py-1.5 rounded font-medium transition-colors border border-gray-200">
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entidades */}
      {aba === 'entidades' && (
        <div className="space-y-6">
          <form onSubmit={salvarEntidade} className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Nova Entidade</h2>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <input value={novaEntNome} onChange={(e) => setNovaEntNome(e.target.value)} placeholder="Nome" required className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={novaEntCargo} onChange={(e) => setNovaEntCargo(e.target.value)} placeholder="Cargo / Orgao" required className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="email" value={novaEntEmail} onChange={(e) => setNovaEntEmail(e.target.value)} placeholder="E-mail" required className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" className="bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded text-sm transition-colors">
              Salvar
            </button>
          </form>

          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {entidades.length === 0 && <p className="text-gray-400 text-sm p-5">Nenhuma entidade cadastrada.</p>}
            {entidades.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{e.nome}</p>
                  <p className="text-xs text-gray-500">{e.cargo} · {e.email}</p>
                </div>
                <button onClick={() => excluirEntidade(e.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categorias */}
      {aba === 'categorias' && (
        <div className="space-y-6">
          <form onSubmit={salvarCategoria} className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Nova Categoria</h2>
            <div className="flex gap-3 items-end mb-3">
              <div className="flex-1">
                <input value={novaCatNome} onChange={(e) => setNovaCatNome(e.target.value)} placeholder="Nome da categoria (ex: Buraco na Via)" required className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cor</label>
                <input type="color" value={novaCatCor} onChange={(e) => setNovaCatCor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
              </div>
            </div>
            <button type="submit" className="bg-blue-800 hover:bg-blue-900 text-white font-semibold px-4 py-2 rounded text-sm transition-colors">
              Salvar
            </button>
          </form>

          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {categorias.length === 0 && <p className="text-gray-400 text-sm p-5">Nenhuma categoria cadastrada.</p>}
            {categorias.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.cor }} />
                  <p className="font-medium text-gray-800 text-sm">{c.nome}</p>
                  <span className="text-xs text-gray-400 font-mono">{c.cor}</span>
                </div>
                <button onClick={() => excluirCategoria(c.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
