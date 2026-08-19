import { supabase } from '@/lib/supabase'
import { Denuncia } from '@/types'
import CardDenuncia from '@/components/CardDenuncia'
import FormDenuncia from '@/components/FormDenuncia'

export const revalidate = 60 // revalida a cada 60 segundos

async function getDenuncias(): Promise<Denuncia[]> {
  const { data, error } = await supabase
    .from('denuncias')
    .select('*, entidade:entidades(*)')
    .in('status', ['aguardando_resposta', 'respondida'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar denúncias:', error)
    return []
  }

  return data as Denuncia[]
}

export default async function HomePage() {
  const denuncias = await getDenuncias()

  return (
    <div>
      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📢 Fórum de Denúncias
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Faça sua cobrança direta para autoridades e órgãos públicos de Frutal-MG.
          Seu nome e CPF serão exibidos para dar credibilidade à sua denúncia.
        </p>
      </div>

      {/* Formulário */}
      <FormDenuncia />

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-sm text-gray-400 font-medium">Denúncias Públicas</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Lista de denúncias */}
      {denuncias.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-lg">Nenhuma denúncia publicada ainda.</p>
          <p className="text-sm mt-1">Seja o primeiro a fazer uma cobrança!</p>
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
