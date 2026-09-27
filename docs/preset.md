# The house preset

[`smartcloud/house.yml`](../smartcloud/house.yml) is the smartcloud configuration every Resnovas repository builds on.
It decides the pull request rules, the labels, the review count, the repository settings and the sync.
This page explains every section in plain words.
The full reference for each key is in the [smartcloud documentation](https://github.com/Resnovas/smartcloud/tree/main/docs).
[Back to the README](../README.md)

## <a id="how"></a>How a repository uses it

The synced `.github/smartcloud.yml` points at it:

```yaml
version: 2
extends:
  - Resnovas/.github/smartcloud/house.yml@main
```

`@main` means every smartcloud run reads the preset as it is on `main` right now, so a change here applies to every repository on its next run.

The preset is **locked**.
A repository can add settings the preset leaves unset, and may repeat a preset value exactly, but a different value for something the preset sets fails the run.
That is what makes the house rules the same everywhere.

`version: 2` is the smartcloud configuration format version.

## <a id="roles"></a>`roles`: who is who

```yaml
roles:
  maintainers: [TGTGamer]
  trustedBots: ["dependabot[bot]", "renovate[bot]", "github-actions[bot]", "resnovas-smartcloud[bot]"]
```

- **`maintainers`** are the people who approve and merge. Their own pull requests get warnings instead of errors for most house rules. While fewer than two are listed, no approval is required and the owner merges at their discretion.
- **`trustedBots`** are automation accounts. Their pull requests skip the AI disclosure, sign-off and title checks, and the review count.

The synced documents name both lists through the `MAINTAINERS` and `TRUSTED_BOTS` values (see [Values that describe a setting](sync.md#values-and-settings)), and the title rules under `conventions` repeat them.
When you change a list, change all three in the same pull request; `test/values.test.mjs` fails if they disagree.

## <a id="links"></a>`links`: where findings point

```yaml
links:
  policyBase: https://github.com/Resnovas/.github/blob/main
```

Every finding smartcloud reports links to the rule it broke, for example `AI_POLICY.md#ai-02` or `CONTRIBUTING.md#dco`, under this address.

## <a id="labels"></a>`labels`: the process labels

smartcloud keeps these labels in every repository, with the same name, colour and description.
A maintainer adds one to tell a contributor what their pull request still needs.

| Label | Meaning |
| --- | --- |
| `needs-disclosure` | Complete the AI disclosure (AI-01) and co-author trailers (AI-02). |
| `needs-dco` | Sign off every commit. |
| `needs-reproduction` | Provide a reproduction on the production branch with exact steps. |
| `needs-evidence` | Attach the evidence the change requires. |
| `needs-tests` | Add the missing regression or coverage tests. |
| `needs-human-explanation` | Explain the rationale or a material change yourself (AI-04, AI-05). |
| `needs-scope-approval` | Agree the scope or dependency with a maintainer before continuing. |
| `needs-refactor` | Move code to the correct module or package (AI-13). |
| `house-sync` | Put on the sync and code graph pull requests. |

A repository can add its own labels. Labels the preset does not list are left alone, never deleted.

## <a id="conventions"></a>`conventions`: titles and style

Five rules, checked on every pull request (trusted bots are exempt from all five):

| Rule | What it checks | Level |
| --- | --- | --- |
| `title` | The title is a [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/): a type (`feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `style` or `revert`), an optional scope, then `: ` and a summary. Example: `fix(auth): reject expired tokens`. | Error, except for the owner |
| `title-maintainer` | The same check for the owner. | Warning |
| `no-emoji` | No emoji in the title or description. | Warning |
| `no-long-dashes` | No em or en dashes in the title or description. | Warning |
| `checklist-done` | No unticked `- [ ]` checklist items in the description: say what was done instead. | Warning |

Titles matter because the merge queue squashes a pull request into one commit named by its title, and conventional commits drive the changelog and the version number.

## <a id="commits"></a>`commits`: sign-off and AI credit

```yaml
commits:
  dco: true
  aiAttribution: true
  maintainerLevel: warning
```

- **`dco`**: every commit needs a `Signed-off-by` line whose email matches the commit author's. Fix a missing one with `git rebase --signoff main` and a force push.
- **`aiAttribution`**: a commit an AI tool helped with credits it with both a `Co-authored-by` and an `Assisted-by: TOOL:MODEL` line, and no `Signed-off-by` may name an AI tool ([AI-02, AI-03](../AI_POLICY.md#ai-02)).
- **`maintainerLevel: warning`**: on a maintainer's own pull request these are warnings, except an AI sign-off, which is always an error.

## <a id="disclosure"></a>`disclosure`: how AI was used

```yaml
disclosure:
  requireDraft: true
  maintainerLevel: warning
```

The pull request description must fill in `AI level:` (`none`, `autocomplete`, `chat`, `agent` or `autonomous`) and `AI tools:`, and, once the pull request is ready for review, `Accountable human:` (the author) and `Human review:` (what they checked).
The synced pull request template already has these lines.
**`requireDraft`** means a pull request that used AI must be opened as a draft, and leave draft only once the accountable person has reviewed it.
On a maintainer's own pull request the findings are warnings.

## <a id="reviews"></a>`reviews`: how many approvals

```yaml
reviews:
  gate:
    outside: 2
    maintainer: 1
```

A pull request from someone who is not a maintainer needs **two** maintainer approvals; one from a maintainer needs **one** other maintainer's.
Only each maintainer's latest review counts, and the author's own never does.
While fewer than two maintainers are listed, the gate is open.
The separate `smartcloud-review` workflow re-runs the check whenever someone reviews, so it always reads the latest reviews.

## <a id="settings"></a>`settings`: the repository baseline

smartcloud applies these to the repository on every push to the default branch, every week and when run by hand.
A setting changed by hand drifts back on the next run.
See what would change first with:

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud plan settings --repo owner/name
```

### `merging`

| Key | Value | Plain words |
| --- | --- | --- |
| `mergeCommit` | `false` | No merge commits. |
| `squash`, `rebase` | `true` | Pull requests merge by squashing or rebasing. |
| `autoMerge` | `true` | A pull request can be set to merge by itself once it passes. |
| `updateBranch` | `true` | GitHub offers a button to bring a branch up to date. |
| `deleteBranchOnMerge` | `true` | The branch is deleted after merging. |
| `webCommitSignoff` | `true` | Commits made on github.com are signed off automatically. |
| `squashTitle`, `squashMessage` | `PR_TITLE`, `COMMIT_MESSAGES` | A squash uses the pull request title and keeps every commit message, so every `Signed-off-by` and `Co-authored-by` line survives. |

### `features`

The wiki is off, Discussions are on (questions go there, not in issues), and the Sponsor button is on.

### `security`

| Key | Value | Plain words |
| --- | --- | --- |
| `immutableReleases` | `true` | A published release cannot be changed. Create a release as a draft, attach its files, then publish. |
| `privateVulnerabilityReporting` | `true` | People can report a vulnerability privately (public repositories only). |
| `dependabotAlerts`, `dependabotSecurityUpdates` | `true` | Dependabot warns about vulnerable dependencies and opens pull requests to fix them. |
| `codeScanning` | `off` | GitHub's automatic CodeQL setup is off, because the synced `house-codeql.yml` runs CodeQL itself, and GitHub rejects those results while the automatic setup is on. |
| `secretScanning` | `true` | Secret scanning and push protection (public repositories; private ones need a paid licence). |

### `ruleset`: the rules for the default branch

One ruleset, named `house: default branch`, is written in full on every run.

| Key | Plain words |
| --- | --- |
| `blockDeletion`, `blockForcePush` | Nobody can delete the default branch or rewrite its history. |
| `linearHistory` | No merge commits on it. |
| `mergeQueue` (`method: squash`, `grouping: allGreen`) | Every pull request merges through the merge queue, which squashes it into one commit GitHub signs, and every queued entry must pass the required checks. A maintainer's batch pull request (one signed commit per issue) instead lands as an owner fast-forward, so each issue keeps its own commit; see [GOVERNANCE.md](../GOVERNANCE.md#merging). |
| `signedCommits` | Every commit on the branch is signed. GitHub signs squash commits and the bot's commits, but not commits it rewrites with "Rebase and merge", which is why the queue squashes. |
| `pullRequest` | Changes arrive only through pull requests. `requiredApprovals: 1` (only once two maintainers are listed), stale approvals are dismissed on a new push, every conversation must be resolved, a pull request Copilot opens on no one's behalf needs one extra approval, and squash and rebase are the allowed methods. |
| `statusChecks` | The `smartcloud` check is required, the branch must be up to date, and a new branch can be created before checks run. A repository adds its own required checks here. |
| `codeScanning` (`CodeQL`) | A pull request cannot merge with a new CodeQL error or a high or critical security alert. The `CODE_SCANNING_GATE` value (`true`) says so in `GOVERNANCE.md`, and must stay `true` while this is set. |
| `codeQuality: errors` | GitHub Code Quality errors block merging. |
| `codeCoverage` (`minimum: 80`, `maxDrop: 5`) | Line coverage of at least 80% that drops no more than 5 points, enforced only where a repository uploads coverage and sets `enabled: true`. |
| `secretScanningAlerts` | An open secret scanning alert for a known provider's secret blocks merging. |
| `copilotReview` | Copilot reviews every pull request on every push, drafts included. |
| `adminBypass` | The owner can always bypass the ruleset. |

### `actions`

| Key | Value | Plain words |
| --- | --- | --- |
| `workflowPermissions` | `read` | The workflow token is read-only unless a job asks for more. Every house workflow declares what it needs. |
| `createPullRequests` | `true` | The workflow token may open pull requests (the code graph refresh falls back to it). |
| `accessLevel` | `organization` | Other Resnovas repositories may call this repository's reusable workflows while it is private. |

## <a id="required"></a>`required`: one check to require

```yaml
required: {}
```

This turns on smartcloud's aggregate check: on a pull request, the `smartcloud` job waits for every other check on the commit and passes only when they all have.
So the ruleset requires one check, `smartcloud`, and adding a CI job never means editing the ruleset.
It waits up to 60 minutes.
A repository adds `required.expect` (checks that must appear, such as `'^check$'`), `required.ignore` (checks that do not count) and `required.timeout`.

## <a id="sync"></a>`sync`: the house files

```yaml
sync:
  source: Resnovas/.github/templates@main
  branch: house/sync
  check: true
  values: { ORG_NAME: Resnovas, MAINTAINERS: TGTGamer, ... }
```

- **`source`**: where the templates come from.
- **`branch`**: the branch the sync pull request comes from.
- **`check`**: pull requests that edit synced content fail (see [The edit check](sync.md#edit-check)).
- **`values`**: what each placeholder becomes (see [Values](sync.md#values)). Quote a value YAML would read as something other than text, such as `"true"`, `"2026"` or `"@resnovas"`: smartcloud only accepts text values.

## <a id="unset"></a>What a repository adds

The preset leaves these to each repository, in `.github/smartcloud.yml` after the `house:local` line:

| Key | When you need it | Example |
| --- | --- | --- |
| `settings.environments.projectType` | The repository deploys or publishes. Each repository chooses its own, and also sets `PROJECT_TYPE` in its `sync.values` so the synced documents describe it (see [Project type and environments](sync.md#environments)). `saas` creates Production, Staging and Development; `desktop` creates Windows, Linux and macOS with a Beta of each; `library` creates Release; `none` creates nothing. | `projectType: library` |
| `settings.environments.names` | Explicit environment names instead of a project type. | `names: [Production, Preview]` |
| `settings.ruleset.requiredDeployments` | The branch must deploy to a pre-production environment before merging. | `requiredDeployments: [Staging]` |
| `settings.ruleset.statusChecks.checks` | The repository's own required checks, such as its CI aggregate job. | `checks: { check: true }` |
| `settings.ruleset.codeScanning.ESLint` | ESLint uploads results to code scanning. Only add it once it does, or nothing can merge. | `ESLint: { securityAlerts: high_or_higher, alerts: errors }` |
| `settings.ruleset.codeCoverage.enabled` | The repository uploads coverage to GitHub. | `enabled: true` |
| `required.expect` | The aggregate should insist on the main CI check. | `expect: ['^check$']` |
| `required.ignore`, `required.timeout` | A check should not count, or CI takes longer than an hour. | `ignore: ['^codecov/']` |
| `sync.exclude` | The repository keeps its own copy of a template. | see [Skipping a file](sync.md#exclude) |
| `labels`, `conventions.rules`, `reviews.requestApprovals` | Extra labels, title or description rules, or automatic review requests. | see the smartcloud docs |

Check your file with `GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud validate`, or let your editor check it: the first line of the synced file names the JSON Schema.

## <a id="changing"></a>Changing the preset

Edit `smartcloud/house.yml` here and open a pull request.
Remember it applies to every repository on its next run.
A new placeholder value goes in both `sync.values` and `house.yml`, with the same value; `test/values.test.mjs` fails if they differ.
If you change a value a repository restated in its own file, that repository's run fails until it removes or updates the restatement, so search the organisation first.
smartcloud ignores, with a warning, a key it does not know, so a preset written for a newer smartcloud does not break an older one.
