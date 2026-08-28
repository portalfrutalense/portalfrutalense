'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Pet, TipoPet, EspeciePet, PortePet } from '@/types'
import { salvarCamada } from './salvarCamada'
import { IconeEspecie, rotuloEspecie, rotuloPorte } from './CamadaPets'
import { mascaraTelefone, telefoneValido } from '@/lib/mascaraTelefone'

/* ------------------------------------------------------------ helpers --- */

async function comprimirFoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 600
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', 0.25)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
}

const rotuloCampo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }
const campoEstilo: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }

function BotaoOpcao({ ativo, cor, onClick, titulo, desc }: { ativo: boolean; cor: string; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
      padding: '9px 11px', borderRadius: '7px', cursor: 'pointer', textAlign: 'left',
      background: ativo ? '#eff6ff' : 'white',
      border: `1px solid ${ativo ? cor : '#e5e7eb'}`,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: ativo ? 700 : 600, color: '#111827' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: cor }} />
        {titulo}
      </span>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>{desc}</span>
    </button>
  )
}

/* ============================================================= FormPet = */

export function FormPet({
  editando, aoFechar, aoSalvar,
}: {
  editando: Pet | null
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const supabase = createClient()
  const { user, perfil } = useAuth()

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)

  const [tipo, setTipo] = useState<TipoPet>(editando?.tipo ?? 'perdido')
  const [especie, setEspecie] = useState<EspeciePet>(editando?.especie ?? 'cachorro')
  const [nomePet, setNomePet] = useState(editando?.nome_pet ?? '')
  const [raca, setRaca] = useState(editando?.raca ?? '')
  const [cor, setCor] = useState(editando?.cor ?? '')
  const [porte, setPorte] = useState<PortePet | ''>(editando?.porte ?? '')
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [contato, setContato] = useState(editando?.contato ?? '')
  const [dataHora, setDataHora] = useState('')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(
    editando ? { lat: editando.lat, lng: editando.lng, label: editando.endereco_label ?? '' } : null
  )
  const [locConfirmada, setLocConfirmada] = useState(!!editando)
  const [fotoPreview, setFotoPreview] = useState<string | null>(editando?.foto_url ?? null)
  const uploadFotoPromise = useRef<Promise<string | null> | null>(null)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  function mostrarErro(msg: string) { setErro(msg); setTimeout(() => setErro(''), 5000) }
  const [sucesso, setSucesso] = useState(false)
  const [protocolo, setProtocolo] = useState('')

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErroFoto('')
    const reader = new FileReader()
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploadandoFoto(true)
    uploadFotoPromise.current = comprimirFoto(file)
      .then(async (blob) => {
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage.from('pets-fotos').upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        return supabase.storage.from('pets-fotos').getPublicUrl(path).data.publicUrl
      })
      .catch((err: any) => {
        setErroFoto(`Erro ao enviar foto: ${err?.message || 'falha no upload'}`)
        return null
      })
      .finally(() => setUploadandoFoto(false))
  }

  function avancar1() {
    if (!raca.trim()) { mostrarErro('Informe a raça do pet.'); return }
    if (!cor.trim()) { mostrarErro('Informe a cor do pet.'); return }
    if (!porte) { mostrarErro('Selecione o porte do pet.'); return }
    if (!fotoPreview) { mostrarErro('Adicione ao menos uma foto do pet.'); return }
    setErro('')
    setEtapa(2)
  }

  function avancar2() {
    if (!descricao.trim() || descricao.trim().length < 10) { mostrarErro('Descreva o pet com mais detalhes (mín. 10 caracteres).'); return }
    if (!contato.trim()) { mostrarErro('Informe um contato para quem encontrar o pet.'); return }
    if (!telefoneValido(contato)) { mostrarErro('Informe um WhatsApp válido: (XX) 9XXXX-XXXX.'); return }
    if (!dataHora) { mostrarErro('Informe a data e hora aproximada.'); return }
    setErro('')
    setEtapa(3)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (!user) return
    if (!coordenadas || !locConfirmada) { mostrarErro('Confirme a localização no mapa.'); return }
    if (!editando && !turnstileToken) { mostrarErro('Aguarde a verificação de segurança concluir.'); return }
    setEnviando(true)

    let foto_url: string | null = editando?.foto_url ?? null
    if (uploadFotoPromise.current) {
      const url = await uploadFotoPromise.current
      if (url === null && erroFoto) { mostrarErro(erroFoto); setEnviando(false); return }
      foto_url = url
    }
    if (!foto_url) { mostrarErro('Adicione ao menos uma foto do pet.'); setEnviando(false); return }

    const registro = {
      user_id: user.id,
      autor_nome: perfil?.nome || user.email || 'Anônimo',
      tipo,
      especie,
      nome_pet: tipo === 'perdido' ? (nomePet.trim() || null) : null,
      raca: raca.trim() || null,
      cor: cor.trim() || null,
      porte: porte || null,
      descricao: descricao.trim(),
      lat: coordenadas.lat,
      lng: coordenadas.lng,
      endereco_label: coordenadas.label,
      foto_url,
      contato: contato.trim(),
    }

    const { erro, id, protocolo: prot } = await salvarCamada({ camada: 'pets', editando, dados: registro, turnstileToken, supabase })

    setEnviando(false)
    if (erro) { mostrarErro(erro); return }
    if (editando) { aoSalvar(); aoFechar(); return }

    if (prot) setProtocolo(prot)
    setSucesso(true)
    aoSalvar()
  }

  const titulos: Record<1 | 2 | 3, string> = {
    1: editando ? 'Editar registro' : 'Registrar um pet',
    2: 'Detalhes',
    3: editando ? 'Editar registro' : 'Localização',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '440px', height: '580px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
            {titulos[etapa]}
          </h2>
          <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Registro enviado!</p>
            {protocolo && (
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
                Protocolo: <span style={{ color: '#4256c8' }}>{protocolo}</span>
              </p>
            )}
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Seu registro está em análise. Se aprovado pelo nosso Agente IA, aparecerá no mapa em instantes.
            </p>
            <button onClick={aoFechar} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 20px', minHeight: 0 }}>

            {/* ---- ETAPA 1: Tipo + Espécie + Nome + Raça/Cor + Porte + Foto ---- */}
            {etapa === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>

                <div>
                  <label style={rotuloCampo}>O que você quer registrar? *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <BotaoOpcao ativo={tipo === 'perdido'} cor="#dc2626" onClick={() => setTipo('perdido')}
                      titulo="Perdi meu pet" desc="Ele sumiu de casa" />
                    <BotaoOpcao ativo={tipo === 'achado'} cor="#16a34a" onClick={() => setTipo('achado')}
                      titulo="Achei na rua" desc="Animal abandonado" />
                  </div>
                </div>

                <div>
                  <label style={rotuloCampo}>Espécie *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {(['cachorro', 'gato'] as const).map(e => (
                      <button key={e} type="button" onClick={() => setEspecie(e)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                          padding: '9px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: especie === e ? 600 : 500,
                          background: especie === e ? '#eff6ff' : 'white',
                          border: `1px solid ${especie === e ? '#4256c8' : '#e5e7eb'}`, color: '#111827',
                        }}>
                        <IconeEspecie especie={e} size={17} cor={especie === e ? '#4256c8' : '#6b7280'} />
                        {rotuloEspecie[e]}
                      </button>
                    ))}
                  </div>
                </div>

                {tipo === 'perdido' && (
                  <div>
                    <label style={rotuloCampo}>Nome do pet</label>
                    <input value={nomePet} onChange={(e) => setNomePet(e.target.value)} placeholder="Como ele se chama" style={campoEstilo} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={rotuloCampo}>Raça *</label>
                    <input value={raca} onChange={(e) => setRaca(e.target.value)} placeholder="Vira-lata, SRD..." style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Cor *</label>
                    <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Caramelo, preto..." style={campoEstilo} />
                  </div>
                </div>

                <div>
                  <label style={rotuloCampo}>Porte *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {(['pequeno', 'medio', 'grande'] as const).map(p => (
                      <button key={p} type="button" onClick={() => setPorte(porte === p ? '' : p)}
                        style={{
                          padding: '8px', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px',
                          fontWeight: porte === p ? 600 : 500,
                          background: porte === p ? '#eff6ff' : 'white',
                          border: `1px solid ${porte === p ? '#4256c8' : '#e5e7eb'}`, color: '#111827',
                        }}>
                        {rotuloPorte[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={rotuloCampo}>Foto *</label>
                  {!fotoPreview ? (
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '56px', border: '2px dashed #e5e7eb', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={aoEscolherFoto} style={{ display: 'none' }} />
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        <strong style={{ color: '#4256c8' }}>Toque para tirar foto</strong> ou escolher da galeria
                      </div>
                    </label>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', height: '56px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => { uploadFotoPromise.current = null; setFotoPreview(null); setErroFoto('') }}
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                      {uploadandoFoto && (
                        <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', borderRadius: '4px', padding: '2px 6px' }}>
                          ⏫ Enviando…
                        </div>
                      )}
                    </div>
                  )}
                  {erroFoto && <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>{erroFoto}</p>}
                </div>

                <div style={{ marginTop: 'auto', position: 'relative' }}>
                  {erro && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
                  <button type="button" onClick={avancar1}
                    style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* ---- ETAPA 2: Descrição + Contato + Data/Hora ---- */}
            {etapa === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <label style={rotuloCampo}>Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Marcas, coleira, comportamento, quando foi visto pela última vez..."
                    style={{ ...campoEstilo, flex: 1, minHeight: '80px', resize: 'none' }} />
                </div>

                <div>
                  <label style={rotuloCampo}>Contato *</label>
                  <input value={contato} onChange={(e) => setContato(mascaraTelefone(e.target.value))}
                    placeholder="(XX) 9XXXX-XXXX" inputMode="numeric" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>
                    {tipo === 'perdido' ? 'Quando sumiu? (data e hora aproximada) *' : 'Quando encontrou? (data e hora aproximada) *'}
                  </label>
                  <input
                    type="datetime-local"
                    value={dataHora}
                    onChange={e => setDataHora(e.target.value)}
                    style={campoEstilo}
                  />
                </div>

                <div style={{ marginTop: 'auto', position: 'relative' }}>
                  {erro && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => { setErro(''); setEtapa(1) }}
                      style={{ flex: '0 0 auto', background: 'white', color: '#6b7280', fontWeight: 600, padding: '10px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '14px' }}>
                      ← Voltar
                    </button>
                    <button type="button" onClick={avancar2}
                      style={{ flex: 1, backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                      Continuar →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---- ETAPA 3: Localização + Turnstile + Publicar ---- */}
            {etapa === 3 && (
              <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div>
                  <label style={rotuloCampo}>
                    {tipo === 'perdido' ? 'Onde ele sumiu? *' : 'Onde você encontrou? *'}
                  </label>
                  <div>
                    <MiniMapaConfirmar
                      altura={260}
                      onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                      onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                    />
                  </div>
                </div>

                {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

                <div style={{ marginTop: 'auto', position: 'relative' }}>
                  {erro && <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => { setErro(''); setEtapa(2) }}
                      style={{ flex: '0 0 auto', background: 'white', color: '#6b7280', fontWeight: 600, padding: '10px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '14px' }}>
                      ← Voltar
                    </button>
                    <button type="submit" disabled={enviando || uploadandoFoto}
                      style={{ flex: 1, backgroundColor: (enviando || uploadandoFoto) ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: (enviando || uploadandoFoto) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                      {enviando ? 'Salvando...' : uploadandoFoto ? 'Aguardando foto...' : editando ? 'Salvar alterações' : 'Publicar registro'}
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
