'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import type { Demanda } from '@/types'

const statusLabel: Record<string, string> = {
  pendente: 'Pendente',
  aguardando_resposta: 'Aguardando resposta',
  respondida: 'Respondida',
  rejeitada_ia: 'Rejeitada pela IA',
  nao_resolvida: 'Não resolvida',
  resolvida: 'Resolvida',
}

const statusCor: Record<string, { bg: string; color: string }> = {
  pendente:            { bg: '#f9fafb', color: '#6b7280' },
  aguardando_resposta: { bg: '#f9fafb', color: '#4256c8' },
  respondida:          { bg: '#f9fafb', color: '#166534' },
  rejeitada_ia:        { bg: '#f9fafb', color: '#dc2626' },
  nao_resolvida:       { bg: '#f9fafb', color: '#92400e' },
  resolvida:           { bg: '#f9fafb', color: '#6b7280' },
}

export default function PerfilPage() {
  const { user, perfil, carregando } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [carregandoDemandas, setCarregandoDemandas] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'atividades' | 'conta'>('atividades')
  const [subModulo, setSubModulo] = useState<'demandas' | null>(null)

  useEffect(() => {
    if (!carregando && !user) router.replace('/')
  }, [carregando, user, router])

  useEffect(() => {
    if (!user) return
    async function buscar() {
      setCarregandoDemandas(true)
      const { data } = await supabase
        .from('demandas')
        .select('*, categoria:categorias_mapa(*), entidade:entidades(*), vinculos:demanda_entidades(id, status, resposta, respondida_em, entidade:entidades(nome, cargo))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      setDemandas(data || [])
      setCarregandoDemandas(false)
    }
    buscar()
  }, [user])

  async function marcarResolvida(id: string) {
    if (!confirm('Marcar esta demanda como resolvida?')) return
    await supabase.from('demandas').update({ status: 'resolvida' }).eq('id', id)
    setDemandas(prev => prev.map(d => d.id === id ? { ...d, status: 'resolvida' } : d))
  }

  async function excluirDemanda(id: string) {
    if (!confirm('Excluir esta demanda? Esta ação não pode ser desfeita.')) return
    await supabase.from('demandas').delete().eq('id', id)
    setDemandas(prev => prev.filter(d => d.id !== id))
  }

  if (carregando || !user) return null

  const nomeExibido = perfil?.nome || user.user_metadata?.full_name || 'Usuário'

  return (
    <div style={{ padding: '24px 32px' }}>

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
      {abaAtiva === 'atividades' && (
        <div>
          {/* Cards de módulo */}
          {!subModulo && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSubModulo('demandas')}
                style={{
                  width: '180px', height: '100px', background: 'white',
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
                      📍 {d.endereco_label}
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
        </div>
      )}

      {/* Aba: Minha conta */}
      {abaAtiva === 'conta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Campo label="Nome" valor={perfil?.nome || '—'} />
            <Campo label="CPF" valor={perfil?.cpf || '—'} />
            <Campo label="E-mail" valor={user.email || '—'} />
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
                if (res.ok) window.location.href = '/'
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

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ fontSize: '14px', color: '#111827', margin: 0 }}>{valor}</p>
    </div>
  )
}

