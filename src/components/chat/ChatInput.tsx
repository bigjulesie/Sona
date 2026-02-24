'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 px-6 py-4 border-t border-brass/20 bg-parchment"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question…"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-vellum border border-brass/20 rounded-xl px-4 py-3
                   text-sm text-ink placeholder:text-mist/60
                   focus:outline-none focus:border-brass
                   disabled:opacity-50 max-h-32 transition-colors"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-5 py-3 bg-ink text-parchment rounded-xl text-xs tracking-widest uppercase
                   hover:bg-ink/90 disabled:opacity-40 transition-colors shrink-0"
      >
        Send
      </button>
    </form>
  )
}
