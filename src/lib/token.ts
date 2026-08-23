import { randomBytes } from 'crypto'

/**
 * Gera um token seguro e único para Magic Links
 */
export function gerarToken(): string {
  return randomBytes(32).toString('hex')
}

