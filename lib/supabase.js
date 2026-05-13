import { createClient } from '@supabase/supabase-js'

// This client is used SERVER-SIDE only (in API routes)
// It uses the service role key to bypass Row Level Security for file operations
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// The storage bucket name in your Supabase project
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'tender-docs'
export const STORAGE_VIEW_URL_TTL_SECONDS = Number.parseInt(process.env.SUPABASE_SIGNED_VIEW_TTL_SECONDS || '3600', 10)
export const STORAGE_DOWNLOAD_URL_TTL_SECONDS = Number.parseInt(process.env.SUPABASE_SIGNED_DOWNLOAD_TTL_SECONDS || '86400', 10)

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

    if (existingBucket) {
      if (existingBucket.public) {
        const { data: updatedBucket, error: updateError } = await supabase.storage.updateBucket(STORAGE_BUCKET, {
          public: false,
        })

        if (updateError) {
          throw new Error(`Unable to make Supabase bucket "${STORAGE_BUCKET}" private: ${updateError.message}`)
        }

        return updatedBucket || { ...existingBucket, public: false }
      }

      return existingBucket
    }

    const { data: createdBucket, error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
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

export function getStoragePathFromFilepath(filepath) {
  if (typeof filepath !== 'string' || !filepath.trim()) return null

  if (!/^https?:\/\//i.test(filepath)) {
    return filepath.replace(/^\/+/, '')
  }

  try {
    const url = new URL(filepath)
    const markers = [
      `/object/public/${STORAGE_BUCKET}/`,
      `/object/sign/${STORAGE_BUCKET}/`,
    ]

    for (const marker of markers) {
      const markerIndex = url.pathname.indexOf(marker)
      if (markerIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
      }
    }
  } catch {
    return null
  }

  return null
}

export async function createSignedStorageUrl(storagePath, {
  expiresIn = STORAGE_VIEW_URL_TTL_SECONDS,
  download = false,
} = {}) {
  if (!storagePath) {
    throw new Error('Storage path is required to create a signed URL.')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn, download ? { download: true } : undefined)

  if (error) {
    throw new Error(`Unable to create signed URL: ${error.message}`)
  }

  return data.signedUrl
}

export async function createSignedDocumentUrls(storagePath) {
  const [viewUrl, downloadUrl] = await Promise.all([
    createSignedStorageUrl(storagePath, { expiresIn: STORAGE_VIEW_URL_TTL_SECONDS }),
    createSignedStorageUrl(storagePath, {
      expiresIn: STORAGE_DOWNLOAD_URL_TTL_SECONDS,
      download: true,
    }),
  ])

  return { viewUrl, downloadUrl }
}

export async function addSignedDocumentUrls(document) {
  const storagePath = document?.storagePath || getStoragePathFromFilepath(document?.filepath)
  if (!storagePath) return document

  try {
    const { viewUrl, downloadUrl } = await createSignedDocumentUrls(storagePath)

    return {
      ...document,
      filepath: viewUrl,
      storagePath,
      downloadUrl,
    }
  } catch (error) {
    console.error('Unable to create signed document URL:', {
      storagePath,
      message: error.message,
    })
    return document
  }
}

export async function addSignedDocumentUrlsToList(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return documents
  return Promise.all(documents.map(document => addSignedDocumentUrls(document)))
}
