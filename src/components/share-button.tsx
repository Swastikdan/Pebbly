"use client";

import React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShareButton({ title }: { title?: string }) {
  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title,
          url: window.location.href,
        });
      } else {
        // Fallback solution for browsers that do not support Web Share API
        const textArea = document.createElement("textarea");
        textArea.value = `${title} ${window.location.href}`;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert("Link copied to clipboard");
      }
    } catch (error) {
      alert("Error sharing");
    }
  }

  return (
    <Button
      onClick={() => void handleShare()} // Explicitly mark promise as void
      variant="outline"
      aria-label="Share this content"
    >
      <Share2 size={24} aria-hidden="true" /> Share
    </Button>
  );
}
