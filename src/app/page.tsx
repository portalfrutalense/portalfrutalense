'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

type Tela = 'inicial' | 'email'
type Aba = 'entrar' | 'cadastrar'

function CardLogin() {
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
    if (error) { setErro('Erro ao conectar com Google.'); setCarregandoGoogle(false) }
  }

  async function entrarComEmail(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('E-mail ou senha incorretos.'); setCarregando(false) }
  }

  async function cadastrarComEmail(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); setCarregando(false); return }
    const { error } = await supabase.auth.signUp({ email, password: senha })
    if (error) {
      setErro('Erro ao cadastrar. Verifique o e-mail.')
      setCarregando(false)
    } else {
      setSucesso('Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.')
      setCarregando(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '340px', boxShadow: '0 20px 80px rgba(0,0,0,0.55)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ background: '#4256c8', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'white', fontWeight: 700, textAlign: 'center' }}>
          Faça login ou registre-se em segundos
        </p>
      </div>
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {tela === 'inicial' ? (
          <>
            <button onClick={entrarComGoogle} disabled={carregandoGoogle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: carregandoGoogle ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 600, color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <GoogleIcon />
              {carregandoGoogle ? 'Redirecionando...' : 'Continuar com Google'}
            </button>
            <button onClick={() => setTela('email')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <EmailIcon />
              Entrar com e-mail
            </button>
            {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}
          </>
        ) : (
          <>
            <button onClick={() => { setTela('inicial'); setErro(''); setSucesso('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
              ← Voltar
            </button>
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
              {(['entrar', 'cadastrar'] as Aba[]).map((a) => (
                <button key={a} onClick={() => { setAba(a); setErro(''); setSucesso('') }}
                  style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: aba === a ? 700 : 400, color: aba === a ? '#4256c8' : '#6b7280', background: 'none', border: 'none', borderBottom: aba === a ? '2px solid #4256c8' : '2px solid transparent', cursor: 'pointer' }}>
                  {a === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>
            {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}
            {sucesso && <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>{sucesso}</div>}
            {!sucesso && (
              <form onSubmit={aba === 'entrar' ? entrarComEmail : cadastrarComEmail}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com"
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
                  placeholder={aba === 'cadastrar' ? 'Crie uma senha (mín. 6 caracteres)' : 'Sua senha'}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                <button type="submit" disabled={carregando}
                  style={{ backgroundColor: carregando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 700, padding: '12px', borderRadius: '8px', border: 'none', cursor: carregando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {carregando ? 'Aguarde...' : aba === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>
              </form>
            )}
          </>
        )}
        <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          Ao entrar, você concorda com os{' '}
          <a href="/termos" target="_blank" style={{ color: '#4256c8' }}>Termos de Uso</a>
          {' '}e a{' '}
          <a href="/privacidade" target="_blank" style={{ color: '#4256c8' }}>Política de Privacidade</a>.
        </p>
      </div>
    </div>
  )
}


export default function LandingPage() {
  const { user } = useAuth()
  const [modalLogin, setModalLogin] = useState(false)

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
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", height: '100dvh', overflow: 'hidden' }}>

      {/* Navbar azul — só aparece quando logado */}
      {user && <Navbar overlay />}

      {/* HERO — página inteira */}
      <section className={`landing-section${user ? ' landing-logado' : ''}`} style={{
        backgroundImage: "url('/fundo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: 'clamp(72px, 12vh, 140px) clamp(20px, 5vw, 48px) clamp(16px, 4vh, 80px)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Blur desktop: lado esquerdo com fade suave */}
        <div className="blur-desktop" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '75%', backdropFilter: 'blur(1px)', WebkitBackdropFilter: 'blur(1px)', WebkitMaskImage: 'linear-gradient(to right, black 0%, black 35%, transparent 100%)', maskImage: 'linear-gradient(to right, black 0%, black 35%, transparent 100%)', pointerEvents: 'none' }} />
        {/* Blur mobile: tela inteira */}
        <div className="blur-mobile" style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', pointerEvents: 'none', display: 'none' }} />
        {/* Gradiente escuro */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,15,30,0.82) 0%, rgba(10,15,30,0.4) 45%, rgba(10,15,30,0) 100%)', pointerEvents: 'none' }} />

        <div className="landing-inner" style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px', flexWrap: 'wrap' }}>

          {/* Coluna esquerda */}
          <div className="landing-col-esquerda" style={{ maxWidth: '720px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CIDADANIA.png" alt="CidadanIA Frutal" className="landing-logo" style={{ height: 'clamp(160px, 24vh, 320px)', width: 'auto', maxWidth: '100%', display: 'block', marginBottom: 'clamp(10px, 2vh, 20px)' }} />

            <h1 className="landing-h1" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontSize: 'clamp(20px, 3vw, 36px)', fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.03em', color: '#ffffff', marginTop: 'clamp(40px, 10vh, 100px)', marginBottom: 'clamp(10px, 2vh, 24px)', paddingLeft: '15px', textShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
              Navegue por Frutal<br />
              <span style={{ color: '#8ea2f5' }}>Explore tudo ao seu redor</span>
            </h1>

            <p className="landing-descricao" style={{ fontSize: 'clamp(13px, 2vh, 17px)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, maxWidth: '520px', margin: 0, paddingLeft: '15px', textShadow: '0 1px 8px rgba(0,0,0,0.2)' }}>
              Uma plataforma visual e interativa onde cada pino é uma oportunidade ou solução.
              Mude as camadas do mapa para cobrar melhorias públicas, achar empregos, localizar
              pets, entre outras. O Lucas (nosso assistente IA) te guia em cada passo.
            </p>
          </div>

          {/* Coluna direita — desktop only */}
          {!user && (
            <div className="landing-col-direita" style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <CardLogin />
            </div>
          )}

          {/* Card de login inline no mobile — abaixo do texto */}
          {!user && (
            <div className="landing-login-mobile" style={{ display: 'none', width: '100%' }}>
              <CardLogin />
            </div>
          )}
        </div>
      </section>

      {/* Botão flutuante inferior — só mobile, só quando não logado */}
      {!user && (
        <button
          className="landing-btn-login-mobile"
          onClick={() => setModalLogin(true)}
          style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: '#4256c8', color: 'white', fontWeight: 700, fontSize: '15px', padding: '14px 32px', borderRadius: '50px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', display: 'none' }}
        >
          Entre ou registre-se
        </button>
      )}

      {/* Links de Termos/Privacidade — só texto flutuando por cima da foto, sem rodapé */}
      <div style={{ position: 'fixed', bottom: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '16px' }}>
        <Link href="/termos" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>Termos de Uso</Link>
        <Link href="/privacidade" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>Política de Privacidade</Link>
      </div>

      {/* Modal de login (abre pelo botão Entrar da navbar no mobile) */}
      {modalLogin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalLogin(false) }}>
          <div style={{ width: '100%', maxWidth: '340px', position: 'relative' }}>
            <button onClick={() => setModalLogin(false)} style={{ position: 'absolute', top: '-36px', right: 0, background: 'none', border: 'none', color: 'white', fontSize: '14px', cursor: 'pointer', opacity: 0.7 }}>
              Fechar ✕
            </button>
            <CardLogin />
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        html.landing-lock-body, body.landing-lock-body {
          position: fixed; inset: 0; width: 100%; height: 100svh; overflow: hidden; overscroll-behavior: none;
        }
        .landing-col-direita { display: flex !important; }
        @media (max-width: 768px) {
          .blur-desktop { display: none !important; }
          .blur-mobile { display: block !important; }
          .landing-col-direita { display: none !important; }
          .landing-btn-login-mobile { display: none !important; }
          /* Logo menor e sem margem extra */
          .landing-logo { height: clamp(60px, 15vw, 100px) !important; margin-top: 0 !important; margin-bottom: 8px !important; }
          /* Título sem margem top grande */
          .landing-h1 { margin-top: 8px !important; margin-bottom: 8px !important; font-size: clamp(18px, 5vw, 26px) !important; }
          /* Quando logado no mobile */
          .landing-logado .landing-col-esquerda { margin-top: 90px !important; }
          .landing-logado .landing-logo { height: clamp(80px, 22vw, 130px) !important; }
          .landing-logado .landing-h1 { margin-top: 78px !important; }
          .landing-logado .landing-descricao { margin-top: 130px !important; }
          /* Layout coluna no mobile */
          .landing-inner { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; justify-content: flex-start !important; }
          /* Card login inline aparece */
          .landing-login-mobile { display: block !important; margin-top: 90px !important; }
          /* Section padding menor no mobile (sem navbar) */
          .landing-section { padding-top: 20px !important; align-items: flex-start !important; }
        }
      `}</style>
    </div>
  )
}
