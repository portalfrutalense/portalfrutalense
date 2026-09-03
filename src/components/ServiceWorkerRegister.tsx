'use client'

import { useEffect } from 'react'

// Registra o Service Worker mínimo (public/sw.js) assim que o site carrega.
// Sem ele, o Chrome/Android nunca dispara "beforeinstallprompt" — o botão
// "Instalar aplicativo" do gate de navegador in-app (page.tsx) depende
// disso pra funcionar.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
