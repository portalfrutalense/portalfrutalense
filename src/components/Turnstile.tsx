'use client'

import { useEffect, useRef } from 'react'
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

  // O widget é registrado uma única vez (efeito com deps []) — sem essas refs,
  // o callback ficaria preso na função onVerify/onExpire de quando o widget
  // foi montado. Se o componente pai re-renderizar nesse meio tempo com uma
  // nova referência de função (comum quando o prop vem de um hook sem
  // useCallback, como em ChatBot.tsx), o widget continuaria chamando a
  // versão antiga, presa a um estado desatualizado.
  const onVerifyRef = useRef(onVerify)
  onVerifyRef.current = onVerify
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

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

    if (window.turnstile) {
      renderWidget()
    } else {
      intervalId = setInterval(() => {
        if (window.turnstile) {
          renderWidget()
          if (intervalId) clearInterval(intervalId)
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
      <div ref={containerRef} />
    </>
  )
}
