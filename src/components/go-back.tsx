'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function GoBack({
  title,
  link,
}: {
  title?: string
  link?: string
}) {
  const router = useRouter()
  function goBack() {
    if (link) {
      router.push(link)
    } else {
      router.back()
    }
  }
  return (
    <Button
      onClick={() => goBack()}
      variant="outline"
      aria-label="Go back"
      className="Capitalized"
    >
      <ArrowLeft size={24} aria-hidden="true" />
      {title ? title : 'Go Back'}
    </Button>
  )
}