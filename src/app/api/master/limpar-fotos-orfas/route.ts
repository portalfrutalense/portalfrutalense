import { NextRequest, NextResponse } from 'next/server'
import { getMasterUser } from '@/lib/auth-api'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/master/limpar-fotos-orfas
 *
 * Vários formulários (Classificado, Pet, Imóvel) sobem a foto pro Storage
 * assim que o usuário escolhe o arquivo — antes de enviar o formulário —
 * pra já mostrar a prévia rápido. Se o usuário fecha a aba, dá refresh ou o
 * navegador cai no meio do preenchimento, o React nunca roda a limpeza que
 * existe pra quando o modal é fechado normalmente (não há hook confiável de
 * "fechou a aba" pra um delete assíncrono) — a foto fica órfã no bucket pra
 * sempre, sem nenhum registro do banco apontando pra ela.
 *
 * Botão manual no painel master: varre cada bucket, compara com as fotos
 * realmente referenciadas nas tabelas (de TODOS os status — pendente,
 * rejeitada, oculta etc., não só as visíveis no mapa) e apaga o que sobrar.
 * Só considera órfã um arquivo com mais de 2h desde o upload — evita apagar
 * uma foto que acabou de subir e cujo registro ainda não foi inserido
 * (a corrida entre o upload e o insert do formulário).
 */
export const maxDuration = 60

const GRACE_MS = 2 * 60 * 60 * 1000 // 2h

type ColunaFoto = { table: string; column: string; isArray: boolean }

const BUCKETS: { bucket: string; colunas: ColunaFoto[] }[] = [
  { bucket: 'classificados-fotos', colunas: [{ table: 'classificados', column: 'fotos', isArray: true }] },
  { bucket: 'pets-fotos', colunas: [{ table: 'pets', column: 'foto_url', isArray: false }] },
  { bucket: 'imoveis-fotos', colunas: [{ table: 'imoveis', column: 'fotos', isArray: true }] },
  { bucket: 'demandas-fotos', colunas: [{ table: 'demandas', column: 'foto_url', isArray: false }] },
]

/** Extrai o caminho do arquivo dentro do bucket a partir da URL pública completa. */
function caminhoNoBucket(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url)
    const partes = parsed.pathname.split(`/${bucket}/`)
    return partes[1] || null
  } catch {
    return null
  }
}

async function listarTodosArquivos(bucket: string) {
  const arquivos: { name: string; created_at: string | null }[] = []
  let offset = 0
  const LOTE = 1000
  while (true) {
    const { data, error } = await supabaseServer.storage.from(bucket).list(undefined, { limit: LOTE, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const f of data) {
      // Entradas sem id são "pastas" (placeholder do Supabase) — ignora.
      if (f.id) arquivos.push({ name: f.name, created_at: f.created_at ?? null })
    }
    if (data.length < LOTE) break
    offset += LOTE
  }
  return arquivos
}

export async function POST(req: NextRequest) {
  const master = await getMasterUser(req)
  if (!master) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const resultado: Record<string, { encontrados: number; apagados: number }> = {}
  const agora = Date.now()

  for (const { bucket, colunas } of BUCKETS) {
    try {
      const referenciados = new Set<string>()
      for (const { table, column, isArray } of colunas) {
        const { data, error } = await supabaseServer.from(table).select(column)
        if (error) throw error
        for (const row of (data as Record<string, unknown>[]) || []) {
          const valor = row[column]
          const urls = isArray ? (Array.isArray(valor) ? valor as string[] : []) : (valor ? [valor as string] : [])
          for (const url of urls) {
            const caminho = caminhoNoBucket(url, bucket)
            if (caminho) referenciados.add(caminho)
          }
        }
      }

      const arquivos = await listarTodosArquivos(bucket)
      const orfaos = arquivos.filter(f => {
        if (referenciados.has(f.name)) return false
        if (!f.created_at) return true // sem data, assume seguro apagar
        return agora - new Date(f.created_at).getTime() > GRACE_MS
      })

      let apagados = 0
      const TAMANHO_LOTE = 100
      for (let i = 0; i < orfaos.length; i += TAMANHO_LOTE) {
        const lote = orfaos.slice(i, i + TAMANHO_LOTE).map(f => f.name)
        const { error: delError } = await supabaseServer.storage.from(bucket).remove(lote)
        if (!delError) apagados += lote.length
      }

      resultado[bucket] = { encontrados: orfaos.length, apagados }
    } catch (e) {
      console.error(`[limpar-fotos-orfas] falha no bucket ${bucket}:`, e)
      resultado[bucket] = { encontrados: -1, apagados: 0 }
    }
  }

  return NextResponse.json({ ok: true, resultado })
}
