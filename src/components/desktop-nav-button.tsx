import {
  ClerkLoaded,
  ClerkLoading,
  Show,
  SignInButton,
  UserButton,
} from "@clerk/react";
import { Link, useLocation } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  BookMarkFilledIcon,
  SearchFilledIcon,
  SparklesFilledIcon,
  UserIcon,
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
        <Skeleton className="hidden size-9 rounded-xl sm:flex" />
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
      <ClerkLoading>
        <Skeleton className="size-9 rounded-full" />
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button
              variant="outline"
              className="flex size-9 items-center justify-center rounded-full p-0 before:rounded-full"
            >
              <UserIcon className="size-5" />
            </Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <div className="flex size-10 items-center justify-center">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox:
                    "!size-9 !rounded-full !border-2 !border-secondary",
                  userButtonTrigger: "!h-9 !w-9 !rounded-full",
                },
              }}
            />
          </div>
        </Show>
      </ClerkLoaded>
    </>
  );
};

DesktopNavButtons.displayName = "DesktopNavButtons";

export { DesktopNavButtons };
