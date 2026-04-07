import { createClient } from '@supabase/supabase-js'

// This client is used SERVER-SIDE only (in API routes)
// It uses the service role key to bypass Row Level Security for file operations
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// The storage bucket name in your Supabase project
export const STORAGE_BUCKET = 'tender-docs'

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are not set. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}
