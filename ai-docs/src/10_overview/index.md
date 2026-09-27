## What this repository is

`Resnovas/.github` is the house repository: the one source of the governance
documents, shared configuration, editor and agent surfaces, reusable workflows
and the smartcloud preset that every Resnovas repository uses. Nothing here is
an application. It is templates, a small renderer, workflows and tests.

Because the repository is named `.github`, GitHub also uses its root documents
(CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT and the issue and pull
request templates) as defaults for every repository in the organisation that
has none of its own.

| Path | What it is | Edit it? |
| --- | --- | --- |
| `templates/` | The source of every synced file, with `{{KEY}}` placeholders. | Yes: this is where house changes go. |
| `house.yml` | Values the placeholders resolve to when this repository renders its own root. | Yes, for a house default. |
| root files, `.github/` (except the reusable workflows), `tools/`, `ai-docs/src/05_house-standards` | Rendered copies of `templates/`. | Never by hand: render them. |
| `smartcloud/house.yml` | The locked smartcloud preset every repository extends. | Yes. |
| `.github/workflows/{attest,codeql,dependency-review,graphify,scorecard,workflow-lint}.yml` | Reusable workflows other repositories call. | Yes. |
| `.github/workflows/ci.yml` | This repository's own CI. | Yes. |
| `scripts/render.mjs`, `scripts/lib/` | The dependency-free renderer. | Yes, with tests. |
| `test/` | `node:test` tests for the renderer, managed blocks, workflows and synced tools. | Yes. |
| `ai-docs/src/10_*` and up, `LLMS.md` | This guide and its generated output. | Sources yes, `LLMS.md` never. |
| `docs/` | The people-facing guides the README links to. | Yes. |

Commands (Node 24 or newer, no install step, no dependencies):

| Command | What it does |
| --- | --- |
| `npm run render` | Renders `templates/` into this repository's root. |
| `npm test` | Runs every test with coverage of `scripts/lib`. |
| `npm run check` | What CI's `rendered` job runs: the rendered files are current, the agent commands and MCP configs match their sources, and `LLMS.md` matches `ai-docs/src`. |
| `npm run ai-docs` | Regenerates `LLMS.md`. |
| `node scripts/render.mjs --out .render-preview --repository Resnovas/example` | Previews what a downstream repository would get. |

CI (`.github/workflows/ci.yml`) runs `npm test` on Linux, macOS and Windows with
Node 24 and the current release, runs `npm run check` once, and reports one
aggregate `check` job that the ruleset requires.
