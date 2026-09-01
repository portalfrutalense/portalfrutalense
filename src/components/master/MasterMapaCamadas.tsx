'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Pet, Classificado, Emprego } from '@/types'

/**
 * BUG CORRIGIDO: este painel tratava só `ia_decisao == null` como "ainda não
 * analisado" — mas existem DUAS convenções reais no banco pra isso. O
 * gatilho `forcar_pet/classificado_pendente_ao_criar` (supabase/
 * fix_bloco14_2026-08-30.sql) grava NULL, só quando o insert NÃO vem do
 * backend; `POST /api/camadas` (o caminho normal de criação, que roda com
 * service_role) grava a STRING 'pendente'. Como o gatilho só age fora do
 * service_role, um registro criado pelo site normalmente sempre chega aqui
 * com a string, nunca com NULL — e caía no "senão" dos três lugares abaixo
 * que só olhavam pra 'aprovada'/'rejeitada', mostrando "Rejeitada pela IA"
 * pra pets e classificados que a IA nunca analisou. `!ia_decisao` continua
 * coberto (o outro caminho legítimo), só passa a reconhecer os dois.
 */
function estaPendenteDeIA(iaDecisao: string | null | undefined): boolean {
  return !iaDecisao || iaDecisao === 'pendente'
}

/**
 * Moderação (oculto/encerrada) passa pela API com service_role, não mais
 * direto pelo cliente — RLS restringe o autor a colunas de conteúdo, então
 * só o backend pode mexer nessas flags agora. Ver src/app/api/master/camada.
 */
// BUG CORRIGIDO: as duas funções abaixo descartavam a resposta do fetch —
// nenhum `res.ok`. Toda ação de moderação de pet/classificado/vaga que
// falhasse (401, 500) recarregava a lista sem mudança nenhuma, sem
// nenhuma mensagem — o master não tinha como saber que a ação não
// aconteceu. Agora devolvem se deu certo, e quem chama mostra o aviso certo.
async function moderarCamada(
  client: ReturnType<typeof createClient>,
  camada: 'pets' | 'classificados' | 'empregos',
  id: string,
  campos: Record<string, unknown>
): Promise<boolean> {
  const { data: { session } } = await client.auth.getSession()
  const res = await fetch('/api/master/camada', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ camada, id, campos }),
  })
  return res.ok
}

/**
 * Exclusão também vai pela API com service_role — antes ia direto do cliente
 * (client.from(camada).delete()), o que também nunca limpava a foto no
 * Storage. Ver src/app/api/master/camada.
 */
async function excluirCamada(
  client: ReturnType<typeof createClient>,
  camada: 'pets' | 'classificados' | 'empregos',
  id: string
): Promise<boolean> {
  const { data: { session } } = await client.auth.getSession()
  const res = await fetch('/api/master/camada', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ camada, id }),
  })
  return res.ok
}

/* ------------------------------------------------------------- shell --- */

type Acao = { rotulo: string; cor: string; executar: () => Promise<void>; confirmar?: string }

interface ItemLista {
  id: string
  titulo: string
  subtitulo?: string
  data: string               // ISO — exibida no header como data/hora
  meta: { rotulo: string; valor: string }[]
  /** Caixa "Análise IA" separada, abaixo da caixa cinza de meta. Sempre presente. */
  destaque: { rotulo: string; valor: string; cor?: string }
  foto?: string | null       // foto única (pets, empregos)
  fotos?: string[]           // múltiplas fotos (classificados)
  etiquetas: { texto: string; cor: string }[]
  oculto: boolean
  acoes: Acao[]
}

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
      background: '#f9fafb', color: cor, whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  )
}

function ListaModeracao({
  titulo, descricao, carregando, itens, vazio, filtros, filtroAtivo, setFiltro, notif, notifErro,
}: {
  titulo?: string
  descricao?: string
  carregando: boolean
  itens: ItemLista[]
  vazio: string
  filtros: { chave: string; rotulo: string; contagem?: number }[]
  filtroAtivo: string
  setFiltro: (f: string) => void
  notif: string
  notifErro?: boolean
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [menuAberto, setMenuAberto] = useState<string | null>(null)

  function toggleExpandido(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
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
        <div style={notifErro
          ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }
          : { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
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
            {f.rotulo}{f.contagem != null ? ` (${f.contagem})` : ''}
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
                position: 'relative', opacity: item.oculto ? 0.6 : 1,
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
                          {m.rotulo}:{' '}
                          <strong style={{ color: '#111827', fontFamily: m.rotulo === 'Protocolo' ? 'monospace' : undefined }}>
                            {m.valor}
                          </strong>
                        </p>
                      ))}
                      {item.foto && (
                        <a href={item.foto} target="_blank" rel="noreferrer"
                          style={{ fontSize: '12px', color: '#4256c8', textDecoration: 'underline', marginTop: '2px' }}>
                          Ver foto
                        </a>
                      )}
                      {item.fotos && item.fotos.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {item.fotos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer"
                              style={{ fontSize: '12px', color: '#4256c8', textDecoration: 'underline' }}>
                              Ver foto {item.fotos!.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Análise IA — sempre presente */}
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

function useNotif() {
  const [notif, setNotif] = useState('')
  const [notifErro, setNotifErro] = useState(false)
  return {
    notif,
    notifErro,
    avisar: (msg: string, erro = false) => { setNotif(msg); setNotifErro(erro); setTimeout(() => setNotif(''), 4000) },
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
  const { notif, notifErro, avisar } = useNotif()

  async function carregar() {
    setCarregando(true)
    const { data } = await client.from('pets').select('*').order('created_at', { ascending: false })
    setPets((data as Pet[]) || [])
    setCarregando(false)
  }
  useEffect(() => {
    client.from('pets').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setPets((data as Pet[]) || []); setCarregando(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = pets.filter(p => {
    if (filtro === 'todos') return true
    if (filtro === 'ocultos') return p.oculto
    if (filtro === 'reencontrado') return p.reencontrado
    if (filtro === 'pendente_ia') return estaPendenteDeIA(p.ia_decisao)
    return p.tipo === filtro && !p.reencontrado
  })

  const ROTULO_TIPO: Record<string, string> = {
    perdido: 'Perdido', achado: 'Achei um Pet', adocao: 'Adoção',
  }
  const ROTULO_ESPECIE: Record<string, string> = { cachorro: 'Cachorro', gato: 'Gato' }
  const ROTULO_PORTE: Record<string, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' }

  const itens: ItemLista[] = filtrados.map(p => ({
    id: p.id,
    titulo: p.autor_nome,
    subtitulo: undefined,
    data: p.created_at,
    foto: p.foto_url,
    oculto: !!p.oculto,
    etiquetas: [
      p.reencontrado
        ? { texto: 'Reencontrado',  cor: '#4256c8' }
        : p.tipo === 'perdido'
          ? { texto: 'Perdido',     cor: '#dc2626' }
          : p.tipo === 'adocao'
            ? { texto: 'Adoção',    cor: '#7c3aed' }
            : { texto: 'Achei um Pet', cor: '#166534' },
      ...(estaPendenteDeIA(p.ia_decisao) ? [{ texto: 'Pendente IA',      cor: '#92400e' }] : []),
      ...(p.ia_decisao === 'aprovada'  ? [{ texto: 'Aprovada',          cor: '#166534' }] : []),
      ...(p.ia_decisao === 'rejeitada' ? [{ texto: 'Rejeitada pela IA', cor: '#dc2626' }] : []),
      ...(p.oculto                     ? [{ texto: 'Oculto',            cor: '#6b7280' }] : []),
    ],
    meta: [
      ...(p.protocolo      ? [{ rotulo: 'Protocolo',  valor: p.protocolo }] : []),
      { rotulo: 'Autor',     valor: p.autor_nome },
      { rotulo: 'Tipo',      valor: p.reencontrado ? 'Reencontrado' : (ROTULO_TIPO[p.tipo] || p.tipo) },
      { rotulo: 'Espécie',   valor: ROTULO_ESPECIE[p.especie] || p.especie },
      ...(p.nome_pet  ? [{ rotulo: 'Nome do pet', valor: p.nome_pet }] : []),
      ...(p.raca      ? [{ rotulo: 'Raça',         valor: p.raca }] : []),
      ...(p.cor       ? [{ rotulo: 'Cor',           valor: p.cor }] : []),
      ...(p.porte     ? [{ rotulo: 'Porte',         valor: ROTULO_PORTE[p.porte] || p.porte }] : []),
      { rotulo: 'Descrição', valor: p.descricao },
      { rotulo: 'Local',     valor: p.endereco_label || '—' },
      { rotulo: 'Contato',   valor: p.contato || '—' },
      { rotulo: 'Expira em', valor: diasRestantes(p.expira_em) },
    ],
    destaque: {
      rotulo: p.ia_decisao === 'rejeitada' ? 'Motivo IA:' : 'Análise IA:',
      valor: estaPendenteDeIA(p.ia_decisao)
        ? 'Aguardando análise automática'
        : p.ia_decisao === 'aprovada'
          ? (p.ia_motivo || 'Aprovada')
          : (p.ia_motivo || 'Rejeitada'),
      cor: estaPendenteDeIA(p.ia_decisao) ? '#b45309' : p.ia_decisao === 'rejeitada' ? '#dc2626' : '#6b7280',
    },
    acoes: [
      // Só aparece se ainda não estiver aprovada — cobre tanto "pendente"
      // (IA nunca analisou, ex: desativada no momento do cadastro) quanto
      // "rejeitada" (IA analisou e recusou, mas o master discorda). Sem
      // isso, um registro rejeitado não tinha como voltar a aparecer no
      // mapa: "Reexibir" só mexe em `oculto`, e o mapa público exige
      // `oculto = false` E `ia_decisao = 'aprovada'` juntos.
      ...(p.ia_decisao !== 'aprovada' ? [{
        rotulo: 'Aprovar',
        cor: '#166534',
        executar: async () => {
          const ok = await moderarCamada(client, 'pets', p.id, {
            oculto: false,
            ia_decisao: 'aprovada',
            ia_motivo: 'Aprovada manualmente pelo administrador.',
            ia_analisado_em: new Date().toISOString(),
          })
          avisar(ok ? 'Registro aprovado.' : 'Não foi possível aprovar. Tente novamente.', !ok)
          carregar()
        },
      }] : []),
      {
        rotulo: p.oculto ? 'Reexibir' : 'Ocultar',
        cor: p.oculto ? '#166534' : '#92400e',
        executar: async () => {
          const ok = await moderarCamada(client, 'pets', p.id, { oculto: !p.oculto })
          avisar(ok ? (p.oculto ? 'Registro reexibido no mapa.' : 'Registro ocultado do mapa.') : 'Não foi possível concluir a ação. Tente novamente.', !ok)
          carregar()
        },
      },
      {
        rotulo: 'Excluir',
        cor: '#dc2626',
        confirmar: 'Excluir este registro permanentemente? Esta ação não pode ser desfeita.',
        executar: async () => {
          const ok = await excluirCamada(client, 'pets', p.id)
          avisar(ok ? 'Registro excluído.' : 'Não foi possível excluir. Tente novamente.', !ok)
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
        { chave: 'todos',       rotulo: 'Todos',         contagem: pets.length },
        { chave: 'perdido',     rotulo: 'Perdidos',      contagem: pets.filter(p => p.tipo === 'perdido' && !p.reencontrado).length },
        { chave: 'achado',      rotulo: 'Abandonados',   contagem: pets.filter(p => p.tipo === 'achado').length },
        { chave: 'adocao',      rotulo: 'Adoção',        contagem: pets.filter(p => p.tipo === 'adocao').length },
        { chave: 'reencontrado',rotulo: 'Reencontrados', contagem: pets.filter(p => p.reencontrado).length },
        { chave: 'pendente_ia', rotulo: 'Pendente IA',   contagem: pets.filter(p => estaPendenteDeIA(p.ia_decisao)).length },
        { chave: 'ocultos',     rotulo: 'Ocultos',       contagem: pets.filter(p => p.oculto).length },
      ]}
      filtroAtivo={filtro}
      setFiltro={setFiltro}
      notif={notif}
      notifErro={notifErro}
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
  const { notif, notifErro, avisar } = useNotif()

  async function carregar() {
    setCarregando(true)
    const { data } = await client.from('classificados').select('*').order('created_at', { ascending: false })
    setItensBanco((data as Classificado[]) || [])
    setCarregando(false)
  }
  useEffect(() => {
    client.from('classificados').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setItensBanco((data as Classificado[]) || []); setCarregando(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = itensBanco.filter(c => {
    if (filtro === 'todos') return true
    if (filtro === 'ocultos') return c.oculto
    if (filtro === 'vendidos') return c.vendido
    if (filtro === 'pendente_ia') return estaPendenteDeIA(c.ia_decisao)
    return c.tipo_veiculo === filtro
  })

  const itens: ItemLista[] = filtrados.map(c => ({
    id: c.id,
    titulo: c.autor_nome,
    subtitulo: undefined,
    data: c.created_at,
    foto: null,
    fotos: c.fotos ?? [],
    oculto: !!c.oculto,
    etiquetas: [
      { texto: ROTULO_VEICULO[c.tipo_veiculo] || c.tipo_veiculo, cor: '#4256c8' },
      ...(estaPendenteDeIA(c.ia_decisao)       ? [{ texto: 'Pendente IA',      cor: '#92400e' }] : []),
      ...(c.ia_decisao === 'aprovada'         ? [{ texto: 'Aprovada',          cor: '#166534' }] : []),
      ...(c.ia_decisao === 'rejeitada'        ? [{ texto: 'Rejeitada pela IA', cor: '#dc2626' }] : []),
      ...(c.vendido                           ? [{ texto: 'Vendido',           cor: '#6b7280' }] : []),
      ...(c.oculto                            ? [{ texto: 'Oculto',            cor: '#6b7280' }] : []),
    ],
    meta: [
      ...(c.protocolo   ? [{ rotulo: 'Protocolo',        valor: c.protocolo }] : []),
      { rotulo: 'Autor',             valor: c.autor_nome },
      { rotulo: 'Tipo de veículo',   valor: ROTULO_VEICULO[c.tipo_veiculo] || c.tipo_veiculo },
      ...(c.marca       ? [{ rotulo: 'Marca',             valor: c.marca }] : []),
      ...(c.modelo      ? [{ rotulo: 'Modelo',            valor: c.modelo }] : []),
      ...(c.ano         ? [{ rotulo: 'Ano',               valor: String(c.ano) }] : []),
      ...(c.km != null  ? [{ rotulo: 'Quilometragem',     valor: `${c.km.toLocaleString('pt-BR')} km` }] : []),
      ...(c.cor         ? [{ rotulo: 'Cor',               valor: c.cor }] : []),
      { rotulo: 'Preço',             valor: moeda(c.preco) },
      { rotulo: 'Aceita troca',      valor: c.aceita_troca ? 'Sim' : 'Não' },
      { rotulo: 'Título do anúncio', valor: c.titulo },
      { rotulo: 'Descrição',         valor: c.descricao },
      { rotulo: 'Região aproximada', valor: c.bairro_label || '—' },
      { rotulo: 'Contato',           valor: c.contato },
    ],
    destaque: {
      rotulo: c.ia_decisao === 'rejeitada' ? 'Motivo IA:' : 'Análise IA:',
      valor: estaPendenteDeIA(c.ia_decisao)
        ? 'Aguardando análise automática'
        : c.ia_decisao === 'aprovada'
          ? (c.ia_motivo || 'Aprovada')
          : (c.ia_motivo || 'Rejeitada'),
      cor: estaPendenteDeIA(c.ia_decisao) ? '#b45309' : c.ia_decisao === 'rejeitada' ? '#dc2626' : '#6b7280',
    },
    acoes: [
      ...(c.ia_decisao !== 'aprovada' ? [{
        rotulo: 'Aprovar',
        cor: '#166534',
        executar: async () => {
          const ok = await moderarCamada(client, 'classificados', c.id, {
            oculto: false,
            ia_decisao: 'aprovada',
            ia_motivo: 'Aprovada manualmente pelo administrador.',
            ia_analisado_em: new Date().toISOString(),
          })
          avisar(ok ? 'Anúncio aprovado.' : 'Não foi possível aprovar. Tente novamente.', !ok)
          carregar()
        },
      }] : []),
      {
        rotulo: c.oculto ? 'Reexibir' : 'Ocultar',
        cor: c.oculto ? '#166534' : '#92400e',
        executar: async () => {
          const ok = await moderarCamada(client, 'classificados', c.id, { oculto: !c.oculto })
          avisar(ok ? (c.oculto ? 'Anúncio reexibido no mapa.' : 'Anúncio ocultado do mapa.') : 'Não foi possível concluir a ação. Tente novamente.', !ok)
          carregar()
        },
      },
      {
        rotulo: 'Excluir',
        cor: '#dc2626',
        confirmar: 'Excluir este anúncio permanentemente? Esta ação não pode ser desfeita.',
        executar: async () => {
          const ok = await excluirCamada(client, 'classificados', c.id)
          avisar(ok ? 'Anúncio excluído.' : 'Não foi possível excluir. Tente novamente.', !ok)
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
        { chave: 'todos',       rotulo: 'Todos',       contagem: itensBanco.length },
        { chave: 'pendente_ia', rotulo: 'Pendente IA', contagem: itensBanco.filter(c => estaPendenteDeIA(c.ia_decisao)).length },
        { chave: 'carro',       rotulo: 'Carros',      contagem: itensBanco.filter(c => c.tipo_veiculo === 'carro').length },
        { chave: 'moto',        rotulo: 'Motos',       contagem: itensBanco.filter(c => c.tipo_veiculo === 'moto').length },
        { chave: 'onibus',      rotulo: 'Ônibus',      contagem: itensBanco.filter(c => c.tipo_veiculo === 'onibus').length },
        { chave: 'caminhao',    rotulo: 'Caminhões',   contagem: itensBanco.filter(c => c.tipo_veiculo === 'caminhao').length },
        { chave: 'vendidos',    rotulo: 'Vendidos',    contagem: itensBanco.filter(c => c.vendido).length },
        { chave: 'ocultos',     rotulo: 'Ocultos',     contagem: itensBanco.filter(c => !!c.oculto).length },
      ]}
      filtroAtivo={filtro}
      setFiltro={setFiltro}
      notif={notif}
      notifErro={notifErro}
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
  const { notif, notifErro, avisar } = useNotif()

  async function carregar() {
    setCarregando(true)
    const { data } = await client.from('empregos').select('*').order('created_at', { ascending: false })
    setVagas((data as Emprego[]) || [])
    setCarregando(false)
  }
  useEffect(() => {
    client.from('empregos').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setVagas((data as Emprego[]) || []); setCarregando(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = vagas.filter(v => {
    // BUG CORRIGIDO: "Todas" aplicava `!v.encerrada`, escondendo justo as
    // vagas encerradas — já existe um filtro "Encerradas" separado pra
    // isso; "Todas" deveria mostrar literalmente todas, igual pets/classificados.
    if (filtro === 'todos') return true
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
    destaque: { rotulo: 'Análise IA:', valor: 'Empregos não passam por moderação automática.', cor: '#6b7280' },
    acoes: [
      {
        rotulo: v.oculto ? 'Reexibir' : 'Ocultar',
        cor: v.oculto ? '#166534' : '#92400e',
        executar: async () => {
          const ok = await moderarCamada(client, 'empregos', v.id, { oculto: !v.oculto })
          avisar(ok ? (v.oculto ? 'Vaga reexibida no mapa.' : 'Vaga ocultada do mapa.') : 'Não foi possível concluir a ação. Tente novamente.', !ok)
          carregar()
        },
      },
      {
        rotulo: v.encerrada ? 'Reabrir' : 'Encerrar',
        cor: v.encerrada ? '#166534' : '#92400e',
        executar: async () => {
          const ok = await moderarCamada(client, 'empregos', v.id, { encerrada: !v.encerrada })
          avisar(ok ? (v.encerrada ? 'Vaga reaberta.' : 'Vaga encerrada.') : 'Não foi possível concluir a ação. Tente novamente.', !ok)
          carregar()
        },
      },
      {
        rotulo: 'Excluir',
        cor: '#dc2626',
        confirmar: 'Excluir esta vaga permanentemente? Esta ação não pode ser desfeita.',
        executar: async () => {
          const ok = await excluirCamada(client, 'empregos', v.id)
          avisar(ok ? 'Vaga excluída.' : 'Não foi possível excluir. Tente novamente.', !ok)
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
      notifErro={notifErro}
    />
  )
}
