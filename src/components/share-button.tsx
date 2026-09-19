import { usePostHog } from "@posthog/react";

import { Button } from "@/components/ui/button";
import { ShareBold } from "@/components/ui/icons";

export const ShareButton = (props: { title?: string }) => {
  const posthog = usePostHog();

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: props.title,
          url: window.location.href,
        });
        posthog.capture("media_shared", { share_method: "native" });
      } else {
        const textToCopy = `${props.title} ${window.location.href}`;
        await navigator.clipboard.writeText(textToCopy);
        posthog.capture("media_shared", { share_method: "clipboard" });
        alert("Link copied to clipboard");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        posthog.captureException(error);
      }
      if (!navigator.share) alert("Failed to copy link");
    }
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={() => void handleShare()}
      className="border-border border"
    >
      <span className="flex w-full items-center gap-1">
        <ShareBold aria-hidden="true" size={24} />
        <span>Share</span>
      </span>
    </Button>
  );
};
