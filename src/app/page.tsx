import { supabase } from '@/lib/supabase'
import { Denuncia } from '@/types'
import CardDenuncia from '@/components/CardDenuncia'
import FormDenuncia from '@/components/FormDenuncia'

export const revalidate = 10

async function getDenuncias(): Promise<Denuncia[]> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('*, entidade:entidades(*)')
    .in('status', ['aguardando_resposta', 'respondida'])
    .eq('oculto', false)
    .order('created_at', { ascending: false })

  if (error) return []
  return data as Denuncia[]
}

export default async function HomePage() {
  const denuncias = await getDenuncias()

  return (
    <div>
      <div style={{ marginBottom: '32px', borderBottom: '1px solid #e5e7eb', paddingBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Fórum de Denúncias</h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Canal de cobrança direta para autoridades e órgãos públicos de Frutal-MG.
          O nome do autor é exibido para dar credibilidade à denúncia.
        </p>
      </div>

      <FormDenuncia />

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '32px 0' }}>
        <div style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
        <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>Denúncias Públicas</span>
        <div style={{ flex: 1, borderTop: '1px solid #e5e7eb' }} />
      </div>

      {denuncias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '15px' }}>Nenhuma denúncia publicada ainda.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Seja o primeiro a registrar uma cobrança.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {denuncias.map((d) => (
            <CardDenuncia key={d.id} denuncia={d} />
          ))}
        </div>
      )}
    </div>
  )
}
