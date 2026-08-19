'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, AlertTriangle, Send } from 'lucide-react'

interface DadosDenuncia {
  id: string
  mensagem: string
  morador_nome: string
  entidade: { nome: string; cargo: string }
}

export default function PageResponder() {
  const { token } = useParams<{ token: string }>()
  const [dados, setDados] = useState<DadosDenuncia | null>(null)
  const [erro, setErro] = useState('')
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch(`/api/responder?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json()
          setErro(d.error || 'Link inválido.')
        } else {
          setDados(await res.json())
        }
      })
      .catch(() => setErro('Erro ao carregar.'))
      .finally(() => setCarregando(false))
  }, [token])

  async function handleEnviar() {
    if (resposta.trim().length < 10) {
      alert('Escreva uma resposta mais completa (mínimo 10 caracteres).')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, resposta }),
      })
      if (!res.ok) {
        const d = await res.json()
        setErro(d.error || 'Erro ao enviar resposta.')
      } else {
        setSucesso(true)
      }
    } catch {
      setErro('Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Carregando...
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Resposta Registrada!</h1>
          <p className="text-gray-500">
            Sua resposta oficial foi publicada no Portal Frutalense.
            Este link não pode mais ser utilizado.
          </p>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="mx-auto text-red-400 mb-4" size={64} />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Link Inválido</h1>
          <p className="text-gray-500">{erro}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-12">
      <div className="max-w-xl w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-green-700 font-bold text-xl">🏛️ Portal Frutalense</p>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">Resposta Oficial</h1>
          {dados?.entidade && (
            <p className="text-gray-500 text-sm mt-1">
              {dados.entidade.nome} · {dados.entidade.cargo}
            </p>
          )}
        </div>

        {/* Denúncia original */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Cobrança de {dados?.morador_nome}
          </p>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {dados?.mensagem}
          </p>
        </div>

        {/* Campo de resposta */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <label className="block text-sm font-semibold text-gray-700">
            Sua Resposta Oficial
          </label>
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={7}
            placeholder="Digite aqui seu posicionamento oficial sobre a demanda acima..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          <p className="text-xs text-gray-400">
            Sua resposta será publicada publicamente no portal com seu nome e cargo.
          </p>
          <button
            onClick={handleEnviar}
            disabled={enviando}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm w-full justify-center"
          >
            <Send size={16} />
            {enviando ? 'Enviando...' : 'Publicar Resposta Oficial'}
          </button>
        </div>
      </div>
    </div>
  )
}
