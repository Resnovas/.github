# <a id="top"></a>Resnovas house repository

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Resnovas/.github/badge)](https://scorecard.dev/viewer/?uri=github.com/Resnovas/.github)

This repository is the **house**: the one place that decides how every Resnovas repository is set up and run.
It holds the rules (contributing, the AI policy, the code of conduct, the licence), the shared configuration (Dependabot, code owners, issue forms, review bots, editor tasks), the checks that enforce the rules, and the workflows every repository reuses.

Why it exists: without it, each repository would keep its own copy of the same forty files, and the copies would slowly drift apart.
Here there is one copy.
A robot called the **sync** copies it into every repository once a week, as a pull request someone reviews and merges.
Change a rule here, and every repository gets the change.

Because the repository is public and named `.github`, GitHub also shows its root documents (such as `CONTRIBUTING.md` and `SECURITY.md`) in any Resnovas repository that has none of its own.

## <a id="start"></a>Where to start

| You want to | Read |
| --- | --- |
| Understand the words used here (sync, preset, managed block, ruleset) | [Getting started: the words](docs/getting-started.md#words) |
| Bring a repository under the house, step by step | [Getting started: adopting a repository](docs/getting-started.md#adopting) |
| Know what each synced file is and does | [Synced files](docs/synced-files.md) |
| Keep your own lines in a synced file, or skip a file | [The sync](docs/sync.md) |
| Understand every setting in the house preset | [The house preset](docs/preset.md) |
| Use a reusable workflow, or know what a house check does | [Workflows](docs/workflows.md) |
| Set up the Resnovas Bot app, secrets and variables | [Access: the app, secrets and variables](docs/access.md) |
| Set up CI the house way (matrix, caching, nightly runs, flaky tests) | [CI standards](docs/ci-standards.md) |
| Release and publish changelogs | [Releases](docs/releases.md) |
| Write documentation for AI agents (`ai-docs`, `LLMS.md`) | [AI docs](docs/ai-docs.md) |
| Fix something that went wrong | [Troubleshooting](docs/troubleshooting.md) |
| Change a house rule or template | [Changing the house](#changing) below |

An AI agent should read [`LLMS.md`](LLMS.md) instead: the same ground, written for agents, generated from [`ai-docs/src`](ai-docs/src).

## <a id="layout"></a>What is in this repository

| Path | What it is |
| --- | --- |
| `templates/` | The source of every synced file. `{{KEY}}` in a template is a placeholder filled in per repository. **Edit files here, never the copies.** `templates/.agents/skills/` holds the house skills every repository gets. |
| `skills/` | House skills that do not sync everywhere (host-specific ones, and this repository's own jobs), published to the catalogue with the synced ones. |
| `house.yml` | The values the placeholders get when this repository renders its own copies. |
| root files and `.github/` | This repository's own rendered copies of `templates/`. CI fails if they are out of date. |
| `smartcloud/house.yml` | The **house preset**: the smartcloud settings every repository inherits. See [The house preset](docs/preset.md). |
| `.github/workflows/` | This repository's CI (`ci.yml`), the synced workflows, and the **reusable workflows** other repositories call. See [Workflows](docs/workflows.md). |
| `scripts/` | The renderer that turns `templates/` into files. Plain Node, no dependencies. |
| `test/` | Tests for the renderer, the managed blocks, the workflows and the synced tools. |
| `ai-docs/`, `LLMS.md` | Documentation for AI agents, and the file generated from it. |
| `docs/` | The guides linked above. |

## <a id="changing"></a>Changing the house

You need Node 24 or newer. There is nothing to install.

1. Edit the file under `templates/`, or a default in `house.yml`.
   Every value except `REPOSITORY` and `HOUSE_EXCLUDE` also goes, unchanged, under `sync.values` in `smartcloud/house.yml`, because that is where the other repositories' sync reads values from; `test/values.test.mjs` fails if the two differ.
1. Run `npm run render`. It rewrites this repository's own copies from the templates.
1. Update the documentation twice: the page under `docs/` (or this README) for people, and the section under `ai-docs/src` for agents. Then run `npm run ai-docs` to rebuild `LLMS.md`.
1. Run `npm test` and `npm run check`.
1. Commit everything together and open a pull request.

After it merges, every repository gets the change in its next sync pull request, within a week, or straight away when someone runs its smartcloud workflow by hand.
Changes to the preset and to the reusable workflows are read from `main` on every run, so they apply everywhere as soon as they merge.

| Command | What it does |
| --- | --- |
| `npm run render` | Writes the templates into this repository. |
| `npm run check` | Fails if the rendered files, the agent commands or `LLMS.md` are out of date. CI runs it. |
| `npm test` | Runs the tests. CI runs them on Linux, macOS and Windows. |
| `npm run ai-docs` | Rebuilds `LLMS.md` from `ai-docs/src`. |
| `npm run setup` | Registers the editor and agent app actions for your checkout. |
| `node scripts/render.mjs --out .render-preview --repository Resnovas/example` | Shows what another repository would get, in `.render-preview/`. |
