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
| `/mapa` | Logado | Mapa interativo com 4 camadas alternáveis via `?camada=`: `demandas`, `pets`, `classificados`, `empregos`. |
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

Componente principal: `src/components/MapaDemandas.tsx` (878 linhas), que:
- Cria um único mapa Leaflet compartilhado (`useMapaBase`) e desenha por cima dele
  os pins da camada ativa.
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
     `/responder/[token]`, que expira em 7 dias (ver seção 13.1).
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

Campos: espécie (cachorro/gato), nome, raça, cor, porte, descrição, localização,
foto, contato. Cada registro expira automaticamente (`expira_em`) e passa por
moderação de IA similar à das demandas (`/api/ia/analisar-pet`).

### 5.3 Camada Classificados

Veículos à venda (carro, moto, ônibus, caminhão). Campos: título, marca, modelo,
ano, km, cor, preço, aceita troca, múltiplas fotos, contato. **A localização exibida
é sempre aproximada** (bairro) — o endereço exato do vendedor nunca é exposto
publicamente. Também passa por moderação de IA (`/api/ia/analisar-classificado`).

### 5.4 Camada Empregos

Vagas publicadas por contas com `role = 'empresa'`. Campos: cargo, área, tipo de
contrato (CLT/PJ/temporário/estágio/freelance), salário (ou "a combinar"), número
de vagas, requisitos, localização, logo, contato.

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

- `POST /api/chat`: recebe o histórico de mensagens e o nome do usuário, monta um
  system prompt com a base de conhecimento (tabela `chatbot_base`), lista de
  categorias e configurações de tom de voz (tabela `chatbot_config`), chama o Gemini.
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

Toda demanda, pet e classificado passa (opcionalmente) por um filtro de IA antes
de ficar público:
- Rotas: `/api/ia/analisar` (demandas), `/api/ia/analisar-pet`, `/api/ia/analisar-classificado`.
- Configuração global em `ia_config`: liga/desliga a moderação e define o **rigor**
  (`permissivo`, `moderado`, `rigoroso`), cada um com uma instrução diferente
  injetada no prompt.
- Se desativada, tudo fica pendente para aprovação manual pelo master.
- Existe também `/api/ia/melhorar-texto`, que reescreve/melhora a redação de um
  texto enviado pelo usuário (provavelmente usado nos formulários de cadastro).

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
  de jobs automáticos (decisão do usuário — ver seção 13.2): "Reprocessar
  pendentes travados" (`POST /api/master/reprocessar-pendentes`, reenvia pra
  análise de IA tudo parado há mais de 10 minutos) e "Marcar paradas há 30+
  dias" (`POST /api/master/marcar-nao-resolvidas`, marca como `nao_resolvida`
  demandas em espera de resposta há mais de 30 dias desde a aprovação).
- **Empregos / Classificados / Pets** — moderação equivalente para as outras 3 camadas.
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
  ícones) via `camadas_mapa` / `CamadaConfig`.

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
| `camadas_mapa` | Configuração visual de cada camada do mapa |
| `ia_config` | Configuração global da moderação por IA (ativo, rigor, prompt) |
| `chatbot_config` | Configuração do assistente (nome, tom, responsabilidades, prompt extra) |
| `chatbot_base` | Base de conhecimento do assistente (títulos + conteúdo) |
| `chatbot_sem_resposta` | Perguntas que a IA não soube responder, para revisão |
| `whatsapp_conversas` | Histórico de conversas do WhatsApp, vinculável a um `user_id` |

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
- `/api/chat` e `/api/ia/melhorar-texto` têm um limitador de taxa best-effort
  (`limiteExcedido`, em `auth-api.ts`) — é em memória, por instância, então não é
  garantia real em ambiente serverless com múltiplas instâncias; contém abuso
  trivial de um mesmo processo, não um ataque distribuído.
- Endpoints de resposta de autoridade (`/api/responder`, `/api/autoridade/responder`)
  registram o IP de quem respondeu (`resposta_ip`) para rastreabilidade.
- Magic tokens de resposta (`magic_token`) são de uso único: ao ser respondido, o
  vínculo muda de status e tokens duplicados (e-mail vs sessão logada) são
  invalidados cruzadamente.
- CPF é armazenado apenas para cidadãos e é obrigatório antes de registrar
  qualquer demanda (dupla checagem: no cadastro via `ModalCPF` e novamente no
  backend de `/api/demandas`).
- Localização de classificados é sempre aproximada no dado exposto publicamente
  (bairro, não endereço exato).
- Cancelamento de cadastro e exclusão de conta são endpoints dedicados
  (`/api/cidadao/cancelar-cadastro`, `/api/cidadao/excluir-conta`), acessíveis
  pela página `/perfil`.
- Upload de foto (demanda/pet/classificado/chat) recusa arquivos acima de 20 MB
  no cliente, antes de tentar carregar na memória do navegador para compressão.

---

## 12. Observações para quem for auditar

- O `supabase/schema.sql` do repositório **não reflete o schema real** — várias
  tabelas hoje em uso (`demandas`, `demanda_entidades`, `pets`, `classificados`,
  `empregos`, `chatbot_*`, `ia_config`, `camadas_mapa`, `whatsapp_conversas`) só
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

---

## 13. Auditoria de segurança de 2026-08-30 — pendência que exige ação manual

Uma auditoria completa do sistema encontrou e corrigiu (no código) vários problemas.
**Duas correções ficaram só no arquivo SQL — precisam ser rodadas manualmente no
SQL Editor do Supabase, porque esta sessão não tem acesso direto ao banco:**

`supabase/fix_rls_seguranca_2026-08-30.sql` contém:
1. Reaplica a restrição por coluna em `demandas`/`demanda_entidades`/`entidades`
   (CPF, `magic_token` e e-mail de autoridade tinham voltado a ficar públicos
   depois de um rollback de emergência anterior — ver `rollback_urgente_select.sql`).
2. Restringe `pets`/`classificados`/`empregos` para que o autor só possa alterar
   colunas de conteúdo — antes ele podia reverter uma ocultação do master ou
   forjar aprovação da IA no próprio registro, batendo direto na API do Supabase.

**Se você está lendo isso e não tem certeza se esse arquivo já foi executado**,
rode a query de conferência no fim dele (`select ... from pg_policies`) e
compare com o que o arquivo espera antes de assumir que já foi aplicado — se
"sistema meio bagunçado" for a sensação de novo, é o primeiro lugar a checar.

### 13.1 Segunda rodada (mesmo dia) — a partir de um review externo (Gemini)

O usuário mandou uma segunda análise, feita por outra IA, pra conferir contra
o código. Da lista, isto **procedia e foi corrigido**:

- **Magic links de resposta nunca expiravam** (`expiracao = null` em 3 lugares:
  `/api/ia/analisar`, `/api/master/moderar-demanda`, `/api/master/reenviar-link-demanda`).
  Agora expiram em 7 dias. Isso passou batido na minha própria auditoria.
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
- **`schema.sql` desatualizado** — não apaguei (é histórico), mas agora tem um
  aviso enorme no topo dizendo pra não rodar e apontando pro lugar certo.

Do resto da lista, **não procedia como descrito** (verifiquei e não fiz nada):
- "Chave privada podia vazar pro client" — busquei em todo `'use client'` do
  projeto por `supabaseServer`/`SERVICE_ROLE`/`INTERNAL_SECRET`: zero ocorrências.
  Já estava certo.
- "Invalidação incompleta de links cruzados" (responder pelo painel deixaria o
  `magic_token` legado ainda válido) — o caminho legado nunca zera a coluna
  `magic_token` mesmo, é verdade, mas ele bloqueia reuso checando
  `status === 'respondida'` antes de aceitar qualquer resposta nova — então o
  token já fica inutilizável na prática. Além disso, uma demanda hoje só existe
  num dos dois formatos (legado OU com `demanda_entidades`), nunca nos dois ao
  mesmo tempo, então o cenário de "dois canais pro mesmo token" descrito nem é
  alcançável no fluxo atual.

E isto eu decidi **não fazer sozinho**, por ser mudança grande demais pra entrar
como correção de auditoria sem confirmação explícita:
- Remover o código de fallback legado e migrar dados antigos pra
  `demanda_entidades` — é cirurgia em dado de produção, não código.
- Reescrever o painel master (1870 linhas de `style={{}}` inline) em Tailwind —
  é um projeto à parte, não uma correção.

### 13.2 Auditoria por blocos (2026-08-30, sessão de blocos 1-11) — pendência SQL adicional

Durante a auditoria em blocos (Bloco 11 — Migrações SQL), além de conferir se
`fix_rls_seguranca_2026-08-30.sql` (§13) já foi executado, **rode também
`supabase/fix_bloco11_2026-08-30.sql`** no SQL Editor do Supabase — corrige:

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
depois dos arquivos de fix de RLS (§13) — ele reabre a exposição pública de
CPF/`magic_token`/e-mail de autoridade que esses corrigem. Só existe como
registro histórico de uma emergência de produção já resolvida; agora tem um
aviso no topo do próprio arquivo.

### 13.3 Auditoria ao vivo do Supabase (Bloco 14) — pendência SQL adicional

O usuário rodou uma query de diagnóstico completa contra o banco real (tabelas,
colunas, RLS, GRANTs por coluna, constraints, triggers, funções, Storage) e
colou o resultado pra conferência. Achados que só uma leitura ao vivo do banco
conseguiria pegar (invisíveis olhando só o código) — **rode
`supabase/fix_bloco14_2026-08-30.sql`** no SQL Editor do Supabase:

- **Demanda/pet/classificado podia nascer já "aprovado"**, pulando IA e master
  por completo — o gatilho `restringir_status_demanda` (§13.2) só protege
  `UPDATE`; o caminho de `INSERT` nunca tinha sido testado, e os GRANTs por
  coluna liberam `status`/`ia_decisao`/`oculto`/`magic_token` etc. para INSERT
  de `authenticated`, sem a policy de RLS restringir nenhum valor (só
  `auth.uid() = user_id`). Fix: gatilhos `BEFORE INSERT` que forçam os campos
  de moderação para os valores seguros de um registro recém-criado, fora do
  backend (`service_role`).
- **Demandas `nao_resolvida` eram invisíveis no mapa público** — nenhuma das
  duas policies de `SELECT` público em `demandas` incluía esse status na lista
  permitida (bug que já vinha do `migration-demandas.sql` original, nunca
  corrigido). Como a policy é quem decide o que aparece no mapa, isso
  contrariava o próprio propósito de transparência do sistema. De quebra,
  havia duas policies praticamente iguais (uma exigia `authenticated`, a outra
  não — RLS combina com OR, então a exigência da primeira já não valia nada na
  prática); ficou só uma, com o status corrigido.

### 13.4 Auditoria de repositório completo (2026-08-30) — código + pendência SQL

Auditoria exaustiva de todo o repositório (raiz, `sql/`, `supabase/`, `src/app/`,
`src/components/`, `src/hooks/`, `src/lib/`, `src/types/`), feita em paralelo por
três leituras independentes. Corrigido:

- **`/api/demandas` bloqueava a resposta ao cidadão esperando a análise de IA
  terminar** (`await fetch('/api/ia/analisar')`) — contradizia o próprio
  comentário do código e o padrão "fire-and-forget" já usado em `/api/camadas`
  e descrito na seção 5.1. Corrigido pro mesmo padrão (sem `await`, com `.catch`).
- **Webhook do WhatsApp — lost update no dedupe de mensagem**: depois de
  reivindicar o `messageId` (update condicional), o código seguia usando o
  snapshot de `historico`/`etapa`/`dados_pendentes` lido antes da reivindicação
  — se outra mensagem do mesmo número tivesse sido processada e salva nesse
  intervalo, esse progresso era perdido. Agora rebusca a conversa logo após
  reivindicar o `messageId`.
- **Webhook do WhatsApp — erro do insert em `demanda_entidades` não era checado**
  no fluxo de registro por conversa (só no site já era checado) — corrigido pra
  logar, mesmo padrão de `/api/demandas`.
- **Webhook do WhatsApp — regex de "cancelar" sem suporte a acento** (`\b` sem
  flag `u`) — mesma classe de bug já documentada e corrigida pra
  `RE_POSITIVO`/`RE_NEGATIVO`, replicada aqui.
- **Webhook do WhatsApp — foto sem teto de tamanho antes do `sharp`** — mídia
  do WhatsApp não tinha nenhum limite de tamanho antes de ser processada
  (diferente do teto de 20MB já aplicado no upload do site); adicionado o
  mesmo limite.
- **Painel master — aba "Camadas do mapa" era código morto inacessível**
  (`AbaConfig` incluía `'camadas'`, mas o loop de abas nunca renderizava o
  botão, e o conteúdo era `null`) — removida. `MasterCamadas` nunca teve
  suporte a `camada="demandas"` (a cor de demandas já é por categoria, na aba
  Categorias), então não era uma feature perdida, só scaffolding não usado.
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
  (`supabase.from('demandas').update(...)`), diferente do padrão adotado pro
  resto do sistema (autoridade e master usam rota de API). Criada
  `POST /api/cidadao/marcar-resolvida`, com a mesma checagem de estado
  elegível que já existia na UI, reforçada aqui no servidor.
- **Vazamento de foto no Storage — 2 casos novos, mesma classe já corrigida em
  outros lugares**: `FormPet.tsx`/`FormClassificado.tsx` não tinham cleanup no
  unmount — fechar o modal (botão "×") com upload em andamento ou já concluído
  deixava o arquivo órfão no bucket; adicionado `useEffect` de limpeza.
  `MapaDemandas.tsx` (`excluirPet`/`excluirClassificado`/`excluirEmprego`)
  apagava a linha direto do client sem tocar na foto — mesmo problema já
  corrigido no caminho do master, nunca replicado pro caminho do dono do
  registro. Criada `POST /api/camadas/excluir` (ownership check + limpeza de
  Storage + delete via `service_role`), e as três funções do mapa passaram a
  chamá-la em vez de `supabase.from(camada).delete()` direto.
- `icone_url` de classificados ia pro `divIcon.html` do Leaflet sem
  `escapeHtml` (único ponto do arquivo com essa inconsistência; risco baixo,
  campo só é setado pelo master) — corrigido.
- Tipagem: `catch (err: any)` em `FormDemanda.tsx` (2 pontos) trocado por
  `catch (err: unknown)` com `instanceof Error`, mesmo padrão de
  `FormPet.tsx`/`FormClassificado.tsx`. `alterarLocal` em `MasterCamadas.tsx`
  ganhou tipo genérico (`<K extends keyof CamadaConfig>`) no lugar de `any`.
- Código morto: `setPets` (retorno de `usePets()`) nunca consumido, removido
  do retorno do hook. Consulta redundante a `perfis(nome, cpf)` no webhook do
  WhatsApp (o mesmo registro já tinha sido buscado no início do processamento
  da mesma mensagem) — removida, reaproveitando o resultado já em memória.

**Pendência SQL — resolvida em 2026-08-30**: `demandas.protocolo`,
`demandas.email_resend_id` e `demandas.email_status` são usadas ativamente
pelo app e por `fix_rls_seguranca_2026-08-30.sql` / `fix_bloco14_2026-08-30.sql`,
mas nenhum arquivo SQL versionado as criava — reconstruir o banco do zero só
com os arquivos do repositório deixaria essas 3 colunas faltando.
`supabase/fix_colunas_faltantes_2026-08-30.sql` foi executado no SQL Editor
do Supabase e as 3 colunas foram confirmadas (`text`, nullable) via
`information_schema.columns`.

**Achado novo, não corrigido nesta sessão** — fora do escopo desta rodada:
rodar `npx eslint` direto (fora do `next build`) nos arquivos de `src/app/`
revela dezenas de erros reais de regras `react-hooks` mais rígidas
(`react-hooks/refs`, `react-hooks/set-state-in-effect` — prováveis regras do
React Compiler já habilitadas em `eslint.config.mjs`), pré-existentes e
espalhadas por várias páginas/componentes (`assistenteia/page.tsx`,
`perfil/page.tsx`, `master/page.tsx`, `MapaDemandas.tsx`, `CamadaPets.tsx`,
`CamadaClassificados.tsx`, `MasterCamadas.tsx`, entre outros). O `next build`
não falha por causa delas (usa `eslint-config-next`, que não inclui essas
regras), então passaram despercebidas em todo build/commit anterior. Como é
um padrão só de calling setState/lendo refs dentro do corpo de efeitos — não
um bug de comportamento confirmado — e o volume é grande (dezenas de pontos
em muitos arquivos), corrigir tudo exige sua própria auditoria dedicada, não
uma correção pontual dentro desta.
