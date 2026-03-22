/** @vitest-environment jsdom */

import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MantineProvider } from "@mantine/core";
import ExperimentTemplatesDrawer from "../ExperimentTemplatesDrawer";

const matchMediaMock = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: matchMediaMock,
});

describe("ExperimentTemplatesDrawer", () => {
  it("renders decision template mode card and options", () => {
    const html = renderToString(
      <MantineProvider>
        <ExperimentTemplatesDrawer
          opened
          title="Experiment templates"
          labels={{
            decisionTemplateTitle: "Decision templates",
            decisionTemplateDescription: "Apply one-click decisions",
            addEventTitle: "Add event",
            addEventDescription: "Open picker",
            modifyBaselineTitle: "Modify baseline",
            modifyBaselineDescription: "Create override",
            modifyEnvironmentTitle: "Assumptions",
            modifyEnvironmentDescription: "Adjust assumptions",
            chooseActionLabel: "Choose",
            applyLabel: "Apply",
            backLabel: "Back",
            emptyDecisionTemplatesLabel: "No templates",
            costRangeTitle: "Common local cost ranges",
            estimateGuideLabel: "Why this estimate",
            conservativeTierLabel: "Conservative",
            medianTierLabel: "Median",
            aggressiveTierLabel: "Aggressive",
          }}
          groups={[]}
          decisionTemplates={[
            {
              id: "home_purchase",
              launcher: "bundle_housing",
              title: "Home purchase",
              description: "Bundle launcher",
              selectedCostProfile: "median",
              estimateGuide: "Guide",
              costRangeItems: [
                {
                  id: "homePurchase",
                  label: "Monthly owner housing outflow",
                  values: {
                    conservative: "A",
                    median: "B",
                    aggressive: "C",
                  },
                  factorHint: "district",
                },
              ],
              availability: { enabled: true },
            },
            {
              id: "income_shock",
              launcher: "income_shock_override",
              title: "Income shock",
              description: "-20% for 12 months",
              selectedCostProfile: "median",
              estimateGuide: "Guide",
              costRangeItems: [],
              availability: {
                enabled: false,
                reasonFallback: "No editable baseline income event available.",
              },
            },
          ]}
          baselineEventOptions={[]}
          envOptions={[]}
          onClose={() => undefined}
          onSelect={() => undefined}
          onSelectDecisionTemplate={() => undefined}
          withinPortal={false}
        />
      </MantineProvider>
    );

    expect(html).toContain("Decision templates");
    expect(html).toContain("Apply one-click decisions");
    expect(html).toContain("Add event");
    expect(html).toContain("Modify baseline");
    expect(html).toContain("Assumptions");
  });

  it("can open directly in decision-template mode for guided entry paths", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <MantineProvider>
          <ExperimentTemplatesDrawer
            opened
            title="Experiment templates"
            initialMode="decision_template"
            highlightedDecisionTemplateId="home_purchase"
            labels={{
              decisionTemplateTitle: "Decision templates",
              decisionTemplateDescription: "Apply one-click decisions",
              addEventTitle: "Add event",
              addEventDescription: "Open picker",
              modifyBaselineTitle: "Modify baseline",
              modifyBaselineDescription: "Create override",
              modifyEnvironmentTitle: "Assumptions",
              modifyEnvironmentDescription: "Adjust assumptions",
              chooseActionLabel: "Choose",
              applyLabel: "Apply",
              backLabel: "Back",
              emptyDecisionTemplatesLabel: "No templates",
              costRangeTitle: "Common local cost ranges",
              estimateGuideLabel: "Why this estimate",
              conservativeTierLabel: "Conservative",
              medianTierLabel: "Median",
              aggressiveTierLabel: "Aggressive",
              recommendedBadgeLabel: "Recommended next step",
            }}
            groups={[]}
            decisionTemplates={[
              {
                id: "home_purchase",
                launcher: "bundle_housing",
                title: "Home purchase",
                description: "Bundle launcher",
                selectedCostProfile: "median",
                estimateGuide: "Guide",
                costRangeItems: [],
                availability: { enabled: true },
              },
            ]}
            baselineEventOptions={[]}
            envOptions={[]}
            onClose={() => undefined}
            onSelect={() => undefined}
            onSelectDecisionTemplate={() => undefined}
            withinPortal={false}
          />
        </MantineProvider>
      );
    });

    expect(container.textContent ?? "").toContain("Home purchase");
    expect(container.textContent ?? "").toContain("Recommended next step");

    root.unmount();
    container.remove();
  });
});
