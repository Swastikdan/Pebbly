import { Link, useLocation } from "@tanstack/react-router";

import { DeferredAccountButton } from "@/components/auth/deferred-account-button";
import { Button } from "@/components/ui/button";
import {
  BookMarkFilledIcon,
  SearchFilledIcon,
  SparklesFilledIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

const DesktopNavButton = ({
  href,
  label,
  icon,
  className,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  className?: string;
}) => {
  const location = useLocation();
  const isActive = location.pathname === href;
  return (
    <Button
      variant={isActive ? "secondary" : "outline"}
      size="icon"
      className={cn(className, "pressable cursor-pointer")}
      render={<Link to={href} aria-label={label} />}
    >
      {icon && (
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
      )}
    </Button>
  );
};

DesktopNavButton.displayName = "DesktopNavButton";

const DesktopNavButtons = () => {
  const {
    hasFeature,
    loading: isPermissionsLoading,
    isSignedIn,
  } = usePermissions();
  const hasAiRecommendations = hasFeature("ai-recommendations");

  return (
    <>
      {isSignedIn && isPermissionsLoading ? (
        <Skeleton className="hidden size-9 rounded-md sm:flex" />
      ) : hasAiRecommendations ? (
        <DesktopNavButton
          href="/recommendations"
          label="AI Recommendations"
          className="hidden sm:flex"
          icon={<SparklesFilledIcon className="size-5" />}
        />
      ) : null}
      <DesktopNavButton
        href="/watchlist"
        label="Watchlist"
        icon={<BookMarkFilledIcon />}
      />
      <DesktopNavButton
        href="/search"
        label="Search"
        icon={<SearchFilledIcon />}
      />
      <DeferredAccountButton variant="desktop" />
    </>
  );
};

DesktopNavButtons.displayName = "DesktopNavButtons";

export { DesktopNavButtons };
