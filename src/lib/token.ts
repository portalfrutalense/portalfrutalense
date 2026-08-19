import { randomBytes } from 'crypto'

/**
 * Gera um token seguro e único para Magic Links
 */
export function gerarToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Calcula a data de expiração do token (padrão: 7 dias)
 */
export function calcularExpiracao(dias = 7): Date {
  const expira = new Date()
  expira.setDate(expira.getDate() + dias)
  return expira
}
