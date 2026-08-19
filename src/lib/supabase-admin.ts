import { createClient } from '@supabase/supabase-js'

// Cliente administrativo (usado APENAS no servidor - API routes)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
