'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'

/* Estados de uma demanda, na ordem em que acontecem na vida real */
const AGUARDANDO = '#d97706'
const RESPONDIDA = '#4256c8'
const RESOLVIDA = '#059669'

/* Camadas do mapa — mesmas cores usadas na landing */
const CAMADAS = [
  { rotulo: 'Demandas', camada: 'demandas', cor: '#d97706' },
  { rotulo: 'Empregos', camada: 'empregos', cor: '#0891b2' },
  { rotulo: 'Classificados', camada: 'classificados', cor: '#059669' },
  { rotulo: 'Pets', camada: 'pets', cor: '#db2777' },
]

interface Atividades {
  demandas: number
  aguardando: number
  respondidas: number
  resolvidas: number
  classificados: number
  pets: number
}

interface AutoridadeRanking {
  id: string
  nome: string
  cargo: string
  total: number
  respondidas: number
}

// Evento do Chrome para instalação do PWA (não existe nos tipos padrão)
interface PromptInstalacao extends Event {
  prompt: () => void
  userChoice: Promise<{ outcome: string }>
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, perfil, carregando: carregandoAuth } = useAuth()

  const [atividades, setAtividades] = useState<Atividades | null>(null)
  const [ranking, setRanking] = useState<AutoridadeRanking[]>([])
  const [carregando, setCarregando] = useState(true)

  // Página exclusiva de usuário logado — sem sessão, volta para a inicial
  useEffect(() => {
    if (!carregandoAuth && !user) router.replace('/')
  }, [carregandoAuth, user, router])

  /* ------------------------------------------------------------------ PWA -- */

  const promptRef = useRef<PromptInstalacao | null>(null)
  const [podeInstalar, setPodeInstalar] = useState(false)
  const [ehIos, setEhIos] = useState(false)
  const [dicaIos, setDicaIos] = useState(false)

  useEffect(() => {
    function aoPrompt(e: Event) {
      e.preventDefault()
      promptRef.current = e as PromptInstalacao
      setPodeInstalar(true)
    }
    window.addEventListener('beforeinstallprompt', aoPrompt)

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    // iOS nunca dispara beforeinstallprompt — só resta a instrução manual
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    if (!standalone && ios) setEhIos(true)

    return () => window.removeEventListener('beforeinstallprompt', aoPrompt)
  }, [])

  async function instalarPwa() {
    const prompt = promptRef.current
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    promptRef.current = null
    setPodeInstalar(false)
  }

  /* ----------------------------------------------------------------- dados -- */

  useEffect(() => {
    if (!user) return
    let cancelado = false

    async function carregar() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token || cancelado) return

      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (cancelado) return

      if (res.ok) {
        const json = await res.json()
        setRanking(json.ranking || [])
        setAtividades(json.atividades || null)
      }
      setCarregando(false)
    }

    carregar()
    return () => { cancelado = true }
  }, [user])

  const primeiroNome = perfil?.nome?.split(' ')[0]
  const a = atividades
  const totalDemandas = a?.demandas ?? 0
  const semNada = !!a && a.demandas === 0 && a.classificados === 0 && a.pets === 0

  // A frase que responde de imediato o que o cidadão quer saber
  function frameResumo() {
    if (!a) return 'Carregando suas informações...'
    if (semNada) return 'Você ainda não registrou nada por aqui.'
    if (totalDemandas === 0) return 'Seus anúncios estão publicados no mapa.'
    const atendidas = a.respondidas + a.resolvidas
    if (atendidas === 0) {
      return totalDemandas === 1
        ? 'Sua demanda foi enviada e aguarda resposta.'
        : `Suas ${totalDemandas} demandas aguardam resposta.`
    }
    if (atendidas === totalDemandas) {
      return totalDemandas === 1
        ? 'Sua demanda já foi atendida.'
        : `Todas as suas ${totalDemandas} demandas já foram atendidas.`
    }
    return `${atendidas} das suas ${totalDemandas} demandas já foram atendidas.`
  }

  // Evita piscar a tela enquanto a sessão é conferida ou o redirect acontece
  if (carregandoAuth || !user) {
    return <div style={{ height: '100dvh', background: '#f7f8fb' }} />
  }

  return (
    <div className="dash">
      <style>{`
        .dash {
          --papel: #f7f8fb;
          --marca: #4256c8;
          --marca-escura: #33429e;
          --tinta: #0d1425;
          --tinta-suave: #47536e;
          --tinta-fraca: #5d6880;
          --borda: rgba(66, 86, 200, 0.16);
          --borda-forte: rgba(66, 86, 200, 0.28);

          display: flex; flex-direction: column;
          height: 100dvh; overflow: hidden;
          background: var(--papel);
          color: var(--tinta);
        }

        .dash-corpo {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          gap: 12px;
          width: 100%; max-width: 600px;
          margin: 0 auto;
          padding: 16px 16px 18px;
          box-sizing: border-box;
        }

        .dash-titulo {
          font-family: var(--font-display), 'Plus Jakarta Sans', Inter, sans-serif;
          font-size: clamp(23px, 6.4vw, 30px);
          font-weight: 800; letter-spacing: -0.035em; line-height: 1.05;
          margin: 0; color: var(--tinta);
        }
        .dash-resumo {
          font-size: clamp(13px, 3.4vw, 15px); line-height: 1.5;
          color: var(--tinta-suave); margin: 6px 0 0; text-wrap: balance;
        }

        .dash-esquerda { display: flex; flex-direction: column; gap: 12px; min-height: 0; }

        .dash-cartao {
          background: #fff;
          border: 1px solid var(--borda);
          border-radius: 14px;
          display: flex; flex-direction: column;
          min-height: 0; overflow: hidden;
        }
        /* No mobile o card de autoridades ocupa a sobra e rola por dentro */
        .dash-corpo > .dash-cartao { flex: 1; }
        .dash-cartao-topo {
          padding: 13px 16px 11px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .dash-rotulo {
          font-size: 11px; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; color: var(--tinta-fraca); margin: 0;
        }

        /* Números grandes das demandas */
        .dash-numeros { display: flex; align-items: flex-end; gap: 0; }
        .dash-numero {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 3px;
          padding-left: 11px;
          border-left: 2px solid var(--cor);
        }
        .dash-numero:first-child { padding-left: 0; border-left: none; }
        .dash-numero b {
          font-family: var(--font-display), 'Plus Jakarta Sans', Inter, sans-serif;
          font-size: clamp(25px, 7.5vw, 32px); font-weight: 800;
          letter-spacing: -0.03em; line-height: 1;
          color: var(--cor); font-variant-numeric: tabular-nums;
        }
        .dash-numero span {
          font-size: 11.5px; color: var(--tinta-fraca); line-height: 1.25;
        }

        /* Barra proporcional dos estados */
        .dash-barra {
          display: flex; height: 7px; border-radius: 4px;
          overflow: hidden; background: rgba(66,86,200,0.09);
        }
        .dash-barra i { display: block; height: 100%; }

        /* Lista de autoridades */
        .dash-lista { overflow-y: auto; flex: 1; padding: 0 16px 12px; -webkit-overflow-scrolling: touch; }
        .dash-aut { padding: 9px 0; border-top: 1px solid rgba(66,86,200,0.10); }
        .dash-aut:first-child { border-top: none; }
        .dash-aut-linha { display: flex; align-items: center; gap: 9px; }
        .dash-pos {
          flex-shrink: 0; width: 19px; text-align: center;
          font-size: 11.5px; font-weight: 700; color: var(--tinta-fraca);
          font-variant-numeric: tabular-nums;
        }
        .dash-aut-nome {
          margin: 0; font-size: 13.5px; font-weight: 600; color: var(--tinta);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dash-aut-cargo {
          margin: 0; font-size: 11px; color: var(--tinta-fraca);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dash-taxa {
          flex-shrink: 0; text-align: right;
          font-size: 12.5px; font-weight: 700; color: var(--tinta-suave);
          font-variant-numeric: tabular-nums;
        }
        .dash-trilho {
          margin: 6px 0 0 28px; height: 4px; border-radius: 3px;
          background: rgba(66,86,200,0.10); overflow: hidden;
        }
        .dash-trilho i { display: block; height: 100%; border-radius: 3px; background: ${RESOLVIDA}; }

        /* Atalhos das camadas */
        .dash-atalhos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; flex-shrink: 0; }
        .dash-atalho {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          padding: 9px 4px; border-radius: 11px;
          border: 1px solid var(--borda); background: #fff;
          font-size: 11.5px; font-weight: 600; color: var(--tinta-suave);
          cursor: pointer; transition: border-color .15s, transform .1s;
          font-family: inherit;
        }
        .dash-atalho:hover { border-color: var(--borda-forte); }
        .dash-atalho:active { transform: scale(0.97); }
        .dash-atalho i { width: 7px; height: 7px; border-radius: 50%; background: var(--cor); }

        .dash-instalar {
          flex-shrink: 0; width: 100%;
          padding: 10px 16px; border-radius: 11px;
          border: 1px dashed var(--borda-forte); background: transparent;
          font-size: 12.5px; font-weight: 600; color: var(--marca-escura);
          cursor: pointer; font-family: inherit;
        }
        .dash-instalar:hover { background: rgba(66,86,200,0.05); }

        .dash-vazio { font-size: 13.5px; color: var(--tinta-suave); line-height: 1.6; margin: 0; }
        .dash-link {
          background: none; border: none; padding: 0; font-family: inherit;
          color: var(--marca); font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .dash-link:hover { text-decoration: underline; }

        /* Esqueleto de carregamento — mesma forma do conteúdo final */
        .dash-osso { background: rgba(66,86,200,0.09); border-radius: 6px; animation: dash-pulsa 1.4s ease-in-out infinite; }
        @keyframes dash-pulsa { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
        @media (prefers-reduced-motion: reduce) { .dash-osso { animation: none } }

        /* ---- desktop: duas colunas de verdade ---- */
        @media (min-width: 900px) {
          .dash-corpo {
            max-width: 1060px;
            padding: 26px 32px 26px;
            gap: 18px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr);
            align-content: start;
          }
          .dash-cabecalho { grid-column: 1 / -1; }
          .dash-esquerda { gap: 18px; }
          .dash-titulo { font-size: 34px; }
          .dash-resumo { font-size: 15.5px; }
          .dash-atalhos { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      <Navbar />

      <div className="dash-corpo">

        <header className="dash-cabecalho">
          <h1 className="dash-titulo">
            Olá{primeiroNome ? `, ${primeiroNome}` : ''}
          </h1>
          <p className="dash-resumo">{frameResumo()}</p>
        </header>

        <div className="dash-esquerda">

          {/* ---- minhas demandas ---- */}
          <section className="dash-cartao">
            <div className="dash-cartao-topo">
              <p className="dash-rotulo">Minhas demandas</p>
              {!carregando && totalDemandas > 0 && (
                <button className="dash-link" onClick={() => router.push('/perfil')}>
                  Ver todas
                </button>
              )}
            </div>

            <div style={{ padding: '0 16px 15px' }}>
              {carregando ? (
                <div style={{ display: 'flex', gap: '14px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ flex: 1 }}>
                      <div className="dash-osso" style={{ height: '30px', marginBottom: '7px' }} />
                      <div className="dash-osso" style={{ height: '11px', width: '70%' }} />
                    </div>
                  ))}
                </div>
              ) : totalDemandas === 0 ? (
                <>
                  <p className="dash-vazio">
                    Registre um problema do seu bairro e ele vai direto para a autoridade responsável.
                  </p>
                  <button
                    className="dash-link"
                    style={{ marginTop: '11px' }}
                    onClick={() => router.push('/mapa?camada=demandas')}>
                    Registrar minha primeira demanda
                  </button>
                </>
              ) : (
                <>
                  <div className="dash-numeros">
                    <Numero valor={a!.aguardando} rotulo="aguardando" cor={AGUARDANDO} />
                    <Numero valor={a!.respondidas} rotulo="respondidas" cor={RESPONDIDA} />
                    <Numero valor={a!.resolvidas} rotulo="resolvidas" cor={RESOLVIDA} />
                  </div>

                  {/* Proporção entre os estados, para leitura imediata */}
                  <div className="dash-barra" style={{ marginTop: '13px' }} aria-hidden="true">
                    <Fatia valor={a!.aguardando} total={totalDemandas} cor={AGUARDANDO} />
                    <Fatia valor={a!.respondidas} total={totalDemandas} cor={RESPONDIDA} />
                    <Fatia valor={a!.resolvidas} total={totalDemandas} cor={RESOLVIDA} />
                  </div>

                  {(a!.classificados > 0 || a!.pets > 0) && (
                    <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--tinta-fraca)' }}>
                      Você também tem{' '}
                      {a!.classificados > 0 && <strong style={{ color: 'var(--tinta-suave)' }}>{a!.classificados} classificado{a!.classificados > 1 ? 's' : ''}</strong>}
                      {a!.classificados > 0 && a!.pets > 0 && ' e '}
                      {a!.pets > 0 && <strong style={{ color: 'var(--tinta-suave)' }}>{a!.pets} pet{a!.pets > 1 ? 's' : ''}</strong>}
                      {' '}no mapa.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ---- atalhos ---- */}
          <div className="dash-atalhos">
            {CAMADAS.map(c => (
              <button
                key={c.camada}
                className="dash-atalho"
                style={{ '--cor': c.cor } as React.CSSProperties}
                onClick={() => router.push(`/mapa?camada=${c.camada}`)}>
                <i />
                {c.rotulo}
              </button>
            ))}
          </div>

          {(podeInstalar || ehIos) && (
            <button
              className="dash-instalar"
              onClick={() => { if (ehIos) setDicaIos(v => !v); else instalarPwa() }}>
              {dicaIos
                ? 'Toque em Compartilhar e depois em Adicionar à Tela de Início'
                : 'Instalar o app no seu celular'}
            </button>
          )}
        </div>

        {/* ---- autoridades ---- */}
        <section className="dash-cartao">
          <div className="dash-cartao-topo">
            <p className="dash-rotulo">Autoridades</p>
            <span style={{ fontSize: '11px', color: 'var(--tinta-fraca)' }}>respostas</span>
          </div>

          <div className="dash-lista">
            {carregando ? (
              [0, 1, 2, 3].map(i => (
                <div key={i} className="dash-aut">
                  <div className="dash-osso" style={{ height: '13px', width: `${70 - i * 8}%`, marginBottom: '6px' }} />
                  <div className="dash-osso" style={{ height: '4px', marginLeft: '28px' }} />
                </div>
              ))
            ) : ranking.length === 0 ? (
              <p className="dash-vazio">Nenhuma autoridade cadastrada ainda.</p>
            ) : (
              ranking.map((aut, i) => {
                const taxa = aut.total > 0 ? Math.round((aut.respondidas / aut.total) * 100) : null
                return (
                  <div key={aut.id} className="dash-aut">
                    <div className="dash-aut-linha">
                      <span className="dash-pos">{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="dash-aut-nome">{aut.nome}</p>
                        <p className="dash-aut-cargo">{aut.cargo}</p>
                      </div>
                      <span className="dash-taxa">
                        {aut.total === 0
                          ? <span style={{ color: 'var(--tinta-fraca)', fontWeight: 500 }}>sem demandas</span>
                          : `${aut.respondidas} de ${aut.total}`}
                      </span>
                    </div>
                    {taxa !== null && (
                      <div className="dash-trilho">
                        <i style={{ width: `${taxa}%` }} />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* Número grande de um estado, com a cor do próprio estado */
function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  return (
    <div className="dash-numero" style={{ '--cor': cor } as React.CSSProperties}>
      <b>{valor}</b>
      <span>{rotulo}</span>
    </div>
  )
}

/* Fatia da barra proporcional — some quando o estado está zerado */
function Fatia({ valor, total, cor }: { valor: number; total: number; cor: string }) {
  if (valor === 0) return null
  return <i style={{ width: `${(valor / total) * 100}%`, background: cor }} />
}
