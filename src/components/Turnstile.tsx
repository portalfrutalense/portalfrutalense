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

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    function renderWidget() {
      if (!containerRef.current || !window.turnstile || widgetId.current) return
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        size,
        theme: 'light',
        callback: onVerify,
        'expired-callback': () => onExpire?.(),
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
