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
  meta: { rotulo: string; valor: string }[]
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

  async function rodar(item: ItemLista, acao: Acao) {
    if (acao.confirmar && !confirm(acao.confirmar)) return
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
          {itens.map(item => (
            <div key={item.id} style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px',
              display: 'flex', gap: '13px', alignItems: 'flex-start',
              opacity: item.oculto ? 0.6 : 1,
            }}>
              {item.foto ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.foto} alt="" style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', flexShrink: 0 }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '3px' }}>
                  <strong style={{ fontSize: '14px', color: '#111827' }}>{item.titulo}</strong>
                  {item.etiquetas.map((e, i) => <Etiqueta key={i} {...e} />)}
                </div>

                {item.subtitulo && (
                  <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 7px', lineHeight: 1.5 }}>{item.subtitulo}</p>
                )}

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {item.meta.map((m, i) => (
                    <div key={i}>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>{m.rotulo}</p>
                      <p style={{ fontSize: '12.5px', color: '#111827', margin: 0 }}>{m.valor}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
                {item.acoes.map((a, i) => (
                  <button key={i} onClick={() => rodar(item, a)} disabled={ocupado === item.id}
                    style={{
                      fontSize: '12px', fontWeight: 500, color: a.cor,
                      background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px',
                      padding: '7px 13px', cursor: ocupado === item.id ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                    }}>
                    {a.rotulo}
                  </button>
                ))}
              </div>
            </div>
          ))}
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

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
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
    foto: p.foto_url,
    oculto: !!p.oculto,
    etiquetas: [
      p.reencontrado
        ? { texto: 'Reencontrado', cor: '#2563eb' }
        : p.tipo === 'perdido'
          ? { texto: 'Perdido', cor: '#dc2626' }
          : { texto: 'Achei na rua', cor: '#16a34a' },
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
      { rotulo: 'Publicado', valor: dataCurta(p.created_at) },
    ],
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
        { chave: 'achado', rotulo: 'Achei na rua' },
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
  carro: 'Carro', moto: 'Moto', caminhonete: 'Caminhonete', caminhao: 'Caminhão',
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
      { rotulo: 'Publicado', valor: dataCurta(c.created_at) },
    ],
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
      { rotulo: 'Publicada', valor: dataCurta(v.created_at) },
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
