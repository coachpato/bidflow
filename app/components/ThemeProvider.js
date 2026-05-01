'use client'

import { createContext, useEffect, useState } from 'react'

export const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)

  function applyTheme(themeName) {
    const html = document.documentElement
    if (themeName === 'dark') {
      html.setAttribute('data-theme', 'dark')
    } else {
      html.removeAttribute('data-theme')
    }
  }

  useEffect(() => {
    const syncThemeState = themeName => {
      applyTheme(themeName)
      window.requestAnimationFrame(() => setTheme(themeName))
    }
    const markMounted = () => window.requestAnimationFrame(() => setMounted(true))

    // Check localStorage first
    const stored = localStorage.getItem('theme')
    if (stored) {
      syncThemeState(stored)
      markMounted()
      return
    }

    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = prefersDark ? 'dark' : 'light'
    syncThemeState(initialTheme)
    markMounted()

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      const newTheme = e.matches ? 'dark' : 'light'
      setTheme(newTheme)
      applyTheme(newTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}
