import {
  ClerkLoaded,
  ClerkLoading,
  Show,
  SignInButton,
  UserButton,
} from "@clerk/react";
import { shadcn } from "@clerk/ui/themes";

import { Button } from "@/components/ui/button";
import { UserIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Everything Clerk-UI-shaped lives in this one module so the nav components
// can render a static placeholder and pull the real widgets in via a lazy
// chunk. @clerk/react widget internals plus the @clerk/ui theme object are
// far too heavy to justify executing during first paint on mid-range phones;
// none of it is visible until the user taps their account anyway.

interface AccountButtonProps {
  variant: "desktop" | "mobile";
}

export default function AccountButton({ variant }: AccountButtonProps) {
  if (variant === "desktop") {
    return (
      <>
        <ClerkLoading>
          <Skeleton className="size-9 rounded-full" />
        </ClerkLoading>
        <ClerkLoaded>
          <Show when="signed-out">
            <SignInButton mode="modal" appearance={shadcn}>
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
                  ...shadcn,
                  elements: {
                    userButtonAvatarBox:
                      "size-9! rounded-full! border-2! border-secondary!",
                    userButtonTrigger: "h-9! w-9! rounded-full!",
                  },
                }}
              />
            </div>
          </Show>
        </ClerkLoaded>
      </>
    );
  }

  return (
    <>
      <ClerkLoading>
        <div className="flex h-full w-full flex-col items-center justify-center">
          <span className="mobile-bottom-nav-tab-icon">
            <UserIcon className="size-6" />
          </span>
          <span className="mobile-bottom-nav-tab-label">Account</span>
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-out">
          <SignInButton mode="modal" appearance={shadcn}>
            <button
              type="button"
              aria-label="Sign In"
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center border-none bg-transparent p-0"
            >
              <span className="mobile-bottom-nav-tab-icon">
                <UserIcon className="size-6" />
              </span>
              <span className="mobile-bottom-nav-tab-label">Account</span>
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center",
            )}
          >
            <span className="mobile-bottom-nav-tab-icon mobile-bottom-nav-account">
              <UserButton
                appearance={{
                  ...shadcn,
                  elements: {
                    userButtonAvatarBox: "size-[28px]! rounded-full!",
                    userButtonTrigger: "h-[28px]! w-[28px]! rounded-full!",
                  },
                }}
              />
            </span>
            <span className="mobile-bottom-nav-tab-label">Account</span>
          </div>
        </Show>
      </ClerkLoaded>
    </>
  );
}
