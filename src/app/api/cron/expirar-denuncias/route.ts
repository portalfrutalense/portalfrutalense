import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  // Verifica secret para evitar chamadas não autorizadas
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // Busca denúncias aguardando resposta com link expirado há mais de 7 dias
  const { data, error } = await supabaseAdmin
    .from('denuncias')
    .select('id')
    .eq('status', 'aguardando_resposta')
    .lt('magic_token_expira_em', new Date().toISOString())

  if (error) return NextResponse.json({ error: 'Erro ao buscar.' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ ok: true, atualizadas: 0 })

  const ids = data.map(d => d.id)

  const { error: updateError } = await supabaseAdmin
    .from('denuncias')
    .update({ status: 'nao_respondida' })
    .in('id', ids)

  if (updateError) return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 })

  return NextResponse.json({ ok: true, atualizadas: ids.length })
}
