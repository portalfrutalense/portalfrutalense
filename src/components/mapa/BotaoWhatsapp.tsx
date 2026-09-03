// LIMPEZA (duplicação de código, achada na auditoria de performance do
// /mapa): este botão (ícone + link wa.me) estava copiado, IDÊNTICO, em 4
// arquivos de camada (CamadaPets.tsx, CamadaClassificados.tsx,
// CamadaEmpregos.tsx, CamadaImoveis.tsx). Centralizado aqui.
import { linkWhatsapp } from '@/lib/mascaraTelefone'

const estilo: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '2px',
  background: '#25d366', color: 'white', fontSize: '12.5px', fontWeight: 600,
  padding: '8px 14px', borderRadius: '20px', textDecoration: 'none', border: 'none',
  cursor: 'pointer', width: 'fit-content',
}

function IconeWhatsapp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

export function BotaoWhatsapp({ contato, texto = 'Chamar no WhatsApp' }: { contato: string; texto?: string }) {
  return (
    <a href={linkWhatsapp(contato)} target="_blank" rel="noopener noreferrer" style={estilo}>
      <IconeWhatsapp />
      {texto}
    </a>
  )
}
