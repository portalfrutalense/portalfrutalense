/**
 * Comprime uma foto no navegador antes do upload — redimensiona pro maior
 * lado não passar de `max` px e reencoda como JPEG na qualidade dada.
 *
 * BUG CORRIGIDO (B10-5): existia como cópia idêntica, separada, em
 * `FormPet.tsx`, `FormClassificado.tsx` e `hooks/useChatBot.ts` — três
 * versões da mesma função. `max`/`quality` viram parâmetros porque cada
 * chamador usava valores diferentes (FormPet/useChatBot: 600px/0.25;
 * FormClassificado: 800px/0.6) — os padrões abaixo preservam o
 * comportamento de quem não passar nada.
 */
export async function comprimirFoto(file: File, max = 600, quality = 0.25): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(max / img.width, max / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
}
