'use client'

import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function AdminTopbar() {
  const router = useRouter()

  async function handleLogout() {
    const client = createClient()
    await client.auth.signOut()
    router.refresh()
  }

  return (
    <header style={{
      backgroundColor: '#1e3a5f',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '52px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }}>
      <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>
        Portal Frutalense
      </span>
      <button
        onClick={handleLogout}
        style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.75)',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          padding: '6px 14px',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Sair
      </button>
    </header>
  )
}
