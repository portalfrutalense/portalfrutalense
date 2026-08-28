import { Suspense } from 'react'
import MapaDemandas from '@/components/MapaDemandas'
import TourBoasVindas from '@/components/TourBoasVindas'
import ChatBot from '@/components/ChatBot'

export default function MapaPage() {
  return (
    <>
      <Suspense fallback={null}>
        <MapaDemandas />
      </Suspense>
      <TourBoasVindas />
      <ChatBot />
    </>
  )
}
