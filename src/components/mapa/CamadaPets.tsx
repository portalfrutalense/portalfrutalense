'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import { Pet, EspeciePet, PortePet, CamadaConfig } from '@/types'
// Só o tipo — o leaflet em si continua carregado dinamicamente por
// useMapaBase (import type é apagado na compilação, não força o bundle).
import type { Map as LeafletMap, Marker } from 'leaflet'

/* ------------------------------------------------------------- ícones --- */

/** Silhuetas usadas no miolo do pin e nos seletores do formulário. */
const PATH_CACHORRO = 'M4.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm15 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm7 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.5 4c-2.8 0-5 2.5-5 5.2 0 1.6 1.1 2.8 2.6 2.8.9 0 1.6-.4 2.4-.4s1.5.4 2.4.4c1.5 0 2.6-1.2 2.6-2.8C17 13.5 14.8 11 12 11Z'
const PATH_GATO = 'M5 18V9l4-5h6l4 5v9M9 4l-1 3m7-3 1 3M9 13h.01M15 13h.01M10 16c.5.6 1 1 2 1s1.5-.4 2-1'

export function IconeEspecie({ especie, size = 18, cor = 'currentColor' }: { especie: EspeciePet; size?: number; cor?: string }) {
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
  if (p.tipo === 'perdido') return 'pet_perdido'
  if (p.tipo === 'adocao') return 'pet_adocao'
  return 'pet_achado'
}

const COR_PADRAO: Record<string, string> = {
  pet_perdido: '#dc2626',
  pet_achado: '#16a34a',
  pet_adocao: '#7c3aed',
  pet_reencontrado: '#2563eb',
}

const ROTULO_FILTRO: Record<string, string> = {
  pet_perdido: 'Perdidos',
  pet_achado: 'Abandonados',
  pet_adocao: 'Adoção',
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
      .eq('ia_decisao', 'aprovada')
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
  mapaObj: React.MutableRefObject<LeafletMap | null>
  leafletObj: React.MutableRefObject<typeof import('leaflet') | null>
  mapaCarregado: boolean
  aoSelecionar: (p: Pet) => void
}) {
  const markersRef = useRef<Marker[]>([])

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
        : p.tipo === 'perdido' ? 'Perdi meu Pet'
        : p.tipo === 'adocao' ? 'Adotar um Pet'
        : 'Achei um Pet'

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

export const rotuloEspecie: Record<EspeciePet, string> = { cachorro: 'Cachorro', gato: 'Gato' }
export const rotuloPorte: Record<PortePet, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' }

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
  const { user, perfil } = useAuth()
  const visiveis = pets.filter(p => !filtro || chaveCorPet(p) === filtro)

  if (selecionado) {
    const cor = cores[chaveCorPet(selecionado)] || '#4256c8'
    const meu = user?.id === selecionado.user_id
    const ehMaster = perfil?.role === 'master'
    const titulo = selecionado.reencontrado
      ? 'Reencontrado'
      : selecionado.tipo === 'perdido' ? 'Perdi meu Pet'
      : selecionado.tipo === 'adocao' ? 'Adotar um Pet'
      : 'Achei um Pet'

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
          </div>

          {selecionado.foto_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={selecionado.foto_url} alt={selecionado.nome_pet || 'Foto do Pet'}
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
                <p style={rotuloEstilo}>{selecionado.tipo === 'perdido' ? 'Sumiu perto de' : selecionado.tipo === 'adocao' ? 'Localização' : 'Encontrado em'}</p>
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
              {(selecionado.tipo === 'perdido' || selecionado.tipo === 'adocao') && !selecionado.reencontrado && (
                <button onClick={() => onMarcarReencontrado(selecionado)}
                  style={{ ...botaoAcao, color: '#166534', fontWeight: 600 }}>
                  Marcar como reencontrado
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: ehMaster ? '1fr 1fr' : '1fr', gap: '6px' }}>
                {ehMaster && <button onClick={() => onEditar(selecionado)} style={{ ...botaoAcao, color: '#4256c8' }}>Editar</button>}
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Achei / Perdi um Pet</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Pets perdidos pelos donos e animais encontrados abandonados nas ruas.
        </p>

        <button onClick={onRegistrar}
          style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
          {user ? 'Registrar Pet' : 'Entrar para registrar'}
        </button>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Tipo</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box' }}>
          <option value=''>Todos</option>
          {(['pet_perdido', 'pet_achado', 'pet_adocao', 'pet_reencontrado'] as const).map(chave => (
            <option key={chave} value={chave}>{ROTULO_FILTRO[chave]}</option>
          ))}
        </select>
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



/* ============================================================ formulário = */

export { FormPet as FormularioPet } from './FormPet'
