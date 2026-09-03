'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'

interface Props {
  onFechar: () => void
}

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

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/>
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

type Tela = 'inicial' | 'email' | 'esqueci'

export default function ModalAuth({ onFechar }: Props) {
  const supabase = createClient()
  const { user } = useAuth()
  const [tela, setTela] = useState<Tela>('inicial')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [fase, setFase] = useState<'form' | 'confirmar' | 'ok'>('form')
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [carregandoFacebook, setCarregandoFacebook] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // BUG CORRIGIDO: signInWithPassword bem-sucedido só atualiza o estado de
  // auth (via onAuthStateChange, no AuthProvider) — não fecha este modal
  // sozinho. Sem isso, `submeter()` retorna cedo (linha abaixo) sem nunca
  // chamar setCarregando(false) nem onFechar(), e a tela ficava presa em
  // "Aguarde..." pra sempre, mesmo com o login já concluído. Fecha assim
  // que o AuthProvider confirma que existe um usuário logado — cobre login
  // por e-mail/senha e também o retorno do Google, caso o modal de alguma
  // forma continue montado nesse momento.
  useEffect(() => {
    if (user) onFechar()
  }, [user, onFechar])

  async function entrarComGoogle() {
    setCarregandoGoogle(true); setErro('')
    const volta = encodeURIComponent(window.location.pathname + window.location.search)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${volta}` },
    })
    if (error) { setErro('Erro ao conectar com Google.'); setCarregandoGoogle(false) }
  }

  async function entrarComFacebook() {
    setCarregandoFacebook(true); setErro('')
    const volta = encodeURIComponent(window.location.pathname + window.location.search)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${volta}` },
    })
    if (error) { setErro('Erro ao conectar com Facebook.'); setCarregandoFacebook(false) }
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    if (fase === 'form') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (!error) return
      setFase('confirmar'); setCarregando(false); return
    }
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); setCarregando(false); return }
    if (senha !== senhaConfirm) { setErro('As senhas não coincidem.'); setCarregando(false); return }
    const { error: errSign } = await supabase.auth.signUp({ email, password: senha })
    if (!errSign) { setFase('ok'); setCarregando(false); return }
    if (errSign.message?.toLowerCase().includes('already')) {
      setFase('form'); setSenhaConfirm(''); setErro('Senha incorreta. Confira e tente de novo.')
    } else {
      setErro(errSign.message || 'Não foi possível criar a conta.')
    }
    setCarregando(false)
  }

  async function esqueceuSenha(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) {
      setErro('Erro ao enviar o e-mail. Verifique o endereço.')
    } else {
      setSucesso('E-mail enviado! Verifique sua caixa de entrada e clique no link para redefinir sua senha.')
    }
    setCarregando(false)
  }

  function voltar() { setTela('inicial'); setErro(''); setSucesso(''); setFase('form'); setSenhaConfirm('') }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '340px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#4256c8', height: '66px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible' }}>
          {/* CORREÇÃO DE PERFORMANCE (PageSpeed Insights): ver comentário
              equivalente em MapaDemandas.tsx — mesmo arquivo reduzido. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/CIDADANIA-logo.png" alt="CidadanIA Frutal" width={400} height={100} style={{ height: '46px', width: 'auto', display: 'block' }} />
          <button onClick={onFechar} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '22px', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {tela === 'inicial' && (
            <>
              <p style={{ margin: 0, fontSize: '14px', color: '#111827', textAlign: 'center' }}>
                Faça login ou registre-se em segundos
              </p>
              <button onClick={entrarComGoogle} disabled={carregandoGoogle}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '13px 16px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: carregandoGoogle ? 'wait' : 'pointer', fontSize: '15px', fontWeight: 600, color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <GoogleIcon />
                {carregandoGoogle ? 'Redirecionando...' : 'Continuar com Google'}
              </button>
              <button onClick={entrarComFacebook} disabled={carregandoFacebook}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '13px 16px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: carregandoFacebook ? 'wait' : 'pointer', fontSize: '15px', fontWeight: 600, color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <FacebookIcon />
                {carregandoFacebook ? 'Redirecionando...' : 'Continuar com Facebook'}
              </button>
              <button onClick={() => setTela('email')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '13px 16px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <EmailIcon />
                Entrar com e-mail
              </button>
              {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}
            </>
          )}

          {tela === 'esqueci' && (
            <>
              <button onClick={voltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
                ← Voltar
              </button>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>Redefinir senha</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Digite seu e-mail e enviaremos um link para criar uma nova senha.</p>
              {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}
              {sucesso ? (
                <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>{sucesso}</div>
              ) : (
                <form onSubmit={esqueceuSenha} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="seu@email.com"
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  <button type="submit" disabled={carregando}
                    style={{ backgroundColor: carregando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 700, padding: '12px', borderRadius: '8px', border: 'none', cursor: carregando ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
                    {carregando ? 'Enviando...' : 'Enviar link de redefinição'}
                  </button>
                </form>
              )}
            </>
          )}

          {tela === 'email' && (
            <>
              <button onClick={voltar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
                ← Voltar
              </button>
              {erro && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}
              {fase === 'ok' ? (
                <div style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>
                  Conta criada! Verifique seu e-mail para confirmar antes de entrar.
                </div>
              ) : (
                <form onSubmit={submeter} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {fase === 'confirmar' && (
                    <div style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>
                      Email não encontrado. Se você ainda não tem conta, repita a senha abaixo para criá-la.
                    </div>
                  )}
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro('') }} required
                    placeholder="seu@email.com" autoComplete="email"
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }} required
                    placeholder={fase === 'confirmar' ? 'Crie uma senha (mín. 6 caracteres)' : 'Sua senha'}
                    autoComplete={fase === 'confirmar' ? 'new-password' : 'current-password'}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  {fase === 'form' && (
                    <button type="button" onClick={() => { setTela('esqueci'); setErro('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4256c8', fontSize: '12px', padding: 0, textAlign: 'right', alignSelf: 'flex-end' }}>
                      Esqueci minha senha
                    </button>
                  )}
                  {fase === 'confirmar' && (
                    <input type="password" value={senhaConfirm} onChange={(e) => { setSenhaConfirm(e.target.value); setErro('') }} required
                      placeholder="Repita a senha" autoComplete="new-password"
                      style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  )}
                  <button type="submit" disabled={carregando}
                    style={{ backgroundColor: carregando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 700, padding: '12px', borderRadius: '8px', border: 'none', cursor: carregando ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
                    {carregando ? 'Aguarde...' : fase === 'confirmar' ? 'Criar conta' : 'Entrar'}
                  </button>
                  {fase === 'confirmar' && (
                    <button type="button" onClick={() => { setFase('form'); setErro(''); setSenhaConfirm('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
                      ← Voltar
                    </button>
                  )}
                </form>
              )}
            </>
          )}

          <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            Ao entrar, você concorda com nossos{' '}
            <a href="/termos" target="_blank" style={{ color: '#4256c8' }}>Termos de Uso</a>
            {' '}e{' '}
            <a href="/privacidade" target="_blank" style={{ color: '#4256c8' }}>Política de Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
