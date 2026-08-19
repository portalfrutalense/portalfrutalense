import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validarCPF } from '@/lib/cpf'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { morador_nome, morador_cpf, entidade_id, mensagem } = body

    // Validações básicas
    if (!morador_nome || !morador_cpf || !mensagem) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (!validarCPF(morador_cpf)) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }
    if (mensagem.trim().length < 20) {
      return NextResponse.json({ error: 'Mensagem muito curta.' }, { status: 400 })
    }

    // Formatar CPF para display
    const cpfDisplay = morador_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

    const { error } = await supabaseAdmin.from('denuncias').insert({
      morador_nome: morador_nome.trim(),
      morador_cpf: morador_cpf,
      morador_cpf_display: cpfDisplay,
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
