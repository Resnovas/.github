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

## <a id="release"></a>Release

**What it does.** Cuts a release with [Nx release](https://nx.dev/docs/features/manage-releases) from the default branch, started by hand from the Actions tab. The synced `house-release.yml` calls the house `release.yml`, which reads `release.config.json` at the repository root to learn what the repository ships. In order:

1. Nx reads the conventional commits since the last `v*` tag and picks the bump (`feat` minor, `fix`, `perf` and `revert` patch, a breaking change major); `specifier` overrides it.
2. Nx writes the version to the released projects' `package.json` files, and each bundle in `bundles` is built from that source. Its source map goes to error tracking (see `posthog`) and is deleted.
3. The release commit holds the bundles and the versions, leaves out `dropFromReleaseCommit`, and is signed off by `github-actions[bot]`. It is on no branch: only the `v<version>` tag is pushed, so the default branch never carries a release commit or a bundle. With `majorTag`, `v<major>` moves to it (what workflows pin a GitHub Action by).
4. The release notes go to a draft GitHub release. The same notes go to `CHANGELOG.md` and to `<app>/CHANGELOG.md` for each entry in `apps`, which the `changelogs` job brings to the default branch in a pull request committed through the GitHub API as the house app, so the commit is signed by GitHub.
5. The `artifacts` job checks out the tag, rebuilds each bundle and stops unless it matches the tagged one, writes an SPDX SBOM per shipped package, and with an `npm` section builds, prepares and publishes the package to npm with provenance through trusted publishing.
6. `attest.yml` (below) signs build provenance for the bundles and attaches the SBOMs to the draft release, and `publish-release` publishes it. It stays a draft until then, because house releases are immutable once published.

**Setup.** Write `release.config.json` at the repository root. Every key is optional except where the feature needs it:

| Key | Default | Meaning |
| --- | --- | --- |
| `name` | the `package.json` name without its scope | The release name, used for the error tracking release and temporary directories. |
| `firstRelease` | `1.0.0` | The version the first stable release takes; the preview shows it until a stable `v*` tag exists. |
| `majorTag` | `false` | Move `v<major>` to each stable release. Set it for a GitHub Action, which workflows pin by major. |
| `bundles` | `[]` | `{ target, output, project }` per bundle: the Nx target that builds it, its path, and the package that owns it (whose SBOM is bound to it). Bundles are committed to the release commit, verified from the tag and attested. |
| `dropFromReleaseCommit` | `[]` | Paths the release commit leaves out, for example vendored source under `externals/` that every download of the tag would otherwise carry. |
| `apps` | `[]` | Directories whose `package.json` a nightly stamps with the version and whose `CHANGELOG.md` the changelog pull request carries. |
| `nightly` | none | `{ major }`: cut nightly pre-releases previewing that major (see Nightly). Absent, the nightly workflow stops before installing anything. |
| `posthog` | none | `{ host, projectId }`: the error tracking project the source maps go to (`host` defaults to `https://eu.posthog.com`). Absent, or without the `POSTHOG_CLI_API_KEY` secret, the maps are deleted without uploading. |
| `npm` | none | `{ prepare, directory, bundleTargets, sbomProjects }`: publish `directory` to npm after running `bundleTargets` and the `prepare` command (a `node`, `pnpm` or `npm` command) from the tag; `sbomProjects` get an SBOM beside the bundles' own. |
| `versionGlobal` | `__APP_VERSION__` | The global `tools/release/bundle.ts` defines with the version, which the app reads at start-up. |

A complete example, for a repository that ships a GitHub Action and a CLI on npm:

```json
{
  "name": "smartcloud",
  "firstRelease": "2.0.0",
  "majorTag": true,
  "bundles": [{ "target": "@resnovas/action:bundle", "output": "dist/index.js", "project": "@resnovas/action" }],
  "dropFromReleaseCommit": ["externals"],
  "apps": ["apps/action", "apps/cli", "apps/mcp"],
  "nightly": { "major": 2 },
  "posthog": { "projectId": "285077" },
  "npm": {
    "prepare": "node tools/release/prepare-cli.ts",
    "directory": "apps/cli/release",
    "bundleTargets": ["@resnovas/smartcloud:bundle", "@resnovas/smartcloud-mcp:bundle"],
    "sbomProjects": ["@resnovas/smartcloud", "@resnovas/smartcloud-mcp"]
  },
  "versionGlobal": "__SMARTCLOUD_VERSION__"
}
```

Then point `nx.json` at the synced renderer (`release.changelog.workspaceChangelog.renderer` and `projectChangelogs.renderer`: `{workspaceRoot}/tools/release/changelog-renderer.ts`), keep `release.git` off (`commit`, `tag` and `stageChanges` false) and `releaseTag.strictPreid` on, and add the package scripts `release:dry-run` (`node tools/release/release.ts --dry-run`) and `release:preview` (`node tools/release/release-preview.ts`). A real release needs the organisation variable `RESNOVAS_BOT_APP_ID` and secret `RESNOVAS_BOT_PRIVATE_KEY` (the house app, installed on the repository with contents and pull requests write), and the workflow token allowed to create `v*` tags if a tag ruleset protects them. Trusted publishing needs the npm package to trust the repository's `house-release.yml` workflow.

**Running it.** Open Actions, choose House release, then Run workflow on the default branch. `dry-run` is ticked by default and prints the version, the notes and the change to each changelog file without tagging or publishing; run it once, check the notes, then run it again with `dry-run` cleared. The first release has no `v*` tag to count from: give it a `specifier` and tick `first-release`. Never run `nx release` by hand without `--dry-run`; the workflow is the only release path.

**What you will see.** The `v<version>` tag, a GitHub release with the notes, the SBOMs and attestations, a `chore(release): changelogs for v<version>` pull request to merge before the next release, and with an `npm` section the package on npm. When no commit since the last tag calls for a release, the workflow says so and stops.

**Common problems.** "release.config.json is missing": the repository has not been set up, see above. "set the RESNOVAS_BOT_APP_ID variable": a real release stops before tagging until the house app is configured. "does not match its source": the tagged bundle differs from a rebuild of the tag, so the tag's source is not what was released; investigate before publishing anything. A job after the tag fails: fix the cause and re-run the failed jobs; the tag and the draft release are reused.

## <a id="nightly"></a>Nightly

**What it does.** `house-nightly.yml` runs every night and cuts a `v<version>-nightly.<yyyymmdd>` pre-release from the default branch when it has moved since the last one, in a repository whose `release.config.json` has a `nightly` section; elsewhere it reads the file and stops before installing anything. The version is the next patch of the newest stable release of `nightly.major`, or `<major>.0.0` before the first one, so a nightly always sorts before the release it previews. It is built like a release (a commit on no branch holding the bundles) and gets a GitHub pre-release with generated notes, never marked latest. Nothing goes to npm and no changelog is written. With `majorTag`, `v<major>` follows the nightlies until that major's first stable release. Start it by hand from the Actions tab for a nightly now, or with `dry-run` ticked for the version only.

## <a id="release-preview"></a>Release preview

**What it does.** `house-release-preview.yml` leaves one comment on every pull request saying which version the next release would be if the pull request were merged now, what its own commit adds (it lands as a squash of its title and number, so the title decides the bump), and the release notes that release would carry. It is the same dry run as `node --run release:dry-run`, run for you; nothing is released, it is not part of the required check, and a problem making it becomes a warning. A repository without `release.config.json` skips it. Forks and Dependabot get the job summary only, since their token cannot comment.

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
