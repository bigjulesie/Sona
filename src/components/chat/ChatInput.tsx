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
    <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 border-t border-stone-200">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-stone-50 rounded-xl px-4 py-3 text-sm text-stone-900
                   border border-stone-200 focus:outline-none focus:ring-2
                   focus:ring-stone-900 focus:border-transparent
                   disabled:opacity-50 max-h-32"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="px-4 py-3 bg-stone-900 text-white rounded-xl text-sm font-medium
                   hover:bg-stone-800 disabled:opacity-50 transition-colors shrink-0"
      >
        Send
      </button>
    </form>
  )
}
