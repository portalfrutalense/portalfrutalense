'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { Classificado, TipoVeiculo, CamadaConfig } from '@/types'
import { salvarCamada } from './salvarCamada'

/* ------------------------------------------------------------- ícones --- */

/**
 * Silhuetas provisórias dos veículos. Assim que o ícone definitivo de cada
 * tipo for cadastrado em camadas_config.icone_url, ele passa a ser usado no
 * lugar destas — ver `svgPinVeiculo`.
 */
const PATH_VEICULO: Record<TipoVeiculo, string> = {
  carro: 'M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13m-14 0h14m-14 0v3.5m14-3.5v3.5M6.5 16.5h1m9 0h1M4 13h16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3Z',
  moto: 'M5.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-13-2.5h5l3-5.5h3m-6 0h-3m9 0 2.5 5.5M14 7h3',
  caminhonete: 'M3 14l1-4h6V7h4.2a2 2 0 0 1 1.7 1l2.1 3H21v3M3 14h18M3 14v2.5h18V14M7 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  caminhao: 'M2 15V7h11v8M13 10h4.5l2.5 3v2M2 15h18M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
}

export const ROTULO_VEICULO: Record<TipoVeiculo, string> = {
  carro: 'Carro',
  moto: 'Moto',
  caminhonete: 'Caminhonete',
  caminhao: 'Caminhão',
}

const TIPOS: TipoVeiculo[] = ['carro', 'moto', 'caminhonete', 'caminhao']

function IconeVeiculo({ tipo, size = 18, cor = 'currentColor' }: { tipo: TipoVeiculo; size?: number; cor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATH_VEICULO[tipo]} />
    </svg>
  )
}

/** Miolo do pin: ícone cadastrado no painel quando houver, senão a silhueta padrão. */
function svgPinVeiculo(tipo: TipoVeiculo, iconeUrl: string | undefined, cor: string) {
  if (iconeUrl) {
    return `<img src="${iconeUrl}" style="width:19px;height:19px;object-fit:contain;" />`
  }
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${PATH_VEICULO[tipo]}"/></svg>`
}

/* ------------------------------------------------------------ helpers --- */

export function chaveVeiculo(c: Classificado) {
  return `classificado_${c.tipo_veiculo}`
}

const COR_PADRAO = '#ffffff'

/** Deslocamento aleatório de ~150–300 m, para o endereço exato nunca ser publicado. */
function aproximarCoordenada(lat: number, lng: number) {
  const raio = 150 + Math.random() * 150      // metros
  const angulo = Math.random() * 2 * Math.PI
  const dLat = (raio * Math.cos(angulo)) / 111_320
  const dLng = (raio * Math.sin(angulo)) / (111_320 * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

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

function escapeHtml(s?: string) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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

const MAX_FOTOS = 4

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
      .order('created_at', { ascending: false })
    setClassificados((data || []) as Classificado[])
  }

  useEffect(() => {
    recarregar()
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
  ativo, classificados, config, filtro, mapaObj, leafletObj, mapaCarregado, aoSelecionar,
}: {
  ativo: boolean
  classificados: Classificado[]
  config: Record<string, CamadaConfig>
  filtro: string
  mapaObj: React.MutableRefObject<any>
  leafletObj: React.MutableRefObject<any>
  mapaCarregado: boolean
  aoSelecionar: (c: Classificado) => void
}) {
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!mapaCarregado || !mapaObj.current || !leafletObj.current) return
    const L = leafletObj.current
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

      const icon = L.divIcon({
        className: 'pin-classificado',
        html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))">
          <div style="width:32px;height:32px;border-radius:50%;border:2px solid white;background:${fundo};display:flex;align-items:center;justify-content:center;">
            ${svgPinVeiculo(c.tipo_veiculo, cfg?.icone_url, traco)}
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid white;margin-top:-1px;"></div>
        </div>`,
        iconSize: [32, 41], iconAnchor: [16, 41],
      })

      const marker = L.marker([c.lat, c.lng], { icon }).addTo(mapa)
      marker.bindPopup(`
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
      `, { maxWidth: 260, closeButton: true })

      markersRef.current.push(marker)
    })

    const container = mapa.getContainer()
    function aoClicar(e: MouseEvent) {
      const alvo = (e.target as HTMLElement).closest('.ver-classificado-btn') as HTMLElement | null
      if (!alvo) return
      const item = porId.get(alvo.getAttribute('data-ver-classificado') || '')
      if (!item) return
      mapa.closePopup()
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
  classificados, config, filtro, setFiltro, selecionado, setSelecionado,
  onRegistrar, onEditar, onExcluir, onMarcarVendido, onFoto,
}: {
  classificados: Classificado[]
  config: Record<string, CamadaConfig>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px 12px' }}>
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
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '8px 10px', fontSize: '13px', background: 'white', color: '#111827', outline: 'none', cursor: 'pointer' }}>
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

const rotuloCampo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }
const campoEstilo: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box' }

export function FormularioClassificado({
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
  // Upload antecipado: cada foto sobe imediatamente ao ser selecionada
  const uploadPromises = useRef<Promise<string | null>[]>([])
  const [uploadandoFotos, setUploadandoFotos] = useState(0) // quantas ainda estão subindo
  const [erroFoto, setErroFoto] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  function aoEscolherFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    if (!arquivos.length) return
    const espaco = MAX_FOTOS - previews.length
    const aceitos = arquivos.slice(0, Math.max(0, espaco))
    setErroFoto('')
    aceitos.forEach(file => {
      // Preview imediato
      const reader = new FileReader()
      reader.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
      // Upload em background
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
    // Remove a promise correspondente à foto nova (deslocando pelo nº de fotos já publicadas)
    const jaPublicadas = editando?.fotos?.length ?? 0
    if (i >= jaPublicadas) {
      const idxNova = i - jaPublicadas
      uploadPromises.current.splice(idxNova, 1)
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro('')
    if (!user) return
    if (!titulo.trim()) { setErro('Dê um título ao anúncio.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { setErro('Descreva melhor o veículo.'); return }
    if (!contato.trim()) { setErro('Informe um contato.'); return }
    if (!coordenadas || !locConfirmada) { setErro('Confirme a região no mapa.'); return }
    if (!editando && !turnstileToken) { setErro('Aguarde a verificação de segurança concluir.'); return }
    setEnviando(true)

    // Fotos já publicadas (urls reais) + aguarda as novas terminarem o upload
    const urls: string[] = previews.filter(p => !p.startsWith('data:'))
    if (uploadPromises.current.length > 0) {
      const resultados = await Promise.all(uploadPromises.current)
      for (const url of resultados) {
        if (url === null) { setErro(erroFoto || 'Erro ao enviar uma das fotos.'); setEnviando(false); return }
        urls.push(url)
      }
    }
    if (urls.length < 2) { setErro('Adicione ao menos 2 fotos do veículo.'); setEnviando(false); return }

    // Ao editar, a coordenada aprovada já está aproximada — não desloca de novo
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

    const { erro, id } = await salvarCamada({ camada: 'classificados', editando, dados: registro, turnstileToken, supabase })

    setEnviando(false)
    if (erro) { setErro(erro); return }
    if (editando) { aoSalvar(); aoFechar(); return }

    setSucesso(true)
    aoSalvar()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>
            {editando ? 'Editar anúncio' : 'Anunciar um veículo'}
          </h2>
          <button onClick={aoFechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Anúncio publicado!</p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Ele já aparece no mapa com a localização aproximada.
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
                  <label style={rotuloCampo}>Tipo de veículo *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {TIPOS.map(t => (
                      <button key={t} type="button" onClick={() => setTipoVeiculo(t)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '9px', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px',
                          fontWeight: tipoVeiculo === t ? 600 : 500,
                          background: tipoVeiculo === t ? '#eff6ff' : 'white',
                          border: `1px solid ${tipoVeiculo === t ? '#4256c8' : '#e5e7eb'}`, color: '#111827',
                        }}>
                        <IconeVeiculo tipo={t} size={16} cor={tipoVeiculo === t ? '#4256c8' : '#6b7280'} />
                        {ROTULO_VEICULO[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={rotuloCampo}>Título do anúncio *</label>
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Gol 1.0 completo" style={campoEstilo} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={rotuloCampo}>Marca</label>
                    <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Volkswagen" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Modelo</label>
                    <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Gol" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Ano</label>
                    <input value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} placeholder="2018" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Quilometragem</label>
                    <input value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="85000" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Cor</label>
                    <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Prata" style={campoEstilo} />
                  </div>
                  <div>
                    <label style={rotuloCampo}>Preço (R$)</label>
                    <input value={preco} onChange={(e) => setPreco(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="45000" style={campoEstilo} />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', cursor: 'pointer' }}>
                  <input type="checkbox" checked={aceitaTroca} onChange={(e) => setAceitaTroca(e.target.checked)}
                    style={{ accentColor: '#4256c8', width: '15px', height: '15px' }} />
                  Aceito troca
                </label>

                <div>
                  <label style={rotuloCampo}>Região aproximada *</label>
                  <MiniMapaConfirmar
                    onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true); if (!bairro) setBairro(endereco) }}
                    onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                  />
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '5px 0 0', lineHeight: 1.45 }}>
                    O pin é publicado deslocado alguns metros — ninguém vê seu endereço exato.
                  </p>
                </div>
              </div>

              {/* Coluna direita */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <label style={rotuloCampo}>Descrição *</label>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Estado de conservação, itens, documentação, motivo da venda..."
                    style={{ ...campoEstilo, flex: 1, minHeight: '90px', resize: 'none' }} />
                </div>

                <div>
                  <label style={rotuloCampo}>Bairro exibido</label>
                  <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>Contato *</label>
                  <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="WhatsApp ou telefone" style={campoEstilo} />
                </div>

                <div>
                  <label style={rotuloCampo}>Fotos <span style={{ fontWeight: 400 }}>(até {MAX_FOTOS})</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {previews.map((p, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '7px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                        <button type="button" onClick={() => removerFoto(i)}
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px' }}>×</button>
                        {/* Indicador de upload em andamento para fotos data: (ainda subindo) */}
                        {p.startsWith('data:') && uploadandoFotos > 0 && (
                          <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', borderRadius: '3px', padding: '2px 6px' }}>⏫</div>
                        )}
                      </div>
                    ))}
                    {erroFoto && <p style={{ fontSize: '11px', color: '#dc2626', margin: '2px 0' }}>{erroFoto}</p>}
                    {previews.length < MAX_FOTOS && (
                      <label style={{ display: 'grid', placeItems: 'center', height: '80px', border: '2px dashed #e5e7eb', borderRadius: '7px', cursor: 'pointer', fontSize: '11.5px', color: '#4256c8', fontWeight: 600, textAlign: 'center', padding: '4px' }}>
                        <input type="file" accept="image/*" multiple onChange={aoEscolherFotos} style={{ display: 'none' }} />
                        + Adicionar
                      </label>
                    )}
                  </div>
                </div>

                {!editando && <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

                <button type="submit" disabled={enviando || uploadandoFotos > 0}
                  style={{ marginTop: 'auto', backgroundColor: (enviando || uploadandoFotos > 0) ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: (enviando || uploadandoFotos > 0) ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                  {enviando ? 'Salvando...' : uploadandoFotos > 0 ? 'Aguardando fotos...' : editando ? 'Salvar alterações' : 'Publicar anúncio'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
