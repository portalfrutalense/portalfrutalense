import { createClient } from '@supabase/supabase-js'

// Cliente com service role key — bypassa RLS. Usar APENAS em API routes (servidor).
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
