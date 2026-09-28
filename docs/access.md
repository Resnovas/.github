# Access: the app, secrets and variables

The house workflows need a little more access than GitHub gives a workflow by default.
This page explains what they use, why, and how to set it up once for the organisation.
[Back to the README](../README.md)

## <a id="why"></a>Why a GitHub App

Every workflow run gets a **workflow token** (`github.token`) for free.
It is deliberately weak: it cannot read another private repository, cannot push changes to workflow files (so it cannot sync them), and cannot change repository settings.
Pull requests it opens do not start other workflows either.

So the house workflows act as a GitHub App, **Resnovas Bot** (`resnovas-smartcloud[bot]`), installed on every repository in the organisation.
Each job that needs it creates a short-lived app token with [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token), limited to the repositories it needs.

Advantages over a personal access token: it belongs to no person, its commits are signed by GitHub (so they pass the signed-commits rule without a bypass), and it has its own API rate limit.

## <a id="tokens"></a>Three tokens, each with one job

Think of a token as a key card. smartcloud holds up to three, and uses each only for its own doors, so no run holds a stronger key than it needs.

| Token | Input to smartcloud | Used for | Created when |
| --- | --- | --- | --- |
| **Workflow token** (`github.token`) | `workflowToken` (default) | Everything in the repository itself: check runs, comments, labels, reviews, reading checks. The job's `permissions` decide what it may do. | Always: GitHub creates it. |
| **House token** (read-only) | `houseToken` | Only reading the house preset and the sync templates in `Resnovas/.github`. It has `contents: read` on `.github` and nothing else. | Every run that gets secrets, pull requests included. |
| **App token** (full) | `GITHUB_TOKEN` | Only settings, sync, CODEOWNERS proposals and backports. It reaches the repository the workflow runs in and nothing else. | Only on a push to `main`, the weekly run, a manual run of the default branch, and when a pull request from the repository itself is merged. |

`Resnovas/.github` is public, so any token, even a fork's, can read the preset. The house token is still worth having: no privileged token ever touches `.github`, and its reads count against the app's rate limit rather than the workflow token's.

Why split them? A pull request can change its own copy of the workflow file. If pull request runs held the full app token, and that token reached `Resnovas/.github`, a changed workflow in any repository could write to the house repository. With the split:

- a pull request run holds only the workflow token and the read-only house token;
- the full app token is created only for runs whose workflow file comes from the default branch, or that run a merged pull request's code;
- the full app token never reaches `Resnovas/.github` from another repository, so nothing outside this repository can write here.

### What you will see

- **On a pull request**: checks, the report comment and labels come from `github-actions[bot]`. The job summary has a notice that the run was restricted (it had no app token) and lists settings as skipped; that is expected, as settings only runs on `main`. The house preset is still read and its rules are checked, and the synced-file check (`SYNC`) still runs.
- **On a push to `main`, weekly and by hand**: settings and the sync pull request come from `resnovas-smartcloud[bot]`; checks and labels still come from `github-actions[bot]`.
- **When a pull request from the repository is merged**: a repository that configures backports gets them from `resnovas-smartcloud[bot]`, so CI runs on them. GitHub starts no workflows for a pull request opened with the workflow token, which is why backport needs the app token. By the time the pull request is merged its code is on the default branch, so that run is trusted. Without the app token, the run is restricted and does not push backports with the workflow token (their pull requests would start no CI): nothing is backported and the job summary has a warning saying so.

### Setting it up in a new organisation

The synced `smartcloud.yml` already does this; these are the steps if you adopt the same model elsewhere.

1. Install the app on every repository **and** on the organisation's `.github` repository (see [Setting it up](#setup)).
2. In the smartcloud job, add a step that creates the read-only house token:

   ```yaml
   - name: Mint the read-only house token
     id: house
     if: github.event.pull_request.head.repo.fork != true && github.actor != 'dependabot[bot]'
     continue-on-error: true
     uses: actions/create-github-app-token@v3
     with:
       client-id: ${{ vars.RESNOVAS_BOT_APP_ID }}
       private-key: ${{ secrets.RESNOVAS_BOT_PRIVATE_KEY }}
       owner: Resnovas
       repositories: .github
       permission-contents: read
   ```

3. Add a step that creates the full app token only for push, schedule and manual runs, and for merged pull requests from the repository itself (for backports). Leave out `owner` and `repositories`, so it reaches only the repository itself:

   ```yaml
   - name: Mint the Resnovas Bot token
     id: app
     if: >-
       (
         contains(fromJSON('["push", "schedule", "workflow_dispatch"]'), github.event_name)
         || github.event_name == 'pull_request' && github.event.action == 'closed'
         && github.event.pull_request.merged == true
         && github.event.pull_request.head.repo.full_name == github.repository
       )
       && github.actor != 'dependabot[bot]' && github.event.pull_request.user.login != 'dependabot[bot]'
       && (github.event_name != 'workflow_dispatch' || github.ref_name == github.event.repository.default_branch)
     continue-on-error: true
     uses: actions/create-github-app-token@v3
     with:
       client-id: ${{ vars.RESNOVAS_BOT_APP_ID }}
       private-key: ${{ secrets.RESNOVAS_BOT_PRIVATE_KEY }}
   ```

4. Pass both to smartcloud, keeping the fallback to the workflow token:

   ```yaml
   - uses: resnovas/smartcloud@v2
     with:
       GITHUB_TOKEN: ${{ steps.app.outputs.token || github.token }}
       houseToken: ${{ steps.house.outputs.token }}
       checkRunId: ${{ job.check_run_id }}
   ```

5. Give the job the permissions the workflow token now needs: `contents: write` (so it can turn on auto-merge for the pull requests an `autoMerge` rule allows; use `contents: read` if you have no auto-merge rules), `checks: write`, `issues: write`, `pull-requests: write` and `statuses: read`.

`houseToken` is optional. A smartcloud release that does not know it ignores it with a warning, and a workflow that does not pass it still works: the workflow token then reads the public preset.

### Common problems

| What you see | Why | Fix |
| --- | --- | --- |
| A pull request run warns `access.config-skipped` for the house preset. | No house token could read `Resnovas/.github`. | Check the app is installed on `.github`, the "Mint the read-only house token" step ran (it is skipped for forks and Dependabot, which is expected) and `houseToken` is passed. |
| Settings or sync is skipped on a push or weekly run. | The app token was not minted. | Open the job log: the mint step was skipped (check its `if`) or failed (check the variable, secret and installation). |
| Labels, comments or checks fail as forbidden. | The workflow token lacks a permission. | Grant the job the permissions in step 5. |
| Another workflow no longer starts when smartcloud adds a label. | GitHub starts no workflows for events made with the workflow token. | Trigger that workflow on another event. |

## <a id="setup"></a>Setting it up (once, for the organisation)

1. **Create or install the app.** In the organisation's Settings > Developer settings > GitHub Apps, the app needs these repository permissions, all **Read and write**: Administration, Checks, Contents, Issues, Pull requests and Workflows, plus whatever else the preset's settings manage (Environments, Pages, Webhooks, Variables). Administration is what lets it apply repository settings.
2. **Install it on all repositories** of the organisation (Install App > All repositories), so new repositories are covered.
3. **Save its ID as an organisation variable** named `RESNOVAS_BOT_APP_ID` (Settings > Secrets and variables > Actions > Variables).
4. **Generate a private key** on the app's page and save the whole `.pem` file content as an organisation secret named `RESNOVAS_BOT_PRIVATE_KEY` (same page, Secrets tab). Give it access to all repositories.
5. **If `Resnovas/.github` is ever made private** (it is public today), open its Settings > Actions > General > Access and allow repositories in the organisation. Without it, every repository's call to a reusable workflow here fails before it starts, and Dependabot cannot resolve them. The preset keeps this set (`settings.actions.accessLevel: organization`), but the preset cannot apply it until it works, so set it by hand the first time.

| Name | Kind | Where | Used by |
| --- | --- | --- | --- |
| `RESNOVAS_BOT_APP_ID` | variable | organisation | `smartcloud.yml`, `house-graphify.yml`, release `changelogs` jobs |
| `RESNOVAS_BOT_PRIVATE_KEY` | secret | organisation | the same |
| `ACCESS_TOKEN` | secret | organisation | Legacy. A personal access token used only by the reusable Graphify workflow for callers that have not synced the new `house-graphify.yml`. Remove it once every repository has. |

No other secret is needed.
CodeQL, dependency review, Scorecard, workflow lint and attestations use only the workflow token.

## <a id="scopes"></a>What each workflow's token can reach

| Workflow | Token | Reaches |
| --- | --- | --- |
| `smartcloud.yml` | Workflow token | The repository, for checks, comments, labels and reviews. |
| `smartcloud.yml` | House token | `Resnovas/.github`, read-only (`contents: read`), for the preset and the sync templates. |
| `smartcloud.yml` | App token | The repository only, with the app's full permission set, for settings, sync and CODEOWNERS proposals; minted only on push, schedule and manual runs. |
| `house-graphify.yml` refresh | App token | The repository only, with contents and pull requests write. |
| A release workflow's `changelogs` job | App token | The repository, to commit the changelogs and open their pull request. |
| Everything else | Workflow token | What each job declares, usually `contents: read`. |

## <a id="restricted"></a>Pull requests from forks and Dependabot

GitHub gives these runs a read-only workflow token and no secrets.
No house workflow creates an app token of either kind for them, and no house workflow creates one in a job that runs pull request code.
smartcloud then runs **restricted** instead of failing: it skips the settings and the sync, skips any write the token is refused, and lists everything it skipped in the job summary.
Checks it cannot fully evaluate conclude as neutral with "config left out" in the title, which does not block a merge.

## <a id="doctor"></a>Checking a repository

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud doctor --repo owner/name
```

`doctor` changes nothing. It reports:

- the token's kind and scopes;
- whether the preset, and everything it extends, can be read;
- whether a private repository whose actions or reusable workflows this repository uses allows it (the Actions access above);
- whether every secret and variable the workflows read, such as `RESNOVAS_BOT_PRIVATE_KEY` and `RESNOVAS_BOT_APP_ID`, exists for the repository or the organisation;
- a warning when a workflow passes smartcloud a secret as its token: a personal access token cannot create check runs, so the `smartcloud` check would fail.

Run it with an organisation admin's token, because listing secrets and reading the Actions access need admin rights; with less, those checks warn instead of failing.

## <a id="by-hand"></a>Settings no workflow can apply

Once per repository:

- Settings > General > Pushes: **Limit how many branches and tags can be updated in a single push** to 5. No API exposes it, so every smartcloud settings run reminds you with a notice.

Once for the organisation:

- Settings > Advanced Security > Configurations: a code security configuration with every feature on **except CodeQL default setup**, applied to all repositories and set as the default for new ones. It covers private repositories the per-repository settings cannot. CodeQL default setup must stay unset or off, because the house runs CodeQL itself.
- Settings > Advanced Security > Global settings: Dependabot on Actions runners, and Copilot Autofix for third-party tools.
- The review bots' dashboard settings; see [Synced files](synced-files.md#review-bots).
