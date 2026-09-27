# Getting started

This page explains the ideas behind the house in plain words, then walks you through bringing a repository under it.
[Back to the README](../README.md)

## <a id="words"></a>The words

| Word | What it means |
| --- | --- |
| **House** | This repository, `Resnovas/.github`. It holds the rules and shared files for every Resnovas repository. |
| **Template** | A file under `templates/` that is copied into every repository. It may contain placeholders. |
| **Placeholder** | A marker such as `{{ORG_NAME}}` in a template. It is replaced with a real value, such as `Resnovas`, when the file is copied. An unknown placeholder stops the copy rather than leaving a blank. |
| **Render** | Turning a template into a finished file: fill the placeholders, then merge with what the repository already has. |
| **Sync** | The weekly job, run in each repository, that renders every template and opens a pull request with the changes. |
| **smartcloud** | The GitHub Action that runs the sync, checks pull requests against the house rules, keeps labels in line and applies repository settings. Its source is [Resnovas/smartcloud](https://github.com/Resnovas/smartcloud). |
| **Preset** | A smartcloud configuration file other configurations build on. The **house preset** is [`smartcloud/house.yml`](../smartcloud/house.yml). Its values are **locked**: a repository can add settings, but not change the preset's. |
| **Managed block** | The part of a synced file between the lines `house:managed:begin` and `house:managed:end`. The sync owns it and rewrites it. |
| **`house:local`** | The line after which a repository adds its own content to a synced file. The sync keeps it. |
| **Ruleset** | GitHub's rules for a branch: who may push, which checks must pass, how many approvals. The house preset writes one for the default branch. |
| **Required check** | A check that must pass before a pull request can merge. The house ruleset requires one: `smartcloud`. |
| **Aggregate check** | A single check that passes only when every other check has. The `smartcloud` check is one, so the ruleset never needs a list of check names. |
| **Merge queue** | GitHub lines up approved pull requests and tests each one on top of the others before merging it, so the default branch never breaks. |
| **Reusable workflow** | A GitHub Actions workflow in this repository that other repositories call with one short file, so the logic lives in one place. |
| **Resnovas Bot** | A GitHub App (`resnovas-smartcloud[bot]`) the house workflows act as. It can do things the normal workflow token cannot, such as changing settings and syncing workflow files. |
| **Restricted run** | A run with only the read-only workflow token, such as a pull request from a fork or from Dependabot. It skips what it cannot do instead of failing. |
| **DCO** | The Developer Certificate of Origin. You agree to it by adding `Signed-off-by: Your Name <you@example.com>` to every commit (`git commit -s`). |

## <a id="how"></a>How it fits together

1. Someone changes a template here and it merges to `main`.
2. Every repository runs its synced `smartcloud` workflow on a schedule (Mondays at 07:00 UTC), on every push to its default branch, and when run by hand.
3. That run reads the house preset, renders every template with the repository's values, and compares the result with the repository's files.
4. If anything differs, it opens (or updates) one pull request from the `house/sync` branch, titled `chore(sync): sync files from Resnovas/.github`, labelled `house-sync`.
5. A maintainer reviews and merges it like any other pull request.

The same workflow checks every pull request against the house rules (conventional title, sign-off, AI disclosure, review count), keeps the labels in line and applies the repository settings.

## <a id="adopting"></a>Adopting a repository

You need: admin access to the repository, the [GitHub CLI](https://cli.github.com/) signed in (`gh auth login`), and Node 24 or newer.
It takes about fifteen minutes plus one review.

### 1. Make sure the Resnovas Bot app can reach the repository

The app is installed on the whole Resnovas organisation, so a new repository is usually covered.
Check in the organisation's Settings > GitHub Apps > Resnovas Bot > Repository access.
The workflows find it through the organisation variable `RESNOVAS_BOT_APP_ID` and the organisation secret `RESNOVAS_BOT_PRIVATE_KEY`; see [Access](access.md).

### 2. Add the two smartcloud files

Copy these two templates into the repository, exactly as they are:

- [`templates/.github/smartcloud.yml`](../templates/.github/smartcloud.yml) to `.github/smartcloud.yml`
- [`templates/.github/workflows/smartcloud.yml`](../templates/.github/workflows/smartcloud.yml) to `.github/workflows/smartcloud.yml`

The first says "use the house preset".
The second runs smartcloud.
Everything else arrives with the first sync.

### 3. Add the repository's own settings

Open `.github/smartcloud.yml`.
Under the `house:local` line, add what the preset leaves to each repository.
A complete example for a library that publishes to npm:

```yaml
# house:managed:begin - synced from Resnovas/.github templates/.github/smartcloud.yml. Edits inside this block are overwritten.
# yaml-language-server: $schema=https://raw.githubusercontent.com/Resnovas/smartcloud/main/schema/smartcloud.schema.json
version: 2
extends:
  - Resnovas/.github/smartcloud/house.yml@main
# house:managed:end
# house:local - add this repository's own configuration below this line.

settings:
  environments:
    projectType: library        # creates a "Release" environment
  ruleset:
    statusChecks:
      checks:
        check: true             # the repository's own CI aggregate job
required:
  expect: ['^check$']           # the smartcloud check waits for it
sync:
  exclude:
    - .github/dependabot.yml    # only if the repository has no package.json
```

Every key you can add is explained in [The house preset](preset.md#unset).
Check the file before you commit it:

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud validate
```

### 4. Give the repository three package scripts

The synced editor tasks and agent actions call `setup`, `check` and `test` with `node --run`, so every repository needs them in `package.json`:

```json
{
  "scripts": {
    "setup": "node tools/dev/surfaces.mjs install",
    "check": "node tools/dev/surfaces.mjs check && node tools/ai-docs/docgen.mjs --check",
    "test": "your test command",
    "ai-docs": "node tools/ai-docs/docgen.mjs",
    "ai-docs:check": "node tools/ai-docs/docgen.mjs --check"
  }
}
```

`check` should run everything CI runs.
The two `ai-docs` scripts come with the [AI docs](ai-docs.md); add them once the first sync has brought in `tools/ai-docs/docgen.mjs`.

### 5. Check the repository

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud doctor --repo owner/name
```

It changes nothing.
It reports whether the token can read the preset, whether the secrets and variables the workflows need exist, and whether anything blocks the reusable workflows.
Use an organisation admin's token, or the secret checks only warn.
Fix every error before going on; see [Troubleshooting](troubleshooting.md).

To see which settings the first run will change:

```shell
GITHUB_TOKEN=$(gh auth token) npx @resnovas/smartcloud plan settings --repo owner/name
```

### 6. Commit, push and run the workflow once

Commit the two files on a branch, open a pull request and merge it.
Then open the repository's **Actions** tab, pick **smartcloud**, and choose **Run workflow**.

What you will see:

- A run of the **smartcloud** workflow. Its job summary lists each feature (sync, settings, labels) and what it changed.
- The repository's settings and default branch ruleset now match the house baseline, and the process labels (`needs-dco`, `needs-disclosure` and the rest) exist.
- A pull request titled **chore(sync): sync files from Resnovas/.github** from the `house/sync` branch, labelled `house-sync`, adding every governance document, configuration file, workflow and tool.

If the repository already had some of these files, its old content is kept, commented out, under the `house:local` line of each one.
Move back anything you still need as local lines, and delete the rest.

### 7. Review and merge the sync pull request

Read it like any other change.
Once it merges, the repository runs every house workflow, and every later sync pull request contains only what changed in the house since.

### 8. Finish the repository's own setup

- **Required checks.** The ruleset requires `smartcloud`, and the default branch merges through a merge queue. Every workflow behind a required check must also run on `merge_group`. A CI with several jobs should end in one aggregate job that needs them all; see [CI standards](ci-standards.md#aggregate).
- **Environments.** A repository that deploys lists its pre-production environment under `settings.ruleset.requiredDeployments`, for example `[Staging]`.
- **Code scanning and coverage.** Add `settings.ruleset.codeScanning.ESLint` once ESLint uploads results to code scanning, and `settings.ruleset.codeCoverage.enabled: true` once coverage is uploaded to GitHub.
- **By hand, once.** Settings > General > Pushes: limit how many branches and tags can be updated in a single push to 5. No API exposes it.
- **Documentation.** Write the repository's own [AI docs](ai-docs.md) sections and people docs.

### The aggregate check and a second maintainer

On every pull request, the `smartcloud` check waits for every other check on the commit and fails if any of them fails, so it is the only check the ruleset needs to require.
List the repository's main CI check under `required.expect` too, so a renamed or deleted CI job cannot let it pass with nothing to wait for, and keep that CI check required beside `smartcloud` in the ruleset: a pull request from a fork or Dependabot runs restricted, so a required CI check keeps it gated whatever smartcloud can do there.

While the preset lists one maintainer, the owner merges at their discretion: no approval is required.
Once it lists two or more, pull requests need approvals: one for a maintainer's own, two for an outside contributor's.
