import { Suspense } from 'react'
import MapaDemandas from '@/components/MapaDemandas'
import TourBoasVindas from '@/components/TourBoasVindas'

export default function MapaPage() {
  return (
    <>
      <Suspense fallback={null}>
        <MapaDemandas />
      </Suspense>
      <TourBoasVindas />
    </>
  )
}
