'use client'

import { useRef, useEffect, useState } from 'react'
import { useChatBot } from '@/hooks/useChatBot'
import ModalAuth from '@/components/ModalAuth'
import Navbar from '@/components/Navbar'
import Turnstile from '@/components/Turnstile'
import MiniMapaConfirmar from '@/components/MiniMapaConfirmar'

export default function AssistenteIAPage() {
  const bot = useChatBot()
  // Extraída à parte: o hook mistura uma ref de verdade (useRef) no meio do
  // objeto de retorno junto com estado normal. O analisador de regras dos
  // hooks trata qualquer "bot.algumaCoisa" como suspeito assim que vê
  // "fotoInputRef" (uma ref real) sendo lida no JSX — daí as dezenas de
  // falsos positivos de "Cannot access refs during render" no resto do
  // arquivo. Usar a ref como identificador solto em vez de acesso a
  // propriedade evita a análise contaminar o restante do componente.
  const { fotoInputRef } = bot
  const [modalAuth, setModalAuth] = useState(false)
  const [nomeBot, setNomeBot] = useState('Assistente')

  useEffect(() => {
    fetch('/api/chatbot-config')
      .then(res => res.json())
      .then(data => { if (data?.nome_bot) setNomeBot(data.nome_bot) })
      .catch(() => {})
  }, [])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pageBottomRef = useRef<HTMLDivElement>(null)
  const camInputRef = useRef<HTMLInputElement>(null)

  const temMensagens = bot.mensagens.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bot.mensagens, bot.etapaDemanda, bot.enviando])

  // Ao enviar a 1ª mensagem, rola a página inteira até a base (onde fica o campo de input),
  // que em mobile pode ficar escondido atrás da barra do navegador
  useEffect(() => {
    if (bot.mensagens.length === 1) {
      setTimeout(() => {
        if (pageBottomRef.current) {
          pageBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        }
      }, 150)
    }
  }, [bot.mensagens.length])

  function autoResize(el: HTMLTextAreaElement) {
    // Usar '0' em vez de 'auto' evita o colapso visual antes de recalcular
    el.style.height = '0'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  function handleEnviar() {
    if (!bot.user) { setModalAuth(true); return }
    bot.enviar()
  }

  const campoInput = (
    <>
      <style>{`
        .abx-textarea { min-height: 24px; caret-color: #4256c8; }
        @keyframes abx-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
      <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%', position: 'relative', background: 'white', borderRadius: '24px', border: '1px solid #e5e7eb', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', boxSizing: 'border-box' }}>
        <textarea
          ref={inputRef}
          rows={1}
          className="abx-textarea"
          value={bot.input}
          onChange={e => { bot.setInput(e.target.value); autoResize(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
          placeholder={!bot.user ? 'Entre na sua conta para conversar' : 'Registre demandas, tire dúvidas ou peça uma ajuda...'}
          disabled={bot.inputDesabilitado || !bot.user}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: '15px', color: '#111827', resize: 'none', lineHeight: 1.5, maxHeight: '160px', padding: 0, display: 'block', overflowX: 'hidden', overflowY: 'auto' }}
        />
        {bot.micDisponivel && bot.user && (
          <button
            type="button"
            onClick={bot.alternarGravacao}
            disabled={bot.inputDesabilitado}
            title={bot.gravando ? 'Parar gravação' : 'Falar em vez de digitar'}
            style={{
              background: bot.gravando ? '#dc2626' : 'transparent',
              color: bot.gravando ? 'white' : '#6b7280',
              border: 'none', borderRadius: '10px',
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: bot.inputDesabilitado ? 'default' : 'pointer',
              flexShrink: 0, transition: 'background 0.15s',
              animation: bot.gravando ? 'abx-pulse 1.2s infinite' : 'none',
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
        )}
        <button
          onClick={bot.user ? handleEnviar : () => setModalAuth(true)}
          disabled={bot.inputDesabilitado || (!!bot.user && !bot.input.trim())}
          style={{
            background: (!bot.user || bot.input.trim()) ? '#4256c8' : 'transparent',
            color: (!bot.user || bot.input.trim()) ? 'white' : '#6b7280',
            border: 'none', borderRadius: '10px',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (bot.inputDesabilitado || (bot.user && !bot.input.trim())) ? 'default' : 'pointer',
            flexShrink: 0, transition: 'background 0.15s',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="13 6 19 12 13 18" />
          </svg>
        </button>
      </div>
      {!bot.user && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', margin: '10px 0 0' }}>
          <button onClick={() => setModalAuth(true)} style={{ background: 'none', border: 'none', color: '#4256c8', fontWeight: 600, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
            Entre na sua conta
          </button>{' '}para conversar com o assistente
        </p>
      )}
    </>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'white' }}>
      <Navbar />

      {/* Área principal */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Estado vazio — saudação centralizada */}
        {!temMensagens && (
          <>
            <style>{`
              .abx-empty-state {
                justify-content: center;
                padding: 40px 24px;
              }
              .abx-mascote { width: clamp(260px, 40vw, 380px); }
              @media (max-width: 640px) {
                .abx-empty-state {
                  justify-content: flex-start;
                  padding: 72px 20px 24px;
                }
                .abx-mascote { width: min(78vw, 340px); }
              }
            `}</style>
            <div className="abx-empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: 'clamp(140px, 35vw, 200px)', height: 'clamp(140px, 35vw, 200px)', borderRadius: '50%', background: '#4256c8', position: 'relative', marginBottom: '16px' }}>
                {/* Da metade pra baixo a foto fica presa ao circulo; da metade pra cima pode vazar */}
                <div style={{ position: 'absolute', inset: 0, clipPath: 'inset(-1000px 0 0 0 round 0 0 50% 50%)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assistenteia.png" alt="Assistente virtual" style={{ position: 'absolute', bottom: '-60px', left: '50%', transform: 'translateX(-50%)', height: '150%', width: 'auto', pointerEvents: 'none' }} />
                </div>
              </div>
              <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: '#111827', margin: '0 0 28px', letterSpacing: '-0.5px' }}>
                Olá{bot.nomeUsuario ? `, ${bot.nomeUsuario}` : ''}!
              </h1>
              <div style={{ width: '100%', maxWidth: '600px', marginTop: '-12px' }}>
                {campoInput}
              </div>
            </div>
          </>
        )}

        {/* Mensagens */}
        {temMensagens && (
          <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '760px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {bot.mensagens.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '12px' }}>

                {/* Avatar */}
                {m.role === 'assistant' && (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assistenteia.png" alt="Assistente virtual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                {/* Conteúdo */}
                {m.role === 'assistant' ? (
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>{nomeBot}</p>
                    <p style={{ fontSize: '15px', color: '#111827', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                  </div>
                ) : (
                  <div style={{ maxWidth: '70%', background: '#f9fafb', borderRadius: '20px', padding: '12px 18px', fontSize: '15px', color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                )}
              </div>
            ))}

            {/* Etapa: perguntar se quer registrar */}
            {bot.etapaDemanda === 'perguntar_registrar' && (
              <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
                <button onClick={bot.aoConfirmarQuerRegistrar}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Sim, registrar
                </button>
                <button onClick={bot.aoRecusarRegistrar}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Não
                </button>
              </div>
            )}

            {/* Etapa: escolher autoridades — cards com checkboxes (versão página completa) */}
            {bot.etapaDemanda === 'escolher_autoridade' && (
              <div style={{ paddingLeft: '46px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '480px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b7280' }}>Máximo 3 autoridades</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bot.opcoesAutoridade.map(ent => {
                    const selecionado = bot.entidadesIdsDemanda.includes(ent.id)
                    const desabilitado = !selecionado && bot.entidadesIdsDemanda.length >= 3
                    return (
                      <label key={ent.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '10px', cursor: desabilitado ? 'not-allowed' : 'pointer',
                        border: `1px solid ${selecionado ? '#4256c8' : '#e5e7eb'}`,
                        background: selecionado ? '#eff6ff' : 'white',
                        opacity: desabilitado ? 0.45 : 1,
                        transition: 'border-color 0.1s, background 0.1s',
                      }}>
                        <input type="checkbox" checked={selecionado} disabled={desabilitado} onChange={() => bot.toggleAutoridade(ent)}
                          style={{ accentColor: '#4256c8', width: '16px', height: '16px', flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{ent.nome}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{ent.cargo}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <button
                  onClick={bot.aoConfirmarAutoridades}
                  disabled={bot.entidadesIdsDemanda.length === 0}
                  style={{
                    marginTop: '4px',
                    background: bot.entidadesIdsDemanda.length > 0 ? '#4256c8' : '#e5e7eb',
                    color: bot.entidadesIdsDemanda.length > 0 ? 'white' : '#9ca3af',
                    border: 'none', borderRadius: '10px', padding: '10px 22px',
                    fontSize: '14px', fontWeight: 600,
                    cursor: bot.entidadesIdsDemanda.length > 0 ? 'pointer' : 'not-allowed',
                  }}>
                  Confirmar seleção
                </button>
              </div>
            )}

            {/* Etapa: endereço + mini-mapa */}
            {bot.etapaDemanda === 'perguntar_endereco' && (
              <div style={{ paddingLeft: '46px', maxWidth: '480px' }}>
                <MiniMapaConfirmar onConfirmar={bot.aoConfirmarEnderecoMapa} />
              </div>
            )}

            {/* Etapa: perguntar sobre foto */}
            {bot.etapaDemanda === 'perguntar_foto' && (
              <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
                <button onClick={() => camInputRef.current?.click()}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Tirar foto
                </button>
                <button onClick={() => fotoInputRef.current?.click()}
                  style={{ background: 'white', color: '#4256c8', border: '1px solid #4256c8', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Galeria
                </button>
                <button onClick={bot.aoClicarSemFoto}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Sem foto
                </button>
                <input ref={camInputRef} type="file" accept="image/*" capture="environment" onChange={bot.selecionarFoto} style={{ display: 'none' }} />
                <input ref={fotoInputRef} type="file" accept="image/*" onChange={bot.selecionarFoto} style={{ display: 'none' }} />
              </div>
            )}

            {/* Etapa: resumo final + captcha + confirmar */}
            {bot.etapaDemanda === 'resumo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '46px' }}>
                {bot.fotoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element -- blob: URL local (preview de upload), next/image não serve
                  <img src={bot.fotoPreview} alt="Foto anexada" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
                )}
                {bot.captchaVisivel && (
                  <Turnstile size="flexible" onVerify={bot.aoVerificarCaptcha} onExpire={bot.aoExpirarCaptcha} />
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={bot.aoClicarConfirmar} disabled={bot.criando || bot.captchaVisivel}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: (bot.criando || bot.captchaVisivel) ? 'wait' : 'pointer' }}>
                    {bot.criando ? 'Registrando...' : bot.captchaVisivel ? 'Verificando...' : 'Confirmar'}
                  </button>
                  <button onClick={bot.cancelarDemanda} disabled={bot.criando}
                    style={{ background: 'white', color: '#dc2626', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Digitando */}
            {bot.enviando && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>{nomeBot}</p>
                <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>Digitando...</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input fixo na base (some no estado vazio, aparece após a 1ª mensagem) */}
      {temMensagens && (
        <div style={{ padding: 'clamp(12px, 2vw, 20px) clamp(16px, 3vw, 32px)', background: 'white', borderTop: '1px solid #f9fafb' }}>
          {campoInput}
        </div>
      )}
      <div ref={pageBottomRef} />

      {bot.notif && (
        <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 100, background: '#166534', color: 'white', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {bot.notif}
        </div>
      )}

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}
    </div>
  )
}
