'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GOOGLE_SCRIPT_ID = 'google-identity-services'
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export default function GoogleAuthButton({
  intent,
  payload = {},
  validate,
  onError,
  onSuccess,
  label,
}) {
  const containerRef = useRef(null)
  const payloadRef = useRef(payload)
  const validateRef = useRef(validate)
  const onErrorRef = useRef(onError)
  const onSuccessRef = useRef(onSuccess)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    payloadRef.current = payload
  }, [payload])

  useEffect(() => {
    validateRef.current = validate
  }, [validate])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !containerRef.current || !window.google?.accounts?.id) {
      return
    }

    const handleGoogleCredential = async response => {
      try {
        setPending(true)

        const validationError = validateRef.current?.()
        if (validationError) {
          onErrorRef.current?.(validationError)
          return
        }

        const request = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            intent,
            credential: response.credential,
            ...payloadRef.current,
          }),
        })

        const data = await request.json()

        if (!request.ok) {
          onErrorRef.current?.(data.error || 'Google authentication failed.')
          return
        }

        onSuccessRef.current?.(data)
      } catch (error) {
        console.error('Google auth error:', error)
        onErrorRef.current?.('Google authentication failed. Please try again.')
      } finally {
        setPending(false)
      }
    }

    containerRef.current.innerHTML = ''
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      ux_mode: 'popup',
    })
    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: 360,
    })
  }, [intent, scriptLoaded])

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Google sign-in will appear here once `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Script
        id={GOOGLE_SCRIPT_ID}
        src={GOOGLE_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {label ? (
        <p className="text-sm font-semibold text-slate-700">{label}</p>
      ) : null}

      <div className="flex justify-center rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div ref={containerRef} />
      </div>

      {pending ? (
        <p className="text-center text-xs text-slate-500">Checking your Google account and opening your Bid360 workspace...</p>
      ) : null}
    </div>
  )
}
