import { Button } from "@/components/ui/button";
import { ShareBold } from "@/components/ui/icons";

export const ShareButton = (props: { title?: string }) => {
  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: props.title,
        url: window.location.href,
      });
    } else {
      const textToCopy = `${props.title} ${window.location.href}`;

      try {
        await navigator.clipboard.writeText(textToCopy);
        alert("Link copied to clipboard");
      } catch {
        alert("Failed to copy link");
      }
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
        <ShareBold size={24} />
        <span>Share</span>
      </span>
    </Button>
  );
};
