# Aurin Theme Foundation

This folder defines the Aurin design-system foundation for the web app.

## Token meanings

- **polar**: brand navy scale used for structural UI surfaces and strong contrast text.
- **aurora**: primary action scale used for CTA states and emphasis.
- **ice**: informational/comparison accent scale.
- **neutral**: slate text and surface scale for body copy, borders, and app backgrounds.
- **success / warning / danger / info**: semantic intent colors for feedback components.

## Mantine mapping

- `primaryColor = "aurora"`
- `colors.polar[9] = #0B1B3A`
- `colors.aurora[6] = #23D5AB`
- `colors.ice[6] = #5BC0EB`
- Neutral text mapping:
  - title: `neutral[9]`
  - body: `neutral[7]`
  - muted: `neutral[5]`
  - border: `neutral[2]`
  - surface: `neutral[0]`

## Usage guidelines

- Use **Aurora** as the default primary action color.
- Use **Polar** for high-emphasis text and top-level layout accents.
- Use **Ice** for informational accents and A/B comparison visuals (e.g., chart comparison series B).
- Keep component overrides modest and foundation-level. Page-level redesigns should happen in feature modules, not theme primitives.
