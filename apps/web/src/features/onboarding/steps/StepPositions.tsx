import {
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type {
  CarPosition,
  HomePositionDraft,
  InvestmentPosition,
  LoanPosition,
} from "../../../store/scenarioStore";

interface StepPositionsProps {
  homes: HomePositionDraft[];
  cars: CarPosition[];
  investments: InvestmentPosition[];
  loans: LoanPosition[];
  onAddHome: () => void;
  onAddCar: () => void;
  onAddInvestment: () => void;
  onAddLoan: () => void;
  onUpdateHome: (id: string, patch: Partial<HomePositionDraft>) => void;
  onUpdateCar: (id: string, patch: Partial<CarPosition>) => void;
  onUpdateInvestment: (id: string, patch: Partial<InvestmentPosition>) => void;
  onUpdateLoan: (id: string, patch: Partial<LoanPosition>) => void;
  onRemoveHome: (id: string) => void;
  onRemoveCar: (id: string) => void;
  onRemoveInvestment: (id: string) => void;
  onRemoveLoan: (id: string) => void;
  errors: Record<string, string>;
  t: (key: string) => string;
}

export default function StepPositions({
  homes,
  cars,
  investments,
  loans,
  onAddHome,
  onAddCar,
  onAddInvestment,
  onAddLoan,
  onUpdateHome,
  onUpdateCar,
  onUpdateInvestment,
  onUpdateLoan,
  onRemoveHome,
  onRemoveCar,
  onRemoveInvestment,
  onRemoveLoan,
  errors,
  t,
}: StepPositionsProps) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("positionsTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("positionsDescription")}
        </Text>
      </Stack>

      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>{t("homes")}</Text>
          <Button variant="outline" size="xs" onClick={onAddHome}>
            {t("addHome")}
          </Button>
        </Group>
        {homes.map((home) => (
          <Card key={home.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{t("home")}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveHome(home.id)}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("purchaseMonth")}
                  placeholder="YYYY-MM"
                  value={home.purchaseMonth ?? ""}
                  onChange={(event) =>
                    onUpdateHome(home.id, { purchaseMonth: event.currentTarget.value })
                  }
                  error={errors[`home.${home.id}.purchaseMonth`]}
                />
                <NumberInput
                  label={t("purchasePrice")}
                  min={0}
                  value={home.purchasePrice ?? 0}
                  onChange={(value) =>
                    onUpdateHome(home.id, { purchasePrice: Number(value) })
                  }
                  error={errors[`home.${home.id}.purchasePrice`]}
                />
                <NumberInput
                  label={t("downPayment")}
                  min={0}
                  value={home.downPayment ?? 0}
                  onChange={(value) =>
                    onUpdateHome(home.id, { downPayment: Number(value) })
                  }
                />
              </Group>
              <Group grow align="flex-start">
                <NumberInput
                  label={t("mortgageRate")}
                  min={0}
                  step={0.1}
                  value={home.mortgageRatePct ?? 0}
                  onChange={(value) =>
                    onUpdateHome(home.id, { mortgageRatePct: Number(value) })
                  }
                />
                <NumberInput
                  label={t("mortgageTermYears")}
                  min={1}
                  value={home.mortgageTermYears ?? 30}
                  onChange={(value) =>
                    onUpdateHome(home.id, { mortgageTermYears: Number(value) })
                  }
                />
                <NumberInput
                  label={t("holdingCostMonthly")}
                  min={0}
                  value={home.holdingCostMonthly ?? 0}
                  onChange={(value) =>
                    onUpdateHome(home.id, { holdingCostMonthly: Number(value) })
                  }
                />
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>{t("cars")}</Text>
          <Button variant="outline" size="xs" onClick={onAddCar}>
            {t("addCar")}
          </Button>
        </Group>
        {cars.map((car) => (
          <Card key={car.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{t("car")}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveCar(car.id ?? "")}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("purchaseMonth")}
                  placeholder="YYYY-MM"
                  value={car.purchaseMonth}
                  onChange={(event) =>
                    onUpdateCar(car.id ?? "", { purchaseMonth: event.currentTarget.value })
                  }
                  error={errors[`car.${car.id}.purchaseMonth`]}
                />
                <NumberInput
                  label={t("purchasePrice")}
                  min={0}
                  value={car.purchasePrice}
                  onChange={(value) =>
                    onUpdateCar(car.id ?? "", { purchasePrice: Number(value) })
                  }
                  error={errors[`car.${car.id}.purchasePrice`]}
                />
                <NumberInput
                  label={t("downPayment")}
                  min={0}
                  value={car.downPayment}
                  onChange={(value) =>
                    onUpdateCar(car.id ?? "", { downPayment: Number(value) })
                  }
                />
              </Group>
              <Group grow align="flex-start">
                <NumberInput
                  label={t("loanRate")}
                  min={0}
                  step={0.1}
                  value={car.loan?.annualInterestRatePct ?? 0}
                  onChange={(value) =>
                    onUpdateCar(car.id ?? "", {
                      loan: {
                        principal: car.loan?.principal ?? 0,
                        termYears: car.loan?.termYears ?? 5,
                        annualInterestRatePct: Number(value),
                      },
                    })
                  }
                />
                <NumberInput
                  label={t("loanTermYears")}
                  min={1}
                  value={car.loan?.termYears ?? 5}
                  onChange={(value) =>
                    onUpdateCar(car.id ?? "", {
                      loan: {
                        principal: car.loan?.principal ?? 0,
                        termYears: Number(value),
                        annualInterestRatePct: car.loan?.annualInterestRatePct ?? 0,
                      },
                    })
                  }
                />
                <NumberInput
                  label={t("holdingCostMonthly")}
                  min={0}
                  value={car.holdingCostMonthly}
                  onChange={(value) =>
                    onUpdateCar(car.id ?? "", { holdingCostMonthly: Number(value) })
                  }
                />
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>{t("investments")}</Text>
          <Button variant="outline" size="xs" onClick={onAddInvestment}>
            {t("addInvestment")}
          </Button>
        </Group>
        {investments.map((investment) => (
          <Card key={investment.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{t("investment")}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveInvestment(investment.id ?? "")}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("startMonth")}
                  placeholder="YYYY-MM"
                  value={investment.startMonth}
                  onChange={(event) =>
                    onUpdateInvestment(investment.id ?? "", {
                      startMonth: event.currentTarget.value,
                    })
                  }
                  error={errors[`investment.${investment.id}.startMonth`]}
                />
                <NumberInput
                  label={t("monthlyContribution")}
                  min={0}
                  value={investment.monthlyContribution ?? 0}
                  onChange={(value) =>
                    onUpdateInvestment(investment.id ?? "", {
                      monthlyContribution: Number(value),
                    })
                  }
                />
                <NumberInput
                  label={t("expectedReturn")}
                  min={0}
                  step={0.1}
                  value={investment.expectedAnnualReturnPct ?? 0}
                  onChange={(value) =>
                    onUpdateInvestment(investment.id ?? "", {
                      expectedAnnualReturnPct: Number(value),
                    })
                  }
                />
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text fw={600}>{t("loans")}</Text>
          <Button variant="outline" size="xs" onClick={onAddLoan}>
            {t("addLoan")}
          </Button>
        </Group>
        {loans.map((loan) => (
          <Card key={loan.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{t("loan")}</Text>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={() => onRemoveLoan(loan.id ?? "")}
                >
                  {t("remove")}
                </Button>
              </Group>
              <Group grow align="flex-start">
                <TextInput
                  label={t("startMonth")}
                  placeholder="YYYY-MM"
                  value={loan.startMonth}
                  onChange={(event) =>
                    onUpdateLoan(loan.id ?? "", { startMonth: event.currentTarget.value })
                  }
                  error={errors[`loan.${loan.id}.startMonth`]}
                />
                <NumberInput
                  label={t("principal")}
                  min={0}
                  value={loan.principal}
                  onChange={(value) =>
                    onUpdateLoan(loan.id ?? "", { principal: Number(value) })
                  }
                  error={errors[`loan.${loan.id}.principal`]}
                />
                <NumberInput
                  label={t("loanRate")}
                  min={0}
                  step={0.1}
                  value={loan.annualInterestRatePct}
                  onChange={(value) =>
                    onUpdateLoan(loan.id ?? "", { annualInterestRatePct: Number(value) })
                  }
                />
                <NumberInput
                  label={t("loanTermYears")}
                  min={1}
                  value={loan.termYears}
                  onChange={(value) =>
                    onUpdateLoan(loan.id ?? "", { termYears: Number(value) })
                  }
                />
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
