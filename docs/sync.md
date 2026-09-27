# The sync

The sync is how house files reach a repository and stay current.
This page explains what it does, how to keep your own lines in a synced file, how to skip a file, and where the values come from.
[Back to the README](../README.md)

## <a id="what"></a>What it does

Each repository's synced `smartcloud` workflow runs the sync:

- every Monday at 07:00 UTC,
- on every push to the default branch,
- and whenever someone runs the workflow by hand (Actions > smartcloud > Run workflow).

Each time, smartcloud:

1. reads `sync` from the [house preset](preset.md#sync): the templates come from `Resnovas/.github/templates@main`;
2. fills every placeholder in every template with the repository's [values](#values);
3. merges each result with the repository's current file, keeping local lines (see [Managed blocks](#managed-blocks));
4. opens, or updates, one pull request from the `house/sync` branch with everything that changed.

What you will see: a pull request titled `chore(sync): sync files from Resnovas/.github`, labelled `house-sync`, by `resnovas-smartcloud[bot]`.
Its commits are signed by GitHub and signed off by the bot, so they pass the signed-commits rule.
If nothing changed, there is no pull request.
The `house/sync` branch is force-updated on every run, so never push your own work to it.

The sync needs the Resnovas Bot app token (see [Access](access.md)).
A run without it, such as one from a fork or Dependabot, skips the sync and says so in its job summary.

## <a id="managed-blocks"></a>Keeping your own lines: managed blocks

Most configuration files, and `AGENTS.md`, `CLAUDE.md` and `APPROVAL_POLICY.md`, are **extendable**.
They look like this:

```yaml
# house:managed:begin - synced from Resnovas/.github templates/.github/dependabot.yml. Edits inside this block are overwritten.
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    ...
# house:managed:end
# house:local - add further updates below, as list items under updates.
  - package-ecosystem: pip
    directory: /api
    schedule:
      interval: weekly
```

- Everything between `house:managed:begin` and `house:managed:end` belongs to the house. The sync replaces it every time.
- Everything else belongs to the repository. The sync never touches it.
- The `house:local` line shows where your own lines go. Its comment says what fits there.

A marker only counts on a comment line: `#` in YAML, TOML and CODEOWNERS, `//` in JSON with comments (the editor files), `<!--` in Markdown.
In `CODEOWNERS` the managed block comes **last**, and your lines go above it, because the last matching line wins and the house owners must always apply.

Files without markers (the governance documents, the tools, the prompts) are synced **whole**.

### <a id="adoption"></a>The first sync of a file you already had

If a repository already had, say, a `.github/dependabot.yml`, the first sync does not throw it away.
It writes the house version and puts your old content under the `house:local` line, commented out, with this note:

```yaml
# Previous content of this file, kept when it was first synced. Re-add what is still needed as local rules, then delete this.
```

Uncomment what you still need, remove what the house now covers, and delete the note.

### <a id="conflicts"></a>Local lines may add, never change

Your lines can extend the house rules but not override them.
The sync warns, and the `smartcloud` check fails a pull request, when a local line would redefine a synced one:

| File | Not allowed locally |
| --- | --- |
| Any YAML file | A top-level key the managed block already sets. |
| Issue forms | A field `id` a synced field uses. |
| Workflows | A job with the name of a synced job. |
| `dependabot.yml` | An update for the same ecosystem, directory and target branch as a synced one. |
| TOML (`.pr_agent.toml`, `environment.toml`) | A table the managed block defines. |
| JSON with comments (editor files, surfaces) | An entry with a synced `label`, `name` or `id`. |
| `CODEOWNERS` | Any rule after the managed block. |

## <a id="edit-check"></a>The edit check

On every pull request, smartcloud checks synced content (the preset sets `sync.check: true`).
It reports, under the rule id `SYNC`:

- an edit to a whole-file synced document or tool,
- an edit inside a managed block,
- removed markers,
- a deleted synced file,
- a local line that redefines a synced one (see above).

For a contributor it is an error, which fails the `smartcloud` check.
For a maintainer or the owner it is a warning.
Bringing a file in line with the latest templates is always allowed, which is how the sync pull request itself passes.
To change synced content, change it here, in `templates/`.

## <a id="exclude"></a>Skipping a file

A repository that genuinely needs its own version of a file lists it under `sync.exclude` in its `.github/smartcloud.yml`, after the `house:local` line:

```yaml
sync:
  exclude:
    - LICENSE                    # a dependency requires a different licence
    - .github/dependabot.yml     # no package.json, so the npm update would fail
    - .github/zizmor.yml         # needs audit rules of its own
```

Paths are template paths, the same as the file's path in the repository.
An excluded file is neither rendered nor synced, and the edit check ignores it.
Prefer local lines where the file is extendable: excluding means you stop getting house changes to that file.
A maintainer must approve an exclusion.

## <a id="values"></a>Values

A placeholder such as `{{ORG_NAME}}` in a template is filled from the values.
For other repositories they come from `sync.values` in [`smartcloud/house.yml`](../smartcloud/house.yml), and `REPOSITORY` is the repository the sync runs in.
This repository renders its own root from [`house.yml`](../house.yml) instead, because smartcloud's sync skips the repository it syncs from.

| Key | Used for | House value |
| --- | --- | --- |
| `ORG_NAME` | The owner's name in prose. | `Resnovas` |
| `LEGAL_HOLDER` | The copyright holder in `LICENSE`. | `Jonathan Stevens trading as Resnovas` |
| `COPYRIGHT_YEAR` | The year in the copyright notice. | `2026` |
| `REPOSITORY` | Links to the repository's own advisories, discussions and files. Set automatically. | the repository's `owner/name` |
| `PACKAGE_SCOPE` | The npm scope in the module boundary rules. | `@resnovas` |
| `CONDUCT_CONTACT` | Where Code of Conduct reports go. | `hello@resnovas.com` |
| `COVERAGE_MIN` | The minimum line and branch coverage, in percent. | `90` |
| `SPONSORS` | GitHub Sponsors accounts in `FUNDING.yml`. | `TGTGamer` |
| `OWNERS_ADMIN`, `OWNERS_DOCS`, `OWNERS_QA`, `OWNERS_WORKFLOW` | Code owners by role in `CODEOWNERS`. Each is a `@user` or `@org/team`; separate several with spaces. | `@TGTGamer` |
| `MAINTAINERS` | The maintainers named in `GOVERNANCE.md`, `CONTRIBUTING.md` and the comment in `.github/smartcloud.yml`. GitHub logins, comma separated. | `TGTGamer` |
| `TRUSTED_BOTS` | The automation accounts named as exempt in `GOVERNANCE.md`, `DCO.md`, `AI_POLICY.md`, `APPROVAL_POLICY.md` and `CONTRIBUTING.md`. Comma separated. | `dependabot[bot], renovate[bot], github-actions[bot], resnovas-smartcloud[bot]` |
| `CODE_SCANNING_GATE` | Whether `GOVERNANCE.md` says merges are blocked on CodeQL findings. `true` or `false`. | `true` |

A value is fixed by the preset, so a repository cannot change it; a repository that needs a different licence holder, for example, excludes `LICENSE` and keeps its own.
A template that uses a placeholder with no value fails the sync, so a new placeholder needs its value in the preset in the same change.
A placeholder may carry a default, written `{{KEY:-default}}`: it becomes the default when no value is set, and the value when one is. Use it for a value each repository may set for itself but need not; a plain `{{KEY}}` must always have a value.

### <a id="values-and-settings"></a>Values that describe a setting

`MAINTAINERS`, `TRUSTED_BOTS` and `CODE_SCANNING_GATE` only put words in the documents.
What smartcloud actually enforces comes from the preset's own settings: `roles.maintainers`, `roles.trustedBots`, and the CodeQL entry under `settings.ruleset.codeScanning`.
So the two must say the same thing, and a test in this repository (`test/values.test.mjs`) fails if they do not.
It also checks the pull request title rules, which list the same people in their patterns.
To add a maintainer or a trusted bot, change all of them in one pull request: `roles`, the title patterns under `conventions`, `sync.values` in [`smartcloud/house.yml`](../smartcloud/house.yml), and [`house.yml`](../house.yml).

Why not let the synced `.github/smartcloud.yml` set `roles` from the values?
Two reasons.
A local line may not reuse a top-level key the managed block sets, so a managed `settings` or `roles` would stop every repository adding its own.
And a repository's file only changes when it merges the sync pull request: if the preset's maintainers changed first, the old copy in its file would count as changing a locked value, and its runs would fail until the sync merged.
The managed block shows the three values in a comment instead.

### <a id="environments"></a>Project type and environments: per repository

What a repository ships (its project type) and which environments it deploys to differ for every repository, so the preset does not set them: a value in the preset's `sync.values` is locked for everyone.

- **`PROJECT_TYPE`** (`saas`, `desktop`, `library` or `none`) and **`ENVIRONMENTS`** (explicit names, comma separated) are optional values. A repository sets them in its own `.github/smartcloud.yml`, after the `house:local` line, and the synced documents describe it. The templates write them with defaults, `{{PROJECT_TYPE:-none}}` and `{{ENVIRONMENTS:-that its project type implies}}`, so a repository that sets neither still syncs.
- The environments themselves are created from `settings.environments`, which the repository sets in the same file.

```yaml
sync:
  values:
    PROJECT_TYPE: library
settings:
  environments:
    projectType: library    # or saas, desktop; or names: [Production, Preview]
```

See [What a repository adds](preset.md#unset) for what each project type creates.

### <a id="values-root"></a>This repository's own values

`house.yml` holds the same keys and values as `sync.values`, plus two for this repository alone: `REPOSITORY` (`Resnovas/.github`), and `HOUSE_EXCLUDE`, the renderer's equivalent of `sync.exclude`.
The same test fails if `house.yml` and `sync.values` differ in any other key.

## <a id="preview"></a>Seeing what a repository will get

From a clone of this repository:

```shell
node scripts/render.mjs --out .render-preview --repository Resnovas/example
```

`.render-preview/` then holds every file as `Resnovas/example` would get it, with this repository's `house.yml` values.
Pass `--override path/to/values.yml` to layer other values over them.
Add `--check` to write nothing and exit with an error listing every file that would change.

## <a id="source"></a>In this repository

smartcloud's sync does not run in `Resnovas/.github` itself, and its edit check does not apply here, because changing the templates is the point of this repository.
Instead, `npm run render` renders `templates/` into the root with `house.yml`, and CI's `rendered` job fails when a rendered copy is out of date.
See [Changing the house](../README.md#changing).
