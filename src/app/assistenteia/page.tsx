'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'
import ModalAuth from '@/components/ModalAuth'
import Navbar from '@/components/Navbar'
import Turnstile from '@/components/Turnstile'
import MiniMapaConfirmar from '@/components/MiniMapaConfirmar'

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

function extrairAcao(texto: string): Record<string, unknown> | null {
  const inicio = texto.search(/\{\s*"action"\s*:/)
  if (inicio === -1) return null
  let profundidade = 0, emString = false, escapado = false
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (escapado) { escapado = false; continue }
    if (c === '\\') { escapado = true; continue }
    if (c === '"') { emString = !emString; continue }
    if (emString) continue
    if (c === '{') profundidade++
    else if (c === '}' && --profundidade === 0) {
      try { return JSON.parse(texto.slice(inicio, i + 1)) } catch { return null }
    }
  }
  return null
}

// O Google as vezes manda o nome todo em minusculo -- garante a primeira letra maiuscula
function capitalizar(nome: string) {
  return nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : nome
}

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

export default function LucasPage() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const nomeUsuario = capitalizar(perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || '')

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [notif, setNotif] = useState('')
  const [modalAuth, setModalAuth] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [micDisponivel, setMicDisponivel] = useState(() => {
    if (typeof window === 'undefined') return true
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) // eslint-disable-line @typescript-eslint/no-explicit-any
  })
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pageBottomRef = useRef<HTMLDivElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

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

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  async function enviar() {
    if (!input.trim() || enviando) return
    if (!user) { setModalAuth(true); return }

    const texto = input.trim()
    const novaMensagem: Mensagem = { role: 'user', content: texto }
    setMensagens(prev => [...prev, novaMensagem])
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }

    const historico = [...mensagens, novaMensagem]
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

      const acao = extrairAcao(resposta)
      if (acao?.action === 'detectar_demanda') {
        setDescricaoDemanda((acao.descricao as string) || texto)
        setCategoriaIdDemanda((acao.categoria_id as string) || '')
        setCategoriaNomeDemanda((acao.categoria_nome as string) || 'Outros')
        setMensagens(prev => [...prev, { role: 'assistant', content: 'O CidadanIA Frutal pode tentar dar voz à sua reclamação! Podemos registrar uma demanda sobre isso, e ela ficará visível para todos. Seus dados são preservados, apenas o seu nome é publicado. Você escolhe uma autoridade para que seja enviada automaticamente, e tentaremos obter uma resposta sobre. Quer registrar?' }])
        setEtapaDemanda('perguntar_registrar')
      } else {
        setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
      }
    } catch {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tente novamente.' }])
    } finally {
      setEnviando(false)
    }
  }

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
  const inputDesabilitado = enviando || etapaDemanda !== 'nenhuma'

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
          placeholder={!user ? 'Entre na sua conta para conversar' : 'Registre demandas, tire dúvidas ou peça uma ajuda...'}
          disabled={inputDesabilitado || !user}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: '15px', color: '#111827', resize: 'none', lineHeight: 1.5, maxHeight: '160px', padding: 0, display: 'block', overflowX: 'hidden', overflowY: 'auto' }}
        />
        {micDisponivel && user && (
          <button
            type="button"
            onClick={alternarGravacao}
            disabled={inputDesabilitado}
            title={gravando ? 'Parar gravação' : 'Falar em vez de digitar'}
            style={{
              background: gravando ? '#dc2626' : 'transparent',
              color: gravando ? 'white' : '#6b7280',
              border: 'none', borderRadius: '10px',
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: inputDesabilitado ? 'default' : 'pointer',
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
          disabled={inputDesabilitado || (!!user && !input.trim())}
          style={{
            background: (!user || input.trim()) ? '#4256c8' : 'transparent',
            color: (!user || input.trim()) ? 'white' : '#6b7280',
            border: 'none', borderRadius: '10px',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (inputDesabilitado || (user && !input.trim())) ? 'default' : 'pointer',
            flexShrink: 0, transition: 'background 0.15s',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="13 6 19 12 13 18" />
          </svg>
        </button>
      </div>
      {!user && (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', margin: '10px 0 0' }}>
          <button onClick={() => setModalAuth(true)} style={{ background: 'none', border: 'none', color: '#4256c8', fontWeight: 600, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
            Entre na sua conta
          </button>{' '}para conversar com o assistente
        </p>
      )}
    </>
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, etapaDemanda, enviando])

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

  function resetFluxoDemanda() {
    setEtapaDemanda('nenhuma')
    setDescricaoDemanda(''); setCategoriaIdDemanda(''); setCategoriaNomeDemanda('')
    setEntidadeIdDemanda(''); setEntidadeNomeDemanda('')
    setCoordDemanda(null); setOpcoesAutoridade([])
    removerFoto(); setTurnstileToken(''); setCaptchaVisivel(false)
  }

  function aoConfirmarQuerRegistrar() {
    setMensagens(prev => [...prev, { role: 'user', content: 'Sim, registrar' }])
    const vinculadas = catEntidades[categoriaIdDemanda] || []
    const opcoes = entidades.filter(en => vinculadas.includes(en.id))

    comDigitando(() => {
      if (opcoes.length === 0) {
        setMensagens(prev => [...prev, { role: 'assistant', content: 'Não há autoridade vinculada a essa categoria no momento. Não é possível registrar a demanda agora.' }])
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
          entidade_ids: [entidadeIdDemanda],
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
              <div style={{ width: '240px', height: '240px', borderRadius: '50%', background: '#4256c8', position: 'relative', marginBottom: '16px' }}>
                {/* Da metade pra baixo a foto fica presa ao circulo; da metade pra cima pode vazar */}
                <div style={{ position: 'absolute', inset: 0, clipPath: 'inset(-1000px 0 0 0 round 0 0 120px 120px)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assistenteia.png" alt="Assistente virtual" style={{ position: 'absolute', bottom: '-60px', left: '50%', transform: 'translateX(-50%)', height: '150%', width: 'auto', pointerEvents: 'none' }} />
                </div>
              </div>
              <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: '#111827', margin: '0 0 28px', letterSpacing: '-0.5px' }}>
                Olá{nomeUsuario ? `, ${nomeUsuario}` : ''}!
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
            {mensagens.map((m, i) => (
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
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Lucas</p>
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
            {etapaDemanda === 'perguntar_registrar' && (
              <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
                <button onClick={aoConfirmarQuerRegistrar}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Sim, registrar
                </button>
                <button onClick={aoRecusarRegistrar}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Não
                </button>
              </div>
            )}

            {/* Etapa: escolher/confirmar autoridade */}
            {etapaDemanda === 'escolher_autoridade' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', paddingLeft: '46px' }}>
                {opcoesAutoridade.map(ent => (
                  <button key={ent.id} onClick={() => aoEscolherAutoridade(ent)}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    {opcoesAutoridade.length === 1 ? 'Sim, confirmar' : `${ent.nome} — ${ent.cargo}`}
                  </button>
                ))}
              </div>
            )}

            {/* Etapa: endereço + mini-mapa numa tela só */}
            {etapaDemanda === 'perguntar_endereco' && (
              <div style={{ paddingLeft: '46px', maxWidth: '480px' }}>
                <MiniMapaConfirmar onConfirmar={aoConfirmarEnderecoMapa} />
              </div>
            )}

            {/* Etapa: perguntar sobre foto */}
            {etapaDemanda === 'perguntar_foto' && (
              <div style={{ display: 'flex', gap: '10px', paddingLeft: '46px' }}>
                <button onClick={() => fotoInputRef.current?.click()}
                  style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Anexar foto
                </button>
                <button onClick={aoClicarSemFoto}
                  style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Sem foto
                </button>
                <input ref={fotoInputRef} type="file" accept="image/*" onChange={selecionarFoto} style={{ display: 'none' }} />
              </div>
            )}

            {/* Etapa: resumo final + captcha + confirmar */}
            {etapaDemanda === 'resumo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '46px' }}>
                {fotoPreview && (
                  <img src={fotoPreview} alt="Foto anexada" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
                )}
                {captchaVisivel && (
                  <Turnstile size="flexible" onVerify={aoVerificarCaptcha} onExpire={() => setTurnstileToken('')} />
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={aoClicarConfirmar} disabled={criando || captchaVisivel}
                    style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: (criando || captchaVisivel) ? 'wait' : 'pointer' }}>
                    {criando ? 'Registrando...' : captchaVisivel ? 'Verificando...' : 'Confirmar'}
                  </button>
                  <button onClick={cancelarDemanda} disabled={criando}
                    style={{ background: 'white', color: '#dc2626', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Digitando */}
            {enviando && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Lucas</p>
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

      {notif && (
        <div style={{ position: 'fixed', bottom: '100px', right: '24px', zIndex: 100, background: '#166534', color: 'white', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          {notif}
        </div>
      )}

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}
    </div>
  )
}
