# AGENT-SETUP

Machine-only. People: `README.md`, `AGENTS.md`.

## Needs

- Node 24+ (`engines.node`). No dependencies, no install step, no services, no database.
- `uv` only for the code graph (`sh tools/graphify/graphify setup`), optional.

## Env

- None required. No token for setup, render, test or check.

## Setup

- `scripts/agent-setup`. Idempotent. Steps: Node check, `node --run setup` (editor surfaces, commit hook), `node --run check`.
- Success: last line `agent-setup: ok`. A few seconds.

## Run

| Job | Cmd |
| --- | --- |
| render templates into the root | `npm run render` |
| test | `npm test` |
| all CI | `npm run check` |
| code graph | `sh tools/graphify/graphify update` |
| agent files | `node tools/dev/surfaces.mjs sync` after editing `.agents/` |

## Breaks

| Break | Cause | Fix |
| --- | --- | --- |
| `Rendered files are out of date` | a rendered copy was edited | edit under `templates/`, then `npm run render` |
| `The house commit hook is not installed` | fresh clone | `node --run setup` |
| `LLMS.md is out of date` | `ai-docs/src` changed | `npm run ai-docs` |
