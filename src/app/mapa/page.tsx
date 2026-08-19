import MapaOcorrencias from '@/components/MapaOcorrencias'

export default function MapaPage() {
  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🗺️ Mapa de Ocorrências</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Problemas de infraestrutura urbana mapeados pela população de Frutal-MG.
          Clique no mapa para registrar uma ocorrência na sua localização.
        </p>
      </div>
      <MapaOcorrencias />
    </div>
  )
}
