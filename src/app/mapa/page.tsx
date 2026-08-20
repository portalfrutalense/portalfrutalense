import MapaDemandas from '@/components/MapaDemandas'

export default function MapaPage() {
  return (
    <div>
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Mapa de Demandas</h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Demandas dos cidadãos de Frutal-MG direcionadas às autoridades públicas. Registre a sua e acompanhe a resposta.
        </p>
      </div>
      <MapaDemandas />
    </div>
  )
}
