import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches unexpected render/runtime errors so a bug in one part of the app
// (e.g. a bad Patch record, a map event) shows a recoverable message instead
// of a permanent blank page.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("blipmap crashed:", error, info.componentStack);
  }

  private reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-crash" role="alert">
        <div className="app-crash__card">
          <h1>Something went wrong</h1>
          <p>blipmap hit an unexpected error and can't continue safely. Reloading usually fixes it.</p>
          <p className="app-crash__detail">{this.state.error.message}</p>
          <button className="btn btn--primary" onClick={this.reload}>Reload blipmap</button>
        </div>
      </div>
    );
  }
}
