# Access: the app, secrets and variables

The house workflows need a little more access than GitHub gives a workflow by default.
This page explains what they use, why, and how to set it up once for the organisation.
[Back to the README](../README.md)

## <a id="why"></a>Why a GitHub App

Every workflow run gets a **workflow token** (`github.token`) for free.
It is deliberately weak: it cannot read another private repository (so it cannot read the house preset), cannot push changes to workflow files (so it cannot sync them), and cannot change repository settings.
Pull requests it opens do not start other workflows either.

So the house workflows act as a GitHub App, **Resnovas Bot** (`resnovas-smartcloud[bot]`), installed on every repository in the organisation.
Each job that needs it creates a short-lived app token with [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token), limited to the repositories it needs.

Advantages over a personal access token: it belongs to no person, its commits are signed by GitHub (so they pass the signed-commits rule without a bypass), and it has its own API rate limit.

## <a id="setup"></a>Setting it up (once, for the organisation)

1. **Create or install the app.** In the organisation's Settings > Developer settings > GitHub Apps, the app needs these repository permissions, all **Read and write**: Administration, Checks, Contents, Issues, Pull requests and Workflows, plus whatever else the preset's settings manage (Environments, Pages, Webhooks, Variables). Administration is what lets it apply repository settings.
2. **Install it on all repositories** of the organisation (Install App > All repositories), so new repositories are covered.
3. **Save its ID as an organisation variable** named `RESNOVAS_BOT_APP_ID` (Settings > Secrets and variables > Actions > Variables).
4. **Generate a private key** on the app's page and save the whole `.pem` file content as an organisation secret named `RESNOVAS_BOT_PRIVATE_KEY` (same page, Secrets tab). Give it access to all repositories.
5. **If `Resnovas/.github` is private**, open its Settings > Actions > General > Access and allow repositories in the organisation. Without it, every repository's call to a reusable workflow here fails before it starts, and Dependabot cannot resolve them. The preset keeps this set (`settings.actions.accessLevel: organization`), but the preset cannot apply it until it works, so set it by hand the first time.

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
| `smartcloud.yml` | App token | The repository and `Resnovas/.github`, with the app's full permission set (settings, sync, labels and checks need it between them). |
| `house-graphify.yml` refresh | App token | The repository only, with contents and pull requests write. |
| A release workflow's `changelogs` job | App token | The repository, to commit the changelogs and open their pull request. |
| Everything else | Workflow token | What each job declares, usually `contents: read`. |

## <a id="restricted"></a>Pull requests from forks and Dependabot

GitHub gives these runs a read-only workflow token and no secrets.
No house workflow creates an app token for them, and no house workflow creates one in a job that runs pull request code.
smartcloud then runs **restricted** instead of failing: it skips the private preset, the settings and the sync, skips any write the token is refused, and lists everything it skipped in the job summary.
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
