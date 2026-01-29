"use client";

import { Component, type ReactNode } from "react";

type PreviewErrorBoundaryProps = {
  fallback: ReactNode;
  children: ReactNode;
};

type PreviewErrorBoundaryState = {
  hasError: boolean;
};

export default class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
