'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from './AuthProvider'
import { validarCPF, formatarCPF } from '@/lib/cpf'

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

// Converte dd/mm/aaaa → aaaa-mm-dd para salvar no banco
function dataParaISO(valor: string) {
  const partes = valor.split('/')
  if (partes.length !== 3 || partes[2].length !== 4) return null
  return `${partes[2]}-${partes[1]}-${partes[0]}`
}

export default function ModalCPF() {
  const { user, setPerfil, sair } = useAuth()
  const supabase = createClient()
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
    const whatsappLimpo = whatsapp.replace(/\D/g, '')
    if (whatsappLimpo.length < 11) { setErro('Informe o WhatsApp com DDD e os 9 dígitos.'); return }
    if (!user) return
    setEnviando(true)
    try {
      const cpfLimpo = cpf.replace(/\D/g, '')

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

      // Vincula conversa WhatsApp pendente via API (usa service role, bypass RLS)
      const { data: { session } } = await supabase.auth.getSession()
      const resVinculo = await fetch('/api/cidadao/vincular-whatsapp-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ telefone: whatsappParaSalvar(whatsapp) }),
      })
      const vinculo = await resVinculo.json()

      const dadosPerfil = { id: user.id, nome: nome.trim(), cpf: cpfLimpo, email: user.email || undefined, role: perfilExistente?.role }

      if (vinculo.conversaVinculada) {
        // Guarda os dados do perfil e mostra tela de WhatsApp — NÃO chama setPerfil aqui
        // (setPerfil fecha o modal, precisamos manter aberto até o usuário clicar)
        setPerfilPendente(dadosPerfil)
        setVoltarWhatsapp(true)
        return
      }

      // Sem conversa pendente — fecha o modal normalmente
      setPerfil(dadosPerfil)
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: string; hint?: string }
      console.error('[ModalCPF] falha ao salvar perfil:', {
        code: err.code, message: err.message, details: err.details, hint: err.hint,
      })
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
              window.location.href = '/'
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', padding: '4px', textDecoration: 'underline' }}
          >
            Fechar
          </button>
        </form>
      </div>
    </div>
  )
}
