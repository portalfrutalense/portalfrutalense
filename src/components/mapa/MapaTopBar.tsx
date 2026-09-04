'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../AuthProvider'
import { CAMADAS_NAV } from '../Navbar'
import { ROTULO_VEICULO, TIPOS as TIPOS_VEICULO } from './CamadaClassificados'
import { ROTULO_FINALIDADE } from './CamadaImoveis'
import { ROTULO_FILTRO as ROTULO_FILTRO_PET } from './CamadaPets'
import type { Camada } from '@/types'

/**
 * Barra flutuante do "/mapa em tela cheia" — substitui a Navbar nessa
 * página. Fica por cima do mapa: chips de camada (reaproveitam a mesma
 * lista/ordem de CAMADAS_NAV) + um botão de conta (avatar com iniciais, ou
 * "Entrar" quando deslogado).
 *
 * MUDANÇA DE COMPORTAMENTO (pedido do usuário, 2026-09-04): os chips de
 * Demandas Municipais, Veículos, Imóveis e Área PET agora são dropdowns —
 * clicar abre um submenu com o filtro daquela camada (categoria, tipo de
 * veículo, finalidade do imóvel, situação do pet). Escolher uma opção troca
 * de camada E já aplica o filtro na mesma ação — os selects de filtro que
 * existiam dentro do sidebar de cada camada saíram de lá (viraram redundantes).
 * "Todos" e "Vagas de Emprego" continuam chips simples, sem filtro nenhum.
 *
 * Desktop: chips centralizados no topo do mapa, avatar no canto superior
 * direito. Mobile: avatar fixo à esquerda, chips rolando à direita dele
 * com um fade na ponta indicando que dá pra rolar mais.
 */

type OpcaoFiltro = { valor: string; rotulo: string }
// Item de dropdown: folha (aplica filtro direto) ou grupo (abre mais um
// nível, com as folhas de verdade dentro — ver ItemDropdown mais abaixo).
type ItemDropdown =
  | { tipo: 'opcao'; valor: string; rotulo: string }
  | { tipo: 'grupo'; rotulo: string; itens: OpcaoFiltro[] }

// Ordem pedida pelo usuário (não é a mesma ordem interna de ROTULO_FILTRO em
// CamadaPets.tsx, que agrupa por fluxo de moderação, não por preferência de
// exibição aqui).
const ORDEM_PET_DROPDOWN = ['pet_adocao', 'pet_perdido', 'pet_achado', 'pet_reencontrado']
const ORDEM_FINALIDADE_DROPDOWN: ('aluguel' | 'venda')[] = ['aluguel', 'venda']

// Agrupamento SÓ VISUAL do dropdown de Demandas Municipais (pedido do
// usuário, 2026-09-04) — não existe categoria "Manutenção Urbana" no banco,
// nada muda em categorias_mapa, no painel master, nem nos prompts da IA
// (site/WhatsApp), que continuam listando as 7 categorias reais soltas.
// Casa pelo NOME da categoria — por isso é frágil a mudanças feitas no
// master: renomear uma dessas 6 categorias, ou criar uma nova que devesse
// entrar aqui, exige atualizar esta lista à mão (documentado pro usuário
// antes de implementar; ele topou o trade-off).
const GRUPOS_DEMANDAS: { rotulo: string; nomes: string[] }[] = [
  {
    rotulo: 'Manutenção Urbana',
    nomes: ['Buraco no asfalto', 'Calçada danificada', 'Esgoto / Vazamento', 'Iluminação pública', 'Lixo / Entulho', 'Mato alto'],
  },
]

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

export default function MapaTopBar({
  camada, isMobile, onAbrirLogin,
  categorias, filtroCategoria, filtroClassificado, filtroImovel, filtroPet,
  onEscolherFiltro,
}: {
  camada: Camada
  isMobile: boolean
  onAbrirLogin: () => void
  // Só precisa de id/nome — o tipo completo (CategoriaMapa, com cor/ícone
  // etc.) encaixa aqui sem problema, é estrutural.
  categorias: { id: string; nome: string }[]
  filtroCategoria: string
  filtroClassificado: string
  filtroImovel: string
  filtroPet: string
  onEscolherFiltro: (camada: Camada, filtro: string) => void
}) {
  const { user, perfil, sair } = useAuth()
  const [popoverAberto, setPopoverAberto] = useState(false)
  const [chipAberto, setChipAberto] = useState<Camada | null>(null)
  // Posição do BOTÃO que abriu o dropdown (medida uma vez, no clique).
  const [origemBotao, setOrigemBotao] = useState<{ top: number; left: number; right: number } | null>(null)
  // Posição FINAL do painel (`left` OU `right`, nunca os dois) — só existe
  // depois de medir a largura REAL do painel já renderizado (ver
  // useLayoutEffect abaixo). Enquanto `null`, o painel existe no DOM (pra
  // poder medir) mas fica invisível — evita adivinhar a largura antes dele
  // nascer, que foi a causa do painel de "Imóveis" ficar parecendo que era
  // de "Veículos" (a largura hipotética usada antes era grande demais pro
  // conteúdo real, empurrando ele mais pra longe do botão do que precisava).
  const [posFinal, setPosFinal] = useState<{ left?: number; right?: number } | null>(null)
  // Qual grupo (ex.: "Manutenção Urbana") está expandido dentro do dropdown
  // aberto no momento — só um por vez, reseta toda vez que o dropdown de
  // cima fecha ou troca de chip (ver aoClicarChip/aoEscolherOpcao abaixo).
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Partial<Record<Camada, HTMLButtonElement | null>>>({})
  // Fileira de chips com rolagem horizontal (só existe no mobile — no
  // desktop os chips ficam todos visíveis ao mesmo tempo, sem rolar nada).
  const chipRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverAberto) return
    function fecharFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopoverAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [popoverAberto])

  // Fecha o dropdown de filtro clicando fora dele E fora do chip que abriu
  // (clicar de novo no próprio chip já tem seu próprio toggle, em aoClicarChip).
  useEffect(() => {
    if (!chipAberto) return
    // TS não propaga o `if (!chipAberto) return` acima pra dentro da função
    // aninhada (poderia, em teoria, ter mudado antes dela rodar) — captura
    // numa const à parte, já com o tipo estreitado pra `Camada` (sem null).
    const aberto = chipAberto
    function fecharFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (dropdownRef.current?.contains(alvo)) return
      if (chipRefs.current[aberto]?.contains(alvo)) return
      setChipAberto(null)
      setGrupoExpandido(null)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [chipAberto])

  // BUG CORRIGIDO (pedido do usuário, mobile): rolar a fileira de chips com
  // o dedo enquanto um dropdown está aberto deixava ele "pra trás", grudado
  // na posição antiga da tela, sem relação nenhuma com o chip que já tinha
  // saído dali por baixo dele. Fecha o dropdown assim que a fileira rolar —
  // mais simples e previsível do que travar o gesto de rolagem por completo.
  useEffect(() => {
    if (!chipAberto) return
    const fileira = chipRowRef.current
    if (!fileira) return
    function aoRolarFileira() {
      setChipAberto(null)
      setGrupoExpandido(null)
    }
    fileira.addEventListener('scroll', aoRolarFileira, { passive: true })
    return () => fileira.removeEventListener('scroll', aoRolarFileira)
  }, [chipAberto])

  // Mede a largura REAL do painel assim que ele nasce no DOM (invisível até
  // aqui rodar) e só então decide `left` ou `right` — ver comentário em
  // `posFinal` acima. `useLayoutEffect` (não `useEffect`) roda antes do
  // navegador pintar a tela, então não dá pra ver o painel "pular" de lugar.
  useLayoutEffect(() => {
    if (!chipAberto || !origemBotao || !dropdownRef.current) { setPosFinal(null); return }
    const largura = dropdownRef.current.getBoundingClientRect().width
    const MARGEM = 12
    if (origemBotao.left + largura <= window.innerWidth - MARGEM) {
      setPosFinal({ left: Math.max(MARGEM, origemBotao.left) })
    } else {
      setPosFinal({ right: Math.max(MARGEM, window.innerWidth - origemBotao.right) })
    }
    // `grupoExpandido` entra nas dependências só pra remedir se abrir um
    // grupo (Manutenção Urbana) fizer o painel crescer o bastante pra mudar
    // de largura — na prática a largura já é travada em `maxWidth`, então
    // isso quase nunca dispara de novo, mas é mais seguro que assumir.
  }, [chipAberto, origemBotao, grupoExpandido])

  const nome = perfil?.nome || null
  const email = perfil?.email || user?.email || null
  const nomeExibido = nome?.split(' ')[0] || 'Usuário'

  // Opções de filtro por camada — null = chip simples, sem submenu ("Todos", "Vagas de Emprego").
  function opcoesDe(c: Camada): ItemDropdown[] | null {
    if (c === 'demandas') {
      // Categorias que casam com algum grupo (ver GRUPOS_DEMANDAS) viram UM
      // item de grupo só, na posição da primeira ocorrência — as demais
      // (ex.: "Trânsito") continuam soltas, na ordem normal.
      const rotuloDoGrupoJaAdicionado = new Set<string>()
      const itens: ItemDropdown[] = []
      for (const cat of categorias) {
        const grupo = GRUPOS_DEMANDAS.find((g) => g.nomes.includes(cat.nome))
        if (!grupo) {
          itens.push({ tipo: 'opcao', valor: cat.id, rotulo: cat.nome })
          continue
        }
        if (rotuloDoGrupoJaAdicionado.has(grupo.rotulo)) continue
        rotuloDoGrupoJaAdicionado.add(grupo.rotulo)
        itens.push({
          tipo: 'grupo',
          rotulo: grupo.rotulo,
          itens: categorias.filter((c2) => grupo.nomes.includes(c2.nome)).map((c2) => ({ valor: c2.id, rotulo: c2.nome })),
        })
      }
      return itens
    }
    if (c === 'classificados') return TIPOS_VEICULO.map((t) => ({ tipo: 'opcao', valor: t, rotulo: ROTULO_VEICULO[t] }))
    if (c === 'imoveis') return ORDEM_FINALIDADE_DROPDOWN.map((f) => ({ tipo: 'opcao', valor: f, rotulo: ROTULO_FINALIDADE[f] }))
    if (c === 'pets') return ORDEM_PET_DROPDOWN.map((k) => ({ tipo: 'opcao', valor: k, rotulo: ROTULO_FILTRO_PET[k] }))
    return null
  }

  function filtroAtivoDe(c: Camada): string {
    if (c === 'demandas') return filtroCategoria
    if (c === 'classificados') return filtroClassificado
    if (c === 'imoveis') return filtroImovel
    if (c === 'pets') return filtroPet
    return ''
  }

  // Guarda a posição do botão e abre o dropdown — a posição FINAL do painel
  // (left/right) só é decidida depois, no useLayoutEffect acima, quando dá
  // pra medir a largura real dele.
  function abrirDropdownEm(botao: HTMLButtonElement, c: Camada) {
    const rect = botao.getBoundingClientRect()
    setOrigemBotao({ top: rect.bottom + 6, left: rect.left, right: rect.right })
    setPosFinal(null)
    setChipAberto(c)
  }

  function aoClicarChip(c: Camada, opcoes: ItemDropdown[] | null, e: React.MouseEvent<HTMLButtonElement>) {
    setGrupoExpandido(null)
    if (!opcoes) {
      setChipAberto(null)
      onEscolherFiltro(c, '')
      return
    }
    if (chipAberto === c) { setChipAberto(null); return }

    const botao = e.currentTarget
    const fileira = chipRowRef.current

    // BUG CORRIGIDO (achado ao vivo, mobile): quando o chip clicado está
    // parcial ou totalmente fora da área visível da fileira com rolagem
    // horizontal (ex.: "Demandas Municipais" cortado à esquerda, ou "Área
    // PET" perto da ponta direita), o painel abria "solto", sem relação
    // visual nenhuma com o botão que o abriu. Em vez disso, rola a fileira
    // até o chip ficar totalmente visível PRIMEIRO, e só then calcula a
    // posição do painel — ele nasce "grudado" no chip, já visível.
    if (fileira) {
      const retFileira = fileira.getBoundingClientRect()
      const retBotao = botao.getBoundingClientRect()
      const totalmenteVisivel = retBotao.left >= retFileira.left && retBotao.right <= retFileira.right
      if (!totalmenteVisivel) {
        let jaAbriu = false
        const aoTerminarDeRolar = () => {
          if (jaAbriu) return
          jaAbriu = true
          fileira.removeEventListener('scrollend', aoTerminarDeRolar)
          abrirDropdownEm(botao, c)
        }
        fileira.addEventListener('scrollend', aoTerminarDeRolar)
        // Fallback pro caso do navegador não suportar o evento 'scrollend'
        // (Safari mais antigo) — tempo generoso o bastante pra qualquer
        // rolagem suave dentro dessa fileira curta terminar antes disso.
        window.setTimeout(aoTerminarDeRolar, 400)
        botao.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
        return
      }
    }

    abrirDropdownEm(botao, c)
  }

  function aoEscolherOpcao(c: Camada, valor: string) {
    setChipAberto(null)
    setGrupoExpandido(null)
    onEscolherFiltro(c, valor)
  }

  const chips = (
    <>
      {CAMADAS_NAV.map(({ label, camada: c }) => {
        const camadaC = c as Camada
        // Fica azul tanto quando é a camada de verdade ativa no mapa quanto
        // enquanto o dropdown dele está aberto (pedido do usuário — antes só
        // ficava azul depois de escolher uma opção, sem feedback nenhum
        // durante a escolha).
        const ativo = camada === camadaC || chipAberto === camadaC
        const opcoes = opcoesDe(camadaC)
        return (
          <button
            key={c}
            ref={(el) => { chipRefs.current[camadaC] = el }}
            onClick={(e) => aoClicarChip(camadaC, opcoes, e)}
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap',
              padding: isMobile ? '8px 13px' : '9px 16px',
              borderRadius: '20px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: ativo ? '#4256c8' : 'rgba(255,255,255,0.96)',
              color: ativo ? 'white' : '#111827',
              boxShadow: '0 3px 12px rgba(20,30,50,0.14)',
            }}
          >
            {label}
            {opcoes && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transform: chipAberto === camadaC ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </button>
        )
      })}
    </>
  )

  // Submenu de filtro — position:fixed (não absolute) de propósito: o chip
  // que abre isso pode estar dentro da fileira com scroll horizontal do
  // mobile (overflow-x:auto), e um overflow em só um eixo faz o navegador
  // clipar o outro eixo também — fixed nunca sofre esse corte, calculado a
  // partir do retângulo real do chip no momento do clique.
  const dropdownAtivo = chipAberto ? opcoesDe(chipAberto) : null
  const dropdown = chipAberto && origemBotao && dropdownAtivo && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed', top: origemBotao.top,
        // Enquanto `posFinal` ainda não existe (primeiro instante depois de
        // abrir — ver useLayoutEffect acima), usa `left: origemBotao.left`
        // só pra ter ALGUMA posição válida durante a medição, mas fica
        // invisível nesse meio tempo — ninguém chega a ver ele "pulando" de
        // um lugar pro outro depois de medido.
        ...(posFinal ? (posFinal.left !== undefined ? { left: posFinal.left } : { right: posFinal.right }) : { left: origemBotao.left }),
        visibility: posFinal ? 'visible' : 'hidden',
        // Reduzido de 210/260 (pedido do usuário) — painel mais estreito
        // fica mais colado ao botão que abriu ele com mais frequência,
        // menos vezes precisando ancorar pela direita pra caber na tela.
        // Itens mais compridos (ex.: "Esgoto / Vazamento" dentro do grupo
        // Manutenção Urbana) só quebram linha — não têm nowrap, então cabem
        // sem cortar nem forçar o painel a crescer além do maxWidth.
        minWidth: '160px', maxWidth: '200px',
        background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
        boxShadow: '0 12px 34px rgba(20,30,50,0.25)', padding: '6px', zIndex: 50,
      }}
    >
      {(() => {
        const filtroAtual = filtroAtivoDe(chipAberto)
        // Selecionado: azul padrão sólido (mesma cor do chip ativo), não
        // mais o azul claro de antes — pedido do usuário, ficava fraco
        // demais pra perceber de relance qual opção estava marcada.
        const itemEstilo = (ativo: boolean): React.CSSProperties => ({
          display: 'block', width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: 600,
          color: ativo ? 'white' : '#111827', background: ativo ? '#4256c8' : 'none',
          padding: '9px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        })
        return (
          <>
            <button onClick={() => aoEscolherOpcao(chipAberto, '')} style={itemEstilo(!filtroAtual)}>
              Todos
            </button>
            {dropdownAtivo.map((item) => {
              if (item.tipo === 'opcao') {
                return (
                  <button key={item.valor} onClick={() => aoEscolherOpcao(chipAberto, item.valor)} style={itemEstilo(filtroAtual === item.valor)}>
                    {item.rotulo}
                  </button>
                )
              }
              // Grupo (ex.: "Manutenção Urbana") — clicar não filtra nada
              // sozinho, só expande/recolhe as opções de verdade logo
              // abaixo, indentadas. Fica "ativo" (azul) se a opção
              // escolhida no momento estiver dentro dele, mesmo recolhido —
              // sinaliza que o filtro atual mora ali dentro.
              const grupoAtivo = item.itens.some((o) => o.valor === filtroAtual)
              const expandido = grupoExpandido === item.rotulo
              return (
                <div key={item.rotulo}>
                  <button
                    onClick={() => setGrupoExpandido(expandido ? null : item.rotulo)}
                    style={{ ...itemEstilo(grupoAtivo && !expandido), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                  >
                    <span>{item.rotulo}</span>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transform: expandido ? 'rotate(180deg)' : undefined, transition: 'transform .15s ease' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {expandido && (
                    <div style={{ marginLeft: '10px', paddingLeft: '8px', borderLeft: '2px solid #e5e7eb' }}>
                      {item.itens.map((o) => (
                        <button key={o.valor} onClick={() => aoEscolherOpcao(chipAberto, o.valor)} style={itemEstilo(filtroAtual === o.valor)}>
                          {o.rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )
      })()}
    </div>
  )

  // Daqui pra baixo, só usado no desktop: no mobile, a Navbar padrão
  // (com o hamburguer) assumiu o lugar dessa área inteira (avatar/Entrar) —
  // ver PublicShell.tsx e o comentário no bloco `if (isMobile)` abaixo.
  const avatarBotao = user ? (
    <button
      onClick={() => setPopoverAberto(v => !v)}
      aria-label="Conta"
      style={{
        width: '42px', height: '42px', flexShrink: 0,
        borderRadius: '50%', background: '#4256c8', color: 'white',
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
        borderRadius: '20px', padding: '9px 18px',
        fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(20,30,50,0.22)',
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
      <Link href="/mapa" onClick={() => setPopoverAberto(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
        Mapas
      </Link>
      <Link href="/ranking" onClick={() => setPopoverAberto(false)} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#111827', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none' }}>
        Ranking
      </Link>
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
    // O card azul (logo + avatar/Entrar) saiu daqui — pedido do usuário:
    // no mobile, quem cobre essa área agora é a Navbar padrão de verdade
    // (mesma usada no resto do site, com o menu hamburguer), renderizada
    // fixa no topo pelo PublicShell.tsx só nessa largura de tela. Sobra só
    // a fileira de chips de camada, que continua flutuando sobre o mapa —
    // só o offset do topo mudou, pra não ficar embaixo da Navbar (56px de
    // altura + 12px de respiro que já existia).
    return (
      <>
        <div style={{ position: 'absolute', top: '68px', left: '12px', right: '12px', zIndex: 30 }}>
          {/* Chips de camada. A fileira vai até a borda REAL da tela dos dois
              lados (compensando com margem negativa o `left`/`right: 12px`
              do container pai) — o chip "engolido" pela ponta física da
              tela, não um corte arbitrário no meio de um vão vazio. Fade só
              do lado direito (pedido do usuário — o esquerdo ficou só com o
              corte pela borda, sem gradiente): sinaliza "tem mais pra rolar"
              sem exagerar. */}
          <div
            ref={chipRowRef}
            className="mapa-topbar-chiprow"
            style={{
              display: 'flex', gap: '6px', overflowX: 'auto',
              marginLeft: '-12px', paddingLeft: '12px',
              marginRight: '-12px', paddingRight: '12px',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 97%, rgba(0,0,0,0.55) 100%)',
              maskImage: 'linear-gradient(90deg, #000 0%, #000 97%, rgba(0,0,0,0.55) 100%)',
            }}
          >
            {chips}
          </div>
          <style>{`.mapa-topbar-chiprow::-webkit-scrollbar { display: none; }`}</style>
        </div>
        {dropdown}
      </>
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
      {dropdown}
    </>
  )
}
