'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import MapaVivo from '@/components/MapaVivo'

/* ---------------------------------------------------------------- ícones -- */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function IconeSeta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="atalho-seta" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  )
}

const ATALHOS = [
  {
    href: '/mapa',
    titulo: 'Abrir o mapa',
    desc: 'Veja o que está acontecendo perto de você',
    cor: '#f5a524',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15"/>
      </svg>
    ),
  },
  {
    href: '/assistenteia',
    titulo: 'Falar com o Lucas',
    desc: 'O assistente te ajuda a registrar tudo',
    cor: '#22d3ee',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
  },
  {
    href: '/perfil',
    titulo: 'Minhas atividades',
    desc: 'Acompanhe suas demandas e respostas',
    cor: '#34d399',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
]

const CATEGORIAS = [
  { rotulo: 'Demandas municipais', cor: '#f5a524' },
  { rotulo: 'Empregos', cor: '#22d3ee' },
  { rotulo: 'Achei/Perdi um pet', cor: '#f472b6' },
  { rotulo: 'Classificados', cor: '#34d399' },
]

/* ------------------------------------------------------------- contador --- */

function Contador({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(0)
  const refValor = useRef(valor)
  refValor.current = valor

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMostrado(refValor.current)
      return
    }
    const duracao = 900
    const inicio = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const p = Math.min((agora - inicio) / duracao, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setMostrado(Math.round(refValor.current * eased))
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    // rede de segurança: em aba de fundo o requestAnimationFrame não dispara e o
    // número ficaria preso em zero — aqui ele chega ao valor real de todo jeito
    const garantia = window.setTimeout(() => setMostrado(refValor.current), duracao + 120)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(garantia) }
  }, [valor])

  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{mostrado}</span>
}

/* ---------------------------------------------------------- prova social -- */

/** Abaixo disso o contador não aparece — ver comentário no corpo do componente. */
const MINIMO_PARA_EXIBIR = 12

function ProvaSocial() {
  const [stats, setStats] = useState<{ total: number; resolvidas: number } | null>(null)

  useEffect(() => {
    let vivo = true
    const supabase = createClient()
    // limit(1) em vez de head:true — o count vem no header do GET e o corpo é
    // de uma linha só (o servidor responde 401 a requisições HEAD)
    Promise.all([
      supabase.from('demandas').select('id', { count: 'exact' }).limit(1),
      supabase.from('demandas').select('id', { count: 'exact' }).eq('status', 'resolvida').limit(1),
    ])
      .then(([todas, resolvidas]) => {
        // Sem número real disponível, o bloco simplesmente não aparece
        if (!vivo || todas.count == null) return
        setStats({ total: todas.count, resolvidas: resolvidas.count ?? 0 })
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  // Número real ou nada: enquanto a plataforma é nova, um contador baixo
  // enfraquece a página em vez de ajudar. O bloco aparece sozinho quando os
  // números passarem a falar por si.
  if (!stats || stats.total < MINIMO_PARA_EXIBIR) return null

  return (
    <div className="prova">
      <div className="prova-item">
        <strong><Contador valor={stats.total} /></strong>
        <span>{stats.total === 1 ? 'demanda registrada' : 'demandas registradas'}</span>
      </div>
      {stats.resolvidas > 0 && (
        <>
          <div className="prova-risco" aria-hidden="true" />
          <div className="prova-item">
            <strong style={{ color: '#34d399' }}><Contador valor={stats.resolvidas} /></strong>
            <span>{stats.resolvidas === 1 ? 'já resolvida' : 'já resolvidas'}</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ card login -- */

type Tela = 'inicial' | 'email'
type Aba = 'entrar' | 'cadastrar'

function CardAcesso() {
  const supabase = createClient()
  const [tela, setTela] = useState<Tela>('inicial')
  const [aba, setAba] = useState<Aba>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function entrarComGoogle() {
    setCarregandoGoogle(true); setErro('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    })
    if (error) { setErro('Não foi possível conectar com o Google. Tente de novo.'); setCarregandoGoogle(false) }
  }

  async function entrarComEmail(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('E-mail ou senha incorretos. Confira e tente de novo.'); setCarregando(false) }
  }

  async function cadastrarComEmail(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    setCarregando(true)
    const { error } = await supabase.auth.signUp({ email, password: senha })
    if (error) {
      setErro('Não foi possível criar a conta. Verifique o e-mail digitado.')
      setCarregando(false)
    } else {
      setSucesso('Conta criada! Confirme pelo link que enviamos no seu e-mail para poder entrar.')
      setCarregando(false)
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <span className="ponto-vivo" aria-hidden="true" />
        <p>Entre e comece a usar em segundos</p>
      </div>

      <div className="cartao-corpo">
        {tela === 'inicial' ? (
          <>
            <button onClick={entrarComGoogle} disabled={carregandoGoogle} className="btn-primario">
              <GoogleIcon />
              {carregandoGoogle ? 'Redirecionando…' : 'Continuar com Google'}
            </button>
            <p className="dica-primaria">O jeito mais rápido — sem criar senha</p>

            <div className="separador"><span>ou</span></div>

            <button onClick={() => setTela('email')} className="btn-secundario">
              <EmailIcon />
              Entrar com e-mail
            </button>

            {erro && <div className="aviso-erro" role="alert">{erro}</div>}
          </>
        ) : (
          <>
            <button onClick={() => { setTela('inicial'); setErro(''); setSucesso('') }} className="btn-voltar">
              ← Voltar
            </button>

            <div className="abas" role="tablist">
              {(['entrar', 'cadastrar'] as Aba[]).map((a) => (
                <button
                  key={a}
                  role="tab"
                  aria-selected={aba === a}
                  onClick={() => { setAba(a); setErro(''); setSucesso('') }}
                  className={`aba${aba === a ? ' aba-ativa' : ''}`}
                >
                  {a === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            {erro && <div className="aviso-erro" role="alert">{erro}</div>}
            {sucesso && <div className="aviso-ok" role="status">{sucesso}</div>}

            {!sucesso && (
              <form onSubmit={aba === 'entrar' ? entrarComEmail : cadastrarComEmail} className="formulario">
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="seu@email.com" aria-label="E-mail"
                  autoComplete="email" className="campo"
                />
                <input
                  type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                  required aria-label="Senha"
                  autoComplete={aba === 'cadastrar' ? 'new-password' : 'current-password'}
                  placeholder={aba === 'cadastrar' ? 'Crie uma senha (mín. 6 caracteres)' : 'Sua senha'}
                  className="campo"
                />
                <button type="submit" disabled={carregando} className="btn-enviar">
                  {carregando ? 'Aguarde…' : aba === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------- atalhos logado -- */

function Atalhos() {
  return (
    <div className="atalhos">
      {ATALHOS.map(({ href, titulo, desc, cor, icone }) => (
        <Link key={href} href={href} className="atalho">
          <span className="atalho-icone" style={{ color: cor, background: `${cor}1a`, borderColor: `${cor}33` }}>
            {icone}
          </span>
          <span className="atalho-texto">
            <strong>{titulo}</strong>
            <small>{desc}</small>
          </span>
          <IconeSeta />
        </Link>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- página -- */

export default function LandingPage() {
  const { user } = useAuth()

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.classList.add('landing-lock-body')
    body.classList.add('landing-lock-body')
    return () => {
      html.classList.remove('landing-lock-body')
      body.classList.remove('landing-lock-body')
    }
  }, [])

  return (
    <div className={`palco${user ? ' palco-logado' : ''}`}>
      {/* fundo: o traçado da cidade, vivo */}
      <div className="fundo" aria-hidden="true">
        <MapaVivo />
        <div className="veu" />
        <div className="halo" />
      </div>

      {/* navbar — inalterada, só aparece quando logado */}
      {user && <Navbar overlay />}

      <main className="grade">
        <section className="coluna-conteudo">
          <div className="etiqueta surge" style={{ animationDelay: '40ms' }}>
            <span className="ponto-vivo" aria-hidden="true" />
            Frutal · Minas Gerais
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/CIDADANIA.png" alt="CidadanIA Frutal"
            className="marca surge" style={{ animationDelay: '90ms' }}
          />

          <h1 className="titulo surge" style={{ animationDelay: '150ms' }}>
            Tudo o que acontece em Frutal,
            <br />
            <span className="titulo-realce">no mesmo mapa.</span>
          </h1>

          <p className="subtitulo surge" style={{ animationDelay: '210ms' }}>
            Um buraco na rua, uma vaga de emprego, um cachorro perdido. Cada pino é
            alguém daqui pedindo ou oferecendo algo — e o Lucas, nosso assistente,
            te guia em cada passo.
          </p>

          <ul className="categorias surge" style={{ animationDelay: '270ms' }}>
            {CATEGORIAS.map(({ rotulo, cor }) => (
              <li key={rotulo}>
                <span className="categoria-ponto" style={{ background: cor, boxShadow: `0 0 10px ${cor}99` }} aria-hidden="true" />
                {rotulo}
              </li>
            ))}
          </ul>

          <div className="surge" style={{ animationDelay: '330ms' }}>
            <ProvaSocial />
          </div>
        </section>

        <section className="coluna-acao surge" style={{ animationDelay: '260ms' }}>
          {user ? <Atalhos /> : <CardAcesso />}
        </section>
      </main>

      <footer className="rodape">
        <Link href="/termos">Termos de Uso</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacidade">Política de Privacidade</Link>
      </footer>

      <style>{`
        html.landing-lock-body, body.landing-lock-body {
          position: fixed; inset: 0; width: 100%; height: 100svh;
          overflow: hidden; overscroll-behavior: none; background: #05080f;
        }

        .palco {
          --noite: #05080f;
          --marca: #4256c8;
          --marca-clara: #6d83ff;
          --brilho: #8ea2f5;
          --tinta: #ffffff;
          --tinta-suave: rgba(226, 232, 255, 0.72);
          --tinta-fraca: rgba(200, 212, 245, 0.55);
          --borda: rgba(140, 165, 255, 0.16);
          --vidro: rgba(12, 18, 38, 0.72);

          position: relative;
          height: 100dvh;
          overflow: hidden;
          background: var(--noite);
          color: var(--tinta);
          font-family: Inter, system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ---- fundo ---- */
        .fundo { position: absolute; inset: 0; pointer-events: none; }
        .veu {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 90% at 8% 40%, rgba(5,8,15,0.94) 0%, rgba(5,8,15,0.72) 38%, rgba(5,8,15,0.30) 70%, rgba(5,8,15,0.55) 100%),
            linear-gradient(180deg, rgba(5,8,15,0.85) 0%, rgba(5,8,15,0.15) 30%, rgba(5,8,15,0.25) 65%, rgba(5,8,15,0.92) 100%);
        }
        .halo {
          position: absolute; left: -12%; top: 18%;
          width: 58vw; height: 58vw; max-width: 760px; max-height: 760px;
          background: radial-gradient(circle, rgba(66,86,200,0.28) 0%, rgba(66,86,200,0) 68%);
          filter: blur(14px);
        }

        /* ---- estrutura ---- */
        .grade {
          position: relative; z-index: 2;
          flex: 1; min-height: 0;
          width: 100%; max-width: 1240px; margin: 0 auto;
          padding: clamp(20px, 4vh, 48px) clamp(20px, 5vw, 56px) clamp(12px, 2.5vh, 28px);
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 372px);
          align-items: center;
          gap: clamp(28px, 5vw, 64px);
          box-sizing: border-box;
        }
        /* quando logado, a navbar ocupa o topo — o palco cede o espaço dela */
        .palco-logado .grade { padding-top: calc(56px + clamp(16px, 3vh, 36px)); }

        .coluna-conteudo { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }

        .etiqueta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 12px 5px 10px; border-radius: 999px;
          border: 1px solid var(--borda); background: rgba(66,86,200,0.14);
          font-size: 11.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase;
          color: var(--brilho);
        }
        .ponto-vivo {
          width: 6px; height: 6px; border-radius: 50%; background: #34d399;
          box-shadow: 0 0 0 0 rgba(52,211,153,0.65); animation: pulsa 2.4s ease-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulsa {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.55); }
          70%  { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }

        .marca {
          height: clamp(58px, 9.5vh, 104px); width: auto; max-width: 82%;
          display: block; margin: clamp(14px, 2.4vh, 26px) 0 clamp(10px, 1.8vh, 20px);
        }

        .titulo {
          font-family: var(--font-display), 'Plus Jakarta Sans', Inter, sans-serif;
          font-size: clamp(28px, 4.4vw, 58px);
          font-weight: 800; line-height: 1.04; letter-spacing: -0.035em;
          margin: 0 0 clamp(10px, 1.8vh, 20px); text-wrap: balance;
          text-shadow: 0 2px 30px rgba(0,0,0,0.45);
        }
        .titulo-realce {
          background: linear-gradient(96deg, var(--brilho) 0%, #b7c4ff 52%, var(--marca-clara) 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }

        .subtitulo {
          font-size: clamp(13px, 1.65vh, 16.5px); line-height: 1.62;
          color: var(--tinta-suave); max-width: 53ch; margin: 0;
          text-shadow: 0 1px 12px rgba(0,0,0,0.4);
        }

        .categorias {
          list-style: none; margin: clamp(14px, 2.4vh, 26px) 0 0; padding: 0;
          display: flex; flex-wrap: wrap; gap: 8px;
        }
        .categorias li {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 13px; border-radius: 999px;
          border: 1px solid var(--borda); background: rgba(12,18,38,0.55);
          font-size: 12.5px; font-weight: 500; color: var(--tinta-suave);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          white-space: nowrap;
        }
        .categoria-ponto { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ---- prova social ---- */
        .prova {
          display: flex; align-items: center; gap: clamp(14px, 2vw, 22px);
          margin-top: clamp(16px, 2.6vh, 28px);
        }
        .prova-item { display: flex; align-items: baseline; gap: 7px; }
        .prova-item strong {
          font-family: var(--font-display), 'Plus Jakarta Sans', Inter, sans-serif;
          font-size: clamp(20px, 2.9vh, 30px); font-weight: 800; letter-spacing: -0.02em;
          color: var(--tinta);
        }
        .prova-item span { font-size: 12.5px; color: var(--tinta-fraca); }
        .prova-risco { width: 1px; height: 26px; background: var(--borda); }

        /* ---- cartão de acesso ---- */
        .coluna-acao { min-width: 0; display: flex; justify-content: center; }

        .cartao {
          width: 100%; max-width: 372px; border-radius: 18px; overflow: hidden;
          border: 1px solid var(--borda); background: var(--vidro);
          backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);
          box-shadow: 0 30px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset;
        }
        .cartao-topo {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          padding: 14px 20px;
          background: linear-gradient(180deg, rgba(66,86,200,0.36), rgba(66,86,200,0.16));
          border-bottom: 1px solid var(--borda);
        }
        .cartao-topo p { margin: 0; font-size: 13px; font-weight: 600; color: #dfe6ff; }
        .cartao-corpo { padding: clamp(16px, 2.6vh, 22px); display: flex; flex-direction: column; gap: 10px; }

        .btn-primario, .btn-secundario, .btn-enviar {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          width: 100%; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: transform .16s ease, box-shadow .16s ease, background .16s ease, border-color .16s ease;
        }
        .btn-primario {
          padding: 12px 16px; border: none; background: #ffffff; color: #0d1425;
          box-shadow: 0 8px 22px rgba(0,0,0,0.35);
        }
        .btn-primario:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(0,0,0,0.45); }
        .btn-primario:disabled { cursor: wait; opacity: .75; }
        .dica-primaria { margin: -2px 0 0; text-align: center; font-size: 11.5px; color: var(--tinta-fraca); }

        .separador { display: flex; align-items: center; gap: 10px; margin: 2px 0; }
        .separador::before, .separador::after { content: ''; flex: 1; height: 1px; background: var(--borda); }
        .separador span { font-size: 11px; color: var(--tinta-fraca); text-transform: uppercase; letter-spacing: .1em; }

        .btn-secundario {
          padding: 11px 16px; border: 1px solid var(--borda);
          background: rgba(255,255,255,0.04); color: #e6ebff;
        }
        .btn-secundario:hover { background: rgba(255,255,255,0.09); border-color: rgba(140,165,255,0.32); }

        .btn-enviar {
          padding: 12px; border: none; margin-top: 2px;
          background: linear-gradient(180deg, var(--marca-clara), var(--marca)); color: #fff;
          box-shadow: 0 8px 22px rgba(66,86,200,0.4);
        }
        .btn-enviar:hover:not(:disabled) { transform: translateY(-1px); }
        .btn-enviar:disabled { opacity: .6; cursor: not-allowed; box-shadow: none; }

        .btn-voltar {
          align-self: flex-start; background: none; border: none; padding: 0;
          color: var(--tinta-fraca); font-size: 13px; cursor: pointer;
        }
        .btn-voltar:hover { color: #e6ebff; }

        .abas { display: flex; border-bottom: 1px solid var(--borda); }
        .aba {
          flex: 1; padding: 10px; background: none; border: none; cursor: pointer;
          font-size: 13px; font-weight: 500; color: var(--tinta-fraca);
          border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .aba-ativa { color: #fff; font-weight: 700; border-bottom-color: var(--marca-clara); }

        .formulario { display: flex; flex-direction: column; gap: 9px; }
        .campo {
          width: 100%; box-sizing: border-box; padding: 11px 14px; border-radius: 10px;
          border: 1px solid var(--borda); background: rgba(255,255,255,0.05);
          color: #fff; font-size: 14px; outline: none;
          transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
        }
        .campo::placeholder { color: rgba(200,212,245,0.42); }
        .campo:focus {
          border-color: var(--marca-clara); background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px rgba(109,131,255,0.24);
        }

        .aviso-erro {
          padding: 9px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5;
          background: rgba(239,68,68,0.14); border: 1px solid rgba(248,113,113,0.34); color: #fecaca;
        }
        .aviso-ok {
          padding: 10px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5;
          background: rgba(52,211,153,0.13); border: 1px solid rgba(52,211,153,0.34); color: #a7f3d0;
        }

        /* ---- atalhos (logado) ---- */
        .atalhos { width: 100%; max-width: 372px; display: flex; flex-direction: column; gap: 10px; }
        .atalho {
          display: flex; align-items: center; gap: 13px; padding: 13px 15px;
          border-radius: 14px; border: 1px solid var(--borda); background: var(--vidro);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          text-decoration: none; color: #fff;
          transition: transform .18s ease, border-color .18s ease, background .18s ease;
        }
        .atalho:hover { transform: translateX(4px); border-color: rgba(140,165,255,0.34); background: rgba(18,26,52,0.85); }
        .atalho-icone {
          display: grid; place-items: center; width: 38px; height: 38px;
          border-radius: 11px; border: 1px solid; flex-shrink: 0;
        }
        .atalho-texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .atalho-texto strong { font-size: 14px; font-weight: 700; }
        .atalho-texto small { font-size: 12px; color: var(--tinta-fraca); }
        .atalho-seta { color: var(--tinta-fraca); flex-shrink: 0; transition: transform .18s ease, color .18s ease; }
        .atalho:hover .atalho-seta { transform: translateX(3px); color: var(--brilho); }

        /* ---- rodapé ---- */
        /* item do fluxo, não sobreposto: assim sempre reserva o próprio espaço
           e nunca cobre o conteúdo em telas baixas */
        .rodape {
          position: relative; z-index: 2; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 0 16px 14px; font-size: 12px; color: var(--tinta-fraca);
        }
        .rodape a { color: var(--tinta-fraca); text-decoration: none; }
        .rodape a:hover { color: #dfe6ff; text-decoration: underline; }

        /* ---- foco visível em tudo que é operável ---- */
        .palco a:focus-visible, .palco button:focus-visible, .palco .campo:focus-visible {
          outline: 2px solid var(--marca-clara); outline-offset: 3px; border-radius: 8px;
        }

        /* ---- entrada ---- */
        .surge { animation: surge .62s cubic-bezier(.22,.68,.36,1) both; }
        @keyframes surge {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }

        /* ---- mobile: uma coluna, tudo dentro da tela, sem scroll ---- */
        @media (max-width: 860px) {
          .grade {
            grid-template-columns: 1fr;
            align-content: center;
            gap: clamp(14px, 2.4vh, 22px);
            padding: clamp(16px, 3vh, 28px) 20px clamp(10px, 2vh, 18px);
          }
          .coluna-acao { justify-content: flex-start; }
          .cartao, .atalhos { max-width: 100%; }
          .halo { left: -30%; top: 8%; width: 110vw; height: 110vw; }
          .subtitulo { max-width: 100%; }
        }

        /* telas curtas: enxuga o que é secundário para nada vazar da tela */
        @media (max-width: 860px) and (max-height: 720px) {
          .subtitulo { display: none; }
          .categorias { gap: 6px; }
          .categorias li { font-size: 11.5px; padding: 5px 10px; }
          .prova { margin-top: 12px; }
          .cartao-topo { padding: 10px 16px; }
          .cartao-corpo { padding: 14px; gap: 8px; }
          .separador { margin: 0; }
          .btn-primario, .btn-secundario, .btn-enviar { padding: 10px 14px; }
          .campo { padding: 10px 13px; }
          .atalho { padding: 11px 13px; }
        }
        @media (max-width: 860px) and (max-height: 620px) {
          .categorias, .prova, .etiqueta { display: none; }
          .marca { margin: 6px 0 8px; }
        }

        /* com o formulário de e-mail aberto o cartão cresce; numa tela baixa o
           conteúdo editorial cede o espaço para ele, em vez de ser encoberto */
        @media (max-width: 860px) and (max-height: 780px) {
          .palco:has(.formulario) .categorias,
          .palco:has(.formulario) .prova,
          .palco:has(.formulario) .etiqueta,
          .palco:has(.formulario) .subtitulo { display: none; }
          .palco:has(.formulario) .marca { margin: 4px 0 8px; height: clamp(46px, 7vh, 68px); }
          .palco:has(.formulario) .titulo { font-size: clamp(22px, 5.4vw, 30px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .surge { animation: none; }
          .ponto-vivo { animation: none; }
          .atalho, .btn-primario, .btn-enviar, .atalho-seta { transition: none; }
        }
      `}</style>
    </div>
  )
}
