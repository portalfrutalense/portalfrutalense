'use client'

import { useEffect, useRef } from 'react'

/**
 * Fundo animado da página inicial: desenha o traçado urbano de uma cidade em
 * grade (como Frutal) sobre papel claro, no registro de planta técnica — ruas
 * em traço fino, avenidas percorridas por pulsos de luz e pins de categoria
 * emitindo ondas concêntricas.
 *
 * A malha de ruas é estática (renderizada uma única vez num canvas offscreen);
 * só os pulsos e os pins animam, então o custo por frame é baixo.
 */

// Tons fechados o bastante para se sustentarem sobre papel claro
const CORES_PIN = ['#d97706', '#0891b2', '#db2777', '#059669']
const ANGULO = -0.24 // radianos — a grade "torta", como traçado urbano real
const ESPACO_QUARTEIRAO = 66

// PRNG determinístico: a mesma cidade é desenhada em todo carregamento
function criarRandom(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Pin = { x: number; y: number; cor: string; fase: number; periodo: number }
type Pulso = { eixo: 'h' | 'v'; pos: number; t: number; vel: number }

export default function MapaVivo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let larg = 0
    let alt = 0
    let dpr = 1
    let malha: HTMLCanvasElement | null = null
    let pins: Pin[] = []
    let pulsos: Pulso[] = []
    let raf = 0
    let inicio = performance.now()

    // ---- malha de ruas (desenhada uma vez) ----------------------------------
    function construirMalha() {
      const off = document.createElement('canvas')
      off.width = larg * dpr
      off.height = alt * dpr
      const c = off.getContext('2d')
      if (!c) return null
      c.scale(dpr, dpr)

      const rand = criarRandom(20260824)
      const diag = Math.hypot(larg, alt)

      c.save()
      c.translate(larg / 2, alt / 2)
      c.rotate(ANGULO)

      // quarteirões: blocos sutis, alguns "acesos" como bairros ativos
      const passos = Math.ceil(diag / ESPACO_QUARTEIRAO) + 2
      for (let i = -passos; i < passos; i++) {
        for (let j = -passos; j < passos; j++) {
          const r = rand()
          if (r > 0.82) {
            c.fillStyle = `rgba(66, 86, 200, ${0.03 + r * 0.04})`
            c.fillRect(
              i * ESPACO_QUARTEIRAO + 3,
              j * ESPACO_QUARTEIRAO + 3,
              ESPACO_QUARTEIRAO - 6,
              ESPACO_QUARTEIRAO - 6,
            )
          }
        }
      }

      // ruas comuns
      c.lineWidth = 1
      c.strokeStyle = 'rgba(66, 86, 200, 0.15)'
      c.beginPath()
      for (let i = -passos; i <= passos; i++) {
        const p = i * ESPACO_QUARTEIRAO
        c.moveTo(p, -diag); c.lineTo(p, diag)
        c.moveTo(-diag, p); c.lineTo(diag, p)
      }
      c.stroke()

      // avenidas: a cada 4 quarteirões, mais largas e mais firmes
      c.lineWidth = 2.5
      c.strokeStyle = 'rgba(66, 86, 200, 0.26)'
      c.beginPath()
      for (let i = -passos; i <= passos; i += 4) {
        const p = i * ESPACO_QUARTEIRAO
        c.moveTo(p, -diag); c.lineTo(p, diag)
        c.moveTo(-diag, p); c.lineTo(diag, p)
      }
      c.stroke()

      c.restore()

      // o córrego: curva orgânica cortando a grade
      c.lineWidth = 10
      c.strokeStyle = 'rgba(8, 145, 178, 0.13)'
      c.beginPath()
      c.moveTo(-40, alt * 0.72)
      c.bezierCurveTo(larg * 0.28, alt * 0.5, larg * 0.5, alt * 0.95, larg + 40, alt * 0.58)
      c.stroke()

      return off
    }

    // ---- pins e pulsos ------------------------------------------------------
    function semear() {
      const rand = criarRandom(77712)
      const qtd = larg < 700 ? 9 : 16

      pins = Array.from({ length: qtd }, () => ({
        x: rand() * larg,
        y: rand() * alt,
        cor: CORES_PIN[Math.floor(rand() * CORES_PIN.length)],
        fase: rand() * 6,
        periodo: 3.4 + rand() * 3.2,
      }))

      const passos = Math.ceil(Math.hypot(larg, alt) / ESPACO_QUARTEIRAO)
      pulsos = Array.from({ length: larg < 700 ? 3 : 6 }, () => {
        const i = (Math.floor(rand() * (passos / 2)) - Math.floor(passos / 4)) * 4
        return {
          eixo: rand() > 0.5 ? 'h' : 'v',
          pos: i * ESPACO_QUARTEIRAO,
          t: rand(),
          vel: 0.05 + rand() * 0.07,
        }
      })
    }

    function desenharPins(t: number) {
      for (const pin of pins) {
        const ciclo = ((t + pin.fase) % pin.periodo) / pin.periodo

        // ondas concêntricas
        for (const atraso of [0, 0.34]) {
          const p = ciclo - atraso
          if (p > 0 && p < 1) {
            ctx!.beginPath()
            ctx!.arc(pin.x, pin.y, p * 54, 0, Math.PI * 2)
            ctx!.strokeStyle = pin.cor
            ctx!.globalAlpha = (1 - p) * 0.4
            ctx!.lineWidth = 1.5
            ctx!.stroke()
          }
        }

        // halo + núcleo
        ctx!.globalAlpha = 1
        const brilho = ctx!.createRadialGradient(pin.x, pin.y, 0, pin.x, pin.y, 15)
        brilho.addColorStop(0, `${pin.cor}3d`)
        brilho.addColorStop(1, `${pin.cor}00`)
        ctx!.fillStyle = brilho
        ctx!.beginPath()
        ctx!.arc(pin.x, pin.y, 15, 0, Math.PI * 2)
        ctx!.fill()

        // anel branco fino separa o pin do traçado, como num mapa impresso
        ctx!.fillStyle = '#ffffff'
        ctx!.beginPath()
        ctx!.arc(pin.x, pin.y, 4.4, 0, Math.PI * 2)
        ctx!.fill()

        ctx!.fillStyle = pin.cor
        ctx!.beginPath()
        ctx!.arc(pin.x, pin.y, 3, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    function desenharPulsos(dt: number) {
      const diag = Math.hypot(larg, alt)
      ctx!.save()
      ctx!.translate(larg / 2, alt / 2)
      ctx!.rotate(ANGULO)
      ctx!.lineCap = 'round'

      for (const pulso of pulsos) {
        pulso.t += dt * pulso.vel
        if (pulso.t > 1.25) pulso.t = -0.25

        const d = -diag + pulso.t * diag * 2
        const x0 = pulso.eixo === 'v' ? pulso.pos : d
        const y0 = pulso.eixo === 'v' ? d : pulso.pos
        const x1 = pulso.eixo === 'v' ? pulso.pos : d + 96
        const y1 = pulso.eixo === 'v' ? d + 96 : pulso.pos

        const grad = ctx!.createLinearGradient(x0, y0, x1, y1)
        grad.addColorStop(0, 'rgba(66, 86, 200, 0)')
        grad.addColorStop(0.5, 'rgba(66, 86, 200, 0.55)')
        grad.addColorStop(1, 'rgba(66, 86, 200, 0)')
        ctx!.strokeStyle = grad
        ctx!.lineWidth = 2.5
        ctx!.beginPath()
        ctx!.moveTo(x0, y0)
        ctx!.lineTo(x1, y1)
        ctx!.stroke()
      }
      ctx!.restore()
    }

    function frame(agora: number) {
      const t = (agora - inicio) / 1000
      ctx!.clearRect(0, 0, larg, alt)
      if (malha && malha.width > 0 && malha.height > 0) ctx!.drawImage(malha, 0, 0, larg, alt)
      desenharPulsos(1 / 60)
      desenharPins(t)
      raf = requestAnimationFrame(frame)
    }

    function medir() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      larg = canvas!.clientWidth
      alt = canvas!.clientHeight
      canvas!.width = Math.round(larg * dpr)
      canvas!.height = Math.round(alt * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      malha = construirMalha()
      semear()
    }

    function comporEstatico() {
      ctx!.clearRect(0, 0, larg, alt)
      if (malha && malha.width > 0 && malha.height > 0) ctx!.drawImage(malha, 0, 0, larg, alt)
      desenharPins(0.5)
    }

    medir()

    // desenha já, sem esperar o primeiro quadro: em aba de fundo o
    // requestAnimationFrame não dispara e o canvas ficaria vazio
    comporEstatico()

    if (!semMovimento) {
      inicio = performance.now()
      raf = requestAnimationFrame(frame)
    }

    // pausa quando a aba sai de foco — não gasta bateria à toa
    function visibilidade() {
      if (semMovimento) return
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        inicio = performance.now() - 1000
        raf = requestAnimationFrame(frame)
      }
    }

    let debounce = 0
    function aoRedimensionar() {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        medir()
        comporEstatico()
      }, 150)
    }

    window.addEventListener('resize', aoRedimensionar)
    document.addEventListener('visibilitychange', visibilidade)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(debounce)
      window.removeEventListener('resize', aoRedimensionar)
      document.removeEventListener('visibilitychange', visibilidade)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}
