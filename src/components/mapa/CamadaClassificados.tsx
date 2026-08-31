'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import { Classificado, TipoVeiculo, CamadaConfig } from '@/types'
import { escapeHtml } from '@/lib/escapeHtml'
// Só o tipo — o maplibre-gl em si continua carregado dinamicamente por
// useMapaBase (import type é apagado na compilação, não força o bundle).
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'

/* ------------------------------------------------------------- ícones --- */

/**
 * Silhuetas provisórias dos veículos. Assim que o ícone definitivo de cada
 * tipo for cadastrado em camadas_config.icone_url, ele passa a ser usado no
 * lugar destas — ver `svgPinVeiculo`.
 */
const PATH_VEICULO: Record<TipoVeiculo, string> = {
  carro: 'M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13m-14 0h14m-14 0v3.5m14-3.5v3.5M6.5 16.5h1m9 0h1M4 13h16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3Z',
  moto: 'M5.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-13-2.5h5l3-5.5h3m-6 0h-3m9 0 2.5 5.5M14 7h3',
  onibus: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm0 5h16M8 18v1m8-1v1M8 4v7m8-7v7',
  caminhao: 'M2 15V7h11v8M13 10h4.5l2.5 3v2M2 15h18M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
}

export const ROTULO_VEICULO: Record<TipoVeiculo, string> = {
  carro: 'Carro',
  moto: 'Moto',
  onibus: 'Ônibus',
  caminhao: 'Caminhão',
}

export const TIPOS: TipoVeiculo[] = ['carro', 'moto', 'onibus', 'caminhao']

export function IconeVeiculo({ tipo, size = 18, cor = 'currentColor' }: { tipo: TipoVeiculo; size?: number; cor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATH_VEICULO[tipo]} />
    </svg>
  )
}

/** Miolo do pin: ícone cadastrado no painel quando houver, senão a silhueta padrão. */
function svgPinVeiculo(tipo: TipoVeiculo, iconeUrl: string | undefined, cor: string) {
  if (iconeUrl) {
    return `<img src="${escapeHtml(iconeUrl)}" style="width:19px;height:19px;object-fit:contain;" />`
  }
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${PATH_VEICULO[tipo]}"/></svg>`
}

/* ------------------------------------------------------------ helpers --- */

export function chaveVeiculo(c: Classificado) {
  return `classificado_${c.tipo_veiculo}`
}

const COR_PADRAO = '#ffffff'

/** Deslocamento aleatório de ~150–300 m, para o endereço exato nunca ser publicado. */

function formatarPreco(v?: number) {
  if (v == null) return 'A combinar'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatarKm(v?: number) {
  if (v == null) return null
  return `${v.toLocaleString('pt-BR')} km`
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/* ================================================================= dados = */

export function useClassificados() {
  const supabase = createClient()
  const [classificados, setClassificados] = useState<Classificado[]>([])
  const [config, setConfig] = useState<Record<string, CamadaConfig>>({})

  async function recarregar() {
    const { data } = await supabase
      .from('classificados')
      .select('*')
      .eq('oculto', false)
      .eq('vendido', false)
      .eq('ia_decisao', 'aprovada')
      .order('created_at', { ascending: false })
    setClassificados((data || []) as Classificado[])
  }

  useEffect(() => {
    supabase
      .from('classificados')
      .select('*')
      .eq('oculto', false)
      .eq('vendido', false)
      .eq('ia_decisao', 'aprovada')
      .order('created_at', { ascending: false })
      .then(({ data }) => setClassificados((data || []) as Classificado[]))
    supabase.from('camadas_config').select('*').eq('camada', 'classificados').then(({ data }) => {
      if (!data) return
      const mapa: Record<string, CamadaConfig> = {}
      for (const c of data as CamadaConfig[]) mapa[c.chave] = c
      setConfig(mapa)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { classificados, config, recarregar }
}

/* =============================================================== markers = */

export function useMarkersClassificados({
  ativo, classificados, config, filtro, mapaObj, maplibreObj, mapaCarregado, aoSelecionar,
}: {
  ativo: boolean
  classificados: Classificado[]
  config: Record<string, CamadaConfig>
  filtro: string
  mapaObj: React.MutableRefObject<MapLibreMap | null>
  maplibreObj: React.MutableRefObject<typeof import('maplibre-gl') | null>
  mapaCarregado: boolean
  aoSelecionar: (c: Classificado) => void
}) {
  const markersRef = useRef<Marker[]>([])
  const popupAbertoRef = useRef<Popup | null>(null)

  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !maplibreObj.current) return
    const maplibregl = maplibreObj.current
    const mapa = mapaObj.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (!ativo) return

    const visiveis = classificados.filter(c => !filtro || c.tipo_veiculo === filtro)
    const porId = new Map(visiveis.map(c => [c.id, c]))

    visiveis.forEach((c) => {
      const cfg = config[chaveVeiculo(c)]
      const fundo = cfg?.cor || COR_PADRAO
      // Pin branco pede traço escuro para o ícone continuar legível
      const traco = fundo.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff'

      const el = document.createElement('div')
      el.className = 'pin-classificado'
      el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,.35))'
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;background:${fundo};display:flex;align-items:center;justify-content:center;">
          ${svgPinVeiculo(c.tipo_veiculo, cfg?.icone_url, traco)}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
      </div>`

      const popup = new maplibregl.Popup({ maxWidth: '260px', closeButton: true }).setHTML(`
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          ${c.fotos?.[0] ? `<img src="${escapeHtml(c.fotos[0])}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />` : ''}
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#4256c8;text-transform:uppercase;letter-spacing:.03em;">${ROTULO_VEICULO[c.tipo_veiculo]}</p>
          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(c.titulo)}</p>
          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#166534;">${formatarPreco(c.preco)}</p>
          <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">${escapeHtml(c.bairro_label)} · localização aproximada</p>
          <button class="ver-classificado-btn" data-ver-classificado="${c.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver anúncio
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `)
      popup.on('open', () => { popupAbertoRef.current = popup })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(mapa)

      markersRef.current.push(marker)
    })

    const container = mapa.getContainer()
    function aoClicar(e: MouseEvent) {
      const alvo = (e.target as HTMLElement).closest('.ver-classificado-btn') as HTMLElement | null
      if (!alvo) return
      const item = porId.get(alvo.getAttribute('data-ver-classificado') || '')
      if (!item) return
      popupAbertoRef.current?.remove()
      aoSelecionar(item)
    }
    container.addEventListener('click', aoClicar)
    return () => { container.removeEventListener('click', aoClicar) }
  }, [ativo, classificados, config, filtro, mapaCarregado]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* =============================================================== sidebar = */

const rotuloEstilo: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }
const valorEstilo: React.CSSProperties = { fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }
const botaoAcao: React.CSSProperties = { fontSize: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 500, width: '100%' }

export function SidebarClassificados({
  classificados, filtro, setFiltro, selecionado, setSelecionado,
  onRegistrar, onEditar, onExcluir, onMarcarVendido, onFoto,
}: {
  classificados: Classificado[]
  filtro: string
  setFiltro: (f: string) => void
  selecionado: Classificado | null
  setSelecionado: (c: Classificado | null) => void
  onRegistrar: () => void
  onEditar: (c: Classificado) => void
  onExcluir: (c: Classificado) => void
  onMarcarVendido: (c: Classificado) => void
  onFoto: (url: string) => void
}) {
  const { user, perfil } = useAuth()
  const visiveis = classificados.filter(c => !filtro || c.tipo_veiculo === filtro)

  if (selecionado) {
    const meu = user?.id === selecionado.user_id
    const ehMaster = perfil?.role === 'master'
    return (
      <div key={selecionado.id} className="demanda-detalhe-anim" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f9fafb', flexShrink: 0 }}>
          <button onClick={() => setSelecionado(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: 0 }}>
            ← Voltar
          </button>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconeVeiculo tipo={selecionado.tipo_veiculo} size={15} cor="#4256c8" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4256c8', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {ROTULO_VEICULO[selecionado.tipo_veiculo]}
            </span>
          </div>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{selecionado.titulo}</h3>
            <p style={{ fontSize: '17px', fontWeight: 800, color: '#166534', margin: 0 }}>
              {formatarPreco(selecionado.preco)}
              {selecionado.aceita_troca && <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginLeft: '6px' }}>aceita troca</span>}
            </p>
          </div>

          {selecionado.fotos?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: selecionado.fotos.length > 1 ? '1fr 1fr' : '1fr', gap: '5px' }}>
              {selecionado.fotos.map((f, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={f} alt={`${selecionado.titulo} — foto ${i + 1}`} onClick={() => onFoto(f)}
                  style={{ width: '100%', height: selecionado.fotos.length > 1 ? '78px' : '150px', objectFit: 'cover', borderRadius: '6px', cursor: 'zoom-in', display: 'block' }} />
              ))}
            </div>
          )}

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {selecionado.marca && <div><p style={rotuloEstilo}>Marca</p><p style={valorEstilo}>{selecionado.marca}</p></div>}
              {selecionado.modelo && <div><p style={rotuloEstilo}>Modelo</p><p style={valorEstilo}>{selecionado.modelo}</p></div>}
              {selecionado.ano && <div><p style={rotuloEstilo}>Ano</p><p style={valorEstilo}>{selecionado.ano}</p></div>}
              {selecionado.km != null && <div><p style={rotuloEstilo}>KM</p><p style={valorEstilo}>{formatarKm(selecionado.km)}</p></div>}
              {selecionado.cor && <div><p style={rotuloEstilo}>Cor</p><p style={valorEstilo}>{selecionado.cor}</p></div>}
            </div>
            <div>
              <p style={rotuloEstilo}>Descrição</p>
              <p style={valorEstilo}>{sentenceCase(selecionado.descricao)}</p>
            </div>
            <div>
              <p style={rotuloEstilo}>Região</p>
              <p style={valorEstilo}>
                {selecionado.bairro_label || '—'}
                <span style={{ color: '#6b7280', fontSize: '11px' }}> · localização aproximada</span>
              </p>
            </div>
            <div>
              <p style={rotuloEstilo}>Contato</p>
              <p style={valorEstilo}>{selecionado.contato}</p>
            </div>
          </div>

          {meu && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button onClick={() => onMarcarVendido(selecionado)} style={{ ...botaoAcao, color: '#166534', fontWeight: 600 }}>
                Marcar como vendido
              </button>
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
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Classificados</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Veículos à venda em Frutal-MG. A localização exibida é aproximada.
        </p>

        <button onClick={onRegistrar}
          style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
          {user ? 'Anunciar veículo' : 'Entrar para anunciar'}
        </button>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Tipo</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box' }}>
          <option value=''>Todos</option>
          {TIPOS.map(t => (
            <option key={t} value={t}>{ROTULO_VEICULO[t]}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid #f9fafb' }}>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {visiveis.length} anúncio{visiveis.length !== 1 ? 's' : ''}
        </span>
      </div>
    </>
  )
}


/* ============================================================ formulário = */


export { FormClassificado as FormularioClassificado } from './FormClassificado'
