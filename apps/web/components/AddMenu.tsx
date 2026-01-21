"use client";

import { Button, Menu, Modal, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "../src/i18n/navigation";

const buildHref = (
  path: string,
  params: Record<string, string | undefined>,
  scenarioId?: string | null
) => {
  const query = new URLSearchParams();
  if (scenarioId) {
    query.set("scenarioId", scenarioId);
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

type AddMenuProps = {
  scenarioId?: string | null;
};

export default function AddMenu({ scenarioId }: AddMenuProps) {
  const t = useTranslations("toolbar");
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  const ruleHref = buildHref("/people", { tab: "budget", add: "rule" }, scenarioId);
  const eventHref = buildHref("/money", { tab: "timeline", add: "event" }, scenarioId);
  const homeHref = buildHref("/money", { tab: "assets", add: "home" }, scenarioId);
  const investmentHref = buildHref(
    "/money",
    { tab: "assets", add: "investment" },
    scenarioId
  );
  const insuranceHref = buildHref(
    "/money",
    { tab: "assets", add: "insurance" },
    scenarioId
  );
  const carHref = buildHref("/money", { tab: "assets", add: "car" }, scenarioId);
  const loanHref = buildHref("/money", { tab: "liabilities", add: "loan" }, scenarioId);

  return (
    <>
      <Menu shadow="md" width={220} position="top-start">
        <Menu.Target>
          <Button size="sm">{t("addButton")}</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item component={Link} href={ruleHref}>
            {t("addRule")}
          </Menu.Item>
          <Menu.Item onClick={() => setAssetModalOpen(true)}>
            {t("addAssetDebt")}
          </Menu.Item>
          <Menu.Item component={Link} href={eventHref}>
            {t("addEvent")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={assetModalOpen}
        onClose={() => setAssetModalOpen(false)}
        title={t("assetDebtTitle")}
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("assetDebtHint")}
          </Text>
          <Stack gap="xs">
            <Button
              component={Link}
              href={homeHref}
              variant="light"
              onClick={() => setAssetModalOpen(false)}
            >
              {t("addHome")}
            </Button>
            <Button
              component={Link}
              href={investmentHref}
              variant="light"
              onClick={() => setAssetModalOpen(false)}
            >
              {t("addInvestment")}
            </Button>
            <Button
              component={Link}
              href={insuranceHref}
              variant="light"
              onClick={() => setAssetModalOpen(false)}
            >
              {t("addInsurance")}
            </Button>
            <Button
              component={Link}
              href={carHref}
              variant="light"
              onClick={() => setAssetModalOpen(false)}
            >
              {t("addCar")}
            </Button>
            <Button
              component={Link}
              href={loanHref}
              variant="light"
              onClick={() => setAssetModalOpen(false)}
            >
              {t("addLoan")}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}
