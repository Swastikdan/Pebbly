import { Component, type ErrorInfo, type ReactNode } from "react";

export class SilentErrorBoundary extends Component<
	{ children: ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(_error: Error, _info: ErrorInfo) {}

	render() {
		return this.state.hasError ? null : this.props.children;
	}
}
