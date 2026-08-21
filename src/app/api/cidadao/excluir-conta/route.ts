import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token === 'undefined' || token === 'null') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // Verificar JWT
  const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
  if (!authRes.ok) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const user = await authRes.json()
  if (!user?.id) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  // 1. Buscar demandas do usuário para deletar fotos
  const { data: demandas } = await supabaseServer
    .from('demandas')
    .select('id, foto_url')
    .eq('user_id', user.id)

  // 2. Deletar fotos do storage
  if (demandas && demandas.length > 0) {
    const caminhos = demandas
      .filter((d: any) => d.foto_url)
      .map((d: any) => {
        // foto_url é a URL pública completa, extrai o path após o bucket
        const url = new URL(d.foto_url)
        const parts = url.pathname.split('/demandas-fotos/')
        return parts[1] || null
      })
      .filter(Boolean) as string[]

    if (caminhos.length > 0) {
      await supabaseServer.storage.from('demandas-fotos').remove(caminhos)
    }
  }

  // 3. Deletar demandas
  await supabaseServer.from('demandas').delete().eq('user_id', user.id)

  // 4. Deletar perfil
  await supabaseServer.from('perfis').delete().eq('id', user.id)

  // 5. Deletar conta auth
  const { error } = await supabaseServer.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
