# CidadanIA Frutal — Histórico de correções e auditorias

> Este arquivo guarda o **relato** de rodadas de auditoria e correção já
> concluídas — não é carregado automaticamente em toda sessão (diferente do
> `SISTEMA.md`). Abra quando quiser entender *por que* algo foi feito de um
> jeito específico, ou *quando* um bug foi corrigido.
>
> Extraído do `SISTEMA.md` em 2026-09-01 (era a seção "13. Auditoria de
> segurança de 2026-08-30"), que tinha virado um changelog crescente dentro
> de um documento que deveria descrever só o estado atual do sistema. A
> auditoria completa de 2026-09-01 (99 correções) está em `AUDITORIA_FINAL.md`
> — mais recente e mais abrangente que o conteúdo abaixo.

---

## Auditoria de segurança de 2026-08-30 — pendência que exigiu ação manual

Uma auditoria completa do sistema encontrou e corrigiu (no código) vários problemas.
**Duas correções ficaram só no arquivo SQL — precisaram ser rodadas manualmente no
SQL Editor do Supabase, porque aquela sessão não tinha acesso direto ao banco:**

`supabase/fix_rls_seguranca_2026-08-30.sql` contém:
1. Reaplica a restrição por coluna em `demandas`/`demanda_entidades`/`entidades`
   (CPF, `magic_token` e e-mail de autoridade tinham voltado a ficar públicos
   depois de um rollback de emergência anterior — ver `rollback_urgente_select.sql`).
2. Restringe `pets`/`classificados`/`empregos` para que o autor só possa alterar
   colunas de conteúdo — antes ele podia reverter uma ocultação do master ou
   forjar aprovação da IA no próprio registro, batendo direto na API do Supabase.

*(Confirmado aplicado em produção — ver §"Conferência" abaixo.)*

### Segunda rodada (mesmo dia) — a partir de um review externo (Gemini)

O usuário mandou uma segunda análise, feita por outra IA, pra conferir contra
o código. Da lista, isto **procedia e foi corrigido**:

- **Magic links de resposta nunca expiravam** (`expiracao = null` em 3 lugares:
  `/api/ia/analisar`, `/api/master/moderar-demanda`, `/api/master/reenviar-link-demanda`).
  Agora expiram em 7 dias.
- **Demanda/pet/classificado ficava preso em `pendente` para sempre** se a
  chamada assíncrona pra IA falhasse (fire-and-forget sem retry). Em vez de
  um cron automático, existe um botão "Reprocessar pendentes travados" no
  cabeçalho da seção Demandas do painel master, que chama
  `POST /api/master/reprocessar-pendentes` (protegida por `getMasterUser`,
  igual as outras rotas do master) e reenvia pra análise tudo que estiver
  parado há mais de 10 minutos.
- **Comparação de `x-internal-key` e dos segredos de webhook não era de tempo
  constante** (`!==` normal, vaza timing) — trocada por `segredoValido`
  (`crypto.timingSafeEqual`) em `auth-api.ts`, aplicada nas 3 rotas de IA e
  no webhook do WhatsApp.
- **Sem rate limiting em `/api/demandas`, `/api/camadas` e no processamento do
  WhatsApp** — adicionado (mesmo limitador best-effort já usado em `/api/chat`).
- **`schema.sql` desatualizado** — não apagado (é histórico), mas ganhou um
  aviso enorme no topo dizendo pra não rodar e apontando pro lugar certo.

Do resto da lista, **não procedia como descrito** (verificado e nada foi feito):
- "Chave privada podia vazar pro client" — busca em todo `'use client'` do
  projeto por `supabaseServer`/`SERVICE_ROLE`/`INTERNAL_SECRET`: zero ocorrências.
  Já estava certo.
- "Invalidação incompleta de links cruzados" (responder pelo painel deixaria o
  `magic_token` legado ainda válido) — o caminho legado nunca zera a coluna
  `magic_token` mesmo, é verdade, mas ele bloqueia reuso checando
  `status === 'respondida'` antes de aceitar qualquer resposta nova — então o
  token já fica inutilizável na prática. Além disso, uma demanda só existe
  num dos dois formatos (legado OU com `demanda_entidades`), nunca nos dois ao
  mesmo tempo, então o cenário de "dois canais pro mesmo token" descrito nem é
  alcançável no fluxo atual.

Decidido **não fazer sozinho**, por ser mudança grande demais pra entrar
como correção de auditoria sem confirmação explícita:
- Remover o código de fallback legado e migrar dados antigos pra
  `demanda_entidades` — é cirurgia em dado de produção, não código.
- Reescrever o painel master (~1870 linhas de `style={{}}` inline) em Tailwind —
  é um projeto à parte, não uma correção.

### Auditoria por blocos (2026-08-30, sessão de blocos 1-11) — pendência SQL adicional

Durante a auditoria em blocos (Bloco 11 — Migrações SQL), além de conferir se
`fix_rls_seguranca_2026-08-30.sql` já tinha sido executado, foi identificado
que `supabase/fix_bloco11_2026-08-30.sql` também precisava rodar — corrige:

- Cidadão podia, via API direta do Supabase (fora da UI), marcar a própria
  demanda como `resolvida` mesmo estando `pendente` (nunca moderada pela IA
  nem pelo master) — `GRANT UPDATE (status)` restringia a coluna, mas nada
  restringia o valor. Fix: gatilho `restringir_status_demanda`.
- Job `marcar_nao_resolvida` (pg_cron) usava `created_at` em vez de
  `ia_analisado_em` — uma demanda aprovada/reaprovada tardiamente podia virar
  "não resolvida" no dia seguinte, sem a autoridade ter tido chance real de
  responder.
- `chatbot_sem_resposta` tinha duas policies de INSERT conflitantes (uma
  restrita ao próprio `user_id`, outra aberta) por ter sido criada em dois
  arquivos SQL diferentes (`sql/chatbot_sem_resposta.sql` e
  `sql/chatbot_extras.sql`) — mantida só a restrita.
- Tabela `ia_historico`, nunca usada pelo código, removida.

Também: **`supabase/rollback_urgente_select.sql` nunca deve ser executado**
depois dos arquivos de fix de RLS acima — ele reabre a exposição pública de
CPF/`magic_token`/e-mail de autoridade que esses corrigem. Só existe como
registro histórico de uma emergência de produção já resolvida; tem um
aviso no topo do próprio arquivo.

### Auditoria ao vivo do Supabase (Bloco 14) — pendência SQL adicional

O usuário rodou uma query de diagnóstico completa contra o banco real (tabelas,
colunas, RLS, GRANTs por coluna, constraints, triggers, funções, Storage) e
colou o resultado pra conferência. Achados que só uma leitura ao vivo do banco
conseguiria pegar (invisíveis olhando só o código) — corrigidos em
`supabase/fix_bloco14_2026-08-30.sql`:

- **Demanda/pet/classificado podia nascer já "aprovado"**, pulando IA e master
  por completo — o gatilho `restringir_status_demanda` só protege
  `UPDATE`; o caminho de `INSERT` nunca tinha sido testado, e os GRANTs por
  coluna liberam `status`/`ia_decisao`/`oculto`/`magic_token` etc. para INSERT
  de `authenticated`, sem a policy de RLS restringir nenhum valor (só
  `auth.uid() = user_id`). Fix: gatilhos `BEFORE INSERT` que forçam os campos
  de moderação para os valores seguros de um registro recém-criado, fora do
  backend (`service_role`).
- **Demandas `nao_resolvida` eram invisíveis no mapa público** — nenhuma das
  duas policies de `SELECT` público em `demandas` incluía esse status na lista
  permitida (bug que já vinha do `migration-demandas.sql` original, nunca
  corrigido). De quebra, havia duas policies praticamente iguais (uma exigia
  `authenticated`, a outra não — RLS combina com OR, então a exigência da
  primeira já não valia nada na prática); ficou só uma, com o status corrigido.

### Auditoria de repositório completo (2026-08-30) — código + pendência SQL

Auditoria exaustiva de todo o repositório (raiz, `sql/`, `supabase/`, `src/app/`,
`src/components/`, `src/hooks/`, `src/lib/`, `src/types/`), feita em paralelo por
três leituras independentes. Corrigido:

- **`/api/demandas` bloqueava a resposta ao cidadão esperando a análise de IA
  terminar** (`await fetch('/api/ia/analisar')`) — contradizia o próprio
  comentário do código e o padrão "fire-and-forget" já usado em `/api/camadas`.
  Corrigido pro mesmo padrão (sem `await`, com `.catch`).
- **Webhook do WhatsApp — lost update no dedupe de mensagem**: depois de
  reivindicar o `messageId` (update condicional), o código seguia usando o
  snapshot de `historico`/`etapa`/`dados_pendentes` lido antes da reivindicação
  — se outra mensagem do mesmo número tivesse sido processada e salva nesse
  intervalo, esse progresso era perdido. Corrigido pra rebuscar a conversa
  logo após reivindicar o `messageId`.
- **Webhook do WhatsApp — erro do insert em `demanda_entidades` não era checado**
  no fluxo de registro por conversa (só no site já era checado) — corrigido pra
  logar, mesmo padrão de `/api/demandas`.
- **Webhook do WhatsApp — regex de "cancelar" sem suporte a acento** (`\b` sem
  flag `u`) — mesma classe de bug já corrigida pra `RE_POSITIVO`/`RE_NEGATIVO`,
  replicada aqui.
- **Webhook do WhatsApp — foto sem teto de tamanho antes do `sharp`** — mídia
  do WhatsApp não tinha nenhum limite de tamanho antes de ser processada
  (diferente do teto de 20MB já aplicado no upload do site); adicionado o
  mesmo limite.
- **Painel master — aba "Camadas do mapa" era código morto inacessível**
  (`AbaConfig` incluía `'camadas'`, mas o loop de abas nunca renderizava o
  botão, e o conteúdo era `null`) — removida.
- **Painel master — edição de perfil sempre mandava `cpf` no PATCH**, mesmo
  quando o campo fica oculto na tela pra `role === 'autoridade'` — podia
  zerar um CPF existente sem o usuário nunca ter visto o campo. Corrigido pra
  só incluir `cpf` no corpo quando o campo é de fato editável.
- **Nome do assistente hardcoded como "Lucas"** em `/assistenteia`, sem ler
  `chatbot_config.nome_bot` (configurável pelo master, já usado corretamente
  em `/api/chat` e no WhatsApp). Como `chatbot_config` só tem `SELECT` liberado
  por RLS pra `role='master'`, criada `GET /api/chatbot-config` (expõe só
  `nome_bot`, via `service_role`) pra UI do site poder ler o nome configurado.
- **`/app/perfil/page.tsx` marcava demanda como resolvida direto do client**
  — diferente do padrão adotado pro resto do sistema. Criada
  `POST /api/cidadao/marcar-resolvida`, com a mesma checagem de estado
  elegível que já existia na UI, reforçada aqui no servidor.
- **Vazamento de foto no Storage — 2 casos novos, mesma classe já corrigida em
  outros lugares**: `FormPet.tsx`/`FormClassificado.tsx` não tinham cleanup no
  unmount; `MapaDemandas.tsx` apagava a linha direto do client sem tocar na
  foto. Criada `POST /api/camadas/excluir` (ownership check + limpeza de
  Storage + delete via `service_role`).
- `icone_url` de classificados ia pro `divIcon.html` do Leaflet sem
  `escapeHtml` — corrigido.
- Tipagem: `catch (err: any)` trocado por `catch (err: unknown)` com
  `instanceof Error` em vários pontos; `alterarLocal` em `MasterCamadas.tsx`
  ganhou tipo genérico no lugar de `any`.
- Código morto: `setPets` (retorno de `usePets()`) nunca consumido, removido.
  Consulta redundante a `perfis(nome, cpf)` no webhook do WhatsApp removida.

**Pendência SQL — resolvida em 2026-08-30**: `demandas.protocolo`,
`demandas.email_resend_id` e `demandas.email_status` são usadas ativamente
pelo app, mas nenhum arquivo SQL versionado as criava. `supabase/fix_colunas_faltantes_2026-08-30.sql`
foi executado e as 3 colunas foram confirmadas (`text`, nullable).

**Achado que não foi corrigido nesta rodada** (retomado depois — ver
"Auditoria dedicada" mais abaixo): `npx eslint` direto (fora do `next build`)
revelava dezenas de erros reais de `react-hooks/refs` e
`react-hooks/set-state-in-effect`, pré-existentes e espalhados por várias
páginas/componentes.

### Conferência do `fix_rls_seguranca_2026-08-30.sql` — achado adicional

Query rodada pra confirmar se as duas correções críticas de
`fix_rls_seguranca_2026-08-30.sql` estavam de pé em produção. Confirmado
que **estavam** (nenhum `SELECT` liberado em `morador_cpf`/`magic_token`/
`resposta_ip`/`email_resend_id`/`email_status`/`entidades.email` pra
`anon`/`authenticated`; nenhum `UPDATE` liberado em `oculto`/`ia_decisao`/
`ia_motivo`/`ia_analisado_em`/`expira_em` de pets/classificados/empregos
pra `authenticated`).

A mesma conferência revelou um achado novo: **`demandas` e `demanda_entidades`
nunca tiveram o `UPDATE` restringido por coluna** — o GRANT ainda liberava
`UPDATE` em `magic_token`, `magic_token_expira_em`, `resposta_ip`,
`email_resend_id` e `email_status` de `demandas` pra `anon`/`authenticated`.
Um cidadão logado podia, via chamada direta à API do Supabase, sobrescrever
o `magic_token`/`resposta_ip`/`email_status` da própria demanda.

Também encontrado: `MapaDemandas.tsx` (popup do mapa, botão "Marcar como
resolvida") ainda escrevia direto do client — migrado pra
`POST /api/cidadao/marcar-resolvida`, igual ao `/perfil`.

**Pendência SQL — resolvida**: `supabase/fix_update_demandas_2026-08-30.sql`
restringe `UPDATE` de `demandas` pra só a coluna `status` e revoga `UPDATE`
de `demanda_entidades` pra `anon`/`authenticated` por completo. Confirmado
via `information_schema.column_privileges`.

### Exclusão de conta — ordem insegura e cobertura incompleta

Achado ao vivo: o usuário excluiu um cidadão pela tela `/perfil` e o perfil
sumiu de `perfis`, mas o e-mail continuou em `auth.users`. Causa: tanto
`/api/cidadao/excluir-conta` quanto `/api/master/perfis` (DELETE) apagavam a
linha de `perfis` **antes** de chamar `auth.admin.deleteUser()` — se essa
chamada seguinte falhasse, o perfil já tinha sumido e a conta do Auth ficava
órfã. Corrigido nos dois arquivos: o delete manual de `perfis` foi removido
(`perfis.id` já tem `ON DELETE CASCADE` pra `auth.users`), sobrando só a
chamada a `auth.admin.deleteUser()`, que apaga os dois juntos ou nenhum dos
dois. `perfil/page.tsx` ganhou um alerta de erro nessa tela.

A mesma investigação revelou que o caminho do **master** excluir a conta de
um cidadão nunca cobria demandas: como `demandas.user_id` é
`ON DELETE SET NULL` (não cascade), a demanda nunca desaparecia sozinha.
Corrigido: `/api/master/perfis` agora também apaga as fotos de demandas do
Storage e as próprias demandas antes de excluir a conta.

**Nota permanente (ainda válida hoje):** `whatsapp_conversas` e
`chatbot_sem_resposta` **não são apagadas** em nenhum dos dois caminhos de
exclusão de conta — decisão consciente do usuário. O `user_id` vira nulo,
mas a linha permanece (ambas usam `ON DELETE SET NULL`).

### Auditoria dedicada de `react-hooks/refs` / `react-hooks/set-state-in-effect`

Retomando o achado anterior (dezenas de erros pré-existentes dessas duas
regras, invisíveis no `next build` porque ele usa `eslint-config-next`, sem
essas regras — só `npx eslint` direto revela).

**Causa raiz pra quase todo `react-hooks/refs`**: vários hooks customizados
(`useChatBot`, `useMapaBase`) retornam um único objeto misturando `useState`
normal com `useRef` de verdade no mesmo objeto (ex: `return { ...estado,
fotoInputRef }`). O analisador do React Compiler, ao ver `bot.fotoInputRef`
(uma ref real) usada no JSX, passa a tratar `bot.qualquerCoisa` inteiro como
suspeito pro resto do componente. Fix, sem mudar nenhum comportamento:
extrair a ref à parte logo após chamar o hook (`const { fotoInputRef } =
bot`) e usar o identificador solto no JSX, em vez de acesso a propriedade.
Aplicado em `assistenteia/page.tsx` (23 erros resolvidos com uma única linha).

**Causa raiz pro `react-hooks/set-state-in-effect`**: `useEffect(() => {
funcaoQueSetaEstado() }, [])`, onde a função é assíncrona e chama `setState`
depois de um `await`. O padrão que convenceu o analisador foi inlinar a
consulta direto no efeito com `.then()` visível ali, ou despachar a chamada
com `setTimeout(() => funcao(), 0)` quando a função original é reusada em
vários lugares (evita duplicar lógica). Aplicado em: `CamadaPets.tsx`,
`CamadaClassificados.tsx`, `CamadaEmpregos.tsx`, `MasterCamadas.tsx`,
`MasterMapaCamadas.tsx`, `MapaDemandas.tsx`, `perfil/page.tsx`,
`TourBoasVindas.tsx`, `master/page.tsx` (seções Perfis e Chatbot).

**Resultado final**: `react-hooks/refs` e `react-hooks/set-state-in-effect`
zerados em todo o projeto (eram ~23 e ~14 ocorrências, respectivamente).
Nenhuma consulta ou `setState` mudou de valor em nenhum dos pontos — só a
forma de disparo dentro do efeito.

---

## Auditoria completa de 2026-09-01 (99 correções)

Ver `AUDITORIA_FINAL.md` — auditoria linha-a-linha de todo o repositório,
com lista completa de achados, correções aplicadas e pendências de SQL.
Inclui, entre outras coisas: correção de 3 vetores de injeção de prompt nas
rotas de IA, sessão do chat do site passando a ser guardada no servidor
(antes vinha do cliente, forjável), padronização Esri/ArcGIS no mapa
principal documentada, e um achado de RLS ao vivo (policy de leitura
totalmente pública em `chatbot_base`, de origem anterior desconhecida,
removida).
