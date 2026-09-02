'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import type { Demanda, Pet, Classificado, Emprego, Imovel } from '@/types'

// Mesmos rótulos de CamadaImoveis.tsx/MasterMapaCamadas.tsx — duplicado de
// propósito, mesmo padrão do resto do projeto (sem módulo de rótulos
// compartilhado entre telas de camada).
const ROTULO_TIPO_IMOVEL: Record<string, string> = {
  casa: 'Casa', apartamento: 'Apartamento', terreno: 'Terreno', comodo_comercial: 'Cômodo Comercial',
  barracao: 'Barracão', fazenda_chacara_sitio: 'Fazenda, Chácara ou Sítio',
}
const ROTULO_FINALIDADE_IMOVEL: Record<string, string> = { aluguel: 'Aluguel', venda: 'Venda' }

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  aguardando_resposta: 'Aguardando resposta',
  respondida: 'Respondida',
  rejeitada_ia: 'Rejeitada pela IA',
  nao_resolvida: 'Não resolvida',
  resolvida: 'Resolvida',
  denunciada: 'Denunciada',
}

const statusCor: Record<string, { bg: string; color: string }> = {
  pendente:            { bg: '#f9fafb', color: '#6b7280' },
  aguardando_resposta: { bg: '#f9fafb', color: '#4256c8' },
  respondida:          { bg: '#f9fafb', color: '#166534' },
  rejeitada_ia:        { bg: '#f9fafb', color: '#dc2626' },
  nao_resolvida:       { bg: '#f9fafb', color: '#92400e' },
  resolvida:           { bg: '#f9fafb', color: '#6b7280' },
  denunciada:          { bg: '#f9fafb', color: '#dc2626' },
}

export default function PerfilPage() {
  const { user, perfil, carregando } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [carregandoDemandas, setCarregandoDemandas] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'atividades' | 'conta'>('atividades')
  // BUG CORRIGIDO (B15-5): "Minhas atividades" só tinha o módulo Demandas —
  // quem registra pet, classificado ou vaga não tinha nenhuma tela própria
  // de gestão, só conseguia editar/excluir achando o próprio pin no mapa.
  // Adicionados os 3 módulos que faltavam, reaproveitando as mesmas rotas
  // e updates que o mapa (MapaDemandas.tsx) já usa pro dono de um registro.
  const [subModulo, setSubModulo] = useState<'demandas' | 'pets' | 'classificados' | 'empregos' | 'imoveis' | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [carregandoPets, setCarregandoPets] = useState(true)
  const [classificados, setClassificados] = useState<Classificado[]>([])
  const [carregandoClassificados, setCarregandoClassificados] = useState(true)
  const [empregos, setEmpregos] = useState<Emprego[]>([])
  const [carregandoEmpregos, setCarregandoEmpregos] = useState(true)
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregandoImoveis, setCarregandoImoveis] = useState(true)

  useEffect(() => {
    if (!carregando && !user) router.replace('/')
  }, [carregando, user, router])

  const ehAutoridade = perfil?.role === 'autoridade'

  useEffect(() => {
    if (!user || ehAutoridade) return
    Promise.resolve().then(() => setCarregandoDemandas(true))
    supabase
      .from('demandas')
      .select('id, user_id, morador_nome, lat, lng, categoria_id, entidade_id, descricao, endereco_label, status, resposta, ia_motivo, created_at, protocolo, categoria:categorias_mapa(*), entidade:entidades(nome, cargo), vinculos:demanda_entidades(id, status, resposta, respondida_em, entidade:entidades(nome, cargo))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDemandas((data || []) as unknown as Demanda[])
        setCarregandoDemandas(false)
      })
  // `supabase` fica de fora de propósito: createClient() gera uma instância
  // nova a cada render (sem memoização interna), então incluí-la faria o
  // efeito refazer a consulta em todo re-render, não só quando user/ehAutoridade
  // mudam — mesmo padrão já usado no resto do arquivo (ex: master/page.tsx).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ehAutoridade])

  useEffect(() => {
    if (!user || ehAutoridade) return
    Promise.resolve().then(() => setCarregandoPets(true))
    supabase.from('pets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setPets((data || []) as Pet[]); setCarregandoPets(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ehAutoridade])

  useEffect(() => {
    if (!user || ehAutoridade) return
    Promise.resolve().then(() => setCarregandoClassificados(true))
    supabase.from('classificados').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setClassificados((data || []) as Classificado[]); setCarregandoClassificados(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ehAutoridade])

  useEffect(() => {
    if (!user || ehAutoridade) return
    Promise.resolve().then(() => setCarregandoEmpregos(true))
    supabase.from('empregos').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setEmpregos((data || []) as Emprego[]); setCarregandoEmpregos(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ehAutoridade])

  // BUG CORRIGIDO (achado em auditoria dedicada à camada Imóveis): "Minhas
  // atividades" ganhou os módulos Pets/Classificados/Empregos (B15-5), mas
  // Imóveis nunca foi adicionado aqui — quem publicava um imóvel só
  // conseguia editar/excluir achando o próprio pin no mapa, sem nenhuma
  // tela de gestão própria, diferente das outras 3 camadas.
  useEffect(() => {
    if (!user || ehAutoridade) return
    Promise.resolve().then(() => setCarregandoImoveis(true))
    supabase.from('imoveis').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setImoveis((data || []) as Imovel[]); setCarregandoImoveis(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ehAutoridade])

  // Passa pelo backend (service_role) em vez de apagar a linha direto do
  // client — mesma rota que MapaDemandas.tsx já usa pro dono de um registro:
  // só assim dá pra limpar a foto/fotos correspondentes do Storage antes de
  // excluir a linha.
  async function excluirViaApi(camada: 'pets' | 'classificados' | 'empregos' | 'imoveis', id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/camadas/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ camada, id }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Não foi possível excluir. Tente novamente.')
      return false
    }
    return true
  }

  async function excluirPet(id: string) {
    if (!confirm('Excluir este registro? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('pets', id)) return
    setPets(prev => prev.filter(p => p.id !== id))
  }

  async function marcarPetReencontrado(id: string) {
    const { error } = await supabase.from('pets').update({ reencontrado: true, reencontrado_em: new Date().toISOString() }).eq('id', id)
    if (error) { alert('Não foi possível marcar como reencontrado. Tente novamente.'); return }
    setPets(prev => prev.map(p => p.id === id ? { ...p, reencontrado: true } : p))
  }

  async function excluirClassificado(id: string) {
    if (!confirm('Excluir este anúncio? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('classificados', id)) return
    setClassificados(prev => prev.filter(c => c.id !== id))
  }

  // BUG CORRIGIDO (achado em auditoria dedicada à camada Imóveis): esta
  // função ainda só ligava a flag `vendido` (linha + fotos ficavam no
  // banco/Storage pra sempre) — desde a decisão confirmada com o usuário
  // de excluir de verdade ao marcar vendido/encerrado, MapaDemandas.tsx já
  // foi corrigido, mas esta cópia paralela em /perfil (mesma ação, tela
  // diferente) tinha ficado pra trás, ainda com o comportamento antigo.
  async function marcarClassificadoVendido(id: string) {
    if (!confirm('Marcar como vendido? O anúncio será excluído e não poderá ser recuperado.')) return
    if (!await excluirViaApi('classificados', id)) return
    setClassificados(prev => prev.filter(c => c.id !== id))
  }

  async function excluirEmprego(id: string) {
    if (!confirm('Excluir esta vaga? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('empregos', id)) return
    setEmpregos(prev => prev.filter(e => e.id !== id))
  }

  // BUG CORRIGIDO — mesmo caso de marcarClassificadoVendido acima.
  async function encerrarEmprego(id: string) {
    if (!confirm('Encerrar esta vaga? O anúncio será excluído e não poderá ser recuperado.')) return
    if (!await excluirViaApi('empregos', id)) return
    setEmpregos(prev => prev.filter(e => e.id !== id))
  }

  async function excluirImovel(id: string) {
    if (!confirm('Excluir este anúncio? Essa ação não pode ser desfeita.')) return
    if (!await excluirViaApi('imoveis', id)) return
    setImoveis(prev => prev.filter(i => i.id !== id))
  }

  async function marcarImovelVendidoAlugado(id: string, finalidade: Imovel['finalidade']) {
    const acao = finalidade === 'aluguel' ? 'alugado' : 'vendido'
    if (!confirm(`Marcar como ${acao}? O anúncio será excluído e não poderá ser recuperado.`)) return
    if (!await excluirViaApi('imoveis', id)) return
    setImoveis(prev => prev.filter(i => i.id !== id))
  }

  async function marcarResolvida(id: string) {
    if (!confirm('Marcar esta demanda como resolvida?')) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/cidadao/marcar-resolvida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ demanda_id: id }),
    })
    if (res.ok) {
      setDemandas(prev => prev.map(d => d.id === id ? { ...d, status: 'resolvida' } : d))
      return
    }
    const d = await res.json().catch(() => ({}))
    alert(d.error || 'Erro ao marcar como resolvida.')
  }

  async function excluirDemanda(id: string) {
    if (!confirm('Excluir esta demanda? Esta ação não pode ser desfeita.')) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/demandas/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ demanda_id: id }),
    })
    if (res.ok) { setDemandas(prev => prev.filter(d => d.id !== id)); return }
    const d = await res.json().catch(() => ({}))
    alert(d.error || 'Erro ao excluir.')
  }

  if (carregando || !user) return null

  const nomeExibido = perfil?.nome || user.user_metadata?.full_name || 'Usuário'

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 32px)' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            {nomeExibido.split(' ')[0]}
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            {user.email}
          </p>
        </div>
        {perfil?.role === 'master' && (
          <a href="/master" style={{ fontSize: '13px', fontWeight: 600, color: 'white', background: '#4256c8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Painel Master
          </a>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e5e7eb', marginBottom: '24px' }}>
        {(['atividades', 'conta'] as const).map(aba => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 18px', fontSize: '14px', fontWeight: 600,
              color: abaAtiva === aba ? '#4256c8' : '#6b7280',
              borderBottom: abaAtiva === aba ? '2px solid #4256c8' : '2px solid transparent',
              marginBottom: '-2px', transition: 'color 0.15s',
            }}>
            {aba === 'atividades' ? 'Minhas atividades' : 'Minha conta'}
          </button>
        ))}
      </div>

      {/* Aba: Minhas atividades */}
      {abaAtiva === 'atividades' && ehAutoridade && (
        <AtividadesAutoridade />
      )}
      {abaAtiva === 'atividades' && !ehAutoridade && (
        <div>
          {/* Cards de módulo */}
          {!subModulo && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSubModulo('demandas')}
                style={{
                  width: 'clamp(140px, 40vw, 180px)', minHeight: '80px', height: 'auto', background: 'white',
                  border: '1px solid #e5e7eb', borderRadius: '10px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '16px', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)')}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Demandas</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{demandas.length} registro{demandas.length !== 1 ? 's' : ''}</span>
              </button>
              <CardModulo rotulo="Pets" contagem={pets.length} onClick={() => setSubModulo('pets')} />
              <CardModulo rotulo="Classificados" contagem={classificados.length} onClick={() => setSubModulo('classificados')} />
              <CardModulo rotulo="Empregos" contagem={empregos.length} onClick={() => setSubModulo('empregos')} />
              <CardModulo rotulo="Imóveis" contagem={imoveis.length} onClick={() => setSubModulo('imoveis')} />
            </div>
          )}

          {/* Conteúdo do módulo selecionado */}
          {subModulo === 'demandas' && (
            <div>
              <button
                onClick={() => setSubModulo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ← Voltar
              </button>
              {carregandoDemandas ? (
            <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Carregando...</p>
          ) : demandas.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>
              Você ainda não registrou nenhuma atividade.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {demandas.map(d => (
                <div key={d.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                  {/* Topo: categoria + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                      {d.categoria?.nome || 'Sem categoria'}
                    </span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px',
                      background: statusCor[d.status]?.bg || '#f9fafb',
                      color: statusCor[d.status]?.color || '#6b7280',
                    }}>
                      {statusLabel[d.status] || d.status}
                    </span>
                  </div>

                  {/* Descrição */}
                  <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>
                    {d.descricao}
                  </p>

                  {/* Endereço */}
                  {d.endereco_label && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                      {d.endereco_label}
                    </p>
                  )}

                  {/* Respostas das autoridades (novo sistema multi-entidade) */}
                  {(d.vinculos?.filter(v => v.resposta) ?? []).length > 0 ? (
                    d.vinculos!.filter(v => v.resposta).map(v => (
                      <div key={v.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                        <strong>{v.entidade?.nome || 'Autoridade'}:</strong> {v.resposta}
                      </div>
                    ))
                  ) : d.resposta ? (
                    // Fallback para demandas legadas (resposta no registro principal)
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                      <strong>Resposta:</strong> {d.resposta}
                    </div>
                  ) : null}

                  {/* Motivo rejeição IA */}
                  {d.status === 'rejeitada_ia' && d.ia_motivo && (
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#dc2626', lineHeight: 1.5 }}>
                      <strong>Motivo:</strong> {d.ia_motivo}
                    </div>
                  )}

                  {/* Data + ações */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      {new Date(d.created_at).toLocaleDateString('pt-BR')}
                      {d.protocolo && <span style={{ marginLeft: '8px', fontFamily: 'monospace', color: '#9ca3af' }}>#{d.protocolo}</span>}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['aguardando_resposta', 'respondida', 'nao_resolvida'].includes(d.status) && (
                        <button
                          onClick={() => marcarResolvida(d.id)}
                          style={{ fontSize: '11px', color: '#166534', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                          Marcar como resolvida
                        </button>
                      )}
                      <button
                        onClick={() => excluirDemanda(d.id)}
                        style={{ fontSize: '11px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                        Excluir
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
            </div>
          )}

          {subModulo === 'pets' && (
            <div>
              <button onClick={() => setSubModulo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ← Voltar
              </button>
              {carregandoPets ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Carregando...</p>
              ) : pets.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Você ainda não registrou nenhum pet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pets.map(p => (
                    <div key={p.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                          {{ perdido: 'Perdido', achado: 'Achado', adocao: 'Adoção' }[p.tipo]} · {p.especie === 'cachorro' ? 'Cachorro' : 'Gato'}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: p.reencontrado ? '#166534' : '#6b7280' }}>
                          {p.reencontrado ? 'Reencontrado' : 'Ativo'}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>{p.nome_pet ? `${p.nome_pet} — ` : ''}{p.descricao}</p>
                      {p.endereco_label && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{p.endereco_label}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {p.tipo === 'perdido' && !p.reencontrado && (
                            <button onClick={() => marcarPetReencontrado(p.id)}
                              style={{ fontSize: '11px', color: '#166534', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                              Marcar reencontrado
                            </button>
                          )}
                          <button onClick={() => excluirPet(p.id)}
                            style={{ fontSize: '11px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subModulo === 'classificados' && (
            <div>
              <button onClick={() => setSubModulo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ← Voltar
              </button>
              {carregandoClassificados ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Carregando...</p>
              ) : classificados.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Você ainda não publicou nenhum anúncio.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {classificados.map(c => (
                    <div key={c.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{c.marca ? `${c.marca} ${c.modelo || ''}`.trim() : c.titulo}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: c.vendido ? '#166534' : '#6b7280' }}>
                          {c.vendido ? 'Vendido' : 'Ativo'}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>{c.titulo}</p>
                      {c.bairro_label && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{c.bairro_label}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!c.vendido && (
                            <button onClick={() => marcarClassificadoVendido(c.id)}
                              style={{ fontSize: '11px', color: '#166534', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                              Marcar vendido
                            </button>
                          )}
                          <button onClick={() => excluirClassificado(c.id)}
                            style={{ fontSize: '11px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subModulo === 'empregos' && (
            <div>
              <button onClick={() => setSubModulo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ← Voltar
              </button>
              {carregandoEmpregos ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Carregando...</p>
              ) : empregos.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Você ainda não publicou nenhuma vaga.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {empregos.map(e => (
                    <div key={e.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{e.cargo}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: e.encerrada ? '#6b7280' : '#166534' }}>
                          {e.encerrada ? 'Encerrada' : 'Ativa'}
                        </span>
                      </div>
                      {e.endereco_label && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{e.endereco_label}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(e.created_at).toLocaleDateString('pt-BR')}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!e.encerrada && (
                            <button onClick={() => encerrarEmprego(e.id)}
                              style={{ fontSize: '11px', color: '#92400e', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                              Encerrar vaga
                            </button>
                          )}
                          <button onClick={() => excluirEmprego(e.id)}
                            style={{ fontSize: '11px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subModulo === 'imoveis' && (
            <div>
              <button onClick={() => setSubModulo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ← Voltar
              </button>
              {carregandoImoveis ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Carregando...</p>
              ) : imoveis.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Você ainda não publicou nenhum anúncio.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {imoveis.map(i => (
                    <div key={i.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{ROTULO_TIPO_IMOVEL[i.tipo] || i.tipo}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: '#166534' }}>
                          {ROTULO_FINALIDADE_IMOVEL[i.finalidade] || i.finalidade}
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>
                        {i.valor != null ? i.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'A combinar'}
                      </p>
                      {i.endereco_label && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{i.endereco_label}</p>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(i.created_at).toLocaleDateString('pt-BR')}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => marcarImovelVendidoAlugado(i.id, i.finalidade)}
                            style={{ fontSize: '11px', color: '#166534', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                            {i.finalidade === 'aluguel' ? 'Marcar alugado' : 'Marcar vendido'}
                          </button>
                          <button onClick={() => excluirImovel(i.id)}
                            style={{ fontSize: '11px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Aba: Minha conta */}
      {abaAtiva === 'conta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Campo label="Nome" valor={perfil?.nome || '—'} />
            <Campo label="CPF" valor={perfil?.cpf ? perfil.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'} />
            <Campo label="Data de nascimento" valor={perfil?.data_nascimento ? new Date((perfil.data_nascimento as string) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} />
            <Campo label="WhatsApp" valor={perfil?.whatsapp || '—'} />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                if (!confirm('Tem certeza que deseja excluir sua conta? Todos os seus dados serão apagados permanentemente.')) return
                const { data: { session } } = await supabase.auth.getSession()
                const res = await fetch('/api/cidadao/excluir-conta', {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${session?.access_token}` },
                })
                if (res.ok) { await supabase.auth.signOut(); router.push('/'); return }
                const d = await res.json().catch(() => ({}))
                alert(d.error || 'Erro ao excluir conta. Tente novamente.')
              }}
              style={{ fontSize: '13px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 500 }}>
              Excluir conta
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

interface VinculoAutoridade {
  id: string
  status: string
  resposta?: string
  respondida_em?: string
  demanda: {
    id: string
    descricao: string
    endereco_label?: string
    foto_url?: string
    morador_nome: string
    status: string
    created_at: string
    categoria?: { nome: string; cor: string }
  } | null
}

function AtividadesAutoridade() {
  const supabase = createClient()
  const [vinculos, setVinculos] = useState<VinculoAutoridade[]>([])
  const [carregando, setCarregando] = useState(true)
  const [respostaTexto, setRespostaTexto] = useState<Record<string, string>>({})
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  async function buscar() {
    setCarregando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/autoridade/demandas', {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    })
    if (res.ok) setVinculos(await res.json())
    setCarregando(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) =>
      fetch('/api/autoridade/demandas', { headers: { 'Authorization': `Bearer ${session?.access_token}` } })
        .then(async (res) => {
          if (res.ok) setVinculos(await res.json())
          setCarregando(false)
        })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function responder(vinculoId: string) {
    const texto = (respostaTexto[vinculoId] || '').trim()
    if (texto.length < 10) { setErro('Escreva uma resposta com pelo menos 10 caracteres.'); return }
    setErro('')
    setEnviandoId(vinculoId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/autoridade/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ vinculo_id: vinculoId, resposta: texto }),
    })
    const d = await res.json()
    setEnviandoId(null)
    if (!res.ok) { setErro(d.error || 'Erro ao responder.'); return }
    await buscar()
  }

  async function marcarResolvida(demandaId: string) {
    if (!confirm('Marcar esta demanda como resolvida?')) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/autoridade/marcar-resolvida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ demanda_id: demandaId }),
    })
    const d = await res.json()
    if (!res.ok) { alert(d.error || 'Erro ao marcar como resolvida.'); return }
    await buscar()
  }

  async function denunciar(demandaId: string) {
    // BUG CORRIGIDO (B15-8): o prompt() do motivo vinha ANTES do confirm()
    // — cancelar a confirmação jogava fora o texto que o usuário acabou de
    // digitar, mesmo tendo respondido a pergunta errada primeiro. Inverte
    // a ordem: confirma a ação, só então pergunta o motivo.
    if (!confirm('Denunciar esta demanda? Ela vai sumir do mapa público e ficar em análise com o administrador.')) return
    const motivo = prompt('O que há de errado com essa demanda? (opcional)') || ''
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/autoridade/denunciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ demanda_id: demandaId, motivo }),
    })
    const d = await res.json()
    if (!res.ok) { alert(d.error || 'Erro ao denunciar.'); return }
    await buscar()
  }

  if (carregando) return <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Carregando...</p>
  if (vinculos.length === 0) return <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>Nenhuma demanda direcionada a você ainda.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {erro && <div style={{ color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}
      {vinculos.map(v => {
        const d = v.demanda
        if (!d) return null
        const jaRespondeu = !!v.resposta
        const podeResolver = jaRespondeu && d.status !== 'resolvida' && d.status !== 'denunciada'
        const podeDenunciar = d.status !== 'denunciada'

        return (
          <div key={v.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{d.categoria?.nome || 'Sem categoria'}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: statusCor[d.status]?.bg || '#f9fafb', color: statusCor[d.status]?.color || '#6b7280' }}>
                {statusLabel[d.status] || d.status}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }}>{d.descricao}</p>
            {d.endereco_label && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{d.endereco_label}</p>}
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Registrada por: {d.morador_nome}</p>

            {jaRespondeu ? (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                <strong>Sua resposta:</strong> {v.resposta}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <textarea
                  value={respostaTexto[v.id] || ''}
                  onChange={e => setRespostaTexto(prev => ({ ...prev, [v.id]: e.target.value }))}
                  placeholder="Escreva sua resposta..."
                  rows={3}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }}
                />
                <button
                  onClick={() => responder(v.id)}
                  disabled={enviandoId === v.id}
                  style={{ alignSelf: 'flex-start', fontSize: '12px', fontWeight: 600, color: 'white', background: enviandoId === v.id ? '#6b7280' : '#4256c8', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: enviandoId === v.id ? 'not-allowed' : 'pointer' }}>
                  {enviandoId === v.id ? 'Enviando...' : 'Publicar resposta'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {podeResolver && (
                  <button onClick={() => marcarResolvida(d.id)}
                    style={{ fontSize: '11px', color: '#166534', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                    Marcar como resolvida
                  </button>
                )}
                {podeDenunciar && (
                  <button onClick={() => denunciar(d.id)}
                    style={{ fontSize: '11px', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
                    Denunciar
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CardModulo({ rotulo, contagem, onClick }: { rotulo: string; contagem: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 'clamp(140px, 40vw, 180px)', minHeight: '80px', height: 'auto', background: 'white',
        border: '1px solid #e5e7eb', borderRadius: '10px',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '16px', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)')}
    >
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{rotulo}</span>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>{contagem} registro{contagem !== 1 ? 's' : ''}</span>
    </button>
  )
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ fontSize: '14px', color: '#111827', margin: 0 }}>{valor}</p>
    </div>
  )
}


