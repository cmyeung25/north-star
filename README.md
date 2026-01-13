# North Star

North Star is a mobile-first PWA life-stage financial planner focused on planning and
simulation. This project is designed for browser-first computation with a thin backend and
no investment product recommendations.

## What this project is

- **Browser-first computation:** the TypeScript engine runs in the client and shared runtimes.
- **Thin backend:** intended for Firebase / Google Cloud integration later.
- **Mobile-first PWA:** responsive, offline-capable, and usable on desktop.
- **Planning only:** no investment advice or product recommendations.

## Monorepo layout

```
apps/
  web/        Next.js PWA
packages/
  engine/     TypeScript compute engine
  types/      Shared Zod schemas/types
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```
pnpm install
```

### Common scripts

```
pnpm lint
pnpm typecheck
pnpm test
```

## High-level architecture

- **apps/web** provides the PWA shell and UI surfaces.
- **packages/engine** hosts deterministic, browser-first computation.
- **packages/types** centralizes shared schema definitions.

For product phases and scope boundaries, see [SPEC.md](./SPEC.md).
