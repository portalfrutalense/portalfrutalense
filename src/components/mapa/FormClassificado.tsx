'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Classificado, TipoVeiculo } from '@/types'
import { salvarCamada } from './salvarCamada'
import { IconeVeiculo, ROTULO_VEICULO, TIPOS } from './CamadaClassificados'

/* ------------------------------------------------------------ helpers --- */

async function comprimirFoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', 0.6)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
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
  const [bairro, setBairro] = useState(editando?.bairro_label ?? '')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(
    editando ? { lat: editando.lat, lng: editando.lng, label: editando.bairro_label ?? '' } : null
  )
  const [locConfirmada, setLocConfirmada] = useState(!!editando)
  const [previews, setPreviews] = useState<string[]>(editando?.fotos ?? [])
  const uploadPromises = useRef<Promise<string | null>[]>([])
  const [uploadandoFotos, setUploadandoFotos] = useState(0)
  const [erroFoto, setErroFoto] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  function mostrarErro(msg: string) { setErro(msg); setTimeout(() => setErro(''), 5000) }
  const [sucesso, setSucesso] = useState(false)
  const [protocolo, setProtocolo] = useState('')

  function aoEscolherFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    if (!arquivos.length) return
    const espaco = MAX_FOTOS - previews.length
    const aceitos = arquivos.slice(0, Math.max(0, espaco))
    setErroFoto('')
    aceitos.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
      setUploadandoFotos(n => n + 1)
      const promise = comprimirFoto(file)
        .then(async (blob) => {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const { error } = await supabase.storage.from('classificados-fotos').upload(path, blob, { contentType: 'image/jpeg' })
          if (error) throw error
          return supabase.storage.from('classificados-fotos').getPublicUrl(path).data.publicUrl
        })
        .catch((err: any) => {
          setErroFoto(`Erro ao enviar foto: ${err?.message || 'falha no upload'}`)
          return null
        })
        .finally(() => setUploadandoFotos(n => n - 1))
      uploadPromises.current.push(promise)
    })
  }

  function removerFoto(i: number) {
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
    const jaPublicadas = editando?.fotos?.length ?? 0
    if (i >= jaPublicadas) {
      const idxNova = i - jaPublicadas
      uploadPromises.current.splice(idxNova, 1)
    }
  }

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)

  function avancar1() {
    setErro('')
    if (!marca.trim()) { mostrarErro('Informe a marca do veículo.'); return }
    if (!modelo.trim()) { mostrarErro('Informe o modelo do veículo.'); return }
    if (!ano.trim() || isNaN(Number(ano))) { mostrarErro('Informe o ano do veículo.'); return }
    if (!km.trim() || isNaN(Number(km))) { mostrarErro('Informe a quilometragem do veículo.'); return }
    if (!cor.trim()) { mostrarErro('Informe a cor do veículo.'); return }
    if (!preco.trim() || isNaN(Number(preco)) || Number(preco) <= 0) { mostrarErro('Informe o preço do veículo.'); return }
    setEtapa(2)
  }

  function avancar2() {
    setErro('')
    if (!descricao.trim() || descricao.trim().length < 10) { mostrarErro('Descreva melhor o veículo.'); return }
    if (!titulo.trim()) { mostrarErro('Dê um título ao anúncio.'); return }
    if (previews.length < 2) { mostrarErro('Adicione ao menos 2 fotos do veículo.'); return }
    setEtapa(3)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (!user) return
    if (!contato.trim()) { mostrarErro('Informe um contato.'); return }
    if (!coordenadas || !locConfirmada) { mostrarErro('Confirme a região no mapa.'); return }
    if (!editando && !turnstileToken) { mostrarErro('Aguarde a verificação de segurança concluir.'); return }
    setEnviando(true)

    const urls: string[] = previews.filter(p => !p.startsWith('data:'))
    if (uploadPromises.current.length > 0) {
      const resultados = await Promise.all(uploadPromises.current)
      for (const url of resultados) {
        if (url === null) { mostrarErro(erroFoto || 'Erro ao enviar uma das fotos.'); setEnviando(false); return }
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
      titulo: titulo.trim(),
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      ano: ano ? Number(ano) : null,
      km: km ? Number(km) : null,
      cor: cor.trim() || null,
      preco: preco ? Number(preco) : null,
      aceita_troca: aceitaTroca,
      descricao: descricao.trim(),
      lat: ponto.lat,
      lng: ponto.lng,
      bairro_label: bairro.trim() || coordenadas.label,
      fotos: urls,
      contato: contato.trim(),
    }

    const { erro, id, protocolo: prot } = await salvarCamada({ camada: 'classificados', editando, dados: registro, turnstileToken, supabase })

    setEnviando(false)
    if (erro) { mostrarErro(erro); return }
    if (editando) { aoSalvar(); aoFechar(); return }

    if (prot) setProtocolo(prot)
    setSucesso(true)
    aoSalvar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '440px', height: '580px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
            {editando ? 'Editar anúncio' : 'Anunciar um veículo'}
          </h2>
          <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Anúncio publicado!</p>
            {protocolo && <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Protocolo: <span style={{ color: '#4256c8' }}>{protocolo}</span></p>}
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>Ele já aparece no mapa com a localização aproximada.</p>
            <button onClick={aoFechar} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
          </div>
        ) : (
          <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* ---- ETAPA 1: Tipo + dados do veículo ---- */}
            {etapa === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div>
                  <label style={rotuloCampo}>Tipo de veículo *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {TIPOS.map(t => (
                      <button key={t} type="button" onClick={() => setTipoVeiculo(t)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                          padding: '9px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                          fontWeight: tipoVeiculo === t ? 600 : 500,
                          background: tipoVeiculo === t ? '#eff6ff' : 'white',
                          border: `1px solid ${tipoVeiculo === t ? '#4256c8' : '#e5e7eb'}`,
                          color: '#111827',
                        }}>
                        <IconeVeiculo tipo={t} size={16} cor={tipoVeiculo === t ? '#4256c8' : '#6b7280'} />
                        {ROTULO_VEICULO[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={rotuloCampo}>Marca *</label>
                    <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Volkswagen" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Modelo *</label>
                    <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Gol" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Ano *</label>
                    <input value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} placeholder="2018" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Quilometragem *</label>
                    <input value={km} onChange={e => setKm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="85000" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Cor *</label>
                    <input value={cor} onChange={e => setCor(e.target.value)} placeholder="Prata" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Preço (R$) *</label>
                    <input value={preco} onChange={e => setPreco(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="45000" style={campoEstilo} />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aceitaTroca} onChange={e => setAceitaTroca(e.target.checked)} style={{ accentColor: '#4256c8', width: '15px', height: '15px' }} />
                  Aceito troca
                </label>

                <div style={{ marginTop: 'auto', position: 'relative' }}>
                  {erro && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
                  <button type="button" onClick={avancar1} style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* ---- ETAPA 2: Descrição + Título + Fotos ---- */}
            {etapa === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div>
                  <label style={rotuloCampo}>Título do anúncio *</label>
                  <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Gol 1.0 completo" style={campoEstilo} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <label style={rotuloCampo}>Descrição *</label>
                  <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                    placeholder="Estado de conservação, itens, documentação, motivo da venda..."
                    style={{ ...campoEstilo, flex: 1, minHeight: '80px', resize: 'none' }} />
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
                      <label style={{ display: 'grid', placeItems: 'center', height: '64px', border: '2px dashed #e5e7eb', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', color: '#4256c8', fontWeight: 600 }}>
                        <input type="file" accept="image/*" multiple onChange={aoEscolherFotos} style={{ display: 'none' }} />
                        + Foto
                      </label>
                    )}
                  </div>
                  {erroFoto && <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>{erroFoto}</p>}
                </div>

                <div style={{ marginTop: 'auto', position: 'relative' }}>
                  {erro && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => { setErro(''); setEtapa(1) }}
                      style={{ flex: '0 0 auto', background: 'white', color: '#6b7280', fontWeight: 600, padding: '10px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '14px' }}>
                      ← Voltar
                    </button>
                    <button type="button" onClick={avancar2} style={{ flex: 1, backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                      Continuar →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---- ETAPA 3: Região + Bairro + Contato + Publicar ---- */}
            {etapa === 3 && (
              <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div>
                  <label style={rotuloCampo}>Região aproximada *</label>
                  <div>
                    <MiniMapaConfirmar
                      altura={230}
                      onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                      onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '5px 0 0', lineHeight: 1.45 }}>
                    O pin é publicado deslocado alguns metros — ninguém vê seu endereço exato.
                  </p>
                </div>

                <div>
                  <label style={rotuloCampo}>Contato *</label>
                  <input value={contato} onChange={e => setContato(e.target.value)} placeholder="WhatsApp ou telefone" style={campoEstilo} />
                </div>

                {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

                <div style={{ marginTop: 'auto', position: 'relative' }}>
                  {erro && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => { setErro(''); setEtapa(2) }}
                      style={{ flex: '0 0 auto', background: 'white', color: '#6b7280', fontWeight: 600, padding: '10px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '14px' }}>
                      ← Voltar
                    </button>
                    <button type="submit" disabled={enviando || uploadandoFotos > 0}
                      style={{ flex: 1, backgroundColor: (enviando || uploadandoFotos > 0) ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: (enviando || uploadandoFotos > 0) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                      {enviando ? 'Salvando...' : uploadandoFotos > 0 ? 'Aguardando fotos...' : editando ? 'Salvar alterações' : 'Publicar anúncio'}
                    </button>
                  </div>
                </div>
              </form>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
