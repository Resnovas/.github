## How the sync reaches other repositories

This repository does not push anything. Each downstream repository runs the
synced `smartcloud` workflow, and smartcloud's sync feature reads
`sync.source: Resnovas/.github/templates@main` from the preset, renders it with
the same rules as `scripts/render.mjs`, and opens or updates one pull request
from the `house/sync` branch.

- Values come from `sync.values` in `smartcloud/house.yml`, and `REPOSITORY`
  from the repository the sync runs in. `house.yml` is only for this
  repository's own root.
- A repository skips a template with `sync.exclude` in its
  `.github/smartcloud.yml`; an excluded template needs no values.
- The sync runs on `schedule` (Mondays 07:00 UTC), `workflow_dispatch` and
  `push` to `main`, with the Resnovas Bot app token, which the synced workflow
  mints only for those events (and for a merged pull request's `closed`
  event, for backports, whose pull requests must start CI) and scopes to the
  repository alone. The
  templates are read with a separate read-only token (`houseToken`,
  `permission-contents: read` on `.github`), so the app token never needs
  `Resnovas/.github`. Restricted runs (forks, Dependabot, only the workflow
  token) skip the sync; a pull request run with the house token still runs
  the `SYNC` edit check below.
- `Resnovas/.github` is public, so any token can read it; the read-only
  house token exists so no privileged token touches it and its reads use
  the app's rate limit.
- Never widen the synced workflow's app token back to `.github` or mint it on
  an open `pull_request` or `issue_comment` run: a pull request controls its own workflow file, and the
  token split is what stops a leaf repository writing to this one. A new
  smartcloud input must be optional, because repositories run the released
  `v2`, which ignores inputs it does not know.
- On pull requests, `sync.check: true` makes smartcloud flag edits to synced
  content (rule `SYNC`): a changed synced document or managed block, removed
  markers, a deleted synced file, or a local rule that redefines a synced one.
  It is an error for contributors and a warning for maintainers. Pull requests
  in this repository are not checked, because they change the templates.
- smartcloud's sync skips the source repository itself, which is why this
  repository renders its own root with `scripts/render.mjs` and CI checks it.

So a change merged to `templates/` on `main` reaches every repository in its
next sync pull request, usually within a week, or at once when someone runs its
smartcloud workflow by hand. Reusable workflows and the preset are read from
`main` on every run, so they change everywhere immediately on merge.

Never write a change that breaks a downstream smartcloud run: unknown config
keys only warn, but a template placeholder with no value in `sync.values`
fails every repository's sync. Add the value to the preset in the same commit,
or give the placeholder a default (`{{KEY:-default}}`) when each repository
should set its own; never put a per-repository value in the preset's
`sync.values`, which locks it for everyone.
