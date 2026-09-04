'use client'

import { useEffect, useRef, useState } from 'react'

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

// Ilustração do cabeçalho (mockup de celular + card de perfil + gráfico em
// alta + selo de aprovado) — reproduz a arte da referência enviada pelo
// usuário, sem depender de nenhum asset externo.
function IlustracaoHero() {
  return (
    <svg viewBox="0 0 240 160" width="220" height="147" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* linha de tendência + eixo */}
      <path d="M118 118H228" stroke="#e4e8f7" strokeWidth="1.5" />
      <path d="M126 78L158 60L188 40L222 16" stroke="#c7d0f0" strokeWidth="1.5" strokeDasharray="3 4" />
      <circle cx="126" cy="78" r="2.5" fill="#aab6ec" />
      <circle cx="158" cy="60" r="2.5" fill="#aab6ec" />
      <circle cx="188" cy="40" r="2.5" fill="#aab6ec" />
      <circle cx="222" cy="16" r="2.5" fill="#aab6ec" />

      {/* barras crescentes */}
      <rect x="150" y="90" width="20" height="28" rx="4" fill="#dde3f8" />
      <rect x="178" y="72" width="20" height="46" rx="4" fill="#c9d2f5" />
      <rect x="206" y="48" width="20" height="70" rx="4" fill="#4256c8" />

      {/* card flutuante com avatar + linhas */}
      <g>
        <rect x="4" y="58" width="98" height="42" rx="10" fill="#ffffff" stroke="#e4e8f7" strokeWidth="1.5" />
        <circle cx="22" cy="79" r="9" fill="#eef1fb" />
        <path d="M17 83c0-3 2.2-5 5-5s5 2 5 5" stroke="#4256c8" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="22" cy="76" r="2.6" fill="#4256c8" />
        <rect x="38" y="72" width="52" height="4" rx="2" fill="#dde3f8" />
        <rect x="38" y="82" width="36" height="4" rx="2" fill="#eef1fb" />
      </g>

      {/* mockup do celular */}
      <g>
        <rect x="60" y="8" width="92" height="150" rx="18" fill="#ffffff" stroke="#4256c8" strokeWidth="2.5" />
        <rect x="98" y="18" width="16" height="4" rx="2" fill="#c7d0f0" />

        <rect x="74" y="34" width="64" height="34" rx="9" fill="#eef1fb" />
        <path d="M106 43l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="#4256c8" />
        <rect x="80" y="76" width="52" height="4" rx="2" fill="#dde3f8" />
        <rect x="80" y="85" width="36" height="4" rx="2" fill="#dde3f8" />

        <rect x="74" y="100" width="64" height="4" rx="2" fill="#eef1fb" />
        <rect x="74" y="110" width="64" height="4" rx="2" fill="#eef1fb" />
        <rect x="74" y="120" width="44" height="4" rx="2" fill="#eef1fb" />
      </g>

      {/* selo de aprovado */}
      <circle cx="152" cy="128" r="16" fill="#4256c8" />
      <path d="M144.5 128.5l4.5 4.5 9-9.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

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

// Estrela dourada do 1º lugar — sai pra fora do card, canto superior direito.
function EstrelaOuro() {
  return (
    <div style={{
      position: 'absolute', top: '-12px', right: '-10px', zIndex: 1,
      width: '30px', height: '30px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffd76a, #f5a623)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 3px 8px rgba(180,120,0,0.35)',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.7 7.1-.7z" />
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
      {posicao === 1 && <EstrelaOuro />}

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
      {posicao === 1 && <EstrelaOuro />}

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
      // paddingRight extra: a estrela do 1º lugar (EstrelaOuro) sai 10px pra
      // fora do card à direita, de propósito — sem essa folga ela ficava
      // cortada pelo overflowX:hidden deste container (achado testando no
      // celular de verdade).
      padding: '14px 18px 0 0',
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
      {/* Glow de fundo — mesmo padrão da landing (page.tsx), radial azul suave nos cantos */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background:
          'radial-gradient(60% 50% at 88% 4%, rgba(66,86,200,0.10) 0%, rgba(66,86,200,0) 70%), ' +
          'radial-gradient(50% 40% at 8% 96%, rgba(66,86,200,0.07) 0%, rgba(66,86,200,0) 70%)',
      }} />

      <style>{`
        @media (max-width: 720px) {
          .ranking-ilustracao { display: none; }
        }
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

        {/* Header — texto à esquerda, ilustração à direita (como na referência) */}
        <div style={{ marginBottom: '20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
          <div style={{ maxWidth: '620px' }}>
            <h1 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: 800, color: '#111827', margin: '0 0 8px', lineHeight: 1.15 }}>
              Autoridades que mais responderam a demandas
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
              Acompanhe o desempenho das autoridades que mais respondem
              às demandas dos cidadãos de Frutal.
            </p>
          </div>
          <div className="ranking-ilustracao" style={{ flexShrink: 0 }}>
            <IlustracaoHero />
          </div>
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
