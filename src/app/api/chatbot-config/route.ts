import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/chatbot-config
// A tabela chatbot_config só tem SELECT liberado por RLS pra role='master'
// (é lida direto do banco em /api/chat e no webhook do WhatsApp, ambos via
// service_role) — sem essa rota, a UI do site não tinha como saber o nome do
// bot configurado no painel master, e ficava com um nome fixo no código.
// Expõe só nome_bot: o resto da config (prompt, responsabilidades etc.) não
// tem por que ficar público.
export async function GET() {
  const { data } = await supabaseServer.from('chatbot_config').select('nome_bot').eq('id', 1).maybeSingle()
  return NextResponse.json({ nome_bot: data?.nome_bot || null })
}
