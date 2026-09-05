'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import MapaVivo from './MapaVivo'

type Resumo = { demandas: number; empregos: number; imoveis: number; pets: number }
type AutoridadeRanking = { id: string; nome: string; cargo: string; foto_url: string | null; taxa: number }

const CAMADAS = [
  { label: 'Demandas Municipais', camada: 'demandas' },
  { label: 'Vagas de Emprego', camada: 'empregos' },
  { label: 'Veículos', camada: 'classificados' },
  { label: 'Imóveis', camada: 'imoveis' },
  { label: 'Área PET', camada: 'pets' },
]

function Avatar({ nome, foto_url }: { nome: string; foto_url: string | null }) {
  if (foto_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={foto_url} alt={nome} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#4256c8', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {nome.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

/**
 * Página inicial pós-login — abre em "/" assim que o cidadão loga (antes
 * disso, o AuthProvider/page.tsx mandava direto pro /mapa sem passar por
 * aqui). Um "guia" com atalhos pras camadas do mapa, resumo do que tá
 * rolando na cidade, mini ranking e o assistente de IA — pedido explícito
 * do usuário, discutido e desenhado (mockup) antes de implementar.
 */
export default function PainelInicial() {
  const { perfil, user } = useAuth()
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [ranking, setRanking] = useState<AutoridadeRanking[] | null>(null)

  useEffect(() => {
    fetch('/api/inicio/resumo').then(r => r.json()).then(d => { if (!d.error) setResumo(d) }).catch(() => {})
    fetch('/api/ranking').then(r => r.json()).then(d => {
      if (d.ranking) setRanking([...d.ranking].sort((a, b) => b.taxa - a.taxa).slice(0, 3))
    }).catch(() => {})
  }, [])

  const nomeExibido = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Usuário'

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: '#f7f8fb', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      {/* Fundo — mesmo MapaVivo (traçado urbano animado) do /ranking e da landing */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <MapaVivo />
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(115% 90% at 6% 4%, rgba(247,248,251,0.97) 0%, rgba(247,248,251,0.88) 34%, rgba(247,248,251,0.42) 66%, rgba(247,248,251,0.30) 100%), ' +
            'linear-gradient(180deg, rgba(247,248,251,0.92) 0%, rgba(247,248,251,0.20) 26%, rgba(247,248,251,0.26) 68%, rgba(247,248,251,0.94) 100%)',
        }} />
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '22px 24px 28px', position: 'relative', zIndex: 1 }}>

        {/* Saudação */}
        <div style={{ marginBottom: '14px' }}>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
            Olá, {nomeExibido}
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Veja o que está acontecendo em Frutal agora
          </p>
        </div>

        {/* Camadas do mapa */}
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.04em', margin: '0 0 8px' }}>
          CAMADAS DO MAPA
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {CAMADAS.map((c) => (
            <Link
              key={c.camada}
              href={`/mapa?camada=${c.camada}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                background: '#4256c8', color: 'white', borderRadius: '12px', padding: '14px 12px', minHeight: '76px',
                fontSize: '13.5px', fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(66,86,200,0.25)',
              }}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {/* Ranking + Resumo lado a lado (sem botão de assistente — pedido
            do usuário: excluir o botão, e colocar o mostrador de resumo no
            lugar dele, ao lado do ranking). */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.04em', margin: 0 }}>TOP RANKING</p>
              <Link href="/ranking" style={{ fontSize: '12px', fontWeight: 600, color: '#4256c8', textDecoration: 'none' }}>Ver tudo</Link>
            </div>
            {!ranking && <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Carregando...</p>}
            {ranking && ranking.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Nenhuma autoridade cadastrada ainda.</p>}
            {ranking && ranking.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                <Avatar nome={a.nome} foto_url={a.foto_url} />
                <span style={{ fontSize: '13px', color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280' }}>{a.taxa}%</span>
              </div>
            ))}
          </div>

          <div style={{ flex: '1 1 280px', background: '#eef1fb', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
            {[
              { label: 'demandas registradas', valor: resumo?.demandas },
              { label: 'vagas de emprego', valor: resumo?.empregos },
              { label: 'imóveis anunciados', valor: resumo?.imoveis },
              { label: 'pets na área pet', valor: resumo?.pets },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#4256c8', lineHeight: 1, minWidth: '28px' }}>
                  {item.valor ?? '—'}
                </p>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#6b7280' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
