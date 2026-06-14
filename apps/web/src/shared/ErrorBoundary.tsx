import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { errorReporting } from "./observability.js";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    errorReporting.captureException(error, { componentStack: info.componentStack ?? null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="error-shell">
        <AlertTriangle aria-hidden="true" />
        <h1>Something went wrong</h1>
        <p>The client caught the error and wrote it to the console adapter.</p>
      </main>
    );
  }
}
