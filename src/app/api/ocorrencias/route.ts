import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validarCPF } from '@/lib/cpf'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { morador_nome, morador_cpf, verificacao_metodo, descricao, lat, lng, categoria_id, foto_url, endereco_label } = body

    if (!morador_nome || !descricao || !lat || !lng || !categoria_id) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }
    if (verificacao_metodo !== 'google' && (!morador_cpf || !validarCPF(morador_cpf))) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('ocorrencias').insert({
      morador_nome: morador_nome.trim(),
      morador_cpf: morador_cpf || null,
      verificacao_metodo: verificacao_metodo || 'cpf',
      descricao: descricao.trim(),
      lat,
      lng,
      categoria_id,
      foto_url: foto_url || null,
      endereco_label: endereco_label || null,
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
