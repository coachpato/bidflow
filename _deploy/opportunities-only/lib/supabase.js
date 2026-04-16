import { createClient } from '@supabase/supabase-js'

// This client is used SERVER-SIDE only (in API routes)
// It uses the service role key to bypass Row Level Security for file operations
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// The storage bucket name in your Supabase project
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'tender-docs'

let bucketReadyPromise = null

export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are not set. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function ensureStorageBucket() {
  if (bucketReadyPromise) return bucketReadyPromise

  bucketReadyPromise = (async () => {
    const supabase = getSupabaseAdmin()
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      throw new Error(`Unable to inspect Supabase storage buckets: ${listError.message}`)
    }

    const existingBucket = buckets?.find(bucket =>
      bucket.id === STORAGE_BUCKET || bucket.name === STORAGE_BUCKET
    )

    if (existingBucket) return existingBucket

    const { data: createdBucket, error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
    })

    if (createError) {
      throw new Error(`Unable to create Supabase bucket "${STORAGE_BUCKET}": ${createError.message}`)
    }

    return createdBucket
  })().catch(error => {
    bucketReadyPromise = null
    throw error
  })

  return bucketReadyPromise
}
