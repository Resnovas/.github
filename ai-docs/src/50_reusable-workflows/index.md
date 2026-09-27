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
