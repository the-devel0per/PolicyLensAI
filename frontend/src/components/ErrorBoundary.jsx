import { Component } from "react";
import ErrorState from "./ErrorState";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorState
        title="This page didn't load"
        message="Something went wrong while loading the page. Reload to try again."
        onRetry={() => window.location.reload()}
        retryLabel="Reload page"
      />
    );
  }
}
