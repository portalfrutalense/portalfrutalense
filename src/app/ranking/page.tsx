'use client'

import { useEffect, useRef, useState } from 'react'
import MapaVivo from '@/components/MapaVivo'

type Autoridade = {
  id: string
  nome: string
  cargo: string
  foto_url: string | null
  destinadas: number
  respondidas: number
  taxa: number
}

type Aba = 'taxa' | 'quantidade'

function Avatar({ nome, foto_url, size }: { nome: string; foto_url: string | null; size: number }) {
  if (foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto_url}
        alt={nome}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #4256c8, #6d84e6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0,
    }}>
      {nome.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

// Medalha de ouro do 1º lugar — sobe por cima do card, canto superior
// direito, mas sem passar da borda direita do card (pedido do usuário: sem
// reserva de espaço extra e sem cortar nada — só sai pra cima, não pro lado).
// Borda recortada (várias bolinhas sobrepostas formando o contorno
// "engrenagem"), número 1 no meio, fita bipartida caindo por trás do disco —
// modelo escolhido pelo usuário entre as opções desenhadas.
function MedalhaOuro() {
  const bumps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
    const rad = (deg * Math.PI) / 180
    return { x: 32 + 21 * Math.cos(rad), y: 34 + 21 * Math.sin(rad) }
  })
  return (
    <div style={{ position: 'absolute', top: '-14px', right: '2px', zIndex: 1 }}>
      <svg width="40" height="56" viewBox="0 0 64 90" style={{ filter: 'drop-shadow(0 3px 6px rgba(180,120,0,0.35))' }}>
        {/* fitas — atrás do disco */}
        <g transform="translate(24 48) rotate(-24)">
          <path d="M-8 0H8V30L0 22L-8 30Z" fill="#ff6b6b" />
        </g>
        <g transform="translate(40 48) rotate(24)">
          <path d="M-8 0H8V30L0 22L-8 30Z" fill="#e5484d" />
        </g>
        {/* borda recortada (bolinhas sobrepostas) */}
        {bumps.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r="8.5" fill={b.x <= 32 ? '#ffd76a' : '#f5a623'} />
        ))}
        {/* disco interno */}
        <circle cx="32" cy="34" r="17" fill="#f5a623" />
        <path d="M32 17A17 17 0 0 0 32 51Z" fill="#ffd76a" />
        <text x="32" y="42" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff3d6" fontFamily="Inter, sans-serif">1</text>
      </svg>
    </div>
  )
}

// Valor principal do card (taxa % ou quantidade, conforme a aba) — pedido do
// usuário: mesma cor sempre (nunca a cor da marca, nem preto), 25%/4/0%
// visualmente idênticos. Cinza médio (#6b7280), não o mais claro da escala
// (#9ca3af) — esse fica reservado pras legendas pequenas abaixo, senão o
// número (maior e em negrito) fica mais apagado que o texto miúdo ao lado,
// invertendo a hierarquia visual.
function valorPrincipal(autoridade: Autoridade, aba: Aba): { texto: string; cor: string } {
  return {
    texto: aba === 'taxa' ? `${autoridade.taxa}%` : String(autoridade.destinadas),
    cor: '#6b7280',
  }
}

function Cartao({ autoridade, posicao, aba }: { autoridade: Autoridade; posicao: number; aba: Aba }) {
  const { texto, cor } = valorPrincipal(autoridade, aba)
  return (
    <div style={{
      position: 'relative',
      flex: '0 0 auto',
      width: '166px',
      background: '#ffffff',
      border: '1px solid rgba(66,86,200,0.12)',
      borderRadius: '16px',
      padding: '12px 12px 10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '1px',
      boxShadow: '0 1px 2px rgba(13,20,37,0.03), 0 10px 20px -16px rgba(13,20,37,0.18)',
    }}>
      {posicao === 1 && <MedalhaOuro />}

      <span style={{ alignSelf: 'flex-start', fontSize: '13.5px', fontWeight: 800, color: '#4256c8' }}>
        {posicao}º
      </span>

      <div style={{ margin: '2px 0 8px' }}>
        <Avatar nome={autoridade.nome} foto_url={autoridade.foto_url} size={60} />
      </div>

      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {autoridade.nome}
      </p>
      <p style={{ margin: '1px 0 8px', fontSize: '10.5px', color: '#6b7280', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {autoridade.cargo}
      </p>

      <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: cor, lineHeight: 1 }}>
        {texto}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: '9.5px', color: '#9ca3af' }}>
        {aba === 'taxa' ? 'taxa de resposta' : 'demandas recebidas'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f3f4f6', width: '100%', fontSize: '9.5px', color: '#9ca3af' }}>
        <span>Destinadas <strong style={{ color: '#111827' }}>{autoridade.destinadas}</strong></span>
        <span>Respondidas <strong style={{ color: '#111827' }}>{autoridade.respondidas}</strong></span>
      </div>
    </div>
  )
}

// Linha da lista vertical (mobile) — duas linhas empilhadas (identidade em
// cima, números embaixo) em vez de tudo espremido lado a lado — evita tanto
// o cargo cortado quanto o overflow horizontal que uma linha só causava.
function Linha({ autoridade, posicao, aba }: { autoridade: Autoridade; posicao: number; aba: Aba }) {
  const { texto, cor } = valorPrincipal(autoridade, aba)
  return (
    <div style={{
      position: 'relative',
      background: '#ffffff', border: '1px solid rgba(66,86,200,0.12)', borderRadius: '14px',
      padding: '12px 14px',
    }}>
      {posicao === 1 && <MedalhaOuro />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '17px', fontWeight: 800, color: '#4256c8', flexShrink: 0 }}>
          {posicao}º
        </span>
        <Avatar nome={autoridade.nome} foto_url={autoridade.foto_url} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {autoridade.nome}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {autoridade.cargo}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: '19px', fontWeight: 800, color: cor, lineHeight: 1 }}>
            {texto}
          </span>
          <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#9ca3af', marginLeft: '6px' }}>
            {aba === 'taxa' ? 'taxa de resposta' : 'demandas recebidas'}
          </span>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right', fontSize: '10.5px', color: '#9ca3af', lineHeight: 1.5 }}>
          <div>Destinadas <strong style={{ color: '#111827' }}>{autoridade.destinadas}</strong></div>
          <div>Respondidas <strong style={{ color: '#111827' }}>{autoridade.respondidas}</strong></div>
        </div>
      </div>
    </div>
  )
}

function ListaVertical({ lista, aba }: { lista: Autoridade[]; aba: Aba }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', overflowX: 'hidden', minHeight: 0,
      paddingTop: '14px',
    }}>
      {lista.map((a, i) => <Linha key={a.id} autoridade={a} posicao={i + 1} aba={aba} />)}
    </div>
  )
}

function Faixa({ lista, aba }: { lista: Autoridade[]; aba: Aba }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [temMaisPraDireita, setTemMaisPraDireita] = useState(true)

  function checarScroll() {
    const el = scrollRef.current
    if (!el) return
    setTemMaisPraDireita(el.scrollWidth - el.clientWidth - el.scrollLeft > 8)
  }

  useEffect(() => { checarScroll() }, [lista]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={checarScroll}
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '18px 4px 8px',
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {lista.map((a, i) => (
          <div key={a.id} style={{ scrollSnapAlign: 'start' }}>
            <Cartao autoridade={a} posicao={i + 1} aba={aba} />
          </div>
        ))}
      </div>
      {temMaisPraDireita && (
        <span style={{
          position: 'absolute', top: '50%', right: '-6px', transform: 'translateY(-50%)',
          fontSize: '16px', color: '#9ca3af', fontWeight: 700,
          background: 'white', border: '1px solid rgba(66,86,200,0.14)', borderRadius: '50%',
          width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(13,20,37,0.10)',
          pointerEvents: 'none',
        }}>›</span>
      )}
    </div>
  )
}

export default function RankingPage() {
  const [dados, setDados] = useState<Autoridade[] | null>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('taxa')

  // Página estática, sem scroll — trava html/body enquanto ela estiver
  // montada (mesmo padrão do /mapa, ver PublicShell.tsx).
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [])

  useEffect(() => {
    fetch('/api/ranking')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErro(d.error); return }
        setDados(d.ranking || [])
      })
      .catch(() => setErro('Não foi possível carregar o ranking.'))
  }, [])

  const ordenado = dados
    ? [...dados].sort((a, b) => {
        if (aba === 'taxa') {
          if (b.taxa !== a.taxa) return b.taxa - a.taxa
          return b.destinadas - a.destinadas // desempate: mais destinadas primeiro
        }
        return b.destinadas - a.destinadas
      })
    : []

  return (
    <div style={{
      // 100dvh menos os 56px fixos da Navbar (ver PublicShell.tsx) — a
      // página continua sem scroll nenhum, agora com a navbar padrão do
      // site acima dela.
      height: 'calc(100dvh - 56px)', background: '#f7f8fb', fontFamily: 'Inter, sans-serif',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Fundo — o mesmo traçado urbano animado da landing (page.tsx):
          MapaVivo (canvas com a malha de ruas + pins pulsando) coberto por
          um véu claro (pro texto não disputar leitura com o traçado) e um
          halo azul suave no canto. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <MapaVivo />
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(115% 90% at 6% 44%, rgba(247,248,251,0.97) 0%, rgba(247,248,251,0.88) 34%, rgba(247,248,251,0.42) 66%, rgba(247,248,251,0.30) 100%), ' +
            'linear-gradient(180deg, rgba(247,248,251,0.92) 0%, rgba(247,248,251,0.20) 26%, rgba(247,248,251,0.26) 68%, rgba(247,248,251,0.94) 100%)',
        }} />
        <div style={{
          position: 'absolute', left: '-14%', top: '16%',
          width: '60vw', height: '60vw', maxWidth: '800px', maxHeight: '800px',
          background: 'radial-gradient(circle, rgba(66,86,200,0.10) 0%, rgba(66,86,200,0) 70%)',
          filter: 'blur(16px)',
        }} />
      </div>

      <style>{`
        @media (max-width: 560px) {
          .ranking-secao-titulo { flex-direction: column; align-items: flex-start !important; }
          .ranking-abas { width: 100%; }
          .ranking-abas button { flex: 1; }
        }
        /* Desktop: faixa horizontal com scroll. Mobile: lista vertical
           (pedido explícito do usuário, com referência visual). */
        .ranking-lista-desktop { display: flex; }
        .ranking-lista-mobile { display: none; }
        @media (max-width: 640px) {
          .ranking-lista-desktop { display: none; }
          .ranking-lista-mobile { display: flex; }
          .ranking-conteudo { justify-content: flex-start !important; }
          .ranking-secao-lista { flex: 1; min-height: 0; }
        }
      `}</style>

      <div className="ranking-conteudo" style={{
        width: '100%', maxWidth: '1180px', margin: '0 auto', padding: '20px 32px',
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        flex: 1, minHeight: 0, justifyContent: 'center',
      }}>

        {/* Header */}
        <div style={{ marginBottom: '20px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 800, color: '#111827', margin: '0 0 8px', lineHeight: 1.15 }}>
            Autoridades que mais responderam a demandas
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5, maxWidth: '620px' }}>
            Acompanhe o desempenho das autoridades que mais respondem
            às demandas dos cidadãos de Frutal.
          </p>
        </div>

        {/* Lista */}
        <div className="ranking-secao-lista" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Título da seção + abas na mesma linha, terminando na linha divisória — como na referência */}
          <div className="ranking-secao-titulo" style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px',
            paddingBottom: '0', borderBottom: '2px solid #4256c8', flexShrink: 0, marginBottom: '14px', flexWrap: 'wrap',
          }}>
            <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', margin: 0, whiteSpace: 'nowrap' }}>
              Ranking de respostas
            </h2>
            <div className="ranking-abas" style={{ display: 'inline-flex', gap: '2px' }}>
              {([
                { key: 'taxa' as Aba, label: 'Taxa de resposta' },
                { key: 'quantidade' as Aba, label: 'Demandas recebidas' },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => setAba(t.key)}
                  style={{
                    padding: '7px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                    fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap',
                    background: aba === t.key ? '#4256c8' : 'transparent',
                    color: aba === t.key ? 'white' : '#6b7280',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {erro && <p style={{ fontSize: '13px', color: '#dc2626' }}>{erro}</p>}

          {!erro && !dados && (
            <p style={{ fontSize: '13px', color: '#6b7280' }}>Carregando...</p>
          )}

          {!erro && dados && dados.length === 0 && (
            <p style={{ fontSize: '13px', color: '#6b7280' }}>Nenhuma autoridade cadastrada ainda.</p>
          )}

          {!erro && ordenado.length > 0 && (
            <>
              <div className="ranking-lista-desktop" style={{ alignItems: 'center' }}>
                <Faixa lista={ordenado} aba={aba} />
              </div>
              <div className="ranking-lista-mobile" style={{ flexDirection: 'column', minHeight: 0 }}>
                <ListaVertical lista={ordenado} aba={aba} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
