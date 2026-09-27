# Troubleshooting

Common problems with the house, what causes them and how to fix them.
Start with `smartcloud doctor` (see [Access](access.md#doctor)): it finds most setup problems without changing anything.
[Back to the README](../README.md)

## <a id="sync"></a>The sync

| What you see | Why | Fix |
| --- | --- | --- |
| No sync pull request ever appears. | The run had no app token (the app is not installed on the repository, or `RESNOVAS_BOT_APP_ID` or `RESNOVAS_BOT_PRIVATE_KEY` is missing), so it ran restricted and skipped the sync. The job summary says so. | Check the app installation and the organisation variable and secret ([Access](access.md#setup)), then run the smartcloud workflow by hand. |
| No sync pull request, and the run says nothing changed. | The repository is already current. | Nothing to do. |
| The sync fails with `no value for {{KEY}}`. | A template uses a placeholder the preset has no value for. | Add the value under `sync.values` in `smartcloud/house.yml` here. |
| A file you had is now mostly commented out under `house:local`. | The first sync keeps your old content that way instead of deleting it. | Move back what you still need as local lines and delete the rest. See [The sync](sync.md#adoption). |
| A warning such as `redefines the synced key "updates"`. | A local line clashes with the managed block. | Remove or rename the local line. See [Local lines may add, never change](sync.md#conflicts). |
| Your change to a synced file disappeared. | It was inside the managed block, which the sync rewrites. | Put it after `house:local`, or change the template here. |

## <a id="checks"></a>The smartcloud check

| What you see | Why | Fix |
| --- | --- | --- |
| `SYNC` error on a pull request. | The pull request edits a synced document or a managed block. | Undo that edit; change it here in `templates/` instead, or add your lines after `house:local`. |
| `DCO` error. | A commit has no `Signed-off-by` with the author's email. | `git rebase --signoff main`, then force-push the branch. |
| `AI-01`, `AI-02`, `AI-20` or `AI-21`. | The AI disclosure in the description is missing or does not match the commits, or an AI-assisted pull request was not opened as a draft. | Fill in the disclosure lines of the pull request template; see [the preset](preset.md#disclosure). |
| `conventions.title`. | The title is not a conventional commit. | Rename it, for example `fix(auth): reject expired tokens`. |
| `REVIEW`. | Not enough maintainer approvals yet. | Wait for reviews; the check re-runs on each review. |
| The `smartcloud` check fails naming another check. | The aggregate check fails when any other check fails. | Fix that check, re-run it, then re-run the smartcloud job. |
| `required.missing` after an hour. | A check listed under `required.expect` never appeared. | Make sure the CI job still exists with that name and runs on pull requests. |
| `required.check-run-missing`. | The workflow does not pass `checkRunId`. | Merge the latest sync pull request, which updates `smartcloud.yml`. |
| Checks are neutral with "config left out". | A fork or Dependabot pull request cannot read the private preset. | Expected; it does not block the merge. |
| The check never re-runs after a review on a fork's pull request. | The fork's token cannot re-run workflows. | Push a commit, or re-run the check by hand. |
| The run fails on a value in `.github/smartcloud.yml`. | The file sets a different value for a key the preset sets. Presets are locked. | Remove the key, or restate the preset's value exactly. Check with `smartcloud validate`. |
| `unknown key` warnings (`config.ignored`). | The config or preset has a key this smartcloud version does not know. | Usually harmless; fix typos, or update smartcloud. |

## <a id="workflows"></a>Workflows

| What you see | Why | Fix |
| --- | --- | --- |
| Every `house-*` workflow fails at once with a "workflow was not found" or access error. | `Resnovas/.github` is private and its Actions access does not allow the organisation. | Settings > Actions > General > Access on `Resnovas/.github`: allow repositories in the organisation. |
| CodeQL upload fails: advanced results rejected. | GitHub's automatic CodeQL setup is on. | The preset turns it off on the next settings run; an organisation security configuration must not enforce it. |
| Dependency review fails on a new package. | It has a high or critical advisory, or a licence outside the allowed list. | Pick another version or package, or have a maintainer allow it in `.github/dependency-review-config.yml` after `house:local` (it applies once merged). |
| zizmor fails on `unpinned-uses`. | A third-party action is referenced by tag. | Pin it to the full commit SHA with the release as a comment. |
| A required check waits forever. | The workflow is filtered by `paths`, or does not run on `merge_group`. | Remove the path filter and skip jobs instead; add `merge_group`. See [CI standards](ci-standards.md#skipping). |
| The attest job fails: release is published. | Published releases are immutable. | Create the release as a draft, attest, then publish. |

## <a id="local"></a>In this repository

| What you see | Fix |
| --- | --- |
| `Out of date with templates/` from `npm run check`. | Run `npm run render` and commit the result. |
| `Agent commands and MCP configs` out of date. | Run `node tools/dev/surfaces.mjs sync` and commit the result. |
| `LLMS.md is out of date`. | Run `npm run ai-docs` and commit `LLMS.md`. |
| A test says a template is missing from `.prettierignore`. | Add the new synced file to `templates/.prettierignore`, inside the managed block, then render. |
| A test says an action is not pinned, a job has no timeout or no permissions. | Follow [CI standards](ci-standards.md#workflow-rules). |
