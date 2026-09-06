import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { reportClientSideError } from "@/lib/client-error-reporting";

export class SilentErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientSideError(error, {
      source: "component-error-boundary",
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
