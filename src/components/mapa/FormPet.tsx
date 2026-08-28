'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Pet, TipoPet, EspeciePet, PortePet } from '@/types'
import { salvarCamada } from './salvarCamada'
import { IconeEspecie, rotuloEspecie, rotuloPorte } from './CamadaPets'

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

  const [tipo, setTipo] = useState<TipoPet>(editando?.tipo ?? 'perdido')
  const [especie, setEspecie] = useState<EspeciePet>(editando?.especie ?? 'cachorro')
  const [nomePet, setNomePet] = useState(editando?.nome_pet ?? '')
  const [raca, setRaca] = useState(editando?.raca ?? '')
  const [cor, setCor] = useState(editando?.cor ?? '')
  const [porte, setPorte] = useState<PortePet | ''>(editando?.porte ?? '')
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [contato, setContato] = useState(editando?.contato ?? '')
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

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (!user) return
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva o pet com mais detalhes.'); return }
    if (!contato.trim()) { setErro('Informe um contato para quem encontrar o pet.'); return }
    if (!coordenadas || !locConfirmada) { setErro('Confirme a localização no mapa.'); return }
    if (!editando && !turnstileToken) { setErro('Aguarde a verificação de segurança concluir.'); return }
    setEnviando(true)

    let foto_url: string | null = editando?.foto_url ?? null
    if (uploadFotoPromise.current) {
      const url = await uploadFotoPromise.current
      if (url === null && erroFoto) { setErro(erroFoto); setEnviando(false); return }
      foto_url = url
    }
    if (!foto_url) { setErro('Adicione ao menos uma foto do pet.'); setEnviando(false); return }

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
    if (erro) { setErro(erro); return }
    if (editando) { aoSalvar(); aoFechar(); return }

    if (prot) setProtocolo(prot)
    setSucesso(true)
    aoSalvar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
            {editando ? 'Editar registro' : 'Registrar um pet'}
          </h2>
          <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Registro publicado!</p>
            {protocolo && (
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
                Protocolo: <span style={{ color: '#4256c8' }}>{protocolo}</span>
              </p>
            )}
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Ele já aparece no mapa e fica visível por 30 dias.
            </p>
            <button onClick={aoFechar} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
            <form onSubmit={enviar} className="registro-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              {erro && <div style={{ gridColumn: '1 / -1', color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>{erro}</div>}

              {/* Coluna esquerda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    <label style={rotuloCampo}>Raça</label>
                    <input value={raca} onChange={(e) => setRaca(e.target.value)} placeholder="Vira-lata, SRD..." style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Cor</label>
                    <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Caramelo, preto..." style={campoEstilo} />
                  </div>
                </div>

                <div>
                  <label style={rotuloCampo}>Porte</label>
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
                  <label style={rotuloCampo}>
                    {tipo === 'perdido' ? 'Onde ele sumiu? *' : 'Onde você encontrou? *'}
                  </label>
                  <MiniMapaConfirmar
                    onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                    onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                  />
                </div>
              </div>

              {/* Coluna direita */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <label style={rotuloCampo}>Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Marcas, coleira, comportamento, quando foi visto pela última vez..."
                    style={{ ...campoEstilo, flex: 1, minHeight: '90px', resize: 'none' }} />
                </div>

                <div>
                  <label style={rotuloCampo}>Contato *</label>
                  <input value={contato} onChange={(e) => setContato(e.target.value)}
                    placeholder="WhatsApp ou telefone" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>Foto <span style={{ fontWeight: 400 }}>(recomendada)</span></label>
                  {!fotoPreview ? (
                    <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={aoEscolherFoto} style={{ display: 'none' }} />
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        <strong style={{ color: '#4256c8' }}>Toque para tirar foto</strong> ou escolher da galeria
                      </div>
                    </label>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fotoPreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => { uploadFotoPromise.current = null; setFotoPreview(null); setErroFoto('') }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                      {uploadandoFoto && (
                        <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', borderRadius: '4px', padding: '3px 8px' }}>
                          ⏫ Enviando foto…
                        </div>
                      )}
                    </div>
                  )}
                  {erroFoto && <p style={{ fontSize: '12px', color: '#dc2626', margin: '4px 0 0' }}>{erroFoto}</p>}
                </div>

                {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

                <button type="submit" disabled={enviando || uploadandoFoto}
                  style={{ marginTop: 'auto', backgroundColor: (enviando || uploadandoFoto) ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: (enviando || uploadandoFoto) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Salvando...' : uploadandoFoto ? 'Aguardando foto...' : editando ? 'Salvar alterações' : 'Publicar registro'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
