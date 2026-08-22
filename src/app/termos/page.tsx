export const metadata = { title: 'Termos de Uso — CidadanIA Frutal' }

export default function TermosDeUso() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(24px,5vw,48px) clamp(16px,4vw,24px)', fontFamily: 'Inter, system-ui, sans-serif', color: '#111827', lineHeight: 1.7 }}>
      <div style={{ marginBottom: '32px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#4256c8', textTransform: 'uppercase', letterSpacing: '.08em' }}>CidadanIA Frutal</span>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: '8px 0 4px' }}>Termos de Uso e Serviço</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Última atualização: agosto de 2026</p>
      </div>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>1. Aceitação dos termos</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Ao acessar ou utilizar o CidadanIA Frutal, você concorda com estes Termos de Uso. Se não concordar com alguma parte, pedimos que não utilize a plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>2. O que é o CidadanIA Frutal</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O CidadanIA Frutal é uma plataforma digital de transparência cívica voltada para o município de Frutal — MG. Permite que cidadãos registrem denúncias, sinalizem ocorrências urbanas e acompanhem as respostas das autoridades públicas.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>3. Uso responsável</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>Ao utilizar a plataforma, você se compromete a:</p>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>Fornecer informações verdadeiras e precisas ao se identificar.</li>
          <li>Registrar apenas denúncias e ocorrências reais, de interesse público.</li>
          <li>Não publicar conteúdo ofensivo, discriminatório, falso ou difamatório.</li>
          <li>Não utilizar a plataforma para fins comerciais, políticos ou de assédio.</li>
          <li>Não tentar comprometer a segurança ou o funcionamento do sistema.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>4. Conteúdo publicado</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Todo conteúdo registrado (denúncias, ocorrências e fotos) passa por análise antes de ser publicado. O CidadanIA Frutal reserva-se o direito de recusar ou remover qualquer conteúdo que viole estes termos, seja falso, ofensivo ou inadequado, sem aviso prévio.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>5. Responsabilidade pelo conteúdo</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O conteúdo publicado é de responsabilidade do cidadão que o registrou. O CidadanIA Frutal não se responsabiliza por informações falsas ou imprecisas enviadas pelos usuários, mas tomará as medidas necessárias para remover conteúdo inadequado quando identificado ou reportado.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>6. Disponibilidade do serviço</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O CidadanIA Frutal é oferecido gratuitamente e pode sofrer interrupções para manutenção ou melhorias. Não garantimos disponibilidade contínua e ininterrupta da plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>7. Alterações nos termos</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Podemos atualizar estes Termos de Uso a qualquer momento. Alterações significativas serão comunicadas na plataforma. O uso continuado após as alterações implica aceitação dos novos termos.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#4256c8', marginBottom: '8px' }}>8. Contato</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Para dúvidas sobre estes termos, entre em contato pelo e-mail: <a href="mailto:portalfrutalense@gmail.com" style={{ color: '#4256c8' }}>portalfrutalense@gmail.com</a>
        </p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginTop: '16px' }}>
        <a href="/" style={{ fontSize: '13px', color: '#4256c8', textDecoration: 'none' }}>Voltar ao CidadanIA Frutal</a>
      </div>
    </main>
  )
}

