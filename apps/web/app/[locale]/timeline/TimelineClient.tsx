"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo } from "react";
import TimelineDesktop from "../../../components/timeline/TimelineDesktop";
import TimelineMobile from "../../../components/timeline/TimelineMobile";
import { buildScenarioEventViews } from "../../../src/domain/events/utils";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { appliesToScenario } from "../../../src/domain/applyScope";

type TimelineClientProps = {
  scenarioId?: string;
};

export default function TimelineClient({ scenarioId }: TimelineClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const scenarioIdFromQuery = scenarioId ?? null;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const addEventDefinition = useScenarioStore((state) => state.addEventDefinition);
  const addEventToScenarios = useScenarioStore((state) => state.addEventToScenarios);
  const updateEventDefinition = useScenarioStore(
    (state) => state.updateEventDefinition
  );
  const addScenarioEventRef = useScenarioStore((state) => state.addScenarioEventRef);
  const updateScenarioEventRef = useScenarioStore(
    (state) => state.updateScenarioEventRef
  );
  const removeScenarioEventRef = useScenarioStore(
    (state) => state.removeScenarioEventRef
  );
  const mergeDuplicateEvents = useScenarioStore(
    (state) => state.mergeDuplicateEvents
  );
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore(
    (state) => state.updateHomePosition
  );
  const removeHomePosition = useScenarioStore(
    (state) => state.removeHomePosition
  );
  const addCarPosition = useScenarioStore((state) => state.addCarPosition);
  const updateCarPosition = useScenarioStore((state) => state.updateCarPosition);
  const removeCarPosition = useScenarioStore((state) => state.removeCarPosition);
  const addInvestmentPosition = useScenarioStore(
    (state) => state.addInvestmentPosition
  );
  const updateInvestmentPosition = useScenarioStore(
    (state) => state.updateInvestmentPosition
  );
  const removeInvestmentPosition = useScenarioStore(
    (state) => state.removeInvestmentPosition
  );
  const addInsurancePosition = useScenarioStore(
    (state) => state.addInsurancePosition
  );
  const updateInsurancePosition = useScenarioStore(
    (state) => state.updateInsurancePosition
  );
  const removeInsurancePosition = useScenarioStore(
    (state) => state.removeInsurancePosition
  );
  const addLoanPosition = useScenarioStore((state) => state.addLoanPosition);
  const updateLoanPosition = useScenarioStore((state) => state.updateLoanPosition);
  const removeLoanPosition = useScenarioStore((state) => state.removeLoanPosition);

  useEffect(() => {
    if (
      scenarioIdFromQuery &&
      scenarioIdFromQuery !== activeScenarioId &&
      scenarios.some((scenario) => scenario.id === scenarioIdFromQuery)
    ) {
      setActiveScenario(scenarioIdFromQuery);
    }
  }, [activeScenarioId, scenarioIdFromQuery, scenarios, setActiveScenario]);

  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioIdFromQuery, activeScenarioId, scenarios),
    [activeScenarioId, scenarioIdFromQuery, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const eventViews = scenario ? buildScenarioEventViews(scenario, eventLibrary) : [];
  const homePositions = scenario?.positions?.homes ?? [];
  const carPositions = scenario?.positions?.cars ?? [];
  const investmentPositions = scenario?.positions?.investments ?? [];
  const insurancePositions = scenario?.positions?.insurances ?? [];
  const loanPositions = scenario?.positions?.loans ?? [];
  const members = useScenarioStore((state) => state.members);
  const scopedMembers = useMemo(
    () =>
      scenario
        ? members.filter((member) => appliesToScenario(member.applyScope, scenario.id))
        : [],
    [members, scenario]
  );
  const baseCurrency = scenario?.baseCurrency ?? "";
  const baseMonth = scenario?.assumptions.baseMonth ?? null;
  const assumptions = scenario?.assumptions ?? { baseMonth: null, horizonMonths: 0, initialCash: 0 };
  const { projection } = useProjectionWithLedger(scenario, eventLibrary, {
    members,
    budgetRules,
  });

  if (!scenario) {
    return null;
  }

  if (isDesktop) {
    return (
      <TimelineDesktop
        eventViews={eventViews}
        eventLibrary={eventLibrary}
        scenarios={scenarios}
        homePositions={homePositions}
        carPositions={carPositions}
        investmentPositions={investmentPositions}
        insurancePositions={insurancePositions}
        loanPositions={loanPositions}
        members={scopedMembers}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        assumptions={assumptions}
        scenarioId={scenario.id}
        projection={projection}
        onAddDefinition={(definition, scenarioIds) => {
          if (scenarioIds.length <= 1 && scenarioIds[0] === scenario.id) {
            addEventDefinition(definition);
            addScenarioEventRef(scenario.id, { refId: definition.id, enabled: true });
            return;
          }
          addEventToScenarios(definition, scenarioIds);
        }}
        onUpdateDefinition={updateEventDefinition}
        onUpdateEventRef={(refId, patch) =>
          updateScenarioEventRef(scenario.id, refId, patch)
        }
        onHomePositionAdd={(home) => addHomePosition(scenario.id, home)}
        onHomePositionUpdate={(home) => updateHomePosition(scenario.id, home)}
        onHomePositionRemove={(homeId) => removeHomePosition(scenario.id, homeId)}
        onCarPositionAdd={(car) => addCarPosition(scenario.id, car)}
        onCarPositionUpdate={(car) => updateCarPosition(scenario.id, car)}
        onCarPositionRemove={(carId) => removeCarPosition(scenario.id, carId)}
        onInvestmentPositionAdd={(investment) =>
          addInvestmentPosition(scenario.id, investment)
        }
        onInvestmentPositionUpdate={(investment) =>
          updateInvestmentPosition(scenario.id, investment)
        }
        onInvestmentPositionRemove={(investmentId) =>
          removeInvestmentPosition(scenario.id, investmentId)
        }
        onInsurancePositionAdd={(insurance) =>
          addInsurancePosition(scenario.id, insurance)
        }
        onInsurancePositionUpdate={(insurance) =>
          updateInsurancePosition(scenario.id, insurance)
        }
        onInsurancePositionRemove={(insuranceId) =>
          removeInsurancePosition(scenario.id, insuranceId)
        }
        onLoanPositionAdd={(loan) => addLoanPosition(scenario.id, loan)}
        onLoanPositionUpdate={(loan) => updateLoanPosition(scenario.id, loan)}
        onLoanPositionRemove={(loanId) => removeLoanPosition(scenario.id, loanId)}
        onMergeDuplicates={(cluster, baseDefinitionId) =>
          mergeDuplicateEvents(cluster, baseDefinitionId)
        }
      />
    );
  }

  return (
    <TimelineMobile
      eventViews={eventViews}
      eventLibrary={eventLibrary}
      scenarios={scenarios}
      homePositions={homePositions}
      carPositions={carPositions}
      investmentPositions={investmentPositions}
      insurancePositions={insurancePositions}
      loanPositions={loanPositions}
      members={scopedMembers}
      baseCurrency={baseCurrency}
      baseMonth={baseMonth}
      assumptions={assumptions}
      scenarioId={scenario.id}
      projection={projection}
      onAddDefinition={(definition, scenarioIds) => {
        if (scenarioIds.length <= 1 && scenarioIds[0] === scenario.id) {
          addEventDefinition(definition);
          addScenarioEventRef(scenario.id, { refId: definition.id, enabled: true });
          return;
        }
        addEventToScenarios(definition, scenarioIds);
      }}
      onUpdateDefinition={updateEventDefinition}
      onUpdateEventRef={(refId, patch) =>
        updateScenarioEventRef(scenario.id, refId, patch)
      }
      onRemoveEventRef={(refId) => removeScenarioEventRef(scenario.id, refId)}
      onHomePositionAdd={(home) => addHomePosition(scenario.id, home)}
      onHomePositionUpdate={(home) => updateHomePosition(scenario.id, home)}
      onHomePositionRemove={(homeId) => removeHomePosition(scenario.id, homeId)}
      onCarPositionAdd={(car) => addCarPosition(scenario.id, car)}
      onCarPositionUpdate={(car) => updateCarPosition(scenario.id, car)}
      onCarPositionRemove={(carId) => removeCarPosition(scenario.id, carId)}
      onInvestmentPositionAdd={(investment) =>
        addInvestmentPosition(scenario.id, investment)
      }
      onInvestmentPositionUpdate={(investment) =>
        updateInvestmentPosition(scenario.id, investment)
      }
      onInvestmentPositionRemove={(investmentId) =>
        removeInvestmentPosition(scenario.id, investmentId)
      }
      onInsurancePositionAdd={(insurance) =>
        addInsurancePosition(scenario.id, insurance)
      }
      onInsurancePositionUpdate={(insurance) =>
        updateInsurancePosition(scenario.id, insurance)
      }
      onInsurancePositionRemove={(insuranceId) =>
        removeInsurancePosition(scenario.id, insuranceId)
      }
      onLoanPositionAdd={(loan) => addLoanPosition(scenario.id, loan)}
      onLoanPositionUpdate={(loan) => updateLoanPosition(scenario.id, loan)}
      onLoanPositionRemove={(loanId) => removeLoanPosition(scenario.id, loanId)}
      onMergeDuplicates={(cluster, baseDefinitionId) =>
        mergeDuplicateEvents(cluster, baseDefinitionId)
      }
    />
  );
}
