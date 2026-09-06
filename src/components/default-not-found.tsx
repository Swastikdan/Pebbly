import { useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";

import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { reportClientSideError } from "@/lib/client-error-reporting";

export function DefaultNotFoundComponent() {
  return (
    <div className="grid h-full min-h-dvh min-w-[320px] place-content-center items-center justify-center px-6">
      <div className="animate-fade-in-up flex flex-col items-center justify-center gap-6 text-center">
        <div
          aria-hidden="true"
          className="text-foreground text-8xl font-black tracking-tighter select-none"
        >
          404
        </div>
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link to="/">
          <Button variant="secondary" size="lg">
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function DefaultErrorComponent({
  error,
  info,
}: Partial<ErrorComponentProps>) {
  const router = useRouter();

  useEffect(() => {
    if (error === undefined) return;
    reportClientSideError(error, {
      source: "route-error",
      componentStack: info?.componentStack,
    });
  }, [error, info?.componentStack]);

  return (
    <div className="grid h-full min-h-[calc(100vh-200px)] place-content-center items-center justify-center px-6">
      <div className="animate-fade-in-up flex max-w-md flex-col items-center justify-center gap-6 text-center">
        <div className="bg-destructive/10 dark:bg-destructive/20 flex size-16 items-center justify-center rounded-lg">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-destructive size-7"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
        </div>
        <div>
          <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-[65ch] text-base leading-relaxed text-pretty">
            An unexpected error occurred. Please try again or return to the home
            page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.invalidate()}>
            Try again
          </Button>
          <Link to="/">
            <Button variant="secondary">Back to home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
