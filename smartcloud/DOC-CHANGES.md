# Documentation changes for the smartcloud migration

`README.md` has uncommitted edits by someone else, so its changes are listed here as exact replacements to apply once those edits land.
`GOVERNANCE.md`, `templates/GOVERNANCE.md` and `REVIEW-NOTES.md` were edited directly; their changes are summarised at the end.
`COOPERATION_COMMITMENT.md` and `templates/COOPERATION_COMMITMENT.md` need no change.

The policy checker and settings applier are deleted now that the gaps in `smartcloud/PARITY.md` are closed. The renderer stays, because this repository renders its own root from `templates/` and smartcloud's sync check skips the source repository.

## README.md

### First paragraph, second sentence

Replace:

```markdown
It holds the contributing guidelines, the AI contribution policy, the code of conduct, the Developer Certificate of Origin, the FCL-1.0-MIT licence, the  Cooperation Commitment, and the issue and pull request templates, together with the checks that enforce them.
```

With:

```markdown
It holds the contributing guidelines, the AI contribution policy, the code of conduct, the Developer Certificate of Origin, the FCL-1.0-MIT licence, the Cooperation Commitment, and the issue and pull request templates, together with the [smartcloud](https://github.com/Resnovas/smartcloud) preset that enforces them.
This repository is configuration and templates only; smartcloud is the engine.
```

### Layout table

Replace the rows for `house.yml`, `.github/workflows/policy.yml`, `.github/workflows/sync.yml`, `scripts/lib/settings.mjs`, `scripts/` and `test/` with:

```markdown
| `smartcloud/house.yml` | The house preset: roles, policy links, process labels, title and style conventions, DCO and AI attribution, disclosure, the review gate, the repository settings baseline, and the sync of `templates/` with its values. Every repository extends it. |
| `smartcloud/PARITY.md` | How each check the old scripts made maps to a smartcloud test, and how each gap was closed. |
| `.github/smartcloud.yml` | This repository's own config. It extends the preset like every other repository. |
| `.github/workflows/smartcloud.yml` | Runs smartcloud on pull requests, reviews, issues, pushes to `main`, a weekly schedule and by hand. |
| `house.yml` | The flat values the renderer reads for this repository's own root. Downstream repositories get the same values through the preset's `sync.values`. |
| `scripts/`, `test/` | The renderer that keeps this repository's root in step with `templates/` (`npm run check`), and its tests. Downstream repositories are synced by smartcloud. |
```

### Documents and extendable configuration

Replace:

```markdown
Local rules can extend the synced ones but not change them.
The policy check fails a pull request that edits a managed block or a synced document, and flags local rules that would redefine a synced one: a duplicate Dependabot update, a redefined top-level YAML key, a reused issue form field id, or a redefined job.
```

With:

```markdown
Local rules can extend the synced ones but not change them.
smartcloud's sync check fails a pull request that edits a managed block or a synced document, and flags local rules that would redefine a synced one: a duplicate Dependabot update, a redefined top-level YAML key, a reused issue form field id, or a redefined job.
```

Replace:

```markdown
Making a template extendable only needs the three marker lines; `scripts/lib/managed.mjs` handles the rest.
```

With:

```markdown
Making a template extendable only needs the three marker lines; smartcloud's sync feature handles the rest.
```

### Changing a policy or template

Replace the whole numbered list with:

```markdown
1. Edit the file under `templates/`, or a rule or value in `smartcloud/house.yml`.
1. Check the preset with `smartcloud validate smartcloud/house.yml`.
1. Commit the change.
On the next push to `main`, smartcloud syncs this repository's own root, and every downstream repository picks the change up in its next weekly sync pull request.
```

### Adopting it in a repository

Replace the whole numbered list, including the `house.yml` example, with:

````markdown
1. Copy `.github/workflows/smartcloud.yml` and `.github/smartcloud.yml` into the repository, or let the first sync add them.
1. Add what the repository needs below the `house:local` line of `.github/smartcloud.yml`. Anything the preset leaves unset can be added; nothing it sets can be changed:

```yaml
settings:
  environments:
    projectType: saas
sync:
  source: Resnovas/.github/templates@main
  exclude: [LICENSE]
```
1. Make sure the organisation has the `HOUSE_SYNC_APP_ID` and `HOUSE_SYNC_APP_PRIVATE_KEY` secrets (see [The sync app](#sync-app)).
1. Run the smartcloud workflow once by hand to apply the settings and open the first sync pull request.
1. Delete `.github/workflows/house-policy.yml` and `.github/workflows/house-sync.yml` if an earlier sync added them. The sync never deletes files, and the reusable workflows they call no longer exist.

Once the preset lists two or more maintainers, the house ruleset makes the `smartcloud` check required on the default branch; nothing needs setting by hand.
````

### Values

Replace the introduction and table with:

```markdown
Template values are `sync.values` in `smartcloud/house.yml`. Because presets are locked, a repository can add a value the preset does not set but cannot change one it does; a repository that needs a different `LICENSE` or `CODEOWNERS` excludes the file and keeps its own copy.

| Old `house.yml` key | Now |
| --- | --- |
| `ORG_NAME`, `LEGAL_HOLDER`, `COPYRIGHT_YEAR`, `PACKAGE_SCOPE`, `CONDUCT_CONTACT`, `COVERAGE_MIN`, `SPONSORS`, `OWNERS_ADMIN`, `OWNERS_DOCS`, `OWNERS_QA`, `OWNERS_WORKFLOW` | `sync.values` in the preset. |
| `REPOSITORY` | Supplied by smartcloud from the repository being synced. |
| `MAINTAINERS` | `roles.maintainers` in the preset. |
| `TRUSTED_BOTS` | `roles.trustedBots` in the preset. |
| `HOUSE_EXCLUDE` | `sync.exclude` in the repository's `.github/smartcloud.yml`. |
| `PROJECT_TYPE`, `ENVIRONMENTS` | `settings.environments.projectType` or `settings.environments.names` in the repository's `.github/smartcloud.yml`. |
| `CODE_SCANNING_GATE` | `settings.ruleset.codeScanningGate` in the preset, locked on. |
```

### Repository settings

Replace:

````markdown
The sync's `settings` job applies the baseline in [the governance document](GOVERNANCE.md#settings) every week, so a setting changed by hand drifts back.
Preview what it would change for any repository you can read:

```shell
GITHUB_TOKEN=$(gh auth token) node scripts/apply-settings.mjs --repository owner/name --dry-run
```
````

With:

```markdown
smartcloud's settings feature applies the baseline in [the governance document](GOVERNANCE.md#settings) on every push to `main` and every week, so a setting changed by hand drifts back.
Preview what it would change for any repository you can read, without changing anything:

```shell
npx @resnovas/smartcloud plan settings --repo owner/name
```
```

### The sync app

Replace:

```markdown
`sync.yml` authenticates as a GitHub App rather than with a personal access token.
```

With:

```markdown
The smartcloud workflow authenticates as a GitHub App on pushes, the schedule and manual runs, rather than with a personal access token. Pull request and issue events use the workflow token, so pull requests from forks never see the App.
```

Replace:

```markdown
The App needs **Administration**, **Contents**, **Pull requests** and **Workflows** write access on the repositories it syncs; Administration is what lets it apply the repository settings.
```

With:

```markdown
The App needs **Administration**, **Checks**, **Contents**, **Issues**, **Pull requests** and **Workflows** write access on the repositories it syncs. Administration applies the repository settings, Issues manages the labels, and Checks reports each feature's result.
```

Replace:

```markdown
Add the App's bot login, for example `resnovas-house[bot]`, to `TRUSTED_BOTS` so its sync pull requests are not held to the contributor checks.
```

With:

```markdown
Add the App's bot login, for example `resnovas-house[bot]`, to `roles.trustedBots` in `smartcloud/house.yml`, and to the bot pattern of the title and style conventions there, so its sync pull requests are not held to the contributor checks.
```

## Edited directly

- `GOVERNANCE.md` and `templates/GOVERNANCE.md`: maintainers now come from `roles.maintainers` in the preset; the review enforcement names smartcloud and the `smartcloud` check instead of `house-policy / policy` and `house-policy / reviews`; settings are applied by smartcloud; `.github/smartcloud.yml` and the smartcloud workflow are listed as extendable configuration; exclusions use `sync.exclude`.
- `REVIEW-NOTES.md`: the Review, Values and Settings decisions, a new Engine decision, the locked `COPYRIGHT_YEAR` consequence, `sync.exclude` for Dependabot, the App's extra Checks and Issues permissions, and a step to delete the old synced workflows.
- `templates/.github/CODEOWNERS` and `.github/CODEOWNERS`: `/.github/smartcloud.yml` is owned by the admin role in place of `/.github/house.yml`.
- `templates/.github/dependabot.yml` and `.github/dependabot.yml`: the exclusion comment names `sync.exclude`.
