import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { ipDaRequisicao, limiteExcedido } from '@/lib/auth-api'

// GET /api/chatbot-config
// A tabela chatbot_config só tem SELECT liberado por RLS pra role='master'
// (é lida direto do banco em /api/chat e no webhook do WhatsApp, ambos via
// service_role) — sem essa rota, a UI do site não tinha como saber o nome do
// bot configurado no painel master, e ficava com um nome fixo no código.
// Expõe só nome_bot: o resto da config (prompt, responsabilidades etc.) não
// tem por que ficar público.
export async function GET(req: NextRequest) {
  // BUG CORRIGIDO: rota pública sem autenticação e sem freio nenhum — cada
  // chamada é uma consulta ao banco. O impacto de vazar `nome_bot` é baixo,
  // mas nada limitava o volume de chamadas. Por IP (não por usuário, já que
  // a rota não exige login).
  if (limiteExcedido(`chatbot-config:${ipDaRequisicao(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde um instante.' }, { status: 429 })
  }
  const { data } = await supabaseServer.from('chatbot_config').select('nome_bot').eq('id', 1).maybeSingle()
  return NextResponse.json({ nome_bot: data?.nome_bot || null })
}
