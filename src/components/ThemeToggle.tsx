'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = saved ? saved === 'dark' : prefersDark
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-muted cursor-pointer border-none bg-transparent text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
