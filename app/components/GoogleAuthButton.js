'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const GOOGLE_SCRIPT_ID = 'google-identity-services'
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export const GOOGLE_AUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID)

export default function GoogleAuthButton({
  intent,
  payload = {},
  validate,
  onError,
  onSuccess,
}) {
  const containerRef = useRef(null)
  const payloadRef = useRef(payload)
  const validateRef = useRef(validate)
  const onErrorRef = useRef(onError)
  const onSuccessRef = useRef(onSuccess)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [pending, setPending] = useState(false)
  const buttonDisabled = !GOOGLE_AUTH_ENABLED || pending

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
      shape: 'rectangular',
      text: 'continue_with',
      logo_alignment: 'left',
      width: 360,
    })
  }, [intent, scriptLoaded])

  function handleGoogleClick() {
    if (!GOOGLE_AUTH_ENABLED || pending) return

    const validationError = validateRef.current?.()
    if (validationError) {
      onErrorRef.current?.(validationError)
      return
    }

    const renderedButton = containerRef.current?.querySelector('div[role="button"], button')
    if (renderedButton) {
      renderedButton.click()
    }
  }

  return (
    <div className="space-y-3">
      {GOOGLE_AUTH_ENABLED ? (
        <Script
          id={GOOGLE_SCRIPT_ID}
          src={GOOGLE_SCRIPT_SRC}
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
      ) : null}

      <button
        type="button"
        disabled={buttonDisabled}
        onClick={handleGoogleClick}
        className="app-button app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={GOOGLE_AUTH_ENABLED ? 'Continue with Google' : 'Google Auth not configured'}
      >
        <GoogleIcon />
        {GOOGLE_AUTH_ENABLED ? 'Continue with Google' : 'Google Auth not configured'}
      </button>

      <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <div ref={containerRef} />
      </div>

      {pending ? (
        <p className="text-center text-xs text-slate-500">Checking your Google account and opening your Bid360 workspace...</p>
      ) : null}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" focusable="false">
      <path style={{ fill: '#4285F4' }} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path style={{ fill: '#34A853' }} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path style={{ fill: '#FBBC05' }} d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path style={{ fill: '#EA4335' }} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  )
}
