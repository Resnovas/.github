<!--
  Generated from ai-docs/src by tools/ai-docs/docgen.mjs. Do not edit by hand:
  edit the sources and run `node tools/ai-docs/docgen.mjs`.
-->

# @resnovas/house for agents

Guidance for an AI agent working on or with this repository, assembled into one
file so it can be read in a single pass. Each example is a real file under
`ai-docs/src`, kept compiling by the repository type check. The people-facing
documentation covers the same ground in plain words; see the README.

---

## House standards

Every Resnovas repository follows the same standards. This section is synced from
[`Resnovas/.github`](https://github.com/Resnovas/.github); the rules come from
`AGENTS.md`, `CONTRIBUTING.md`, `AI_POLICY.md` and the PostHog skill
`coding-preferences`, and those documents win if this summary ever disagrees
with them. The sections after this one describe this repository itself.

### Code

- **Effect-TS v3 first.** TypeScript is the primary language, written with
  Effect v3: services as `Context.Tag` with `Layer`s, `Effect.gen` for
  sequencing, `Schema` to decode anything from outside the process. Load the
  PostHog skill `coding-preferences` and its `effect` reference before writing
  Effect code, and look up current APIs with Context7 rather than from memory.
- **Strict TypeScript, never `any`.** Keep `strict` on. Decode unknown input
  with `Schema` instead of casting it.
- **Typed errors.** Model failures as tagged errors (`Data.TaggedError` or
  `Schema.TaggedError`) in the error channel, so a caller sees every way a call
  can fail. Do not throw for expected failures.
- **Secrets through `Config` and `Redacted`.** Read configuration with
  Effect `Config`, and hold every secret as `Redacted` (`Config.redacted`)
  until the boundary that needs its value. Never put a secret in source, logs,
  telemetry, command-line arguments, issues or pull requests.
- **PostHog telemetry and feature flags.** Every app ships PostHog feature
  flags; new behaviour goes behind a flag with a safe default in code, never
  behind an environment variable or configuration toggle (house skill
  `feature-flags`). Telemetry events carry no secret or personal data.
- **Module boundaries.** The core package holds domain-agnostic building
  blocks only. Vendor SDKs and API clients live in
  `@resnovas/integrations.<vendor>`. Features depend on core and
  integrations, never the other way round (`AI_POLICY.md` AI-13).
- **Comments explain why.** Constraints, trade-offs and anything surprising;
  never a restatement of the code.

### Tests

- Write tests with `@effect/vitest`. Line and branch coverage never falls
  below 90%, and most repositories hold 100%.
- **Never delete, skip or weaken a test** to make a change pass: fix the code
  (`AI_POLICY.md` AI-11). A flaky test is a bug to fix, not to retry away.
- Every bug fix comes with a regression test that fails before the fix.

### Files

- Every source file carries the FCL-1.0-MIT licence header; the repository's
  header check adds and verifies it.
- ASCII hyphen-minus only in text an agent writes: no em or en dashes, and no
  emoji in titles or descriptions (house skill `no-em-or-en-dashes`,
  `AI_POLICY.md` AI-09).

### Commits and pull requests

- Conventional commits (`type(scope): summary`, imperative mood), one logical
  change each, and every commit signed off for the Developer Certificate of
  Origin with the commit author's name and address. An AI tool never signs off
  (`AI_POLICY.md` AI-03).
- In the maintainer's own repositories agents add no AI attribution: no AI
  co-author trailer and no "Generated with" footer (house skill
  `commits-and-rd-evidence`). Outside contributors follow `AI_POLICY.md` AI-02.
- One pull request per batch of work: one stacked branch per issue, each
  squashed to one conventional, signed-off commit naming its issue, all opened
  as a single pull request. Once Jonathan approves it, it lands as an owner
  fast-forward (its signed commits pushed onto the default branch unchanged),
  so each issue keeps its own commit; the merge queue squashes, because GitHub
  cannot sign rebased commits. Run the full gate locally first; CI is not the
  debugger.
- Deterministic gates (the repository's checks and the `smartcloud` check)
  decide a merge. AI review bots are advisory.

### Document everything twice

Every change to a feature, option, preset or workflow updates both kinds of
documentation in the same commit:

- **ELI5 docs for people.** Plain words and short sentences; what it is and why
  you would want it before how; step-by-step setup; one complete example; what
  you will see when it runs; every option with its default; common problems
  and their fixes.
- **ai-docs for agents.** The sections under `ai-docs/src`, with compiling
  examples in the codebase's own style. `LLMS.md` is generated from them by
  `node tools/ai-docs/docgen.mjs` and checked in CI with `--check`; never edit
  it by hand.

---

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

---

## Templates and the renderer

Every file under `templates/` is rendered to the same relative path in a
repository. Rendering does three things:

1. **Substitutes placeholders.** `{{KEY}}` is replaced from the values
   (`scripts/lib/render.mjs`). An unknown key throws, naming the template, so a
   blank copyright holder or contact address can never ship; `{{KEY:-default}}`
   renders the default instead, for an optional per-repository value such as
   `PROJECT_TYPE`. Keys are upper snake case. Avoid a literal `{{UPPER}}` in a template for any other reason.
2. **Merges managed blocks.** A template with a `house:managed:begin` and
   `house:managed:end` pair is extendable: only the lines between the markers
   are replaced, and everything the repository added around them is kept
   (`scripts/lib/managed.mjs`, `mergeManaged`). A template without the pair is
   replaced whole.
3. **Keeps the executable bit.** A template with the owner execute bit (such as
   `tools/graphify/graphify`) is written with mode 755.

Marker rules an agent must keep:

- A marker counts only on a comment line: `#` in YAML, TOML and CODEOWNERS,
  `//` in JSON with comments, `<!--` in Markdown. Prose that merely mentions a
  marker, as `GOVERNANCE.md` does, leaves the file whole-file managed.
- `house:local` marks where a repository adds its own lines. When a repository
  first adopts a file it already had, its old content is parked there,
  commented out, with a notice.
- In `CODEOWNERS` the managed block comes last, because the last matching rule
  wins; nothing may follow it.
- `managedConflicts` reports local lines that would redefine synced ones: a
  top-level YAML key, an issue form field id, a workflow job, a TOML table, a
  JSON `label`, `name` or `id`, or a duplicate Dependabot update.

`scripts/render.mjs` options:

| Option | Default | Meaning |
| --- | --- | --- |
| `--out <dir>` | the repository root | Where to render. |
| `--override <file>` | none | A values file layered over `house.yml`. |
| `--repository owner/name` | `REPOSITORY` from the values | The repository being rendered. |
| `--check` | off | Write nothing; exit 1 listing every stale file. |

Values come from `house.yml`, then the override file, then `--repository`, each
replacing the keys of the one before. `HOUSE_EXCLUDE` (comma separated
template paths) skips templates, as a downstream `sync.exclude` does.

A new synced file needs three things besides the template itself: an entry in
`templates/.prettierignore` if Prettier can format it (a test fails otherwise),
a row in `docs/synced-files.md`, and a render so the root copy exists.

## Issue forms

`templates/.github/ISSUE_TEMPLATE/` holds one form per kind of issue, matching
the Linear issue templates so an issue reads the same on either tracker:

| Form | Title prefix | Label | Linear template |
| --- | --- | --- | --- |
| `bug_report.yml` | `fix: ` | `bug` | Bug report |
| `feature_request.yml` | `feat: ` | `enhancement` | General |
| `documentation.yml` | `docs: ` | `documentation` | Documentation review |
| `performance.yml` | `perf: ` | `performance` | Bug report (measured) |

Every form ends with the same three required fields, in this order:
`duplicates`, `ai-level` (a dropdown of the AI policy levels) and `ai-tools`,
because smartcloud's disclosure check and AI-01 read them. `config.yml` turns
off blank issues, so a new kind of issue needs a new form. Keep field ids
stable: a downstream repository adds its own fields after `house:local`, and
`managedConflicts` rejects a local field that reuses a managed id.

---

## How the sync reaches other repositories

This repository does not push anything. Each downstream repository runs the
synced `smartcloud` workflow, and smartcloud's sync feature reads
`sync.source: Resnovas/.github/templates@main` from the preset, renders it with
the same rules as `scripts/render.mjs`, and opens or updates one pull request
from the `house/sync` branch.

- Values come from `sync.values` in `smartcloud/house.yml`, and `REPOSITORY`
  from the repository the sync runs in. `house.yml` is only for this
  repository's own root.
- A repository skips a template with `sync.exclude` in its
  `.github/smartcloud.yml`; an excluded template needs no values.
- The sync runs on `schedule` (Mondays 07:00 UTC), `workflow_dispatch` and
  `push` to `main`, with the Resnovas Bot app token. Restricted runs (forks,
  Dependabot, only the workflow token) skip it.
- On pull requests, `sync.check: true` makes smartcloud flag edits to synced
  content (rule `SYNC`): a changed synced document or managed block, removed
  markers, a deleted synced file, or a local rule that redefines a synced one.
  It is an error for contributors and a warning for maintainers. Pull requests
  in this repository are not checked, because they change the templates.
- smartcloud's sync skips the source repository itself, which is why this
  repository renders its own root with `scripts/render.mjs` and CI checks it.

So a change merged to `templates/` on `main` reaches every repository in its
next sync pull request, usually within a week, or at once when someone runs its
smartcloud workflow by hand. Reusable workflows and the preset are read from
`main` on every run, so they change everywhere immediately on merge.

Never write a change that breaks a downstream smartcloud run: unknown config
keys only warn, but a template placeholder with no value in `sync.values`
fails every repository's sync. Add the value to the preset in the same commit,
or give the placeholder a default (`{{KEY:-default}}`) when each repository
should set its own; never put a per-repository value in the preset's
`sync.values`, which locks it for everyone.

---

## The house preset

`smartcloud/house.yml` is the smartcloud configuration every repository
extends from its synced `.github/smartcloud.yml`:

```yaml
extends:
  - Resnovas/.github/smartcloud/house.yml@main
```

Presets are locked: a repository may add keys the preset leaves unset, or
restate a value exactly, but a different value for a key the preset sets fails
the run. Keys left unset on purpose: `settings.environments`,
`settings.ruleset.requiredDeployments`, `settings.ruleset.statusChecks.checks`
entries beyond `smartcloud`, `settings.ruleset.codeScanning.ESLint`,
`settings.ruleset.codeCoverage.enabled`, `required.ignore`,
`required.expect`, `required.timeout` and `sync.exclude`.

| Section | What it sets |
| --- | --- |
| `roles` | `maintainers` (the review gate and maintainer warning levels) and `trustedBots` (skip disclosure, DCO and title checks). |
| `links.policyBase` | Where findings link: this repository's documents on `main`. |
| `labels` | The process labels from `AI_POLICY.md#labels` and `house-sync`. |
| `conventions.rules` | Conventional pull request titles (a warning for the owner), and warnings for emoji, em and en dashes, and unticked checklist items. |
| `commits` | DCO sign-off and AI attribution checks; a maintainer's own pull request gets warnings, except an AI sign-off. |
| `disclosure` | The AI disclosure in the pull request body; AI-assisted pull requests open as drafts. |
| `reviews.gate` | Two maintainer approvals for an outside author, one for a maintainer; open while fewer than two maintainers are listed. |
| `settings` | The repository baseline: merge options, features, security, the default branch ruleset with a squash merge queue, and Actions defaults. |
| `required` | Turns on the aggregate check: the `smartcloud` job waits for every other check. |
| `sync` | Where templates come from, the `house/sync` branch, the edit check and the placeholder values. |

When you change the preset, keep it valid against smartcloud's schema (the
`yaml-language-server` line names it), and remember it applies to every
repository on its next run. Changing a locked value can make a repository's
own config, which restated the old value, fail; search the organisation first.

`required.ignore` stays out of the preset on purpose: a list the preset set
could not be extended, because presets are locked. Each house repository with
review bots lists `^CodeRabbit` and `'^Cursor '` (quoted; the trailing space
matters) under `required.ignore` after its `house:local` line, so bot checks
never gate the aggregate and the Cursor approval agent cannot deadlock with it.
Graphify is not ignored: its check is an AP-31 gate.

---

## Reusable workflows

Repositories call these from thin synced callers (`templates/.github/workflows/house-*.yml`)
that follow `main`: they reference `Resnovas/.github/.github/workflows/<name>.yml@main`,
so a change here reaches every repository on its next run.

| Reusable workflow | Synced caller | Triggers (caller) | Inputs and secrets |
| --- | --- | --- | --- |
| `codeql.yml` | `house-codeql.yml` | pull_request, merge_group, push to main, weekly, manual | none |
| `dependency-review.yml` | `house-dependency-review.yml` | pull_request, merge_group | none |
| `scorecard.yml` | `house-scorecard.yml` | push to main, branch_protection_rule, weekly, manual | none |
| `workflow-lint.yml` | `house-workflow-lint.yml` | pull_request, merge_group, push to main | none |
| `graphify.yml` | `house-graphify.yml` | pull_request, push to main, manual | input `app-id`; secrets `private-key`, deprecated `token` |
| `attest.yml` | none: a release workflow calls it | workflow_call only | inputs `artifact`, `subject-path` (required), `sbom-path`, `release`, `release-assets` |

`smartcloud.yml` and `smartcloud-review.yml` are synced workflows, not
reusable ones: the first runs the smartcloud action with the preset, the second
re-runs a pull request's smartcloud run when it is reviewed.

`npm test` enforces these rules on every workflow here and under
`templates/.github/workflows`, so follow them when editing one:

- Top-level `permissions: {}`; each job declares only the scopes it uses; never
  `read-all` or `write-all`. A caller grants no more than the called jobs need.
- Every third-party action pinned to a full commit SHA with its release as a
  trailing comment (`@<sha> # v1.2.3`), the same SHA everywhere; only
  `./` and `Resnovas/...` references may follow a ref. Every `uses:` is a
  block-style line.
- Every job that runs steps sets `timeout-minutes`.
- A workflow that runs on `pull_request` (except Graphify) also runs on
  `merge_group`, and none filters those events by `paths`.
- A matrix job sets `fail-fast: false`; a job that runs Nx caches `.nx/cache`.
- Every reusable workflow a caller references exists here.

The synced callers also pass actionlint and zizmor (`.github/zizmor.yml` lets
`Resnovas/*` follow a branch). Untrusted input reaches `run:` only through
`env:`, and `actions/checkout` sets `persist-credentials: false` unless a later
step pushes.

Graphify's `check` job never fails a pull request: a graph one commit behind
is expected, because `refresh` (named `refresh (default branch only)` so its
skip on pull requests explains itself) rebuilds it after merge. When stale,
`check` writes one notice and a job summary saying no action is needed; do not
reintroduce the tool's "update, then commit" advice as the only guidance.

CodeQL's `languages` job unions the repository's GitHub languages (default
branch) with the extensions of the files a pull request or merge queue entry
adds or changes (compare API, `base...head`), skipping `externals/`,
`vendor/`, `node_modules/` and `dist/`, and always adds `actions`. A failed
comparison warns and falls back to the repository languages; never let it fail
the scan. Keep the extension map in step with the language map above it.

---

## Making a change here

1. Find the source. A rendered file (anything with a
   `synced from Resnovas/.github templates/...` marker) is changed in
   `templates/`; a default value in `house.yml` or in `sync.values` of
   `smartcloud/house.yml` (downstream repositories read the preset, not
   `house.yml`, so a new value usually goes in both).
2. Keep synced content inside the managed block and leave `house:local` in
   place, so downstream repositories keep their own lines.
3. Run `npm run render`, then `npm test` and `npm run check`. Commit the
   template and its rendered copy together; CI fails if they differ.
4. Add or update a test in `test/` when the change touches `scripts/lib`, a
   workflow rule or a synced tool. Coverage of `scripts/lib` must stay at or
   above 90% of lines and branches.
5. Document it twice in the same commit: the people-facing page under `docs/`
   (or the README) and the matching section under `ai-docs/src`, then
   `npm run ai-docs`. A new synced file gets a row in `docs/synced-files.md`; a
   preset key gets its plain-words explanation in `docs/preset.md`; a workflow
   input gets its row in `docs/workflows.md`.
6. Report what every downstream repository will see in its next sync pull
   request, or on its next run for a reusable workflow or preset change.

The repository-local prompt `change-template` (`.agents/prompts/change-template.md`)
walks an agent through the same steps.
