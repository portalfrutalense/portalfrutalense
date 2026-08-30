import Link from 'next/link'

const titulo = 'Termos de Uso — CidadanIA Frutal'
const descricao = 'Termos de Uso e Serviço da plataforma CidadanIA Frutal.'

export const metadata = {
  title: titulo,
  description: descricao,
  alternates: { canonical: 'https://cidadaniafrutal.com.br/termos' },
  openGraph: { title: titulo, description: descricao, url: 'https://cidadaniafrutal.com.br/termos' },
  twitter: { title: titulo, description: descricao },
}

export default function TermosDeUso() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(24px,5vw,48px) clamp(16px,4vw,24px)', fontFamily: 'Inter, system-ui, sans-serif', color: '#111827', lineHeight: 1.7 }}>
      <div style={{ marginBottom: '32px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#4256c8', textTransform: 'uppercase', letterSpacing: '.08em' }}>CidadanIA Frutal</span>
        <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, color: '#111827', margin: '8px 0 4px' }}>Termos de Uso e Serviço</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Última atualização: agosto de 2026</p>
      </div>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>1. Aceitação dos Termos</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Ao acessar ou utilizar a plataforma CidadanIA Frutal (desenvolvida e mantida pelo Portal Frutalense), você declara ter lido, compreendido e aceito estes Termos de Uso e a nossa Política de Privacidade. Se não concordar com qualquer condição, não utilize a plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>2. Sobre o CidadanIA Frutal</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O CidadanIA Frutal é uma plataforma digital de transparência cívica, zeladoria urbana e de utilidade pública voltada para o município de Frutal/MG. A ferramenta permite que cidadãos registrem ocorrências públicas (como problemas em vias, iluminação e serviços), geolocalizem problemas em mapa interativo e acompanhem as respostas das autoridades competentes.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>3. Cadastro, Autenticação e Privacidade dos Dados</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          <strong>Autenticação Segura:</strong> O acesso a funcionalidades de envio de demandas exige autenticação prévia — via Google OAuth ou cadastro com e-mail e senha — e a validação de dados de identificação, incluindo nome completo, CPF válido, data de nascimento e número de WhatsApp. A autenticação é utilizada exclusivamente para confirmar a identidade do usuário e prevenir a criação de perfis automatizados ou falsos.
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '15px', color: '#111827' }}><strong>Dados Públicos vs. Dados Privados:</strong></p>
        <ul style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li><strong>O que é público:</strong> Apenas o Nome do cidadão poderá ser associado à demanda e exibido publicamente no mapa.</li>
          <li><strong>O que é estritamente privado:</strong> CPF, data de nascimento, e-mail e número de WhatsApp JAMAIS serão exibidos publicamente, ficando armazenados de forma confidencial e segura apenas para fins de validação do cadastro e prevenção de fraudes.</li>
        </ul>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          <strong>Veracidade:</strong> O usuário garante a veracidade dos dados fornecidos no cadastro, sendo vedada a criação de perfis com dados de terceiros ou falsas identidades.
        </p>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          <strong>Bloqueio de Conta:</strong> O CidadanIA Frutal reserva-se o direito de suspender ou bloquear contas que violem estes termos, apresentem comportamento malicioso ou insiram dados falsos.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>4. Uso Responsável e Conduta do Usuário</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>Ao utilizar a plataforma, você se compromete a:</p>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>Registrar apenas ocorrências reais, verídicas e de interesse público da cidade de Frutal/MG.</li>
          <li>Não enviar conteúdos falsos, difamatórios, injuriosos, ofensivos, discriminatórios, com linguagem de ódio ou pornografia.</li>
          <li>Não utilizar o sistema para fins comerciais, propaganda eleitoral/política, assédio ou difamação pessoal.</li>
          <li>Não tentar burlar os sistemas de segurança, APIs, captchas ou fazer uso automatizado (bots/scripts) da plataforma.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>5. Moderação Automatizada por Inteligência Artificial (IA)</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          <strong>Processamento por IA:</strong> Todo conteúdo de demanda (texto, descrição e categorias) pode ser processado e moderado automaticamente por modelos de Inteligência Artificial (Google Gemini API). Para fins de moderação, o nome do cidadão autor da demanda também é incluído no contexto enviado à IA.
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          <strong>Aprovação e Rejeição:</strong> A IA avalia a legitimidade da demanda, podendo aprovar a publicação no mapa ou rejeitar conteúdos inadequados automaticamente ou via moderação manual da administração.
        </p>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          <strong>Aprimoramento de Texto:</strong> O uso do recurso de &ldquo;Melhorar Texto&rdquo; utiliza IA para reescrever e corrigir a descrição fornecida, cabendo ao usuário revisar o resultado final antes do envio.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>6. Assistente Virtual e WhatsApp</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          A plataforma disponibiliza um assistente virtual via WhatsApp (CidadanIA Frutal Bot) que permite o registro de ocorrências por mensagem de texto. Ao interagir com o bot, o número de telefone e o histórico de mensagens trocadas são armazenados para viabilizar o fluxo de cadastro e registro de demandas. Essas informações são tratadas com a mesma confidencialidade dos demais dados pessoais.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>7. Divulgação de Ocorrências e Notificação a Autoridades</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          <strong>Visibilidade Pública:</strong> As demandas aprovadas, juntamente com a localização no mapa, foto anexada e o status de resolução, tornam-se informações de acesso público.
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          <strong>Notificação via E-mail:</strong> As solicitações registradas podem ser encaminhadas para as entidades e autoridades públicas vinculadas via e-mail, contendo links temporários para resposta oficial.
        </p>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          <strong>Respostas Oficiais:</strong> O CidadanIA Frutal atua como ponte de comunicação e não se responsabiliza pelo prazo, conteúdo ou pela efetiva execução das soluções prometidas pelas autoridades notificadas.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>8. Serviços de Terceiros e Tecnologias</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Para o funcionamento dos mapas, geolocalização, login e segurança, a plataforma utiliza serviços de terceiros: Google OAuth, Google Gemini API, Supabase, Resend, Leaflet, Mapbox e Cloudflare Turnstile. O uso desses recursos está sujeito aos termos de serviço dos respectivos provedores.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>9. Responsabilidade pelo Conteúdo</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O conteúdo publicado (relatos, fotos e coordenadas) é de responsabilidade do cidadão que o registrou. O CidadanIA Frutal não se responsabiliza por informações falsas fornecidas por usuários, mas removerá qualquer conteúdo inadequado logo que identificado ou reportado.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>10. Disponibilidade e Alterações no Serviço</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          A plataforma é oferecida gratuitamente aos cidadãos e pode passar por interrupções temporárias para manutenção ou melhorias. Reservamo-nos o direito de alterar estes Termos de Uso a qualquer momento, comunicando alterações significativas na plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>11. Contato</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Para dúvidas, relatar problemas ou solicitar informações sobre estes termos, entre em contato pelo e-mail:{' '}
          <a href="mailto:portalfrutalense@gmail.com" style={{ color: '#4256c8' }}>portalfrutalense@gmail.com</a>
        </p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginTop: '16px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#4256c8', textDecoration: 'none' }}>Voltar ao CidadanIA Frutal</Link>
      </div>
    </div>
  )
}
