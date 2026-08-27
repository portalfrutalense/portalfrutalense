'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Pet, TipoPet, EspeciePet, PortePet, CamadaConfig } from '@/types'

/* ------------------------------------------------------------- ícones --- */

/** Silhuetas usadas no miolo do pin e nos seletores do formulário. */
const PATH_CACHORRO = 'M4.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm15 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm7 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.5 4c-2.8 0-5 2.5-5 5.2 0 1.6 1.1 2.8 2.6 2.8.9 0 1.6-.4 2.4-.4s1.5.4 2.4.4c1.5 0 2.6-1.2 2.6-2.8C17 13.5 14.8 11 12 11Z'
const PATH_GATO = 'M12 5c-3.9 0-7 3-7 6.8 0 1.6.5 3 1.4 4.2L5 20.5c-.2.6.3 1.1.9.9l3-1.1c.9.4 2 .7 3.1.7s2.2-.3 3.1-.7l3 1.1c.6.2 1.1-.3.9-.9l-1.4-4.5c.9-1.2 1.4-2.6 1.4-4.2C19 8 15.9 5 12 5Zm-7.2.4L6.4 8M19.6 5.4 17.6 8M9.5 12.5h.01M14.5 12.5h.01M12 15.5c-.7 0-1.3-.3-1.6-.8M12 15.5c.7 0 1.3-.3 1.6-.8'

function IconeEspecie({ especie, size = 18, cor = 'currentColor' }: { especie: EspeciePet; size?: number; cor?: string }) {
  if (especie === 'gato') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={PATH_GATO} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={cor} aria-hidden="true">
      <path d={PATH_CACHORRO} />
    </svg>
  )
}

/** Mesma silhueta, como string, para o divIcon do Leaflet. */
function svgPinEspecie(especie: EspeciePet, cor: string) {
  if (especie === 'gato') {
    return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${PATH_GATO}"/></svg>`
  }
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="${cor}"><path d="${PATH_CACHORRO}"/></svg>`
}

/* ------------------------------------------------------------ helpers --- */

/** Chave de configuração (cor do pin) correspondente ao registro. */
export function chaveCorPet(p: Pet): string {
  if (p.reencontrado) return 'pet_reencontrado'
  return p.tipo === 'perdido' ? 'pet_perdido' : 'pet_achado'
}

const COR_PADRAO: Record<string, string> = {
  pet_perdido: '#dc2626',
  pet_achado: '#16a34a',
  pet_reencontrado: '#2563eb',
}

const ROTULO_FILTRO: Record<string, string> = {
  pet_perdido: 'Perdidos',
  pet_achado: 'Achei na rua',
  pet_reencontrado: 'Reencontrados',
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function escapeHtml(s?: string) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function diasRestantes(expira_em: string) {
  const ms = new Date(expira_em).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
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
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', 0.3)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
}

/* ================================================================= dados = */

export function usePets() {
  const supabase = createClient()
  const [pets, setPets] = useState<Pet[]>([])
  const [cores, setCores] = useState<Record<string, string>>(COR_PADRAO)

  async function recarregar() {
    const { data } = await supabase
      .from('pets')
      .select('*')
      .eq('oculto', false)
      .gt('expira_em', new Date().toISOString())
      .order('created_at', { ascending: false })
    setPets((data || []) as Pet[])
  }

  useEffect(() => {
    recarregar()
    supabase.from('camadas_config').select('*').eq('camada', 'pets').then(({ data }) => {
      if (!data) return
      const mapa = { ...COR_PADRAO }
      for (const c of data as CamadaConfig[]) mapa[c.chave] = c.cor
      setCores(mapa)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { pets, setPets, cores, recarregar }
}

/* =============================================================== markers = */

export function useMarkersPets({
  ativo, pets, cores, filtro, mapaObj, leafletObj, mapaCarregado, aoSelecionar,
}: {
  ativo: boolean
  pets: Pet[]
  cores: Record<string, string>
  filtro: string
  mapaObj: React.MutableRefObject<any>
  leafletObj: React.MutableRefObject<any>
  mapaCarregado: boolean
  aoSelecionar: (p: Pet) => void
}) {
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
    const mapa = mapaObj.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (!ativo) return

    const visiveis = pets.filter(p => !filtro || chaveCorPet(p) === filtro)
    const porId = new Map(visiveis.map(p => [p.id, p]))

    visiveis.forEach((p) => {
      const cor = cores[chaveCorPet(p)] || '#4256c8'
      const icon = L.divIcon({
        className: 'pin-pet',
        html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))">
          <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;background:${cor};display:flex;align-items:center;justify-content:center;">
            ${svgPinEspecie(p.especie, '#ffffff')}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
        </div>`,
        iconSize: [32, 41], iconAnchor: [16, 41],
      })

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(mapa)
      const titulo = p.reencontrado
        ? 'Reencontrado'
        : p.tipo === 'perdido' ? 'Pet perdido' : 'Pet achado na rua'

      marker.bindPopup(`
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          ${p.foto_url ? `<img src="${escapeHtml(p.foto_url)}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />` : ''}
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.03em;">${titulo}</p>
          ${p.nome_pet ? `<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(p.nome_pet)}</p>` : ''}
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${escapeHtml(p.endereco_label)}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#111827;line-height:1.4;">${escapeHtml(sentenceCase(p.descricao))}</p>
          <button class="ver-pet-btn" data-ver-pet="${p.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver detalhes
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `, { maxWidth: 260, closeButton: true })

      markersRef.current.push(marker)
    })

    const container = mapa.getContainer()
    function aoClicar(e: MouseEvent) {
      const alvo = (e.target as HTMLElement).closest('.ver-pet-btn') as HTMLElement | null
      if (!alvo) return
      const pet = porId.get(alvo.getAttribute('data-ver-pet') || '')
      if (!pet) return
      mapa.closePopup()
      aoSelecionar(pet)
    }
    container.addEventListener('click', aoClicar)
    return () => { container.removeEventListener('click', aoClicar) }
  }, [ativo, pets, cores, filtro, mapaCarregado]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* =============================================================== sidebar = */

const rotuloEspecie: Record<EspeciePet, string> = { cachorro: 'Cachorro', gato: 'Gato' }
const rotuloPorte: Record<PortePet, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' }

export function SidebarPets({
  pets, cores, filtro, setFiltro, selecionado, setSelecionado,
  onRegistrar, onEditar, onExcluir, onMarcarReencontrado, onFoto,
}: {
  pets: Pet[]
  cores: Record<string, string>
  filtro: string
  setFiltro: (f: string) => void
  selecionado: Pet | null
  setSelecionado: (p: Pet | null) => void
  onRegistrar: () => void
  onEditar: (p: Pet) => void
  onExcluir: (p: Pet) => void
  onMarcarReencontrado: (p: Pet) => void
  onFoto: (url: string) => void
}) {
  const { user } = useAuth()
  const visiveis = pets.filter(p => !filtro || chaveCorPet(p) === filtro)

  if (selecionado) {
    const cor = cores[chaveCorPet(selecionado)] || '#4256c8'
    const meu = user?.id === selecionado.user_id
    const titulo = selecionado.reencontrado
      ? 'Reencontrado'
      : selecionado.tipo === 'perdido' ? 'Pet perdido' : 'Pet achado na rua'

    return (
      <div key={selecionado.id} className="demanda-detalhe-anim" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f9fafb', flexShrink: 0 }}>
          <button onClick={() => setSelecionado(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Voltar
          </button>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: cor }}>
              <IconeEspecie especie={selecionado.especie} size={13} cor={cor} />
              {titulo}
            </span>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              some em {diasRestantes(selecionado.expira_em)}d
            </span>
          </div>

          {selecionado.foto_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={selecionado.foto_url} alt={selecionado.nome_pet || 'Foto do pet'}
              onClick={() => onFoto(selecionado.foto_url!)}
              style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '7px', cursor: 'zoom-in', display: 'block' }} />
          )}

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selecionado.nome_pet && (
              <div>
                <p style={rotuloEstilo}>Nome</p>
                <p style={valorEstilo}>{selecionado.nome_pet}</p>
              </div>
            )}
            <div>
              <p style={rotuloEstilo}>Descrição</p>
              <p style={valorEstilo}>{sentenceCase(selecionado.descricao)}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <p style={rotuloEstilo}>Espécie</p>
                <p style={valorEstilo}>{rotuloEspecie[selecionado.especie]}</p>
              </div>
              {selecionado.porte && (
                <div>
                  <p style={rotuloEstilo}>Porte</p>
                  <p style={valorEstilo}>{rotuloPorte[selecionado.porte]}</p>
                </div>
              )}
              {selecionado.raca && (
                <div>
                  <p style={rotuloEstilo}>Raça</p>
                  <p style={valorEstilo}>{selecionado.raca}</p>
                </div>
              )}
              {selecionado.cor && (
                <div>
                  <p style={rotuloEstilo}>Cor</p>
                  <p style={valorEstilo}>{selecionado.cor}</p>
                </div>
              )}
            </div>
            {selecionado.endereco_label && (
              <div>
                <p style={rotuloEstilo}>{selecionado.tipo === 'perdido' ? 'Sumiu perto de' : 'Encontrado em'}</p>
                <p style={valorEstilo}>{selecionado.endereco_label}</p>
              </div>
            )}
            <div>
              <p style={rotuloEstilo}>Contato</p>
              <p style={valorEstilo}>{selecionado.contato}</p>
            </div>
          </div>

          {meu && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selecionado.tipo === 'perdido' && !selecionado.reencontrado && (
                <button onClick={() => onMarcarReencontrado(selecionado)}
                  style={{ ...botaoAcao, color: '#166534', fontWeight: 600 }}>
                  Marcar como reencontrado
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button onClick={() => onEditar(selecionado)} style={{ ...botaoAcao, color: '#4256c8' }}>Editar</button>
                <button onClick={() => onExcluir(selecionado)} style={{ ...botaoAcao, color: '#dc2626' }}>Excluir</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Achei / Perdi um Pet</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Pets perdidos pelos donos e animais encontrados abandonados nas ruas de Frutal-MG.
        </p>

        <button onClick={onRegistrar}
          style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
          {user ? 'Registrar Pet' : 'Entrar para registrar'}
        </button>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Tipo</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <BotaoFiltro ativo={filtro === ''} cor="#6b7280" rotulo="Todos" onClick={() => setFiltro('')} />
          {(['pet_perdido', 'pet_achado', 'pet_reencontrado'] as const).map(chave => (
            <BotaoFiltro key={chave} ativo={filtro === chave} cor={cores[chave] || COR_PADRAO[chave]}
              rotulo={ROTULO_FILTRO[chave]} onClick={() => setFiltro(chave)} />
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid #f9fafb' }}>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {visiveis.length} registro{visiveis.length !== 1 ? 's' : ''}
        </span>
      </div>
    </>
  )
}

const rotuloEstilo: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }
const valorEstilo: React.CSSProperties = { fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }
const botaoAcao: React.CSSProperties = { fontSize: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 500, width: '100%' }

function BotaoFiltro({ ativo, cor, rotulo, onClick }: { ativo: boolean; cor: string; rotulo: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
      padding: '8px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
      fontWeight: ativo ? 600 : 500, textAlign: 'left',
      background: ativo ? '#eff6ff' : 'white',
      border: `1px solid ${ativo ? '#4256c8' : '#e5e7eb'}`,
      color: '#111827',
    }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cor, flexShrink: 0, border: cor.toLowerCase() === '#ffffff' ? '1px solid #d1d5db' : 'none' }} />
      {rotulo}
    </button>
  )
}

/* ============================================================ formulário = */

export function FormularioPet({
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
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(editando?.foto_url ?? null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
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
    if (fotoFile) {
      try {
        const blob = await comprimirFoto(fotoFile)
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage.from('pets-fotos').upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        foto_url = supabase.storage.from('pets-fotos').getPublicUrl(path).data.publicUrl
      } catch (err: any) {
        setErro(`Erro ao enviar foto: ${err?.message || 'falha no upload'}`); setEnviando(false); return
      }
    }

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

    const { error } = editando
      ? await supabase.from('pets').update(registro).eq('id', editando.id)
      : await supabase.from('pets').insert(registro)

    setEnviando(false)
    if (error) { setErro(error.message || 'Não foi possível salvar.'); return }
    if (editando) { aoSalvar(); aoFechar(); return }
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
                      <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>×</button>
                    </div>
                  )}
                </div>

                {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

                <button type="submit" disabled={enviando}
                  style={{ marginTop: 'auto', backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Publicar registro'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
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
