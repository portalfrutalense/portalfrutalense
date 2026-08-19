import { supabase } from '@/lib/supabase'
import { Denuncia } from '@/types'
import FormDenuncia from '@/components/FormDenuncia'
import ListaDenuncias from '@/components/ListaDenuncias'

export const revalidate = 10

async function getDenuncias(): Promise<Denuncia[]> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('*, entidade:entidades(*)')
    .in('status', ['aguardando_resposta', 'respondida', 'nao_respondida'])
    .eq('oculto', false)
    .order('created_at', { ascending: false })

  if (error) return []
  return data as Denuncia[]
}

export default async function DenunciasPage() {
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

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <FormDenuncia />
      </div>

      {denuncias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '15px' }}>Nenhuma denúncia publicada ainda.</p>
        </div>
      ) : (
        <ListaDenuncias denuncias={denuncias} />
      )}
    </div>
  )
}
