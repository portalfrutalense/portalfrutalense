'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Pet, Classificado, Emprego } from '@/types'

/* ------------------------------------------------------------- shell --- */

type Acao = { rotulo: string; cor: string; executar: () => Promise<void>; confirmar?: string }

interface ItemLista {
  id: string
  titulo: string
  subtitulo?: string
  data: string               // ISO — exibida no header como data/hora
  meta: { rotulo: string; valor: string }[]
  /** Caixa "Análise IA" separada, abaixo da caixa cinza de meta. */
  destaque?: { rotulo: string; valor: string; cor?: string } | null
  foto?: string | null
  etiquetas: { texto: string; cor: string }[]
  oculto: boolean
  acoes: Acao[]
}

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
      background: '#f9fafb', color: cor, border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  )
}

function ListaModeracao({
  titulo, descricao, carregando, itens, vazio, filtros, filtroAtivo, setFiltro, notif,
}: {
  titulo?: string
  descricao?: string
  carregando: boolean
  itens: ItemLista[]
  vazio: string
  filtros: { chave: string; rotulo: string }[]
  filtroAtivo: string
  setFiltro: (f: string) => void
  notif: string
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [menuAberto, setMenuAberto] = useState<string | null>(null)

  function toggleExpandido(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function rodar(item: ItemLista, acao: Acao) {
    if (acao.confirmar && !confirm(acao.confirmar)) return
    setMenuAberto(null)
    setOcupado(item.id)
    await acao.executar()
    setOcupado(null)
  }

  return (
    <div>
      {(titulo || descricao) && (
        <div style={{ marginBottom: '24px' }}>
          {titulo && <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{titulo}</h1>}
          {descricao && <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{descricao}</p>}
        </div>
      )}

      {notif && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
          {notif}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {filtros.map(f => (
          <button key={f.chave} onClick={() => setFiltro(f.chave)} style={{
            padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12.5px',
            fontWeight: filtroAtivo === f.chave ? 600 : 500,
            background: filtroAtivo === f.chave ? '#4256c8' : 'white',
            color: filtroAtivo === f.chave ? 'white' : '#6b7280',
            border: `1px solid ${filtroAtivo === f.chave ? '#4256c8' : '#e5e7eb'}`,
          }}>
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <p style={{ fontSize: '13px', color: '#6b7280' }}>Carregando…</p>
      ) : itens.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{vazio}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {itens.map(item => {
            const expandido = expandidos.has(item.id)
            const menuEsteAberto = menuAberto === item.id
            const dataFormatada = new Date(item.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

            return (
              <div key={item.id} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
                overflow: 'hidden', position: 'relative', opacity: item.oculto ? 0.6 : 1,
              }}>
                {/* Linha-resumo — sempre visível, clicável para expandir/recolher */}
                <div
                  onClick={() => toggleExpandido(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 48px 12px 20px', cursor: 'pointer' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transform: expandido ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {item.etiquetas.map((e, i) => <Etiqueta key={i} {...e} />)}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {item.titulo}{item.subtitulo ? ` · ${item.subtitulo.slice(0, 60)}` : ''}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>{dataFormatada}</span>
                </div>

                {/* Botão "..." no canto superior direito */}
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10 }}>
                  <button
                    onClick={() => setMenuAberto(menuEsteAberto ? null : item.id)}
                    style={{ fontSize: '16px', fontWeight: 700, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1, borderRadius: '4px' }}
                  >···</button>
                  {menuEsteAberto && (
                    <>
                      <div onClick={() => setMenuAberto(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                      <div style={{ position: 'absolute', top: '28px', right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '160px', zIndex: 20, padding: '4px 0' }}>
                        {item.acoes.map((a, i) => (
                          <button key={i} onClick={() => rodar(item, a)} disabled={ocupado === item.id}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: a.cor, background: 'none', border: 'none', cursor: ocupado === item.id ? 'wait' : 'pointer' }}>
                            {a.rotulo}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Corpo do card — só aparece expandido */}
                {expandido && (
                  <div style={{ padding: '0 20px 16px', paddingRight: '48px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {/* Caixa cinza principal com todos os meta */}
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.meta.map((m, i) => (
                        <p key={i} style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                          {m.rotulo}: <strong style={{ color: '#111827' }}>{m.valor}</strong>
                        </p>
                      ))}
                      {item.foto && (
                        <a href={item.foto} target="_blank" rel="noreferrer"
                          style={{ fontSize: '12px', color: '#4256c8', textDecoration: 'underline', marginTop: '2px' }}>
                          Ver foto
                        </a>
                      )}
                    </div>

                    {/* Análise IA — caixa separada, igual ao de demanda */}
                    {item.destaque && (
                      <div style={{
                        fontSize: '12px',
                        color: item.destaque.cor ?? '#6b7280',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '7px 10px',
                        lineHeight: 1.5,
                      }}>
                        <strong>{item.destaque.rotulo}</strong> {item.destaque.valor}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------- utilitários --- */

function usarNotif() {
  const [notif, setNotif] = useState('')
  return {
    notif,
    avisar: (msg: string) => { setNotif(msg); setTimeout(() => setNotif(''), 4000) },
  }
}

function diasRestantes(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return d > 0 ? `${d}d` : 'expirado'
}

function moeda(v?: number | null) {
  if (v == null) return 'A combinar'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

/* ================================================================ pets = */

export function MasterPets() {
  const client = createClient()
  const [pets, setPets] = useState<Pet[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const { notif, avisar } = usarNotif()

  async function carregar() {
    setCarregando(true)
    const { data } = await client.from('pets').select('*').order('created_at', { ascending: false })
    setPets((data as Pet[]) || [])
    setCarregando(false)
  }
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = pets.filter(p => {
    if (filtro === 'todos') return true
    if (filtro === 'ocultos') return p.oculto
    if (filtro === 'reencontrado') return p.reencontrado
    if (filtro === 'pendente_ia') return p.ia_decisao === 'pendente'
    return p.tipo === filtro && !p.reencontrado
  })

  const itens: ItemLista[] = filtrados.map(p => ({
    id: p.id,
    titulo: p.nome_pet || (p.especie === 'gato' ? 'Gato' : 'Cachorro'),
    subtitulo: p.descricao,
    data: p.created_at,
    foto: p.foto_url,
    oculto: !!p.oculto,
    etiquetas: [
      p.reencontrado
        ? { texto: 'Reencontrado', cor: '#2563eb' }
        : p.tipo === 'perdido'
          ? { texto: 'Perdido', cor: '#dc2626' }
          : p.tipo === 'adocao'
            ? { texto: 'Adoção', cor: '#7c3aed' }
            : { texto: 'Achei um Pet', cor: '#16a34a' },
      ...(p.ia_decisao === 'pendente' ? [{ texto: '⏳ IA Pendente', cor: '#b45309' }] : []),
      ...(p.ia_decisao === 'aprovada' ? [{ texto: '✓ IA', cor: '#15803d' }] : []),
      ...(p.ia_decisao === 'rejeitada' ? [{ texto: '✕ IA Rejeitada', cor: '#dc2626' }] : []),
      ...(p.oculto ? [{ texto: 'Oculto', cor: '#92400e' }] : []),
    ],
    meta: [
      ...(p.protocolo ? [{ rotulo: 'Protocolo', valor: p.protocolo }] : []),
      { rotulo: 'Autor', valor: p.autor_nome },
      { rotulo: 'Contato', valor: p.contato },
      { rotulo: 'Local', valor: p.endereco_label || '—' },
    ],
    destaque: p.ia_motivo ? {
      rotulo: p.ia_decisao === 'rejeitada' ? 'Motivo IA:' : 'Análise IA:',
      valor: p.ia_motivo,
      cor: p.ia_decisao === 'rejeitada' ? '#dc2626' : '#6b7280',
    } : null,
    acoes: [
      {
        rotulo: p.oculto ? 'Reexibir' : 'Ocultar',
        cor: p.oculto ? '#166534' : '#92400e',
        executar: async () => {
          await client.from('pets').update({ oculto: !p.oculto }).eq('id', p.id)
          avisar(p.oculto ? 'Registro reexibido no mapa.' : 'Registro ocultado do mapa.')
          carregar()
        },
      },
      {
        rotulo: 'Excluir',
        cor: '#dc2626',
        confirmar: 'Excluir este registro permanentemente? Esta ação não pode ser desfeita.',
        executar: async () => {
          await client.from('pets').delete().eq('id', p.id)
          avisar('Registro excluído.')
          carregar()
        },
      },
    ],
  }))

  return (
    <ListaModeracao
      carregando={carregando}
      itens={itens}
      vazio="Nenhum registro nesse filtro."
      filtros={[
        { chave: 'todos', rotulo: 'Todos' },
        { chave: 'perdido', rotulo: 'Perdidos' },
        { chave: 'achado', rotulo: 'Achei um Pet' },
        { chave: 'adocao', rotulo: 'Adoção' },
        { chave: 'reencontrado', rotulo: 'Reencontrados' },
        { chave: 'pendente_ia', rotulo: '⏳ Pendente IA' },
        { chave: 'ocultos', rotulo: 'Ocultos' },
      ]}
      filtroAtivo={filtro}
      setFiltro={setFiltro}
      notif={notif}
    />
  )
}

/* ======================================================= classificados = */

const ROTULO_VEICULO: Record<string, string> = {
  carro: 'Carro', moto: 'Moto', onibus: 'Ônibus', caminhao: 'Caminhão',
}

export function MasterClassificados() {
  const client = createClient()
  const [itensBanco, setItensBanco] = useState<Classificado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const { notif, avisar } = usarNotif()

  async function carregar() {
    setCarregando(true)
    const { data } = await client.from('classificados').select('*').order('created_at', { ascending: false })
    setItensBanco((data as Classificado[]) || [])
    setCarregando(false)
  }
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = itensBanco.filter(c => {
    if (filtro === 'todos') return !c.vendido
    if (filtro === 'ocultos') return c.oculto
    if (filtro === 'vendidos') return c.vendido
    if (filtro === 'pendente_ia') return c.ia_decisao === 'pendente'
    return c.tipo_veiculo === filtro && !c.vendido
  })

  const itens: ItemLista[] = filtrados.map(c => ({
    id: c.id,
    titulo: c.titulo,
    subtitulo: c.descricao,
    data: c.created_at,
    foto: c.fotos?.[0] ?? null,
    oculto: !!c.oculto,
    etiquetas: [
      { texto: ROTULO_VEICULO[c.tipo_veiculo] || c.tipo_veiculo, cor: '#4256c8' },
      ...(c.ia_decisao === 'pendente' ? [{ texto: '⏳ IA Pendente', cor: '#b45309' }] : []),
      ...(c.ia_decisao === 'aprovada' ? [{ texto: '✓ IA', cor: '#15803d' }] : []),
      ...(c.ia_decisao === 'rejeitada' ? [{ texto: '✕ IA Rejeitada', cor: '#dc2626' }] : []),
      ...(c.vendido ? [{ texto: 'Vendido', cor: '#6b7280' }] : []),
      ...(c.oculto ? [{ texto: 'Oculto', cor: '#92400e' }] : []),
    ],
    meta: [
      ...(c.protocolo ? [{ rotulo: 'Protocolo', valor: c.protocolo }] : []),
      { rotulo: 'Preço', valor: moeda(c.preco) },
      { rotulo: 'Autor', valor: c.autor_nome },
      { rotulo: 'Contato', valor: c.contato },
      { rotulo: 'Região', valor: c.bairro_label || '—' },
    ],
    destaque: c.ia_motivo ? {
      rotulo: c.ia_decisao === 'rejeitada' ? 'Motivo IA:' : 'Análise IA:',
      valor: c.ia_motivo,
      cor: c.ia_decisao === 'rejeitada' ? '#dc2626' : '#6b7280',
    } : null,
    acoes: [
      {
        rotulo: c.oculto ? 'Reexibir' : 'Ocultar',
        cor: c.oculto ? '#166534' : '#92400e',
        executar: async () => {
          await client.from('classificados').update({ oculto: !c.oculto }).eq('id', c.id)
          avisar(c.oculto ? 'Anúncio reexibido no mapa.' : 'Anúncio ocultado do mapa.')
          carregar()
        },
      },
      {
        rotulo: 'Excluir',
        cor: '#dc2626',
        confirmar: 'Excluir este anúncio permanentemente? Esta ação não pode ser desfeita.',
        executar: async () => {
          await client.from('classificados').delete().eq('id', c.id)
          avisar('Anúncio excluído.')
          carregar()
        },
      },
    ],
  }))

  return (
    <ListaModeracao
      carregando={carregando}
      itens={itens}
      vazio="Nenhum anúncio nesse filtro."
      filtros={[
        { chave: 'todos', rotulo: 'Todos' },
        { chave: 'carro', rotulo: 'Carros' },
        { chave: 'moto', rotulo: 'Motos' },
        { chave: 'caminhonete', rotulo: 'Caminhonetes' },
        { chave: 'caminhao', rotulo: 'Caminhões' },
        { chave: 'pendente_ia', rotulo: '⏳ Pendente IA' },
        { chave: 'vendidos', rotulo: 'Vendidos' },
        { chave: 'ocultos', rotulo: 'Ocultos' },
      ]}
      filtroAtivo={filtro}
      setFiltro={setFiltro}
      notif={notif}
    />
  )
}

/* ============================================================ empregos = */

const ROTULO_CONTRATO: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', temporario: 'Temporário', estagio: 'Estágio', freelance: 'Freelance',
}

export function MasterEmpregos() {
  const client = createClient()
  const [vagas, setVagas] = useState<Emprego[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const { notif, avisar } = usarNotif()

  async function carregar() {
    setCarregando(true)
    const { data } = await client.from('empregos').select('*').order('created_at', { ascending: false })
    setVagas((data as Emprego[]) || [])
    setCarregando(false)
  }
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = vagas.filter(v => {
    if (filtro === 'todos') return !v.encerrada
    if (filtro === 'ocultos') return v.oculto
    if (filtro === 'encerradas') return v.encerrada
    return true
  })

  const itens: ItemLista[] = filtrados.map(v => ({
    id: v.id,
    titulo: v.cargo,
    subtitulo: v.descricao,
    data: v.created_at,
    foto: v.logo_url,
    oculto: !!v.oculto,
    etiquetas: [
      { texto: ROTULO_CONTRATO[v.contrato] || v.contrato, cor: '#0891b2' },
      ...(v.vagas > 1 ? [{ texto: `${v.vagas} vagas`, cor: '#6b7280' }] : []),
      ...(v.encerrada ? [{ texto: 'Encerrada', cor: '#6b7280' }] : []),
      ...(v.oculto ? [{ texto: 'Oculta', cor: '#92400e' }] : []),
    ],
    meta: [
      ...(v.protocolo ? [{ rotulo: 'Protocolo', valor: v.protocolo }] : []),
      { rotulo: 'Empresa', valor: v.empresa_nome },
      { rotulo: 'Salário', valor: v.salario_a_combinar ? 'A combinar' : moeda(v.salario) },
      { rotulo: 'Contato', valor: v.contato },
      { rotulo: 'Local', valor: v.endereco_label || '—' },
    ],
    acoes: [
      {
        rotulo: v.oculto ? 'Reexibir' : 'Ocultar',
        cor: v.oculto ? '#166534' : '#92400e',
        executar: async () => {
          await client.from('empregos').update({ oculto: !v.oculto }).eq('id', v.id)
          avisar(v.oculto ? 'Vaga reexibida no mapa.' : 'Vaga ocultada do mapa.')
          carregar()
        },
      },
      {
        rotulo: v.encerrada ? 'Reabrir' : 'Encerrar',
        cor: v.encerrada ? '#166534' : '#92400e',
        executar: async () => {
          await client.from('empregos').update({ encerrada: !v.encerrada }).eq('id', v.id)
          avisar(v.encerrada ? 'Vaga reaberta.' : 'Vaga encerrada.')
          carregar()
        },
      },
      {
        rotulo: 'Excluir',
        cor: '#dc2626',
        confirmar: 'Excluir esta vaga permanentemente? Esta ação não pode ser desfeita.',
        executar: async () => {
          await client.from('empregos').delete().eq('id', v.id)
          avisar('Vaga excluída.')
          carregar()
        },
      },
    ],
  }))

  return (
    <ListaModeracao
      carregando={carregando}
      itens={itens}
      vazio="Nenhuma vaga nesse filtro."
      filtros={[
        { chave: 'todos', rotulo: 'Todas' },
        { chave: 'encerradas', rotulo: 'Encerradas' },
        { chave: 'ocultos', rotulo: 'Ocultas' },
      ]}
      filtroAtivo={filtro}
      setFiltro={setFiltro}
      notif={notif}
    />
  )
}
