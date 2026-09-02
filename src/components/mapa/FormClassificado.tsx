'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Classificado, TipoVeiculo } from '@/types'
import { salvarCamada } from './salvarCamada'
import { ROTULO_VEICULO, TIPOS } from './CamadaClassificados'
import { mascaraTelefone, telefoneValido } from '@/lib/mascaraTelefone'
import { comprimirFoto } from '@/lib/comprimirFoto'

/* ------------------------------------------------------------ helpers --- */

async function comprimirFotoClassificado(file: File): Promise<Blob> {
  return comprimirFoto(file, 800, 0.6)
}

function aproximarCoordenada(lat: number, lng: number) {
  const raio = 150 + Math.random() * 150
  const angulo = Math.random() * 2 * Math.PI
  const dLat = (raio * Math.cos(angulo)) / 111_320
  const dLng = (raio * Math.sin(angulo)) / (111_320 * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

const MAX_FOTOS = 4
const rotuloCampo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }
const campoEstilo: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }

/* ======================================================= FormClassificado = */

export function FormClassificado({
  editando, aoFechar, aoSalvar,
}: {
  editando: Classificado | null
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const supabase = createClient()
  const { user, perfil } = useAuth()

  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo>(editando?.tipo_veiculo ?? 'carro')
  const [titulo, setTitulo] = useState(editando?.titulo ?? '')
  const [marca, setMarca] = useState(editando?.marca ?? '')
  const [modelo, setModelo] = useState(editando?.modelo ?? '')
  const [ano, setAno] = useState(editando?.ano?.toString() ?? '')
  const [km, setKm] = useState(editando?.km?.toString() ?? '')
  const [cor, setCor] = useState(editando?.cor ?? '')
  const [preco, setPreco] = useState(editando?.preco?.toString() ?? '')
  const [aceitaTroca, setAceitaTroca] = useState(editando?.aceita_troca ?? false)
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [contato, setContato] = useState(editando?.contato ?? '')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(
    editando ? { lat: editando.lat, lng: editando.lng, label: editando.bairro_label ?? '' } : null
  )
  const [locConfirmada, setLocConfirmada] = useState(!!editando)
  const [previews, setPreviews] = useState<string[]>(editando?.fotos ?? [])
  const uploadPromises = useRef<Promise<string | null>[]>([])
  // Um token por upload, sempre no mesmo índice do array acima — permite
  // cancelar/limpar um upload específico mesmo com vários rodando ao mesmo
  // tempo. Sem isso: remover uma foto antes do upload terminar, ou o envio
  // final falhar depois de várias fotos já terem subido, deixava cada
  // arquivo órfão no Storage pra sempre (até 4 por vez, o máximo permitido).
  const uploadTokens = useRef<{ cancelado: boolean; path: string | null }[]>([])
  // BUG CORRIGIDO: ao editar um anúncio e remover uma foto JÁ PUBLICADA
  // (não desta sessão), ela só saía do array local — o arquivo nunca era
  // apagado do Storage, ficava órfão pra sempre. Guarda as URLs removidas
  // aqui e só limpa do Storage DEPOIS de salvar com sucesso — nunca antes,
  // porque se o usuário fechar sem salvar, a demanda no banco ainda
  // referencia essas fotos.
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
    supabase.storage.from('classificados-fotos').remove([path])
      .catch(err => console.error('[FormClassificado] falha ao limpar foto órfã:', err))
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
      const promise = comprimirFotoClassificado(file)
        .then(async (blob) => {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const { error } = await supabase.storage.from('classificados-fotos').upload(path, blob, { contentType: 'image/jpeg' })
          if (error) throw error
          if (token.cancelado) {
            // Foto removida enquanto esse upload ainda rodava — só terminou
            // agora, mas ninguém vai usar o resultado.
            limparFotoOrfa(path)
            return null
          }
          token.path = path
          return supabase.storage.from('classificados-fotos').getPublicUrl(path).data.publicUrl
        })
        .catch((err: unknown) => { setErroFoto(`Erro ao enviar foto: ${err instanceof Error ? err.message : 'falha no upload'}`); return null })
        .finally(() => setUploadandoFotos(n => n - 1))
      uploadPromises.current.push(promise)
    })
  }

  function caminhoNoBucket(fotoUrl: string): string | null {
    try {
      const url = new URL(fotoUrl)
      const parts = url.pathname.split('/classificados-fotos/')
      return parts[1] || null
    } catch {
      return null
    }
  }

  function removerFoto(i: number) {
    const jaPublicadas = editando?.fotos?.length ?? 0
    if (i < jaPublicadas) {
      // Foto já publicada (não desta sessão) — guarda a URL pra limpar do
      // Storage só depois de salvar com sucesso (ver fotosOriginaisRemovidas).
      fotosOriginaisRemovidas.current.push(previews[i])
    }
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
    if (i >= jaPublicadas) {
      const idx = i - jaPublicadas
      const token = uploadTokens.current[idx]
      if (token) {
        token.cancelado = true
        limparFotoOrfa(token.path) // se o upload já tinha terminado, apaga agora; senão, ele se limpa sozinho ao completar
      }
      uploadPromises.current.splice(idx, 1)
      uploadTokens.current.splice(idx, 1)
    }
  }

  /** Limpa do Storage todo upload desta sessão que já tinha terminado, e
   * esvazia os rastreadores — usado quando o envio não vai mais prosseguir. */
  function limparTodosUploadsPendentes() {
    for (const token of uploadTokens.current) {
      token.cancelado = true // uploads ainda em andamento se limpam sozinhos ao completar
      limparFotoOrfa(token.path)
    }
    uploadTokens.current = []
    uploadPromises.current = []
  }

  // Se o usuário fecha o modal (botão "×", sem passar por enviar()) com fotos
  // ainda subindo ou já subidas mas não usadas, elas ficavam órfãs no Storage
  // pra sempre — nada interceptava aoFechar antes disso.
  useEffect(() => {
    return () => limparTodosUploadsPendentes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enviar() {
    // Valida todos os campos de uma vez
    if (!marca.trim()) { mostrarErro('Informe a marca do veículo.'); return }
    if (!modelo.trim()) { mostrarErro('Informe o modelo do veículo.'); return }
    if (!ano.trim() || isNaN(Number(ano))) { mostrarErro('Informe o ano do veículo.'); return }
    if (!km.trim() || isNaN(Number(km))) { mostrarErro('Informe a quilometragem do veículo.'); return }
    if (!cor.trim()) { mostrarErro('Informe a cor do veículo.'); return }
    if (!preco.trim() || isNaN(Number(preco)) || Number(preco) <= 0) { mostrarErro('Informe o preço do veículo.'); return }
    if (!titulo.trim()) { mostrarErro('Dê um título ao anúncio.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { mostrarErro('Descreva melhor o veículo.'); return }
    if (previews.length < 2) { mostrarErro('Adicione ao menos 2 fotos do veículo.'); return }
    if (!contato.trim()) { mostrarErro('Informe um contato.'); return }
    if (!telefoneValido(contato)) { mostrarErro('Informe um WhatsApp válido: (XX) 9XXXX-XXXX.'); return }
    if (!coordenadas || !locConfirmada) { mostrarErro('Confirme a região no mapa.'); return }
    if (!editando && !turnstileToken) { mostrarErro('Aguarde a verificação de segurança concluir.'); return }
    if (!user) return
    setErro('')
    setEnviando(true)

    const urls: string[] = previews.filter(p => !p.startsWith('data:'))
    if (uploadPromises.current.length > 0) {
      const resultados = await Promise.all(uploadPromises.current)
      for (const url of resultados) {
        if (url === null) {
          // Uma das fotos do lote falhou — as outras que deram certo não
          // vão ser usadas, então limpa todo mundo do Storage.
          limparTodosUploadsPendentes()
          mostrarErro(erroFoto || 'Erro ao enviar uma das fotos.')
          setEnviando(false)
          return
        }
        urls.push(url)
      }
    }
    if (urls.length < 2) { mostrarErro('Adicione ao menos 2 fotos do veículo.'); setEnviando(false); return }

    const ponto = editando && coordenadas.lat === editando.lat && coordenadas.lng === editando.lng
      ? { lat: editando.lat, lng: editando.lng }
      : aproximarCoordenada(coordenadas.lat, coordenadas.lng)

    const registro = {
      user_id: user.id,
      autor_nome: perfil?.nome || user.email || 'Anônimo',
      tipo_veiculo: tipoVeiculo,
      titulo: titulo.trim(), marca: marca.trim() || null, modelo: modelo.trim() || null,
      ano: ano ? Number(ano) : null, km: km ? Number(km) : null,
      cor: cor.trim() || null, preco: preco ? Number(preco) : null,
      aceita_troca: aceitaTroca, descricao: descricao.trim(),
      lat: ponto.lat, lng: ponto.lng,
      bairro_label: coordenadas.label,
      fotos: urls, contato: contato.trim(),
    }

    const { erro, protocolo: prot } = await salvarCamada({ camada: 'classificados', editando, dados: registro, turnstileToken, supabase })

    setEnviando(false)
    if (erro) {
      // As fotos já tinham sido enviadas com sucesso antes desse passo
      // falhar — sem isso, ficavam órfãs no Storage pra sempre.
      limparTodosUploadsPendentes()
      mostrarErro(erro)
      return
    }
    uploadTokens.current = []
    uploadPromises.current = []
    // Só agora, com o save confirmado (a demanda no banco não referencia
    // mais essas fotos), é seguro apagar do Storage.
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
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '440px', height: sucesso ? 'auto' : 'auto', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Cabeçalho */}
        {!sucesso && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
              {editando ? 'Editar anúncio' : 'Anunciar um veículo'}
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
            {/* Conteúdo com scroll */}
            <form id="form-classificado" onSubmit={(e) => { e.preventDefault(); enviar() }}
              style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>

              <div>
                <label style={rotuloCampo}>Tipo de veículo *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {TIPOS.map(t => (
                    <button key={t} type="button" onClick={() => setTipoVeiculo(t)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: tipoVeiculo === t ? 600 : 500, background: tipoVeiculo === t ? '#eff6ff' : 'white', border: `1px solid ${tipoVeiculo === t ? '#4256c8' : '#e5e7eb'}`, color: '#111827' }}>
                      {ROTULO_VEICULO[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={rotuloCampo}>Marca *</label><input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Volkswagen" style={campoEstilo} /></div>
                <div><label style={rotuloCampo}>Modelo *</label><input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Gol" style={campoEstilo} /></div>
                <div><label style={rotuloCampo}>Ano *</label><input value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} placeholder="2018" style={campoEstilo} /></div>
                <div><label style={rotuloCampo}>Quilometragem *</label><input value={km} onChange={e => setKm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="85000" style={campoEstilo} /></div>
                <div><label style={rotuloCampo}>Cor *</label><input value={cor} onChange={e => setCor(e.target.value)} placeholder="Prata" style={campoEstilo} /></div>
                <div><label style={rotuloCampo}>Preço (R$) *</label><input value={preco} onChange={e => setPreco(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="45000" style={campoEstilo} /></div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', cursor: 'pointer' }}>
                <input type="checkbox" checked={aceitaTroca} onChange={e => setAceitaTroca(e.target.checked)} style={{ accentColor: '#4256c8', width: '15px', height: '15px' }} />
                Aceito troca
              </label>

              <div><label style={rotuloCampo}>Título do anúncio *</label><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Gol 1.0 completo" style={campoEstilo} /></div>

              <div>
                <label style={rotuloCampo}>Descrição *</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Estado de conservação, itens, documentação, motivo da venda..."
                  style={{ ...campoEstilo, minHeight: '80px', resize: 'none' }} />
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
                      {/* Com capture o celular abre a camera; sem capture abre a galeria */}
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
                <label style={rotuloCampo}>Região aproximada *</label>
                <MiniMapaConfirmar
                  altura={240}
                  onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                  onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                />
                <p style={{ fontSize: '11px', color: '#6b7280', margin: '5px 0 0', lineHeight: 1.45 }}>O pin é publicado deslocado alguns metros — ninguém vê seu endereço exato.</p>
              </div>

              <div>
                <label style={rotuloCampo}>Contato *</label>
                <input value={contato} onChange={e => setContato(mascaraTelefone(e.target.value))} placeholder="(XX) 9XXXX-XXXX" inputMode="numeric" style={campoEstilo} />
              </div>

              {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}
            </form>

            {/* Rodapé fixo */}
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 20px', flexShrink: 0 }}>
              {erro && <div style={{ marginBottom: '8px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
              <button type="submit" form="form-classificado" disabled={enviando || uploadandoFotos > 0}
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
