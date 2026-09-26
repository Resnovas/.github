# <a id="top"></a>Resnovas house repository

The single source of truth for the governance files every Resnovas project ships with, across Resnovas, Eventiva and personal repositories.  
It holds the contributing guidelines, the AI contribution policy, the code of conduct, the Developer Certificate of Origin, the FCL-1.0-MIT licence, the  Cooperation Commitment, and the issue and pull request templates, together with the checks that enforce them.

Because this repository is public and named `.github`, GitHub also uses these files as the defaults for every repository in the Resnovas organisation that does not have its own.

## <a id="layout"></a>Layout

| Path | What it is |
| --- | --- |
| `templates/` | The source of every governed file, with `{{KEY}}` placeholders. **Edit files here, never the rendered copies.** |
| `house.yml` | The values placeholders resolve to. Everything currently resolves to Resnovas. |
| root and `.github/` | The files rendered from `templates/` with the default values. CI fails if they are out of date. |
| `smartcloud/house.yml` | The locked smartcloud preset every repository extends: roles, the AI disclosure, DCO and title checks, the review gate, labels, the repository settings baseline, and the sync of `templates/`. smartcloud is the engine that enforces it. |
| `templates/.github/workflows/smartcloud.yml` | The one workflow every repository runs: the pull request checks, label sync, repository settings and the weekly house sync. |
| `scripts/` | The renderer this repository uses to render its own root, since smartcloud's sync skips the source repository. Dependency-free Node. |
| `test/` | Tests for the renderer and the managed blocks, run with `npm test`. |

## <a id="managed-blocks"></a>Documents and extendable configuration

Documents (the root Markdown documents and `LICENSE`) are synced whole.

Configuration files are extendable: each template wraps its synced content in `house:managed:begin` and `house:managed:end`, and marks where a repository's own rules go with `house:local`.
The sync replaces only the managed block and keeps everything else, so a repository can add Dependabot updates, code owners, issue form fields, contact links, funding platforms, pull request template sections or workflow jobs without losing them.

Local rules can extend the synced ones but not change them.
The policy check fails a pull request that edits a managed block or a synced document, and flags local rules that would redefine a synced one: a duplicate Dependabot update, a redefined top-level YAML key, a reused issue form field id, or a redefined job.
In `CODEOWNERS` the managed block comes last, because the last matching rule wins.

When a repository first adopts a file it already had, its previous content is kept, commented out at the `house:local` line, for someone to re-add as local rules.
Making a template extendable only needs the three marker lines; `scripts/lib/managed.mjs` handles the rest.

## <a id="surfaces"></a>Editor and agent surfaces

Every repository gets the same one-click tasks, debug configurations and app actions, synced from `templates/` with managed blocks like the rest of the configuration:

| Path | Surface |
| --- | --- |
| `.zed/tasks.json`, `.zed/debug.json` | Zed |
| `.vscode/tasks.json`, `.vscode/launch.json` | VS Code and Cursor |
| `.run/house-*.run.xml` | JetBrains; a repository adds its own as other files in `.run/` |
| `.codex/environments/environment.toml` | Codex desktop |
| `orca.yaml` | Orca worktree setup |
| `.agents/surfaces.json` | Orca quick commands and OpenChamber project actions |
| `.agents/prompts/*.md` | Agent prompts; a repository adds its own beside the synced ones |
| `tools/dev/surfaces.mjs`, `tools/dev/open.mjs` | The tool that installs and generates the above |

The synced entries only rely on three package scripts every repository must have, `setup`, `check` and `test`, run with `node --run` so they work under npm and pnpm alike, and on the synced tools.
Everything specific to a repository (its dev server, docs server, debug targets and prompts) goes after the `house:local` line.
The JSON files are JSON with comments, so their markers are `//` lines; a local entry may not reuse a synced label, name or id.

Orca and OpenChamber keep quick commands and project actions in per-user settings, so `node tools/dev/surfaces.mjs install` registers them for the checkout; each repository's `setup` script runs it.
`node tools/dev/surfaces.mjs sync` writes `.agents/prompts` to `.claude/commands`, `.cursor/commands` and `.opencode/commands`, which it owns, and a repository's `check` script runs `surfaces.mjs check` so they cannot drift.

This repository has no documentation site to serve: its documents are the Markdown files in the root, which GitHub renders.

## <a id="changing"></a>Changing a policy or template

1. Edit the file under `templates/`, or a default in `house.yml`.
1. Run `npm run render` to update the rendered copies, and `npm test`.
1. Commit both.
Every downstream repository picks the change up in its next sync pull request.

## <a id="adopting"></a>Adopting it in a repository

1. Copy `templates/.github/smartcloud.yml` and `templates/.github/workflows/smartcloud.yml` into the repository, or let the first sync add them.
1. Add the repository's own configuration after the `house:local` line of `.github/smartcloud.yml`: keys the preset leaves unset, such as `settings.environments` or `sync.exclude` for a template path it keeps its own copy of.
1. Make sure the organisation has the `ACCESS_TOKEN` secret (see [The sync token](#sync-token)).
1. Run the smartcloud workflow once by hand to open the first sync pull request.
1. Give the repository `setup`, `check` and `test` package scripts; the synced editor and agent surfaces run them.
1. Once the preset lists two or more maintainers, the house ruleset makes the `smartcloud` check required on the default branch.

## <a id="values"></a>Values

`house.yml` renders this repository's own root. Downstream repositories get their values from `sync.values` in `smartcloud/house.yml`, and `REPOSITORY` from the repository the sync runs in; roles, trusted bots, environments and exclusions are preset keys rather than values.

| Key | Used for |
| --- | --- |
| `ORG_NAME` | The owner's name in prose. |
| `LEGAL_HOLDER` | The copyright holder in `LICENSE`. |
| `COPYRIGHT_YEAR` | The year in the copyright notice. |
| `REPOSITORY` | Links to the repository's own advisories, discussions and files. Set automatically by the sync. |
| `PACKAGE_SCOPE` | The npm scope in the module boundary rule. |
| `CONDUCT_CONTACT` | Where Code of Conduct reports go. |
| `COVERAGE_MIN` | The minimum line and branch coverage. |
| `MAINTAINERS` | Who counts as a maintainer for the checks and the review gate. |
| `TRUSTED_BOTS` | Automation accounts that skip the disclosure and DCO checks. |
| `HOUSE_EXCLUDE` | Template paths a repository keeps its own copy of. For configuration, prefer local rules outside the managed block; exclusion is for a file the repository genuinely cannot share, such as a different licence. |
| `PROJECT_TYPE` | `saas`, `desktop`, `library` or `none`; picks the deployment environments. |
| `ENVIRONMENTS` | Explicit environment names, replacing the `PROJECT_TYPE` set. |
| `CODE_SCANNING_GATE` | Whether serious CodeQL findings block merges. Turn off only where CodeQL cannot analyse the code. |
| `SPONSORS` | GitHub Sponsors accounts in `FUNDING.yml`. |
| `OWNERS_ADMIN`, `OWNERS_DOCS`, `OWNERS_QA`, `OWNERS_WORKFLOW` | Code owners by role, in `CODEOWNERS`. |

## <a id="settings"></a>Repository settings

The sync's `settings` job applies the baseline in [the governance document](GOVERNANCE.md#settings) every week, so a setting changed by hand drifts back.
Preview what it would change for any repository you can read:

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud plan settings --repo owner/name
```

Settings that no API exposes, and so are set by hand once per repository:

- Settings > General > Pushes: **Limit how many branches and tags can be updated in a single push** to 5.

Settings best made once at organisation level:

- Settings > Advanced Security > Configurations: a code security configuration with every feature enabled, applied to all repositories and set as the default for new ones.
This covers private repositories the per-repository settings cannot, where the licence allows.
- Settings > Advanced Security > Global settings: Dependabot on Actions runners, and Copilot Autofix for third-party tools.

## <a id="sync-token"></a>The sync token

The house workflows authenticate with the organisation secret `ACCESS_TOKEN`, a personal access token.
The workflow token cannot read this private repository, so it cannot load the preset (`smartcloud/house.yml`) or call the reusable Graphify workflow; nor can it push changes to workflow files or change repository settings, and pull requests it opens do not start other workflows.
Runs that get no secrets, such as pull requests from forks, fall back to the workflow token.

The token needs **Administration**, **Contents**, **Pull requests** and **Workflows** write access on the repositories it syncs, and read access to `Resnovas/.github`; Administration is what lets it apply the repository settings.
This repository's Actions access (Settings > Actions > General > Access) must allow repositories in the organisation, so they can call its reusable workflows and Dependabot can resolve them.
