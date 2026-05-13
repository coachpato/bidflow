export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
])

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function getMaxUploadBytes() {
  return parsePositiveInteger(process.env.FILE_UPLOAD_MAX_BYTES)
    || parsePositiveInteger(process.env.MAX_UPLOAD_BYTES)
    || DEFAULT_MAX_UPLOAD_BYTES
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`
}

function getFileExtension(filename) {
  const normalized = filename.toLowerCase()
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex >= 0 ? normalized.slice(dotIndex) : ''
}

export function sanitizeUploadFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
}

export function getUploadValidationError(file) {
  if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') {
    return 'A valid file is required.'
  }

  const maxBytes = getMaxUploadBytes()

  if (typeof file.size !== 'number' || !Number.isFinite(file.size)) {
    return 'File size is required.'
  }

  if (file.size > maxBytes) {
    return `File is too large. Maximum size is ${formatBytes(maxBytes)}.`
  }

  const extension = getFileExtension(file.name)
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    return 'Unsupported file extension.'
  }

  const mimeType = typeof file.type === 'string' ? file.type.toLowerCase() : ''
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    return 'Unsupported file type.'
  }

  return null
}
