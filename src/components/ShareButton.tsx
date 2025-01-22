'use client'

import React from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ShareButton({
  title,
  description,
}: {
  title: string
  description: string
}) {
  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: title,
        text: description,
        url: window.location.href,
      })
    } else {
      // Fallback solution for browsers that do not support Web Share API
      const textArea = document.createElement('textarea')
      textArea.value = `${title} ${window.location.href}`
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Link copied to clipboard')
    }
  }

  return (
    <Button
      onClick={() => handleShare()}
      variant="outline"
      aria-label="Share this content"
    >
      <Share2 size={24} aria-hidden="true" /> Share
    </Button>
  )
}
