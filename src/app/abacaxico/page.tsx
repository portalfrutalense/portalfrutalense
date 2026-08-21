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
  const nomeUsuario = perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Cidadão'

  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { role: 'assistant', content: `Uai, ${nomeUsuario}! Que bom ter ocê aqui. Sou o AbacaXico, frutalense de coração. Posso responder dúvidas sobre os serviços da cidade ou registrar uma demanda pra ocê. Fala aí, o que tá precisando?` }
  ])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pendente, setPendente] = useState<DemandaPayload | null>(null)
  const [criando, setCriando] = useState(false)
  const [notif, setNotif] = useState('')
  const [modalAuth, setModalAuth] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, pendente, enviando])

  async function enviar() {
    if (!input.trim() || enviando) return
    if (!user) { setModalAuth(true); return }

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
      setTimeout(() => inputRef.current?.focus(), 100)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      <Navbar />

      {/* Header da página */}
      <div style={{ background: '#1e3a5f', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🍍</div>
        <div>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'white' }}>AbacaXico</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>Assistente Virtual de IA do Fala Frutal</p>
        </div>
        {!user && (
          <button onClick={() => setModalAuth(true)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Entrar para conversar
          </button>
        )}
      </div>

      {/* Área de mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px, 3vw, 32px)', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '760px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {mensagens.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '10px', alignItems: 'flex-end' }}>
            {m.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0, marginBottom: '2px' }}>🍍</div>
            )}
            <div style={{
              maxWidth: '72%',
              background: m.role === 'user' ? '#1e3a5f' : 'white',
              color: m.role === 'user' ? 'white' : '#111827',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '12px 16px',
              fontSize: '14px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: m.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {/* Botões de confirmação */}
        {pendente && (
          <div style={{ display: 'flex', gap: '10px', paddingLeft: '42px' }}>
            <button onClick={confirmarDemanda} disabled={criando}
              style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: criando ? 'wait' : 'pointer' }}>
              {criando ? 'Registrando...' : 'Confirmar'}
            </button>
            <button onClick={cancelarDemanda} disabled={criando}
              style={{ background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        )}

        {enviando && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>🍍</div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', fontSize: '14px', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              Digitando...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid #e5e7eb', background: 'white', padding: 'clamp(12px, 2vw, 20px)', flexShrink: 0 }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
            placeholder={user ? 'Digite sua mensagem...' : 'Entre na sua conta para conversar'}
            disabled={enviando || !user}
            style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', outline: 'none', background: user ? 'white' : '#f9fafb', color: user ? '#111827' : '#9ca3af' }}
          />
          <button
            onClick={user ? enviar : () => setModalAuth(true)}
            disabled={enviando || (!!user && !input.trim())}
            style={{ background: enviando || (user && !input.trim()) ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 20px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            ➤
          </button>
        </div>
      </div>

      {/* Notificação */}
      {notif && (
        <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 100, background: '#166534', color: 'white', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {notif}
        </div>
      )}

      {modalAuth && <ModalAuth onClose={() => setModalAuth(false)} />}
    </div>
  )
}
