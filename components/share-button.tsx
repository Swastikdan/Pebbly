/* eslint-disable no-undef */
"use client";

import { Button } from "@heroui/button";

import { ShareBold } from "./icons";

export const ShareButton = ({ title }: { title?: string }) => {
  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: title,
        url: window.location.href,
      });
    } else {
      // Fallback solution for browsers that do not support Web Share API
      const textToCopy = `${title} ${window.location.href}`;

      try {
        await navigator.clipboard.writeText(textToCopy);
        alert("Link copied to clipboard");
      } catch {
        // Fallback for browsers that don't support Clipboard API
        const textArea = document.createElement("textarea");

        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert("Link copied to clipboard");
      }
    }
  }

  return (
    <Button
      aria-label="Share this content"
      startContent={<ShareBold size={24} />}
      variant="faded"
      onPress={() => void handleShare()}
    >
      Share
    </Button>
  );
};
ShareButton.displayName = "ShareButton";
