/**
 * Escapa caracteres de HTML — usado antes de interpolar valores controlados
 * pelo usuário dentro de strings de HTML bruto (popups do Leaflet, que não
 * passam pelo escape automático do JSX). Existia como cópia idêntica,
 * separada, em MapaDemandas.tsx, CamadaPets.tsx e CamadaClassificados.tsx.
 */
export function escapeHtml(s?: string): string {
  if (!s) return ''
  // BUG CORRIGIDO (B03-1): não escapava aspa simples (') — hoje todo uso
  // interpola dentro de aspas DUPLAS (ex: `src="${escapeHtml(x)}"`), então
  // está seguro na prática, mas é armadilha latente pro primeiro uso futuro
  // dentro de aspas simples (viraria XSS sem nenhum aviso). `&#39;` é a
  // entidade padrão pra aspa simples em HTML.
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
