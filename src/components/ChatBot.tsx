'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'

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

export default function ChatBot() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const nomeUsuario = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Cidadão'
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { role: 'assistant', content: `Olá, ${nomeUsuario}! Sou o assistente virtual do Fala Frutal. Posso responder dúvidas sobre os serviços da cidade ou registrar uma demanda pra você. O que está precisando?` }
  ])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendente, setPendente] = useState<DemandaPayload | null>(null)
  const [criando, setCriando] = useState(false)
  const [notif, setNotif] = useState('')
  const [animando, setAnimando] = useState(false)
  const [ghostOpacity, setGhostOpacity] = useState(1)
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })
  const [avatarHeaderVisivel, setAvatarHeaderVisivel] = useState(true)
  const [painelVisivel, setPainelVisivel] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const avatarHeaderRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, pendente])

  function abrirChat() {
    if (!botaoRef.current) { setAberto(true); return }
    const bRect = botaoRef.current.getBoundingClientRect()
    const startX = bRect.left + bRect.width / 2 - 95
    const startY = bRect.top + bRect.height / 2 - 95
    // calcula posição final matematicamente
    const panelW = Math.min(360, window.innerWidth - 32)
    const panelH = Math.min(520, window.innerHeight - 100)
    const panelLeft = window.innerWidth - 24 - panelW
    const panelTop = window.innerHeight - 24 - panelH
    const finalX = panelLeft - 42
    const finalY = panelTop - 87

    // 1. renderiza ghost na posição inicial
    setGhostPos({ x: startX, y: startY })
    setAnimando(true)
    setAvatarHeaderVisivel(false)
    setPainelVisivel(false)
    setAberto(true)

    // 2. após render, inicia o voo e abre o painel
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setGhostPos({ x: finalX, y: finalY })
      setPainelVisivel(true)
    }))

    // 3. swap quando ghost chega no destino
    setTimeout(() => { setAvatarHeaderVisivel(true); setAnimando(false) }, 420)
  }

  if (!user) return null

  async function enviar() {
    if (!input.trim() || enviando) return
    const novaMensagem: Mensagem = { role: 'user', content: input.trim() }
    const historico = [...mensagens, novaMensagem]
    setMensagens(historico)
    setInput('')
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

      // Detecta se é um comando de criar demanda
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
      // Geocodifica o endereço via Mapbox
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
          lat,
          lng,
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
    <>
      {/* Botão flutuante */}
      {!aberto && (
        <button
          ref={botaoRef}
          onClick={abrirChat}
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#1e3a5f', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            padding: '0', overflow: 'visible',
          }}
          title="Falar com o AbacaXico"
        >
          {/* Sombra oval nos pés */}
          <div style={{
            position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(calc(-50% + 2px))',
            width: '44px', height: '10px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.28)', filter: 'blur(5px)',
            pointerEvents: 'none',
          }} />
          <img src="/abacaxico.png" alt="AbacaXico" style={{
            position: 'absolute', bottom: '12px', left: '50%',
            width: '240px', height: '240px', objectFit: 'contain', objectPosition: 'bottom', transform: 'translateX(calc(-50% + 2px)) scale(2)', transformOrigin: 'bottom center',
            pointerEvents: 'none',
          }} />
        </button>
      )}

      {/* Painel do chat */}
      {aberto && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: 'min(360px, calc(100vw - 32px))',
          height: 'min(520px, calc(100vh - 100px))',
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
            background: '#1e3a5f', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: '16px 16px 0 0',
            position: 'relative', overflow: 'visible',
          }}>
            {/* Avatar centralizado vazando acima do card */}
            {/* Container que clipa a sombra dentro do header */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: '16px 16px 0 0' }}>
              <div style={{
                position: 'absolute', top: '46px', left: '28px',
                width: '44px', height: '10px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.28)', filter: 'blur(5px)',
              }} />
            </div>
            <img ref={avatarHeaderRef} src="/abacaxico.png" alt="AbacaXico" style={{
              position: 'absolute', top: '-88px', left: '-43px',
              width: '190px', height: '190px', objectFit: 'contain',
              pointerEvents: 'none',
              opacity: avatarHeaderVisivel ? 1 : 0,
            }} />
            <div style={{ paddingLeft: '85px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'white' }}>AbacaXico</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>Assistente Virtual de IA do Fala Frutal</p>
            </div>
            <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>×</button>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mensagens.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#1e3a5f' : '#f3f4f6',
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

            {/* Botões de confirmação de demanda */}
            {pendente && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                <button onClick={confirmarDemanda} disabled={criando}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: criando ? 'wait' : 'pointer' }}>
                  {criando ? 'Registrando...' : 'Confirmar'}
                </button>
                <button onClick={cancelarDemanda} disabled={criando}
                  style={{ background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            )}

            {enviando && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f3f4f6', borderRadius: '12px 12px 12px 2px', padding: '9px 13px', fontSize: '13px', color: '#9ca3af' }}>
                  Digitando...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', borderRadius: '0 0 16px 16px', background: 'white' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
              placeholder="Digite sua mensagem..."
              disabled={enviando}
              style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', resize: 'none' }}
            />
            <button onClick={enviar} disabled={enviando || !input.trim()}
              style={{ background: enviando || !input.trim() ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: enviando || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {animando && (
        <img src="/abacaxico.png" alt="" style={{
          position: 'fixed',
          left: ghostPos.x,
          top: ghostPos.y,
          width: '190px',
          height: '190px',
          objectFit: 'contain',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: ghostOpacity,
          transition: 'left 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s',
        }} />
      )}

      {notif && (
        <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 1001, background: '#166534', color: 'white', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {notif}
        </div>
      )}
    </>
  )
}
