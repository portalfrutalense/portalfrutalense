'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Imovel, TipoImovel, FinalidadeImovel } from '@/types'
import { salvarCamada } from './salvarCamada'
import { ROTULO_TIPO_IMOVEL, TIPOS_IMOVEL, ROTULO_FINALIDADE } from './CamadaImoveis'
import { mascaraTelefone, telefoneValido } from '@/lib/mascaraTelefone'
import { comprimirFoto } from '@/lib/comprimirFoto'

/* ------------------------------------------------------------ helpers --- */

async function comprimirFotoImovel(file: File): Promise<Blob> {
  return comprimirFoto(file, 800, 0.6)
}

const MAX_FOTOS = 4
const rotuloCampo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }
const campoEstilo: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }

// Mesmo botão quadrado usado no seletor de tipo de FormPet.tsx (BotaoOpcao) —
// duplicado aqui de propósito, mesmo padrão sem módulo de componentes
// compartilhado entre os formulários de camada (ver comentário equivalente
// nos ícones de Camada*.tsx).
function BotaoOpcao({ ativo, onClick, titulo }: { ativo: boolean; onClick: () => void; titulo: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '9px 11px', borderRadius: '7px', cursor: 'pointer', textAlign: 'center',
      background: ativo ? '#eff6ff' : 'white',
      border: `1px solid ${ativo ? '#4256c8' : '#e5e7eb'}`,
    }}>
      <span style={{ fontSize: '13px', fontWeight: ativo ? 700 : 600, color: '#111827' }}>{titulo}</span>
    </button>
  )
}

/* ============================================================ FormImovel = */

export function FormImovel({
  editando, aoFechar, aoSalvar,
}: {
  editando: Imovel | null
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const supabase = createClient()
  const { user, perfil } = useAuth()

  const [finalidade, setFinalidade] = useState<FinalidadeImovel>(editando?.finalidade ?? 'aluguel')
  const [tipo, setTipo] = useState<TipoImovel>(editando?.tipo ?? 'casa')
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [valor, setValor] = useState(editando?.valor?.toString() ?? '')
  const [contato, setContato] = useState(editando?.contato ?? '')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(
    editando ? { lat: editando.lat, lng: editando.lng, label: editando.endereco_label ?? '' } : null
  )
  const [locConfirmada, setLocConfirmada] = useState(!!editando)
  const [previews, setPreviews] = useState<string[]>(editando?.fotos ?? [])
  const uploadPromises = useRef<Promise<string | null>[]>([])
  const uploadTokens = useRef<{ cancelado: boolean; path: string | null }[]>([])
  const fotosOriginaisRemovidas = useRef<string[]>([])
  const [uploadandoFotos, setUploadandoFotos] = useState(0)
  const [erroFoto, setErroFoto] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  function mostrarErro(msg: string) { setErro(msg); setTimeout(() => setErro(''), 5000) }
  const [sucesso, setSucesso] = useState(false)
  const [protocolo, setProtocolo] = useState('')

  /** Apaga do Storage um upload que não vai mais ser usado — best-effort. */
  function limparFotoOrfa(path: string | null) {
    if (!path) return
    supabase.storage.from('imoveis-fotos').remove([path])
      .catch(err => console.error('[FormImovel] falha ao limpar foto órfã:', err))
  }

  function aoEscolherFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    if (!arquivos.length) return
    const espaco = MAX_FOTOS - previews.length
    const semGigantes = arquivos.filter(f => f.size <= 20 * 1024 * 1024)
    const aceitos = semGigantes.slice(0, Math.max(0, espaco))
    setErroFoto(semGigantes.length < arquivos.length ? 'Uma ou mais fotos muito grandes (máx. 20 MB) foram ignoradas.' : '')
    aceitos.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
      setUploadandoFotos(n => n + 1)
      const token = { cancelado: false, path: null as string | null }
      uploadTokens.current.push(token)
      const promise = comprimirFotoImovel(file)
        .then(async (blob) => {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const { error } = await supabase.storage.from('imoveis-fotos').upload(path, blob, { contentType: 'image/jpeg' })
          if (error) throw error
          if (token.cancelado) {
            limparFotoOrfa(path)
            return null
          }
          token.path = path
          return supabase.storage.from('imoveis-fotos').getPublicUrl(path).data.publicUrl
        })
        .catch((err: unknown) => { setErroFoto(`Erro ao enviar foto: ${err instanceof Error ? err.message : 'falha no upload'}`); return null })
        .finally(() => setUploadandoFotos(n => n - 1))
      uploadPromises.current.push(promise)
    })
  }

  function caminhoNoBucket(fotoUrl: string): string | null {
    try {
      const url = new URL(fotoUrl)
      const parts = url.pathname.split('/imoveis-fotos/')
      return parts[1] || null
    } catch {
      return null
    }
  }

  function removerFoto(i: number) {
    const jaPublicadas = editando?.fotos?.length ?? 0
    if (i < jaPublicadas) {
      fotosOriginaisRemovidas.current.push(previews[i])
    }
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
    if (i >= jaPublicadas) {
      const idx = i - jaPublicadas
      const token = uploadTokens.current[idx]
      if (token) {
        token.cancelado = true
        limparFotoOrfa(token.path)
      }
      uploadPromises.current.splice(idx, 1)
      uploadTokens.current.splice(idx, 1)
    }
  }

  function limparTodosUploadsPendentes() {
    for (const token of uploadTokens.current) {
      token.cancelado = true
      limparFotoOrfa(token.path)
    }
    uploadTokens.current = []
    uploadPromises.current = []
  }

  useEffect(() => {
    return () => limparTodosUploadsPendentes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enviar() {
    if (!descricao.trim() || descricao.trim().length < 10) { mostrarErro('Descreva melhor o imóvel.'); return }
    if (!valor.trim() || isNaN(Number(valor)) || Number(valor) <= 0) { mostrarErro('Informe o valor do imóvel.'); return }
    if (previews.length < 2) { mostrarErro('Adicione ao menos 2 fotos do imóvel.'); return }
    if (!contato.trim()) { mostrarErro('Informe um contato.'); return }
    if (!telefoneValido(contato)) { mostrarErro('Informe um WhatsApp válido: (XX) 9XXXX-XXXX.'); return }
    if (!coordenadas || !locConfirmada) { mostrarErro('Confirme o endereço no mapa.'); return }
    if (!editando && !turnstileToken) { mostrarErro('Aguarde a verificação de segurança concluir.'); return }
    if (!user) return
    setErro('')
    setEnviando(true)

    const urls: string[] = previews.filter(p => !p.startsWith('data:'))
    if (uploadPromises.current.length > 0) {
      const resultados = await Promise.all(uploadPromises.current)
      for (const url of resultados) {
        if (url === null) {
          limparTodosUploadsPendentes()
          mostrarErro(erroFoto || 'Erro ao enviar uma das fotos.')
          setEnviando(false)
          return
        }
        urls.push(url)
      }
    }
    if (urls.length < 2) { mostrarErro('Adicione ao menos 2 fotos do imóvel.'); setEnviando(false); return }

    // Localização EXATA — decisão confirmada com o usuário (diferente de
    // Classificados, que aproxima por privacidade do vendedor).
    const registro = {
      user_id: user.id,
      autor_nome: perfil?.nome || user.email || 'Anônimo',
      finalidade, tipo,
      descricao: descricao.trim(),
      valor: valor ? Number(valor) : null,
      lat: coordenadas.lat, lng: coordenadas.lng,
      endereco_label: coordenadas.label,
      fotos: urls, contato: contato.trim(),
    }

    const { erro, protocolo: prot } = await salvarCamada({ camada: 'imoveis', editando, dados: registro, turnstileToken, supabase })

    setEnviando(false)
    if (erro) {
      limparTodosUploadsPendentes()
      mostrarErro(erro)
      return
    }
    uploadTokens.current = []
    uploadPromises.current = []
    for (const fotoUrl of fotosOriginaisRemovidas.current) {
      const caminho = caminhoNoBucket(fotoUrl)
      if (caminho) limparFotoOrfa(caminho)
    }
    fotosOriginaisRemovidas.current = []
    if (editando) { aoSalvar(); aoFechar(); return }
    if (prot) setProtocolo(prot)
    setSucesso(true)
    aoSalvar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '440px', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {!sucesso && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
              {editando ? 'Editar imóvel' : 'Anunciar um imóvel'}
            </h2>
            <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
          </div>
        )}

        {sucesso ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ padding: '8px 20px', borderBottom: '1px solid #e5e7eb', width: '100%', boxSizing: 'border-box' }}>
              <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Anúncio enviado!</h2>
            </div>
            <div style={{ padding: '24px 24px 28px' }}>
              {protocolo && <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>Protocolo: <span style={{ color: '#4256c8' }}>{protocolo}</span></p>}
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>Seu anúncio está em análise. Se aprovado pelo nosso Agente IA, aparecerá no mapa em instantes.</p>
              <button onClick={aoFechar} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
            </div>
          </div>
        ) : (
          <>
            <form id="form-imovel" onSubmit={(e) => { e.preventDefault(); enviar() }}
              style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>

              <div>
                <label style={rotuloCampo}>Finalidade *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <BotaoOpcao ativo={finalidade === 'aluguel'} onClick={() => setFinalidade('aluguel')} titulo={ROTULO_FINALIDADE.aluguel} />
                  <BotaoOpcao ativo={finalidade === 'venda'} onClick={() => setFinalidade('venda')} titulo={ROTULO_FINALIDADE.venda} />
                </div>
              </div>

              <div>
                <label style={rotuloCampo}>Tipo *</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as TipoImovel)}
                  style={{ ...campoEstilo, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                  {TIPOS_IMOVEL.map(t => (
                    <option key={t} value={t}>{ROTULO_TIPO_IMOVEL[t]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={rotuloCampo}>Descrição *</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Cômodos, estado de conservação, diferenciais..."
                  style={{ ...campoEstilo, minHeight: '80px', resize: 'none' }} />
              </div>

              <div>
                <label style={rotuloCampo}>Valor (R$) *{finalidade === 'aluguel' ? ' — mensal' : ''}</label>
                <input value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1500" style={campoEstilo} />
              </div>

              <div>
                <label style={rotuloCampo}>Fotos * <span style={{ fontWeight: 400 }}>(mín. 2, até {MAX_FOTOS})</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {previews.map((p, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: '7px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '64px', objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => removerFoto(i)}
                        style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px' }}>×</button>
                      {p.startsWith('data:') && uploadandoFotos > 0 && (
                        <div style={{ position: 'absolute', bottom: '3px', left: '3px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', borderRadius: '3px', padding: '1px 4px' }}>⏫</div>
                      )}
                    </div>
                  ))}
                  {previews.length < MAX_FOTOS && (
                    <>
                      <label style={{ display: 'grid', placeItems: 'center', gap: '2px', height: '64px', border: '2px dashed #e5e7eb', borderRadius: '7px', cursor: 'pointer', fontSize: '10px', color: '#4256c8', fontWeight: 600 }}>
                        <input type="file" accept="image/*" capture="environment" onChange={aoEscolherFotos} style={{ display: 'none' }} />
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                        Câmera
                      </label>
                      <label style={{ display: 'grid', placeItems: 'center', gap: '2px', height: '64px', border: '2px dashed #e5e7eb', borderRadius: '7px', cursor: 'pointer', fontSize: '10px', color: '#6b7280', fontWeight: 600 }}>
                        <input type="file" accept="image/*" multiple onChange={aoEscolherFotos} style={{ display: 'none' }} />
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                        Galeria
                      </label>
                    </>
                  )}
                </div>
                {erroFoto && <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>{erroFoto}</p>}
              </div>

              <div>
                <label style={rotuloCampo}>Endereço *</label>
                <MiniMapaConfirmar
                  enderecoInicial={editando?.endereco_label ?? ''}
                  altura={240}
                  onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                  onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                />
              </div>

              <div>
                <label style={rotuloCampo}>Contato *</label>
                <input value={contato} onChange={e => setContato(mascaraTelefone(e.target.value))} placeholder="(XX) 9XXXX-XXXX" inputMode="numeric" style={campoEstilo} />
              </div>

              {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}
            </form>

            <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 20px', flexShrink: 0 }}>
              {erro && <div style={{ marginBottom: '8px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
              <button type="submit" form="form-imovel" disabled={enviando || uploadandoFotos > 0}
                style={{ width: '100%', backgroundColor: (enviando || uploadandoFotos > 0) ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: (enviando || uploadandoFotos > 0) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                {enviando ? 'Salvando...' : uploadandoFotos > 0 ? 'Aguardando fotos...' : editando ? 'Salvar alterações' : 'Publicar anúncio'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
