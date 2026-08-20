import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validarCPF } from '@/lib/cpf'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { morador_nome, morador_cpf, verificacao_metodo, entidade_id, mensagem } = body

    if (!morador_nome || !mensagem) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (mensagem.trim().length < 10) {
      return NextResponse.json({ error: 'Mensagem muito curta.' }, { status: 400 })
    }

    // CPF obrigatório apenas se não veio via Google
    let cpfDisplay: string | null = null
    if (verificacao_metodo !== 'google') {
      if (!morador_cpf || !validarCPF(morador_cpf)) {
        return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
      }
      cpfDisplay = morador_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }

    const { error } = await supabaseAdmin.from('denuncias').insert({
      morador_nome: morador_nome.trim(),
      morador_cpf: morador_cpf || null,
      morador_cpf_display: cpfDisplay,
      verificacao_metodo: verificacao_metodo || 'cpf',
      mensagem: mensagem.trim(),
      entidade_id: entidade_id || null,
      status: 'pendente',
    })

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
