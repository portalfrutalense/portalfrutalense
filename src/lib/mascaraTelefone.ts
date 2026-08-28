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

/** Retorna true se o número tem 10 ou 11 dígitos e, se 11, o 3º dígito é 9 */
export function telefoneValido(valor: string): boolean {
  const digits = valor.replace(/\D/g, '')
  if (digits.length === 10) return true
  if (digits.length === 11 && digits[2] === '9') return true
  return false
}
