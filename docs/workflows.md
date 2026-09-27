# Workflows

Every repository runs the same set of GitHub Actions workflows.
Most are two parts: a short **caller** that the sync puts in the repository (`.github/workflows/house-*.yml`), and a **reusable workflow** here that does the work (`.github/workflows/<name>.yml` in this repository).
The caller refers to the reusable workflow at `@main`, so a fix here reaches every repository on its next run, with no sync needed.
[Back to the README](../README.md)

| Workflow in a repository | Calls | What it is for | Required to merge? |
| --- | --- | --- | --- |
| [`smartcloud.yml`](#smartcloud) | the smartcloud action | House rules, the aggregate check, labels, settings, the sync | Yes: `smartcloud` |
| [`smartcloud-review.yml`](#smartcloud-review) | nothing | Re-checks a pull request when it is reviewed | No |
| [`house-codeql.yml`](#codeql) | `codeql.yml` | Code scanning for security problems | Through the ruleset's code scanning rule |
| [`house-dependency-review.yml`](#dependency-review) | `dependency-review.yml` | Blocks vulnerable or disallowed new dependencies | No, unless the repository adds it |
| [`house-scorecard.yml`](#scorecard) | `scorecard.yml` | Scores supply-chain security practices | No |
| [`house-workflow-lint.yml`](#workflow-lint) | `workflow-lint.yml` | Lints and audits the workflows | No, unless the repository adds it |
| [`house-graphify.yml`](#graphify) | `graphify.yml` | Keeps the code graph current | No |
| a release workflow you write | [`attest.yml`](#attest) | Signs what a release ships | n/a |

Because the smartcloud check waits for every other check on a pull request ([the aggregate check](preset.md#required)), a failing workflow above still blocks the merge even when it is not required by name.

Every house workflow gives the workflow token no access at the top level (`permissions: {}`) and lets each job ask only for what it uses.
Pull requests from forks and from Dependabot get a read-only token and no secrets, and every house workflow still works for them, doing less where it must.

## <a id="smartcloud"></a>smartcloud

**What it does.** Runs [smartcloud](https://github.com/Resnovas/smartcloud) with the [house preset](preset.md).
On pull requests it checks the title, sign-offs, AI disclosure, review count and synced files, then waits for every other check and passes only if they all pass.
On issues it applies labels.
On a push to the default branch, weekly and by hand, it syncs the labels, applies the repository settings and runs the [sync](sync.md).

**When it runs.** Pull requests (opened, edited, pushed to, reopened, marked ready or draft), issues (opened, edited, reopened, labelled), pushes to `main`, the merge queue, Mondays at 07:00 UTC, and by hand.
In the merge queue the job is skipped, which GitHub counts as passing: the pull request was already checked.
A newer run for the same pull request, issue or branch cancels the older one.

**Access.** It uses three tokens, each for its own job (see [Access](access.md#tokens)): the workflow token for checks, comments and labels; a read-only Resnovas Bot token for reading the preset and templates in `Resnovas/.github`; and, only on pushes, the weekly run and manual runs, a full Resnovas Bot token that reaches only the repository, for settings and sync.
Forks and Dependabot get no app token, so smartcloud runs restricted: it skips the preset, settings and sync, and lists what it skipped in the job summary.

**What you will see.**

- A check named `smartcloud` on every pull request, plus one `smartcloud / <feature>` check per feature (such as `smartcloud / conventions`).
- One comment on the pull request listing errors and warnings, updated in place on each run, only when there is something to fix.
- The job summary: each feature's result, every finding and every change it made.

**How to add it.** It arrives with the sync. To adopt a repository, copy it by hand once; see [Getting started](getting-started.md#adopting).

## <a id="smartcloud-review"></a>smartcloud review

**What it does.** When someone submits or dismisses a review, it re-runs the pull request's existing smartcloud run, so the one required `smartcloud` check reads the new review.
It re-runs rather than running smartcloud again, because a second run would put a second `smartcloud` check on the commit.

**When it runs.** `pull_request_review` submitted or dismissed. Reviews of one pull request queue rather than cancel each other.

**What you will see.** A short run named "re-run smartcloud for the review", then the `smartcloud` check running again.
On a pull request from a fork it does nothing (the token cannot re-run anything); push a commit or re-run the check by hand.
If there is no smartcloud run to re-run, it warns and succeeds.
GitHub allows 50 re-runs of one run; after that, push a commit.

## <a id="codeql"></a>CodeQL

**What it does.** Finds security problems in the code with [CodeQL](https://codeql.github.com/).
A first job works out which languages to scan, and a second job analyses each with the `security-extended` queries.
The languages are CodeQL's (C and C++, C#, Go, Java and Kotlin, JavaScript and TypeScript, Python, Ruby, Rust), taken from two places:

- the languages GitHub lists for the repository, which describe the default branch;
- on a pull request or merge queue entry, the languages of the files it adds or changes, by file extension.

So a pull request that brings the repository's first Python file is scanned for Python before it merges, not only after.
Files under `externals/`, `vendor/`, `node_modules/` and `dist/` do not add a language, because a language with nothing left to analyse would fail its job.
`actions` is always scanned, for the workflows themselves.
If the list of changed files cannot be read, the job warns "Could not list the changed files" and scans the repository's languages only.

**When it runs.** Pull requests, the merge queue, pushes to `main`, Mondays at 04:27 UTC, and by hand.

**Inputs.** None.

**Configuration.** Optional `.github/codeql/codeql-config.yml` in the repository, for example:

```yaml
paths-ignore:
  - externals/
```

Queries it lists are added to `security-extended`.
The file is read from the base commit, so a pull request cannot narrow its own scan; a change to it applies once it merges.

**What you will see.** Checks named `analyze (<language>)`, and alerts under Security > Code scanning, in the categories `/language:<name>`.
The ruleset blocks a merge on a new CodeQL error or a high or critical security alert.
The preset turns GitHub's automatic CodeQL setup off, because GitHub rejects these results while it is on.

## <a id="dependency-review"></a>Dependency review

**What it does.** Compares the dependencies before and after the change with [dependency-review-action](https://github.com/actions/dependency-review-action).
It fails when the change adds a dependency, in runtime or development scope, with a known high or critical vulnerability, or with a licence the synced `.github/dependency-review-config.yml` does not allow.

**When it runs.** Pull requests and the merge queue.

**Inputs.** None.

**Configuration.** `.github/dependency-review-config.yml`, after its `house:local` line, takes the action's [options](https://github.com/actions/dependency-review-action#configuration-options):

```yaml
allow-ghsas:
  - GHSA-xxxx-xxxx-xxxx          # does not apply: we never call the affected function
allow-dependencies-licenses:
  - pkg:npm/some-package         # cleared by a maintainer
```

The file is read from the base commit, so a pull request cannot allow its own advisories.
The house severity and scopes win over the file.

**What you will see.** A check named `dependency-review`, and a table of changed dependencies with their licences and OpenSSF Scorecards in the job summary.
It does not comment on the pull request.

**Make it required** by adding `house-dependency-review / dependency-review` under `settings.ruleset.statusChecks.checks`.

## <a id="scorecard"></a>OpenSSF Scorecard

**What it does.** Scores the repository's supply-chain practices with [OpenSSF Scorecard](https://scorecard.dev): pinned dependencies, token permissions, branch protection, dangerous workflows, code review and more.

**When it runs.** Pushes to `main`, Mondays at 05:41 UTC, when branch protection changes, and by hand. Only on the default branch.

**Inputs.** None.

**What you will see.** Alerts under Security > Code scanning in the `scorecard` category, each with how to fix it.
They never block a pull request.
A public repository also publishes its score, which you can show in its README:

```markdown
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/<owner>/<name>/badge)](https://scorecard.dev/viewer/?uri=github.com/<owner>/<name>)
```

A private repository publishes nothing.
The workflow uses only the read-only workflow token, so the branch protection score reflects what that token can see.

## <a id="workflow-lint"></a>Workflow lint

**What it does.** Two jobs.
`actionlint` checks workflow syntax, expressions and the shell in `run:` steps with [actionlint](https://github.com/rhysd/actionlint).
`zizmor` audits workflows, actions and the Dependabot configuration for security problems (template injection, persisted credentials, too much access, unpinned actions) with [zizmor](https://docs.zizmor.sh).
Both fail on any finding.

**When it runs.** Pull requests, the merge queue and pushes to `main`.

**Inputs.** None.

**Configuration.** zizmor reads the synced `.github/zizmor.yml`. Ignore one intended finding where it occurs, with the reason on the line above:

```yaml
      # The token needs the app's full permission set; it is scoped to this repository.
      - uses: actions/create-github-app-token@<sha> # v3.2.0 # zizmor: ignore[github-app]
```

actionlint reads the repository's own `.github/actionlint.yaml`.
Run both locally with `uvx --from actionlint-py actionlint` and `uvx zizmor .`.

**What you will see.** Checks named `actionlint` and `zizmor`, with one annotation per finding on the line it is about.

**Make it required** by adding `house-workflow-lint / actionlint` and `house-workflow-lint / zizmor` under `settings.ruleset.statusChecks.checks`.

## <a id="graphify"></a>Graphify

**What it does.** Keeps the committed code graph (`graphify-out/graph.json`, see [Synced files](synced-files.md#graphify)) in step with the code.
On a pull request, `check` reports, without failing, when the graph is behind the code; that is normal, because the git hooks rebuild the graph after each commit.
On the default branch, `refresh` rebuilds the graph and opens or updates a pull request with it, only when nodes or edges changed.
Both use local parsers only: no model and no provider key.
In a repository without `tools/graphify/graphify` both do nothing.

**When it runs.** Pull requests, pushes to `main`, and by hand (on the default branch only).

**Inputs (reusable workflow).**

| Name | Kind | Required | Meaning |
| --- | --- | --- | --- |
| `app-id` | input | no | The Resnovas Bot app ID (the `RESNOVAS_BOT_APP_ID` variable). |
| `private-key` | secret | no | The app's private key (`RESNOVAS_BOT_PRIVATE_KEY`). The synced caller passes it only outside pull requests. Without it, the workflow token opens the pull request. |
| `token` | secret | no | Deprecated. A fallback for callers not yet synced. Pass `private-key` instead. |

**What you will see.** On pull requests, a `check` job that always passes, and a `refresh (default branch only)` job shown as skipped, because it only runs after merge.
When the graph is behind, `check` adds a notice "Graphify graph is behind the code (no action needed)" and the same explanation in the job summary, with the counts of nodes and edges that differ.
You do not need to do anything: after the pull request merges, `refresh` runs on the default branch and opens a pull request titled `chore(graphify): refresh the code graph` from the `house/graphify` branch, labelled `house-sync`.
If you would rather ship the rebuilt graph in your own pull request, run `sh tools/graphify/graphify update` and commit `graphify-out/`.

**Common problems.**

| You see | Why | What to do |
| --- | --- | --- |
| "Graphify graph is behind the code" on a pull request, and `refresh` skipped | Expected: the graph is refreshed after merge, not on pull requests. | Nothing, or update and commit the graph yourself. |
| No refresh pull request after a merge | The graph already matched the code, or the default branch has no `tools/graphify/graphify`. | Check the `refresh` job's log on the default branch. |
| The refresh pull request conflicts | The default branch moved again before it merged. | Close it; the next push to the default branch opens a fresh one. |

## <a id="attest"></a>Attest (for release workflows)

**What it does.** Signs [build provenance](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations) for the files a release ships, binds an SBOM (a list of what is inside them) to them, and attaches the SBOMs to the GitHub release.
Nothing is synced, because releases differ between repositories: call it from your own release workflow.

**Inputs.**

| Name | Required | Meaning |
| --- | --- | --- |
| `artifact` | yes | Name of the workflow artifact holding the files and SBOMs. |
| `subject-path` | yes | Path or glob, inside the artifact, of the files to attest; one per line for several. |
| `sbom-path` | no | Path, inside the artifact, of the SPDX or CycloneDX SBOM. |
| `release` | no | Tag of the **draft** release to attach files to. Empty attaches nothing. |
| `release-assets` | no | Paths or globs attached to the release, one per line. Defaults to `sbom-path`. |

**How to call it.** Build the files and an SBOM, upload them as one artifact, create the release as a draft, then:

```yaml
  attest:
    needs: build
    uses: Resnovas/.github/.github/workflows/attest.yml@main
    permissions:
      contents: write
      id-token: write
      attestations: write
    with:
      artifact: release-files
      subject-path: dist/index.js
      sbom-path: sbom.spdx.json
      release: v1.2.3
```

Publish the release afterwards: house releases are immutable once published, so a published release takes no new files, and the workflow fails early if the release is not a draft.
It also fails, before signing anything, if a pattern matches nothing or points outside the artifact.

**What you will see.** An `attest` job, the attestations under the repository's Attestations page, and the SBOMs on the release.
Anyone can check a file with `gh attestation verify <file> --repo <owner>/<name>`.
Attestations need a public repository, or GitHub Enterprise Cloud for a private one.
Call it only from a release workflow on the default branch, never for pull requests.

## <a id="ci"></a>This repository's CI

[`ci.yml`](../.github/workflows/ci.yml) checks `Resnovas/.github` itself:

- `test` runs `npm test` on Linux, macOS and Windows, each with Node 24 and the current Node release;
- `rendered` runs `npm run check`: the rendered files match `templates/`, the agent commands match their sources, and `LLMS.md` matches `ai-docs/src`;
- `check` passes only when both passed, and is the check this repository's ruleset requires.

`npm test` also enforces the house rules for every workflow here and under `templates/`; see [CI standards](ci-standards.md#workflow-rules).
