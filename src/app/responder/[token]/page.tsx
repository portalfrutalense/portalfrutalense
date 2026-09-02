'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface DadosDenuncia {
  id: string
  mensagem: string
  morador_nome: string
  endereco_label?: string
  foto_url?: string
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>
        Carregando...
      </div>
    )
  }

  if (sucesso) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Resposta Registrada</p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Sua resposta oficial foi publicada no CidadanIA Frutal. Este link não pode mais ser utilizado.
          </p>
        </div>
      </div>
    )
  }

  if (erro) {
    const jaRespondida = erro.toLowerCase().includes('já foi respondida')
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            {jaRespondida ? 'Resposta Já Registrada' : 'Link Inválido'}
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            {jaRespondida
              ? 'Você já enviou sua resposta oficial para esta demanda. Obrigado pela participação.'
              : erro}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(24px,5vw,48px) 16px' }}>
      <div style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, color: '#4256c8', fontSize: '16px', margin: 0 }}>CidadanIA Frutal</p>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '4px 0' }}>
            Resposta Oficial{dados?.entidade ? ` de ${dados.entidade.nome}` : ''}
          </h1>
          {dados?.entidade && (
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              {dados.entidade.nome} — {dados.entidade.cargo}
            </p>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Cobrança de {dados?.morador_nome}
          </p>
          <p style={{ color: '#111827', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
            {dados?.mensagem}
          </p>
          {dados?.endereco_label && (
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {dados.endereco_label}
            </p>
          )}
          {dados?.foto_url && (
            <p style={{ margin: '10px 0 0' }}>
              <a href={dados.foto_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '13px', color: '#4256c8', fontWeight: 600, textDecoration: 'none' }}>
                Ver foto da demanda →
              </a>
            </p>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            Sua Resposta Oficial
          </label>
          <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={7}
            placeholder="Digite aqui seu posicionamento oficial sobre a demanda acima..."
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 12px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />


          <button onClick={handleEnviar} disabled={enviando}
            style={{ backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '12px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            {enviando ? 'Enviando...' : 'Publicar Resposta Oficial'}
          </button>

          <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
            Ao responder, seu acesso é registrado para fins de transparência pública e segurança, em conformidade com a LGPD.
          </p>
        </div>
      </div>
    </div>
  )
}
