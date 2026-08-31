'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl'

export const FRUTAL_LAT = -20.02752
export const FRUTAL_LNG = -48.92702

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
// Tile de 512px, não 256 (que era o que o Leaflet sempre pediu) — o MapLibre
// GL usa 512px como referência interna de zoom; com tile de 256, ele
// compensa pedindo o nível de zoom seguinte por baixo dos panos pra manter
// a densidade de pixel (zoom 18 na tela vira pedido de zoom 19 de verdade
// pro Mapbox), e o Mapbox não tem imagem real nesse nível pra cidades
// pequenas — devolve algo esticado/borrado, com o estilo de rótulo de rua
// do zoom seguinte. Pedindo 512px direto, a conta de compensação zera:
// zoom 18 na tela volta a pedir zoom 18 de verdade, igual o Leaflet sempre
// fez — e de brinde, tile 512px tem mais detalhe nativo que um de 256.
const TILE_SATELITE = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const TILE_SATELITE_RUAS = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`

// Calibrado pra bater com a escala visual do Leaflet, que o site sempre usou
// (confirmado comparando lado a lado: zoom "13" aqui = zoom "14" do Leaflet,
// "17" aqui = "18" lá) — MapLibre GL usa 512px como referência interna de
// zoom, o Leaflet usava 256px; a mesma cena que era "zoom N" no Leaflet vira
// "zoom N-1" no MapLibre. Todo valor de zoom deste arquivo é 1 a menos do
// que era na versão Leaflet, de propósito.
const ZOOM_SATELITE_RUAS = 15 // exibe nomes de ruas no satélite apenas a partir deste zoom
const PITCH_PADRAO = 65 // inclinação inicial e a que o mapa retoma ao sair da zona de ruas
const PITCH_MIN = 45 // faixa de inclinação livre por gesto, fora da zona de ruas
const PITCH_MAX = 65

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
 * O mapa é sempre satélite — a partir do zoom 15 entra a variante com nomes
 * de rua. Não há modo de ruas puro nem alternância. Diferente do Leaflet (só
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
      link.href = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css'
      link.setAttribute('data-maplibre-css', 'true')
      document.head.appendChild(link)
    }

    import('maplibre-gl').then((maplibregl) => {
      if (!mapRef.current) return

      const mapa = new maplibregl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {
            [FONTE_SATELITE]: {
              type: 'raster',
              tiles: [TILE_SATELITE],
              tileSize: 512,
              attribution: '© Mapbox',
            },
          },
          layers: [{ id: CAMADA_SATELITE, type: 'raster', source: FONTE_SATELITE }],
        },
        center: [FRUTAL_LNG, FRUTAL_LAT],
        zoom: window.innerWidth < 768 ? 12 : 13,
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

      // Zona de ruas: entrar/sair trava e destrava rotação/inclinação, com
      // uma única animação de câmera que move zoom + inclinação (+ direção,
      // ao entrar) juntos — não duas fases (zoom assenta, só depois inclina)
      // como numa tentativa anterior, que ficava com a sensação de "travado
      // e só depois anima".
      let travadoNaZonaDeRuas = false
      let emTransicaoDeZona = false

      function trocarTileSeNecessario() {
        const inteiro = Math.round(mapa.getZoom())
        const fonte = mapa.getSource(FONTE_SATELITE) as RasterTileSource | undefined
        if (!fonte) return
        const precisaRuas = inteiro >= ZOOM_SATELITE_RUAS
        const temRuas = (fonte.tiles?.[0] || '').includes('satellite-streets')
        if (precisaRuas !== temRuas) fonte.setTiles([precisaRuas ? TILE_SATELITE_RUAS : TILE_SATELITE])
      }

      // Aplica um passo de zoom (+1 ou -1, vindo do scroll ou dos botões
      // +/-), decidindo se é só zoom (dentro da mesma zona) ou se precisa
      // animar zoom + inclinação juntos (cruzando a fronteira da zona de
      // ruas, zoom 15).
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
          mapa.once('moveend', () => {
            trocarTileSeNecessario()
            travadoNaZonaDeRuas = alvoNaZona
            emTransicaoDeZona = false
            if (!alvoNaZona) {
              mapa.dragRotate.enable()
              mapa.touchPitch.enable()
              mapa.touchZoomRotate.enableRotation()
            }
          })
        } else {
          mapa.easeTo({ zoom: alvo, duration: 150 })
          mapa.once('moveend', trocarTileSeNecessario)
        }
      }
      zoomPassoRef.current = (direcao: 1 | -1) => {
        const atual = Math.round(mapa.getZoom())
        aplicarPassoDeZoom(Math.max(12, Math.min(17, atual + direcao)))
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
      // pinça (touch), que continua com zoom fracionário livre: garante que
      // o tile de ruas troque no nível certo, e força (sem animação, é
      // gesto contínuo do usuário) o travamento de rotação/inclinação se o
      // dedo já cruzou pra dentro da zona de ruas.
      mapa.on('zoomend', () => {
        if (emTransicaoDeZona) return
        trocarTileSeNecessario()
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
