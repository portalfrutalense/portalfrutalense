import { NextRequest, NextResponse } from 'next/server'
import { getUser, limiteExcedido } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * ATENÇÃO — achado de auditoria ainda não resolvido de verdade:
 * "telefone" vem de um campo de texto que o próprio usuário digita
 * (ModalCPF.tsx), não do número que de fato conversou com o bot. Nada aqui
 * confirma que quem está pedindo o vínculo é o dono real desse telefone —
 * só que ALGUÉM logado pediu pra vincular ELE a uma conversa recente.
 * O rate limit abaixo reduz tentativa em massa, mas não resolve a causa:
 * a correção completa exigiria um código de confirmação enviado pelo
 * próprio bot do WhatsApp (mexe no Bloco 6), fora do escopo desta rodada.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  if (limiteExcedido(`vincular-whatsapp:${user.id}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'Muitas tentativas em pouco tempo. Aguarde um pouco.' }, { status: 429 })
  }

  const { telefone } = await req.json()
  if (!telefone) return NextResponse.json({ error: 'Telefone obrigatório.' }, { status: 400 })

  // A Evolution API às vezes omite o 9º dígito de celulares BR (553491500046 em vez de 5534991500046)
  // Tenta os dois formatos para garantir o vínculo
  const alternativo = telefone.length === 13
    ? telefone.slice(0, 4) + telefone.slice(5)   // remove o 9: 5534991500046 → 553491500046
    : telefone.slice(0, 4) + '9' + telefone.slice(4) // adiciona o 9: 553491500046 → 5534991500046

  // Só vincula conversas das últimas 24h — evita mostrar botão "Retornar ao WhatsApp" para conversas antigas
  const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [r1, r2] = await Promise.all([
    supabaseServer.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', telefone).gte('atualizado_em', limite24h).select('id'),
    supabaseServer.from('whatsapp_conversas').update({ user_id: user.id }).eq('telefone', alternativo).gte('atualizado_em', limite24h).select('id'),
  ])

  const conversaVinculada = (r1.data?.length ?? 0) > 0 || (r2.data?.length ?? 0) > 0

  return NextResponse.json({ ok: true, conversaVinculada })
}
