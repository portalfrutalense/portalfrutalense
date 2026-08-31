'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

export const FRUTAL_LAT = -20.02752
export const FRUTAL_LNG = -48.92702

// Trocado de Mapbox pra Esri ArcGIS (2026-08-31) — mesma foto de satélite,
// mas com cota gratuita bem maior (2 milhões de tiles/mês contra 200 mil do
// Mapbox) e sem a restrição de cache que o Mapbox tem no contrato (tentamos
// cachear os tiles em storage próprio antes, e os termos do Mapbox proíbem
// isso explicitamente — não se aplica aqui, estamos só trocando de provedor,
// sem cache nenhum, uso ao vivo normal).
const ARCGIS_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY
// Endpoint real confirmado direto na API (não documentado com clareza nas
// páginas públicas) — atenção à ORDEM {z}/{y}/{x}, diferente do padrão
// {z}/{x}/{y} que Mapbox/OSM/MapLibre usam por convenção. O MapLibre só
// substitui os tokens {z}/{x}/{y} onde eles aparecerem na string, então
// escrever {y} antes de {x} aqui é o suficiente — nenhuma outra mudança de
// código é necessária pra essa inversão de ordem funcionar.
const TILE_SATELITE = `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`
// Esri serve 256px (confirmado no JSON do estilo, campo "tileSize"), não
// 512 como o Mapbox estava configurado antes. O MapLibre compensa sozinho
// (pede 1 zoom a mais por baixo dos panos pra manter densidade de pixel) —
// isso é automático, não precisa de ajuste manual nos zooms deste arquivo.
const TILE_SIZE = 256

// Nome de rua: diferente do Mapbox (que "assava" o texto dentro da própria
// imagem do tile), o Esri serve isso como uma camada vetorial separada
// (estradas + rótulos, ~230 sub-camadas), buscada à parte e sobreposta na
// foto de satélite — não uma variante alternativa do tile de imagem. Por
// decisão explícita (a Esri está desatualizada em nome de rua na região),
// essa camada fica visível só numa faixa estreita de zoom, não a partir de
// onde o mapa trava a rotação.
const ESRI_LABELS_STYLE_URL = `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery/labels?token=${ARCGIS_KEY}`
const ZOOM_LABELS_MIN = 16 // nome de rua visível só neste zoom (maxzoom do MapLibre é exclusivo: [16, 17) )
const ZOOM_LABELS_MAX = 17

// Calibrado pra bater com a escala visual do Leaflet, que o site sempre usou
// (confirmado comparando lado a lado: zoom "13" aqui = zoom "14" do Leaflet,
// "17" aqui = "18" lá) — MapLibre GL usa 512px como referência interna de
// zoom, o Leaflet usava 256px; a mesma cena que era "zoom N" no Leaflet vira
// "zoom N-1" no MapLibre. Todo valor de zoom deste arquivo é 1 a menos do
// que era na versão Leaflet, de propósito.
const ZOOM_SATELITE_RUAS = 16 // trava rotação/inclinação a partir deste zoom — mesmo zoom em que o nome de rua aparece (ZOOM_LABELS_MIN)
const PITCH_PADRAO = 70 // inclinação inicial e a que o mapa retoma ao sair da zona de ruas
const PITCH_MIN = 50 // faixa de inclinação livre por gesto, fora da zona de ruas
const PITCH_MAX = 70

// [oeste, sul], [leste, norte] — MapLibre usa [lng, lat], diferente do par
// [lat, lng] que o Leaflet usava aqui antes.
const LIMITES_FRUTAL: [[number, number], [number, number]] = [[-49.30, -20.1529], [-48.73, -19.8869]]

const FONTE_SATELITE = 'satelite'
const CAMADA_SATELITE = 'satelite-camada'

// Ease-in-out cúbica — mesma curva usada pelo easeTo do MapLibre por padrão em
// outros métodos, mas precisa ser passada explicitamente aqui porque a
// animação de pitch/bearing ao entrar/sair da zona de ruas soava "brusca" com
// a curva padrão do easeTo (praticamente linear) numa duração tão longa.
// Começa e termina devagar, acelera no meio — sensação de câmera suave, não
// de corte.
function suavizar(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Mapa MapLibre GL base, compartilhado por todas as camadas (demandas, pets,
 * classificados, empregos). O mapa é criado uma única vez: trocar de camada
 * apenas troca os markers, preservando posição, zoom e os tiles já baixados.
 *
 * O mapa é sempre satélite — a partir do zoom 16 entra a camada com nomes
 * de rua, e rotação/inclinação travam junto (mesmo zoom). Não há modo de
 * ruas puro nem alternância. Diferente do Leaflet (só
 * 2D), o MapLibre roda em WebGL com câmera 3D: inclinação (pitch) e rotação
 * (bearing) ficam livres para o usuário ajustar por gesto — arrastar com o
 * botão direito (ou Ctrl+arrastar) no desktop, girar/deslizar com dois dedos
 * no touch — sem nenhum controle extra de UI adicionado aqui.
 */
export function useMapaBase() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapaIniciado = useRef(false)
  const mapaObj = useRef<MapLibreMap | null>(null)
  const maplibreObj = useRef<typeof import('maplibre-gl') | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const containerWheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null)
  const zoomPassoRef = useRef<(direcao: 1 | -1) => void>(() => {})

  const [mapaCarregado, setMapaCarregado] = useState(false)

  useEffect(() => {
    if (!mapRef.current || mapaIniciado.current) return
    mapaIniciado.current = true

    // Dedupe — sem isso, cada montagem deste hook (ex.: navegar pra fora do
    // /mapa e voltar) empilhava uma nova tag <link> igual no <head>.
    if (!document.querySelector('link[data-maplibre-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
      link.setAttribute('data-maplibre-css', 'true')
      document.head.appendChild(link)
    }

    // Busca o estilo de rótulos (estradas + nome de rua) do Esri antes de
    // criar o mapa, pra já nascer com a camada pronta — em vez de montar o
    // mapa sem rótulo e adicionar depois (o que faria a camada aparecer com
    // um "pulo" visual). Se a busca falhar (rede instável, chave inválida),
    // o mapa segue só com o satélite, sem nome de rua — degrada graciosamente
    // em vez de quebrar o mapa inteiro.
    async function buscarCamadaDeRotulos(): Promise<{ sources: Record<string, unknown>; layers: unknown[]; glyphs?: string; sprite?: string } | null> {
      try {
        const resposta = await fetch(ESRI_LABELS_STYLE_URL)
        if (!resposta.ok) return null
        const estilo = await resposta.json()
        if (!estilo?.sources || !Array.isArray(estilo?.layers)) return null
        // Só queremos nome de rua — o estilo completo do Esri traz 230
        // camadas (água, ponto de interesse, fronteira administrativa,
        // prédio, cemitério, zoológico...), e a gente só precisa da metade
        // relacionada a estrada/rua. Reduz o trabalho de colisão de texto
        // que o MapLibre precisa fazer de uma vez (230 camadas simultâneas,
        // muita coisa que nunca seria mostrada de qualquer forma).
        const camadasDeRua = estilo.layers.filter((camada: Record<string, unknown>) =>
          /^Road(\/|$| tunnel)/.test(String(camada['source-layer'] || ''))
        )
        // Força a faixa de zoom em toda sub-camada de rua — sobrescreve o
        // que o Esri definiu originalmente (pensado pra aparecer bem mais
        // cedo, ex.: zoom 12+). Aqui a decisão é mostrar só na faixa
        // estreita configurada acima (só zoom 16, por decisão sua — a Esri
        // está desatualizada em nome de rua pra essa região).
        const layers = camadasDeRua.map((camada: Record<string, unknown>) => ({
          ...camada,
          minzoom: ZOOM_LABELS_MIN,
          maxzoom: ZOOM_LABELS_MAX,
        }))
        // CAUSA RAIZ DO BUG (2026-08-31): a fonte vetorial 'esri' vem com
        // dois jeitos de indicar onde buscar tile ao mesmo tempo — 'url'
        // (um endereço "resumo" do serviço, SEM token) e 'tiles' (a URL
        // completa, já com token, que já funciona). O MapLibre prioriza
        // 'url' quando os dois existem: busca esse endereço pra resolver um
        // manifesto TileJSON antes de pedir qualquer tile — e como não tem
        // token, o Esri devolve {"error":{"code":499,"message":"Token
        // Required."}} com status HTTP 200 (não 401/403). O MapLibre não
        // reconhece isso como falha (o status diz "sucesso"), tenta tratar
        // aquele JSON de erro como se fosse o manifesto de verdade, e fica
        // preso pra sempre — nunca chega a pedir um tile vetorial real, sem
        // nenhum erro visível. Sintoma: fonte fica "carregando" sem parar,
        // zero tile pedido de verdade, zero feature desenhado. Correção:
        // tirar 'url' de cada fonte, sobra só 'tiles' (com token), que o
        // MapLibre já sabe usar direto, sem precisar resolver nada.
        const sources = Object.fromEntries(
          Object.entries(estilo.sources as Record<string, Record<string, unknown>>).map(([nome, fonte]) => {
            const resto = { ...fonte }
            delete resto.url
            return [nome, resto]
          })
        )
        // O 'sprite' (folha de ícones) tinha ficado de fora do estilo
        // combinado — 185 das 230 camadas são do tipo 'symbol' e boa parte
        // referencia 'icon-image' junto com o texto. Sem o sprite, o
        // MapLibre não resolve o ícone (fica um aviso no console, mas o
        // texto da mesma camada continua renderizando normalmente).
        return { sources, layers, glyphs: estilo.glyphs, sprite: estilo.sprite }
      } catch {
        return null
      }
    }

    import('maplibre-gl').then(async (maplibregl) => {
      if (!mapRef.current) return

      const camadaDeRotulos = await buscarCamadaDeRotulos()
      if (!mapRef.current) return // pode ter desmontado durante o fetch

      const mapa = new maplibregl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {
            [FONTE_SATELITE]: {
              type: 'raster',
              tiles: [TILE_SATELITE],
              tileSize: TILE_SIZE,
              attribution: '© Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
            },
            ...(camadaDeRotulos?.sources ?? {}),
          },
          layers: [
            { id: CAMADA_SATELITE, type: 'raster', source: FONTE_SATELITE },
            ...((camadaDeRotulos?.layers ?? []) as never[]),
          ],
          ...(camadaDeRotulos?.glyphs ? { glyphs: camadaDeRotulos.glyphs } : {}),
          ...(camadaDeRotulos?.sprite ? { sprite: camadaDeRotulos.sprite } : {}),
        },
        center: [FRUTAL_LNG, FRUTAL_LAT],
        // Zoom inicial fracionário de propósito — enquadra melhor de cara do
        // que um valor inteiro daria. O primeiro scroll já "arruma" pro
        // inteiro mais próximo na direção rolada (ver zoomPassoRef, fórmula
        // piso/teto), e dali em diante segue sempre em inteiro normal.
        zoom: window.innerWidth < 768 ? 12.5 : 13.5,
        pitch: PITCH_PADRAO,
        // Fixo em [0, 65] — nunca muda em runtime. A faixa de 0 (zona de
        // ruas) até 65 (padrão) cobre tanto o travado quanto o livre; a
        // restrição inferior de 45° fora da zona de ruas é imposta à mão
        // (ver 'pitchend' abaixo), não por minPitch dinâmico. minPitch/
        // maxPitch mudando em runtime (tentativa anterior) causava clamp
        // instantâneo do pitch atual sempre que uma nova animação de
        // transição começava antes da anterior terminar — a fonte da
        // instabilidade "ora anima, ora não" relatada em teste.
        minPitch: 0,
        maxPitch: PITCH_MAX,
        minZoom: 12,
        maxZoom: 17,
        maxBounds: LIMITES_FRUTAL,
        attributionControl: false,
      })

      mapa.on('load', () => {
        mapaObj.current = mapa
        maplibreObj.current = maplibregl
        setMapaCarregado(true)
      })

      // Sem isso, uma falha de validação do estilo (ex.: a camada de nome de
      // rua do Esri tendo alguma incompatibilidade de sintaxe com a versão
      // do MapLibre) é rejeitada em silêncio pelo MapLibre — sem crash, sem
      // aviso nenhum, só a camada simplesmente não aparece.
      mapa.on('error', (e) => {
        console.error('[mapa] erro do MapLibre:', e.error?.message || e)
      })

      // Zona de ruas: entrar/sair trava e destrava rotação/inclinação, com
      // uma única animação de câmera que move zoom + inclinação (+ direção,
      // ao entrar) juntos — não duas fases (zoom assenta, só depois inclina)
      // como numa tentativa anterior, que ficava com a sensação de "travado
      // e só depois anima".
      let travadoNaZonaDeRuas = false
      let emTransicaoDeZona = false

      // Aplica um passo de zoom (+1 ou -1, vindo do scroll ou dos botões
      // +/-), decidindo se é só zoom (dentro da mesma zona) ou se precisa
      // animar zoom + inclinação juntos (cruzando a fronteira da zona de
      // ruas, zoom 16 — ZOOM_SATELITE_RUAS).
      function aplicarPassoDeZoom(alvo: number) {
        if (emTransicaoDeZona) return
        const atual = Math.round(mapa.getZoom())
        if (alvo === atual) return

        const alvoNaZona = alvo >= ZOOM_SATELITE_RUAS
        const atualNaZona = atual >= ZOOM_SATELITE_RUAS

        if (alvoNaZona !== atualNaZona) {
          emTransicaoDeZona = true
          mapa.dragRotate.disable()
          mapa.touchPitch.disable()
          mapa.touchZoomRotate.disableRotation()
          if (alvoNaZona) {
            mapa.easeTo({ zoom: alvo, pitch: 0, bearing: 0, duration: 650, easing: suavizar })
          } else {
            mapa.easeTo({ zoom: alvo, pitch: PITCH_PADRAO, duration: 650, easing: suavizar })
          }
          // Sem isso, se por qualquer motivo o 'moveend' dessa animação
          // nunca disparar (ex.: interrompida por outra easeTo antes de
          // terminar, num caso não previsto), emTransicaoDeZona fica preso
          // em true pra sempre — todo zoom novo passa a ser ignorado no
          // "if (emTransicaoDeZona) return" lá em cima, o mapa parece
          // travado. destravar() roda uma vez só (por qualquer um dos dois
          // gatilhos que chegar primeiro) e cancela o outro.
          let destravou = false
          function destravar() {
            if (destravou) return
            destravou = true
            window.clearTimeout(timeoutSeguranca)
            travadoNaZonaDeRuas = alvoNaZona
            emTransicaoDeZona = false
            if (!alvoNaZona) {
              mapa.dragRotate.enable()
              mapa.touchPitch.enable()
              mapa.touchZoomRotate.enableRotation()
            }
          }
          mapa.once('moveend', destravar)
          const timeoutSeguranca = window.setTimeout(destravar, 1500)
        } else {
          mapa.easeTo({ zoom: alvo, duration: 150 })
        }
      }
      zoomPassoRef.current = (direcao: 1 | -1) => {
        // Piso+1 (subindo) / teto-1 (descendo) em vez de arredondar+direção:
        // pra um zoom já inteiro dá exatamente o mesmo resultado de sempre
        // (+1/-1), mas cobre também os dois pontos de partida fracionários
        // (12.5 mobile, 13.5 desktop) sem pular nenhum nível — de 12.5,
        // subir vai pro 13 (não pro 14, que seria o resultado de arredondar
        // 12.5 pra 13 e somar mais 1 depois).
        const zoomAtual = mapa.getZoom()
        const alvo = direcao > 0 ? Math.floor(zoomAtual) + 1 : Math.ceil(zoomAtual) - 1
        aplicarPassoDeZoom(Math.max(12, Math.min(17, alvo)))
      }

      // Scroll do mouse pula direto de 1 nível inteiro por vez, sem posição
      // fracionária no meio — o zoom "suave e contínuo" do MapLibre parece
      // bom em vetor, mas em tile de satélite (imagem de resolução fixa por
      // nível) qualquer zoom fracionário fica com a imagem esticada via GPU,
      // borrada, mesmo sem inclinação nenhuma. Desliga o scroll-zoom nativo
      // do MapLibre e assume o gesto na mão: cada "tique" de scroll soma ou
      // subtrai 1 do zoom atual (arredondado), sempre pousando num inteiro.
      mapa.scrollZoom.disable()
      function aoRolarScroll(e: WheelEvent) {
        e.preventDefault()
        zoomPassoRef.current(e.deltaY < 0 ? 1 : -1)
      }
      // Guardado numa variável nomeada (em vez de um arrow function inline)
      // de propósito: mapa.remove() no cleanup abaixo destrói o mapa, mas
      // NÃO tira esse listener — ele foi colado direto na div do container,
      // que é do React, não do MapLibre, e continua existindo depois do
      // remove(). Sem guardar a referência da função aqui pra poder chamar
      // removeEventListener com ela no cleanup, cada nova montagem deste
      // hook (Fast Refresh, sair de /mapa e voltar) empilhava mais um
      // listener de scroll por cima do anterior, todos ativos ao mesmo
      // tempo — cada um somando/subtraindo zoom no mesmo evento de scroll.
      containerWheelHandlerRef.current = aoRolarScroll
      mapa.getContainer().addEventListener('wheel', aoRolarScroll, { passive: false })

      // Rede de segurança para zoom que NÃO passou por aplicarPassoDeZoom —
      // pinça (touch), que continua com zoom fracionário livre: força (sem
      // animação, é gesto contínuo do usuário) o travamento de rotação/
      // inclinação se o dedo já cruzou pra dentro da zona de ruas. A camada
      // de nome de rua não precisa dessa rede de segurança — sua visibilidade
      // é controlada declarativamente por minzoom/maxzoom na própria camada,
      // o MapLibre já resolve isso sozinho a cada frame, sem depender de
      // 'zoomend'.
      mapa.on('zoomend', () => {
        if (emTransicaoDeZona) return
        const zonaDeRuas = Math.round(mapa.getZoom()) >= ZOOM_SATELITE_RUAS
        if (zonaDeRuas && !travadoNaZonaDeRuas) {
          mapa.dragRotate.disable()
          mapa.touchPitch.disable()
          mapa.touchZoomRotate.disableRotation()
          if (mapa.getPitch() !== 0 || mapa.getBearing() !== 0) {
            mapa.easeTo({ pitch: 0, bearing: 0, duration: 400, easing: suavizar })
          }
          travadoNaZonaDeRuas = true
        } else if (!zonaDeRuas && travadoNaZonaDeRuas) {
          mapa.dragRotate.enable()
          mapa.touchPitch.enable()
          mapa.touchZoomRotate.enableRotation()
          mapa.easeTo({ pitch: PITCH_PADRAO, duration: 400, easing: suavizar })
          travadoNaZonaDeRuas = false
        }

        // Pinça (touch) é o único gesto que ainda deixa o zoom pousar num
        // valor fracionário — diferente do scroll/botões, que já pousam
        // sempre num inteiro por construção (então esse ajuste é um no-op
        // pra eles). Deixa o dedo mover livre durante o gesto (sem travar
        // nada em tempo real) e só assenta suave no inteiro mais próximo
        // quando o usuário solta, evitando o efeito de imagem borrada de
        // tile de satélite em zoom fracionário.
        const zoomAtual = mapa.getZoom()
        const zoomArredondado = Math.round(zoomAtual)
        if (Math.abs(zoomAtual - zoomArredondado) > 0.01) {
          mapa.easeTo({ zoom: zoomArredondado, duration: 200 })
        }
      })

      // Fora da zona de ruas, a inclinação livre por gesto (arrastar/pinça)
      // fica restrita a 45–65°, mesmo com minPitch fixo em 0 — 0 só é
      // permitido quando é ESTA lógica de zona quem está pilotando. Ao
      // soltar o gesto, se ficou abaixo de 45 (e não é o caso de estar
      // travado na zona de ruas), volta suave pra 45.
      mapa.on('pitchend', () => {
        if (emTransicaoDeZona || travadoNaZonaDeRuas) return
        if (mapa.getPitch() < PITCH_MIN) {
          mapa.easeTo({ pitch: PITCH_MIN, duration: 300, easing: suavizar })
        }
      })

      // Corrige o mapa esticando quando o tamanho do container muda
      const resizeObserver = new ResizeObserver(() => mapa.resize())
      resizeObserver.observe(mapRef.current)
      resizeObserverRef.current = resizeObserver
    })

    return () => {
      resizeObserverRef.current?.disconnect()
      // Tira o listener de scroll da div do container ANTES de mapa.remove()
      // — a div é do React (mapRef.current), não é destruída junto com o
      // mapa, então o listener ficaria pra sempre sem isso (ver comentário
      // onde ele é registrado, acima).
      if (containerWheelHandlerRef.current) {
        mapaObj.current?.getContainer().removeEventListener('wheel', containerWheelHandlerRef.current)
        containerWheelHandlerRef.current = null
      }
      // Sem isso, sair de /mapa e voltar deixava a instância antiga do
      // MapLibre (e seus listeners internos) sem ser destruída — só o DOM
      // que ela usava sumia, removido pelo React junto do componente.
      mapaObj.current?.remove()
      mapaObj.current = null
      maplibreObj.current = null
    }
  }, [])

  const zoomPasso = (direcao: 1 | -1) => zoomPassoRef.current(direcao)

  return { mapRef, mapaObj, maplibreObj, mapaCarregado, zoomPasso }
}
