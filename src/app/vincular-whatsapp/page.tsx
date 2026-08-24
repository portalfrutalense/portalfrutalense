'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase-browser'
import ModalAuth from '@/components/ModalAuth'

function VincularConteudo() {
  const searchParams = useSearchParams()
  const telefone = searchParams.get('tel') || ''
  const { user, carregando } = useAuth()
  const supabase = createClient()
  const [modalAuth, setModalAuth] = useState(false)
  const [status, setStatus] = useState<'aguardando' | 'vinculando' | 'sucesso' | 'erro'>('aguardando')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (carregando || !user || !telefone || status !== 'aguardando') return
    async function vincular() {
      setStatus('vinculando')
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ telefone }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.error || 'Erro ao vincular.'); setStatus('erro'); return }
      setStatus('sucesso')
    }
    vincular()
  }, [user, carregando, telefone, status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!telefone) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: '14px' }}>Link inválido — falta o número de telefone.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '32px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/CIDADANIA.png" alt="CidadanIA Frutal" style={{ height: '46px', margin: '0 auto 20px', display: 'block' }} />

        {status === 'sucesso' ? (
          <>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>✅</p>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>WhatsApp vinculado!</p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              Pode voltar pra conversa no WhatsApp e continuar de onde parou.
            </p>
          </>
        ) : status === 'erro' ? (
          <>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>⚠️</p>
            <p style={{ fontWeight: 700, color: '#dc2626', fontSize: '15px', margin: '0 0 8px' }}>Não foi possível vincular</p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{erro}</p>
          </>
        ) : !user && !carregando ? (
          <>
            <p style={{ fontSize: '14px', color: '#111827', margin: '0 0 20px', lineHeight: 1.5 }}>
              Pra continuar registrando sua demanda pelo WhatsApp, entre ou crie sua conta:
            </p>
            <button onClick={() => setModalAuth(true)}
              style={{ backgroundColor: '#4256c8', color: 'white', fontWeight: 700, padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
              Entrar / Criar conta
            </button>
          </>
        ) : (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>Vinculando seu número...</p>
        )}
      </div>

      {modalAuth && <ModalAuth onFechar={() => setModalAuth(false)} />}
    </div>
  )
}

export default function VincularWhatsappPage() {
  return (
    <Suspense fallback={null}>
      <VincularConteudo />
    </Suspense>
  )
}
