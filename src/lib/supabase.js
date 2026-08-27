import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'Manjkata VITE_SUPABASE_URL in/ali VITE_SUPABASE_ANON_KEY. Kopiraj .env.example v .env in ju izpolni.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')
