'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'
import ModalAuth from '@/components/ModalAuth'
import Navbar from '@/components/Navbar'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

interface DemandaPayload {
  action: 'criar_demanda'
  descricao: string
  endereco: string
  categoria_id: string
  categoria_nome: string
  entidade_id: string
  entidade_nome: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const FRUTAL_LAT = -20.0234
const FRUTAL_LNG = -48.9338

export default function AbacaXicoPage() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const nomeUsuario = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || ''

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendente, setPendente] = useState<DemandaPayload | null>(null)
  const [criando, setCriando] = useState(false)
  const [notif, setNotif] = useState('')
  const [modalAuth, setModalAuth] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [micDisponivel, setMicDisponivel] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pageBottomRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SpeechRecognition) setMicDisponivel(false)
  }, [])

  function alternarGravacao() {
    if (gravando) {
      recognitionRef.current?.stop()
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SpeechRecognition) { setMicDisponivel(false); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const texto = event.results[0][0].transcript
      setInput(prev => (prev ? `${prev} ${texto}` : texto))
      if (inputRef.current) autoResize(inputRef.current)
    }
    recognition.onerror = () => setGravando(false)
    recognition.onend = () => setGravando(false)

    recognitionRef.current = recognition
    recognition.start()
    setGravando(true)
  }

  const temMensagens = mensagens.length > 0

  const campoInput = (
    <>
      <style>{`
        .abx-textarea { min-height: 24px; }
        @media (max-width: 480px) {
          .abx-textarea { min-height: 52px; }
        }
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
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(e.target) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder={user ? 'Registre demandas, tire dúvidas ou peça uma ajuda...' : 'Entre na sua conta para conversar'}
          disabled={enviando || !user}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: '15px', color: '#111827', resize: 'none', lineHeight: 1.5, maxHeight: '160px', padding: 0, display: 'block', overflowX: 'hidden', overflowY: 'auto' }}
        />
        {micDisponivel && user && (
          <button
            type="button"
            onClick={alternarGravacao}
            disabled={enviando}
            title={gravando ? 'Parar gravação' : 'Falar em vez de digitar'}
            style={{
              background: gravando ? '#dc2626' : 'transparent',
              color: gravando ? 'white' : '#6b7280',
              border: 'none', borderRadius: '10px',
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: enviando ? 'default' : 'pointer',
              flexShrink: 0, transition: 'background 0.15s',
              animation: gravando ? 'abx-pulse 1.2s infinite' : 'none',
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
        )}
        <button
          onClick={user ? enviar : () => setModalAuth(true)}
          disabled={enviando || (!!user && !input.trim())}
          style={{
            background: (!user || input.trim()) ? '#1e3a5f' : 'transparent',
            color: (!user || input.trim()) ? 'white' : '#9ca3af',
            border: 'none', borderRadius: '10px',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (enviando || (user && !input.trim())) ? 'default' : 'pointer',
            flexShrink: 0, transition: 'background 0.15s',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="13 6 19 12 13 18" />
          </svg>
        </button>
      </div>
      {!user && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: '10px 0 0' }}>
          <button onClick={() => setModalAuth(true)} style={{ background: 'none', border: 'none', color: '#1e3a5f', fontWeight: 600, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
            Entre na sua conta
          </button>{' '}para conversar com o AbacaXico
        </p>
      )}
    </>
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, pendente, enviando])

  // Ao enviar a 1ª mensagem, rola a página inteira até a base (onde fica o campo de input),
  // que em mobile pode ficar escondido atrás da barra do navegador
  useEffect(() => {
    if (mensagens.length === 1) {
      setTimeout(() => {
        if (pageBottomRef.current) {
          pageBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        }
      }, 150)
    }
  }, [mensagens.length])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  async function enviar() {
    if (!input.trim() || enviando) return
    if (!user) { setModalAuth(true); return }

    const novaMensagem: Mensagem = { role: 'user', content: input.trim() }
    const historico = [...mensagens, novaMensagem]
    setMensagens(historico)
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }
    setEnviando(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mensagens: historico, nomeUsuario }),
      })
      const data = await res.json()
      const resposta: string = data.resposta || 'Erro ao processar mensagem.'

      const jsonMatch = resposta.match(/\{"action":"criar_demanda"[^}]+\}/)
      if (jsonMatch) {
        try {
          const payload = JSON.parse(jsonMatch[0]) as DemandaPayload
          setPendente(payload)
          setMensagens(prev => [...prev, {
            role: 'assistant',
            content: `Ótimo! Vou registrar a seguinte demanda:\n\nEndereço: ${payload.endereco}\nCategoria: ${payload.categoria_nome}\nDirecionada para: ${payload.entidade_nome}\nDescrição: ${payload.descricao}\n\nConfirma o registro?`
          }])
        } catch {
          setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
        }
      } else {
        setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
      }
    } catch {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarDemanda() {
    if (!pendente || criando) return
    setCriando(true)
    try {
      let lat = FRUTAL_LAT, lng = FRUTAL_LNG, enderecoLabel = pendente.endereco
      try {
        const q = encodeURIComponent(`${pendente.endereco}, Frutal, Minas Gerais`)
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&country=BR&language=pt&limit=1&proximity=${FRUTAL_LNG},${FRUTAL_LAT}`
        const geo = await fetch(url)
        const geoData = await geo.json()
        if (geoData?.features?.length) {
          ;[lng, lat] = geoData.features[0].center
          enderecoLabel = geoData.features[0].place_name?.split(',')[0] || pendente.endereco
        }
      } catch { /* usa coordenadas padrão */ }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/demandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          descricao: pendente.descricao,
          endereco_label: enderecoLabel,
          lat, lng,
          categoria_id: pendente.categoria_id,
          entidade_id: pendente.entidade_id,
          morador_nome: perfil?.nome || nomeUsuario,
          via_chatbot: true,
        }),
      })
      if (res.ok) {
        setPendente(null)
        setMensagens(prev => [...prev, { role: 'assistant', content: 'Demanda registrada com sucesso! Ela aparecerá no mapa após análise. Posso ajudar com mais alguma coisa?' }])
        setNotif('Demanda registrada!')
        setTimeout(() => setNotif(''), 4000)
      } else {
        const err = await res.json()
        setMensagens(prev => [...prev, { role: 'assistant', content: `Erro ao registrar: ${err.error || 'tente novamente.'}` }])
      }
    } catch {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro ao registrar a demanda. Tente novamente.' }])
    } finally {
      setCriando(false)
    }
  }

  function cancelarDemanda() {
    setPendente(null)
    setMensagens(prev => [...prev, { role: 'assistant', content: 'Ok, cancelei o registro. Quer alterar alguma informação ou posso ajudar com outra coisa?' }])
  }

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
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
                <div style={{ position: 'absolute', bottom: '0px', left: '50%', transform: 'translateX(calc(-46% + 5px))', width: '80px', height: '14px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(12px)' }} />
                <img src="/abacaxico.png" alt="AbacaXico" className="abx-mascote" style={{ height: 'auto', objectFit: 'contain', display: 'block', position: 'relative' }} />
              </div>
              <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                Bão{nomeUsuario ? `, ${nomeUsuario}` : ''}! Eu sou o AbacaXico!
              </h1>
              <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 28px' }}>
                Assistente Virtual de IA do Fala Frutal
              </p>
              <div style={{ width: '100%', maxWidth: '600px', marginTop: '-12px' }}>
                {campoInput}
              </div>
            </div>
          </>
        )}

        {/* Mensagens */}
        {temMensagens && (
          <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '760px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {mensagens.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '12px' }}>

                {/* Conteúdo */}
                {m.role === 'assistant' ? (
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>AbacaXico</p>
                    <p style={{ fontSize: '15px', color: '#111827', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                  </div>
                ) : (
                  <div style={{ maxWidth: '70%', background: '#f0f4f9', borderRadius: '20px', padding: '12px 18px', fontSize: '15px', color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                )}
              </div>
            ))}

            {/* Botões de confirmação */}
            {pendente && (
              <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
                <button onClick={confirmarDemanda} disabled={criando}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: criando ? 'wait' : 'pointer' }}>
                  {criando ? 'Registrando...' : 'Confirmar'}
                </button>
                <button onClick={cancelarDemanda} disabled={criando}
                  style={{ background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            )}

            {/* Digitando */}
            {enviando && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>AbacaXico</p>
                <p style={{ fontSize: '15px', color: '#9ca3af', margin: 0 }}>Digitando...</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input fixo na base (some no estado vazio, aparece após a 1ª mensagem) */}
      {temMensagens && (
        <div style={{ padding: 'clamp(12px, 2vw, 20px) clamp(16px, 3vw, 32px)', background: 'white', borderTop: '1px solid #f3f4f6' }}>
          {campoInput}
        </div>
      )}
      <div ref={pageBottomRef} />

      {notif && (
        <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 100, background: '#166534', color: 'white', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {notif}
        </div>
      )}

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}
    </div>
  )
}
