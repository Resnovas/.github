# AGENT-SETUP

Machine-only. People: `README.md`, `AGENTS.md`.

## Needs

- Node 24.15+ (`engines.node`), npm and network for the locked lint dependencies. No services or database.
- `uv` only for the code graph (`sh tools/graphify/graphify setup`), optional.

## Env

- None required. No token for setup, render, test or check.

## Setup

- `scripts/agent-setup`. Idempotent. Steps: Node check, frozen dependency install, `node --run setup` (editor surfaces and hooks), `node --run verify:static`, `node --run check`.
- Success: last line `agent-setup: ok`. A few seconds.

## Run

| Job | Cmd |
| --- | --- |
| render templates into the root | `npm run render` |
| test | `npm test` |
| static checks first | `node --run verify:static` |
| consistency and complete test gate | `node --run verify` |
| affected funnel evidence | `node --run verify:evidence` after staging |
| code graph | `sh tools/graphify/graphify update` |
| agent files | `node tools/dev/surfaces.mjs sync` after editing `.agents/` |

## Breaks

| Break | Cause | Fix |
| --- | --- | --- |
| `Rendered files are out of date` | a rendered copy was edited | edit under `templates/`, then `npm run render` |
| `The house commit hook is not installed` | fresh clone | `node --run setup` |
| `LLMS.md is out of date` | `ai-docs/src` changed | `npm run ai-docs` |
