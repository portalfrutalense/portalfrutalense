# CidadanIA Frutal

Plataforma de cidadania digital para Frutal-MG. Conecta moradores, autoridades públicas e a administração municipal em um único sistema — com inteligência artificial integrada em cada etapa.

---

## O que é

O CidadanIA Frutal é um portal público onde qualquer morador de Frutal pode registrar uma demanda municipal, acompanhar o status no mapa e cobrar uma resposta oficial diretamente da autoridade responsável — com geolocalização, foto e protocolo rastreável. Além disso reúne em um só lugar pets perdidos, classificados de veículos e vagas de emprego da cidade.

---

## Funcionalidades

### Demandas municipais
- Registro com localização no mapa, foto, categoria e até 3 autoridades cobradas
- Assistente de escrita com IA — melhora o texto antes de enviar
- Análise automática por IA (Gemini) — aprova ou rejeita antes de notificar a autoridade
- Protocolo único gerado para cada demanda
- A autoridade recebe um link mágico por e-mail e publica a resposta oficial sem precisar de cadastro
- Rastreio de entrega do e-mail em tempo real (enviado → entregue → atrasado → bounce → reclamado)
- Registro também pelo **WhatsApp** — bot guia o fluxo completo

### Achei / Perdi um pet
- Publicação com foto, espécie, raça, cor, porte e localização no mapa
- Tipos: perdido, achado e reencontrado
- Análise automática por IA antes de publicar
- Contato direto com quem publicou

### Classificados
- Anúncios de veículos com múltiplas fotos, marca, modelo, ano, km, preço e localização
- Aceita troca
- Análise automática por IA antes de publicar
- Contato direto com o anunciante

### Empregos
- Vagas publicadas por empresas cadastradas
- Campos: cargo, área, tipo de contrato, salário, requisitos, localização
- Logo da empresa, contato direto

### Chatbot
- Assistente virtual no portal para tirar dúvidas sobre como usar o sistema
- Configurável pelo master (nome, tom de voz, base de conhecimento, prompt)

### Mapa interativo
- Todas as camadas visíveis em um mapa ao vivo: demandas, pets, classificados e empregos
- Filtros por categoria, status e tipo

---

## Painel administrativo (master)

- Moderação completa de demandas, pets, classificados e empregos
- Filtros por status, IA pendente e ocultados
- Aprovação, rejeição e reenvio de links manualmente
- Gestão de autoridades, entidades públicas e perfis de cidadãos
- Dashboard com estatísticas por categoria
- Configuração do chatbot e da IA de moderação (ativo/inativo, rigor, prompt)
- Rastreio de entrega de e-mail por webhook

---

## Via WhatsApp

- Cidadão registra demandas pelo WhatsApp sem abrir o portal
- Bot guia o fluxo: descrição → categoria → autoridade → localização → foto → confirmação
- Geocodificação automática do endereço pelo Mapbox
- Suporta envio de imagem direto pelo WhatsApp

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router), React |
| Banco de dados | Supabase (PostgreSQL + RLS) |
| Autenticação | Supabase Auth (Google OAuth + e-mail/senha) |
| Mapas | Mapbox GL JS + Leaflet |
| Inteligência Artificial | Google Gemini Flash Lite |
| E-mail | Resend (com rastreio de entrega via webhook Svix) |
| WhatsApp | Evolution API |
| Segurança de formulários | Cloudflare Turnstile |
| Deploy | Vercel |

---

## Segurança e privacidade

- CPF, e-mail e WhatsApp dos cidadãos visíveis **apenas para o master**
- RLS no Supabase garante isolamento por `user_id`
- Magic links de autoridade são de uso único e expiram em 7 dias
- Verificação Turnstile em todos os formulários públicos
- Autenticação de APIs internas via `x-internal-key`
- Log de IP em respostas de autoridades

---

## Estrutura

```
src/
  app/
    page.tsx              # Landing page (redireciona para /mapa se já logado)
    mapa/                 # Mapa interativo com camadas
    master/               # Painel administrativo
    responder/[token]/    # Página do link mágico (autoridade)
    assistenteia/         # Assistente de escrita IA
    api/
      demandas/           # Criação de demandas
      camadas/            # Criação de pets, classificados e empregos
      ia/                 # Moderação IA e melhoria de texto
      chat/               # Chatbot
      cidadao/            # Cancelamento de cadastro, exclusão de conta, vínculo de WhatsApp
      whatsapp/           # Webhook do WhatsApp
      master/             # Rotas exclusivas do administrador
      autoridade/         # Rotas do painel de autoridade
      webhooks/resend/    # Rastreio de entrega de e-mail
  components/
    mapa/                 # Camadas do mapa (Pets, Classificados, Empregos)
    master/               # Componentes do painel master
```
