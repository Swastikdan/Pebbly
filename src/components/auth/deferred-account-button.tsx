import { useUser } from "@clerk/react";
import { lazy, Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { UserIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";

const AccountButton = lazy(() => import("@/components/auth/account-button"));

interface AccountButtonProps {
  variant: "desktop" | "mobile";
}

function AccountPlaceholder({ variant }: AccountButtonProps) {
  const { isSignedIn, isLoaded, user } = useUser();

  if (variant === "desktop") {
    if (isLoaded && isSignedIn && user?.imageUrl) {
      return (
        <div className="flex size-10 items-center justify-center">
          <img
            src={user.imageUrl}
            alt={user.fullName ?? "Account"}
            className="border-secondary size-9 rounded-full border-2 object-cover"
          />
        </div>
      );
    }
    if (!isLoaded) {
      return <Skeleton className="size-9 rounded-full" />;
    }
    return (
      <Button
        variant="outline"
        aria-label="Sign In"
        className="flex size-9 items-center justify-center rounded-full p-0 before:rounded-full"
      >
        <UserIcon aria-hidden="true" className="size-5" />
      </Button>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
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
    </div>
  );
}

export function DeferredAccountButton({ variant }: AccountButtonProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(() => setShouldLoad(true), {
        timeout: 3500,
      });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(() => setShouldLoad(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const triggerLoad = () => {
    if (!shouldLoad) setShouldLoad(true);
  };

  if (!shouldLoad) {
    return (
      <button
        type="button"
        onClick={triggerLoad}
        onMouseEnter={triggerLoad}
        onFocus={triggerLoad}
        className="contents cursor-pointer border-none bg-transparent p-0"
        aria-label="Account"
      >
        <AccountPlaceholder variant={variant} />
      </button>
    );
  }

  return (
    <Suspense fallback={<AccountPlaceholder variant={variant} />}>
      <AccountButton variant={variant} />
    </Suspense>
  );
}
