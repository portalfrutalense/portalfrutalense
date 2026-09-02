# CidadanIA Frutal — Documentação Completa do Sistema

> Documento técnico gerado a partir de leitura direta do código-fonte, em 2026-08-30.
> Objetivo: descrever 100% dos fluxos, funcionalidades, papéis de usuário, integrações
> externas e estrutura de dados do sistema, para uso em auditoria por terceiros (incluindo IAs).
>
> **Manutenção:** este arquivo é carregado automaticamente em toda sessão (via `CLAUDE.md`).
> Sempre que uma mudança estrutural for feita no sistema — nova funcionalidade, fluxo alterado,
> tabela nova, integração nova/removida — este arquivo deve ser atualizado na mesma sessão,
> antes de considerar a tarefa concluída.

---

## 1. Visão geral

**CidadanIA Frutal** é uma plataforma de cidadania digital para o município de Frutal-MG.
Permite que cidadãos cobrem serviços públicos de autoridades específicas (vereadores,
secretários), publiquem classificados de veículos, anunciem vagas de emprego e
registrem/busquem pets perdidos — tudo centralizado num mapa interativo da cidade.
Conta com um assistente de IA (texto no site, e também via WhatsApp) que conduz o
cidadão pelo fluxo de registro de demandas por conversa natural.

**Stack:**
- Next.js 16.3.1 (App Router), React 19.2.8, TypeScript
- Supabase (Postgres + Auth + Storage) como backend
- Leaflet / MapLibre GL para os mapas
- Google Gemini (`gemini-3.1-flash-lite`) como modelo de IA — usado tanto para
  moderação de conteúdo quanto para o chatbot conversacional
- Resend para envio de e-mails transacionais
- Evolution API (self-hosted) como gateway do WhatsApp
- Cloudflare Turnstile como anti-bot em formulários públicos
- Mapbox (Geocoding API + Static Images API) para geocodificação e miniaturas de mapa
- Esri/ArcGIS (World Imagery + basemap styles) para as imagens de satélite do mapa principal (desde 2026-08-31)
- Deploy: Vercel (presumido pelas referências a `SITE_URL`, `maxDuration` etc.)

---

## 2. Papéis de usuário (roles)

A tabela `perfis` tem uma coluna `role` com 4 valores possíveis:

| Role | Quem é | Onde atua |
|---|---|---|
| `cidadao` | Morador comum, cadastro livre | `/mapa`, `/assistenteia` |
| `autoridade` | Vereador, secretário — recebe e responde demandas | Link de e-mail (`/responder/[token]`) ou login próprio |
| `empresa` | Publica vagas de emprego | `/mapa` (camada empregos) |
| `master` | Administrador do sistema | `/master` |

Todo usuário se autentica via **Supabase Auth** (e-mail/senha ou Google OAuth). O
`role` é atribuído manualmente pelo painel master no momento da criação da conta
(autoridades e empresas são criadas pelo master; cidadãos se cadastram sozinhos e
recebem `role = 'cidadao'` por padrão).

**CPF obrigatório**: apenas cidadãos (ou contas novas sem role ainda definido)
precisam de CPF preenchido. Autoridades e empresas nunca precisam. Essa checagem
acontece no `AuthProvider` (`src/components/AuthProvider.tsx`) via a flag `precisaCPF`,
que dispara o `ModalCPF` sempre que um cidadão está logado mas sem nome/CPF salvos.

---

## 3. Mapa de rotas (páginas)

| Rota | Público | Descrição |
|---|---|---|
| `/` | Todos | Landing page. Se o usuário já está logado, redireciona automaticamente para `/mapa`. |
| `/mapa` | Logado | Mapa interativo com 5 camadas alternáveis via `?camada=`: `demandas`, `pets`, `classificados`, `empregos`, `imoveis`. |
| `/assistenteia` | Logado | Tela cheia do chatbot de IA (usado tanto para tirar dúvidas quanto para registrar demandas por conversa). |
| `/perfil` | Logado | Edição de dados pessoais, exclusão de conta, cancelamento de cadastro. |
| `/master` | Só `role = master` | Painel administrativo completo (ver seção 8). |
| `/responder/[token]` | Público (via magic link) | Página onde uma autoridade responde a uma demanda, sem precisar de login — acessada pelo link enviado por e-mail. |
| `/auth/callback` | — | Rota técnica do fluxo OAuth (Google). Redireciona para `?next=` ou `/mapa` por padrão. |
| `/redefinir-senha` | Público | Fluxo de recuperação de senha. |
| `/termos`, `/privacidade` | Público | Páginas estáticas de termos de uso e política de privacidade. |

Obs.: a rota `/dashboard` existiu brevemente (uma página de boas-vindas pós-login com
estatísticas) mas **foi removida** — hoje o login redireciona direto para `/mapa`.

---

## 4. Fluxo de autenticação

1. Usuário acessa a landing (`/`) e clica em "Entrar", que abre o `ModalAuth`.
2. Duas formas de entrar: e-mail/senha (Supabase Auth nativo) ou "Continuar com Google"
   (OAuth, redireciona para `/auth/callback`).
3. Ao logar, o `AuthProvider` busca o registro correspondente na tabela `perfis`
   (`select * from perfis where id = auth.uid()`).
4. Se o perfil não tem `nome` ou `cpf` preenchidos **e** o role é `cidadao` (ou
   inexistente — conta recém-criada), o `ModalCPF` é exibido obrigatoriamente,
   bloqueando o uso do sistema até o cidadão completar nome e CPF.
   - Contas criadas via Google que já tenham conta prévia como autoridade/empresa
     não passam por esse modal.
5. Se `perfil.bloqueado === true`, o sistema trata o usuário como bloqueado (a
   flag `bloqueado` do `AuthProvider` é usada para impedir ações — bloqueio é
   feito manualmente pelo master).
6. Logout: `supabase.auth.signOut()`, limpando `user` e `perfil` do contexto.

---

## 5. O Mapa (`/mapa`) — núcleo do sistema

Componente principal: `src/components/MapaDemandas.tsx`, que:
- Cria um único mapa **MapLibre GL** compartilhado (`useMapaBase`) e desenha por cima
  dele os pins da camada ativa. Diferente do Leaflet (2D puro, ainda usado só no
  mini-mapa de confirmar endereço — `MiniMapaConfirmar.tsx`), o MapLibre roda em
  WebGL com câmera 3D: inclinação (pitch) e rotação (bearing) ficam livres pro
  usuário ajustar por gesto (botão direito/Ctrl+arrastar no desktop, dois dedos no
  touch) — trocado em 2026-08-30 exatamente por causa disso, o Leaflet não tem
  como inclinar a câmera de jeito nenhum. As imagens de satélite passaram a
  vir da **Esri/ArcGIS** (`ibasemaps-api.arcgis.com/.../World_Imagery`,
  desde 2026-08-31 — não é mais Mapbox), com labels via
  `basemapstyles-api.arcgis.com`; o navegador do cidadão se conecta direto
  aos servidores da Esri pra carregar os tiles (`NEXT_PUBLIC_ARCGIS_API_KEY`).
  Mapbox continua em uso só no fluxo do WhatsApp (geocodificação de texto +
  miniatura estática, seção 6.2) — não mais no mapa principal. Inclinação padrão e
  máxima em 62° (`PITCH_PADRAO`/`PITCH_MAX`, `useMapaBase.ts`); sem botões
  +/− de zoom na tela (removidos — o gesto de pinça/scroll já cobre isso).
- **Patch obrigatório do MapLibre** (`patches/maplibre-gl+4.7.1.patch`,
  aplicado via `patch-package` no `postinstall`): corrige uma race condition
  no `TaskQueue` interno da biblioteca — um `redraw()` disparado por
  `ResizeObserver` colidindo com um `_render()` já em andamento (comum
  durante as animações de pitch/zoom deste mapa, que rodam 400–650ms) fazia
  o mapa travar de vez, exigindo recarregar a página. Sem esse patch
  instalado, o bug volta. Se o mapa recomeçar a travar depois de um
  `npm install` limpo, o primeiro lugar a checar é se o patch foi aplicado
  (`node_modules/maplibre-gl` deveria ter o patch refletido).
- A camada ativa é controlada pela query string `?camada=demandas|pets|classificados|empregos`,
  sincronizada com a Navbar (que tem links diretos para cada camada).
- Em mobile, a listagem lateral vira um **bottom sheet arrastável** com 3 posições
  (`peek` 20%, `half` 50%, `full` 75% da tela), controlado por um `SheetContext`
  global (também usado pelo botão flutuante do assistente de IA, que "sobe"
  acompanhando o sheet e some quando o sheet está `full`).

### 5.1 Camada Demandas

Fluxo de criação de uma demanda (cidadão, pelo mapa ou pelo chatbot):
1. Cidadão preenche: descrição, localização (clique no mapa ou endereço), categoria,
   até **3 autoridades** para cobrar, foto opcional (câmera ou galeria — dois botões
   separados, pois `accept="image/*"` sozinho não abre a câmera direta no Android).
2. Turnstile (Cloudflare) valida que não é bot antes do envio.
3. `POST /api/demandas`: valida campos, confere CPF do perfil, insere a demanda com
   `status: 'pendente'`, cria um registro em `demanda_entidades` para cada autoridade
   selecionada (relação N:N entre demanda e autoridades), e dispara de forma
   assíncrona (fire-and-forget) uma chamada para `/api/ia/analisar`.
4. `POST /api/ia/analisar` (chamada interna, autenticada por `x-internal-key`):
   - Se a moderação por IA estiver **desativada** no painel master, a demanda fica
     `pendente` aguardando aprovação manual.
   - Se ativada, monta um prompt com a base de conhecimento do sistema + a
     demanda, envia ao Gemini, que retorna `{"decisao": "aprovada"|"rejeitada", "motivo": "..."}`.
   - **Aprovada**: status vira `aguardando_resposta`. Para cada autoridade vinculada,
     gera um token único (`magic_token`) e envia um e-mail via Resend com um link
     `/responder/[token]`, que expira em 7 dias.
   - **Rejeitada**: status vira `rejeitada_ia`, motivo salvo em `ia_motivo`, e-mail
     não é enviado.
5. Autoridade responde: por e-mail (magic link, sem login) via `POST /api/responder`,
   ou logada diretamente pelo sistema via `POST /api/autoridade/responder`. Qualquer
   uma das duas invalida o link da outra automaticamente.
6. Status final: `respondida`, e o master (ou a própria autoridade, dependendo da
   configuração) pode marcar como `resolvida`, `nao_resolvida` ou receber uma
   `denunciada` caso outro usuário denuncie a demanda como falsa/abusiva.

Estados possíveis de uma demanda (`StatusDemanda`):
`pendente` → `aguardando_resposta` → `respondida` → `resolvida` / `nao_resolvida`
(ramificações: `rejeitada_ia`, `denunciada`)

Todas as demandas visíveis no mapa são as com status em
`['aguardando_resposta', 'respondida', 'nao_resolvida', 'resolvida']` e `oculto = false`
— ou seja, pendentes e rejeitadas pela IA não aparecem publicamente.

### 5.2 Camada Pets

Três tipos de registro **independentes** (nunca se convertem um no outro):
- `perdido` — cidadão perdeu um pet (pode ser marcado como `reencontrado` depois)
- `achado` — cidadão encontrou um pet na rua
- `adocao` — pet disponível para adoção

Campos: espécie (cachorro/gato), nome, raça, cor, porte, descrição, **data/hora
aproximada de quando sumiu ou foi encontrado** (obrigatória só pra `perdido`/`achado`),
localização, foto, contato. Cada registro expira automaticamente (`expira_em`) e
passa por moderação de IA similar à das demandas (`/api/ia/analisar-pet`).

### 5.3 Camada Classificados

Veículos à venda (carro, moto, ônibus, caminhão). Campos: título, marca, modelo,
ano, km, cor, preço, aceita troca, múltiplas fotos, contato. **A localização exibida
é sempre aproximada** (bairro) — o endereço exato do vendedor nunca é exposto
publicamente. Também passa por moderação de IA (`/api/ia/analisar-classificado`).

### 5.4 Camada Empregos

Vagas publicadas por contas com `role = 'empresa'`. Campos: cargo, área, tipo de
contrato (CLT/PJ/temporário/estágio/freelance), salário (ou "a combinar"), número
de vagas, requisitos, localização, logo, contato.

### 5.5 Camada Imóveis

Anúncios de aluguel ou venda de imóveis, publicados por qualquer cidadão
(mesmo padrão de acesso de Classificados — não exige `role` específico).
Campos: finalidade (aluguel/venda), tipo (casa, apartamento, terreno, cômodo
comercial, barracão, fazenda, chácara, sítio), descrição, valor, 2 a 4 fotos,
contato, endereço (mini-mapa). **Diferente de Classificados, a localização é
exata** — não é deslocada aleatoriamente. Passa por moderação de IA
(`/api/ia/analisar-imovel`, `ia_config.id = 4`).

**"Marcar vendido/alugado" exclui o registro de verdade** (linha + fotos do
Storage), sem deixar rastro — não é uma flag como
`classificados.vendido`/`empregos.encerrada` (decisão confirmada com o
usuário). Essa mesma exclusão real foi retroativamente aplicada a "marcar
vendido" (Classificados) e "encerrar vaga" (Empregos), que antes só ligavam
uma flag e mantinham a linha e as fotos no banco/Storage indefinidamente.

---

## 6. O Assistente de IA

Existem **duas superfícies** do mesmo assistente, com prompts parecidos mas
adaptados ao canal:

### 6.1 No site (`/assistenteia`)

A interface completa do chat — mensagens, fluxo de registro guiado, mini-mapa,
upload de foto, captcha — vive inteiramente em `/assistenteia`
(`src/app/assistenteia/page.tsx`). O componente `ChatBot.tsx`, renderizado em
quase toda página logada via `PublicShell`, é hoje só um **botão flutuante**
que navega para `/assistenteia` — não abre mais um painel de chat embutido.
(Um painel inline existia antes, mas ficou inalcançável depois que o botão
passou a navegar direto pra página cheia; foi removido na auditoria em blocos,
Bloco 9, por ser ~200 linhas de código morto que ainda disparava consultas
desnecessárias ao Supabase em toda página.)

- `POST /api/chat`: recebe só a mensagem nova do cidadão (`mensagem`) — o histórico
  real da conversa é guardado no servidor (tabela `chat_conversas`, chaveada por
  `user_id`), não confiado ao que o cliente manda (corrigido em 2026-09-01: antes o
  cliente mandava o histórico inteiro a cada mensagem, forjável). `novaConversa: true`
  reinicia o histórico salvo (usado quando a tela do chat recarrega do zero). O nome
  do cidadão também não vem mais do corpo da requisição — a rota busca `perfis.nome`
  no servidor. Monta um system prompt com a base de conhecimento (tabela
  `chatbot_base`), lista de categorias e configurações de tom de voz (tabela
  `chatbot_config`), chama o Gemini.
- A IA pode retornar 3 tipos de resposta:
  - Texto livre (conversa normal)
  - `{"action":"detectar_demanda", "descricao", "categoria_id", "categoria_nome"}`
    quando identifica um relato de problema urbano — isso dispara o fluxo de
    registro guiado (perguntar se quer registrar → escolher autoridade → confirmar
    endereço num mini-mapa → anexar foto opcional → captcha → confirmar)
  - `{"action":"sem_resposta"}` quando a pergunta não está na base de conhecimento —
    nesse caso a pergunta é salva em `chatbot_sem_resposta` para o master revisar
    depois e enriquecer a base.
- O fluxo de registro guiado é implementado no hook `src/hooks/useChatBot.ts`,
  como uma máquina de estados (`etapaDemanda`).
- Suporte a **entrada por voz** (reconhecimento de fala do navegador) quando disponível.
- `GET /api/chatbot-config`: expõe só `nome_bot` (via `service_role`) pra UI
  do site poder mostrar o nome do bot configurado no painel master — `chatbot_config`
  só tem `SELECT` liberado por RLS pra `role='master'`, então o cliente comum
  não conseguiria ler direto.

### 6.2 No WhatsApp (`/api/whatsapp/webhook`)

- Recebe webhooks da Evolution API (self-hosted, compatível com protocolo WhatsApp).
- Usa `after()` do Next.js para processar a mensagem de forma assíncrona além do
  tempo normal de resposta HTTP (até 120s de `maxDuration`), pois o Gemini pode
  demorar.
- Mesma lógica de detecção de demanda e fluxo guiado do chat do site, adaptada
  para texto puro (sem UI de botões — o fluxo usa perguntas e respostas em texto).
- Geocodificação de endereços ditos em texto livre via **Mapbox Geocoding API**,
  validando se o resultado cai dentro de um raio de Frutal (checagem de distância
  a partir das coordenadas centrais da cidade).
- Ao concluir o registro, envia uma imagem de satélite com pin (Mapbox Static
  Images API) confirmando a localização escolhida.
- Fotos enviadas pelo WhatsApp são baixadas e descriptografadas via
  `baixarMidiaWhatsapp` (chamada à Evolution API que decodifica a mídia
  criptografada do protocolo WhatsApp em base64).
- Cache em memória de 5 minutos para as configurações do bot e categorias (evita
  bater no banco a cada mensagem).
- **Vínculo de conta**: se o cidadão já tem conta no site, ele pode vincular seu
  número de WhatsApp à conta logada em `/perfil`, via
  `POST /api/cidadao/vincular-whatsapp-cadastro`. Isso associa conversas das
  últimas 24h daquele telefone (`whatsapp_conversas`) ao `user_id`, permitindo que
  demandas registradas por WhatsApp apareçam também no histórico do site. Tenta os
  dois formatos de número (com e sem o 9º dígito, porque a Evolution API às vezes
  omite ele).

Ambos os prompts têm regras fixas: nunca usar emojis, nunca inventar informação
fora da base de conhecimento, variar a linguagem entre mensagens (evita respostas
robóticas repetitivas — inclusive usando um número de sessão aleatório como
"semente" de variação estilística no prompt).

---

## 7. Moderação por IA

Toda demanda, pet, classificado e imóvel passa (opcionalmente) por um filtro de IA
antes de ficar público:
- Rotas: `/api/ia/analisar` (demandas), `/api/ia/analisar-pet`, `/api/ia/analisar-classificado`,
  `/api/ia/analisar-imovel`.
- Configuração global em `ia_config`: liga/desliga a moderação e define o **rigor**
  (`permissivo`, `moderado`, `rigoroso`), cada um com uma instrução diferente
  injetada no prompt.
- Se desativada, tudo fica pendente para aprovação manual pelo master.
- Existe também `/api/ia/melhorar-texto`, que reescreve/melhora a redação de um
  texto enviado pelo usuário — usado hoje só no formulário de demanda
  (`FormDemanda.tsx`), botão "Melhorar texto".

---

## 8. Painel Master (`/master`)

Único acesso restrito a `role = 'master'`. Arquivo principal:
`src/app/master/page.tsx` (arquivo grande, ~1900 linhas — o número exato muda
a cada edição, não vale a pena manter atualizado aqui). Seções (menu lateral):

- **Demandas Municipais** — lista todas as demandas (todos os status), permite
  editar descrição, ver análise da IA, ver respostas de cada autoridade vinculada,
  moderar manualmente (aprovar/rejeitar), marcar como resolvida/não resolvida,
  reenviar o link de resposta por e-mail, ver status de entrega do e-mail
  (via webhook do Resend). Dois botões manuais no cabeçalho da seção, no lugar
  de jobs automáticos (decisão do usuário): "Reprocessar
  pendentes travados" (`POST /api/master/reprocessar-pendentes`, reenvia pra
  análise de IA tudo parado há mais de 10 minutos) e "Marcar paradas há 30+
  dias" (`POST /api/master/marcar-nao-resolvidas`, marca como `nao_resolvida`
  demandas em espera de resposta há mais de 30 dias desde a aprovação).
- **Empregos / Classificados / Imóveis / Pets** — moderação equivalente para as outras 4 camadas.
- **Chatbot** — configuração do assistente: nome do bot, descrição, tom de voz,
  responsabilidades, prompt extra, base de conhecimento (`chatbot_base`, textos
  livres organizados por título), e a fila de perguntas sem resposta
  (`chatbot_sem_resposta`) para enriquecer a base.
- **Perfis** — gestão de contas: cidadãos, autoridades, empresas. Criação de
  contas de autoridade/empresa (com senha inicial definida pelo master), edição de
  dados, vínculo de categorias a cada autoridade (`categoria_entidades` — define
  quais tipos de demanda cada autoridade pode receber), bloqueio de contas.
- **Configuração de categorias** — CRUD de categorias do mapa (nome, cor, ícone
  customizado com upload e compressão client-side via canvas).
- **Configuração de camadas** — customização visual das camadas do mapa (cores,
  ícones) via `camadas_config` / `CamadaConfig`.

`GET /api/master/stats` retorna contagens agregadas de tudo (demandas por status,
pets por tipo, classificados, empregos), usando `service_role` do Supabase para
ignorar RLS e trazer números reais mesmo de registros ocultos/pendentes.

`PATCH` e `DELETE /api/master/camada` — moderação (ocultar/reexibir pet e
classificado, encerrar vaga pelo master) e exclusão passam por essa rota com
`service_role`, em vez de escrever/apagar direto do navegador como faziam
antes. Existe porque a política de RLS de `pets`/`classificados`/`empregos`
restringe o autor comum a colunas de conteúdo (não pode mais mexer em `oculto`
sozinho) — só o backend, verificado como master, pode. O `DELETE` também limpa
a foto correspondente no Storage antes de apagar a linha.

---

## 9. Estrutura de dados (tabelas principais)

> O arquivo `supabase/schema.sql` na raiz está **desatualizado** — descreve um
> esquema legado com tabelas `denuncias` e `ocorrencias` que não são mais usadas
> no código atual. O esquema real e vigente foi reconstruído por migrações
> incrementais na pasta `sql/` e no arquivo `migration_demanda_entidades.sql`.
> As tabelas efetivamente em uso, inferidas do código:
>
> Reconstruir o banco do zero exige alguns passos manuais fora dos arquivos de
> `sql/` — ver `supabase/fix_tabelas_faltantes_2026-09-01.sql` (cria `entidades`,
> `categorias_mapa`, `categoria_entidades`, `chatbot_base`, que nenhum arquivo
> versionado criava) e `sql/role_master.sql` (não existe caminho automático pra
> promover a primeira conta a `master`, de propósito). Lista completa de
> arquivos SQL e o que cada um corrige em `AUDITORIA_FINAL.md`.

| Tabela | Descrição |
|---|---|
| `perfis` | Dados de cada usuário (nome, cpf, email, whatsapp, role, bloqueado, data_nascimento) |
| `demandas` | Demandas registradas pelos cidadãos |
| `demanda_entidades` | Relação N:N entre demanda e autoridades cobradas, com resposta e status individuais por autoridade |
| `entidades` | Autoridades (vereadores, secretários) — nome, cargo, email, foto |
| `categorias_mapa` | Categorias de demanda (nome, cor, ícone) |
| `categoria_entidades` | Relação entre categoria e quais autoridades podem recebê-la |
| `pets` | Registros de pets perdidos/achados/adoção |
| `classificados` | Anúncios de veículos |
| `empregos` | Vagas de emprego |
| `imoveis` | Anúncios de imóveis para aluguel/venda — ver `sql/migration-imoveis.sql` |
| `camadas_config` | Configuração visual de cada camada do mapa (cor/ícone por situação e espécie) |
| `ia_config` | Configuração global da moderação por IA (ativo, rigor, prompt) |
| `chatbot_config` | Configuração do assistente (nome, tom, responsabilidades, prompt extra) |
| `chatbot_base` | Base de conhecimento do assistente (títulos + conteúdo) |
| `chatbot_sem_resposta` | Perguntas que a IA não soube responder, para revisão |
| `whatsapp_conversas` | Histórico de conversas do WhatsApp, vinculável a um `user_id` |
| `chat_conversas` | Histórico real do chat do site, guardado no servidor (chaveado por `user_id`) — criada em 2026-09-01 pra corrigir um bug de injeção onde o cliente mandava (e podia forjar) o histórico inteiro a cada mensagem; ver `supabase/fix_chat_conversas_2026-09-01.sql` |

Todas essas tabelas usam **Row Level Security (RLS)** do Supabase — as rotas de
API usam o cliente `service_role` (`supabaseServer`) para ignorar RLS quando
necessário (ex: contagens do master, envio de e-mails), enquanto o cliente do
navegador (`createClient` de `supabase-browser.ts`) respeita as políticas RLS
normalmente para leitura pública.

---

## 10. Integrações externas

| Serviço | Uso |
|---|---|
| **Supabase** | Banco de dados (Postgres), autenticação, storage de arquivos (fotos, ícones) |
| **Google Gemini** (`gemini-3.1-flash-lite`) | Moderação de conteúdo (demandas/pets/classificados) e chatbot conversacional (site + WhatsApp) |
| **Resend** | Envio de e-mails transacionais (notificação de nova demanda para autoridades) |
| **Evolution API** | Gateway self-hosted para integração com WhatsApp (webhook de mensagens, envio de texto/mídia) |
| **Mapbox** | Geocoding API (converter endereço em coordenadas, usado no fluxo do WhatsApp) e Static Images API (gerar miniatura de satélite com pin) |
| **Esri/ArcGIS** | Imagens de satélite do mapa principal (`/mapa`) — o navegador do cidadão se conecta direto aos servidores da Esri pra carregar os tiles, não passa pelo backend |
| **Cloudflare Turnstile** | Anti-bot nos formulários públicos (registro de demanda) |

---

## 11. Segurança e validações notáveis

- Toda checagem de autenticação em rota de API passa por `getUser`/`getMasterUser`,
  centralizadas em `src/lib/auth-api.ts` — antes era uma função quase idêntica
  copiada em ~15 arquivos, hoje é uma implementação só.
- Rotas internas (chamadas servidor-a-servidor, como `/api/ia/analisar`) são
  protegidas por uma chave compartilhada (`x-internal-key` vs `INTERNAL_SECRET`),
  não pelo token de usuário.
- `/api/whatsapp/webhook` exige um segredo compartilhado (`WHATSAPP_WEBHOOK_SECRET`,
  via header `x-webhook-secret` ou `?secret=` na URL) — sem isso, recusa a
  chamada. Configure o mesmo valor na URL do webhook dentro da Evolution API.
- `/api/webhooks/resend` **exige** `RESEND_WEBHOOK_SECRET` configurado — sem ele,
  o endpoint recusa qualquer chamada (antes a verificação era opcional).
- Várias rotas públicas/sensíveis têm um limitador de taxa best-effort
  (`limiteExcedido`, em `auth-api.ts`): `/api/chat`, `/api/ia/melhorar-texto`,
  `/api/demandas`, `/api/camadas`, `/api/chatbot-config`,
  `/api/cidadao/vincular-whatsapp-cadastro`, `/api/whatsapp/webhook` — é em
  memória, por instância, então não é garantia real em ambiente serverless
  com múltiplas instâncias; contém abuso trivial de um mesmo processo, não
  um ataque distribuído.
- Endpoints de resposta de autoridade (`/api/responder`, `/api/autoridade/responder`)
  registram o IP de quem respondeu (`resposta_ip`) para rastreabilidade.
- Magic tokens de resposta (`magic_token`) são de uso único: ao ser respondido, o
  vínculo muda de status e tokens duplicados (e-mail vs sessão logada) são
  invalidados cruzadamente.
- CPF é armazenado apenas para cidadãos e é obrigatório antes de registrar
  qualquer demanda (dupla checagem: no cadastro via `ModalCPF` e novamente no
  backend de `/api/demandas`).
- Localização de classificados é sempre aproximada no dado exposto publicamente
  (bairro, não endereço exato) — imóveis é a exceção confirmada: a localização
  é exata, sem esse deslocamento.
- Cancelamento de cadastro e exclusão de conta são endpoints dedicados
  (`/api/cidadao/cancelar-cadastro`, `/api/cidadao/excluir-conta`), acessíveis
  pela página `/perfil`.
- Upload de foto (demanda/pet/classificado/imóvel/chat) recusa arquivos acima
  de 20 MB no cliente, antes de tentar carregar na memória do navegador para
  compressão.
- "Marcar vendido" (classificados), "encerrar vaga" (empregos) e "marcar
  vendido/alugado" (imóveis) excluem o registro de verdade (linha + fotos do
  Storage) — não são mais uma flag que só oculta do mapa público, decisão
  confirmada com o usuário ao criar a camada Imóveis. Mesma rota de exclusão
  usada pelo botão "Excluir" (`/api/camadas/excluir`).
- Exclusão de conta (`/api/cidadao/excluir-conta` e `/api/master/perfis` DELETE)
  apaga perfil + conta do Auth atomicamente (`auth.admin.deleteUser`, que
  cascateia via `ON DELETE CASCADE`), além das fotos, demandas,
  `whatsapp_conversas` e `chatbot_sem_resposta` do próprio usuário (as duas
  últimas usam `ON DELETE SET NULL`, então precisam ser apagadas
  explicitamente — decisão revista em 2026-09-01: antes só o `user_id`
  virava nulo e a linha permanecia).

---

## 12. Observações para quem for auditar

- O `supabase/schema.sql` do repositório **não reflete o schema real** — várias
  tabelas hoje em uso (`demandas`, `demanda_entidades`, `pets`, `classificados`,
  `empregos`, `chatbot_*`, `ia_config`, `camadas_config`, `whatsapp_conversas`) só
  existem espalhadas pelos scripts incrementais da pasta `sql/` e no arquivo solto
  `migration_demanda_entidades.sql` na raiz — não há um dump único e atualizado
  do schema completo no repositório.
- O caminho de fallback "modo legado" (`/api/responder`, `/api/master/moderar-demanda`
  ação "aprovar", `/api/master/reenviar-link-demanda` — usar `magic_token` direto na
  tabela `demandas` quando não havia vínculo em `demanda_entidades`, resquício de uma
  versão anterior do sistema antes de demandas poderem ter múltiplas autoridades) foi
  **removido em 2026-08-30**, já que o sistema ainda está em desenvolvimento e não há
  dado real no formato legado a preservar. `demanda_entidades` é hoje o único caminho.
- A landing page (`src/app/page.tsx`) e o painel master têm seções de UI escritas
  quase inteiramente com `style={{ ... }}` inline em vez de CSS Modules/Tailwind
  consistente — o projeto usa Tailwind (`tailwindcss` está nas dependências) mas
  boa parte da UI mais recente foi construída com estilos inline diretos.
- **Bucket de Storage "Public" ≠ liberado pra upload.** Marcar um bucket como
  Public no painel do Supabase só libera leitura sem autenticação — a tabela
  `storage.objects` tem RLS própria, separada disso, que decide quem pode
  fazer INSERT/DELETE. Cada bucket de foto (`demandas-fotos`, `pets-fotos`,
  `classificados-fotos`, `empregos-fotos`, `imoveis-fotos`) precisa das
  próprias policies de upload/remoção — nenhuma delas está versionada em
  `sql/` (mesmo caso do restante do schema fora do repositório, ver acima),
  exceto as de `imoveis-fotos`, criadas junto com a tabela em
  `sql/migration-imoveis.sql`. Sintoma se faltar: "new row violates row-level
  security policy" ao tentar enviar uma foto, mesmo com o bucket público.


---

## 13. Histórico de correções e auditorias

Movido para `HISTORICO_CORRECOES.md` em 2026-09-01 — este arquivo (`SISTEMA.md`)
descreve o estado atual do sistema; o relato de cada rodada de auditoria
(o que foi encontrado, corrigido, e as decisões tomadas no caminho) fica
separado, pra não crescer indefinidamente aqui. A auditoria mais recente e
mais abrangente (99 correções, 2026-09-01) está em `AUDITORIA_FINAL.md`.
