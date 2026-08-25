import { useNavigate, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/components/ui/icons";

export const GoBack = (props: {
  title?: string;
  link?: string;
  className?: string;
}) => {
  const navigate = useNavigate();
  const router = useRouter();
  const { title, link, className } = props;

  function goBack() {
    if (link) {
      // Use replace here so the fallback destination does not create a back-button loop.
      navigate({ to: link, replace: true });
    } else {
      router.history.back();
    }
  }

  return (
    <Button
      className={className}
      variant="secondary"
      // Matches ShareButton, which these two almost always sit beside.
      size="lg"
      onClick={goBack}
      aria-label={title ?? "Go Back"}
    >
      <span className="flex w-full items-center gap-1">
        <ArrowLeft size={20} />
        <span>{title ?? "Go Back"}</span>
      </span>
    </Button>
  );
};
