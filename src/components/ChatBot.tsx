'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChatBot } from '@/hooks/useChatBot'
import { useSheet } from '@/contexts/SheetContext'
import Turnstile from './Turnstile'
import MiniMapaConfirmar from './MiniMapaConfirmar'

const SNAP: Record<string, number> = { peek: 0.20, half: 0.50, full: 0.75 }

export default function ChatBot() {
  const bot = useChatBot()
  const { sheetState } = useSheet()
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [painelVisivel, setPainelVisivel] = useState(false)

  // Posição do botão: acompanha o sheet quando no mapa, caso contrário canto inferior direito
  const botaoBottom = sheetState && sheetState !== 'full'
    ? `calc(${SNAP[sheetState] * 100}vh + 12px)`
    : sheetState === null ? '24px' : undefined

  const bottomRef = useRef<HTMLDivElement>(null)
  const camInputRef = useRef<HTMLInputElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bot.mensagens, bot.etapaDemanda])

  if (!bot.user) return null

  return (
    <>
      {/* Botão flutuante — abre /assistenteia */}
      {!aberto && sheetState !== 'full' && (
        <button
          ref={botaoRef}
          onClick={() => router.push('/assistenteia')}
          style={{
            position: 'fixed',
            ...(sheetState ? { bottom: botaoBottom, right: '16px', transition: 'bottom 0.25s ease' } : { bottom: '24px', right: '24px' }),
            zIndex: 2000,
            width: '54px', height: '54px', borderRadius: '50%',
            background: '#4256c8', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            padding: '0', overflow: 'visible',
          }}
          title="Falar com o assistente"
        >
          {/* Da metade pra baixo a foto fica presa ao circulo; da metade pra cima pode vazar */}
          <div style={{ position: 'absolute', inset: 0, clipPath: 'inset(-1000px 0 0 0 round 0 0 32px 32px)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assistenteia.png" alt="Assistente virtual" style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', height: '150%', width: 'auto', pointerEvents: 'none' }} />
          </div>
        </button>
      )}

      {/* Painel do chat */}
      {aberto && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: 'min(360px, calc(100vw - 32px))',
          height: 'min(520px, calc(100dvh - 120px))',
          background: 'white', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column',
          overflow: 'visible',
          opacity: painelVisivel ? 1 : 0,
          transform: painelVisivel ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.12s ease, transform 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}>

          {/* Header */}
          <div style={{
            background: '#4256c8', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: '16px 16px 0 0',
            position: 'relative', overflow: 'visible',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', position: 'relative', flexShrink: 0 }}>
                {/* Da metade pra baixo a foto fica presa ao circulo; da metade pra cima pode vazar */}
                <div style={{ position: 'absolute', inset: 0, clipPath: 'inset(-1000px 0 0 0 round 0 0 18px 18px)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assistenteia.png" alt="Assistente virtual" style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', height: '150%', width: 'auto', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'white' }}>Lucas</p>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>Assistente Virtual · CidadanIA Frutal</p>
              </div>
            </div>
            <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>×</button>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bot.mensagens.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#4256c8' : '#f9fafb',
                  color: m.role === 'user' ? 'white' : '#111827',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '9px 13px',
                  fontSize: '13px',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Etapa: perguntar se quer registrar */}
            {bot.etapaDemanda === 'perguntar_registrar' && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                <button onClick={bot.aoConfirmarQuerRegistrar}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Sim, registrar
                </button>
                <button onClick={bot.aoRecusarRegistrar}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Não
                </button>
              </div>
            )}

            {/* Etapa: escolher autoridades — dropdown com checkboxes */}
            {bot.etapaDemanda === 'escolher_autoridade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => bot.setDropdownAutoridade(!bot.dropdownAutoridade)}
                    style={{ width: '100%', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#111827' }}
                  >
                    <span>{bot.entidadesIdsDemanda.length === 0 ? 'Selecione as autoridades' : `${bot.entidadesIdsDemanda.length} selecionada${bot.entidadesIdsDemanda.length > 1 ? 's' : ''}`}</span>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>{bot.dropdownAutoridade ? '▲' : '▼'}</span>
                  </button>
                  {bot.dropdownAutoridade && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden' }}>
                      <p style={{ margin: 0, padding: '8px 12px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>Máximo 3 autoridades</p>
                      {bot.opcoesAutoridade.map(ent => {
                        const selecionado = bot.entidadesIdsDemanda.includes(ent.id)
                        const desabilitado = !selecionado && bot.entidadesIdsDemanda.length >= 3
                        return (
                          <label key={ent.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: desabilitado ? 'not-allowed' : 'pointer', borderBottom: '1px solid #f9fafb', opacity: desabilitado ? 0.4 : 1, background: selecionado ? '#eff6ff' : 'white' }}>
                            <input type="checkbox" checked={selecionado} disabled={desabilitado} onChange={() => bot.toggleAutoridade(ent)} style={{ accentColor: '#4256c8', width: '15px', height: '15px', flexShrink: 0 }} />
                            <div>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>{ent.nome}</p>
                              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{ent.cargo}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={bot.aoConfirmarAutoridades}
                  disabled={bot.entidadesIdsDemanda.length === 0}
                  style={{ background: bot.entidadesIdsDemanda.length > 0 ? '#4256c8' : '#e5e7eb', color: bot.entidadesIdsDemanda.length > 0 ? 'white' : '#9ca3af', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: bot.entidadesIdsDemanda.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  Confirmar seleção
                </button>
              </div>
            )}

            {/* Etapa: endereço + mini-mapa */}
            {bot.etapaDemanda === 'perguntar_endereco' && (
              <MiniMapaConfirmar onConfirmar={bot.aoConfirmarEnderecoMapa} />
            )}

            {/* Etapa: perguntar sobre foto */}
            {bot.etapaDemanda === 'perguntar_foto' && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                <button onClick={() => camInputRef.current?.click()}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Tirar foto
                </button>
                <button onClick={() => bot.fotoInputRef.current?.click()}
                  style={{ background: 'white', color: '#4256c8', border: '1px solid #4256c8', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Galeria
                </button>
                <button onClick={bot.aoClicarSemFoto}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Sem foto
                </button>
                <input ref={camInputRef} type="file" accept="image/*" capture="environment" onChange={bot.selecionarFoto} style={{ display: 'none' }} />
                <input ref={bot.fotoInputRef} type="file" accept="image/*" onChange={bot.selecionarFoto} style={{ display: 'none' }} />
              </div>
            )}

            {/* Etapa: resumo final + captcha + confirmar */}
            {bot.etapaDemanda === 'resumo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bot.fotoPreview && (
                  <img src={bot.fotoPreview} alt="Foto anexada" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                )}
                {bot.captchaVisivel && (
                  <Turnstile size="flexible" onVerify={bot.aoVerificarCaptcha} onExpire={() => {/* token expira, usuário recarrega */}} />
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                  <button onClick={bot.aoClicarConfirmar} disabled={bot.criando || bot.captchaVisivel}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: (bot.criando || bot.captchaVisivel) ? 'wait' : 'pointer' }}>
                    {bot.criando ? 'Registrando...' : bot.captchaVisivel ? 'Verificando...' : 'Confirmar'}
                  </button>
                  <button onClick={bot.cancelarDemanda} disabled={bot.criando}
                    style={{ background: 'white', color: '#dc2626', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {bot.enviando && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f9fafb', borderRadius: '12px 12px 12px 2px', padding: '9px 13px', fontSize: '13px', color: '#6b7280' }}>
                  Digitando...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', borderRadius: '0 0 16px 16px', background: 'white' }}>
            <input
              value={bot.input}
              onChange={e => bot.setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), bot.enviar())}
              placeholder="Digite sua mensagem..."
              disabled={bot.inputDesabilitado}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', resize: 'none' }}
            />
            {bot.micDisponivel && (
              <button onClick={bot.alternarGravacao} disabled={bot.inputDesabilitado}
                title={bot.gravando ? 'Parar gravação' : 'Falar em vez de digitar'}
                style={{ background: bot.gravando ? '#dc2626' : '#f9fafb', color: bot.gravando ? 'white' : '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 10px', cursor: bot.inputDesabilitado ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', animation: bot.gravando ? 'chatbot-mic-pulse 1.2s infinite' : 'none' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
            )}
            <button onClick={bot.enviar} disabled={bot.inputDesabilitado || !bot.input.trim()}
              style={{ background: bot.inputDesabilitado || !bot.input.trim() ? '#6b7280' : '#4256c8', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: bot.inputDesabilitado || !bot.input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {bot.notif && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 2001, background: '#166534', color: 'white', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {bot.notif}
        </div>
      )}

      <style>{`
        @keyframes chatbot-mic-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </>
  )
}
