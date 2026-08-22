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

async function comprimirFoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 600
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', 0.25)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
}

export default function ChatBot() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const nomeUsuario = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Cidadão'
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { role: 'assistant', content: `Olá, ${nomeUsuario}! Sou o assistente virtual do CidadanIA Frutal. Posso responder dúvidas sobre os serviços da cidade ou registrar uma demanda pra você. O que está precisando?` }
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
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const avatarHeaderRef = useRef<HTMLImageElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removerFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
  }

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

      // Envia a foto anexada, se houver
      let foto_url: string | null = null
      if (fotoFile) {
        try {
          const blob = await comprimirFoto(fotoFile)
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const { error: uploadError } = await supabase.storage.from('demandas-fotos').upload(path, blob, { contentType: 'image/jpeg' })
          if (uploadError) throw uploadError
          foto_url = supabase.storage.from('demandas-fotos').getPublicUrl(path).data.publicUrl
        } catch {
          setMensagens(prev => [...prev, { role: 'assistant', content: 'Não consegui enviar a foto, mas vou registrar a demanda sem ela.' }])
        }
      }

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
          foto_url,
          via_chatbot: true,
        }),
      })

      if (res.ok) {
        setPendente(null)
        removerFoto()
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
    removerFoto()
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
          title="Falar com o assistente"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
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
            {mensagens.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#1e3a5f' : '#f9fafb',
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

            {/* Anexo de foto + botões de confirmação de demanda */}
            {pendente && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fotoPreview ? (
                  <div style={{ position: 'relative', width: '72px' }}>
                    <img src={fotoPreview} alt="Foto anexada" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <button onClick={removerFoto} disabled={criando}
                      style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', background: '#dc2626', color: 'white', border: '2px solid white', fontSize: '11px', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      ×
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fotoInputRef.current?.click()} disabled={criando}
                    style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    Anexar foto
                  </button>
                )}
                <input ref={fotoInputRef} type="file" accept="image/*" onChange={selecionarFoto} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                  <button onClick={confirmarDemanda} disabled={criando}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: criando ? 'wait' : 'pointer' }}>
                    {criando ? 'Registrando...' : 'Confirmar'}
                  </button>
                  <button onClick={cancelarDemanda} disabled={criando}
                    style={{ background: 'white', color: '#dc2626', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {enviando && (
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
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
              placeholder="Digite sua mensagem..."
              disabled={enviando}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', resize: 'none' }}
            />
            <button onClick={enviar} disabled={enviando || !input.trim()}
              style={{ background: enviando || !input.trim() ? '#6b7280' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: enviando || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </div>
      )}


      {notif && (
        <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 1001, background: '#166534', color: 'white', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {notif}
        </div>
      )}
    </>
  )
}
