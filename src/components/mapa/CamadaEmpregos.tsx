'use client'

import { useEffect, useState, useRef } from 'react'
import type { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Emprego, TipoContrato, CamadaConfig } from '@/types'
import { salvarCamada } from './salvarCamada'
import { escapeHtml } from '@/lib/escapeHtml'
import { linkWhatsapp } from '@/lib/mascaraTelefone'

/* ------------------------------------------------------------- ícones --- */

const PATH_MALA = 'M20 7h-4V5.5A2.5 2.5 0 0 0 13.5 3h-3A2.5 2.5 0 0 0 8 5.5V7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM10 5.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V7h-4V5.5ZM2 12h20'

function IconeVaga({ size = 18, cor = 'currentColor' }: { size?: number; cor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATH_MALA} />
    </svg>
  )
}

/* ------------------------------------------------------------ helpers --- */

const COR_PADRAO = '#0891b2'
const CHAVE_VAGA = 'emprego_vaga'

export const ROTULO_CONTRATO: Record<TipoContrato, string> = {
  clt: 'CLT',
  pj: 'PJ',
  temporario: 'Temporário',
  estagio: 'Estágio',
  freelance: 'Freelance',
}

const CONTRATOS: TipoContrato[] = ['clt', 'pj', 'temporario', 'estagio', 'freelance']

function formatarSalario(e: Emprego) {
  if (e.salario_a_combinar || e.salario == null) return 'A combinar'
  return e.salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Endereço é nome próprio — cada palavra com inicial maiúscula, não só a
// primeira. Mesmo helper duplicado em CamadaPets.tsx/CamadaClassificados.tsx.
function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().split(' ').map((w) => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

/* ================================================================= dados = */

export function useEmpregos() {
  const supabase = createClient()
  const [empregos, setEmpregos] = useState<Emprego[]>([])
  const [config, setConfig] = useState<CamadaConfig | null>(null)

  async function recarregar() {
    const { data } = await supabase
      .from('empregos')
      .select('*')
      .eq('oculto', false)
      .eq('encerrada', false)
      .order('created_at', { ascending: false })
    setEmpregos((data || []) as Emprego[])
  }

  useEffect(() => {
    supabase
      .from('empregos')
      .select('*')
      .eq('oculto', false)
      .eq('encerrada', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEmpregos((data || []) as Emprego[]))
    supabase.from('camadas_config').select('*').eq('chave', CHAVE_VAGA).maybeSingle()
      .then(({ data }) => { if (data) setConfig(data as CamadaConfig) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { empregos, config, recarregar }
}

/* =============================================================== markers = */

export function useMarkersEmpregos({
  ativo, empregos, config, mapaObj, maplibreObj, mapaCarregado, aoSelecionar,
}: {
  ativo: boolean
  empregos: Emprego[]
  config: CamadaConfig | null
  mapaObj: React.MutableRefObject<MapLibreMap | null>
  maplibreObj: React.MutableRefObject<typeof import('maplibre-gl') | null>
  mapaCarregado: boolean
  aoSelecionar: (e: Emprego) => void
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

    const cor = config?.cor || COR_PADRAO
    const visiveis = empregos
    const porId = new Map(visiveis.map(e => [e.id, e]))

    visiveis.forEach((e) => {
      const miolo = e.logo_url
        ? `<img src="${escapeHtml(e.logo_url)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${PATH_MALA}"/></svg>`

      const el = document.createElement('div')
      el.className = 'pin-emprego'
      el.style.filter = 'drop-shadow(0 2px 5px rgba(0,0,0,.35))'
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;background:${cor};display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${miolo}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
      </div>`

      const popup = new maplibregl.Popup({ maxWidth: '260px', closeButton: true }).setHTML(`
        <div style="min-width:200px;max-width:230px;font-family:Inter,sans-serif;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.03em;">${ROTULO_CONTRATO[e.contrato]}</p>
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(sentenceCase(e.cargo))}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${escapeHtml(sentenceCase(e.empresa_nome))}</p>
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#166534;">${formatarSalario(e)}</p>
          <button class="ver-emprego-btn" data-ver-emprego="${e.id}" style="background:none;border:none;padding:0;display:flex;align-items:center;gap:4px;color:#4256c8;font-size:13px;font-weight:600;cursor:pointer;">
            Ver vaga
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4256c8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `)
      popup.on('open', () => { popupAbertoRef.current = popup })
      popup.on('close', () => { if (popupAbertoRef.current === popup) popupAbertoRef.current = null })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([e.lng, e.lat])
        .setPopup(popup)
        .addTo(mapa)

      markersRef.current.push(marker)
    })

    const container = mapa.getContainer()
    function aoClicar(ev: MouseEvent) {
      const alvo = (ev.target as HTMLElement).closest('.ver-emprego-btn') as HTMLElement | null
      if (!alvo) return
      const vaga = porId.get(alvo.getAttribute('data-ver-emprego') || '')
      if (!vaga) return
      popupAbertoRef.current?.remove()
      aoSelecionar(vaga)
    }
    container.addEventListener('click', aoClicar)
    return () => { container.removeEventListener('click', aoClicar) }
  }, [ativo, empregos, config, mapaCarregado]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* =============================================================== sidebar = */

const rotuloEstilo: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }
const valorEstilo: React.CSSProperties = { fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }
const botaoAcao: React.CSSProperties = { fontSize: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 500, width: '100%' }

// Botão de contato via WhatsApp — mesmo ícone/estilo que CamadaPets.tsx e
// CamadaClassificados.tsx (ver comentário lá sobre não haver módulo de
// ícones compartilhado neste projeto).
const botaoWhatsapp: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '2px', background: '#25d366', color: 'white', fontSize: '12.5px', fontWeight: 600, padding: '8px 14px', borderRadius: '20px', textDecoration: 'none', border: 'none', cursor: 'pointer', width: 'fit-content' }
function IconeWhatsapp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function SidebarEmpregos({
  empregos, selecionado, setSelecionado,
  onPublicar, onEditar, onExcluir, onEncerrar,
  isMobile, aoIniciarArraste, aoArrastar, aoSoltarArraste, onCentralizar,
}: {
  empregos: Emprego[]
  selecionado: Emprego | null
  setSelecionado: (e: Emprego | null) => void
  onPublicar: () => void
  onEditar: (e: Emprego) => void
  onExcluir: (e: Emprego) => void
  onEncerrar: (e: Emprego) => void
  // Ver comentário equivalente em SidebarPets (CamadaPets.tsx).
  isMobile: boolean
  aoIniciarArraste: (e: React.TouchEvent) => void
  aoArrastar: (e: React.TouchEvent) => void
  aoSoltarArraste: () => void
  onCentralizar: (lat: number, lng: number) => void
}) {
  const { user, perfil } = useAuth()
  // Master publica em nome da administração; fora isso, só contas de empresa
  const podePublicar = perfil?.role === 'empresa' || perfil?.role === 'master'
  // BUG CORRIGIDO (pedido do usuário): vagas não são mais filtradas/
  // categorizadas por tipo de contrato — lista sempre mostra todas.
  const visiveis = empregos

  if (selecionado) {
    const minha = user?.id === selecionado.user_id
    // BUG CORRIGIDO (B10-3, decisão confirmada com o usuário, achado ao
    // padronizar os 4 cards de detalhe): faltava o `ehMaster` que
    // CamadaPets.tsx/CamadaClassificados.tsx já têm — o master só
    // conseguia editar as próprias vagas, sem nenhum caminho pra corrigir
    // a vaga de outra empresa (nem no mapa, nem no painel).
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
          {/* Padrão unificado (pedido do usuário): sem badge de categoria
              aqui (vagas não são mais categorizadas por tipo de contrato) →
              protocolo → "foto" (só o quadradinho pequeno que já existia,
              não vira foto grande) → resto → ações. */}
          {selecionado.protocolo && (
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
              Protocolo: <strong style={{ color: '#111827' }}>{selecionado.protocolo}</strong>
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            {selecionado.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={selecionado.logo_url} alt={selecionado.empresa_nome}
                style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
            ) : (
              <span style={{ display: 'grid', placeItems: 'center', width: '38px', height: '38px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                <IconeVaga size={18} cor="#6b7280" />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.25 }}>{sentenceCase(selecionado.cargo)}</h3>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{sentenceCase(selecionado.empresa_nome)}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>{formatarSalario(selecionado)}</span>
            {selecionado.vagas > 1 && (
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{selecionado.vagas} vagas</span>
            )}
          </div>

          {/* BUG CORRIGIDO (pedido do usuário): "Área" removida. */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <p style={rotuloEstilo}>Descrição</p>
              <p style={valorEstilo}>{sentenceCase(selecionado.descricao)}</p>
            </div>
            {selecionado.requisitos && (
              <div><p style={rotuloEstilo}>Requisitos</p><p style={valorEstilo}>{sentenceCase(selecionado.requisitos)}</p></div>
            )}
            {selecionado.endereco_label && (
              <div><p style={rotuloEstilo}>Local</p><p style={valorEstilo}>{titleCase(selecionado.endereco_label)}</p></div>
            )}
            <div>
              <p style={rotuloEstilo}>Candidatar-se</p>
              {/* BUG CORRIGIDO (pedido do usuário): contato era só texto —
                  vira link direto pro WhatsApp (wa.me). */}
              <a href={linkWhatsapp(selecionado.contato)} target="_blank" rel="noopener noreferrer" style={botaoWhatsapp}>
                <IconeWhatsapp />
                Chamar no WhatsApp
              </a>
            </div>
          </div>

          {(minha || ehMaster) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {minha && (
                <button onClick={() => onEncerrar(selecionado)} style={{ ...botaoAcao, color: '#92400e', fontWeight: 600 }}>
                  Encerrar vaga
                </button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: ehMaster && minha ? '1fr 1fr' : '1fr', gap: '6px' }}>
                {ehMaster && <button onClick={() => onEditar(selecionado)} style={{ ...botaoAcao, color: '#4256c8' }}>Editar</button>}
                {minha && <button onClick={() => onExcluir(selecionado)} style={{ ...botaoAcao, color: '#dc2626' }}>Excluir</button>}
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
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Vagas de Empregos</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Vagas abertas nas empresas de Frutal-MG. O pin corresponde a localização.
        </p>

        {/* BUG CORRIGIDO (pedido do usuário): removido o filtro "Tipo de
            contrato" (dropdown) — vagas de emprego não são mais
            categorizadas/filtradas por tipo de contrato na listagem nem
            no card de detalhe. */}
        {/* Empresas e master publicam; cidadão apenas consulta */}
        {podePublicar && (
          <button onClick={onPublicar}
            style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
            Publicar vaga
          </button>
        )}
      </div>

      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '6px 14px', borderTop: '1px solid #f9fafb' }}
      >
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {visiveis.length} vaga{visiveis.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 14px 12px' }}>
        {visiveis.map((e) => (
          <div
            key={e.id}
            onClick={() => { setSelecionado(e); if (!isMobile) onCentralizar(e.lat, e.lng) }}
            style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' }}
          >
            {/* BUG CORRIGIDO (pedido do usuário): badge "Encerrada" removido
                — `visiveis` vem de `empregos`, que a consulta em
                `useEmpregos` já filtra por `encerrada=false`/`oculto=false`,
                então uma vaga encerrada ou excluída nunca chega a aparecer
                aqui (nem no mapa, nem na lista) — o badge nunca disparava
                na prática. Card simplificado ao pedido exato: cargo +
                empresa + salário, mesmo padrão de Classificados. */}
            <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', margin: '0 0 2px', lineHeight: 1.4 }}>{sentenceCase(e.cargo)}</p>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px' }}>{sentenceCase(e.empresa_nome)}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700, margin: 0 }}>{formatarSalario(e)}</p>
          </div>
        ))}
      </div>
    </>
  )
}

/* ============================================================ formulário = */

const rotuloCampo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }
const campoEstilo: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }

export function FormularioEmprego({
  editando, aoFechar, aoSalvar,
}: {
  editando: Emprego | null
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const supabase = createClient()
  const { user, perfil } = useAuth()

  const [empresaNome, setEmpresaNome] = useState(editando?.empresa_nome ?? perfil?.nome ?? '')
  const [cargo, setCargo] = useState(editando?.cargo ?? '')
  const [area, setArea] = useState(editando?.area ?? '')
  const [contrato, setContrato] = useState<TipoContrato>(editando?.contrato ?? 'clt')
  const [salario, setSalario] = useState(editando?.salario?.toString() ?? '')
  const [aCombinar, setACombinar] = useState(editando?.salario_a_combinar ?? true)
  const [vagas, setVagas] = useState(editando?.vagas?.toString() ?? '1')
  const [descricao, setDescricao] = useState(editando?.descricao ?? '')
  const [requisitos, setRequisitos] = useState(editando?.requisitos ?? '')
  const [contato, setContato] = useState(editando?.contato ?? '')
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(
    editando ? { lat: editando.lat, lng: editando.lng, label: editando.endereco_label ?? '' } : null
  )
  const [locConfirmada, setLocConfirmada] = useState(!!editando)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [protocolo, setProtocolo] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (!user) return
    if (perfil?.role !== 'empresa' && perfil?.role !== 'master') {
      setErro('Só contas de empresa podem publicar vagas.'); return
    }
    if (!empresaNome.trim()) { setErro('Informe o nome da empresa.'); return }
    if (!cargo.trim()) { setErro('Informe o cargo da vaga.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva melhor a vaga.'); return }
    if (!contato.trim()) { setErro('Informe como o candidato deve se candidatar.'); return }
    if (!aCombinar && !salario.trim()) { setErro('Informe o salário ou marque "Salário a combinar".'); return }
    if (!coordenadas || !locConfirmada) { setErro('Confirme o endereço da empresa no mapa.'); return }
    if (!editando && !turnstileToken) { setErro('Aguarde a verificação de segurança concluir.'); return }
    setEnviando(true)

    const registro = {
      user_id: user.id,
      empresa_nome: empresaNome.trim(),
      cargo: cargo.trim(),
      area: area.trim() || null,
      contrato,
      salario: aCombinar || !salario ? null : Number(salario),
      salario_a_combinar: aCombinar,
      vagas: Math.max(1, Number(vagas) || 1),
      descricao: descricao.trim(),
      requisitos: requisitos.trim() || null,
      lat: coordenadas.lat,
      lng: coordenadas.lng,
      endereco_label: coordenadas.label,
      contato: contato.trim(),
    }

    const { erro, protocolo: prot } = await salvarCamada({ camada: 'empregos', editando, dados: registro, turnstileToken, supabase })

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
            {editando ? 'Editar vaga' : 'Publicar uma vaga'}
          </h2>
          <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Vaga publicada!</p>
            {protocolo && (
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
                Protocolo: <span style={{ color: '#4256c8' }}>{protocolo}</span>
              </p>
            )}
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Ela já aparece no mapa, no endereço da empresa.
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
                  <label style={rotuloCampo}>Empresa *</label>
                  <input value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} placeholder="Nome da empresa" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>Cargo *</label>
                  <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Auxiliar de produção" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>Área</label>
                  <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Administrativo" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>Tipo de contrato *</label>
                  <select value={contrato} onChange={e => setContrato(e.target.value as TipoContrato)} style={campoEstilo}>
                    {CONTRATOS.map(c => <option key={c} value={c}>{ROTULO_CONTRATO[c]}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '10px' }}>
                  <div>
                    <label style={rotuloCampo}>Salário (R$)</label>
                    <input value={salario} disabled={aCombinar}
                      onChange={(e) => setSalario(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric" placeholder="2000"
                      style={{ ...campoEstilo, background: aCombinar ? '#f9fafb' : 'white', color: aCombinar ? '#9ca3af' : '#111827' }} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Vagas</label>
                    <input value={vagas} onChange={(e) => setVagas(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={campoEstilo} />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aCombinar} onChange={(e) => setACombinar(e.target.checked)}
                    style={{ accentColor: '#4256c8', width: '15px', height: '15px' }} />
                  Salário a combinar
                </label>

                <div>
                  <label style={rotuloCampo}>Endereço da empresa *</label>
                  <MiniMapaConfirmar
                    onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                    onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                  />
                </div>
              </div>

              {/* Coluna direita */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <label style={rotuloCampo}>Descrição da vaga *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Atividades, jornada, benefícios..."
                    style={{ ...campoEstilo, flex: 1, minHeight: '90px', resize: 'none' }} />
                </div>

                <div>
                  <label style={rotuloCampo}>Requisitos</label>
                  <textarea value={requisitos} onChange={(e) => setRequisitos(e.target.value)}
                    placeholder="Escolaridade, experiência, CNH..."
                    style={{ ...campoEstilo, minHeight: '70px', resize: 'none' }} />
                </div>

                <div>
                  <label style={rotuloCampo}>Como se candidatar *</label>
                  <input value={contato} onChange={(e) => setContato(e.target.value)}
                    placeholder="WhatsApp, e-mail ou endereço" style={campoEstilo} />
                </div>

                {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

                <button type="submit" disabled={enviando}
                  style={{ marginTop: 'auto', backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Publicar vaga'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
