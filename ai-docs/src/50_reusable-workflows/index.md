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
