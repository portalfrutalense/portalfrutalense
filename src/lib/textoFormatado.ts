// LIMPEZA (duplicação de código, achada na auditoria de performance do
// /mapa): `titleCase`/`sentenceCase` estavam copiadas, IDÊNTICAS, em 5
// arquivos (MapaDemandas.tsx, CamadaPets.tsx, CamadaClassificados.tsx,
// CamadaEmpregos.tsx, CamadaImoveis.tsx) — mesmo código, mesmos comentários,
// só colado 5 vezes. Centralizadas aqui; os 5 arquivos passam a importar
// daqui em vez de ter a própria cópia.

/** Nome próprio (rua, bairro, pessoa) — cada palavra com inicial maiúscula,
 * não só a primeira. Evita `\w`/`\b` (ASCII-only em JS, quebra em letra
 * acentuada — "Ângela" viraria "âNgela": o \b apareceria DEPOIS da 1ª letra
 * acentuada, não antes). Separa por espaço e capitaliza com métodos de
 * string puros em vez disso. */
export function titleCase(str?: string) {
  if (!str) return ''
  return str.toLowerCase().split(' ').map((w) => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

/** Só a primeira letra maiúscula, resto minúsculo — usado pra descrição/
 * texto livre digitado pelo usuário (diferente de titleCase, que é pra
 * nomes próprios). */
export function sentenceCase(str?: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
