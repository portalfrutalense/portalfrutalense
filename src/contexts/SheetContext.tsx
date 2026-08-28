'use client'

import { createContext, useContext, useState } from 'react'

type SheetState = 'peek' | 'half' | 'full' | null

interface SheetContextType {
  sheetState: SheetState
  setSheetState: (s: SheetState) => void
}

const SheetContext = createContext<SheetContextType>({ sheetState: null, setSheetState: () => {} })

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [sheetState, setSheetState] = useState<SheetState>(null)
  return (
    <SheetContext.Provider value={{ sheetState, setSheetState }}>
      {children}
    </SheetContext.Provider>
  )
}

export function useSheet() {
  return useContext(SheetContext)
}
