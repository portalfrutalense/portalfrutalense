import { Suspense } from 'react'
import MapaDemandas from '@/components/MapaDemandas'

// BUG CORRIGIDO: <ChatBot /> era renderizado aqui E em PublicShell.tsx (que
// já cobre a rota /mapa no ramo `isMapa`) — dois botões flutuantes
// `position: fixed` sobrepostos, o usuário via só um mas o DOM tinha dois.
export default function MapaPage() {
  return (
    <Suspense fallback={null}>
      <MapaDemandas />
    </Suspense>
  )
}
