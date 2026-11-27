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

Use `AGENTS.md` for authority, tool routing and handoff requirements, `AI_POLICY.md` for contribution policy, and the applicable `.agents/skills/` source for engineering decisions. Do not copy those rules into feature documentation.

The funnel is code examples, corrective static checks, executable verification, minimal agent guidance, then human decisions. The adoption contract and commands are in `docs/house-funnel.md`. Preserve existing repository checks when adding shared tooling; a parser or lint pass is not semantic proof.

Read package scripts and CI before reporting verification. Pre-commit runs only `verify:static` then staged `test:affected`; full `verify`, smoke and evidence collection run in PR and main-push CI. `check` alone need not include either gate. Feature guides remain canonical Markdown; executable examples and registry entries must agree with reached public paths. Record only affected-feature evidence using synthetic data, the existing artifact audience and seven-day retention.

For an existing native hook, declare its exact package `script` and comment `marker` in local `.agents/surfaces.jsonc` `preCommit`; setup preserves matching bytes and refuses other hooks. Follow the complete example in `docs/house-funnel.md#retain-a-repository-owned-hook`. The native runner owns static/affected execution, alternate-index isolation and snapshot/failure proof; registration does not certify those semantics.

Sections numbered from 10 describe this repository's features and compiling examples. Update the corresponding people guide alongside them, and regenerate `LLMS.md` with `node tools/ai-docs/docgen.mjs`.

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

## Generated Linear source and the commit hook

`templates/tools/dev/commit-check.mjs` fixes the generated-source exclusions by path: `docs/planning/issues/**` and exactly `tools/documentation/linear-snapshot.json` preserve verbatim Linear text, including historical em and en dashes. These are generated-source locations only. Human-authored planning prose outside the issue mirror and arbitrary JSON remain subject to the existing ASCII dash rule. Content markers and local configuration cannot extend these exclusions; commit-message checks are unchanged.

For example, preserve a generated `docs/planning/issues/EVE-45.md` description unchanged, but use ASCII hyphen-minus in `docs/planning/timeline.md`. Verify with `node --test test/commit-check.test.mjs`. Render the canonical template and deliver it through the repository's existing house-sync rules; do not patch a downstream managed copy independently or rewrite mirrored source to pass the hook.

## Development task traceability

Follow [AGENTS.md, Issues and handoff](../../../AGENTS.md#issues-and-handoff) for task-owned start, blocked, pause/handoff and verified-delivery updates. Verify the actual Linear/GitHub pair and mirrored comments, preserve other active slices, and keep read-only requests read-only. Every mapped task commit, including generated outputs, cites both verified issues; partial delivery uses `Refs`, never whole-issue closure.

The existing renderer accepts optional `sync.values.TASK_LINEAR_PREFIX` from the downstream local `.github/smartcloud.yml`. It renders only into plaintext `tools/dev/commit-check-linear-prefix.txt`, never executable JavaScript. Sync that file with the checker; a missing file fails closed. Default `none` leaves unmapped repositories compatible; a verified uppercase team key such as Eventiva's `EVE` makes the offline checker require that exact key and a qualified GitHub issue reference on ordinary commits. `Refs: EVE-266, Resnovas/Eventiva#1053` is this rollout's verified pair, not IDs to copy into unrelated tasks. Full GitHub issue URLs also work. Bare numbers, pull request URLs, different/prefixed keys and references hidden in git comments or the verbose diff fail. Invalid prefix values, including quote/backtick/newline injection payloads, fail explicitly without executing configuration. Existing git-generated exceptions and signing/credit/staged-source rules are unchanged.

Run `node --test test/commit-check.test.mjs`, then normal render/test/check and doc generation. The rendered CLI tests cover both default-unmapped and opted-in behavior, including generated graph/docs commits. This is a syntax guard, not remote mapping verification, tracker synchronization, acceptance or a new runtime feature flag. An accepted upstream change and normal downstream sync must precede downstream managed adoption. Record this rollout's actual evidence and remaining house/sync acceptance in [the canonical timeline](https://github.com/Resnovas/Eventiva/blob/main/docs/planning/timeline.md) and both linked trackers; never report a proposed template as delivered everywhere.

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
  `push` to `main`, with the Resnovas Bot app token, which the synced workflow
  mints only for those events (and for a merged pull request's `closed`
  event, for backports, whose pull requests must start CI) and scopes to the
  repository alone. The
  templates are read with a separate read-only token (`houseToken`,
  `permission-contents: read` on `.github`), so the app token never needs
  `Resnovas/.github`. Restricted runs (forks, Dependabot, only the workflow
  token) skip the sync; a pull request run with the house token still runs
  the `SYNC` edit check below.
- `Resnovas/.github` is public, so any token can read it; the read-only
  house token exists so no privileged token touches it and its reads use
  the app's rate limit.
- Never widen the synced workflow's app token back to `.github` or mint it on
  an open `pull_request` or `issue_comment` run: a pull request controls its own workflow file, and the
  token split is what stops a leaf repository writing to this one. A new
  smartcloud input must be optional, because repositories run the released
  `v2`, which ignores inputs it does not know.
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

## Verify transport templates

Static sync renders template paths without executing downstream generators. The two Verify host templates under `templates/.claude/commands/verify.md` and `templates/.cursor/commands/verify.md` are generated transport, not independent authority. After changing `templates/.agents/prompts/verify.md`, run `node --run render`, then `node tools/dev/surfaces.mjs sync`, and copy those two generated root files back to their template paths. Run `node --test test/render.test.mjs` and the normal checks. The regression executes the surface checker against actual rendered sync bytes, rejects source-only and either host-only divergence, and verifies that repository-only prompts and host files survive. Root render/surface gates remain required. Read the [complete example](../../../docs/sync.md#verify-prompt-mirrors). No new option, privilege, candidate-generator execution or combined workflow dispatch is needed; normal house review and downstream acceptance remain separate.

---

## The house preset

`smartcloud/house.yml` is the smartcloud configuration every repository
extends from its synced `.github/smartcloud.yml`:

```yaml
extends:
  - Resnovas/.github/smartcloud/house.yml@main
```

`smartcloud/house.yml` holds only the two ruleset gates that spend GitHub AI
credits (`settings.ruleset.codeQuality: errors` and
`settings.ruleset.copilotReview: true`) and extends
`smartcloud/house-base.yml`, which holds every other house value. Edit
`house-base.yml` for any other change. A repository with an owner-approved,
recorded, temporary exception extends the base preset instead: it sets
`sync.values.HOUSE_PRESET: house-base.yml` and
`settings.ruleset.copilotReview: false` after its `house:local` line and
points the managed `extends` line at `house-base.yml`. Never set
`HOUSE_PRESET` in the preset's `sync.values`, which would lock it for every
repository.

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
| `autoMerge` | Rule `dependency-updates`: Dependabot and Renovate patch and minor updates get GitHub auto-merge; repositories add rules under their own keys. Needs `contents: write` on the synced workflow job. |
| `required` | Turns on the aggregate check: the `smartcloud` job waits for every other check. |
| `sync` | Where templates come from, the `house/sync` branch, the edit check and the placeholder values. |

When you change the preset, keep it valid against smartcloud's schema (the
`yaml-language-server` line names it), and remember it applies to every
repository on its next run. Changing a locked value can make a repository's
own config, which restated the old value, fail; search the organisation first.

The organisation values (`ORG_NAME`, `LEGAL_HOLDER`, `PACKAGE_SCOPE`,
`CONDUCT_CONTACT`, `SPONSORS`) stay out of `sync.values` on purpose: the
templates write them as `{{KEY:-<Resnovas value>}}`, and a repository of
another organisation sets its own under `sync.values` after its `house:local`
line. Never add them back to the preset, which would lock them for everyone.

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

The required `smartcloud` job executes on `merge_group`. The synced workflow-lint caller accepts the unconditional published-action profile or, only in `Resnovas/smartcloud`, the exact `tools/ci/smartcloud-native.yml` recipe checked by `smartcloud-native-contract.cjs`. Native builds/config use main, queue metadata and checkRunId fail closed, installs exclude lifecycle scripts, and split tokens follow the build; full app tokens never reach queue/comment/open-PR runs. Preserve authorized comments. `node --test test/workflows.test.mjs` exercises both profiles, rejected mutations and runtime guard/token fixtures. Copy/adoption and rollback commands are in `docs/house-funnel.md#adopt-smartclouds-native-queue-profile`. This static contract cannot prove branch protection or hosted aggregation. Runtime v2.1.1 is released; exact queued-SHA execution and retained aggregate checks still require live proof.

The managed dependency policy syncs all-version exceptions for exactly `spdx-exceptions`, `uri-js` and `parse-statements` for RES-67, with no exact-version guard. Evidence and migration steps are in `docs/workflows.md#house-lint-dependency-review-2026-11-20`. Land the policy-only sync before adding JSDoc dependencies, then rebase adoption onto that accepted base. Remove only a duplicate local three-package list; preserve unrelated policy and escalate lists containing other packages instead of silently dropping them. Retain the licence allowlist, vulnerability checks and base-commit policy loading; dependency-adding PRs cannot approve their own exceptions.

For a dependency update to a synced workflow, update the matching source in
`templates/.github/workflows/` and run `npm run render`, `npm test` and
`npm run check`. For example, keep both `actions/create-github-app-token`
pins and release comments aligned in `templates/.github/workflows/smartcloud.yml`.
A rendered-file mismatch means the template still needs the reviewed update;
do not skip the gate or discard the update by rendering an older template.

The pnpm setup pin intentionally remains v6.1.0: v6.1.1 intermittently failed
to provide a working `pnpm store path` in Eventiva run 44298210070, attempt 1.
The canonical Dependabot template excludes only 6.1.1, not later releases.
Keep the preview template and reusable release/nightly pins aligned.

The tooling under `templates/tools/` is canonical, including its JSDoc for
helpers, callbacks, reporters and release operations. Preserve behavior when
editing documentation, then render the root copies. In a release-enabled
repository, `node tools/release/release.ts --dry-run` previews Nx version and
changelog changes without writing them, but still builds configured bundles
when a version is proposed, deletes maps and strips map comments with uploads
disabled. It creates no release commit or tag and pushes or publishes nothing;
GitHub Actions outputs may still be appended. Do not describe this flag
(default false) as read-only or confuse it with nightly's early dry-run exit.

`node tools/release/release-preview.ts` instead skips bundle builds and asks
Nx for version/changelog previews without applying those changes. Its CI
squash simulation creates a local commit and moves HEAD when the PR merge
parents, title and number are available; configured summary/output files are
appended too. It creates or pushes no tags, but is not a read-only Git check.

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
- A job checks out the repository once; it checks out sparsely only when it
  never checks out again (a full checkout over a sparse one left files missing).
  To read one file before deciding to check out, use `gh api` on the contents.
- A path glob leaves out `**/node_modules/**` and `**/externals/**`, never only
  the root ones: pnpm links every workspace package's `node_modules`.

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

Release-tool rationale is maintained in `templates/tools/release/`: output helpers
do not write when the workflow destination is absent/empty; Nx owns changelog links
and change text; multiline squash bodies retain breaking-change markers; truncated
notes prefer complete lines with a notice outside the budget. These are existing
contracts, not permission to run or activate releases. Render downstream copies
from these canonical templates rather than adding local exceptions.

`sourcemaps.ts` preserves executable shebangs around vendor instrumentation.
It leaves the original first newline in place during injection, restores the
header as a new first line and prepends an unmapped generated line to esbuild's
flat source map before upload. This keeps body positions accurate and retains
the vendor's chunk metadata. Instrumented JavaScript must pass `node --check`
before upload; no-key processing keeps its original header and strips maps.
The regression test checks LF/CRLF headers, non-executable bundles and uploaded
source positions without sending data to the provider. This does not authorize
a downstream patch publication or rewriting an existing release.

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

### Shared test-process boundary

Canonical sources are `templates/tools/test-process/process.mjs` and its explicit `process.d.mts` boundary. The generic typecheck/editor test launchers import this dependency-free Node core; application adapters provide their existing Effect/Flags and runner registration without owning a second process. `test/test-process.test.mjs` exercises real child exit/output, mandatory private timing, budget rejection, IPC, forced termination, cancellation-through-close and the exact launcher files against small real executables. Run it with `node --test test/test-process.test.mjs`, then the unchanged complete `node --run test` and `node --run check` gates.

`childBudgetIssue([10000, 10000], 5000)` rejects the inconsistent original pattern; `[2300, 2300]` under 5000 and `[60000]` under 65000 remain valid. Every child reserves 100 ms cleanup and the enclosing sum must leave headroom. The public `runChild`/`startChild` API has no timing opt-out. Results preserve business streams and failure status; safe numeric phase records are emitted separately to stderr. Await `completed` or `cancel` before releasing a child. Application flag evaluation may reject admission but cannot disable an admitted Node child's timing.

POSIX launches own an isolated process group. Signal that group through deadline/output-limit escalation, cancellation and natural leader exit; preserve the leader's real status/signal and wait for actual descriptor close and pending escalation. Do not destroy readers or resolve at `exit` to fake finalization. Descendants deliberately creating another group/session are excluded. Real regressions cover resistant descendants with inherited stdout/stderr/journal, IPC readiness, deadline, explicit cancel, AbortSignal, natural exit status 23 before pipe close and natural exit with ignored pipes. Independent teardown bounds regression failures without relying on the owner under test. Linux zombie observation distinguishes an unreaped inert orphan from a live descriptor holder.

Jonathan's later native option B supersedes Node-only Windows admission. Before tests, run `node tools/test-process/build-windows.mjs`: installed Framework4 `csc.exe` and system assemblies compile the checked-in helper, without downloads. `npm test` builds the template helper explicitly. The30000 ms compiler bound is a build prerequisite, never a child test budget. Native acquisition creates the root suspended, assigns a noninherited kill-on-close Job without breakaway flags, then resumes it. Only stdio handles inherit. Private named-pipe PID/exit/empty/release messages keep root status distinct from supervisor lifetime; query active-process-zero before actual supervisor/stream close. The Node core remains the sole deadline/output/timing/result owner. Native IPC/fd3 is rejected; Node roots retain libuv cleanup and its breakaway limitation. Delegated native children acquire through the same surviving outer observer. Legacy `UnsupportedChildRootError` remains exported but is no longer the native launch policy. Linux/macOS retain process-group ownership. Local33/33 includes native lifecycle, real Git and compiler-shaped transport; Windows qualification remains pending as detailed below. Do not claim real Hermes performance, speedups or downstream acceptance. See [native contract](../../../docs/test-process-security.md#windows-native-acquisition).

PR78 head `3a8b48d` compiled on Windows24/current but eight native cases failed and the job timed out. Git output preceded expiry while exit waited for cancellation. The focused correction opens the private duplex client with `PipeOptions.Asynchronous`, allowing the pending control read and exit/empty writes to overlap. Local static/full153/153 passes; new Windows execution must confirm the hypothesis with unchanged1000/700ms child budgets and700ms readiness controls. No retry-only, speedup or all-OS claim follows from Linux success. Detailed failure evidence and the Microsoft I/O reference are in the native contract above.

Exact corrected head `fbcf270` completes Windows24 at151/153 and current at147/153: real Git/compiler-shaped transport and nested native close pass, while early native readiness still fails. Diagnostic head9275d95 reaches152/153 on each Windows version: first creation-to-Main takes26/24ms, but connection arrives509/454ms and decode929/841ms after acquisition. Later decode takes57-64ms. FILETIME/UTC is not CPU attribution; killed-before-report remains unknown. Scanning and assembly/JIT remain hypotheses. Jonathan approved one explicit canonical-owner setup acquisition after compilation: system cmd.exe, fixed `/d /c exit 0`,10000ms own budget, fail closed unless status0, request decode, Job release and actual close complete. `test.child.setup` records its separate elapsed time; mandatory phase logging remains. All test budgets and700ms readiness stay unchanged. New all-OS proof is required, not inferred. Alerts70/71 stay gated on green and unchanged flow; new72/73 are with Jonathan and receive no action yet.

Setup head9c99904 passes both Windows lanes. Ubuntu-current instead exposes a procfs death-probe race: reaping after open makes read return ESRCH. Accept that disappearing-entry error alongside ENOENT, then retain the existing signal-zero check and live-process rejection. This changes only the test observer, not ownership, readiness or budgets. Local static-first full153/153 passes; exact-head matrix proof remains required.

The typecheck build/compiler ceilings are new 120000/60000 ms safety ceilings, not measured universal performance acceptance. Its whole budget derives from the serial vector. The editor's new 600000 ms command ceiling does not change Vitest's test limits or its existing coverage-off invocation. Both launchers run installed package-manifest Node entry points through `process.execPath`; do not reintroduce POSIX shebang or Windows shell ownership. Exact-launcher fixtures use ordinary Node modules with no executable shim. Review a slow phase using retained timing and representative measurements; do not infer a production defect from host contention or call a passing retry a causal correction. Local Linux proofs do not establish Windows execution or portable descendant termination; the normal OS/Node matrix is still required. See `docs/synced-files.md#test-subprocess-timing` for complete options and limitations. The proposal remains unadopted downstream until the normal house PR merges and syncs; use non-closing `Refs: EVE-261` and `Refs: Resnovas/Eventiva#1035` for this partial delivery.

The core hard-codes `shell: false` and rejects every own/inherited shell option before spawn. `ChildOptions.shell?: never` supplies the type boundary; exact optional typing rejects explicit undefined too. Literal argv/space-path and zero-spawn rejection tests run on all OS lanes. The150 ms deadline test no longer assumes bootstrap readiness: its PID prerequisite belongs to the six1000 ms ready/PID/death scenarios in the same suite/matrix. See `docs/test-process-security.md` for executed load evidence, caller audit, compiler checks and the unresolved human CodeQL64/65 triage. A passing retry alone is not acceptance.

The real child `close` callback emits an explicit `close` phase even without fd3. `total` remains ownership release and can follow post-close descendant escalation; never infer actual descriptor-close time from it. Nested forwarding accepts only the closed numeric schema, including `close`, without arbitrary payloads. Ordinary/no-fd3, journal, IPC cancellation and deadline regressions run unchanged budgets on every OS/Node matrix lane. See the explicit-close section in `docs/test-process-security.md`; no signal, budget, stream or lifetime behavior changes.

Windows private `release` is terminal for control writes, not completion. After empty-Job or acquisition-failure evidence, cancellation cannot write another `stop` into a pipe whose peer may already be closing despite Node's writable flag. Preserve pre-release EPIPE reporting and actual supervisor/stream close; never filter transport errors to make abort pass. A deterministic closing-peer regression fails the old adapter and retains root status23 after repair. Original native scenarios and deadlines remain unchanged; exact-head Windows CI is still required. See [repair timeline](../../../docs/test-process-timeline.md).

For an owned Node process that itself acquires canonical children, set `nested: true` on its outer launch (default false). Private IPC delegates each acquisition to the surviving outer observer's same `startChild`; it retains real handles, cancels recursively on outer deadline/cancel/abort/exit, and awaits actual nested closes before outer `total`. `result.children` holds recursive completed evidence even if an intermediate is killed. Joining its doomed POSIX group alone cannot preserve those callbacks. Native Windows delegation uses the same platform acquisition, never another budget owner.

The reserved `__house_child_owner_v1` envelope and inherited `HOUSE_CHILD_OWNER=1` capability are ownership transport, not business messages or a timing flag. Do not disconnect that channel before nested completion. Source and compiled callers use the same canonical module. `ChildHandle` promises only PID/status, stdout/stderr, on/once/off, send(message, callback) and kill; raw stdin/descriptors/ref/handle passing are not proxied. Use `input` and await spawn/readiness before reading PID. Commands retain literal argv, cwd/env, byte input, bounded streams, real status/errors and actual close events. Three live-grandchild regressions fail before the correction; all26 local process contracts pass afterward, including no-business-IPC normal/failure controls. Full six-lane hosted proof and accepted downstream sync remain required; see [nested ownership](../../../docs/test-process-security.md#nested-ownership-survives-an-intermediate-process).

---

## Funnel tooling contracts

Canonical adoption instructions: `docs/house-funnel.md`. This repository's bounded feature inventory and assertions: `docs/verification.md`. Delivery sequencing and owner decisions: `docs/funnel-timeline.md`.

The optional `tools/lint/react.mjs` exports `reactLifecycle` for active-source React loading restrictions and `reactUiTimers` for explicitly selected UI files. They are separate from base config, retain Eventiva's exact corrective messages and add no dependency. Preserve local import/module paths and patterns and syntax selectors when composing flat config; replacing their arrays would erase portability or barrel gates. Keep the lifecycle restrictions in later overriding scopes and the timer rule off backend sources. Eventiva adoption follows accepted sync plus its real-config boundary tests, then removes its local copy and changes only the timer ID to `house-react/no-zero-delay-ui-timer`. Executable examples and controls are the two React cases in `test/funnel-lint.test.mjs`; setup and limitations are in `docs/house-funnel.md`.

Pre-commit runs `node --run verify:static` then `node --run test:affected` only. Setup installs the hook when both scripts exist; it rejects partial staging and preserves existing hooks. The house's `scripts/test-affected.mjs` maps staged paths, including deletions/renames, to existing test files; unmapped executable paths fail with a corrective message. Shared dependency/config changes select all affected tests, not full verification. Products provide their own selector, not this house-specific map. CI on PRs/main pushes runs full `verify` and affected evidence, retaining every existing gate. Smoke belongs in CI's `verify`, never in commit scripts. Evidence reads use one open descriptor; publication directories must have no concurrent writers through upload.

The house is non-production Node tooling. Its shared `contracts` ESLint export is adopted with each product's existing TypeScript parser and documentation checks. No runtime feature flag is needed. `funnel` adds source-inspection policy and informative JSDoc without replacing Nx or other rules.

`contracts` enables all 19 documentation rules listed in `docs/house-funnel.md`, including parameter/return/template contracts, sentence-form descriptions, public/exported examples and all declaration/callback shapes. Execute `test/funnel-lint.test.mjs` for each rule's accepted/rejected fixtures. `jsdoc/require-throws` is off because Effect failures travel in the typed error channel, not throw/catch; a repository changes a rule with a later flat-config entry for the same files, never by editing the synced module. Put examples at export boundaries (including aliases/re-exports), on public members of directly exported classes/interfaces, and on other declarations marked `@public`. Preserve reviewed source exclusions and Eventiva's rationale/zero gate and smartcloud's declaration/example checks. Keep semantic accuracy and meaningful in-body explanations in guidance; syntax lint cannot establish either or execute examples.

Every rule in the shared `jsdoc` plugin delegates to the vendor unchanged except for diagnostics attached to the exact canonical licence header at the beginning of a file (after an optional shebang). Both exports share that plugin object; the existing `house/require-description` and `house/match-description` aliases remain compatible. Additional consumer-enabled `jsdoc/` rules receive the same exemption. When composing an existing vendor preset, replace only its raw `plugins.jsdoc` binding with `funnel.plugins.jsdoc`, preserving its rules/settings and parser/processor. The canonical template ships this behavior to every consuming Node repository through normal sync, not a product-specific override.

The synced module location under `tools/lint/` anchors the repository root and adjacent `tools/license/header.txt`; ESLint can run from the root or a nested package. Resolve relative input filenames against ESLint's cwd, then compare the current-year header with the repository-relative filename. Root/nested-cwd fixtures preserve noncanonical-header and declaration rejection. All 19 rule fixture pairs run with and without headers; additional rule/autofix and rendered consumer fixtures prove legal text stays intact while invalid settings and declaration diagnostics remain visible. Do not exempt top comments generally, suppress whole files, or let headers stand in for declaration JSDoc. Keep the licence gate required.

The document inventory selects tracked and non-ignored untracked Markdown before buffering and has no fixed subprocess-output cap. Within `docs/`, only balanced standalone Linear/Planning generated-region pairs outside code fences are omitted from budget accounting. Count all authored text surrounding those regions together. Malformed regions remain fully counted; unmarked documents receive no exemption. Keep the generator drift checks required: marker recognition does not prove generator ownership or authorize moving authored content into generated regions. Regression fixtures exceed Eventiva's reported 3,303,046-byte inventory and retain failing authored-line/byte boundary controls.

AI-03 distinguishes author-matched agent provenance from human DCO certification. Human-authored/self-signed commits follow the ordinary human path; agent-authored commits require separate human PR certification. Read `docs/commit-signers.md` for signature evidence and the tested policy contract. The commit-msg hook cannot authenticate signing accounts; existing smartcloud integration still needs coordinated adoption.

`scripts/verify-funnel.mjs collect` executes the Markdown entry's contract tests without cached results. It binds HEAD plus the matching index tree, compares actual TAP test names/counts to documented assertions, and publishes only synthetic allowlisted outcomes in `.verification/publish`. `check` validates publication structure and file digests while preserving a failed collector outcome. `registry` compares the Markdown interface list with discovered shared tools. `FUNNEL_BASE_SHA` selects the comparison commit; it must be a full SHA. Without it, local collection compares to HEAD's parent. No affected interface produces an explicit not-applicable result and no upload, never a passing empty feature manifest.

Executable examples live in `test/funnel.test.mjs` and `test/funnel-lint.test.mjs`: matching/mismatching build-info, installed-hook staging/failure behavior, lint rejection/acceptance, registry inventory drift, empty proof, stale digest, wider affected selections and modified evidence bytes. These exercise public tool contracts rather than asserting source strings disappeared. Downstream browser/native proof remains the owning product's responsibility.

---

## Scoped agent readiness and merge exception

Jonathan approved the named AI-21/AI-31 exception on 2026-11-20 for Resnovas/.github and Resnovas/Eventiva only. Agents may mark a PR ready and merge normally once all required checks are green, preserving required reviews and branch protection. Disclosed draft creation remains required. Record this authorization and actual agent verification; do not claim human review. Approval/self-approval, bypass, admin merge, force-push, sign-off, spending and deployment authority are not added. All other repositories retain the default restrictions.

Canonical rules: AI_POLICY.md AI-21 and AI-31, and templates/AGENTS.md. Delivery/evidence: docs/agent-merge-exception.md, RES-71 and Resnovas/.github#67. Keep this separate from the CodeQL RES-70/#66 packet.

---

# CodeQL alert comment

`templates/.github/workflows/house-codeql-alert-comment.yml` renders the completion trigger. `.github/workflows/codeql-alert-comment.yml` executes trusted house main code from `scripts/lib/codeql-alert-comment.mjs`; `.github/workflows/codeql.yml` retains original analyzer SARIF for seven days. Use only the scoped Actions token, never the connected App token or PR code. Match repository/run/head/PR/merge ref and artifact metadata/digest before parsing bounded untrusted original `codeFlows`; API-downloaded SARIF is only an identity-bearing subset. No paths from message links. Non-flow `problem` rules are explicitly not applicable; missing paths/errors are unavailable and fail, never zero or fabricated complete traces.

Read [the guide](docs/codeql-alert-comment.md) for trust limits, retries and delivery timeline. RES-70 / Resnovas/.github#66 owns this behavior. Tests: `node --test test/codeql-alert-comment.test.mjs`; normal `verify:static` then `verify` still apply. Offline fixtures are not a hosted-token run, and this packet does not triage alerts 64/65 or authorize Eventiva sync.

---

## Commit identity proposal

`docs/commit-signers.md` is the canonical identity proposal for RES-67 / Resnovas/.github#55. `checkAuthorSignature` requires a VALID GitHub signature from the same stable account ID as the resolved author. It takes authenticated immutable-commit API data, has no owner/platform parameter or per-tool key list, and does not run in CI. Human-authored/self-signed commits are ordinary human commits. Historical human/agent signatures and a GitHub squash control document the evidence; the GraphQL lookup is reproducible.

Agent sign-off is provenance only; the human certifies once per PR. The hook accepts author-matched provenance without authenticating signatures or consent. `checkPullRequestCertification` in `tools/dev/commit-check.mjs` is a pure evaluator awaiting a trusted CI adapter. It requires complete trusted author classifications and, only for PRs containing agent-authored commits, the configured human's latest exact-head approved review with explicit DCO wording plus AI-21 fields. Later pushes need renewed certification; ordinary human PRs need no self-approval. Tests in `test/commit-check.test.mjs` cover acceptance and rejected provenance-only, stale/bot/dismissed reviews, incomplete inputs and unknown classifications.

Do not accept candidate-supplied classifications/reviews or a boolean verified flag without signer identity. Trusted policy owns human accounts; the adapter must read every commit/review page from GitHub and preserve missing evidence as failure. Downstream smartcloud integration and review remain prerequisites for live enforcement; this PR does not change current CI permissions or gates.
