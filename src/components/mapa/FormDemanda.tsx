'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useAuth } from '../AuthProvider'
import MiniMapaConfirmar from '../MiniMapaConfirmar'
import Turnstile from '../Turnstile'
import { CategoriaMapa, Entidade } from '@/types'

/* ------------------------------------------------------------ helpers --- */

async function comprimirFoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 600
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha')), 'image/jpeg', 0.25)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Inválida')) }
    img.src = url
  })
}

/* =========================================================== FormDemanda = */

export function FormDemanda({
  aberto,
  aoFechar,
  aoSalvar,
  categorias,
  entidades,
  catEntidades,
}: {
  aberto: boolean
  aoFechar: () => void
  aoSalvar: () => void
  categorias: CategoriaMapa[]
  entidades: Entidade[]
  catEntidades: Record<string, string[]>
}) {
  const supabase = createClient()
  const { user, perfil } = useAuth()

  const [descricao, setDescricao] = useState('')
  const [melhorandoTexto, setMelhorandoTexto] = useState(false)
  const [categoriaId, setCategoriaId] = useState('')
  const [entidadeIds, setEntidadeIds] = useState<string[]>([])
  const [dropdownAutoridade, setDropdownAutoridade] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!dropdownAutoridade) return
    function fecharFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAutoridade(false)
      }
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [dropdownAutoridade])
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [locConfirmada, setLocConfirmada] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  function mostrarErro(msg: string) { setErro(msg); setTimeout(() => setErro(''), 5000) }
  const [sucesso, setSucesso] = useState(false)

  function resetar() {
    setDescricao(''); setCategoriaId(''); setEntidadeIds([]); setDropdownAutoridade(false)
    setCoordenadas(null); setLocConfirmada(false); setFotoFile(null); setFotoPreview(null); setTurnstileToken('')
    setErro(''); setSucesso(false)
  }

  function fechar() { resetar(); aoFechar() }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function melhorarDescricao() {
    if (!descricao.trim() || melhorandoTexto) return
    setMelhorandoTexto(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ia/melhorar-texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ texto: descricao }),
      })
      const data = await res.json()
      if (res.ok && data.texto) setDescricao(data.texto)
    } catch {
      // silencioso — o texto original permanece se algo falhar
    } finally {
      setMelhorandoTexto(false)
    }
  }

  async function handleEnviar() {
    // Valida todos os campos de uma vez
    if (!categoriaId) { mostrarErro('Selecione a categoria.'); return }
    if (entidadeIds.length === 0) { mostrarErro('Selecione ao menos uma autoridade responsável.'); return }
    if (!coordenadas || !locConfirmada) { mostrarErro('Confirme a localização no mapa.'); return }
    if (!descricao.trim() || descricao.trim().length < 10) { mostrarErro('Descreva melhor o problema.'); return }
    if (!turnstileToken) { mostrarErro('Aguarde a verificação de segurança concluir.'); return }
    if (!user || !perfil) return
    setErro('')
    setEnviando(true)

    let foto_url: string | null = null
    if (fotoFile) {
      try {
        const blob = await comprimirFoto(fotoFile)
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadError } = await supabase.storage.from('demandas-fotos').upload(path, blob, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        foto_url = supabase.storage.from('demandas-fotos').getPublicUrl(path).data.publicUrl
      } catch (err: any) { mostrarErro(`Erro ao enviar foto: ${err?.message || JSON.stringify(err)}`); setEnviando(false); return }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/demandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ descricao: descricao.trim(), lat: coordenadas.lat, lng: coordenadas.lng, categoria_id: categoriaId, entidade_ids: entidadeIds, foto_url, endereco_label: coordenadas.label, turnstile_token: turnstileToken }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSucesso(true)
      aoSalvar()
      resetar()
      setSucesso(true) // mantém sucesso visível após resetar
    } catch (err: any) {
      mostrarErro(err.message || 'Erro ao enviar.')
    } finally { setEnviando(false) }
  }

  if (!aberto) return null

  const opcoesAutoridade = categoriaId ? entidades.filter(en => catEntidades[categoriaId]?.includes(en.id)) : entidades

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '10px', width: '100%', maxWidth: '440px', height: 'auto', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '8px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '15px' }}>Registrar uma nova demanda</h2>
          <button onClick={fechar} style={{ position: 'absolute', right: '20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#6b7280', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {sucesso ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '16px', margin: '0 0 8px' }}>Demanda registrada!</p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 }}>
              Sua demanda está em análise. Se aprovada pelo nosso Agente IA, aparecerá no mapa e a autoridade será notificada por e-mail.
            </p>
            <button onClick={fechar} style={{ fontSize: '13px', color: '#4256c8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fechar</button>
          </div>
        ) : (
          <>
            {/* Conteúdo com scroll */}
            <form id="form-registrar-demanda" onSubmit={(e) => { e.preventDefault(); handleEnviar() }}
              style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Categoria *</label>
                <div style={{ position: 'relative' }}>
                  <select value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setEntidadeIds([]) }}
                    style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 36px 8px 12px', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', background: 'white', outline: 'none', boxSizing: 'border-box', appearance: 'none', WebkitAppearance: 'none', color: categoriaId ? '#111827' : '#6b7280', cursor: 'pointer' }}>
                    <option value="">Selecione</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#6b7280', pointerEvents: 'none' }}>▼</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Autoridade responsável * <span style={{ fontWeight: 400 }}>(até 3)</span></label>
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setDropdownAutoridade(!dropdownAutoridade)}
                    style={{ width: '100%', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: entidadeIds.length === 0 ? '#6b7280' : '#111827', boxSizing: 'border-box' }}>
                    <span>{entidadeIds.length === 0 ? 'Selecione a(s) autoridade(s)' : `${entidadeIds.length} selecionada${entidadeIds.length > 1 ? 's' : ''}`}</span>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>{dropdownAutoridade ? '▲' : '▼'}</span>
                  </button>
                  {dropdownAutoridade && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 -4px 16px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
                      {opcoesAutoridade.length === 0 ? (
                        <p style={{ margin: 0, padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>Nenhuma autoridade disponível.</p>
                      ) : opcoesAutoridade.map(en => {
                        const selecionado = entidadeIds.includes(en.id)
                        const desabilitado = !selecionado && entidadeIds.length >= 3
                        return (
                          <label key={en.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: desabilitado ? 'not-allowed' : 'pointer', borderBottom: '1px solid #f9fafb', opacity: desabilitado ? 0.4 : 1, background: selecionado ? '#eff6ff' : 'white' }}>
                            <input type="checkbox" checked={selecionado} disabled={desabilitado}
                              onChange={() => setEntidadeIds(prev => selecionado ? prev.filter(id => id !== en.id) : prev.length >= 3 ? prev : [...prev, en.id])}
                              style={{ accentColor: '#4256c8', width: '15px', height: '15px', flexShrink: 0 }} />
                            <div>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>{en.nome}</p>
                              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{en.cargo}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
                {categoriaId && !catEntidades[categoriaId]?.length && (
                  <p style={{ fontSize: '11px', color: '#92400e', margin: '4px 0 0' }}>Nenhuma autoridade vinculada a essa categoria ainda. Contate o administrador.</p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Endereço *</label>
                <MiniMapaConfirmar
                  altura={240}
                  onConfirmar={(endereco, lat, lng) => { setCoordenadas({ lat, lng, label: endereco }); setLocConfirmada(true) }}
                  onAlterar={() => { setCoordenadas(null); setLocConfirmada(false) }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>Descrição *</label>
                <div style={{ position: 'relative' }}>
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o problema em detalhes..."
                    style={{ width: '100%', minHeight: '100px', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', paddingBottom: '32px', fontSize: '14px', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                  <button type="button" onClick={melhorarDescricao} disabled={!descricao.trim() || melhorandoTexto}
                    title="Melhorar texto com IA"
                    style={{ position: 'absolute', right: '8px', bottom: '8px', display: 'flex', alignItems: 'center', gap: '4px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: descricao.trim() ? '#4256c8' : '#9ca3af', cursor: !descricao.trim() || melhorandoTexto ? 'default' : 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    {melhorandoTexto ? (
                      <span>Melhorando...</span>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24">
                          <defs>
                            <linearGradient id="gradienteMelhorar" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#4285f4" />
                              <stop offset="50%" stopColor="#9b72cb" />
                              <stop offset="100%" stopColor="#d96570" />
                            </linearGradient>
                          </defs>
                          <path d="M11.47 2.365a.5.5 0 01.963 0l1.582 6.135a2 2 0 001.437 1.437l6.135 1.582a.5.5 0 010 .963l-6.135 1.582a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.963 0l-1.582-6.135a2 2 0 00-1.437-1.437L2.316 12.482a.5.5 0 010-.963l6.135-1.582a2 2 0 001.437-1.437z" fill="url(#gradienteMelhorar)" />
                        </svg>
                        <span>Melhorar o texto com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>
                  Foto <span style={{ color: '#6b7280', fontWeight: 400 }}>(opcional)</span>
                </label>
                {!fotoPreview ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Com capture o celular abre a camera; sem capture abre a galeria */}
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '56px', border: '2px dashed #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#4256c8', fontWeight: 600 }}>
                      <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} style={{ display: 'none' }} />
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                      Tirar foto
                    </label>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '56px', border: '2px dashed #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                      <input type="file" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                      Galeria
                    </label>
                  </div>
                ) : (
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb', height: '56px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                      style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                )}
              </div>

              <Turnstile size="flexible" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
            </form>

            {/* Rodapé fixo */}
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 20px', flexShrink: 0 }}>
              {erro && <div style={{ marginBottom: '8px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '7px 12px', fontSize: '12.5px' }}>{erro}</div>}
              <button type="submit" form="form-registrar-demanda" disabled={enviando}
                style={{ width: '100%', backgroundColor: enviando ? '#6b7280' : '#4256c8', color: 'white', fontWeight: 600, padding: '10px', borderRadius: '6px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                {enviando ? 'Enviando...' : 'Registrar Demanda'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
