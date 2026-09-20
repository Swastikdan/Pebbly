import { useUser } from "@clerk/react";
import { lazy, Suspense, useState } from "react";

import { UserIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";

const AccountButton = lazy(() => import("@/components/auth/account-button"));

interface AccountButtonProps {
  variant: "desktop" | "mobile";
}

function AccountPlaceholder({
  onActivate,
  variant,
}: AccountButtonProps & { onActivate: () => void }) {
  const { isSignedIn, isLoaded, user } = useUser();

  if (variant === "desktop") {
    if (isLoaded && isSignedIn && user?.imageUrl) {
      return (
        <button
          type="button"
          onClick={onActivate}
          className="flex size-10 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
          aria-label="Account"
        >
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "Account"}
            className="border-secondary size-9 rounded-full border-2 object-cover"
          />
        </button>
      );
    }
    if (!isLoaded) {
      return (
        <button
          type="button"
          onClick={onActivate}
          className="flex size-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
          aria-label="Account"
        >
          <Skeleton className="size-9 rounded-full" />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onActivate}
        aria-label="Sign In"
        className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex size-9 cursor-pointer items-center justify-center rounded-full border p-0 outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <UserIcon aria-hidden="true" className="size-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex h-full w-full cursor-pointer flex-col items-center justify-center border-none bg-transparent p-0"
      aria-label="Account"
    >
      <span className="mobile-bottom-nav-tab-icon">
        {isLoaded && isSignedIn && user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "Account"}
            className="size-[28px] rounded-full object-cover"
          />
        ) : (
          <UserIcon aria-hidden="true" className="size-6" />
        )}
      </span>
      <span className="mobile-bottom-nav-tab-label">Account</span>
    </button>
  );
}

export function DeferredAccountButton({ variant }: AccountButtonProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  const triggerLoad = () => {
    if (!shouldLoad) setShouldLoad(true);
  };

  if (!shouldLoad) {
    return <AccountPlaceholder onActivate={triggerLoad} variant={variant} />;
  }

  return (
    <Suspense
      fallback={
        <AccountPlaceholder onActivate={triggerLoad} variant={variant} />
      }
    >
      <AccountButton variant={variant} />
    </Suspense>
  );
}
