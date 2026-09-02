import { lazy, Suspense } from "react";
import { Link, useLocation } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  BookMarkFilledIcon,
  SearchFilledIcon,
  SparklesFilledIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

// Clerk's widgets (and the @clerk/ui theme they style with) are code-split
// behind this boundary: the nav renders a skeleton immediately and the real
// account button swaps in once the chunk lands.
const AccountButton = lazy(() => import("@/components/auth/account-button"));

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
      {icon}
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
      <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
        <AccountButton variant="desktop" />
      </Suspense>
    </>
  );
};

DesktopNavButtons.displayName = "DesktopNavButtons";

export { DesktopNavButtons };
