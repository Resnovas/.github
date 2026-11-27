# AGENT-SETUP

Machine-only. People: `README.md`, `AGENTS.md`.

## Needs

- Node 24.15+ (`engines.node`), npm and network for the locked lint dependencies. No services or database.
- `uv` for local graph setup; Python 3 for synthetic lifecycle tests. CI setup does not generate repository graphs.

## Env

- None required. No token for setup, render, test or check.

## Setup

- `scripts/agent-setup`. Idempotent. Steps: Node check, frozen dependency install, `node --run setup` (editor surfaces and hooks), `node --run verify:static`, `node --run check`, then Graphify setup outside CI.
- Success: last line `agent-setup: ok`. Initial local graph setup installs the tool and parses source; later runs reuse an unchanged graph. See `docs/graphify.md`.

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
