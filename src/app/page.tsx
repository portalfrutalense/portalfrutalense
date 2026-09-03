'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/>
    </svg>
  )
}

/* ------------------------------------------------ gate navegador in-app -- */

// Instagram (e Facebook/Messenger) abrem links num WebView próprio, sem o
// motor completo de PWA — "Instalar aplicativo" ali dentro nunca funciona.
// Detecta esse navegador in-app e oferece sair pro navegador de verdade.
function navegadorInApp() {
  if (typeof navigator === 'undefined') return false
  return /Instagram|FBAN|FBAV/i.test(navigator.userAgent)
}

function InstagramGateCard({ onContinuar }: { onContinuar: () => void }) {
  function abrirNoNavegador() {
    const destino = window.location.origin + '/'
    // Android: o WebView do Instagram roda sobre o Chrome — um link
    // "intent://" força abrir no app do Chrome de verdade, fora do
    // WebView. iOS não tem equivalente via JS (só o menu "Abrir no
    // Safari" que o próprio Instagram expõe) — melhor esforço: abre numa
    // nova aba, que em algumas versões já escapa do WebView.
    if (/Android/i.test(navigator.userAgent)) {
      const semProtocolo = destino.replace(/^https?:\/\//, '')
      window.location.href = `intent://${semProtocolo}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(destino)};end`
    } else {
      window.open(destino, '_blank')
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <p>Para uma experiência completa</p>
      </div>
      <div className="cartao-corpo" style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
        <p style={{ margin: '0 0 4px', fontSize: 14, lineHeight: 1.55, color: 'var(--tinta-suave)', textAlign: 'center' }}>
          Abra no seu navegador para continuar.
        </p>
        <button type="button" className="btn-primario" onClick={abrirNoNavegador}>
          Abrir no navegador
        </button>
        <button type="button" className="btn-voltar" style={{ alignSelf: 'center', marginTop: 2 }} onClick={onContinuar}>
          Continuar aqui
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ card login -- */

// Fluxo unificado: tenta login → se não existe, pede confirmação de senha e cria conta
type FaseEmail = 'form' | 'confirmar' | 'ok' | 'esqueci'

function CardAcesso() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [fase, setFase] = useState<FaseEmail>('form')
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [carregandoFacebook, setCarregandoFacebook] = useState(false)
  // "?erro=login" vem do /auth/callback quando o login com Google falha —
  // antes disso o usuário só era jogado de volta pro mapa sem explicação
  // nenhuma. O valor inicial é lido direto no inicializador do useState (só
  // roda uma vez, na primeira renderização) — chamar setState dentro de um
  // useEffect pra isso é desencorajado a partir do React 19 (regra
  // react-hooks/set-state-in-effect), porque dispara uma renderização extra
  // logo depois da primeira. Lê via window.location (não useSearchParams)
  // pra não exigir um Suspense boundary só por causa disso.
  const [erro, setErro] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('erro') === 'login'
      ? 'Não foi possível concluir o login com o Google. Tente de novo.'
      : ''
  )
  const [msgEsqueci, setMsgEsqueci] = useState('')

  // Só a limpeza da URL é um efeito de verdade (mexe no histórico do
  // navegador, não em estado do React).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('erro') === 'login') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function enviarRedefinicao(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) {
      setErro('Erro ao enviar o e-mail. Verifique o endereço.')
    } else {
      setMsgEsqueci('E-mail enviado! Verifique sua caixa de entrada e clique no link para redefinir sua senha.')
    }
    setCarregando(false)
  }

  async function entrarComGoogle() {
    setCarregandoGoogle(true); setErro('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setErro('Não foi possível conectar com o Google. Tente de novo.'); setCarregandoGoogle(false) }
  }

  async function entrarComFacebook() {
    setCarregandoFacebook(true); setErro('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setErro('Não foi possível conectar com o Facebook. Tente de novo.'); setCarregandoFacebook(false) }
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)

    if (fase === 'form') {
      // Tenta login — se falhar por qualquer motivo, pede confirmação de senha
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (!error) return // sucesso — AuthProvider redireciona
      // Login falhou: pode ser senha errada OU conta nova. Vai para confirmação.
      setFase('confirmar')
      setCarregando(false)
      return
    }

    // fase === 'confirmar': tenta criar conta
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); setCarregando(false); return }
    if (senha !== senhaConfirm) { setErro('As senhas não coincidem.'); setCarregando(false); return }
    const { error: errSign } = await supabase.auth.signUp({ email, password: senha })
    if (!errSign) { setFase('ok'); setCarregando(false); return }
    // Se já existe → era senha errada
    if (errSign.message?.toLowerCase().includes('already')) {
      setFase('form')
      setSenhaConfirm('')
      setErro('Senha incorreta. Confira e tente de novo.')
    } else {
      setErro(errSign.message || 'Não foi possível criar a conta.')
    }
    setCarregando(false)
  }

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <p>Entre e comece a usar em segundos</p>
      </div>

      <div className="cartao-corpo">
        {fase === 'esqueci' ? (
          <>
            <button type="button" className="btn-voltar" onClick={() => { setFase('form'); setErro(''); setMsgEsqueci('') }}
              style={{ marginBottom: '8px' }}>
              ← Voltar
            </button>
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>Redefinir senha</p>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280' }}>
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
            {erro && <div className="aviso-erro" role="alert">{erro}</div>}
            {msgEsqueci ? (
              <div className="aviso-ok" role="status">{msgEsqueci}</div>
            ) : (
              <form onSubmit={enviarRedefinicao} className="formulario">
                <input
                  type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro('') }}
                  required placeholder="seu@email.com" aria-label="E-mail"
                  autoComplete="email" className="campo"
                />
                <button type="submit" disabled={carregando} className="btn-enviar">
                  {carregando ? 'Enviando…' : 'Enviar link de redefinição'}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            {fase !== 'confirmar' && (<>
              <button onClick={entrarComGoogle} disabled={carregandoGoogle} className="btn-primario">
                <GoogleIcon />
                {carregandoGoogle ? 'Redirecionando…' : 'Continuar com Google'}
              </button>
              <button onClick={entrarComFacebook} disabled={carregandoFacebook} className="btn-primario">
                <FacebookIcon />
                {carregandoFacebook ? 'Redirecionando…' : 'Continuar com Facebook'}
              </button>
              <div className="separador"><span>ou</span></div>
            </>)}

            {fase === 'ok' ? (
              <div className="aviso-ok" role="status">
                Conta criada com sucesso! Agora é só entrar.
              </div>
            ) : (
              <form onSubmit={submeter} className="formulario">
                {fase === 'confirmar' && (
                  <div className="aviso-info" role="status">
                    Email não encontrado. Se você ainda não tem conta, repita a senha abaixo para criá-la.
                  </div>
                )}
                {erro && <div className="aviso-erro" role="alert">{erro}</div>}
                <input
                  type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro('') }}
                  required placeholder="seu@email.com" aria-label="E-mail"
                  autoComplete="email" className="campo"
                />
                <input
                  type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }}
                  required aria-label="Senha"
                  autoComplete={fase === 'confirmar' ? 'new-password' : 'current-password'}
                  placeholder={fase === 'confirmar' ? 'Crie uma senha (mín. 6 caracteres)' : 'Sua senha'}
                  className="campo"
                />
                {fase === 'form' && (
                  <button type="button" onClick={() => { setFase('esqueci'); setErro('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4256c8', fontSize: '12px', padding: 0, textAlign: 'right', alignSelf: 'flex-end' }}>
                    Esqueci minha senha
                  </button>
                )}
                {fase === 'confirmar' && (
                  <input
                    type="password" value={senhaConfirm} onChange={(e) => { setSenhaConfirm(e.target.value); setErro('') }}
                    required aria-label="Confirmar senha"
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    className="campo"
                  />
                )}
                <button type="submit" disabled={carregando} className="btn-enviar">
                  {carregando ? 'Aguarde…' : fase === 'confirmar' ? 'Criar conta' : 'Entrar'}
                </button>
                {fase === 'confirmar' && (
                  <button type="button" className="btn-voltar" onClick={() => { setFase('form'); setErro(''); setSenhaConfirm('') }}>
                    ← Voltar
                  </button>
                )}
              </form>
            )}
          </>
        )}

        <p className="aviso-legal">
          Ao entrar, você concorda com nossos <Link href="/termos">Termos de Uso</Link> e <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- página -- */

export default function LandingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const [tremendo, setTremendo] = useState(false)
  // Só mostra o gate se: veio de um navegador in-app E ainda não dispensou
  // ("Continuar aqui") nesta aba/sessão.
  const [gateInApp, setGateInApp] = useState(() =>
    navegadorInApp() && typeof window !== 'undefined' && !sessionStorage.getItem('gate-in-app-dispensado')
  )

  function sacudir() {
    if (tremendo) return
    setTremendo(true)
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setTimeout(() => setTremendo(false), 600)
  }

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

  // Já logado — vai direto pro painel
  useEffect(() => {
    if (user) router.replace('/mapa')
  }, [user, router])

  if (user) return null

  return (
    <div className="palco">
      {/* fundo: o traçado da cidade, vivo */}
      <div className="fundo" aria-hidden="true">
        <MapaVivo />
        <div className="veu" />
        <div className="halo" />
      </div>

      {/* navbar — Entrar sacode o card */}
      <Navbar overlay onEntrar={sacudir} />

      <main className="grade">
        <section className="coluna-conteudo">
          <h1 className="titulo surge" style={{ animationDelay: '80ms' }}>
            Conectando Moradores,
            <br />
            <span className="titulo-realce">Melhorando Frutal</span>
          </h1>

          <p className="subtitulo surge" style={{ animationDelay: '210ms' }}>
            Explore os mapas interativos para ver e registrar demandas de serviços públicos, encontrar vagas de empregos, anunciar e comprar veículos e imóveis e ajudar a encontrar e adotar pets. Conte com o suporte do nosso assistente IA para guiar sua navegação.
          </p>
        </section>

        <section className={`coluna-acao surge${gateInApp ? ' coluna-acao-compacta' : ''}`} style={{ animationDelay: '260ms' }}>
          <div ref={cardRef} className={tremendo ? 'tremer' : ''}>
            {gateInApp ? (
              <InstagramGateCard onContinuar={() => {
                sessionStorage.setItem('gate-in-app-dispensado', '1')
                setGateInApp(false)
              }} />
            ) : (
              <CardAcesso />
            )}
          </div>
        </section>
      </main>

      <style>{`
        html.landing-lock-body, body.landing-lock-body {
          position: fixed; inset: 0; width: 100%; height: 100svh;
          overflow: hidden; overscroll-behavior: none; background: #f7f8fb;
        }

        .palco {
          --papel: #f7f8fb;
          --marca: #4256c8;
          --marca-escura: #33429e;
          --marca-clara: #6d83ff;
          --tinta: #0d1425;
          --tinta-suave: #47536e;
          /* 5.26:1 sobre o papel — os textos de apoio são pequenos e precisam
             passar no AA com folga, e no claro um cinza leve vira ilegível */
          --tinta-fraca: #5d6880;
          --borda: rgba(66, 86, 200, 0.16);
          --borda-forte: rgba(66, 86, 200, 0.28);
          --cartao: #ffffff;

          position: relative;
          height: 100dvh;
          overflow: hidden;
          background: var(--papel);
          color: var(--tinta);
          font-family: Inter, system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ---- fundo ---- */
        .fundo { position: absolute; inset: 0; pointer-events: none; }
        /* clareia o papel sob o texto para o traçado nunca disputar leitura */
        .veu {
          position: absolute; inset: 0;
          background:
            radial-gradient(115% 90% at 6% 44%, rgba(247,248,251,0.97) 0%, rgba(247,248,251,0.88) 34%, rgba(247,248,251,0.42) 66%, rgba(247,248,251,0.30) 100%),
            linear-gradient(180deg, rgba(247,248,251,0.92) 0%, rgba(247,248,251,0.20) 26%, rgba(247,248,251,0.26) 68%, rgba(247,248,251,0.94) 100%);
        }
        .halo {
          position: absolute; left: -14%; top: 16%;
          width: 60vw; height: 60vw; max-width: 800px; max-height: 800px;
          background: radial-gradient(circle, rgba(66,86,200,0.10) 0%, rgba(66,86,200,0) 70%);
          filter: blur(16px);
        }

        /* ---- estrutura ---- */
        .grade {
          position: relative; z-index: 2;
          flex: 1; min-height: 0;
          width: 100%; max-width: 1240px; margin: 0 auto;
          padding: clamp(10px, 2vh, 24px) clamp(20px, 5vw, 56px) clamp(8px, 1.5vh, 18px);
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 372px);
          align-items: center;
          gap: clamp(28px, 5vw, 64px);
          box-sizing: border-box;
        }
        /* a navbar ocupa o topo sempre — o palco cede o espaço */
        .grade { padding-top: calc(56px + clamp(8px, 1.5vh, 20px)); }

        .coluna-conteudo { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }

        .titulo {
          font-family: var(--font-display), 'Plus Jakarta Sans', Inter, sans-serif;
          font-size: clamp(36px, 4.4vw, 58px);
          font-weight: 800; line-height: 1.04; letter-spacing: -0.035em;
          margin: clamp(14px, 2.4vh, 26px) 0 clamp(28px, 4.5vh, 48px); text-wrap: balance;
          color: var(--tinta);
        }
        .titulo-realce { color: var(--marca); }

        .subtitulo {
          font-size: clamp(13px, 1.65vh, 16.5px); line-height: 1.62;
          color: var(--tinta-suave); max-width: 53ch; margin: 0;
        }

        /* ---- cartão de acesso ---- */
        .coluna-acao { min-width: 0; display: flex; justify-content: center; }

        .cartao {
          width: 372px; max-width: 100%; border-radius: 18px; overflow: hidden;
          border: 1px solid var(--borda); background: var(--cartao);
          box-shadow: 0 1px 2px rgba(13,20,37,0.05), 0 18px 45px -12px rgba(13,20,37,0.18);
          text-align: left; flex-shrink: 0;
        }
        .cartao-topo {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          padding: 14px 20px;
          background: var(--marca);
        }
        .cartao-topo p { margin: 0; font-size: 13px; font-weight: 600; color: #ffffff; }
        .cartao-corpo { padding: clamp(16px, 2.6vh, 22px); display: flex; flex-direction: column; gap: 10px; }

        .btn-primario, .btn-enviar {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          width: 100%; border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: transform .16s ease, box-shadow .16s ease, background .16s ease, border-color .16s ease;
        }
        /* botão do Google fica no branco oficial da marca deles: a hierarquia
           vem da borda firme e da sombra, não de recolorir o botão. Mesmo
           estilo reaproveitado pro Facebook (pedido do usuário: mesmo
           destaque dos dois, só o ícone/texto muda). */
        .btn-primario {
          padding: 12px 16px; border: 1px solid #dadce0; background: #ffffff; color: #1f1f1f;
          box-shadow: 0 1px 2px rgba(13,20,37,0.08), 0 4px 12px -4px rgba(13,20,37,0.15);
        }
        .btn-primario:hover:not(:disabled) {
          transform: translateY(-1px); border-color: #c6c9ce;
          box-shadow: 0 2px 4px rgba(13,20,37,0.10), 0 10px 20px -6px rgba(13,20,37,0.20);
        }
        .btn-primario:disabled { cursor: wait; opacity: .7; }

        .separador { display: flex; align-items: center; gap: 10px; margin: 2px 0; }
        .separador::before, .separador::after { content: ''; flex: 1; height: 1px; background: #e6e9f2; }
        .separador span { font-size: 11px; color: var(--tinta-fraca); text-transform: uppercase; letter-spacing: .1em; }

        .btn-enviar {
          padding: 11px; border: 1px solid #e6e9f2; margin-top: 2px;
          background: #fbfcfe; color: var(--tinta-suave); font-weight: 500;
          box-shadow: none;
        }
        .btn-enviar:hover:not(:disabled) { background: #f3f5fb; border-color: var(--borda-forte); color: var(--marca-escura); }
        .btn-enviar:disabled { opacity: .55; cursor: not-allowed; }

        .btn-voltar {
          align-self: flex-start; background: none; border: none; padding: 0;
          color: var(--tinta-fraca); font-size: 13px; cursor: pointer;
        }
        .btn-voltar:hover { color: var(--marca-escura); }

        .abas { display: flex; border-bottom: 1px solid #e6e9f2; }
        .aba {
          flex: 1; padding: 10px; background: none; border: none; cursor: pointer;
          font-size: 13px; font-weight: 500; color: var(--tinta-fraca);
          border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .aba-ativa { color: var(--marca-escura); font-weight: 700; border-bottom-color: var(--marca); }

        .formulario { display: flex; flex-direction: column; gap: 9px; }
        .campo {
          width: 100%; box-sizing: border-box; padding: 11px 14px; border-radius: 10px;
          border: 1px solid #dfe3ee; background: #fbfcfe;
          color: var(--tinta); font-size: 14px; outline: none;
          transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
        }
        .campo::placeholder { color: #7d8799; }
        .campo:focus {
          border-color: var(--marca); background: #ffffff;
          box-shadow: 0 0 0 3px rgba(66,86,200,0.16);
        }

        .aviso-erro {
          padding: 9px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5;
          background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
        }
        .aviso-ok {
          padding: 10px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5;
          background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
        }
        .aviso-info {
          padding: 9px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5;
          background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8;
        }

        /* ---- atalhos (logado) ---- */
        .atalhos { width: 100%; max-width: 372px; display: flex; flex-direction: column; gap: 10px; }
        .atalho {
          display: flex; align-items: center; gap: 13px; padding: 13px 15px;
          border-radius: 14px; border: 1px solid var(--borda); background: var(--cartao);
          text-decoration: none; color: var(--tinta);
          box-shadow: 0 1px 2px rgba(13,20,37,0.04), 0 10px 24px -14px rgba(13,20,37,0.22);
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .atalho:hover {
          transform: translateX(4px); border-color: var(--borda-forte);
          box-shadow: 0 2px 4px rgba(13,20,37,0.06), 0 14px 28px -12px rgba(13,20,37,0.26);
        }
        .atalho-icone {
          display: grid; place-items: center; width: 38px; height: 38px;
          border-radius: 11px; border: 1px solid; flex-shrink: 0;
        }
        .atalho-texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; text-align: left; }
        .atalho-texto strong { font-size: 14px; font-weight: 700; }
        .atalho-texto small { font-size: 12px; color: var(--tinta-fraca); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .atalho-seta { color: #7d8799; flex-shrink: 0; transition: transform .18s ease, color .18s ease; }
        .atalho:hover .atalho-seta { transform: translateX(3px); color: var(--marca); }

        /* ---- funcionalidades expansível ---- */
        .atalho-func { width: 100%; position: relative; }
        .atalho-func-btn { border-radius: 14px; border: 1px solid var(--borda); background: var(--cartao); box-shadow: 0 1px 2px rgba(13,20,37,0.04), 0 10px 24px -14px rgba(13,20,37,0.22); width: 100%; }
        .atalho-func-btn:hover { transform: translateX(4px); border-color: var(--borda-forte); box-shadow: 0 2px 4px rgba(13,20,37,0.06), 0 14px 28px -12px rgba(13,20,37,0.26); background: var(--cartao); }
        .atalho-chevron { color: #7d8799; flex-shrink: 0; transition: transform .22s ease, color .18s ease; display: flex; }
        .atalho-func-btn:hover .atalho-chevron { color: var(--marca); }
        .func-lista {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          background: var(--cartao); border: 1px solid var(--borda);
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 8px 24px -6px rgba(13,20,37,0.18), 0 2px 8px rgba(13,20,37,0.06);
          display: flex; flex-direction: column;
          z-index: 10;
        }
        .func-item {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 15px 11px 20px;
          font-size: 13.5px; font-weight: 500; color: var(--tinta-suave);
          text-decoration: none; border-bottom: 1px solid var(--borda);
          transition: background .15s ease, color .15s ease;
        }
        .func-item:last-child { border-bottom: none; }
        .func-item:hover { background: rgba(66,86,200,0.04); color: var(--marca-escura); }
        .func-ponto { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

        /* ---- tremor ao tentar acessar sem login ---- */
        @keyframes tremer {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-7px); }
          30%  { transform: translateX(6px); }
          45%  { transform: translateX(-5px); }
          60%  { transform: translateX(4px); }
          75%  { transform: translateX(-3px); }
          88%  { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        .tremer { animation: tremer 0.55s cubic-bezier(.36,.07,.19,.97) both; }

        /* ---- aviso legal (dentro do card de acesso) ---- */
        /* BUG CORRIGIDO (pedido do usuário): Termos de Uso/Política de
           Privacidade saíram do rodapé da página e entraram aqui, junto
           do próprio formulário de login/cadastro — mais visível e no
           lugar onde a ação de "entrar" de fato acontece. */
        .aviso-legal {
          margin: 12px 0 0; text-align: center; font-size: 11px;
          line-height: 1.5; color: var(--tinta-fraca);
        }
        .aviso-legal a { color: var(--tinta-fraca); text-decoration: underline; }
        .aviso-legal a:hover { color: var(--marca-escura); }

        /* ---- foco visível em tudo que é operável ---- */
        .palco a:focus-visible, .palco button:focus-visible, .palco .campo:focus-visible {
          outline: 2px solid var(--marca); outline-offset: 3px; border-radius: 8px;
        }

        /* ---- entrada ---- */
        .surge { animation: surge .62s cubic-bezier(.22,.68,.36,1) both; }
        @keyframes surge {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }

        /* ---- mobile: uma coluna, card fixo em baixo ---- */
        /* BUG CORRIGIDO / MUDANÇA DE COMPORTAMENTO (pedido do usuário): o
           card de acesso deixou de fazer parte do fluxo normal (coluna
           central) e virou um painel FIXO grudado embaixo da tela, 65% da
           altura, de ponta a ponta na lateral. Diferente do bottom sheet
           do mapa (SNAP peek/half/full) — aqui não tem alcinha, não
           arrasta, é uma altura fixa sempre, sem gesto nenhum. */
        @media (max-width: 860px) {
          .grade {
            display: flex;
            flex-direction: column;
            padding: calc(56px + 16px) clamp(20px, 6vw, 32px) 0;
            /* Espaço reservado embaixo pro card fixo não cobrir o texto */
            padding-bottom: 55dvh;
          }
          .coluna-conteudo { align-items: center; text-align: center; justify-content: center; flex: 1; }
          /* título fixo em 36px+ (clamp calibrado pra desktop) estourava o
             espaço reservado acima do card fixo em telas de ~800px de
             altura, cobrindo o fim do texto do subtítulo com o card. */
          .titulo { font-size: clamp(24px, 7.5vw, 38px); margin: 8px 0 12px; }
          .subtitulo { text-align: center; max-width: 100%; font-size: clamp(14px, 3.7vw, 17px); padding: 20px 0; }
          .coluna-acao {
            position: fixed; left: 0; right: 0; bottom: 0;
            height: 55dvh; z-index: 30;
            display: block; justify-content: unset;
          }
          /* BUG CORRIGIDO (achado testando ao vivo): existe uma div sem
             classe própria entre .coluna-acao e .cartao (o wrapper do
             efeito de "tremer" do botão Entrar da navbar) — sem isso ela
             ficava com altura automática (só o conteúdo), e o height:100%
             do .cartao herdava dessa altura pequena, não dos 55dvh do
             .coluna-acao. */
          .coluna-acao > div { height: 100%; }
          .cartao, .atalhos { max-width: 100%; width: 100%; }
          .cartao {
            height: 100%; border-radius: 20px 20px 0 0;
            display: flex; flex-direction: column;
          }
          .halo { left: -30%; top: 8%; width: 110vw; height: 110vw; }
          /* Gate de navegador in-app: card mais simples (só 2 botões),
             não precisa dos 55dvh do card de login. */
          .coluna-acao-compacta { height: 34dvh; }
        }

        /* card menor no mobile */
        @media (max-width: 860px) {
          .cartao-topo { padding: 9px 14px; font-size: 12px; flex-shrink: 0; }
          /* corpo rola por dentro se o conteúdo não couber nos 50% — é
             scroll comum de página, não o "arrastar o painel" que o
             usuário pediu pra não ter (o painel em si não se move).
             Padding lateral maior (pedido do usuário): encolhe a largura
             útil de campos/botões (que são width:100% do próprio pai) sem
             precisar mexer em cada um deles. */
          .cartao-corpo { padding: 10px 30px; gap: 5px; flex: 1; min-height: 0; overflow-y: auto; }
          /* Campos/botões mais altos (pedido do usuário) — padding
             vertical maior, largura já encolhida pelo padding acima. */
          .btn-primario, .btn-enviar { padding: 14px 12px; font-size: 13px; }
          .campo { padding: 14px 12px; font-size: 13px; }
          .formulario { gap: 6px; }
          .separador { margin: 0; }
          .separador span { font-size: 10px; }
        }

        /* telas curtas: enxuga o que é secundário para nada vazar da tela */
        @media (max-width: 860px) and (max-height: 620px) {
          .subtitulo { display: none; }
          .atalho { padding: 11px 13px; }
        }

        /* com o formulário de e-mail aberto o cartão cresce; numa tela baixa o
           conteúdo editorial cede o espaço para ele, em vez de ser encoberto */
        @media (max-width: 860px) and (max-height: 780px) {
          .palco:has(.formulario) .titulo { font-size: clamp(26px, 5.4vw, 30px); margin-top: 4px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .surge { animation: none; }
          .atalho, .btn-primario, .btn-enviar, .atalho-seta { transition: none; }
        }

        @media (hover: none) {
          .atalho, .atalho-func-btn { transition: none; }
          .atalho:hover, .atalho-func-btn:hover { transform: none; box-shadow: 0 1px 2px rgba(13,20,37,0.04), 0 10px 24px -14px rgba(13,20,37,0.22); border-color: var(--borda); }
        }
      `}</style>
    </div>
  )
}
