'use client'

import { useAuth } from './AuthProvider'
import ModalCPF from './ModalCPF'

export default function GlobalModals() {
  const { precisaCPF } = useAuth()
  if (precisaCPF) return <ModalCPF />
  return null
}
