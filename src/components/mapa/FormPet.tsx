'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Pet, TipoPet, EspeciePet, PortePet } from '@/types'
import { salvarCamada } from './salvarCamada'
import { rotuloEspecie, rotuloPorte } from './CamadaPets'
import { mascaraTelefone, telefoneValido } from '@/lib/mascaraTelefone'

/* ------------------------------------------------------------ helpers --- */

// Converte um timestamp ISO (banco) pro formato que <input type="datetime-local">
// espera (YYYY-MM-DDTHH:mm, hora local, sem segundos nem timezone).
function isoParaDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

function BotaoOpcao({ ativo, onClick, titulo, desc }: { ativo: boolean; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
      padding: '9px 11px', borderRadius: '7px', cursor: 'pointer', textAlign: 'center',
      background: ativo ? '#eff6ff' : 'white',
      border: `1px solid ${ativo ? '#4256c8' : '#e5e7eb'}`,
    }}>
      <span style={{ fontSize: '13px', fontWeight: ativo ? 700 : 600, color: '#111827' }}>{titulo}</span>
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
  // BUG CORRIGIDO: nascia sempre vazio (mesmo editando um pet que já tinha
  // esse dado), o que fazia editar um pet perdido/achado sempre falhar na
  // validação até o usuário redigitar a data. Agora pré-preenche a partir
  // do valor salvo, convertendo de ISO (banco) pro formato que o input
  // datetime-local espera (sem segundos/timezone).
  const [dataHora, setDataHora] = useState(
    editando?.data_hora_aproximada ? isoParaDatetimeLocal(editando.data_hora_aproximada) : ''
  )
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(
    editando ? { lat: editando.lat, lng: editando.lng, label: editando.endereco_label ?? '' } : null
  )
  const [locConfirmada, setLocConfirmada] = useState(!!editando)
  const [fotoPreview, setFotoPreview] = useState<string | null>(editando?.foto_url ?? null)
  const uploadFotoPromise = useRef<Promise<string | null> | null>(null)
  // Rastreiam o upload em andamento pra poder limpar o Storage se ele "perder"
  // a corrida: usuário troca de foto, remove a foto, ou o envio final falha
  // depois do upload já ter completado. Sem isso, cada uma dessas situações
  // deixava um arquivo órfão em "pets-fotos" pra sempre.
  const fotoUploadToken = useRef<{ cancelado: boolean } | null>(null)
  const fotoPathAtual = useRef<string | null>(null)
  const [uploadandoFoto, setUploadandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  function mostrarErro(msg: string) { setErro(msg); setTimeout(() => setErro(''), 5000) }
  const [sucesso, setSucesso] = useState(false)
  const [protocolo, setProtocolo] = useState('')

  // Campos obrigatórios por tipo
  const exibeNome     = tipo === 'perdido'
  const exibeRaca     = tipo === 'perdido' || tipo === 'achado'
  const exibeCor      = tipo === 'perdido' || tipo === 'achado'
  const fotoObrigatoria = tipo === 'perdido' || tipo === 'adocao'
  const exibeDataHora = tipo === 'perdido' || tipo === 'achado'

  /** Apaga do Storage um upload que não vai mais ser usado — best-effort. */
  function limparFotoOrfa(path: string | null) {
    if (!path) return
    supabase.storage.from('pets-fotos').remove([path])
      .catch(err => console.error('[FormPet] falha ao limpar foto órfã:', err))
  }

  // Se o usuário fecha o modal (botão "×", sem passar por enviar()) com um
  // upload em andamento ou já concluído mas não usado, o arquivo ficava
  // órfão no Storage pra sempre — nada interceptava aoFechar antes disso.
  useEffect(() => {
    return () => {
      if (fotoUploadToken.current) fotoUploadToken.current.cancelado = true
      limparFotoOrfa(fotoPathAtual.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setErroFoto('Foto muito grande (máx. 20 MB). Escolha outra.')
      e.target.value = ''
      return
    }
    // Uma foto anterior ainda podia estar subindo — marca o upload dela
    // como cancelado (o .then() dela vai se limpar sozinho ao perceber
    // isso) e descarta qualquer caminho que já tivesse "vencido".
    if (fotoUploadToken.current) fotoUploadToken.current.cancelado = true
    limparFotoOrfa(fotoPathAtual.current)
    fotoPathAtual.current = null
    const token = { cancelado: false }
    fotoUploadToken.current = token

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
        if (token.cancelado) {
          // Usuário trocou/removeu a foto enquanto esse upload ainda rodava —
          // ele só terminou agora, mas ninguém vai usar o resultado.
          limparFotoOrfa(path)
          return null
        }
        fotoPathAtual.current = path
        return supabase.storage.from('pets-fotos').getPublicUrl(path).data.publicUrl
      })
      .catch((err: unknown) => { setErroFoto(`Erro ao enviar foto: ${err instanceof Error ? err.message : 'falha no upload'}`); return null })
      .finally(() => setUploadandoFoto(false))
  }

  async function enviar() {
    // Valida todos os campos de uma vez
    if (exibeNome && !nomePet.trim()) { mostrarErro('Informe o nome do Pet.'); return }
    if (exibeRaca && !raca.trim()) { mostrarErro('Informe a raça do Pet.'); return }
    if (exibeCor && !cor.trim()) { mostrarErro('Informe a cor do Pet.'); return }
    if (!porte) { mostrarErro('Selecione o porte do Pet.'); return }
    if (fotoObrigatoria && !fotoPreview) { mostrarErro('Adicione ao menos uma foto do Pet.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { mostrarErro('Descreva o Pet com mais detalhes (mín. 10 caracteres).'); return }
    if (tipo !== 'achado' && !contato.trim()) { mostrarErro('Informe um contato.'); return }
    if (contato.trim() && !telefoneValido(contato)) { mostrarErro('Informe um WhatsApp válido: (XX) 9XXXX-XXXX.'); return }
    if (exibeDataHora && !dataHora) { mostrarErro('Informe a data e hora aproximada.'); return }
    if (!coordenadas || !locConfirmada) { mostrarErro('Confirme a localização no mapa.'); return }
    if (!editando && !turnstileToken) { mostrarErro('Aguarde a verificação de segurança concluir.'); return }
    if (!user) return
    setErro('')
    setEnviando(true)

    let foto_url: string | null = editando?.foto_url ?? null
    if (uploadFotoPromise.current) {
      const url = await uploadFotoPromise.current
      if (url === null && erroFoto) { mostrarErro(erroFoto); setEnviando(false); return }
      foto_url = url
    }
    if (fotoObrigatoria && !foto_url) { mostrarErro('Adicione ao menos uma foto do Pet.'); setEnviando(false); return }

    const registro = {
      user_id: user.id,
      autor_nome: perfil?.nome || user.email || 'Anônimo',
      tipo, especie,
      nome_pet: exibeNome ? (nomePet.trim() || null) : null,
      raca: exibeRaca ? (raca.trim() || null) : null,
      cor: exibeCor ? (cor.trim() || null) : null,
      porte: porte || null,
      descricao: descricao.trim(),
      // BUG CORRIGIDO: campo obrigatório na tela (linha de validação acima)
      // nunca entrava aqui — o cidadão preenchia e o dado era descartado.
      data_hora_aproximada: exibeDataHora && dataHora ? new Date(dataHora).toISOString() : null,
      lat: coordenadas.lat, lng: coordenadas.lng,
      endereco_label: coordenadas.label,
      foto_url, contato: contato.trim(),
    }

    const { erro, protocolo: prot } = await salvarCamada({ camada: 'pets', editando, dados: registro, turnstileToken, supabase })

    setEnviando(false)
    if (erro) {
      // O upload já tinha completado com sucesso antes desse passo falhar —
      // sem isso, o arquivo ficava órfão no Storage pra sempre.
      limparFotoOrfa(fotoPathAtual.current)
      fotoPathAtual.current = null
      mostrarErro(erro)
      return
    }
    fotoPathAtual.current = null // usado com sucesso — não é mais candidato a limpeza
    if (editando) { aoSalvar(); aoFechar(); return }
    if (prot) setProtocolo(prot)
    setSucesso(true)
    aoSalvar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '440px', height: 'auto', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
            {editando ? 'Editar registro' : 'Registrar um Pet'}
          </h2>
          <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Registro enviado!</p>
            {protocolo && <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>Protocolo: <span style={{ color: '#4256c8' }}>{protocolo}</span></p>}
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Seu registro está em análise. Se aprovado pelo nosso Agente IA, aparecerá no mapa em instantes.
            </p>
            <button onClick={aoFechar} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
          </div>
        ) : (
          <>
            {/* Conteúdo com scroll */}
            <form id="form-pet" onSubmit={(e) => { e.preventDefault(); enviar() }}
              style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>

              <div>
                <label style={rotuloCampo}>O que você quer registrar? *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <BotaoOpcao ativo={tipo === 'perdido'} onClick={() => setTipo('perdido')} titulo="Perdi meu Pet" desc="Ele sumiu de casa" />
                  <BotaoOpcao ativo={tipo === 'achado'} onClick={() => setTipo('achado')} titulo="Achei um Pet" desc="Encontrei na rua" />
                  <BotaoOpcao ativo={tipo === 'adocao'} onClick={() => setTipo('adocao')} titulo="Doar um Pet" desc="Quero doar" />
                </div>
              </div>

              <div>
                <label style={rotuloCampo}>Espécie *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {(['cachorro', 'gato'] as const).map(e => (
                    <button key={e} type="button" onClick={() => setEspecie(e)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '9px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: especie === e ? 600 : 500, background: especie === e ? '#eff6ff' : 'white', border: `1px solid ${especie === e ? '#4256c8' : '#e5e7eb'}`, color: '#111827' }}>
                      {rotuloEspecie[e]}
                    </button>
                  ))}
                </div>
              </div>

              {exibeNome && (
                <div>
                  <label style={rotuloCampo}>Nome do Pet *</label>
                  <input value={nomePet} onChange={(e) => setNomePet(e.target.value)} placeholder="Como ele se chama" style={campoEstilo} />
                </div>
              )}

              {(exibeRaca || exibeCor) && (
                <div style={{ display: 'grid', gridTemplateColumns: exibeRaca && exibeCor ? '1fr 1fr' : '1fr', gap: '10px' }}>
                  {exibeRaca && <div><label style={rotuloCampo}>Raça *</label><input value={raca} onChange={(e) => setRaca(e.target.value)} placeholder="Vira-lata, SRD..." style={campoEstilo} /></div>}
                  {exibeCor && <div><label style={rotuloCampo}>Cor *</label><input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Caramelo, preto..." style={campoEstilo} /></div>}
                </div>
              )}

              <div>
                <label style={rotuloCampo}>Porte *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {(['pequeno', 'medio', 'grande'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPorte(porte === p ? '' : p)}
                      style={{ padding: '8px', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', fontWeight: porte === p ? 600 : 500, background: porte === p ? '#eff6ff' : 'white', border: `1px solid ${porte === p ? '#4256c8' : '#e5e7eb'}`, color: '#111827' }}>
                      {rotuloPorte[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={rotuloCampo}>{fotoObrigatoria ? 'Foto *' : 'Foto'}</label>
                {!fotoPreview ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Com capture o celular abre a camera; sem capture abre a galeria */}
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '56px', border: '2px dashed #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#4256c8', fontWeight: 600 }}>
                      <input type="file" accept="image/*" capture="environment" onChange={aoEscolherFoto} style={{ display: 'none' }} />
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                      Tirar foto
                    </label>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '56px', border: '2px dashed #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                      <input type="file" accept="image/*" onChange={aoEscolherFoto} style={{ display: 'none' }} />
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                      Galeria
                    </label>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', height: '56px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => {
                      if (fotoUploadToken.current) fotoUploadToken.current.cancelado = true
                      limparFotoOrfa(fotoPathAtual.current)
                      fotoPathAtual.current = null
                      uploadFotoPromise.current = null
                      setFotoPreview(null)
                      setErroFoto('')
                    }}
                      style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                    {uploadandoFoto && <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', borderRadius: '4px', padding: '2px 6px' }}>⏫ Enviando…</div>}
                  </div>
                )}
                {erroFoto && <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>{erroFoto}</p>}
              </div>

              <div>
                <label style={rotuloCampo}>Descrição *</label>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  placeholder={
                    tipo === 'perdido' ? 'Marcas, coleira, comportamento, quando e onde foi visto pela última vez...' :
                    tipo === 'achado'  ? 'Onde foi encontrado, aparência, comportamento, sinais físicos...' :
                    'Idade, temperamento, vacinado, castrado, se dá com crianças ou outros animais...'
                  }
                  style={{ ...campoEstilo, minHeight: '80px', resize: 'none' }} />
              </div>

              <div>
                <label style={rotuloCampo}>Contato {tipo !== 'achado' ? '*' : <span style={{ fontWeight: 400 }}>(opcional)</span>}</label>
                <input value={contato} onChange={(e) => setContato(mascaraTelefone(e.target.value))} placeholder="(XX) 9XXXX-XXXX" inputMode="numeric" style={campoEstilo} />
              </div>

              {exibeDataHora && (
                <div>
                  <label style={rotuloCampo}>{tipo === 'perdido' ? 'Quando sumiu? (data e hora aproximada) *' : 'Quando encontrou? (data e hora aproximada) *'}</label>
                  <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} style={campoEstilo} />
                </div>
              )}

              <div>
                <label style={rotuloCampo}>{tipo === 'perdido' ? 'Onde ele sumiu? *' : 'Onde você encontrou? *'}</label>
                <MiniMapaConfirmar
                  altura={240}
                  onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                  onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                />
              </div>

              {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}
            </form>

            {/* Rodapé fixo */}
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 20px', flexShrink: 0 }}>
              {erro && <div style={{ marginBottom: '8px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
              <button type="submit" form="form-pet" disabled={enviando || uploadandoFoto}
                style={{ width: '100%', backgroundColor: (enviando || uploadandoFoto) ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: (enviando || uploadandoFoto) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                {enviando ? 'Salvando...' : uploadandoFoto ? 'Aguardando foto...' : editando ? 'Salvar alterações' : 'Publicar registro'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
