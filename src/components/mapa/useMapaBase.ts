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

const ZOOM_SATELITE_RUAS = 16 // exibe nomes de ruas no satélite apenas a partir deste zoom

// [oeste, sul], [leste, norte] — MapLibre usa [lng, lat], diferente do par
// [lat, lng] que o Leaflet usava aqui antes.
const LIMITES_FRUTAL: [[number, number], [number, number]] = [[-49.30, -20.1529], [-48.73, -19.8869]]

const FONTE_SATELITE = 'satelite'
const CAMADA_SATELITE = 'satelite-camada'

/**
 * Mapa MapLibre GL base, compartilhado por todas as camadas (demandas, pets,
 * classificados, empregos). O mapa é criado uma única vez: trocar de camada
 * apenas troca os markers, preservando posição, zoom e os tiles já baixados.
 *
 * O mapa é sempre satélite — a partir do zoom 16 entra a variante com nomes
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
        zoom: window.innerWidth < 768 ? 13 : 14,
        minZoom: 13,
        maxZoom: 18,
        maxBounds: LIMITES_FRUTAL,
        attributionControl: false,
      })

      mapa.on('load', () => {
        mapaObj.current = mapa
        maplibreObj.current = maplibregl
        setMapaCarregado(true)
      })

      // Scroll do mouse pula direto de 1 nível inteiro por vez, sem posição
      // fracionária no meio — o zoom "suave e contínuo" do MapLibre parece
      // bom em vetor, mas em tile de satélite (imagem de resolução fixa por
      // nível) qualquer zoom fracionário fica com a imagem esticada via GPU,
      // borrada, mesmo sem inclinação nenhuma. Desliga o scroll-zoom nativo
      // do MapLibre e assume o gesto na mão: cada "tique" de scroll soma ou
      // subtrai 1 do zoom atual (arredondado), sempre pousando num inteiro.
      mapa.scrollZoom.disable()
      let animandoZoom = false
      function aoRolarScroll(e: WheelEvent) {
        e.preventDefault()
        if (animandoZoom) return
        const atual = Math.round(mapa.getZoom())
        const alvo = Math.max(13, Math.min(18, atual + (e.deltaY < 0 ? 1 : -1)))
        if (alvo === atual) return
        animandoZoom = true
        mapa.easeTo({ zoom: alvo, duration: 150 })
        mapa.once('moveend', () => { animandoZoom = false })
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

      // Entra/sai a variante com nomes de rua a partir do zoom certo — o
      // pinça (touch) e os botões +/- do próprio app continuam livres pra
      // fazer zoom fracionário; isso só garante que a troca de tile aconteça
      // no nível certo quando (e enquanto) o zoom estiver assentado.
      mapa.on('zoomend', () => {
        const inteiro = Math.round(mapa.getZoom())
        const fonte = mapa.getSource(FONTE_SATELITE) as RasterTileSource | undefined
        if (!fonte) return
        const precisaRuas = inteiro >= ZOOM_SATELITE_RUAS
        const temRuas = (fonte.tiles?.[0] || '').includes('satellite-streets')
        if (precisaRuas === temRuas) return
        fonte.setTiles([precisaRuas ? TILE_SATELITE_RUAS : TILE_SATELITE])
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

  return { mapRef, mapaObj, maplibreObj, mapaCarregado }
}
