/**
 * Aplica máscara de telefone brasileiro:
 * 10 dígitos → (XX) XXXX-XXXX  (fixo)
 * 11 dígitos → (XX) 9XXXX-XXXX (celular)
 */
export function mascaraTelefone(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// BUG CORRIGIDO: os 3 usos desta função (ModalCPF, FormPet, FormClassificado)
// rotulam o campo como WhatsApp ("Informe um WhatsApp válido: (XX) 9XXXX-XXXX")
// mas aceitavam também 10 dígitos (telefone fixo) — um fixo passava na
// validação, era salvo como se fosse WhatsApp e ganhava o prefixo 55 em
// `whatsappParaSalvar`. WhatsApp é sempre celular: 11 dígitos com 9 na 3ª posição.
/** Retorna true se o número tem 11 dígitos (DDD + 9 + 8 dígitos) */
export function telefoneValido(valor: string): boolean {
  const digits = valor.replace(/\D/g, '')
  return digits.length === 11 && digits[2] === '9'
}

/**
 * Monta o link `wa.me` a partir do campo livre "contato" de pets,
 * classificados e vagas — diferente do WhatsApp do próprio cadastro do
 * cidadão (validado por `telefoneValido`), esse campo é texto livre digitado
 * no formulário, sem validação de formato. Best-effort: limpa tudo que não
 * for dígito e garante o DDI 55 na frente (sem duplicar se a pessoa já
 * digitou com o 55). Não valida se sobrou um número plausível — quem decide
 * se o link funciona é o próprio WhatsApp ao abrir.
 */
export function linkWhatsapp(contato: string): string {
  let digits = contato.replace(/\D/g, '')
  if (!digits.startsWith('55')) digits = `55${digits}`
  return `https://wa.me/${digits}`
}
