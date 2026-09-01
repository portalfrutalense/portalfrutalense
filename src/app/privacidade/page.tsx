import Link from 'next/link'

const titulo = 'Política de Privacidade — CidadanIA Frutal'
const descricao = 'Política de Privacidade da plataforma CidadanIA Frutal.'

export const metadata = {
  title: titulo,
  description: descricao,
  alternates: { canonical: 'https://cidadaniafrutal.com.br/privacidade' },
  openGraph: { title: titulo, description: descricao, url: 'https://cidadaniafrutal.com.br/privacidade' },
  twitter: { title: titulo, description: descricao },
}

export default function PoliticaPrivacidade() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(24px,5vw,48px) clamp(16px,4vw,24px)', fontFamily: 'Inter, system-ui, sans-serif', color: '#111827', lineHeight: 1.7 }}>
      <div style={{ marginBottom: '32px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#4256c8', textTransform: 'uppercase', letterSpacing: '.08em' }}>CidadanIA Frutal</span>
        <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, color: '#111827', margin: '8px 0 4px' }}>Política de Privacidade</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Última atualização: agosto de 2026</p>
      </div>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>1. Sobre o CidadanIA Frutal</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O CidadanIA Frutal é uma plataforma digital de transparência cívica, zeladoria urbana e de utilidade pública voltada para o município de Frutal/MG. A ferramenta permite que cidadãos registrem ocorrências públicas, geolocalizem problemas em mapa interativo e acompanhem as respostas das autoridades competentes.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>2. Dados Coletados e Finalidade</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          Para garantir a autenticidade das solicitações, prevenir fraudes e evitar spams, coletamos os seguintes dados:
        </p>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li><strong>Nome completo</strong> — obtido via Google OAuth ou informado manualmente. Exibido publicamente junto à demanda no mapa.</li>
          <li><strong>Endereço de e-mail</strong> — obtido via Google OAuth ou informado no cadastro por e-mail e senha. Utilizado para identificação da conta e comunicações operacionais. Nunca exibido publicamente.</li>
          <li><strong>CPF</strong> — coletado obrigatoriamente no cadastro para validação de identidade e prevenção de perfis falsos. Nunca exibido publicamente.</li>
          <li><strong>Data de nascimento</strong> — coletada obrigatoriamente no cadastro como dado complementar de identificação. Nunca exibida publicamente.</li>
          <li><strong>Número de WhatsApp</strong> — coletado obrigatoriamente no cadastro para vinculação ao assistente virtual da plataforma. Nunca exibido publicamente.</li>
          <li><strong>Dados de ocorrências</strong> — endereço, coordenadas geográficas, descrição e fotos anexadas voluntariamente. Tornam-se públicos após aprovação da demanda.</li>
          <li><strong>Histórico de conversa com o bot</strong> — mensagens trocadas com o assistente virtual via WhatsApp, armazenadas para viabilizar o fluxo de registro de demandas.</li>
          <li><strong>Dados técnicos de segurança</strong> — o endereço IP de quem envia uma demanda passa pelo nosso servidor apenas para a verificação anti-bot (Cloudflare Turnstile), sem ser armazenado junto do registro. Já o endereço IP de quem responde uma demanda em nome de uma autoridade é registrado, para fins de auditoria e segurança.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>3. Visibilidade dos Dados (Transparência vs. Privacidade)</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>Em conformidade com a Lei Geral de Proteção de Dados (LGPD):</p>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li><strong>Dados visíveis publicamente:</strong> Apenas o nome do cidadão autor da solicitação, a descrição da demanda, as fotos enviadas e a localização no mapa ficam públicos após a aprovação.</li>
          <li><strong>Dados confidenciais:</strong> CPF, data de nascimento, e-mail, número de WhatsApp e histórico de conversas JAMAIS são exibidos publicamente nem compartilhados com outros usuários ou com as autoridades notificadas. Permanecem armazenados em ambiente seguro apenas para fins de gestão, auditoria e segurança.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>4. Processamento por Inteligência Artificial</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O texto das demandas, incluindo a descrição e o nome do cidadão autor, pode ser processado pela Google Gemini API para fins de moderação automatizada e para o recurso de &ldquo;Melhorar Texto&rdquo;. Esses dados são utilizados exclusivamente para as finalidades descritas e não são retidos pelos serviços de IA para treinamento de modelos.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>5. Compartilhamento de Dados com Terceiros</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          Para a prestação do serviço e garantia da segurança da plataforma, dados estritamente necessários são processados por provedores de infraestrutura parceiros:
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li><strong>Google OAuth e Google Gemini API</strong> — autenticação segura do usuário, moderação automatizada de textos e conversas com o assistente de IA (o texto integral de demandas, pets e classificados enviados é processado pelo Gemini para essa moderação).</li>
          <li><strong>Supabase</strong> — armazenamento seguro de banco de dados e gestão de sessões.</li>
          <li><strong>Resend</strong> — envio de notificações operacionais por e-mail para as autoridades públicas.</li>
          <li><strong>Esri/ArcGIS</strong> — imagens de satélite do mapa principal (seu navegador se conecta diretamente aos servidores da Esri para carregar as imagens do mapa).</li>
          <li><strong>Mapbox</strong> — geocodificação de endereços (conversão de texto em coordenadas) e miniaturas de mapa no fluxo de registro por WhatsApp.</li>
          <li><strong>Evolution API</strong> (gateway de WhatsApp, operado pela própria administração da plataforma) — intermedia as mensagens trocadas com o assistente de IA pelo WhatsApp.</li>
          <li><strong>Cloudflare Turnstile</strong> — proteção anti-spam e validação de requisições humanas.</li>
        </ul>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Nenhum dado pessoal é vendido, alugado ou comercializado com terceiros para fins publicitários.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>6. Armazenamento e Segurança</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Todos os dados são transmitidos e armazenados utilizando protocolos de criptografia de alto padrão (SSL/TLS em trânsito e criptografia em repouso via Supabase). O acesso administrativo aos dados é restrito a operadores devidamente autorizados.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>7. Seus Direitos e Exclusão de Dados (LGPD)</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>Você possui total controle sobre suas informações:</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li><strong>Exclusão Automatizada:</strong> A qualquer momento, você pode acessar a seção &ldquo;Minha Conta&rdquo; (<a href="/perfil" style={{ color: '#4256c8' }}>/perfil</a>) e utilizar o botão &ldquo;Excluir Minha Conta&rdquo; para apagar permanentemente sua conta, perfil e demandas registradas. O histórico de conversa com o assistente (site e WhatsApp) e perguntas sem resposta enviadas ao bot são desvinculados da sua identidade (deixam de estar associados à sua conta), mas as mensagens em si podem ser retidas de forma anonimizada, sem te identificar, para fins de manutenção e melhoria do assistente.</li>
          <li><strong>Solicitações Diretas:</strong> Para exercer seus direitos de acesso, correção ou eliminação de dados, entre em contato pelo e-mail abaixo. Atenderemos no prazo de até 15 dias úteis.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>8. Contato</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Para dúvidas, solicitações de exclusão ou qualquer questão relacionada à privacidade, entre em contato pelo e-mail:{' '}
          <a href="mailto:portalfrutalense@gmail.com" style={{ color: '#4256c8' }}>portalfrutalense@gmail.com</a>
        </p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginTop: '16px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#4256c8', textDecoration: 'none' }}>Voltar ao CidadanIA Frutal</Link>
      </div>
    </div>
  )
}
