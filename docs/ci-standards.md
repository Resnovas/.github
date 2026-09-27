# CI standards

How a Resnovas repository's own CI should be built.
Nothing here is synced, because every repository's CI differs; these are the rules each one follows, with smartcloud as the worked example.
[Back to the README](../README.md)

## <a id="workflow-rules"></a>Rules for every workflow

`npm test` in this repository checks every workflow here and under `templates/` against these rules, and a repository's own workflows follow them too.

- **Pin third-party actions to a commit.** Write `uses: actions/checkout@<full sha> # v7.0.1`: the full commit SHA, then the release as a comment. A tag can be moved to point at other code; a SHA cannot. Dependabot's `github-actions` update moves the SHA and the comment together. Only first-party references follow a ref: the local action (`uses: ./`), the reusable workflows here (`@main`) and `resnovas/smartcloud` (its major tag). Use one SHA per action everywhere.
- **Grant nothing by default.** Set `permissions: {}` at the top of the workflow and give each job only the scopes it uses, so a job added later starts with no access. Never `read-all` or `write-all`. A job that calls a reusable workflow grants no more than the called jobs need.
- **Set a timeout.** Every job that runs steps sets `timeout-minutes`, a few times its usual run, so a stuck step fails in minutes instead of holding a runner for GitHub's six-hour default. A job that calls a reusable workflow cannot set one; the called jobs do.
- **Run in the merge queue.** A workflow that checks pull requests also runs on `merge_group`, because the default branch merges through a queue that waits for the required checks.
- **Never filter pull requests by path.** A workflow filtered with `paths` or `paths-ignore` never starts for a change outside the filter, so a required check it reports waits forever. Skip jobs instead (below).
- **Keep untrusted text out of scripts.** Titles, branch names and comment text reach `run:` only through `env:`, never as `${{ }}` inside the script. `actions/checkout` sets `persist-credentials: false` unless a later step pushes.

## <a id="aggregate"></a>One required check per CI

Require one aggregate job, not a list of jobs.
The aggregate job needs every other job, always runs, and fails unless every one succeeded, so adding a job never changes the ruleset.
This repository's [`ci.yml`](../.github/workflows/ci.yml) shows the pattern:

```yaml
  check:
    name: check
    needs: [test, rendered]
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions: {}
    steps:
      - name: Every job passed
        env:
          RESULTS: ${{ toJSON(needs) }}
        run: |
          failed=$(jq -r 'to_entries[] | select(.value.result != "success") | "\(.key): \(.value.result)"' <<<"$RESULTS")
          if [ -n "$failed" ]; then echo "::error::Not every CI job passed:"; echo "$failed"; exit 1; fi
```

Add it under `settings.ruleset.statusChecks.checks` and `required.expect` in the repository's `.github/smartcloud.yml` (see [Getting started](getting-started.md#adopting)).

### <a id="skipping"></a>Skipping work a change cannot affect

To skip, for example, the build on a documentation-only pull request, skip **jobs**, not workflows.
A first job classifies the changed files; the others run `if:` its outputs say they are needed; and the aggregate job accepts a skipped job only when that output said so, so a failed classifier fails the check.
smartcloud's `tools/ci/changes.ts` classifies with the Graphify graph and `nx show projects --affected`.

In the merge queue, work out what changed from `merge_group.base_sha`, the commit the group lands on, so the group covers the pull requests queued ahead of it as well as its own.
`nrwl/nx-set-shas` otherwise compares with the last green run on the default branch or, with `use-previous-merge-group-commit`, with the entry ahead only, which a `headGreen` queue would let through untested.

## <a id="nx-cache"></a>Caching Nx

A job that runs [Nx](https://nx.dev) caches `.nx/cache` with `actions/cache`, keyed on the runner OS, the lockfile hash, the commit and the workflow, with the OS and lockfile as a restore prefix, so tasks whose inputs did not change replay from the last run.
Nx replays an entry only when the task's input hash matches, and a pull request's cache entries stay on its own ref, so they never reach the default branch.
A release workflow restores no cache and runs Nx with `--skip-nx-cache`, so nothing it publishes comes from a cache entry.

## <a id="matrix"></a>Test matrix

A repository whose code runs on people's machines (a CLI, an action, the synced tools) runs its tests on Linux, macOS and Windows, each with the minimum Node major (`.nvmrc`, currently 24) and the current release (`node-version: current`).
Only the test job needs the matrix; lint, type checks, builds and docs give the same answer everywhere.

- Set `fail-fast: false`, so one failing combination does not cancel and hide the rest.
- Run bash-style steps with `defaults.run.shell: bash` (Windows defaults to PowerShell), and turn off `core.autocrlf` before checkout (Windows otherwise checks text out with CRLF).
- With Nx, give each combination its own cache key and add the Node version and platform to the test target's inputs (`{ "runtime": "node --version" }`, `{ "runtime": "node -p process.platform" }`), so a result from one combination is never replayed on another.
- Keep tests portable: `fileURLToPath`, never `URL.pathname`; `node:path` for paths; no assumed shell, line ending or case-sensitive file system.

## <a id="nightly"></a>Nightly full run

A CI that runs only what a change affects (`nx affected`, or skipped jobs) also runs everything every night, from scratch.
Add a `schedule` at an off-peak minute; on scheduled and manual runs, call `nx run-many` instead of `nx affected`, set `NX_SKIP_NX_CACHE=true` and skip the cache restore.
Put the event in the `concurrency` group (`ci-${{ github.event_name }}-${{ github.ref }}`), so a push does not cancel the nightly run.
This catches what no change sets off: a new Node release, a new runner image, a dependency that changed behaviour.
GitHub runs schedules only on the default branch, never in forks, and emails a failed run to whoever last changed the `cron`.
smartcloud does this with a workflow-level `NX_RUN` (`affected` or `run-many`).

## <a id="flaky"></a>Flaky tests

CI retries a failed test (twice at most); a local run never retries, so a developer still sees a flake.
Report every test that passed only on a retry as a `::warning` annotation on its file and line, and as a table in the job summary.
Set the retry in the shared test configuration keyed on `CI=true`, and never raise it to get a run green.
A flaky test is a bug: fix the test or the code, never skip or delete it.
smartcloud does this in `vitest.shared.ts` with the `tools/ci/flaky-tests.ts` reporter.

## <a id="bundle"></a>Action bundle budgets

A repository that bundles a GitHub Action checks the built entry file against reviewed raw and gzip byte limits kept in version control.
Build first, report the change from the baseline and the remaining budget in the job summary, and fail when either limit is exceeded.
State the compression level and which files count; an intentional increase explains itself and updates the budget in the same pull request.
smartcloud does this with `bundle-size.json` and `pnpm bundle:check` for `dist/index.js` (gzip level 9, 10% headroom at first), in its build job, with only `contents: read`.

## <a id="smoke"></a>Action smoke test

A repository that publishes a JavaScript action runs it end to end in CI as a workflow would: `uses: ./` on the fresh bundle, in dry-run mode, once per recorded event, then checks the job summary it wrote.
Keep the recorded payloads (trimmed to what the action reads) and the expected summary lines in version control, and update them in the same pull request as a change that alters them.
Give the config inline, turn telemetry off and grant only read scopes, so it runs on forks and Dependabot without secrets.
The runner sets `GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH` and `GITHUB_STEP_SUMMARY` for an action over the step's `env`, so point them at the recording from a small preload in `NODE_OPTIONS` (`--import=<preload>`) that fails when its inputs are missing.
Run the check step with `if: ${{ !cancelled() }}` and add the job to the aggregate job's `needs`.
smartcloud does this in its `smoke` job, with everything in `tools/ci/smoke`.
