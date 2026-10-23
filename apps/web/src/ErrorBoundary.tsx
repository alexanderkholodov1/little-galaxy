import { Component } from 'react';
import type { ReactNode } from 'react';
import { handleChunkError } from './live-safety';

export default class ErrorBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    handleChunkError(error);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
