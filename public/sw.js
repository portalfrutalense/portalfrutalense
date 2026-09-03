// Service Worker mínimo — existe só pra satisfazer o critério de
// instalabilidade de PWA do Chrome/Android (que exige um Service Worker
// registrado pra liberar o prompt nativo de "Instalar aplicativo"). Não
// faz cache nem intercepta nada: toda requisição segue normal pra rede.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // pass-through de propósito — sem cache, sem modo offline
})
