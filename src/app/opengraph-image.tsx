import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const alt = 'CidadanIA Frutal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Lido uma única vez, no carregamento do módulo — a imagem gerada é sempre
// idêntica (não depende de nada da requisição), então reler e recodificar o
// logo em base64 a cada chamada da função era trabalho repetido à toa.
const logoData = readFileSync(join(process.cwd(), 'public', 'CIDADANIA.png'))
const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#4256c8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoBase64}
          alt="CidadanIA Frutal"
          style={{ width: '700px', objectFit: 'contain' }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
