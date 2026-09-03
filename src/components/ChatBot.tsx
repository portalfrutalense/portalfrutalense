'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { useSheet } from '@/contexts/SheetContext'

// Precisa ficar em sincronia com o SNAP de MapaDemandas.tsx (mesmos valores,
// cópia local porque este componente não tem acesso direto ao estado do
// sheet, só ao valor já publicado via SheetContext).
const SNAP: Record<string, number> = { peek: 0.15, half: 0.75, full: 0.87 }

/**
 * Botão flutuante que leva pro assistente de IA (/assistenteia, com sua
 * própria implementação completa do chat). Antes havia também um painel de
 * chat embutido aqui — ficou inalcançável depois que o botão passou a navegar
 * direto pra página cheia (o estado que o abriria nunca era setado como
 * true), então foi removido: eram ~200 linhas mortas usando useChatBot() só
 * pra ler bot.user, o que ainda disparava consultas ao Supabase (entidades,
 * categoria_entidades) em toda página logada sem que o resultado fosse usado
 * em lugar nenhum alcançável.
 */
export default function ChatBot() {
  const { user } = useAuth()
  const { sheetState } = useSheet()
  const router = useRouter()

  // Posição do botão: acompanha o sheet quando no mapa, caso contrário canto inferior direito
  const botaoBottom = sheetState && sheetState !== 'full'
    ? `calc(${SNAP[sheetState] * 100}vh + 12px)`
    : sheetState === null ? '24px' : undefined

  if (!user || sheetState === 'full') return null

  return (
    <button
      onClick={() => router.push('/assistenteia')}
      style={{
        position: 'fixed',
        ...(sheetState ? { bottom: botaoBottom, right: '16px', transition: 'bottom 0.25s ease' } : { bottom: '24px', right: '24px' }),
        zIndex: 2000,
        width: '54px', height: '54px', borderRadius: '50%',
        background: '#4256c8', border: 'none', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        padding: '0', overflow: 'visible',
      }}
      title="Falar com o assistente"
    >
      {/* Da metade pra baixo a foto fica presa ao circulo; da metade pra cima pode vazar */}
      <div style={{ position: 'absolute', inset: 0, clipPath: 'inset(-1000px 0 0 0 round 0 0 32px 32px)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assistenteia.png" alt="Assistente virtual" width={375} height={552} style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', height: '150%', width: 'auto', pointerEvents: 'none' }} />
      </div>
    </button>
  )
}
