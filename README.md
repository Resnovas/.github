# <a id="top"></a>Resnovas house repository

The single source of truth for the governance files every Resnovas project ships with, across Resnovas, Eventiva, Climb and personal repositories.
It holds the contributing guidelines, the AI contribution policy, the code of conduct, the Developer Certificate of Origin, the FCL-1.0-MIT licence, the Eventiva Cooperation Commitment, and the issue and pull request templates, together with the checks that enforce them.

Because this repository is public and named `.github`, GitHub also uses these files as the defaults for every repository in the Resnovas organisation that does not have its own.

## <a id="layout"></a>Layout

| Path | What it is |
| --- | --- |
| `templates/` | The source of every governed file, with `{{KEY}}` placeholders. **Edit files here, never the rendered copies.** |
| `house.yml` | The values placeholders resolve to. Everything currently resolves to Resnovas. |
| root and `.github/` | The files rendered from `templates/` with the default values. CI fails if they are out of date. |
| `.github/workflows/policy.yml` | Reusable workflow: AI disclosure, co-author and sign-off trailers, title and style (`policy`), and maintainer approvals (`reviews`). |
| `.github/workflows/sync.yml` | Reusable workflow: renders `templates/` into a repository and opens a pull request when anything changed, then applies the house repository settings. |
| `scripts/lib/settings.mjs` | The house repository settings, as the API calls that apply them. |
| `scripts/` | The renderer and the policy checker. Dependency-free Node, with the rules in `scripts/lib/policy.mjs`. |
| `test/` | Tests for the rules and the renderer, run with `npm test`. |

## <a id="managed-blocks"></a>Documents and extendable configuration

Documents (the root Markdown documents and `LICENSE`) are synced whole.

Configuration files are extendable: each template wraps its synced content in `house:managed:begin` and `house:managed:end`, and marks where a repository's own rules go with `house:local`.
The sync replaces only the managed block and keeps everything else, so a repository can add Dependabot updates, code owners, issue form fields, contact links, funding platforms, pull request template sections or workflow jobs without losing them.

Local rules can extend the synced ones but not change them.
The policy check fails a pull request that edits a managed block or a synced document, and flags local rules that would redefine a synced one: a duplicate Dependabot update, a redefined top-level YAML key, a reused issue form field id, or a redefined job.
In `CODEOWNERS` the managed block comes last, because the last matching rule wins.

When a repository first adopts a file it already had, its previous content is kept, commented out at the `house:local` line, for someone to re-add as local rules.
Making a template extendable only needs the three marker lines; `scripts/lib/managed.mjs` handles the rest.

## <a id="changing"></a>Changing a policy or template

1. Edit the file under `templates/`, or a default in `house.yml`.
1. Run `npm run render` to update the rendered copies, and `npm test`.
1. Commit both.
Every downstream repository picks the change up in its next sync pull request.

## <a id="adopting"></a>Adopting it in a repository

1. Copy `.github/workflows/house-policy.yml` and `.github/workflows/house-sync.yml` into the repository, or let the first sync add them.
1. Only if the repository needs different values, add `.github/house.yml` containing just the keys it changes:

```yaml
MAINTAINERS: TGTGamer, another-maintainer
HOUSE_EXCLUDE: LICENSE
```
1. Make sure the organisation has the `HOUSE_SYNC_APP_ID` and `HOUSE_SYNC_APP_PRIVATE_KEY` secrets (see [The sync app](#sync-app)).
1. Run the House sync workflow once by hand to open the first sync pull request.
1. Once the repository has two or more maintainers, make `house-policy / policy` and `house-policy / reviews` required status checks on the default branch.

## <a id="values"></a>Values

| Key | Used for |
| --- | --- |
| `ORG_NAME` | The owner's name in prose. |
| `LEGAL_HOLDER` | The copyright holder in `LICENSE`. |
| `COPYRIGHT_YEAR` | The year in the copyright notice. |
| `REPOSITORY` | Links to the repository's own advisories, discussions and files. Set automatically by the sync. |
| `PACKAGE_SCOPE` | The npm scope in the module boundary rule. |
| `CONDUCT_CONTACT` | Where Code of Conduct reports go. |
| `COVERAGE_MIN` | The minimum line and branch coverage. |
| `MAINTAINERS` | Who counts as a maintainer for the checks and the review gate. |
| `TRUSTED_BOTS` | Automation accounts that skip the disclosure and DCO checks. |
| `HOUSE_EXCLUDE` | Template paths a repository keeps its own copy of. For configuration, prefer local rules outside the managed block; exclusion is for a file the repository genuinely cannot share, such as a different licence. |
| `PROJECT_TYPE` | `saas`, `desktop`, `library` or `none`; picks the deployment environments. |
| `ENVIRONMENTS` | Explicit environment names, replacing the `PROJECT_TYPE` set. |
| `CODE_SCANNING_GATE` | Whether serious CodeQL findings block merges. Turn off only where CodeQL cannot analyse the code. |
| `SPONSORS` | GitHub Sponsors accounts in `FUNDING.yml`. |
| `OWNERS_ADMIN`, `OWNERS_DOCS`, `OWNERS_QA`, `OWNERS_WORKFLOW` | Code owners by role, in `CODEOWNERS`. |

## <a id="settings"></a>Repository settings

The sync's `settings` job applies the baseline in [the governance document](GOVERNANCE.md#settings) every week, so a setting changed by hand drifts back.
Preview what it would change for any repository you can read:

```shell
GITHUB_TOKEN=$(gh auth token) node scripts/apply-settings.mjs --repository owner/name --dry-run
```

Settings that no API exposes, and so are set by hand once per repository:

- Settings > General > Pushes: **Limit how many branches and tags can be updated in a single push** to 5.

Settings best made once at organisation level:

- Settings > Advanced Security > Configurations: a code security configuration with every feature enabled, applied to all repositories and set as the default for new ones.
This covers private repositories the per-repository settings cannot, where the licence allows.
- Settings > Advanced Security > Global settings: Dependabot on Actions runners, and Copilot Autofix for third-party tools.

## <a id="sync-app"></a>The sync app

`sync.yml` authenticates as a GitHub App rather than with a personal access token.
The default `GITHUB_TOKEN` cannot push changes to workflow files, and an App token is minted fresh for each run and expires on its own, so no long-lived credential is stored.

The App needs **Administration**, **Contents**, **Pull requests** and **Workflows** write access on the repositories it syncs; Administration is what lets it apply the repository settings.
Install it on every organisation and account that adopts the house files, and set its ID and private key as the organisation secrets `HOUSE_SYNC_APP_ID` and `HOUSE_SYNC_APP_PRIVATE_KEY`.
Add the App's bot login, for example `resnovas-house[bot]`, to `TRUSTED_BOTS` so its sync pull requests are not held to the contributor checks.
