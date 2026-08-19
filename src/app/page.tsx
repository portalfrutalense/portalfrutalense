import { supabase } from '@/lib/supabase'
import { Denuncia } from '@/types'
import CardDenuncia from '@/components/CardDenuncia'
import FormDenuncia from '@/components/FormDenuncia'

export const revalidate = 60

async function getDenuncias(): Promise<Denuncia[]> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('*, entidade:entidades(*)')
    .in('status', ['aguardando_resposta', 'respondida'])
    .order('created_at', { ascending: false })

  if (error) return []
  return data as Denuncia[]
}

export default async function HomePage() {
  const denuncias = await getDenuncias()

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Fórum de Denúncias</h1>
        <p className="text-gray-500 text-sm">
          Canal de cobrança direta para autoridades e órgãos públicos de Frutal-MG.
          Nome e CPF do autor são exibidos para dar credibilidade à denúncia.
        </p>
      </div>

      {/* Formulário */}
      <FormDenuncia />

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">Denúncias Públicas</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Lista de denúncias */}
      {denuncias.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-base">Nenhuma denúncia publicada ainda.</p>
          <p className="text-sm mt-1">Seja o primeiro a registrar uma cobrança.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {denuncias.map((d) => (
            <CardDenuncia key={d.id} denuncia={d} />
          ))}
        </div>
      )}
    </div>
  )
}
