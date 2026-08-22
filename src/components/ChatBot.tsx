'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import Turnstile from './Turnstile'
import MiniMapaConfirmar from './MiniMapaConfirmar'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

interface Entidade {
  id: string
  nome: string
  cargo: string
}

type EtapaDemanda = 'nenhuma' | 'perguntar_registrar' | 'escolher_autoridade' | 'perguntar_endereco' | 'perguntar_foto' | 'resumo'

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
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [notif, setNotif] = useState('')
  const [painelVisivel, setPainelVisivel] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [captchaVisivel, setCaptchaVisivel] = useState(false)

  // Fluxo de registro de demanda (etapas conduzidas por código, não pela IA)
  const [etapaDemanda, setEtapaDemanda] = useState<EtapaDemanda>('nenhuma')
  const [descricaoDemanda, setDescricaoDemanda] = useState('')
  const [categoriaIdDemanda, setCategoriaIdDemanda] = useState('')
  const [categoriaNomeDemanda, setCategoriaNomeDemanda] = useState('')
  const [entidadeIdDemanda, setEntidadeIdDemanda] = useState('')
  const [entidadeNomeDemanda, setEntidadeNomeDemanda] = useState('')
  const [coordDemanda, setCoordDemanda] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [opcoesAutoridade, setOpcoesAutoridade] = useState<Entidade[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // Carrega autoridades e vínculos com categorias (usado para escolher autoridade sem precisar da IA)
  useEffect(() => {
    supabase.from('entidades').select('id, nome, cargo').eq('ativo', true).then(({ data }) => setEntidades((data as Entidade[]) || []))
    supabase.from('categoria_entidades').select('categoria_id, entidade_id').then(({ data }) => {
      const mapa: Record<string, string[]> = {}
      for (const row of (data || [])) {
        if (!mapa[row.categoria_id]) mapa[row.categoria_id] = []
        mapa[row.categoria_id].push(row.entidade_id)
      }
      setCatEntidades(mapa)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Simula "digitando..." antes de respostas prontas (não vindas da IA), pra parecer natural
  function comDigitando(fn: () => void, delay = 650) {
    setEnviando(true)
    setTimeout(() => {
      fn()
      setEnviando(false)
    }, delay)
  }

  function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    e.target.value = ''
    setMensagens(prev => [...prev, { role: 'user', content: 'Foto anexada.' }])
    comDigitando(irParaResumo)
  }

  function removerFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, etapaDemanda])

  function abrirChat() {
    setPainelVisivel(false)
    setAberto(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setPainelVisivel(true)))
    if (mensagens.length === 0) enviarSaudacaoInicial()
  }

  async function enviarSaudacaoInicial() {
    setEnviando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mensagens: [{ role: 'user', content: 'Oi' }], nomeUsuario }),
      })
      const data = await res.json()
      const resposta: string = data.resposta || `Olá, ${nomeUsuario}! Como posso ajudar?`
      setMensagens([{ role: 'assistant', content: resposta }])
    } catch {
      setMensagens([{ role: 'assistant', content: `Olá, ${nomeUsuario}! Como posso ajudar?` }])
    } finally {
      setEnviando(false)
    }
  }

  if (!user) return null

  function resetFluxoDemanda() {
    setEtapaDemanda('nenhuma')
    setDescricaoDemanda(''); setCategoriaIdDemanda(''); setCategoriaNomeDemanda('')
    setEntidadeIdDemanda(''); setEntidadeNomeDemanda('')
    setCoordDemanda(null); setOpcoesAutoridade([])
    removerFoto(); setTurnstileToken(''); setCaptchaVisivel(false)
  }

  async function enviar() {
    if (!input.trim() || enviando) return
    const texto = input.trim()
    setMensagens(prev => [...prev, { role: 'user', content: texto }])
    setInput('')

    const historico = [...mensagens, { role: 'user' as const, content: texto }]
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

      const jsonMatch = resposta.match(/\{"action":"detectar_demanda"[^}]+\}/)
      if (jsonMatch) {
        try {
          const payload = JSON.parse(jsonMatch[0])
          setDescricaoDemanda(payload.descricao || texto)
          setCategoriaIdDemanda(payload.categoria_id || '')
          const catNome = payload.categoria_nome || 'Outros'
          setCategoriaNomeDemanda(catNome)
          setMensagens(prev => [...prev, { role: 'assistant', content: 'O CidadanIA Frutal pode tentar dar voz à sua reclamação! Podemos registrar uma demanda sobre isso, e ela ficará visível para todos. Seus dados são preservados, apenas o seu nome é publicado. Você escolhe uma autoridade para que seja enviada automaticamente, e tentaremos obter uma resposta sobre. Quer registrar?' }])
          setEtapaDemanda('perguntar_registrar')
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

  function aoConfirmarQuerRegistrar() {
    setMensagens(prev => [...prev, { role: 'user', content: 'Sim, registrar' }])
    const vinculadas = catEntidades[categoriaIdDemanda] || []
    const opcoes = vinculadas.length > 0 ? entidades.filter(en => vinculadas.includes(en.id)) : entidades

    comDigitando(() => {
      if (opcoes.length === 0) {
        setMensagens(prev => [...prev, { role: 'assistant', content: 'Não encontrei nenhuma autoridade cadastrada no sistema no momento. Não é possível registrar a demanda agora.' }])
        resetFluxoDemanda()
        return
      }

      setOpcoesAutoridade(opcoes)
      if (opcoes.length === 1) {
        const ent = opcoes[0]
        setMensagens(prev => [...prev, { role: 'assistant', content: `Esse tipo de problema eu vou direcionar para ${ent.nome} (${ent.cargo}). Confirma?` }])
      } else {
        setMensagens(prev => [...prev, { role: 'assistant', content: 'Pra qual dessas autoridades você quer direcionar?' }])
      }
      setEtapaDemanda('escolher_autoridade')
    })
  }

  function aoRecusarRegistrar() {
    setMensagens(prev => [...prev, { role: 'user', content: 'Não' }])
    comDigitando(() => {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Sem problemas! Posso ajudar com mais alguma coisa?' }])
      resetFluxoDemanda()
    })
  }

  function aoEscolherAutoridade(ent: Entidade) {
    setEntidadeIdDemanda(ent.id)
    setEntidadeNomeDemanda(ent.nome)
    setMensagens(prev => [...prev, { role: 'user', content: ent.nome }])
    comDigitando(() => {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Onde fica esse local? Digite o endereço ou aponte no mapa abaixo.' }])
      setEtapaDemanda('perguntar_endereco')
    })
  }

  function aoConfirmarEnderecoMapa(endereco: string, lat: number, lng: number) {
    setCoordDemanda({ lat, lng, label: endereco })
    setMensagens(prev => [...prev, { role: 'user', content: `Localização confirmada: ${endereco}` }])
    comDigitando(() => {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Localização salva! Envie uma foto do local para ajudar a identificar melhor o problema.' }])
      setEtapaDemanda('perguntar_foto')
    })
  }

  function aoClicarSemFoto() {
    setMensagens(prev => [...prev, { role: 'user', content: 'Sem foto' }])
    comDigitando(irParaResumo)
  }

  function irParaResumo() {
    setMensagens(prev => [...prev, {
      role: 'assistant',
      content: `Tudo pronto! Dá uma olhadinha no resumo antes de registrarmos:\n\nEndereço: ${coordDemanda?.label}\nCategoria: ${categoriaNomeDemanda}\nDirecionada para: ${entidadeNomeDemanda}\nDescrição: ${descricaoDemanda}\n\nConfirma o registro?`
    }])
    setEtapaDemanda('resumo')
  }

  function aoClicarConfirmar() {
    setMensagens(prev => [...prev, { role: 'user', content: 'Confirmo o registro.' }])
    setCaptchaVisivel(true)
  }

  function aoVerificarCaptcha(token: string) {
    setTurnstileToken(token)
    confirmarDemanda(token)
  }

  async function confirmarDemanda(token: string) {
    if (etapaDemanda !== 'resumo' || criando || !coordDemanda) return
    setCriando(true)

    try {
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
          descricao: descricaoDemanda,
          endereco_label: coordDemanda.label,
          lat: coordDemanda.lat,
          lng: coordDemanda.lng,
          categoria_id: categoriaIdDemanda,
          entidade_id: entidadeIdDemanda,
          morador_nome: perfil?.nome || nomeUsuario,
          foto_url,
          via_chatbot: true,
          turnstile_token: token,
        }),
      })

      if (res.ok) {
        resetFluxoDemanda()
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
    resetFluxoDemanda()
    setMensagens(prev => [...prev, { role: 'assistant', content: 'Ok, cancelei o registro. Posso ajudar com mais alguma coisa?' }])
  }

  const inputDesabilitado = enviando || etapaDemanda !== 'nenhuma'

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
            background: '#4256c8', border: 'none', cursor: 'pointer',
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
            background: '#4256c8', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: '16px 16px 0 0',
            position: 'relative', overflow: 'visible',
          }}>
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
            {etapaDemanda === 'perguntar_registrar' && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                <button onClick={aoConfirmarQuerRegistrar}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Sim, registrar
                </button>
                <button onClick={aoRecusarRegistrar}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Não
                </button>
              </div>
            )}

            {/* Etapa: escolher/confirmar autoridade */}
            {etapaDemanda === 'escolher_autoridade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                {opcoesAutoridade.map(ent => (
                  <button key={ent.id} onClick={() => aoEscolherAutoridade(ent)}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    {opcoesAutoridade.length === 1 ? 'Sim, confirmar' : `${ent.nome} — ${ent.cargo}`}
                  </button>
                ))}
              </div>
            )}

            {/* Etapa: endereço + mini-mapa numa tela só */}
            {etapaDemanda === 'perguntar_endereco' && (
              <MiniMapaConfirmar onConfirmar={aoConfirmarEnderecoMapa} />
            )}

            {/* Etapa: perguntar sobre foto */}
            {etapaDemanda === 'perguntar_foto' && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                <button onClick={() => fotoInputRef.current?.click()}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Anexar foto
                </button>
                <button onClick={aoClicarSemFoto}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Sem foto
                </button>
                <input ref={fotoInputRef} type="file" accept="image/*" onChange={selecionarFoto} style={{ display: 'none' }} />
              </div>
            )}

            {/* Etapa: resumo final + captcha + confirmar */}
            {etapaDemanda === 'resumo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fotoPreview && (
                  <img src={fotoPreview} alt="Foto anexada" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                )}
                {captchaVisivel && (
                  <Turnstile size="flexible" onVerify={aoVerificarCaptcha} onExpire={() => setTurnstileToken('')} />
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                  <button onClick={aoClicarConfirmar} disabled={criando || captchaVisivel}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: (criando || captchaVisivel) ? 'wait' : 'pointer' }}>
                    {criando ? 'Registrando...' : captchaVisivel ? 'Verificando...' : 'Confirmar'}
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
              disabled={inputDesabilitado}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', resize: 'none' }}
            />
            <button onClick={enviar} disabled={inputDesabilitado || !input.trim()}
              style={{ background: inputDesabilitado || !input.trim() ? '#6b7280' : '#4256c8', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 14px', cursor: inputDesabilitado || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
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
