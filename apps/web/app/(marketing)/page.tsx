import Link from "next/link";
import { Anchor, Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import BrandLogo from "../../components/brand/BrandLogo";

export default function MarketingLandingPage() {
  return (
    <Container size="sm" py={56}>
      <Stack gap="lg" align="flex-start">
        <BrandLogo href="/web" size="lg" />
        <Stack gap="xs">
          <Title order={1}>North Star</Title>
          <Text c="dimmed" maw={640}>
            Plan your financial future with scenario-based simulations powered by Aurin&apos;s Polar Night and
            Aurora design language.
          </Text>
        </Stack>
        <Group gap="sm" wrap="wrap">
          <Button component={Link} href="/web" size="md">
            Go to marketing overview
          </Button>
          <Button component={Link} href="/auth/login" variant="outline" size="md">
            Sign in
          </Button>
          <Anchor component={Link} href="/app" fw={600}>
            Open app
          </Anchor>
        </Group>
      </Stack>
    </Container>
  );
}
