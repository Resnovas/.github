# <a id="top"></a>Resnovas house repository

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Resnovas/.github/badge)](https://scorecard.dev/viewer/?uri=github.com/Resnovas/.github)

The single source of truth for the governance files every Resnovas project ships with, across Resnovas, Eventiva and personal repositories.  
It holds the contributing guidelines, the AI contribution policy, the code of conduct, the Developer Certificate of Origin, the FCL-1.0-MIT licence, the Cooperation Commitment, and the issue and pull request templates, together with the checks that enforce them.

Because this repository is public and named `.github`, GitHub also uses these files as the defaults for every repository in the Resnovas organisation that does not have its own.

## <a id="layout"></a>Layout

| Path                                                | What it is                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `templates/`                                        | The source of every governed file, with `{{KEY}}` placeholders. **Edit files here, never the rendered copies.**                                                                                                                            |
| `house.yml`                                         | The values placeholders resolve to. Everything currently resolves to Resnovas.                                                                                                                                                             |
| root and `.github/`                                 | The files rendered from `templates/` with the default values. CI fails if they are out of date.                                                                                                                                            |
| `smartcloud/house.yml`                              | The locked smartcloud preset every repository extends: roles, the AI disclosure, DCO and title checks, the review gate, labels, the repository settings baseline, and the sync of `templates/`. smartcloud is the engine that enforces it. |
| `templates/.github/workflows/smartcloud.yml`        | The one workflow every repository runs: the pull request checks, label sync, repository settings and the weekly house sync.                                                                                                                |
| `templates/.github/workflows/smartcloud-review.yml` | Re-runs a pull request's smartcloud run when it is reviewed, so the one required `smartcloud` check reads the reviews again without a second check on the commit.                                                                          |
| `scripts/`                                          | The renderer this repository uses to render its own root, since smartcloud's sync skips the source repository. Dependency-free Node.                                                                                                       |
| `test/`                                             | Tests for the renderer and the managed blocks, run with `npm test`.                                                                                                                                                                        |

## <a id="managed-blocks"></a>Documents and extendable configuration

Documents (the root Markdown documents and `LICENSE`) are synced whole.

Configuration files are extendable: each template wraps its synced content in `house:managed:begin` and `house:managed:end`, and marks where a repository's own rules go with `house:local`.
The sync replaces only the managed block and keeps everything else, so a repository can add Dependabot updates, code owners, issue form fields, contact links, funding platforms, pull request template sections or workflow jobs without losing them.

Local rules can extend the synced ones but not change them.
The policy check fails a pull request that edits a managed block or a synced document, and flags local rules that would redefine a synced one: a duplicate Dependabot update, a redefined top-level YAML key, a reused issue form field id, or a redefined job.
In `CODEOWNERS` the managed block comes last, because the last matching rule wins.

When a repository first adopts a file it already had, its previous content is kept, commented out at the `house:local` line, for someone to re-add as local rules.
Making a template extendable only needs the three marker lines; `scripts/lib/managed.mjs` handles the rest.

`AGENTS.md` and `CLAUDE.md` are extendable documents: the house agent instructions sit in the managed block, `CLAUDE.md` only imports `AGENTS.md`, and a repository adds its own instructions after the `house:local` line.

## <a id="surfaces"></a>Editor and agent surfaces

Every repository gets the same one-click tasks, debug configurations and app actions, synced from `templates/` with managed blocks like the rest of the configuration:

| Path                                           | Surface                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `.zed/tasks.json`, `.zed/debug.json`           | Zed                                                                         |
| `.vscode/tasks.json`, `.vscode/launch.json`    | VS Code and Cursor                                                          |
| `.run/house-*.run.xml`                         | JetBrains; a repository adds its own as other files in `.run/`              |
| `.codex/environments/environment.toml`         | Codex desktop                                                               |
| `orca.yaml`                                    | Orca worktree setup                                                         |
| `.agents/surfaces.jsonc`                       | Orca quick commands and OpenChamber project actions                         |
| `.agents/prompts/*.md`                         | Agent prompts; a repository adds its own beside the synced ones             |
| `.agents/mcp.jsonc`                            | MCP servers for every agent host; a repository adds its own under `servers` |
| `tools/dev/surfaces.mjs`, `tools/dev/open.mjs` | The tool that installs and generates the above                              |

The synced entries only rely on three package scripts every repository must have, `setup`, `check` and `test`, run with `node --run` so they work under npm and pnpm alike, and on the synced tools.
Everything specific to a repository (its dev server, docs server, debug targets and prompts) goes after the `house:local` line.
The JSON files are JSON with comments, so their markers are `//` lines; a local entry may not reuse a synced label, name or id.

Orca and OpenChamber keep quick commands and project actions in per-user settings, so `node tools/dev/surfaces.mjs install` registers them for the checkout; each repository's `setup` script runs it.
`node tools/dev/surfaces.mjs sync` writes `.agents/prompts` to `.claude/commands` and `.cursor/commands`, which it owns and prunes (it also deletes the `.opencode/commands` it used to write), and a repository's `check` script runs `surfaces.mjs check` so they cannot drift.

`.agents/mcp.jsonc` is the one source of MCP servers, because the host configs are strict JSON or TOML that cannot carry the managed markers.
`surfaces.mjs sync` writes it to `.mcp.json` (Claude Code), `.cursor/mcp.json`, and `.vscode/mcp.json`, which it owns, and to a marked block at the end of `.codex/config.toml`, keeping the project's other Codex settings above it; `check` fails while they differ.
The house servers are the Mem0 gateway, Cognee (pinned to a reviewed `cognee-mcp` release, since it runs with the Cognee credentials), the repository's own Graphify graph and Graphify Cloud.
No credential is ever written: each host config references `MEM0_GATEWAY_TOKEN`, `COGNEE_BASE_URL` and `COGNEE_API_KEY` from the environment in its own syntax, and Graphify Cloud signs in with OAuth.

This repository has no documentation site to serve: its documents are the Markdown files in the root, which GitHub renders.

## <a id="changing"></a>Changing a policy or template

1. Edit the file under `templates/`, or a default in `house.yml`.
1. Run `npm run render` to update the rendered copies, and `npm test`.
1. Commit both.
   Every downstream repository picks the change up in its next sync pull request.

Workflows here and under `templates/` pin every third-party action to a full commit SHA, with its release as a trailing comment (`uses: actions/checkout@<sha> # v7.0.1`), and `npm test` fails on one that is not.
Dependabot's `github-actions` update moves the SHA and the comment together.
First-party references stay on a ref: the reusable workflows here track `main`, so a house change reaches every repository on its next run, and `resnovas/smartcloud` follows its major tag.

Every workflow here and under `templates/` grants the workflow token nothing at the top level (`permissions: {}`), and each job declares only the scopes it uses, so a job added later starts with no access; `npm test` fails on a workflow or job that does not.
A job that calls a reusable workflow grants no more than the called jobs declare, because GitHub caps the called workflow at the caller's grant.
Pull requests from forks get a read-only token whatever a job asks for.

Every job that runs steps sets `timeout-minutes`, sized to a few times its usual run, so a hung step fails in minutes instead of holding a runner for GitHub's six-hour default; `npm test` fails on a job without one.
A job that calls a reusable workflow cannot set a timeout, and is bounded by the called workflow's jobs.

A job that runs [Nx](https://nx.dev) caches `.nx/cache` between runs with `actions/cache`, keyed on the runner OS, the lockfile hash, the commit and the workflow, with the OS and lockfile prefix as a restore key, so tasks whose inputs did not change replay from the last run; `npm test` fails on a job that runs Nx without it.
Nx replays an entry only when the hash of the task's inputs matches, and a pull request's cache entries are scoped to its own ref, so they never reach the default branch.
A release workflow restores no cache and runs Nx with `--skip-nx-cache`, so nothing it builds or publishes comes from a cache entry.
A nightly full run restores no cache either (see [Nightly full run](#nightly)).

### Test matrix

A repository whose code runs on contributors' or users' machines, such as a CLI, an action or the synced tools, runs its tests on Linux, macOS and Windows, each with the minimum Node major (`.nvmrc`, currently 24) and the current release (`node-version: current`).
Only the test job needs the matrix; lint, type checks, builds and docs give the same answer everywhere, so they stay on one Linux runner.
Set `fail-fast: false`, so a failure on one combination does not cancel the others and hide their results; `npm test` fails on a matrix job without it.
The aggregate `check` job needs the matrix job as a whole, which fails when any combination failed, so the ruleset never lists a combination.
Run steps written for bash with `defaults.run.shell: bash`, since Windows defaults to PowerShell, and turn off `core.autocrlf` before checkout, since Windows checks text out with CRLF.
A matrix job that runs Nx gives each combination its own cache key and adds the Node version and platform to the test target's inputs (`{ "runtime": "node --version" }` and `{ "runtime": "node -p process.platform" }`), so a result cached on one combination is never replayed on another.
Keep tests portable: turn file URLs into paths with `fileURLToPath`, never with `URL.pathname`, build paths with `node:path`, and do not assume a shell, line ending or case-sensitive file system.

### Action bundle budgets

A repository that bundles a GitHub Action should check the built entry file in CI against reviewed raw and gzip byte limits. Keep the baseline and limits in version control, build before measuring, report the signed change from that baseline and the remaining budget in the job summary, and fail when either limit is exceeded. Document the compression level and which files count; intentional increases need an explanation and an explicit budget update in the pull request.

smartcloud implements this with `bundle-size.json` and `pnpm bundle:check` for `dist/index.js`, using gzip level 9 and initially 10% headroom. Its existing build job runs the check, feeding the required aggregate `check` context on pull requests and merge queue groups, with only `contents: read`. There is no PR comment, personal token or base-branch build: forks and Dependabot use the same check. This stays repository-local because the house preset does not define a shared action-bundling target; repositories without an action bundle need no extra job.

### Action smoke test

A repository that publishes a JavaScript GitHub Action runs it end to end in CI, the way a workflow uses it: `uses: ./` on the freshly built bundle, in dry-run mode, once for each of a set of recorded events, and then checks the job summary it wrote.
Record each event's payload in version control, trimmed to what the action reads, and keep the expected summary lines (the event, each feature's result and the changes it would make) beside them; a change that alters them updates the expectations in the same pull request.
Give the config inline, turn telemetry off, and grant only read scopes, so the job runs with the read-only workflow token, including on pull requests from forks and from Dependabot, and needs no secret.
The runner sets `GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH` and `GITHUB_STEP_SUMMARY` for an action itself, over anything in the step's `env`, so point them at the recording from a small preload given in `NODE_OPTIONS` (`--import=<preload>`) that fails when its inputs are missing, rather than adding a test-only input to the action.
Run the check step with `if: ${{ !cancelled() }}`, so a failed run still reports its summary, or that there was none, and add the job to the aggregate `check` job's `needs`.

smartcloud implements this as the `smoke` job in its CI, with the recordings, config, preload and check in `tools/ci/smoke`; it runs whenever the build does.

### <a id="nightly"></a>Nightly full run

A repository whose CI runs only what a change affects (`nx affected`, or jobs skipped for documentation-only changes) also runs its whole CI every night, on every project, from scratch.
Add a `schedule` trigger to the CI workflow at an off-peak minute, and on scheduled and manual (`workflow_dispatch`) runs have each job call `nx run-many` instead of `nx affected`, set `NX_SKIP_NX_CACHE=true` and skip the `.nx/cache` restore, so every task really runs.
This catches the failures no change sets off, such as a new Node release on the `current` leg of the test matrix, a new runner image, a dependency or upstream service that changed behaviour, or a cache entry that should not have replayed, the next morning rather than on an unrelated pull request.
Put the event in the workflow's `concurrency` group (`ci-${{ github.event_name }}-${{ github.ref }}`), so a push to the default branch does not cancel the nightly run.
The run needs no more access than CI already has: each job keeps its own read-only scopes, and GitHub runs schedules only on the default branch of the repository itself, never in forks, and emails a failed run to whoever last changed the `cron`.

smartcloud implements this in its `CI` workflow with a workflow-level `NX_RUN` (`affected` or `run-many`) that every Nx step uses.

### <a id="flaky-tests"></a>Flaky tests

A repository's CI retries a failed test, and never retries it locally, so a flaky test does not fail an unrelated pull request, a merge queue group or the nightly run, but a developer who runs the tests still sees it fail.
Retries must not hide the flake: report every test that failed and then passed on a retry as a `::warning` annotation on the test's file and line, which shows on the run and the pull request's changed files, and as a table in the job summary.
Keep the retry count low (two) and set it in the shared test configuration keyed on `CI=true`, so every project gets the same behaviour; never raise it to get a run green.
A flaky test is a bug, handled as the contributing guide says: fix the test or the code it exercises, never skip or delete it.
Reporting needs no extra access: annotations and the job summary come from the job's own output, so it works with the read-only token on pull requests from forks and from Dependabot.

smartcloud implements this in `vitest.shared.ts` (`retry`, `includeTaskLocation` and the `tools/ci/flaky-tests.ts` reporter, on CI only), which every test project uses.

### <a id="workflow-lint"></a>Workflow lint

Every repository lints its workflows from the synced `.github/workflows/house-workflow-lint.yml`, which calls the reusable `.github/workflows/workflow-lint.yml`.
[actionlint](https://github.com/rhysd/actionlint) checks the syntax, expressions and run scripts, and [zizmor](https://docs.zizmor.sh) audits the workflows, actions and Dependabot configuration for security problems such as template injection, persisted credentials and unpinned actions.
Both fail on any finding, and both use only the workflow token with read access, so pull requests from forks and Dependabot run them too.

zizmor reads the synced `.github/zizmor.yml`, which lets Resnovas references follow a branch and holds every other action to a commit SHA.
Ignore one intended finding where it occurs, with a trailing `# zizmor: ignore[<audit>]` comment that gives the reason; a repository that needs other rules keeps its own copy with `sync.exclude`.
actionlint reads a repository's own `.github/actionlint.yaml`, for example to ignore a message in one file.
Run both locally with `uvx zizmor .` and `uvx --from actionlint-py actionlint`.

The check is not required by the house ruleset; a repository that wants it to block merges adds `house-workflow-lint / actionlint` and `house-workflow-lint / zizmor` under `settings.ruleset.statusChecks.checks`.

## <a id="adopting"></a>Adopting it in a repository

1. Copy `templates/.github/smartcloud.yml` and `templates/.github/workflows/smartcloud.yml` into the repository, or let the first sync add them.
1. Add the repository's own configuration after the `house:local` line of `.github/smartcloud.yml`: keys the preset leaves unset, such as `settings.environments` or `sync.exclude` for a template path it keeps its own copy of.
1. Make sure the Resnovas Bot GitHub App is installed on the repository (see [The sync token](#sync-token)).
1. Run the smartcloud workflow once by hand to open the first sync pull request.
1. Give the repository `setup`, `check` and `test` package scripts; the synced editor and agent surfaces run them.
1. The house ruleset requires the `smartcloud` check and a merge queue on the default branch, so every workflow behind a required check also runs on `merge_group`. Add the repository's own required checks under `settings.ruleset.statusChecks.checks`; a CI that runs parallel jobs requires one aggregate job that needs them all and fails unless every one succeeded, so adding a job never changes the ruleset. To skip work a change cannot affect, such as a documentation-only pull request, skip jobs, not workflows: a workflow filtered with `paths` or `paths-ignore` never reports its check, so a required check waits forever. A first job classifies the changed files, the others run `if:` its outputs say they are needed, and the aggregate job accepts a skipped job only when that output said so, so a failed classifier fails the check. smartcloud's `tools/ci/changes.ts` classifies with the Graphify graph and `nx show projects --affected`. In the merge queue, work out what changed from `merge_group.base_sha`, the commit the group lands on, so the group covers the pull requests queued ahead of it as well as its own; `nrwl/nx-set-shas` otherwise compares with the last green run on the default branch or, with `use-previous-merge-group-commit`, with the entry ahead only, which a `headGreen` queue would let through untested. Add a pre-production environment under `settings.ruleset.requiredDeployments`, `settings.ruleset.codeScanning.ESLint` once ESLint uploads results to code scanning, and `settings.ruleset.codeCoverage.enabled: true` once coverage is uploaded to GitHub.
1. Once the preset lists two or more maintainers, the ruleset also requires an approval. It is the aggregate check: it waits for every other check on the pull request and fails if any does. The preset turns the aggregate on as soon as it changes, but it only starts waiting once the sync pull request adds `checkRunId` to the workflow; until then the `smartcloud` check reports smartcloud's own findings, as before. List the main CI check under `required.expect` too, and keep it required beside `smartcloud` until then.

## <a id="values"></a>Values

`house.yml` renders this repository's own root. Downstream repositories get their values from `sync.values` in `smartcloud/house.yml`, and `REPOSITORY` from the repository the sync runs in; roles, trusted bots, environments and exclusions are preset keys rather than values.

| Key                                                           | Used for                                                                                                                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORG_NAME`                                                    | The owner's name in prose.                                                                                                                                                                                      |
| `LEGAL_HOLDER`                                                | The copyright holder in `LICENSE`.                                                                                                                                                                              |
| `COPYRIGHT_YEAR`                                              | The year in the copyright notice.                                                                                                                                                                               |
| `REPOSITORY`                                                  | Links to the repository's own advisories, discussions and files. Set automatically by the sync.                                                                                                                 |
| `PACKAGE_SCOPE`                                               | The npm scope in the module boundary rule.                                                                                                                                                                      |
| `CONDUCT_CONTACT`                                             | Where Code of Conduct reports go.                                                                                                                                                                               |
| `COVERAGE_MIN`                                                | The minimum line and branch coverage.                                                                                                                                                                           |
| `MAINTAINERS`                                                 | Who counts as a maintainer for the checks and the review gate.                                                                                                                                                  |
| `TRUSTED_BOTS`                                                | Automation accounts that skip the disclosure and DCO checks.                                                                                                                                                    |
| `HOUSE_EXCLUDE`                                               | Template paths a repository keeps its own copy of. For configuration, prefer local rules outside the managed block; exclusion is for a file the repository genuinely cannot share, such as a different licence. |
| `PROJECT_TYPE`                                                | `saas`, `desktop`, `library` or `none`; picks the deployment environments.                                                                                                                                      |
| `ENVIRONMENTS`                                                | Explicit environment names, replacing the `PROJECT_TYPE` set.                                                                                                                                                   |
| `CODE_SCANNING_GATE`                                          | Whether serious CodeQL findings block merges. Turn off only where CodeQL cannot analyse the code.                                                                                                               |
| `SPONSORS`                                                    | GitHub Sponsors accounts in `FUNDING.yml`.                                                                                                                                                                      |
| `OWNERS_ADMIN`, `OWNERS_DOCS`, `OWNERS_QA`, `OWNERS_WORKFLOW` | Code owners by role, in `CODEOWNERS`.                                                                                                                                                                           |

## <a id="settings"></a>Repository settings

The sync's `settings` job applies the baseline in [the governance document](GOVERNANCE.md#settings) every week, so a setting changed by hand drifts back.
Preview what it would change for any repository you can read:

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud plan settings --repo owner/name
```

Settings that no API exposes, and so are set by hand once per repository:

- Settings > General > Pushes: **Limit how many branches and tags can be updated in a single push** to 5.

Settings best made once at organisation level:

- Settings > Advanced Security > Configurations: a code security configuration with every feature enabled except CodeQL default setup (see [CodeQL](#codeql)), applied to all repositories and set as the default for new ones.
  This covers private repositories the per-repository settings cannot, where the licence allows.
- Settings > Advanced Security > Global settings: Dependabot on Actions runners, and Copilot Autofix for third-party tools.

### <a id="codeql"></a>CodeQL

Code scanning runs as CodeQL advanced setup, from the synced `.github/workflows/house-codeql.yml`, which calls the reusable `.github/workflows/codeql.yml`.
It maps the repository's languages to CodeQL languages, always adds `actions`, and runs the `security-extended` queries, the suite default setup ran, under the same `/language:<name>` categories, so existing alerts carry over.
The preset turns default setup off (`settings.security.codeScanning: off`), because GitHub rejects advanced results while it is on.
A code security configuration that enforces default setup blocks that, so the organisation's configuration must leave CodeQL default setup unset or disabled.

A repository tunes the analysis in `.github/codeql/codeql-config.yml`, for example `paths-ignore` for vendored source; queries it lists are added to `security-extended`.
The workflow uses only the workflow token, so pull requests from forks and Dependabot run it with the same least privilege.
A repository with no code CodeQL can analyse still scans its workflows.

### <a id="dependency-review"></a>Dependency review

Every pull request and merge queue entry runs a dependency review, from the synced `.github/workflows/house-dependency-review.yml`, which calls the reusable `.github/workflows/dependency-review.yml`.
[dependency-review-action](https://github.com/actions/dependency-review-action) compares the dependency graph of the base and head commits and fails when the change adds a dependency, in runtime or development scope, with a known vulnerability of high or critical severity, the threshold the ruleset applies to code scanning alerts.
It lists the changed dependencies, their licences and OpenSSF Scorecards in the job summary rather than a pull request comment, so it needs only the workflow token with read access, and pull requests from forks and Dependabot run it with the same least privilege.

A repository adds its own policy in `.github/dependency-review-config.yml`, which takes the action's [configuration options](https://github.com/actions/dependency-review-action#configuration-options), for example `allow-ghsas` for an advisory that does not apply or `allow-licenses` for a licence policy.
The review reads the file from the base commit, so a pull request cannot allow its own advisories: a policy change applies once it has merged.
The house severity and scopes take precedence over the file.

The check is not required by the house ruleset; a repository that wants it to block merges adds `house-dependency-review / dependency-review` under `settings.ruleset.statusChecks.checks`.

### <a id="scorecard"></a>OpenSSF Scorecard

The default branch runs [OpenSSF Scorecard](https://scorecard.dev) on every push, weekly and whenever branch protection changes, from the synced `.github/workflows/house-scorecard.yml`, which calls the reusable `.github/workflows/scorecard.yml`.
Scorecard scores the repository's supply-chain practices, such as pinned dependencies, token permissions, branch protection, dangerous workflows and code review.
The results go to code scanning under the `scorecard` category, where each failing check is an alert with its remediation; the ruleset gates merges on CodeQL only, so they never block a pull request.

A public repository also publishes its results to the OpenSSF API, which serves the viewer and a badge for its README:

```markdown
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/<owner>/<name>/badge)](https://scorecard.dev/viewer/?uri=github.com/<owner>/<name>)
```

The action publishes nothing for a private repository.
Publishing verifies the reusable workflow against the action's [workflow restrictions](https://github.com/ossf/scorecard-action#workflow-restrictions), so it keeps to the approved actions and sets no `env` or `defaults`.
The workflow uses only the workflow token, never a personal access token, so the Branch-Protection check scores only what a read-only token can see, and it runs only on the default branch, never for pull requests from forks or Dependabot.

### <a id="attestations"></a>Build attestations and SBOMs

A repository that ships files attests them from its release workflow with the reusable `.github/workflows/attest.yml`.
Releases differ between repositories, so nothing is synced: the release workflow builds the files and an SBOM of each, uploads them as one workflow artifact, and calls it:

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

It signs [build provenance](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations) for the subjects with `actions/attest-build-provenance`, binds the SBOM to them with `actions/attest-sbom`, and, given a release tag, attaches the SBOMs (or the `release-assets` globs) to that GitHub release.
The release must still be a draft: house repositories make releases immutable once published, so create it as a draft, call the workflow, then publish it.
Anyone can then check a released file with `gh attestation verify <file> --repo <owner>/<name>`.
Attestations need a public repository, or GitHub Enterprise Cloud for a private one.
The workflow uses only the workflow token; call it only from a release workflow on the default branch, never for pull requests.

## <a id="sync-token"></a>The sync token

The house workflows authenticate as the Resnovas Bot GitHub App (`resnovas-smartcloud[bot]`), installed on every repository in the organisation.
Each job that needs it mints a short-lived token with `actions/create-github-app-token` from the organisation variable `RESNOVAS_BOT_APP_ID` and the organisation secret `RESNOVAS_BOT_PRIVATE_KEY`.
The smartcloud workflow's token reaches only its own repository and `Resnovas/.github`; the Graphify refresh's token reaches only its own repository, with contents and pull request access.
The workflow token cannot read this private repository, so it cannot load the preset (`smartcloud/house.yml`); nor can it push changes to workflow files or change repository settings, and pull requests it opens do not start other workflows.
Everything else, such as CI and the Graphify check, acts with the workflow token.

Commits made with the app token go through the GitHub API, so GitHub signs them: sync and Graphify refresh commits pass required signatures without a ruleset bypass, and are signed off as the app's bot.
The app has its own rate limit, so house runs no longer share one person's.

Runs that get no secrets, such as pull requests from forks and Dependabot, mint no token and fall back to the workflow token.
smartcloud then runs restricted rather than failing: it skips the preset, settings, sync and any write the token is refused, and lists them in the job summary.
Forks and Dependabot runs act with the workflow token even if a workflow passes a stronger one, and no house workflow mints the app token in a job that runs pull request code.
Without the app key, the Graphify refresh on the default branch opens its refresh pull request with the workflow token, which the preset allows to create pull requests.

The app needs **Administration**, **Checks**, **Contents**, **Issues**, **Pull requests** and **Workflows** write access, plus whatever else the preset's settings manage, such as environments, Pages, webhooks and variables; Administration is what lets it apply the repository settings.
The `ACCESS_TOKEN` organisation secret, a personal access token, is no longer used, except by the reusable Graphify workflow for callers that have not yet synced the new `house-graphify.yml`; remove it once every repository has.
While this repository is private, its Actions access (Settings > Actions > General > Access) must allow repositories in the organisation, so they can call its reusable workflows and Dependabot can resolve them.
The preset keeps it there (`settings.actions.accessLevel: organization`), but the reusable workflows that apply it cannot run until it is set, so set it by hand once when making this repository private.

## <a id="releases"></a>Releases and changelogs

`templates/` has no release configuration yet: each repository keeps its own Nx release setup.
The house default, which [smartcloud](https://github.com/Resnovas/smartcloud/blob/main/docs/releasing.mdx) follows, is:

- **Nx release, started by hand** from a `release` workflow on the default branch, with conventional commits deciding the version.
  The published projects form one release group, tagged `v{version}`.
- **The GitHub release holds the main notes**: `release.changelog.workspaceChangelog` sets `createRelease: github`, with a renderer that replaces Nx's emoji with words (smartcloud's `tools/release/changelog-renderer.ts`).
- **The notes are also written to the repository**, through the same renderer: the workspace changelog to the root `CHANGELOG.md` (new releases above any older history, which stays), and `projectChangelogs` to `{projectRoot}/CHANGELOG.md` for each published project, with `createRelease: false`.
  Unpublished libraries get none; their changes appear under the projects that bundle them.
- **The files reach the default branch through a pull request**, because the house ruleset takes changes only through pull requests with signed commits; the pull request merges like any other, by squash or rebase, or by auto-merge where it is on.
  After tagging, a separate `changelogs` job mints a token for the Resnovas Bot app (`resnovas-smartcloud`, from the organisation variable `RESNOVAS_BOT_APP_ID` and secret `RESNOVAS_BOT_PRIVATE_KEY`, with `actions/create-github-app-token` pinned to a commit), commits the files through the GitHub API, so GitHub signs the commit, and opens `chore(release): changelogs for v<version>`.
  The commit is signed off by `resnovas-smartcloud[bot]`, which the preset lists in `roles.trustedBots`.
- **The app's token never meets untrusted code**: the job that mints it checks out and runs nothing from the repository, and the job that installs dependencies and runs Nx hands it the files as an artifact.

When smartcloud's sync manages Nx release configuration ([SMC-81](https://linear.app/resnovas/issue/SMC-81)), it should sync:

- `nx.json`'s `release.changelog` (both changelog settings and the renderer path) and `release.conventionalCommits`, in a managed block, leaving `release.groups` local, since each repository lists its own published projects;
- the changelog renderer, as `tools/release/changelog-renderer.ts`;
- the release workflow's `changelogs` job, as a managed job.
