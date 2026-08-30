'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { CamadaConfig } from '@/types'

const GRUPOS: { camada: string; titulo: string; descricao: string }[] = [
  { camada: 'pets', titulo: 'Pets', descricao: 'Cor do pin de cada situação. Perdidos, Abandonados, Adoção e Reencontrados são registros independentes.' },
  { camada: 'classificados', titulo: 'Classificados', descricao: 'Cor e ícone do pin por tipo de veículo. O ícone enviado substitui a silhueta padrão.' },
  { camada: 'empregos', titulo: 'Empregos', descricao: 'Cor do pin das vagas. A logo da empresa, quando houver, ocupa o miolo do pin.' },
]

export default function MasterCamadas({ camada: camadaFiltro }: { camada?: string } = {}) {
  const client = createClient()
  const [itens, setItens] = useState<CamadaConfig[]>([])
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function carregar() {
    client.from('camadas_config').select('*').order('camada').order('ordem')
      .then(({ data }) => setItens((data as CamadaConfig[]) || []))
  }

  function alterarLocal<K extends keyof CamadaConfig>(chave: string, campo: K, valor: CamadaConfig[K]) {
    setItens(prev => prev.map(i => i.chave === chave ? { ...i, [campo]: valor } : i))
  }

  async function salvar(item: CamadaConfig) {
    setSalvando(item.chave); setErro('')
    const { error } = await client
      .from('camadas_config')
      .update({ rotulo: item.rotulo, cor: item.cor, ativo: item.ativo })
      .eq('chave', item.chave)
    setSalvando(null)
    if (error) setErro(`Não foi possível salvar "${item.rotulo}": ${error.message}`)
  }

  /** Extrai o caminho do arquivo dentro do bucket a partir da URL pública completa. */
  function caminhoNoBucket(fotoUrl: string, bucket: string): string | null {
    try {
      const url = new URL(fotoUrl)
      const parts = url.pathname.split(`/${bucket}/`)
      return parts[1] || null
    } catch {
      return null
    }
  }

  async function enviarIcone(item: CamadaConfig, file: File) {
    setSalvando(item.chave); setErro('')
    const iconeAnterior = item.icone_url
    try {
      const path = `camadas/${item.chave}-${Date.now()}.${file.name.split('.').pop()}`
      const { error: upErro } = await client.storage.from('categoria-icones').upload(path, file, { upsert: true })
      if (upErro) throw upErro
      const url = client.storage.from('categoria-icones').getPublicUrl(path).data.publicUrl
      const { error } = await client.from('camadas_config').update({ icone_url: url }).eq('chave', item.chave)
      if (error) throw error
      alterarLocal(item.chave, 'icone_url', url)
      // Best-effort: apaga o ícone antigo agora que o novo já está salvo —
      // sem isso cada troca deixava um arquivo órfão no bucket pra sempre.
      const caminhoAntigo = iconeAnterior && caminhoNoBucket(iconeAnterior, 'categoria-icones')
      if (caminhoAntigo) client.storage.from('categoria-icones').remove([caminhoAntigo]).catch(() => {})
    } catch (e: any) {
      setErro(`Falha ao enviar o ícone: ${e?.message || 'erro no upload'}`)
    } finally {
      setSalvando(null)
    }
  }

  async function removerIcone(item: CamadaConfig) {
    setSalvando(item.chave)
    await client.from('camadas_config').update({ icone_url: null }).eq('chave', item.chave)
    const caminho = item.icone_url && caminhoNoBucket(item.icone_url, 'categoria-icones')
    if (caminho) client.storage.from('categoria-icones').remove([caminho]).catch(() => {})
    alterarLocal(item.chave, 'icone_url', undefined)
    setSalvando(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
          {erro}
        </div>
      )}

      {GRUPOS.filter(g => !camadaFiltro || g.camada === camadaFiltro).map(({ camada, titulo, descricao }) => {
        const doGrupo = itens.filter(i => i.camada === camada)
        if (doGrupo.length === 0) return null

        return (
          <div key={camada} style={{ background: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <h2 style={{ fontWeight: 600, color: '#111827', fontSize: '15px', margin: '0 0 4px' }}>{titulo}</h2>
            <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>{descricao}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {doGrupo.map(item => (
                <div key={item.chave} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                  border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px',
                  opacity: item.ativo ? 1 : 0.55,
                }}>
                  {/* Prévia do pin como ele aparece no mapa */}
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: item.cor, border: '2px solid white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    display: 'grid', placeItems: 'center', overflow: 'hidden',
                  }}>
                    {item.icone_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.icone_url} alt="" style={{ width: '19px', height: '19px', objectFit: 'contain' }} />
                    )}
                  </span>

                  <input
                    value={item.rotulo}
                    onChange={(e) => alterarLocal(item.chave, 'rotulo', e.target.value)}
                    style={{ flex: 1, minWidth: '140px', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 11px', fontSize: '13.5px', outline: 'none' }}
                  />

                  <input
                    type="color"
                    value={item.cor}
                    onChange={(e) => alterarLocal(item.chave, 'cor', e.target.value)}
                    title="Cor do pin"
                    style={{ width: '42px', height: '34px', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '2px', cursor: 'pointer', background: 'white' }}
                  />

                  {camada === 'classificados' && (
                    <>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#4256c8', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarIcone(item, f) }} />
                        {item.icone_url ? 'Trocar ícone' : 'Enviar ícone'}
                      </label>
                      {item.icone_url && (
                        <button onClick={() => removerIcone(item)}
                          style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Remover
                        </button>
                      )}
                    </>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#111827', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={item.ativo}
                      onChange={(e) => alterarLocal(item.chave, 'ativo', e.target.checked)}
                      style={{ accentColor: '#4256c8', width: '15px', height: '15px' }} />
                    Ativo
                  </label>

                  <button onClick={() => salvar(item)} disabled={salvando === item.chave}
                    style={{
                      background: salvando === item.chave ? '#9ca3af' : '#4256c8', color: 'white',
                      border: 'none', borderRadius: '7px', padding: '8px 16px',
                      fontSize: '12.5px', fontWeight: 600,
                      cursor: salvando === item.chave ? 'wait' : 'pointer',
                    }}>
                    {salvando === item.chave ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
