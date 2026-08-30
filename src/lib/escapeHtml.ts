/**
 * Escapa caracteres de HTML — usado antes de interpolar valores controlados
 * pelo usuário dentro de strings de HTML bruto (popups do Leaflet, que não
 * passam pelo escape automático do JSX). Existia como cópia idêntica,
 * separada, em MapaDemandas.tsx, CamadaPets.tsx e CamadaClassificados.tsx.
 */
export function escapeHtml(s?: string): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
