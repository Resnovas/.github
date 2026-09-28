# Synced files

Every file under [`templates/`](../templates) is copied into every repository by the sync.
This page lists each one: what it is for, and whether a repository can add to it.
[Back to the README](../README.md)

Two kinds of file:

- **Whole file.** The sync owns all of it. A pull request that edits it fails the `smartcloud` check. To keep a different version, exclude it (see [The sync](sync.md#exclude)).
- **Extendable.** The file has a managed block the sync owns and a `house:local` line after which the repository adds its own content, which the sync keeps. See [The sync](sync.md#managed-blocks).

"Placeholders" lists the values filled in per repository; [The sync](sync.md#values) says where each comes from.

## <a id="documents"></a>Governance documents

These Markdown documents sit at the root of every repository. GitHub links several of them from its interface (the Contributing, Security and Code of Conduct tabs, and the pages shown when someone opens an issue).

| File | Kind | What it is |
| --- | --- | --- |
| `CONTRIBUTING.md` | Whole file | How to contribute: the DCO sign-off, AI-assisted work, bug reports and feature requests, pull request titles, branch names, commits, descriptions and code standards (tests, coverage of at least `COVERAGE_MIN`%, dependencies, module boundaries). |
| `AI_POLICY.md` | Whole file | The AI contribution policy. Each rule has an id (`AI-01` for the disclosure, `AI-02` for co-author trailers, `AI-03`: an AI never signs off, and so on) that checks and reviewers link to, plus the process labels and sanctions. |
| `APPROVAL_POLICY.md` | Extendable | What an automated approval agent may approve alone, what always needs a human, and which review bot findings block. A repository adds its own rules after `house:local`, for example which generated files may be approved when they match their generator. |
| `GOVERNANCE.md` | Whole file | Roles, how decisions are made, how many approvals a pull request needs, what each review bot does, merging, the repository settings baseline and how synced files work. |
| `CODE_OF_CONDUCT.md` | Whole file | The Contributor Covenant, adapted, with reports going to `CONDUCT_CONTACT`. |
| `DCO.md` | Whole file | The Developer Certificate of Origin text contributors agree to by signing off. |
| `COOPERATION_COMMITMENT.md` | Whole file | How licence breaches are cured before any legal action. |
| `SECURITY.md` | Whole file | How to report a vulnerability privately, and which versions get fixes. |
| `SUPPORT.md` | Whole file | Where to ask questions (Discussions, not the issue tracker). |
| `LICENSE` | Whole file | The FCL-1.0-MIT licence, with `LEGAL_HOLDER` and `COPYRIGHT_YEAR`. A repository whose dependencies need another licence excludes it. |
| `AGENTS.md` | Extendable | The instructions every AI agent host reads (Claude Code, Codex, Cursor, Copilot and others). The house rules are the managed block; the repository's own instructions go after `house:local`. |
| `CLAUDE.md` | Extendable | Imports `AGENTS.md` so Claude Code reads the same copy. Add only what Claude Code alone needs. |

## <a id="github"></a>GitHub configuration

| File | Kind | What it is | Adding your own |
| --- | --- | --- | --- |
| `.github/smartcloud.yml` | Extendable | Tells smartcloud to use the house preset. | The repository's own smartcloud settings, after `house:local`. See [The house preset](preset.md#unset). |
| `.github/CODEOWNERS` | Extendable | Who must review which paths, by role (`OWNERS_ADMIN`, `OWNERS_DOCS`, `OWNERS_QA`, `OWNERS_WORKFLOW`). | Owners for your own directories go **above** the managed block, because in CODEOWNERS the last matching line wins, so the house lines always apply. |
| `.github/dependabot.yml` | Extendable | Weekly dependency updates on Monday at 07:00 London time for GitHub Actions and npm, grouped into one pull request per ecosystem, security updates grouped separately. Version updates wait seven days after a release. | More ecosystems or directories as list items under `updates`. A repository with no `package.json` excludes this file, or the npm update fails. |
| `.github/dependency-review-config.yml` | Extendable | The licences a new dependency may have (permissive ones that FCL-1.0-MIT can ship alongside), read by the dependency review. | `allow-ghsas` for an advisory that does not apply, or `allow-dependencies-licenses` for one package a maintainer cleared. You cannot widen `allow-licenses`. |
| `.github/zizmor.yml` | Extendable | Settings for the zizmor workflow audit: Resnovas actions may follow a branch, every other action must be pinned to a commit. | Comments only. Other rules need your own copy (exclude it). |
| `.github/FUNDING.yml` | Extendable | The Sponsor button, listing `SPONSORS`. | Other funding platforms. |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Extendable | The bug report form: version, steps, expected and actual behaviour, logs, evidence, duplicate search, AI level and tools. | Extra fields with ids of their own. |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Extendable | The feature request form: problem, proposal, alternatives, duplicate search, AI level and tools. | Extra fields with ids of their own. |
| `.github/ISSUE_TEMPLATE/config.yml` | Extendable | Turns off blank issues, and links to private security reporting and to Discussions. | More contact links. |
| `.github/PULL_REQUEST_TEMPLATE.md` | Extendable | The pull request description: what changed and why, evidence, context, and the AI disclosure fields smartcloud reads. | Extra sections after `house:local`. |

## <a id="workflows"></a>Workflows

Each is described in full in [Workflows](workflows.md).

| File | Kind | What it does |
| --- | --- | --- |
| `.github/workflows/smartcloud.yml` | Extendable | Runs smartcloud: pull request checks, the aggregate check, labels, settings and the weekly sync. |
| `.github/workflows/smartcloud-review.yml` | Extendable | Re-runs a pull request's smartcloud check when someone reviews it. |
| `.github/workflows/house-codeql.yml` | Extendable | CodeQL code scanning. |
| `.github/workflows/house-dependency-review.yml` | Extendable | Blocks new dependencies with serious known vulnerabilities or disallowed licences. |
| `.github/workflows/house-scorecard.yml` | Extendable | OpenSSF Scorecard. |
| `.github/workflows/house-workflow-lint.yml` | Extendable | actionlint and zizmor on the workflows. |
| `.github/workflows/house-graphify.yml` | Extendable | Keeps the committed code graph current. |

In a workflow you add your own jobs after `house:local`, indented under `jobs:`. A job may not reuse a synced job's name.

## <a id="review-bots"></a>Review bot configuration

Each review bot has one job, and each is configured by a synced file, so every repository gets the same division of labour.
[GOVERNANCE.md](../GOVERNANCE.md#review-bots) sets out the jobs and which findings block a merge.

| File | Bot and its job | Adding your own |
| --- | --- | --- |
| `.coderabbit.yaml` | CodeRabbit: the line-level review and the only pull request summary. | Path instructions after `house:local`, as list items under `reviews.path_instructions`. |
| `.github/copilot-instructions.md` | GitHub Copilot code review: security and permissions. | Instructions after `house:local`. |
| `.github/instructions/house-workflows.instructions.md` | Copilot, for workflow and action files: the workflow security rules. Whole file. | Other `.github/instructions/*.instructions.md` files. |
| `.pr_agent.toml` | Qodo Merge: the change against its ticket, its tests and edge cases. | New tables after `house:local`. TOML cannot define a table twice, so never reuse a synced one. |
| `.cursor/BUGBOT.md` | Cursor Bugbot: logic bugs. | Rules after `house:local`, or a `BUGBOT.md` in a subdirectory for the files under it. |
| `.graphifyignore` | Graphify: what the code graph must never read (secrets, private data, vendored source). | Ignores after `house:local`. |

Every bot skips the same files: vendored source (`externals/`), the code graph (`graphify-out/`), build output (`dist/`), generated schemas (`schema/*.schema.json`), reference pages (`docs/reference/`), lockfiles and `CHANGELOG.md` files.
CodeRabbit and Qodo take the list as path filters and Graphify as ignores; Copilot and Bugbot have no ignore file, so their instructions name it.

A file does nothing until its app is installed, and CodeRabbit only reviews repositories its plan covers, such as open source ones.
Some settings exist only in each app's dashboard, and are set once for the organisation:

- **Qodo Merge:** leave automatic `/describe` and `/improve` off; the synced `pr_commands` runs the review alone.
- **Cursor Bugbot:** pull request summaries off, and draft pull requests not reviewed, since CodeRabbit writes the summary.
- **Copilot code review:** the house ruleset requests it on every push, drafts included. Keep the ignore list in the instructions: content exclusions in the organisation's Copilot settings would hide files from every Copilot feature.

No bot's check is required. A bot's finding blocks through the review rules, not through a status.

### <a id="optional-apps"></a>Optional apps

Worth installing where a repository needs more than the house checks:

- **FOSSA:** licence compliance across the whole dependency tree, beyond what dependency review sees in one pull request.
- **Socket:** supply-chain analysis of new npm packages (install scripts, typosquats, network or shell access) before they merge.
- **Codecov:** coverage on each pull request, for a repository that does not upload coverage to GitHub.

## <a id="surfaces"></a>Editor and agent surfaces

Every repository gets the same one-click tasks, debug configurations and agent actions.
They only call three package scripts every repository has (`setup`, `check` and `test`, run with `node --run` so they work under npm and pnpm) and the synced tools.

| File | Kind | Used by | What it holds |
| --- | --- | --- | --- |
| `.vscode/tasks.json`, `.vscode/launch.json` | Extendable | VS Code, Cursor | Tasks for setup, check, test, the code graph and the agent tools; debug configurations for the current file and the surfaces tool. |
| `.zed/tasks.json`, `.zed/debug.json` | Extendable | Zed | The same tasks and debug configurations. |
| `.run/house-*.run.xml` | Whole file | JetBrains IDEs | Run configurations for setup, check, test, the graph and the agent tools. Add your own as other files in `.run/`. |
| `.codex/environments/environment.toml` | Extendable | Codex desktop | The setup script and actions. |
| `orca.yaml` | Extendable | Orca | Runs `setup` after each new worktree. Add tabs and shared directories after `house:local`. |
| `.agents/surfaces.jsonc` | Extendable | Orca, OpenChamber | The quick commands and project actions. Your own go in the `actions` list. |
| `.agents/prompts/verify.md`, `review.md`, `address-review.md` | Whole file | Every agent host | Agent prompts: run the gate and fix failures; review the branch against the house rules; work through review comments. Add your own prompts as other files beside them. |
| `.agents/mcp.jsonc` | Extendable | Every agent host | The MCP servers agents use (Mem0 gateway, the repository's Graphify graph, and Graphify Cloud with its memory). Your own go under `servers`. No credential is ever written: each host reads them from environment variables. |
| `tools/dev/surfaces.mjs` | Whole file | You, and `setup` and `check` | `sync` writes the prompts to `.claude/commands` and `.cursor/commands`, the skills to `.claude/skills`, and the MCP servers to `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json` and a block in `.codex/config.toml`. `check` fails when they are out of date. `install` registers the actions in Orca and OpenChamber, which keep them in per-user settings, and installs the commit hook; outside CI, `check` fails while the hook is missing, and everywhere it fails while a project with a `package.json` lacks `scripts/agent-setup` or `AGENT-SETUP.md`. |
| `tools/dev/open.mjs` | Whole file | The tasks | Opens a file in the default browser on any platform. |
| `tools/dev/commit-check.mjs` | Whole file | git, as the `commit-msg` hook that `setup` installs | Refuses a commit that breaks the house commit rules: a conventional subject, the author and sign-off being a person, an AI co-author naming its model, no host attribution lines, no em or en dashes or emoji in the message or the added text. `HOUSE_SKIP_COMMIT_CHECK=1` skips one emergency commit; the smartcloud check on the pull request still applies. |

JSON files here are JSON with comments, so their markers are `//` lines, and a local entry may not reuse a synced `label`, `name` or `id`.

## <a id="graphify"></a>Code graph (Graphify)

A [Graphify](https://github.com/Graphify-Labs/graphify) graph of the code is committed in `graphify-out/graph.json`, so people and agents can ask what a change touches without reading the whole codebase.
Building it uses local parsers only: no model, no network, no cost.

| File | Kind | What it is |
| --- | --- | --- |
| `tools/graphify/graphify` | Whole file | The wrapper: `setup` installs Graphify (with [uv](https://docs.astral.sh/uv/)) and the git hooks, `update` rebuilds the graph, `check` fails when it is stale, `query "<question>"` asks it. |
| `graphify-out/.gitignore` | Whole file | Commits only the graph and the paid-for semantic cache. |
| `graphify-out/.gitattributes` | Whole file | Marks the output as generated and merges `graph.json` with Graphify's own merge driver. |
| `.agents/skills/graphify/` | Whole file | Teaches agents when and how to query the graph. See [House skills](#skills) for the rest of the skills and how they reach Claude Code. |
| `.graphifyignore` | Extendable | See [Review bot configuration](#review-bots). |

## <a id="skills"></a>House skills

Every directory under `templates/.agents/skills/` is a skill in the [Agent Skills](https://agentskills.io) format (`SKILL.md` plus reference files), synced whole into `.agents/skills/` of every repository. `tools/dev/surfaces.mjs sync` mirrors the whole of `.agents/skills/` to `.claude/skills/`, so Claude Code reads the same copy, and `check` fails while the mirror is out of date. A repository adds its own skills beside the house ones; a house skill is changed in this repository, never in a copy.

The house skills, by what they are for:

| Group | Skills |
| --- | --- |
| House standards | `coding-preferences`, `commits-and-rd-evidence`, `commit`, `creating-pull-requests`, `no-em-or-en-dashes`, `whitelabel-customer-facing-copy`, `feature-flags`, `extendable-module-architecture`, `project-dev-surfaces`, `documentation-writing-standards`, `writing-specifications`, `gitbutler`, `gitbutler-instead-worktrees`, `graphify`, `graphify-vendor` |
| Changing code | `investigate-first`, `surgical-patch`, `safe-refactor`, `migration`, `lean-build`, `build-error-resolver`, `react-build-resolver` |
| Reviewing | `code-review`, `silent-failure-hunter`, `type-design-analyzer`, `typescript-reviewer`, `python-reviewer`, `database-reviewer`, `react-reviewer`, `agent-self-evaluation`, `eval-harness`, `harness-optimizer`, `gan-planner`, `gan-generator`, `gan-evaluator` |
| Thinking and writing | `research`, `eli5`, `archify`, `grilling`, `cross-critique`, `frontend-design-hard-rules`, `convert-documents-to-markdown`, `skills-spec`, `skills-best-practices` |
| Vendors | `odoo-enterprise`, `odoo-module-separation`, `twilio`, `neon-vendor`, `clerk-vendor`, `convex-vendor`, `terraform-vendor`, `apify-vendor`, `cloudflare-workers`, `ai-sdk-vendor`, `chat-sdk-vendor`, `workflow-sdk-vendor`, `flags-sdk-vendor`, `vendor-llms-indexes` |

Skills that apply only on one host, or only to this repository's own jobs, live in [`skills/`](../skills/) and are published to the catalogue without syncing.

## <a id="ai-docs"></a>AI docs

See [AI docs](ai-docs.md) for how to use them.

| File | Kind | What it is |
| --- | --- | --- |
| `tools/ai-docs/docgen.mjs` | Whole file | Builds `LLMS.md` from `ai-docs/src`; `--check` fails when it is stale. |
| `ai-docs/README.md` | Extendable | How to write ai-docs: layout, conventions, commands. |
| `ai-docs/src/05_house-standards/index.md` | Extendable | The house coding, testing, commit and documentation standards, for agents. Add the repository's own standards after `house:local`. |

## <a id="prettier"></a>Formatting

| File | Kind | What it is |
| --- | --- | --- |
| `.prettierignore` | Extendable | Lists every synced file, and the generated `LLMS.md`, so Prettier never reformats them: a reformatted managed block would fail the sync check. Add your own ignores after `house:local`. |
