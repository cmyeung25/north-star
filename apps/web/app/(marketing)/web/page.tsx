"use client";

import Link from "next/link";
import {
  Accordion,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";

const features = [
  {
    icon: "🧭",
    title: "Scenario 隔離",
    description: "每個人生方案互不污染，A/B 比較更準確。",
  },
  {
    icon: "⚡",
    title: "快速 Onboarding",
    description: "約 5 分鐘建立 baseline，立即開始推演。",
  },
  {
    icon: "📊",
    title: "Dashboard",
    description: "現金流、資產淨值、風險指標集中檢視。",
  },
  {
    icon: "🧪",
    title: "Plan Lab",
    description: "調整假設與實驗參數，即時投影月度變化。",
  },
  {
    icon: "🔍",
    title: "A/B 比較",
    description: "兩個方案差異一眼看清，決策更有把握。",
  },
  {
    icon: "🛡️",
    title: "Guardrails",
    description: "提醒 baseline drift 與 double counting 風險。",
  },
];

const steps = ["建立 Case", "建立 Scenario 並完成 Onboarding", "Dashboard 檢視 → Plan Lab 試方案"];

const faqs = [
  {
    question: "不同 Scenario 會互相影響嗎？",
    answer: "不會。每個 Scenario 都是隔離狀態，方便你在同一個 Case 下安全比較。",
  },
  {
    question: "我可以之後再改假設 / 收支嗎？",
    answer: "可以，任何時候都能回來調整參數，系統會即時更新投影。",
  },
  {
    question: "資料保存在哪裡？可否匯出？",
    answer: "資料會保存於你的帳號環境，匯出功能可在後續版本透過支援流程提供。",
  },
  {
    question: "一個 Case 可唔可以有多個 Scenario？",
    answer: "可以，一個 Case 可以建立多個 Scenario，適合測試不同人生決策路徑。",
  },
];

export default function MarketingWebPage() {
  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 10% 5%, rgba(35, 213, 171, 0.2), transparent 35%), radial-gradient(circle at 90% 0%, rgba(74, 116, 255, 0.24), transparent 30%), #0B1B3A",
      }}
    >
      <Container size="lg" py={{ base: 40, sm: 64 }}>
        <Stack gap={56}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "xl", md: 48 }}>
            <Stack gap="lg" justify="center">
              <Badge variant="light" color="aurora" size="lg" w="fit-content">
                Aurin Financial OS
              </Badge>
              <Stack gap="sm">
                <Title order={1} c="white" maw={560}>
                  以極光般的清晰，照亮你的理財決策
                </Title>
                <Text c="var(--mantine-color-polar-1)" maw={560}>
                  以 Scenario（情境）隔離不同人生方案，把收入 / 支出 / 資產 / 負債投影成月度時間線，再用 Plan
                  Lab 做方案比較。
                </Text>
              </Stack>
              <Group gap="sm" wrap="wrap">
                <Button component={Link} href="/auth/login" size="md" color="aurora">
                  免費開始
                </Button>
                <Button component={Link} href="/auth/login" size="md" variant="outline" c="white">
                  登入
                </Button>
                <Anchor component={Link} href="/member/cases" c="aurora.2" fw={600}>
                  進入我的 Plans（Cases）
                </Anchor>
              </Group>
            </Stack>
            <Card
              bg="rgba(11, 27, 58, 0.45)"
              style={{ backdropFilter: "blur(8px)", borderColor: "rgba(184, 203, 255, 0.4)" }}
              p="xl"
            >
              <Stack gap="md">
                <Text fw={700} c="white">
                  決策模擬快照
                </Text>
                <Paper p="md" radius="md" bg="rgba(35, 213, 171, 0.15)">
                  <Text fw={600} c="white">
                    Case：35 歲轉職 + 置業規劃
                  </Text>
                  <Text size="sm" c="var(--mantine-color-polar-1)">
                    Scenario A：穩健增長 / Scenario B：提前置業，淨值差異可視化。
                  </Text>
                </Paper>
                <Stack gap={6} c="var(--mantine-color-polar-1)">
                  <Text size="sm">• 每月現金流趨勢</Text>
                  <Text size="sm">• 資產淨值變化</Text>
                  <Text size="sm">• 風險告警與 guardrails</Text>
                </Stack>
              </Stack>
            </Card>
          </SimpleGrid>

          <Stack gap="md">
            <Title order={2} c="white">
              功能亮點
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {features.map((feature) => (
                <Card key={feature.title} bg="white" h="100%">
                  <Stack gap="sm">
                    <Group gap="xs" align="center">
                      <ThemeIcon radius="xl" color="aurora" variant="light" size="lg">
                        <Text>{feature.icon}</Text>
                      </ThemeIcon>
                      <Text fw={600}>{feature.title}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {feature.description}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>

          <Stack gap="md">
            <Title order={2} c="white">
              How it works
            </Title>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {steps.map((step, index) => (
                <Card key={step} bg="rgba(255,255,255,0.96)">
                  <Stack gap="xs">
                    <Badge variant="filled" color="aurora" w="fit-content">
                      Step {index + 1}
                    </Badge>
                    <Text fw={600}>{step}</Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>

          <Stack gap="md">
            <Title order={2} c="white">
              FAQ
            </Title>
            <Accordion radius="md" variant="contained">
              {faqs.map((faq) => (
                <Accordion.Item key={faq.question} value={faq.question}>
                  <Accordion.Control>{faq.question}</Accordion.Control>
                  <Accordion.Panel>{faq.answer}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>

          <Divider color="rgba(221, 231, 255, 0.35)" />

          <Group justify="space-between" align="flex-start" c="var(--mantine-color-polar-1)" wrap="wrap">
            <Stack gap={4}>
              <Text fw={700} c="white">
                North Star
              </Text>
              <Text size="sm">Scenario-first 財務規劃平台</Text>
            </Stack>
            <Group gap="lg" wrap="wrap">
              <Anchor href="#" c="var(--mantine-color-polar-1)">
                功能
              </Anchor>
              <Anchor href="#" c="var(--mantine-color-polar-1)">
                價格
              </Anchor>
              <Anchor href="#" c="var(--mantine-color-polar-1)">
                隱私
              </Anchor>
              <Anchor href="#" c="var(--mantine-color-polar-1)">
                支援
              </Anchor>
            </Group>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
