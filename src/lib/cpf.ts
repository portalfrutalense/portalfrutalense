/**
 * Valida CPF matematicamente (algoritmo oficial)
 */
export function validarCPF(cpf: string): boolean {
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return false
  if (/^(\d)\1+$/.test(limpo)) return false // todos dígitos iguais

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(limpo[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(limpo[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(limpo[10])
}

/**
 * Formata CPF: "12345678900" → "123.456.789-00"
 * Com menos de 11 dígitos (ex: usuário ainda digitando), devolve os
 * dígitos sem máscara em vez de deixar o regex não casar em silêncio.
 */
export function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return limpo
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

