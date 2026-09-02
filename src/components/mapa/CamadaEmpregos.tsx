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
  return str.charAt(0).toUpperCase() + str.slice(1)
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
  ativo, empregos, config, filtro, mapaObj, maplibreObj, mapaCarregado, aoSelecionar,
}: {
  ativo: boolean
  empregos: Emprego[]
  config: CamadaConfig | null
  filtro: string
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
    const visiveis = empregos.filter(e => !filtro || e.contrato === filtro)
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
          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(e.cargo)}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${escapeHtml(e.empresa_nome)}</p>
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
  }, [ativo, empregos, config, filtro, mapaCarregado]) // eslint-disable-line react-hooks/exhaustive-deps
}

/* =============================================================== sidebar = */

const rotuloEstilo: React.CSSProperties = { fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 2px' }
const valorEstilo: React.CSSProperties = { fontSize: '13px', color: '#111827', margin: 0, lineHeight: 1.5 }
const botaoAcao: React.CSSProperties = { fontSize: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 500, width: '100%' }

export function SidebarEmpregos({
  empregos, filtro, setFiltro, selecionado, setSelecionado,
  onPublicar, onEditar, onExcluir, onEncerrar,
  isMobile, aoIniciarArraste, aoArrastar, aoSoltarArraste, onCentralizar,
}: {
  empregos: Emprego[]
  filtro: string
  setFiltro: (f: string) => void
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
  const visiveis = empregos.filter(e => !filtro || e.contrato === filtro)

  if (selecionado) {
    const minha = user?.id === selecionado.user_id
    return (
      <div key={selecionado.id} className="demanda-detalhe-anim" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f9fafb', flexShrink: 0 }}>
          <button onClick={() => setSelecionado(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4256c8', padding: 0 }}>
            ← Voltar
          </button>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.25 }}>{selecionado.cargo}</h3>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{selecionado.empresa_nome}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '3px 10px', background: '#f9fafb', color: '#0891b2' }}>
              {ROTULO_CONTRATO[selecionado.contrato]}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>{formatarSalario(selecionado)}</span>
            {selecionado.vagas > 1 && (
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{selecionado.vagas} vagas</span>
            )}
          </div>

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selecionado.area && (
              <div><p style={rotuloEstilo}>Área</p><p style={valorEstilo}>{selecionado.area}</p></div>
            )}
            <div>
              <p style={rotuloEstilo}>Descrição</p>
              <p style={valorEstilo}>{sentenceCase(selecionado.descricao)}</p>
            </div>
            {selecionado.requisitos && (
              <div><p style={rotuloEstilo}>Requisitos</p><p style={valorEstilo}>{sentenceCase(selecionado.requisitos)}</p></div>
            )}
            {selecionado.endereco_label && (
              <div><p style={rotuloEstilo}>Local</p><p style={valorEstilo}>{selecionado.endereco_label}</p></div>
            )}
            <div>
              <p style={rotuloEstilo}>Candidatar-se</p>
              <p style={valorEstilo}>{selecionado.contato}</p>
            </div>
          </div>

          {minha && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button onClick={() => onEncerrar(selecionado)} style={{ ...botaoAcao, color: '#92400e', fontWeight: 600 }}>
                Encerrar vaga
              </button>
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
      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '8px 14px 12px' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>Empregos</h2>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
          Vagas abertas nas empresas de Frutal-MG, no endereço de cada uma.
        </p>

        {/* Empresas e master publicam; cidadão apenas consulta */}
        {podePublicar && (
          <button onClick={onPublicar}
            style={{ width: '100%', backgroundColor: '#4256c8', color: 'white', fontWeight: 600, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
            Publicar vaga
          </button>
        )}

        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Tipo de contrato</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', fontSize: '13px', fontWeight: 500, color: '#111827', background: 'white', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 28px 8px 10px', cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', boxSizing: 'border-box', marginBottom: '16px' }}>
          <option value=''>Todos</option>
          {CONTRATOS.map(c => (
            <option key={c} value={c}>{ROTULO_CONTRATO[c]}</option>
          ))}
        </select>
      </div>

      <div
        onTouchStart={isMobile ? aoIniciarArraste : undefined}
        onTouchMove={isMobile ? aoArrastar : undefined}
        onTouchEnd={isMobile ? aoSoltarArraste : undefined}
        style={{ flexShrink: 0, touchAction: isMobile ? 'none' : undefined, padding: '10px 14px', borderTop: '1px solid #f9fafb' }}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: COR_PADRAO, background: `${COR_PADRAO}18`, borderRadius: '20px', padding: '2px 8px' }}>
                {ROTULO_CONTRATO[e.contrato]}
              </span>
              {e.encerrada && <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#6b7280' }}>Encerrada</span>}
            </div>
            <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', margin: '0 0 2px', lineHeight: 1.4 }}>{e.cargo}</p>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px' }}>{e.empresa_nome}</p>
            <p style={{ fontSize: '11px', color: '#166534', fontWeight: 600, margin: 0 }}>{formatarSalario(e)}</p>
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
