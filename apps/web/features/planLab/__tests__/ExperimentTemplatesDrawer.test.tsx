import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import ExperimentTemplatesDrawer from "../ExperimentTemplatesDrawer";

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
          }}
          groups={[]}
          decisionTemplates={[
            {
              id: "home_purchase",
              launcher: "bundle_home_purchase",
              title: "Home purchase",
              description: "Bundle launcher",
              availability: { enabled: true },
            },
            {
              id: "income_shock",
              launcher: "income_shock_override",
              title: "Income shock",
              description: "-20% for 12 months",
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
});
