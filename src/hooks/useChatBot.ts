'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '@/components/AuthProvider'

export interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

export interface Entidade {
  id: string
  nome: string
  cargo: string
}

export type EtapaDemanda =
  | 'nenhuma'
  | 'perguntar_registrar'
  | 'escolher_autoridade'
  | 'perguntar_endereco'
  | 'perguntar_foto'
  | 'resumo'

// Localiza e extrai um objeto {"action":...} completo usando contagem de chaves.
// Regex simples quebra se o valor tiver "}" dentro.
export function extrairAcao(texto: string): Record<string, unknown> | null {
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

// O Google às vezes manda o nome todo em minúsculo — garante a primeira letra maiúscula
export function capitalizar(nome: string) {
  return nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : nome
}

export async function comprimirFoto(file: File): Promise<Blob> {
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

export function useChatBot() {
  const supabase = createClient()
  const { user, perfil } = useAuth()
  const nomeUsuario = capitalizar(perfil?.nome?.split(' ')[0] || user?.user_metadata?.given_name || 'Cidadão')

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [notif, setNotif] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [captchaVisivel, setCaptchaVisivel] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [micDisponivel, setMicDisponivel] = useState(() => {
    if (typeof window === 'undefined') return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  })

  // Fluxo de registro de demanda (etapas conduzidas por código, não pela IA)
  const [etapaDemanda, setEtapaDemanda] = useState<EtapaDemanda>('nenhuma')
  const [descricaoDemanda, setDescricaoDemanda] = useState('')
  const [categoriaIdDemanda, setCategoriaIdDemanda] = useState('')
  const [categoriaNomeDemanda, setCategoriaNomeDemanda] = useState('')
  const [entidadesIdsDemanda, setEntidadesIdsDemanda] = useState<string[]>([])
  const [entidadesNomesDemanda, setEntidadesNomesDemanda] = useState<string[]>([])
  const [dropdownAutoridade, setDropdownAutoridade] = useState(false)
  const [coordDemanda, setCoordDemanda] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [opcoesAutoridade, setOpcoesAutoridade] = useState<Entidade[]>([])
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [catEntidades, setCatEntidades] = useState<Record<string, string[]>>({})

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

  function removerFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoFile(null)
    setFotoPreview(null)
  }

  function resetFluxoDemanda() {
    setEtapaDemanda('nenhuma')
    setDescricaoDemanda(''); setCategoriaIdDemanda(''); setCategoriaNomeDemanda('')
    setEntidadesIdsDemanda([]); setEntidadesNomesDemanda([])
    setDropdownAutoridade(false)
    setCoordDemanda(null); setOpcoesAutoridade([])
    removerFoto(); setTurnstileToken(''); setCaptchaVisivel(false)
  }

  // irParaResumo usa os valores das closures do render atual — correto porque é sempre chamada
  // via comDigitando() DEPOIS que os states anteriores (coordDemanda, entidadesNomesDemanda, etc.)
  // já foram setados e o componente re-renderizou.
  function irParaResumo() {
    setMensagens(prev => [...prev, {
      role: 'assistant',
      content: `Tudo pronto! Dá uma olhadinha no resumo antes de registrarmos:\n\nEndereço: ${coordDemanda?.label}\nCategoria: ${categoriaNomeDemanda}\nDirecionada para: ${entidadesNomesDemanda.join(', ')}\nDescrição: ${descricaoDemanda}\n\nConfirma o registro?`
    }])
    setEtapaDemanda('resumo')
  }

  function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setMensagens(prev => [...prev, { role: 'assistant', content: 'Essa foto está muito grande (máx. 20 MB). Tente outra.' }])
      e.target.value = ''
      return
    }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    e.target.value = ''
    setMensagens(prev => [...prev, { role: 'user', content: 'Foto anexada.' }])
    comDigitando(irParaResumo)
  }

  function alternarGravacao() {
    if (gravando) {
      recognitionRef.current?.stop()
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setMicDisponivel(false); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const texto = event.results[0][0].transcript
      setInput(prev => (prev ? `${prev} ${texto}` : texto))
    }
    recognition.onerror = () => setGravando(false)
    recognition.onend = () => setGravando(false)

    recognitionRef.current = recognition
    recognition.start()
    setGravando(true)
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
        // Pré-seleciona a única opção
        setEntidadesIdsDemanda([opcoes[0].id])
        setEntidadesNomesDemanda([opcoes[0].nome])
        setMensagens(prev => [...prev, { role: 'assistant', content: `Esse tipo de problema será direcionado para ${opcoes[0].nome} (${opcoes[0].cargo}). Confirma?` }])
      } else {
        setMensagens(prev => [...prev, { role: 'assistant', content: 'Selecione até 3 autoridades para direcionar esta demanda:' }])
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

  function toggleAutoridade(ent: Entidade) {
    setEntidadesIdsDemanda(prev => {
      if (prev.includes(ent.id)) {
        setEntidadesNomesDemanda(n => n.filter(nm => nm !== ent.nome))
        return prev.filter(id => id !== ent.id)
      }
      if (prev.length >= 3) return prev
      setEntidadesNomesDemanda(n => [...n, ent.nome])
      return [...prev, ent.id]
    })
  }

  function aoConfirmarAutoridades() {
    if (entidadesIdsDemanda.length === 0) return
    setDropdownAutoridade(false)
    const nomes = entidadesNomesDemanda.join(', ')
    setMensagens(prev => [...prev, { role: 'user', content: `Selecionado: ${nomes}` }])
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
          entidade_ids: entidadesIdsDemanda,
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

  return {
    // Auth
    user,
    perfil,
    nomeUsuario,
    supabase,

    // Estado de UI
    mensagens,
    setMensagens,
    input,
    setInput,
    enviando,
    criando,
    notif,
    fotoFile,
    fotoPreview,
    turnstileToken,
    captchaVisivel,
    gravando,
    micDisponivel,

    // Fluxo de demanda
    etapaDemanda,
    descricaoDemanda,
    categoriaIdDemanda,
    categoriaNomeDemanda,
    entidadesIdsDemanda,
    entidadesNomesDemanda,
    dropdownAutoridade,
    setDropdownAutoridade,
    coordDemanda,
    opcoesAutoridade,

    // Refs
    fotoInputRef,
    recognitionRef,

    // Ações
    enviar,
    enviarSaudacaoInicial,
    alternarGravacao,
    aoConfirmarQuerRegistrar,
    aoRecusarRegistrar,
    toggleAutoridade,
    aoConfirmarAutoridades,
    aoConfirmarEnderecoMapa,
    selecionarFoto,
    aoClicarSemFoto,
    aoClicarConfirmar,
    aoVerificarCaptcha,
    cancelarDemanda,

    // Derivado
    inputDesabilitado,
  }
}
