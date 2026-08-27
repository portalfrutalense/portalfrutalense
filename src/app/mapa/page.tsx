import { Suspense } from 'react'
import MapaDemandas from '@/components/MapaDemandas'

export default function MapaPage() {
  return (
    <Suspense fallback={null}>
      <MapaDemandas />
    </Suspense>
  )
}
