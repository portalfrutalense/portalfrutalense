'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import { Imovel, TipoImovel, FinalidadeImovel, CamadaConfig } from '@/types'
import { escapeHtml } from '@/lib/escapeHtml'
import { linkWhatsapp } from '@/lib/mascaraTelefone'
// Só o tipo — o maplibre-gl em si continua carregado dinamicamente por
// useMapaBase (import type é apagado na compilação, não força o bundle).
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'

/* ------------------------------------------------------------- ícones --- */

/** Silhueta provisória de casa — até o ícone definitivo de cada tipo ser
 * cadastrado em camadas_config.icone_url (mesmo padrão de svgPinVeiculo em
 * CamadaClassificados.tsx). */
const PATH_CASA = 'M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9'

export function IconeImovel({ size = 18, cor = 'currentColor' }: { size?: number; cor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATH_CASA} />
    </svg>
  )
}

function svgPinImovel(iconeUrl: string | undefined, cor: string) {
  if (iconeUrl) {
    return `<img src="${escapeHtml(iconeUrl)}" alt="" style="width:19px;height:19px;object-fit:contain;" />`
  }
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${PATH_CASA}"/></svg>`
}

/* ------------------------------------------------------------ helpers --- */

export const ROTULO_TIPO_IMOVEL: Record<TipoImovel, string> = {
  casa: 'Casa',
  apartamento: 'Apartamento',
  terreno: 'Terreno',
  comodo_comercial: 'Cômodo Comercial',
  barracao: 'Barracão',
  fazenda_chacara_sitio: 'Fazenda, Chácara ou Sítio',
}

export const TIPOS_IMOVEL: TipoImovel[] = [
  'casa', 'apartamento', 'terreno', 'comodo_comercial', 'barracao', 'fazenda_chacara_sitio',
]

export const ROTULO_FINALIDADE: Record<FinalidadeImovel, string> = {
  aluguel: 'Aluguel',
  venda: 'Venda',
}

// BUG CORRIGIDO (decisão confirmada com o usuário): pin configurado só por
// tipo (chave = `imovel_${tipo}`) — igual chaveConfigPet.tsx faz pra
// pets (situação + espécie), agora finalidade também entra na chave, pra
// "Alugar Casa" e "Vender Casa" poderem ter cor/ícone independentes.
export function chaveImovel(i: Imovel) {
  return `imovel_${i.finalidade}_${i.tipo}`
}

const COR_PADRAO = '#f59e0b'

function formatarValor(v?: number) {
  if (v == null) return 'A combinar'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Endereço é nome próprio — cada palavra com inicial maiúscula, não só a
// primeira. Mesmo helper duplicado em CamadaPets.tsx/CamadaClassificados.tsx/
// CamadaEmpregos.tsx.
function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().split(' ').map((w) => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

/* ================================================================= dados = */

export function useImoveis() {
  const supabase = createClient()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [config, setConfig] = useState<Record<string, CamadaConfig>>({})

  async function recarregar() {
    const { data } = await supabase
      .from('imoveis')
      .select('*')
      .eq('oculto', false)
      .eq('ia_decisao', 'aprovada')
      .order('created_at', { ascending: false })
    setImoveis((data || []) as Imovel[])
  }

  useEffect(() => {
    supabase
      .from('imoveis')
      .select('*')
      .eq('oculto', false)
      .eq('ia_decisao', 'aprovada')
      .order('created_at', { ascending: false })
      .then(({ data }) => setImoveis((data || []) as Imovel[]))
    supabase.from('camadas_config').select('*').eq('camada', 'imoveis').then(({ data }) => {
      if (!data) return
      const mapa: Record<string, CamadaConfig> = {}
      for (const c of data as CamadaConfig[]) mapa[c.chave] = c
      setConfig(mapa)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { imoveis, config, recarregar }
}

/* =============================================================== markers = */

export function useMarkersImoveis({
  ativo, imoveis, config, filtro, mapaObj, maplibreObj, mapaCarregado, aoSelecionar,
  logado, aoExigirLogin,
}: {
  ativo: boolean
  imoveis: Imovel[]
  config: Record<string, CamadaConfig>
  filtro: string
  mapaObj: React.MutableRefObject<MapLibreMap | null>
  maplibreObj: React.MutableRefObject<typeof import('maplibre-gl') | null>
  mapaCarregado: boolean
  aoSelecionar: (i: Imovel) => void
  // BUG CORRIGIDO (pedido do usuário): pin de imóvel abria o popup direto,
  // sem checar login — só o pin de Demanda tinha essa trava. Mesmo padrão
  // agora nas 4 camadas.
  logado: boolean
  aoExigirLogin: () => void
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

    const visiveis = imoveis.filter(i => !filtro || i.finalidade === filtro)
    const porId = new Map(visiveis.map(i => [i.id, i]))

    visiveis.forEach((i) => {
      const cfg = config[chaveImovel(i)]
      const fundo = cfg?.cor || COR_PADRAO
      const traco = fundo.toLowerCase() === '#ffffff' ? '#111827' : '#ffffff'
      const miolo = svgPinImovel(cfg?.icone_url, traco)

      const el = document.createElement('div')
      el.className = 'pin-imovel'
      el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,.35))'
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;background:${fundo};display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${miolo}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
      </div>`

      const popup = new maplibregl.Popup({ maxWidth: '260px', closeButton: true }).setHTML(`
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          ${i.fotos?.[0] ? `<img src="${escapeHtml(i.fotos[0])}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" />` : ''}
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#4256c8;text-transform:uppercase;letter-spacing:.03em;">${ROTULO_FINALIDADE[i.finalidade]} · ${ROTULO_TIPO_IMOVEL[i.tipo]}</p>
          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#166534;">${formatarValor(i.valor)}</p>
          <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">${escapeHtml(titleCase(i.endereco_label))}</p>
          <button class="ver-imovel-btn" data-ver-imovel="${i.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver anúncio
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `)
      popup.on('open', () => { popupAbertoRef.current = popup })
      popup.on('close', () => { if (popupAbertoRef.current === popup) popupAbertoRef.current = null })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([i.lng, i.lat])
        .addTo(mapa)

      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (!logado) { aoExigirLogin(); return }
        popup.setLngLat([i.lng, i.lat]).addTo(mapa)
      })

      markersRef.current.push(marker)
    })

    const container = mapa.getContainer()
    function aoClicar(e: MouseEvent) {
      const alvo = (e.target as HTMLElement).closest('.ver-imovel-btn') as HTMLElement | null
      if (!alvo) return
      const item = porId.get(alvo.getAttribute('data-ver-imovel') || '')
      if (!item) return
      popupAbertoRef.current?.remove()
      aoSelecionar(item)
    }
    container.addEventListener('click', aoClicar)
    return () => { container.removeEventListener('click', aoClicar) }
  }, [ativo, imoveis, config, filtro, mapaCarregado, logado]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* =============================================================== sidebar = */

const rotuloEstilo: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }
const valorEstilo: React.CSSProperties = { fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }
const botaoAcao: React.CSSProperties = { fontSize: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 500, width: '100%' }

// Botão de contato via WhatsApp — mesmo ícone/estilo que
// CamadaPets.tsx/CamadaClassificados.tsx/CamadaEmpregos.tsx (ver comentário
// lá sobre não haver módulo de ícones compartilhado neste projeto).
const botaoWhatsapp: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '2px', background: '#25d366', color: 'white', fontSize: '12.5px', fontWeight: 600, padding: '8px 14px', borderRadius: '20px', textDecoration: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }
function IconeWhatsapp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function SidebarImoveis({
  imoveis, filtro, setFiltro, selecionado, setSelecionado,
  onRegistrar, onEditar, onExcluir, onMarcarVendidoAlugado, onFoto, aoExigirLogin,
  isMobile, aoIniciarArraste, aoArrastar, aoSoltarArraste, onCentralizar,
}: {
  imoveis: Imovel[]
  filtro: string
  setFiltro: (f: string) => void
  selecionado: Imovel | null
  setSelecionado: (i: Imovel | null) => void
  onRegistrar: () => void
  onEditar: (i: Imovel) => void
  onExcluir: (i: Imovel) => void
  onMarcarVendidoAlugado: (i: Imovel) => void
  onFoto: (url: string) => void
  // BUG CORRIGIDO (pedido do usuário): ver comentário equivalente em
  // SidebarPets (CamadaPets.tsx).
  aoExigirLogin: () => void
  isMobile: boolean
  aoIniciarArraste: (e: React.TouchEvent) => void
  aoArrastar: (e: React.TouchEvent) => void
  aoSoltarArraste: () => void
  onCentralizar: (lat: number, lng: number) => void
}) {
  const { user, perfil } = useAuth()
  const visiveis = imoveis.filter(i => !filtro || i.finalidade === filtro)

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
          {/* Badge: finalidade + tipo (pedido do usuário só cita "tipo", mas
              a finalidade some da tela se não aparecer em algum lugar —
              combinada na mesma badge, mesmo padrão do popup do pin). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconeImovel size={15} cor="#4256c8" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4256c8', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {ROTULO_FINALIDADE[selecionado.finalidade]} · {ROTULO_TIPO_IMOVEL[selecionado.tipo]}
            </span>
          </div>

          {/* Protocolo — mesmo padrão unificado das outras 3 camadas. */}
          {selecionado.protocolo && (
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
              Protocolo: <strong style={{ color: '#111827' }}>{selecionado.protocolo}</strong>
            </p>
          )}

          {/* Fotos (galeria) */}
          {selecionado.fotos?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: selecionado.fotos.length > 1 ? '1fr 1fr' : '1fr', gap: '5px' }}>
              {selecionado.fotos.map((f, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={f} alt={`Foto ${i + 1}`} onClick={() => onFoto(f)}
                  style={{ width: '100%', height: selecionado.fotos.length > 1 ? '78px' : '150px', objectFit: 'cover', borderRadius: '6px', cursor: 'zoom-in', display: 'block' }} />
              ))}
            </div>
          )}

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <p style={rotuloEstilo}>Descrição</p>
              <p style={valorEstilo}>{sentenceCase(selecionado.descricao)}</p>
            </div>
            <div>
              <p style={rotuloEstilo}>Valor</p>
              <p style={valorEstilo}>{formatarValor(selecionado.valor)}{selecionado.finalidade === 'aluguel' && selecionado.valor != null ? ' /mês' : ''}</p>
            </div>
            {selecionado.endereco_label && (
              <div>
                <p style={rotuloEstilo}>Endereço</p>
                <p style={valorEstilo}>{titleCase(selecionado.endereco_label)}</p>
              </div>
            )}
            <div>
              <p style={rotuloEstilo}>Contato</p>
              <a href={linkWhatsapp(selecionado.contato)} target="_blank" rel="noopener noreferrer" style={botaoWhatsapp}>
                <IconeWhatsapp />
                Chamar no WhatsApp
              </a>
            </div>
          </div>

          {/* Ações — mesmo padrão B10-3 de Pets/Classificados/Empregos: dono
              vê excluir, master vê editar, "marcar vendido/alugado" só o
              dono (mesma regra de "Marcar como vendido" em Classificados).
              BUG EVITADO (decisão confirmada com o usuário): marcar aqui
              EXCLUI o registro de verdade (linha + fotos), sem deixar
              rastro — não é uma flag como em Classificados/Empregos. */}
          {(meu || ehMaster) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {meu && (
                <button onClick={() => onMarcarVendidoAlugado(selecionado)} style={{ ...botaoAcao, color: '#166534', fontWeight: 600 }}>
                  {selecionado.finalidade === 'aluguel' ? 'Marcar como alugado' : 'Marcar como vendido'}
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: ehMaster && meu ? '1fr 1fr' : '1fr', gap: '6px' }}>
                {ehMaster && <button onClick={() => onEditar(selecionado)} style={{ ...botaoAcao, color: '#4256c8' }}>Editar</button>}
                {meu && <button onClick={() => onExcluir(selecionado)} style={{ ...botaoAcao, color: '#dc2626' }}>Excluir</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '8px 14px 8px' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Imóveis</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px', lineHeight: 1.5 }}>
          Casas, apartamentos, terrenos e outros imóveis para alugar ou vender em Frutal-MG.
        </p>

        <button onClick={onRegistrar}
          style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' }}>
          {user ? 'Anunciar imóvel' : 'Entrar para anunciar'}
        </button>

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Finalidade</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box' }}>
          <option value=''>Todos</option>
          <option value='aluguel'>{ROTULO_FINALIDADE.aluguel}</option>
          <option value='venda'>{ROTULO_FINALIDADE.venda}</option>
        </select>
      </div>

      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '6px 14px', borderTop: '1px solid #f9fafb' }}
      >
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {visiveis.length} imóve{visiveis.length !== 1 ? 'is' : 'l'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 14px 12px' }}>
        {visiveis.map((i) => (
          <div
            key={i.id}
            onClick={() => { if (!user) { aoExigirLogin(); return } setSelecionado(i); if (!isMobile) onCentralizar(i.lat, i.lng) }}
            style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}
          >
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', margin: '0 0 2px', lineHeight: 1.4 }}>{ROTULO_FINALIDADE[i.finalidade]}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px', lineHeight: 1.4 }}>{ROTULO_TIPO_IMOVEL[i.tipo]}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700, margin: '0 0 2px' }}>{formatarValor(i.valor)}</p>
            {i.endereco_label && <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{titleCase(i.endereco_label)}</p>}
          </div>
        ))}
      </div>
    </>
  )
}


/* ============================================================ formulário = */

export { FormImovel as FormularioImovel } from './FormImovel'
