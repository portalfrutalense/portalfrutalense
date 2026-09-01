'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import { validarCPF, formatarCPF } from '@/lib/cpf'
import { telefoneValido } from '@/lib/mascaraTelefone'

function capitalizarNome(str: string) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

function mascaraWhatsapp(valor: string) {
  // Aceita só dígitos, máximo 11 (DDD + 9 dígitos)
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function whatsappParaSalvar(valor: string) {
  // Remove máscara e adiciona 55 na frente
  return '55' + valor.replace(/\D/g, '')
}

function mascaraData(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2)
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4)
}

// Converte dd/mm/aaaa → aaaa-mm-dd para salvar no banco.
// BUG CORRIGIDO: antes só conferia 3 partes e ano com 4 dígitos — uma data
// que não existe (ex: 99/99/9999, 31/02/2020) passava e virava erro cru do
// Postgres no insert. Agora confere se a data existe de verdade (dia/mês
// válidos pro calendário, sem depender de conversão automática do JS) e
// rejeita data de nascimento no futuro.
function dataParaISO(valor: string) {
  const partes = valor.split('/')
  if (partes.length !== 3 || partes[2].length !== 4) return null
  const dia = Number(partes[0])
  const mes = Number(partes[1])
  const ano = Number(partes[2])
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null

  const data = new Date(ano, mes - 1, dia)
  // new Date com dia/mês fora do intervalo "rola" pro mês seguinte (ex: 31/02
  // vira 03/03) em vez de dar erro — comparar os campos de volta detecta isso.
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (data > hoje) return null

  return `${partes[2]}-${partes[1]}-${partes[0]}`
}

export default function ModalCPF() {
  const { user, setPerfil } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState(
    capitalizarNome(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
  )
  const [whatsapp, setWhatsapp] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')  // dd/mm/aaaa
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [voltarWhatsapp, setVoltarWhatsapp] = useState(false)
  const [perfilPendente, setPerfilPendente] = useState<Parameters<typeof setPerfil>[0] | null>(null)

  function handleCPF(valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 11)
    setCpf(limpo ? formatarCPF(limpo) : '')
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome completo.'); return }
    if (!validarCPF(cpf)) { setErro('CPF inválido. Verifique e tente novamente.'); return }
    const dataISO = dataParaISO(dataNascimento)
    if (!dataISO) { setErro('Data de nascimento inválida. Use o formato dd/mm/aaaa.'); return }
    if (!telefoneValido(whatsapp)) { setErro('Informe o WhatsApp com DDD e os 9 dígitos.'); return }
    if (!user) return
    setEnviando(true)
    try {
      const cpfLimpo = cpf.replace(/\D/g, '')

      // BUG CORRIGIDO: as pré-checagens de duplicidade de e-mail/CPF/WhatsApp
      // que existiam aqui (SELECT em `perfis` filtrando por outro usuário)
      // nunca funcionaram — a única policy de SELECT da tabela é
      // `auth.uid() = id`, então a consulta sempre voltava vazia e a
      // checagem nunca detectava duplicata nenhuma, mesmo quando existia. A
      // proteção real contra duplicata é a constraint UNIQUE do banco
      // (cpf/email), que rejeita no insert/update — o catch abaixo trata
      // esse erro (23505) com mensagem amigável.

      // Verifica se o perfil já existe (ex: usuário master que ainda não preencheu CPF)
      const { data: perfilExistente, error: erroLeitura } = await supabase
        .from('perfis').select('id, role').eq('id', user.id).maybeSingle()
      if (erroLeitura) throw erroLeitura

      const campos: Record<string, unknown> = {
        nome: nome.trim(),
        cpf: cpfLimpo,
        whatsapp: whatsappParaSalvar(whatsapp),
        data_nascimento: dataISO,
      }

      let error
      if (perfilExistente) {
        ;({ error } = await supabase.from('perfis').update(campos).eq('id', user.id))
      } else {
        ;({ error } = await supabase.from('perfis').insert({ id: user.id, email: user.email || null, role: 'cidadao', ...campos }))
      }
      if (error) throw error

      // A partir daqui o perfil JÁ FOI salvo com sucesso — uma falha no passo
      // de vínculo do WhatsApp (rede, resposta inesperada) não pode mais
      // cair no catch de fora, porque aquele catch mostra "Erro ao salvar",
      // o que seria falso: o cadastro deu certo, só esse passo extra que
      // falhou. Por isso esse try/catch é separado do de fora.
      const dadosPerfil = { id: user.id, nome: nome.trim(), cpf: cpfLimpo, email: user.email || undefined, role: perfilExistente?.role }
      let conversaVinculada = false
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const resVinculo = await fetch('/api/cidadao/vincular-whatsapp-cadastro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ telefone: whatsappParaSalvar(whatsapp) }),
        })
        if (resVinculo.ok) {
          const vinculo = await resVinculo.json()
          conversaVinculada = !!vinculo.conversaVinculada
        } else {
          console.error('[ModalCPF] vincular-whatsapp-cadastro respondeu erro:', resVinculo.status)
        }
      } catch (eVinculo) {
        console.error('[ModalCPF] falha ao vincular conversa do WhatsApp (perfil já salvo):', eVinculo)
      }

      if (conversaVinculada) {
        // Guarda os dados do perfil e mostra tela de WhatsApp — NÃO chama setPerfil aqui
        // (setPerfil fecha o modal, precisamos manter aberto até o usuário clicar)
        setPerfilPendente(dadosPerfil)
        setVoltarWhatsapp(true)
        return
      }

      // Sem conversa pendente (ou o vínculo falhou) — fecha o modal normalmente,
      // o cadastro em si já está garantido
      setPerfil(dadosPerfil)
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: string; hint?: string }
      console.error('[ModalCPF] falha ao salvar perfil:', {
        code: err.code, message: err.message, details: err.details, hint: err.hint,
      })
      // BUG CORRIGIDO: erro 23505 (unique_violation) é a constraint UNIQUE do
      // banco barrando um CPF/e-mail duplicado (única proteção real, já que
      // as pré-checagens no cliente nunca funcionavam — ver comentário acima).
      // Antes disso caía no texto cru do Postgres ("23505 — duplicate key
      // value violates unique constraint..."), incompreensível pro cidadão.
      if (err.code === '23505') {
        const msg = err.message || ''
        if (msg.includes('cpf')) {
          setErro('Este CPF já está cadastrado em outra conta.')
        } else if (msg.includes('email')) {
          setErro('Este e-mail já está cadastrado em outra conta.')
        } else {
          setErro('Estes dados já estão cadastrados em outra conta.')
        }
        return
      }
      const detalhe = [err.code, err.message].filter(Boolean).join(' — ')
      setErro(detalhe ? `Erro ao salvar: ${detalhe}` : 'Erro ao salvar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (voltarWhatsapp) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '380px', padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <p style={{ fontSize: '32px', margin: 0 }}>✅</p>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Cadastro concluído!</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>Volte para o WhatsApp e continue de onde parou.</p>
          <a
            href="https://wa.me/5534992115756?text=Pronto%2C+j%C3%A1+fiz+o+login"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { if (perfilPendente) setPerfil(perfilPendente) }}
            style={{ backgroundColor: '#25d366', color: 'white', fontWeight: 700, padding: '13px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', width: '100%', boxSizing: 'border-box' }}
          >
            Retornar ao WhatsApp
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '380px', overflow: 'hidden' }}>
        <form onSubmit={handleEnviar} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <p style={{ fontSize: '14px', color: '#111827', margin: '0 0 4px', lineHeight: 1.5 }}>
              Para continuar, precisamos de mais algumas informações.
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Seus dados nunca serão exibidos publicamente.</p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>Nome completo *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
              required
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
            {nome && <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>Pré-preenchido com sua conta Google. Corrija se necessário.</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>CPF *</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => handleCPF(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              required
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '15px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>Data de nascimento *</label>
            <input
              type="text"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(mascaraData(e.target.value))}
              placeholder="dd/mm/aaaa"
              maxLength={10}
              required
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>WhatsApp *</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(mascaraWhatsapp(e.target.value))}
              placeholder="(34) 99999-9999"
              required
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.03em' }}
            />
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>DDD + número. Ex: (34) 99999-9999</p>
          </div>

          {erro && (
            <div style={{ color: '#dc2626', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '13px' }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            style={{ backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 700, padding: '13px', borderRadius: '8px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '15px' }}
          >
            {enviando ? 'Salvando...' : 'Confirmar e entrar'}
          </button>

          <button
            type="button"
            onClick={async () => {
              if (!confirm('Tem certeza? Seu acesso será removido e você precisará entrar novamente para completar o cadastro.')) return
              const { data: { session } } = await supabase.auth.getSession()
              if (session?.access_token) {
                await fetch('/api/cidadao/cancelar-cadastro', {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${session.access_token}` },
                })
              }
              await supabase.auth.signOut()
              router.push('/')
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', padding: '4px', textDecoration: 'underline' }}
          >
            {/* BUG CORRIGIDO: rótulo era "Fechar", mas o botão exclui a conta
                (DELETE /api/cidadao/cancelar-cadastro + signOut) — induzia o
                usuário a clicar achando que só fecharia o modal. */}
            Cancelar cadastro e sair
          </button>
        </form>
      </div>
    </div>
  )
}
