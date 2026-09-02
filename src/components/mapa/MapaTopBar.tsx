'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../AuthProvider'
import { CAMADAS_NAV } from '../Navbar'
import type { Camada } from '@/types'

/**
 * Barra flutuante do "/mapa em tela cheia" — substitui a Navbar nessa
 * página. Fica por cima do mapa: chips de camada (reaproveitam a mesma
 * lista/ordem de CAMADAS_NAV, navegando por `?camada=` como a Navbar já
 * fazia — preserva URL compartilhável e botão voltar do navegador) + um
 * botão de conta (avatar com iniciais, ou "Entrar" quando deslogado).
 *
 * Desktop: chips centralizados no topo do mapa, avatar no canto superior
 * direito. Mobile: avatar fixo à esquerda, chips rolando à direita dele
 * com um fade na ponta indicando que dá pra rolar mais.
 */

function iniciais(nome: string | null | undefined, email: string | null | undefined): string {
  if (nome?.trim()) {
    const partes = nome.trim().split(/\s+/)
    const primeira = partes[0]?.[0] || ''
    const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] || '' : ''
    const resultado = (primeira + ultima).toUpperCase()
    if (resultado) return resultado
  }
  if (email?.trim()) return email.trim()[0].toUpperCase()
  return 'U'
}

export default function MapaTopBar({ camada, isMobile, onAbrirLogin }: { camada: Camada; isMobile: boolean; onAbrirLogin: () => void }) {
  const { user, perfil, sair } = useAuth()
  const [popoverAberto, setPopoverAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverAberto) return
    function fecharFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopoverAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [popoverAberto])

  const nome = perfil?.nome || null
  const email = perfil?.email || user?.email || null
  const nomeExibido = nome?.split(' ')[0] || 'Usuário'

  const chips = (
    <>
      {CAMADAS_NAV.map(({ label, camada: c }) => {
        const ativo = camada === c
        return (
          <Link
            key={c}
            href={`/mapa?camada=${c}`}
            style={{
              flexShrink: 0,
              display: 'inline-block',
              fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap',
              padding: isMobile ? '8px 13px' : '9px 16px',
              borderRadius: '20px',
              textDecoration: 'none',
              background: ativo ? '#4256c8' : 'rgba(255,255,255,0.96)',
              color: ativo ? 'white' : '#111827',
              boxShadow: '0 3px 12px rgba(20,30,50,0.14)',
            }}
          >
            {label}
          </Link>
        )
      })}
    </>
  )

  const avatarBotao = user ? (
    <button
      onClick={() => setPopoverAberto(v => !v)}
      aria-label="Conta"
      style={{
        // BUG CORRIGIDO (pedido do usuário): 40px não batia com os 44px
        // fixos do card azul do mobile (ver comentário no card) — agora bate.
        width: isMobile ? '44px' : '42px', height: isMobile ? '44px' : '42px', flexShrink: 0,
        // BUG CORRIGIDO (pedido do usuário): desktop ainda estava com o
        // azul de marca original e borda branca — unificado com o mobile
        // (mesmo azul claro, sem borda).
        borderRadius: '50%', background: '#6d84e6', color: 'white',
        border: 'none', boxShadow: '0 2px 6px rgba(20,30,50,0.18)',
        fontWeight: 700, fontSize: '13px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {iniciais(nome, email)}
    </button>
  ) : (
    <button
      onClick={onAbrirLogin}
      style={{
        flexShrink: 0, background: '#4256c8', color: 'white', border: 'none',
        borderRadius: '20px', padding: isMobile ? '8px 14px' : '9px 18px',
        fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(20,30,50,0.22)',
      }}
    >
      Entrar
    </button>
  )

  // Versão invertida do "Entrar" — só pro card azul do mobile (logo +
  // conta): o botão padrão acima é azul, ficaria "azul em cima de azul" e
  // ilegível dentro do card. Mesmo estilo de "chip inativo" que os botões
  // de camada já usam (fundo branco, texto escuro).
  // BUG CORRIGIDO (pedido do usuário): estava do mesmo tamanho do botão
  // padrão (desktop) — com a logo maior ocupando mais espaço no card
  // centralizado, o "Entrar" (mais largo que o avatar-círculo, que ele
  // substitui aqui) chegava a cobrir parte da logo. Reduzido pra caber no
  // espaço à direita sem sobrepor.
  const entrarBotaoInvertido = (
    <button
      onClick={onAbrirLogin}
      style={{
        flexShrink: 0, background: 'white', color: '#4256c8', border: 'none',
        borderRadius: '20px', padding: '6px 11px',
        fontSize: '11px', fontWeight: 700, cursor: 'pointer',
      }}
    >
      Entrar
    </button>
  )

  const popover = popoverAberto && user && (
    <div
      style={{
        position: 'absolute', top: isMobile ? '46px' : '50px',
        // Avatar sempre fica no lado direito agora (no mobile, dentro do
        // card azul da logo — antes ficava à esquerda, sozinho, por isso
        // essa posição era 'left' só no mobile; corrigido junto com o
        // reposicionamento do avatar, pedido do usuário).
        right: 0,
        width: '220px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
        boxShadow: '0 12px 34px rgba(20,30,50,0.2)', padding: '6px', zIndex: 40,
      }}
    >
      <div style={{ padding: '10px 10px 9px', display: 'flex', alignItems: 'center', gap: '9px', borderBottom: '1px solid #f9fafb', marginBottom: '4px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#4256c8', color: 'white', fontWeight: 700, fontSize: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {iniciais(nome, email)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeExibido}</p>
          {email && <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</p>}
        </div>
      </div>
      <Link href="/perfil" onClick={() => setPopoverAberto(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
        Minhas atividades
      </Link>
      <Link href="/perfil" onClick={() => setPopoverAberto(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
        Minha conta
      </Link>
      <button
        onClick={() => { setPopoverAberto(false); sair() }}
        style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#dc2626', padding: '9px 10px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer' }}
      >
        Sair
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 30, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Card azul: logo horizontal + avatar/Entrar — antes o avatar
            dividia a mesma linha com os chips de camada, ficava
            "espremido" junto deles (pedido do usuário pra separar). Reusa
            o mesmo azul do cabeçalho da logo no sidebar desktop.
            BUG CORRIGIDO (pedido do usuário — logo comendo o botão
            "Entrar" em telas estreitas, ex: 360px, mas não em telas largas,
            ex: 430px): a 1ª versão usava `position:absolute` no botão e uma
            imagem de largura FIXA em pixels pra logo — o card em volta
            encolhe com a tela, mas nem a logo nem o botão acompanhavam,
            então em telas estreitas sobrava pouco espaço e os dois se
            atropelavam. Corrigido com layout flex de verdade: a logo fica
            num contêiner `flex:1, minWidth:0` (cede espaço primeiro,
            encolhe sozinha via `objectFit:'contain'` preservando a
            proporção — nunca distorce, nunca invade o botão), o botão fica
            `flexShrink:0` (tamanho sempre fixo, nunca cede). Funciona em
            qualquer largura de tela sem essa colisão voltar a acontecer. */}
        <div style={{
          // Altura TRAVADA (fixa, box-sizing:border-box) — pedido explícito
          // do usuário: a logo pode crescer à vontade sem o card acompanhar.
          // BUG CORRIGIDO (pedido do usuário): borderRadius virou "pílula"
          // (metade da altura, 22px = 44px/2) dos dois lados — com o avatar
          // colado sem respiro na borda direita (mesmo diâmetro do card,
          // 44px) e círculo (`50%`), a curva dele completa perfeitamente a
          // curva do card, como se fosse uma peça só.
          flexShrink: 0, background: '#4256c8', borderRadius: '22px',
          height: '44px', boxSizing: 'border-box',
          paddingLeft: '14px', display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 2px 6px rgba(20,30,50,0.18)',
        }}>
          {/* flex:1 + minWidth:0 = cede espaço primeiro; objectFit:'contain'
              escala a logo mantendo a proporção (nunca distorce, nunca
              estoura o espaço). BUG CORRIGIDO (pedido do usuário):
              objectPosition 'left' deixava a logo grudada na borda
              esquerda em telas largas (muito espaço vazio sobrando antes
              do avatar) — 'center' centraliza ela no espaço disponível,
              que já fica levemente puxado pra esquerda em relação ao card
              inteiro por causa do avatar reservar espaço fixo à direita. */}
          <div style={{ flex: 1, minWidth: 0, height: '30px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logohorizontal.png" alt="CidadanIA Frutal" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
          </div>
          <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
            {user ? avatarBotao : entrarBotaoInvertido}
            {popover}
          </div>
        </div>

        {/* Chips de camada — linha própria, sem o avatar. A fileira vai até
            a borda REAL da tela dos dois lados (compensando com margem
            negativa o `left`/`right: 12px` do container pai) — o chip
            "engolido" pela ponta física da tela, não um corte arbitrário
            no meio de um vão vazio. Fade só do lado direito (pedido do
            usuário — o esquerdo ficou só com o corte pela borda, sem
            gradiente): sinaliza "tem mais pra rolar" sem exagerar. */}
        <div
          className="mapa-topbar-chiprow"
          style={{
            display: 'flex', gap: '6px', overflowX: 'auto',
            marginLeft: '-12px', paddingLeft: '12px',
            marginRight: '-12px', paddingRight: '12px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 90%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, #000 0%, #000 90%, transparent 100%)',
          }}
        >
          {chips}
        </div>
        <style>{`.mapa-topbar-chiprow::-webkit-scrollbar { display: none; }`}</style>
      </div>
    )
  }

  return (
    <>
      <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: '8px' }}>
        {chips}
      </div>
      <div ref={wrapRef} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 30 }}>
        {avatarBotao}
        {popover}
      </div>
    </>
  )
}
