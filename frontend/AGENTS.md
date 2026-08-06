# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions — 2026-08-06

- Keep the current graduation-project phase focused on one UIT school and the end-to-end recruitment happy flow.
- The student application flow has two steps: select CV/documents, then review consent and submit. Do not include employer screening questions in the MVP.
- Direct withdrawal is available only before the interview stage. Withdrawal requires a reason and creates an immutable history entry; later stages use cancel-interview or decline-offer actions.
- The company candidate pipeline must expose a visible `Không phù hợp` action in addition to advancing a candidate.
- A passed interview does not automatically close other applications. Other active applications close only after the student accepts the offer and UIT confirms the placement.
- Basic in-app event notifications are MVP. Email/FCM, daily digest Cron Jobs, Scheduler administration, and advanced delivery retry/logging are Phase 2.
