/** @vitest-environment jsdom */

import React, { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import KpiCard from "../KpiCard";
import KpiCarousel from "../KpiCarousel";

function render(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

beforeEach(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

describe("KpiCard details CTA", () => {
  it("keeps details CTA clickable inside mobile carousel", () => {
    let clickCount = 0;
    const view = render(
      <MantineProvider>
        <KpiCarousel
          items={[
            {
              label: "Cash runway",
              value: "12 months",
              detailsLabel: "View runway details",
              onDetails: () => {
                clickCount += 1;
              },
            },
          ]}
        />
      </MantineProvider>
    );

    const button = Array.from(view.container.querySelectorAll("button")).find(
      (node) => node.textContent?.includes("View runway details")
    );
    expect(button).toBeTruthy();

    flushSync(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clickCount).toBe(1);

    view.unmount();
  });

  it("opens detail modal after clicking CTA", () => {
    function TestHost() {
      const [opened, setOpened] = useState(false);
      return (
        <>
          <KpiCard
            label="Risk level"
            value="High"
            detailsLabel="View risk details"
            onDetails={() => setOpened(true)}
          />
          {opened ? <div data-testid="risk-detail-modal">Risk detail modal</div> : null}
        </>
      );
    }

    const view = render(
      <MantineProvider>
        <TestHost />
      </MantineProvider>
    );

    const button = Array.from(view.container.querySelectorAll("button")).find(
      (node) => node.textContent?.includes("View risk details")
    );
    expect(button).toBeTruthy();

    flushSync(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent ?? "").toContain("Risk detail modal");

    view.unmount();
  });
});
