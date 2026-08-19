import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const senha = req.headers.get('x-admin-password')
  if (senha === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
}
