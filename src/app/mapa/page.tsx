import MapaOcorrencias from '@/components/MapaOcorrencias'

export default function MapaPage() {
  return (
    <div>
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Mapa de Ocorrências</h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Problemas de infraestrutura urbana mapeados pela população de Frutal-MG.
          Registre uma ocorrência informando o endereço e a categoria do problema.
        </p>
      </div>
      <MapaOcorrencias />
    </div>
  )
}
