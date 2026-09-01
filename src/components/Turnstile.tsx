'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id: string) => void
    }
  }
}

interface Props {
  onVerify: (token: string) => void
  onExpire?: () => void
  size?: 'normal' | 'compact' | 'flexible'
}

export default function Turnstile({ onVerify, onExpire, size = 'compact' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [falhouCarregar, setFalhouCarregar] = useState(false)

  // O widget é registrado uma única vez (efeito com deps []) — sem essas refs,
  // o callback ficaria preso na função onVerify/onExpire de quando o widget
  // foi montado. Se o componente pai re-renderizar nesse meio tempo com uma
  // nova referência de função (comum quando o prop vem de um hook sem
  // useCallback, como em ChatBot.tsx), o widget continuaria chamando a
  // versão antiga, presa a um estado desatualizado.
  // A atualização roda num efeito (depois do render), nunca durante o
  // render em si — escrever em ref.current no corpo do componente é
  // proibido a partir do React 19 (regra react-hooks/refs).
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    function renderWidget() {
      if (!containerRef.current || !window.turnstile || widgetId.current) return
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        size,
        theme: 'light',
        appearance: 'always',
        callback: (token: string) => onVerifyRef.current(token),
        'expired-callback': () => onExpireRef.current?.(),
      })
    }

    // BUG CORRIGIDO: sem limite, este setInterval rodava pra sempre se o
    // script da Cloudflare não carregasse (bloqueado por extensão, rede,
    // CSP futura) — o widget nunca aparecia, sem token o formulário nunca
    // podia ser enviado, sem timeout, sem mensagem, sem alternativa nenhuma
    // (vale pra demanda, pet, classificado e vaga — todo formulário que usa
    // este componente). Agora desiste depois de ~15s e mostra um aviso.
    let tentativas = 0
    const MAX_TENTATIVAS = 75 // 75 × 200ms = 15s

    if (window.turnstile) {
      renderWidget()
    } else {
      intervalId = setInterval(() => {
        if (window.turnstile) {
          renderWidget()
          if (intervalId) clearInterval(intervalId)
          return
        }
        tentativas++
        if (tentativas >= MAX_TENTATIVAS) {
          if (intervalId) clearInterval(intervalId)
          setFalhouCarregar(true)
        }
      }, 200)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      {falhouCarregar ? (
        <div style={{ fontSize: '13px', color: '#dc2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span>Não foi possível carregar a verificação de segurança. Verifique sua conexão ou desative bloqueadores de script.</span>
          <button type="button" onClick={() => window.location.reload()} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#4256c8', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </>
  )
}
