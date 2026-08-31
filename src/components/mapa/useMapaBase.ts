'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl'

export const FRUTAL_LAT = -20.02752
export const FRUTAL_LNG = -48.92702

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const TILE_SATELITE = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
const TILE_SATELITE_RUAS = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`

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
              tileSize: 256,
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
      mapa.getContainer().addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault()
        if (animandoZoom) return
        const atual = Math.round(mapa.getZoom())
        const alvo = Math.max(13, Math.min(18, atual + (e.deltaY < 0 ? 1 : -1)))
        if (alvo === atual) return
        animandoZoom = true
        mapa.easeTo({ zoom: alvo, duration: 150 })
        mapa.once('moveend', () => { animandoZoom = false })
      }, { passive: false })

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
