"use client";

import { Button, Card, Stack, Text, Title } from "@mantine/core";
import React from "react";

type OnboardingV2ErrorBoundaryProps = {
  children: React.ReactNode;
};

type OnboardingV2ErrorBoundaryState = {
  hasError: boolean;
};

export default class OnboardingV2ErrorBoundary extends React.Component<
  OnboardingV2ErrorBoundaryProps,
  OnboardingV2ErrorBoundaryState
> {
  state: OnboardingV2ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm">
            <Title order={4}>Something went wrong</Title>
            <Text size="sm" c="dimmed">
              We hit an unexpected error while loading this step. Please try again.
            </Text>
            <Button onClick={this.handleRetry} variant="default">
              Retry
            </Button>
          </Stack>
        </Card>
      );
    }

    return this.props.children;
  }
}
