export function isPublicRegistrationEnabled() {
  return process.env.ALLOW_PUBLIC_REGISTRATION === 'true'
}
