# Releases and changelogs

`templates/` has no release configuration yet: each repository keeps its own [Nx release](https://nx.dev/features/manage-releases) setup.
This page is the house default, which [smartcloud's release guide](https://github.com/Resnovas/smartcloud/blob/main/docs/releasing.mdx) follows.
[Back to the README](../README.md)

## <a id="default"></a>The house default

- **Nx release, started by hand** from a `release` workflow on the default branch. Conventional commits since the last tag decide the version. The published projects form one release group, tagged `v{version}`.
- **The GitHub release holds the main notes.** `release.changelog.workspaceChangelog` sets `createRelease: github`, with a renderer that replaces Nx's emoji with words (smartcloud's `tools/release/changelog-renderer.ts`).
- **The notes are also written to the repository** through the same renderer: the workspace changelog to the root `CHANGELOG.md` (new releases above any older history), and `projectChangelogs` to `{projectRoot}/CHANGELOG.md` for each published project, with `createRelease: false`. Unpublished libraries get none; their changes appear under the projects that bundle them.
- **The changelog files reach the default branch through a pull request**, because the ruleset only takes changes through pull requests with signed commits. After tagging, a separate `changelogs` job creates a Resnovas Bot app token (see [Access](access.md)), commits the files through the GitHub API so GitHub signs the commit, and opens `chore(release): changelogs for v<version>`. The commit is signed off by `resnovas-smartcloud[bot]`, a trusted bot in the preset. Merge it before the next release.
- **The app's token never meets untrusted code.** The job that creates it checks out and runs nothing from the repository; the job that installs dependencies and runs Nx hands it the files as an artifact.
- **Releases are immutable once published** (the preset's `immutableReleases`). Create the release as a draft, attach its files and [attest them](workflows.md#attest), then publish.

## <a id="future"></a>What the sync will manage later

When smartcloud's sync manages Nx release configuration ([SMC-81](https://linear.app/resnovas/issue/SMC-81)), it should sync:

- `nx.json`'s `release.changelog` (both changelog settings and the renderer path) and `release.conventionalCommits`, in a managed block, leaving `release.groups` local, since each repository lists its own published projects;
- the changelog renderer, as `tools/release/changelog-renderer.ts`;
- the release workflow's `changelogs` job, as a managed job.
