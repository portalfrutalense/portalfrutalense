export const metadata = { title: 'Política de Privacidade — CidadanIA Frutal' }

export default function PoliticaPrivacidade() {
  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(24px,5vw,48px) clamp(16px,4vw,24px)', fontFamily: 'Inter, system-ui, sans-serif', color: '#111827', lineHeight: 1.7 }}>
      <div style={{ marginBottom: '32px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '.08em' }}>CidadanIA Frutal</span>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: '8px 0 4px' }}>Política de Privacidade</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Última atualização: agosto de 2026</p>
      </div>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>1. Sobre o CidadanIA Frutal</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          O CidadanIA Frutal é uma plataforma de transparência cívica do município de Frutal — MG. Seu objetivo é facilitar a comunicação entre cidadãos e autoridades públicas, permitindo o registro de denúncias e ocorrências de interesse público.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>2. Dados coletados</h2>
        <p style={{ margin: '0 0 12px', fontSize: '15px', color: '#111827' }}>
          Ao registrar uma denúncia ou ocorrência, coletamos:
        </p>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '15px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li><strong>Nome completo</strong> — exibido publicamente junto à denúncia ou ocorrência.</li>
          <li><strong>CPF</strong> (quando informado) — utilizado apenas para verificação de identidade, nunca exibido publicamente.</li>
          <li><strong>Conta Google</strong> (quando utilizada) — coletamos somente o nome da conta para identificação. Não acessamos e-mail, contatos, arquivos ou qualquer outro dado.</li>
          <li><strong>Descrição e localização</strong> da ocorrência ou denúncia — conteúdo público após aprovação.</li>
          <li><strong>Fotos</strong> (opcionais) — enviadas pelo cidadão e exibidas publicamente junto à ocorrência.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>3. Finalidade do uso dos dados</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Os dados coletados são utilizados exclusivamente para identificar o autor de uma denúncia ou ocorrência e garantir que se trata de uma pessoa real. Não utilizamos os dados para fins comerciais, publicidade ou compartilhamento com terceiros.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>4. Armazenamento e segurança</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Os dados são armazenados de forma segura na plataforma Supabase, com criptografia em repouso e em trânsito. O acesso ao painel administrativo é restrito a usuários autorizados pelo CidadanIA Frutal.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>5. Dados públicos</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Após aprovação pela equipe do Portal, denúncias e ocorrências — incluindo nome do autor, descrição e fotos — tornam-se visíveis publicamente no site. O CPF nunca é exibido publicamente.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>6. Seus direitos</h2>
        <p style={{ margin: '0 0 8px', fontSize: '15px', color: '#111827' }}>
          Você pode solicitar a exclusão dos seus dados ou de uma denúncia/ocorrência publicada entrando em contato pelo e-mail abaixo. Atenderemos no prazo de até 15 dias úteis.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>7. Contato</h2>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827' }}>
          Para dúvidas, solicitações de exclusão ou qualquer questão relacionada à privacidade, entre em contato pelo e-mail: <a href="mailto:portalfrutalense@gmail.com" style={{ color: '#1e3a5f' }}>portalfrutalense@gmail.com</a>
        </p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginTop: '16px' }}>
        <a href="/" style={{ fontSize: '13px', color: '#1e3a5f', textDecoration: 'none' }}>Voltar ao CidadanIA Frutal</a>
      </div>
    </main>
  )
}

